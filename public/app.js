const STORAGE_KEYS = {
  sessions: "docsync.sessions",
  settings: "docsync.settings",
};

const state = {
  mediaRecorder: null,
  audioChunks: [],
  recordingStartedAt: null,
  timerId: null,
  latestAdvice: "",
  latestTranscript: "",
  messages: [],
  sessionId: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
  status: null,
  settings: {
    autoSave: "on",
    defaultSource: "Text session",
    historyLimit: 12,
  },
};

const elements = {
  navItems: document.querySelectorAll(".nav-item"),
  views: document.querySelectorAll(".view-panel"),
  apiDot: document.querySelector("#apiDot"),
  apiStatus: document.querySelector("#apiStatus"),
  apiDetail: document.querySelector("#apiDetail"),
  sessionSource: document.querySelector("#sessionSource"),
  clearSession: document.querySelector("#clearSession"),
  endSession: document.querySelector("#endSession"),
  patientName: document.querySelector("#patientName"),
  patientAge: document.querySelector("#patientAge"),
  patientGender: document.querySelector("#patientGender"),
  severity: document.querySelector("#severity"),
  queryInput: document.querySelector("#queryInput"),
  followupInput: document.querySelector("#followupInput"),
  notes: document.querySelector("#notes"),
  sendQuery: document.querySelector("#sendQuery"),
  sendFollowup: document.querySelector("#sendFollowup"),
  saveSession: document.querySelector("#saveSession"),
  clearHistory: document.querySelector("#clearHistory"),
  recordButton: document.querySelector("#recordButton"),
  recordLabel: document.querySelector("#recordLabel"),
  recordTimer: document.querySelector("#recordTimer"),
  recordingState: document.querySelector("#recordingState"),
  voiceHint: document.querySelector("#voiceHint"),
  useTranscript: document.querySelector("#useTranscript"),
  transcriptText: document.querySelector("#transcriptText"),
  chatOutput: document.querySelector("#chatOutput"),
  riskPill: document.querySelector("#riskPill"),
  historyList: document.querySelector("#historyList"),
  patientList: document.querySelector("#patientList"),
  statusGrid: document.querySelector("#statusGrid"),
  refreshStatus: document.querySelector("#refreshStatus"),
  autoSaveSetting: document.querySelector("#autoSaveSetting"),
  defaultSourceSetting: document.querySelector("#defaultSourceSetting"),
  historyLimitSetting: document.querySelector("#historyLimitSetting"),
};

function getSessions() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.sessions) || "[]");
}

function setSessions(sessions) {
  localStorage.setItem(
    STORAGE_KEYS.sessions,
    JSON.stringify(sessions.slice(0, Number(state.settings.historyLimit) || 12))
  );
}

function loadSettings() {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || "{}");
  state.settings = { ...state.settings, ...saved };
  elements.autoSaveSetting.value = state.settings.autoSave;
  elements.defaultSourceSetting.value = state.settings.defaultSource;
  elements.historyLimitSetting.value = state.settings.historyLimit;
  elements.sessionSource.textContent = state.settings.defaultSource;
}

function saveSettings() {
  state.settings = {
    autoSave: elements.autoSaveSetting.value,
    defaultSource: elements.defaultSourceSetting.value,
    historyLimit: Math.min(50, Math.max(3, Number(elements.historyLimitSetting.value) || 12)),
  };
  elements.historyLimitSetting.value = state.settings.historyLimit;
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
  if (!state.messages.length) elements.sessionSource.textContent = state.settings.defaultSource;
  setSessions(getSessions());
  renderHistory();
  renderPatients();
}

function setApiStatus(status, detail, mode) {
  elements.apiStatus.textContent = status;
  elements.apiDetail.textContent = detail;
  elements.apiDot.className = `status-dot ${mode || ""}`.trim();
}

function showView(viewName) {
  elements.views.forEach((view) => view.classList.toggle("active", view.id === `${viewName}View`));
  elements.navItems.forEach((item) => item.classList.toggle("active", item.dataset.view === viewName));
  if (viewName === "history") renderHistory();
  if (viewName === "patients") renderPatients();
  if (viewName === "status") renderStatus();
}

function collectPatient() {
  return {
    name: elements.patientName.value.trim(),
    age: elements.patientAge.value.trim(),
    gender: elements.patientGender.value,
    severity: elements.severity.value,
    notes: elements.notes.value.trim(),
  };
}

