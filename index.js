const express = require("express");
const WebSocket = require("ws");
const axios = require("axios");
const path = require("path");
require("dotenv").config();

const app = express();
const server = require("http").createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 8080;
const MEDICAL_API_URL = process.env.MEDICAL_API_URL || "http://127.0.0.1:8000/process-query";
const WHISPER_MODEL = process.env.WHISPER_MODEL || "whisper-large-v3";

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

function normalizeMedicalResponse(data) {
  if (!data) return "No response received from the medical service.";
  if (typeof data === "string") return data;
  return data.response || data.advice || data.medical_advice || JSON.stringify(data);
}

async function analyzeMedicalQuery(query, meta = {}) {
  if (!query || !query.trim()) {
    return "No symptoms or query were provided.";
  }

  const response = await axios.post(MEDICAL_API_URL, {
    query: query.trim(),
    source: meta.source || "text",
    patient: meta.patient || {},
  });

  return normalizeMedicalResponse(response.data);
}

async function transcribeWithWhisper(buffer, filename, contentType) {
  if (!process.env.GROQ_API_KEY && !process.env.GROQ_API_KEY_JS) {
    throw new Error("Missing GROQ_API_KEY or GROQ_API_KEY_JS for Whisper transcription.");
  }

  let Groq;
  let toFile;
  try {
    Groq = require("groq-sdk");
    ({ toFile } = require("groq-sdk/uploads"));
  } catch (error) {
    throw new Error("Install groq-sdk to enable Whisper transcription: npm install groq-sdk");
  }

  const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY_JS || process.env.GROQ_API_KEY,
  });

  const transcription = await groq.audio.transcriptions.create({
    file: await toFile(buffer, filename, { type: contentType }),
    model: WHISPER_MODEL,
  });

  return transcription.text || "";
}

function decodeMulawSample(sample) {
  const MULAW_BIAS = 0x84;
  sample = ~sample & 0xff;
  const sign = sample & 0x80;
  const exponent = (sample >> 4) & 0x07;
  const mantissa = sample & 0x0f;
  let decoded = ((mantissa << 3) + MULAW_BIAS) << exponent;
  decoded -= MULAW_BIAS;
  return sign ? -decoded : decoded;
}

function buildWavFromMulaw(chunks, sampleRate = 8000) {
  const mulaw = Buffer.concat(chunks);
  const pcm = Buffer.alloc(mulaw.length * 2);

  for (let i = 0; i < mulaw.length; i += 1) {
    pcm.writeInt16LE(decodeMulawSample(mulaw[i]), i * 2);
  }

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    medicalApiUrl: MEDICAL_API_URL,
    whisperModel: WHISPER_MODEL,
    whisperConfigured: Boolean(process.env.GROQ_API_KEY || process.env.GROQ_API_KEY_JS),
  });
});

app.post("/api/query", async (req, res) => {
  try {
    const advice = await analyzeMedicalQuery(req.body.query || req.body.message || "", {
      source: req.body.source || "text",
      patient: req.body.patient || {},
    });
    res.json({ response: advice });
  } catch (error) {
    res.status(502).json({
      response: "The medical analysis service could not be reached.",
      detail: error.message,
    });
  }
});

app.post(
  "/api/transcribe-audio",
  express.raw({
    type: ["audio/webm", "audio/wav", "audio/mpeg", "audio/mp4", "application/octet-stream"],
    limit: "25mb",
  }),
  async (req, res) => {
    try {
      if (!req.body || !req.body.length) {
        return res.status(400).json({ error: "No audio payload received." });
      }

      const contentType = req.headers["content-type"] || "audio/webm";
      const extension = contentType.includes("wav") ? "wav" : "webm";
      const text = await transcribeWithWhisper(req.body, `recording.${extension}`, contentType);
      return res.json({ text });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
);

app.post(["/", "/twilio/voice"], (req, res) => {
  res.set("Content-Type", "text/xml");
  res.send(`
    <Response>
      <Start>
        <Stream url="wss://${req.headers.host}/twilio/media" />
      </Start>
      <Say>Welcome to DocSync. Please describe your health problem after the tone.</Say>
      <Pause length="60" />
    </Response>
  `);
});

wss.on("connection", (ws, req) => {
  const isTwilioStream = req.url === "/twilio/media" || req.url === "/";
  const audioChunks = [];

  ws.send(JSON.stringify({ event: "connection-ready", text: "DocSync stream connected." }));

  ws.on("message", async (message) => {
    if (!isTwilioStream) return;

    let msg;
    try {
      msg = JSON.parse(message);
    } catch (_error) {
      return;
    }

    if (msg.event === "media" && msg.media && msg.media.payload) {
      audioChunks.push(Buffer.from(msg.media.payload, "base64"));
    }

    if (msg.event === "stop") {
      await handleTwilioAudio(ws, audioChunks);
      audioChunks.length = 0;
    }
  });

  ws.on("close", async () => {
    if (audioChunks.length) {
      await handleTwilioAudio(ws, audioChunks);
      audioChunks.length = 0;
    }
  });
});

async function handleTwilioAudio(ws, audioChunks) {
  if (!audioChunks.length || ws.readyState !== WebSocket.OPEN) return;

  try {
    ws.send(JSON.stringify({ event: "transcription-started" }));
    const wav = buildWavFromMulaw(audioChunks);
    const transcript = await transcribeWithWhisper(wav, "twilio-call.wav", "audio/wav");
    ws.send(JSON.stringify({ event: "final-transcription", text: transcript }));

    const advice = await analyzeMedicalQuery(transcript, { source: "voice" });
    ws.send(JSON.stringify({ event: "advice", text: advice }));
  } catch (error) {
    ws.send(JSON.stringify({ event: "error", text: error.message }));
  }
}

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

server.listen(PORT, () => {
  console.log(`DocSync UI listening on http://localhost:${PORT}`);
});
