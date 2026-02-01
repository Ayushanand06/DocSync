const WebSocket = require("ws");
const express = require("express");
const axios = require("axios");
const app = express();
const server = require("http").createServer(app);
const wss = new WebSocket.Server({ server });
const path = require("path");
require("dotenv").config();

const speech = require("@google-cloud/speech");
const speechClient = new speech.SpeechClient();

const TWILIO_RESPONSE_API = "https://d8c7-119-161-98-139.ngrok-free.app/receive-transcription";

// Function to create a speech recognition request
const createRequest = (languageCode) => ({
  config: {
    encoding: "MULAW",
    sampleRateHertz: 8000,
    languageCode: languageCode,
  },
  interimResults: true,
});

let silenceTimeout;
const SILENCE_TIMEOUT_MS = 5000; // 5 seconds

wss.on("connection", function connection(ws) {
  console.log("New Connection Initiated");

  let recognizeStream = null;
  let accumulatedTranscript = ""; // Variable to accumulate the final transcripts
  let languageCode = "en-US"; // Default language

  const sendTranscriptToApi = async (transcript) => {
    try {
      const response = await axios.post(TWILIO_RESPONSE_API, { message: transcript });
      return response.data.advice;
    } catch (error) {
      console.error("Error sending transcript to API:", error);
      return "Sorry, we could not process your request at the moment.";
    }
  };

  const handleApiResponse = async (transcript) => {
    const advice = await sendTranscriptToApi(transcript);
    // Send the advice back to Twilio
    ws.send(
      JSON.stringify({
        event: "advice",
        text: advice,
      })
    );
  };

  const resetSilenceTimeout = () => {
    if (silenceTimeout) clearTimeout(silenceTimeout);
    silenceTimeout = setTimeout(async () => {
      console.log("User is silent. Sending transcript to API...");
      await handleApiResponse(accumulatedTranscript.trim());
      accumulatedTranscript = ""; // Clear after sending
    }, SILENCE_TIMEOUT_MS);
  };

  ws.on("message", function incoming(message) {
    const msg = JSON.parse(message);
    switch (msg.event) {
      case "connected":
        console.log("A new call has connected.");
        break;
      case "start":
        console.log(`Starting Media Stream ${msg.streamSid}`);
        
        // Start the initial streaming recognize request with the default language
        recognizeStream = speechClient
          .streamingRecognize(createRequest(languageCode))
          .on("error", console.error)
          .on("data", (data) => {
            if (data.results[0].isFinal) {
              const transcript = data.results[0].alternatives[0].transcript;
              console.log(`Transcript: ${transcript}`);

              // Accumulate the final transcript
              accumulatedTranscript += transcript + " ";

              // Reset the silence timeout
              resetSilenceTimeout();

              // Send final transcriptions to the clients
              wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(
                    JSON.stringify({
                      event: "final-transcription",
                      text: transcript,
                    })
                  );
                }
              });
            } else {
              const interimTranscript = data.results[0].alternatives[0].transcript;
              console.log(`Interim Transcript: ${interimTranscript}`);

              // Send interim transcriptions to the clients
              wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(
                    JSON.stringify({
                      event: "interim-transcription",
                      text: interimTranscript,
                    })
                  );
                }
              });
            }
          });
        break;
      case "media":
        // Write Media Packets to the recognize stream
        const audioChunk = Buffer.from(msg.media.payload, 'base64');
        if (recognizeStream) {
          recognizeStream.write(audioChunk);
        }
        break;
      case "stop":
        console.log("Call Has Ended");
        if (recognizeStream) {
          recognizeStream.end();
          recognizeStream = null;
        }
        handleApiResponse(accumulatedTranscript.trim());
        accumulatedTranscript = ""; // Clear after sending
        break;
    }
  });

  ws.on("close", () => {
    if (recognizeStream) {
      recognizeStream.end();
      recognizeStream = null;
    }
    handleApiResponse(accumulatedTranscript.trim());
  });

  ws.on("error", (error) => {
    console.error(`WebSocket error: ${error}`);
    if (recognizeStream) {
      recognizeStream.end();
      recognizeStream = null;
    }
    handleApiResponse(accumulatedTranscript.trim());
  });
});

app.use(express.static("public"));

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "/index.html")));

app.post("/", (req, res) => {
  res.set("Content-Type", "text/xml");

  res.send(`
    <Response>
      <Start>
        <Stream url="wss://${req.headers.host}/"/>
      </Start>
      <Say>What is your health problem?</Say>
      <Pause length="60" />
    </Response>
  `);
});

console.log("Listening on Port 8080");
server.listen(8080);
