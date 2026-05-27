const state = {
  mediaRecorder: null,
  audioChunks: [],
  recordingStartedAt: null,
  timerId: null,
  latestAdvice: "",
  latestTranscript: "",
};

const elements = {
  apiDot: document.querySelector("#apiDot"),
  apiStatus: document.querySelector("#apiStatus"),
  apiDetail: document.querySelector("#apiDetail"),
  sessionSource: document.querySelector("#sessionSource"),
  clearSession: document.querySelector("#clearSession"),
  patientName: document.querySelector("#patientName"),
  patientAge: document.querySelector("#patientAge"),
  patientGender: document.querySelector("#patientGender"),
  severity: document.querySelector("#severity"),
  queryInput: document.querySelector("#queryInput"),
  notes: document.querySelector("#notes"),
  sendQuery: document.querySelector("#sendQuery"),
  saveSession: document.querySelector("#saveSession"),
  recordButton: document.querySelector("#recordButton"),
  recordLabel: document.querySelector("#recordLabel"),
  recordTimer: document.querySelector("#recordTimer"),
  recordingState: document.querySelector("#recordingState"),
  voiceHint: document.querySelector("#voiceHint"),
  useTranscript: document.querySelector("#useTranscript"),
  transcriptText: document.querySelector("#transcriptText"),
  adviceOutput: document.querySelector("#adviceOutput"),
  riskPill: document.querySelector("#riskPill"),
  historyList: document.querySelector("#historyList"),
};

function setApiStatus(status, detail, mode) {
  elements.apiStatus.textContent = status;
  elements.apiDetail.textContent = detail;
  elements.apiDot.className = `status-dot ${mode || ""}`.trim();
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

function buildQueryText() {
  const query = elements.queryInput.value.trim();
  const patient = collectPatient();
  const context = [];

  if (patient.age) context.push(`Age: ${patient.age}`);
  if (patient.gender) context.push(`Gender: ${patient.gender}`);
  if (patient.severity) context.push(`Severity: ${patient.severity}`);
  if (patient.notes) context.push(`Allergies/current medication: ${patient.notes}`);

  return context.length ? `${query}\n\nPatient context:\n${context.join("\n")}` : query;
}

function setAdvice(text, loading = false) {
  state.latestAdvice = text;
  elements.adviceOutput.textContent = text;
  elements.adviceOutput.classList.toggle("loading", loading);
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
  ];
  const normalized = text.toLowerCase();
  const risk = emergencyTerms.some((term) => normalized.includes(term));
  elements.riskPill.textContent = risk ? "Urgent symptoms" : "Safety review";
  elements.riskPill.classList.toggle("danger", true);
}

async function sendQuery(source = "text") {
  const query = buildQueryText();
  if (!query.trim()) {
    setAdvice("Add symptoms or record a voice note before sending.");
    return;
  }

  elements.sessionSource.textContent = source === "voice" ? "Voice session" : "Text session";
  detectRisk(query);
  setAdvice("Analyzing symptoms...", true);

  try {
    const response = await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        source,
        patient: collectPatient(),
      }),
    });
    const data = await response.json();
    setAdvice(data.response || data.advice || data.detail || "No guidance was returned.");
  } catch (error) {
    setAdvice(`Unable to reach the medical service. ${error.message}`);
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
    await sendQuery("voice");
  } catch (error) {
    elements.recordingState.textContent = "Needs setup";
    elements.voiceHint.textContent = error.message;
    elements.transcriptText.textContent = error.message;
  }
}

function saveSession() {
  const query = elements.queryInput.value.trim();
  if (!query && !state.latestAdvice) return;

  const sessions = JSON.parse(localStorage.getItem("docsync.sessions") || "[]");
  sessions.unshift({
    patient: elements.patientName.value.trim() || "Unnamed patient",
    date: new Date().toLocaleString(),
    query,
    advice: state.latestAdvice,
    source: elements.sessionSource.textContent,
  });
  localStorage.setItem("docsync.sessions", JSON.stringify(sessions.slice(0, 12)));
  renderHistory();
}

function renderHistory() {
  const sessions = JSON.parse(localStorage.getItem("docsync.sessions") || "[]");
  if (!sessions.length) {
    elements.historyList.innerHTML = '<p class="empty-state">No saved sessions yet.</p>';
    return;
  }

  elements.historyList.innerHTML = sessions
    .map(
      (session) => `
        <article class="history-item">
          <strong>${escapeHtml(session.patient)}</strong>
          <span>${escapeHtml(session.date)} - ${escapeHtml(session.source)}</span>
          <p>${escapeHtml(session.query || session.advice || "No details").slice(0, 170)}</p>
        </article>
      `
    )
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clearSession() {
  elements.queryInput.value = "";
  elements.notes.value = "";
  elements.transcriptText.textContent = "No voice transcript yet.";
  elements.recordTimer.textContent = "00:00";
  elements.recordingState.textContent = "Idle";
  elements.voiceHint.textContent = "Whisper transcription will appear below.";
  elements.sessionSource.textContent = "Text session";
  setAdvice("Submit a text query or record audio to generate guidance.");
}

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    setApiStatus(
      "UI server online",
      data.whisperConfigured ? "Whisper credentials detected" : "Add GROQ_API_KEY for Whisper",
      data.whisperConfigured ? "online" : ""
    );
  } catch (_error) {
    setApiStatus("System offline", "Unable to reach local server", "offline");
  }
}

elements.sendQuery.addEventListener("click", () => sendQuery("text"));
elements.saveSession.addEventListener("click", saveSession);
elements.clearSession.addEventListener("click", clearSession);
elements.useTranscript.addEventListener("click", () => {
  if (state.latestTranscript) elements.queryInput.value = state.latestTranscript;
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

checkHealth();
renderHistory();