function hasPatientData(patient) {
  return Object.values(patient).some((value) => String(value || "").trim());
}

function buildFirstMessage() {
  return elements.queryInput.value.trim();
}

function detectRisk(text) {
  const emergencyTerms = [
    "chest pain",
    "difficulty breathing",
    "shortness of breath",
    "fainting",
    "stroke",
    "severe bleeding",
    "poison",
    "suicidal",
    "unconscious",
    "emergency",
    "worst headache",
  ];
  const normalized = text.toLowerCase();
  const risk = emergencyTerms.some((term) => normalized.includes(term));
  elements.riskPill.textContent = risk ? "Urgent symptoms" : "Safety review";
  elements.riskPill.classList.toggle("danger", true);
}

function appendMessage(role, content, options = {}) {
  const message = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${state.messages.length}`,
    role,
    content,
    source: options.source || elements.sessionSource.textContent,
    time: new Date().toISOString(),
    pending: Boolean(options.pending),
  };
  state.messages.push(message);
  renderChat();
  return message;
}

function updateMessage(id, patch) {
  const message = state.messages.find((item) => item.id === id);
  if (!message) return;
  Object.assign(message, patch);
  renderChat();
}

function renderChat() {
  if (!state.messages.length) {
    elements.chatOutput.innerHTML = `
      <article class="chat-message assistant">
        <strong>DocSync</strong>
        <p>Submit a text query or record audio to start the consultation.</p>
      </article>
    `;
    return;
  }

  elements.chatOutput.innerHTML = state.messages
    .map(
      (message) => `
        <article class="chat-message ${message.role}${message.pending ? " loading" : ""}">
          <strong>${message.role === "user" ? "Patient" : "DocSync"}</strong>
          <p>${escapeHtml(message.content)}</p>
        </article>
      `
    )
    .join("");
  elements.chatOutput.scrollTop = elements.chatOutput.scrollHeight;
}

async function submitMessage(text, source = "text") {
  const query = text.trim();
  if (!query) return;

  const patient = collectPatient();
  const priorMessages = state.messages
    .filter((message) => !message.pending)
    .map((message) => ({ role: message.role, content: message.content }));

  elements.sessionSource.textContent = source === "voice" ? "Voice session" : "Text session";
  detectRisk(`${query} ${patient.severity}`);
  appendMessage("user", query, { source });
  const pending = appendMessage("assistant", "Analyzing symptoms...", { source, pending: true });

  elements.sendQuery.disabled = true;
  elements.sendFollowup.disabled = true;

  try {
    const response = await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        source,
        patient,
        history: priorMessages,
      }),
    });
    const data = await response.json();
    const advice = data.response || data.advice || data.detail || "No guidance was returned.";
    state.latestAdvice = advice;
    updateMessage(pending.id, { content: advice, pending: false });
  } catch (error) {
    updateMessage(pending.id, {
      content: `Unable to reach the medical service. ${error.message}`,
      pending: false,
    });
  } finally {
    elements.sendQuery.disabled = false;
    elements.sendFollowup.disabled = false;
  }
}

function buildSessionRecord() {
  const patient = collectPatient();
  return {
    id: state.sessionId,
    patient,
    patientLabel: patient.name || "Unnamed patient",
    date: new Date().toLocaleString(),
    createdAt: new Date().toISOString(),
    source: elements.sessionSource.textContent,
    transcript: state.latestTranscript,
    initialQuery: elements.queryInput.value.trim(),
    latestAdvice: state.latestAdvice,
    messages: state.messages.filter((message) => !message.pending),
  };
}

function saveSession({ clearAfter = false } = {}) {
  if (!state.messages.length && !hasPatientData(collectPatient()) && !state.latestTranscript) return;

  const record = buildSessionRecord();
  const sessions = getSessions().filter((session) => session.id !== record.id);
  sessions.unshift(record);
  setSessions(sessions);
  renderHistory();
  renderPatients();

  if (clearAfter) clearSession({ preservePatient: false });
}

function endSession() {
  if (state.settings.autoSave === "on") saveSession({ clearAfter: true });
  else clearSession({ preservePatient: false });
  showView("history");
}

function renderHistory() {
  const sessions = getSessions();
  if (!sessions.length) {
    elements.historyList.innerHTML = '<p class="empty-state">No saved sessions yet.</p>';
    return;
  }

  elements.historyList.innerHTML = sessions
    .map((session) => {
      const summary =
        session.messages?.find((message) => message.role === "user")?.content ||
        session.initialQuery ||
        session.latestAdvice ||
        "No details";
      return `
        <article class="history-item" data-session-id="${escapeHtml(session.id)}">
          <strong>${escapeHtml(session.patientLabel || "Unnamed patient")}</strong>
          <span>${escapeHtml(session.date)} - ${escapeHtml(session.source || "Session")}</span>
          <p>${escapeHtml(summary).slice(0, 180)}</p>
          <small>${session.messages?.length || 0} messages</small>
        </article>
      `;
    })
    .join("");
}

function renderPatients() {
  const patientMap = new Map();
  getSessions().forEach((session) => {
    const patient = session.patient || {};
    const key = patient.name || `${patient.age || "Unknown"}-${patient.gender || "Not specified"}`;
    const previous = patientMap.get(key);
    if (!previous) {
      patientMap.set(key, {
        patient,
        sessions: 1,
        lastSeen: session.date,
        lastConcern: session.initialQuery || session.messages?.[0]?.content || "",
      });
    } else {
      previous.sessions += 1;
    }
  });

  const patients = Array.from(patientMap.values());
  if (!patients.length) {
    elements.patientList.innerHTML = '<p class="empty-state">No patient records yet.</p>';
    return;
  }

  elements.patientList.innerHTML = patients
    .map(
      ({ patient, sessions, lastSeen, lastConcern }) => `
        <article class="patient-item">
          <strong>${escapeHtml(patient.name || "Unnamed patient")}</strong>
          <span>${escapeHtml([patient.age && `${patient.age} yrs`, patient.gender, patient.severity].filter(Boolean).join(" - ") || "No demographics")}</span>
          <p>${escapeHtml(patient.notes || "No allergies or medication noted.")}</p>
          <small>${sessions} session${sessions === 1 ? "" : "s"} - last seen ${escapeHtml(lastSeen)}</small>
          <em>${escapeHtml(lastConcern).slice(0, 140)}</em>
        </article>
      `
    )
    .join("");
}

function loadSession(sessionId) {
  const session = getSessions().find((item) => item.id === sessionId);
  if (!session) return;
  const patient = session.patient || {};
  state.sessionId = session.id;
  state.messages = session.messages || [];
  state.latestTranscript = session.transcript || "";
  state.latestAdvice = session.latestAdvice || "";
  elements.patientName.value = patient.name || "";
  elements.patientAge.value = patient.age || "";
  elements.patientGender.value = patient.gender || "";
  elements.severity.value = patient.severity || "Mild";
  elements.notes.value = patient.notes || "";
  elements.queryInput.value = session.initialQuery || "";
  elements.transcriptText.textContent = state.latestTranscript || "No voice transcript yet.";
  elements.sessionSource.textContent = session.source || state.settings.defaultSource;
  renderChat();
  showView("consult");
}

function renderStatus() {
  const status = state.status || {};
  const rows = [
    ["UI server", status.status || "Unknown"],
    ["Medical API URL", status.medicalApiUrl || "Not reported"],
    ["Whisper model", status.whisperModel || "Not reported"],
    ["Groq chat model", status.groqChatModel || "Not reported"],
    ["Groq key", status.whisperConfigured ? "Detected" : "Missing"],
  ];
  elements.statusGrid.innerHTML = rows
    .map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`)
    .join("");
}

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    state.status = data;
    setApiStatus(
      "UI server online",
      data.whisperConfigured ? "Groq credentials detected" : "Add GROQ_API_KEY",
      data.whisperConfigured ? "online" : ""
    );
    renderStatus();
  } catch (_error) {
    setApiStatus("System offline", "Unable to reach local server", "offline");
    state.status = null;
    renderStatus();
  }
}

function updateTimer() {
  if (!state.recordingStartedAt) return;
  const elapsed = Math.floor((Date.now() - state.recordingStartedAt) / 1000);
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");
  elements.recordTimer.textContent = `${minutes}:${seconds}`;
}

async function startRecording() {
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    elements.voiceHint.textContent = "This browser does not support audio recording.";
    return;
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  state.audioChunks = [];
  state.mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

  state.mediaRecorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) state.audioChunks.push(event.data);
  });

  state.mediaRecorder.addEventListener("stop", async () => {
    stream.getTracks().forEach((track) => track.stop());
    await transcribeRecording();
  });

  state.mediaRecorder.start();
  state.recordingStartedAt = Date.now();
  state.timerId = setInterval(updateTimer, 250);
  document.body.classList.add("recording");
  elements.recordLabel.textContent = "Stop Recording";
  elements.recordingState.textContent = "Recording";
  elements.voiceHint.textContent = "Listening through your browser microphone.";
}

function stopRecording() {
  if (!state.mediaRecorder) return;
  state.mediaRecorder.stop();
  state.mediaRecorder = null;
  clearInterval(state.timerId);
  state.timerId = null;
  state.recordingStartedAt = null;
  document.body.classList.remove("recording");
  elements.recordLabel.textContent = "Start Recording";
  elements.recordingState.textContent = "Transcribing";
  elements.voiceHint.textContent = "Sending audio to Whisper.";
}

async function transcribeRecording() {
  const blob = new Blob(state.audioChunks, { type: "audio/webm" });
  if (!blob.size) {
    elements.recordingState.textContent = "Idle";
    elements.voiceHint.textContent = "No audio was captured.";
    return;
  }

  try {
    const response = await fetch("/api/transcribe-audio", {
      method: "POST",
      headers: { "Content-Type": "audio/webm" },
      body: blob,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Transcription failed.");

    state.latestTranscript = data.text || "";
    elements.transcriptText.textContent = state.latestTranscript || "Whisper did not return text.";
    elements.queryInput.value = state.latestTranscript;
    elements.recordingState.textContent = "Ready";
    elements.voiceHint.textContent = "Transcript copied into the symptom field.";
    await submitMessage(state.latestTranscript, "voice");
  } catch (error) {
    elements.recordingState.textContent = "Needs setup";
    elements.voiceHint.textContent = error.message;
    elements.transcriptText.textContent = error.message;
  }
}

function clearSession(options = {}) {
  const preservePatient = Boolean(options.preservePatient);
  if (!preservePatient) {
    elements.patientName.value = "";
    elements.patientAge.value = "";
    elements.patientGender.value = "";
    elements.severity.value = "Mild";
  }
  elements.queryInput.value = "";
  elements.followupInput.value = "";
  elements.notes.value = "";
  elements.transcriptText.textContent = "No voice transcript yet.";
  elements.recordTimer.textContent = "00:00";
  elements.recordingState.textContent = "Idle";
  elements.voiceHint.textContent = "Whisper transcription will appear below.";
  elements.sessionSource.textContent = state.settings.defaultSource;
  state.latestAdvice = "";
  state.latestTranscript = "";
  state.messages = [];
  state.sessionId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  renderChat();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

elements.navItems.forEach((item) => {
  item.addEventListener("click", () => showView(item.dataset.view));
});

elements.sendQuery.addEventListener("click", async () => {
  const query = buildFirstMessage();
  if (!query) {
    appendMessage("assistant", "Add symptoms or record a voice note before sending.");
    return;
  }
  elements.queryInput.value = "";
  await submitMessage(query, "text");
});

elements.sendFollowup.addEventListener("click", async () => {
  const followup = elements.followupInput.value.trim();
  if (!followup) return;
  elements.followupInput.value = "";
  await submitMessage(followup, "text");
});

elements.followupInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    elements.sendFollowup.click();
  }
});

elements.saveSession.addEventListener("click", () => saveSession());
elements.endSession.addEventListener("click", endSession);
elements.clearSession.addEventListener("click", () => clearSession({ preservePatient: false }));
elements.clearHistory.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEYS.sessions);
  renderHistory();
  renderPatients();
});
elements.refreshStatus.addEventListener("click", checkHealth);
elements.useTranscript.addEventListener("click", () => {
  if (state.latestTranscript) elements.queryInput.value = state.latestTranscript;
});
elements.historyList.addEventListener("click", (event) => {
  const item = event.target.closest(".history-item");
  if (item) loadSession(item.dataset.sessionId);
});
elements.recordButton.addEventListener("click", async () => {
  if (state.mediaRecorder) {
    stopRecording();
    return;
  }

  try {
    await startRecording();
  } catch (error) {
    elements.voiceHint.textContent = error.message;
  }
});
elements.autoSaveSetting.addEventListener("change", saveSettings);
elements.defaultSourceSetting.addEventListener("change", saveSettings);
elements.historyLimitSetting.addEventListener("change", saveSettings);

loadSettings();
renderChat();
renderHistory();
renderPatients();
checkHealth();
