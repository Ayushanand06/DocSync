# DocSync

An AI-powered medical consultation platform that combines a clinical dashboard, Whisper voice transcription, Twilio call capture, and Groq-powered medical analysis.

## 🎯 Overview

This project implements a medical consultation system that:
- Provides a complete browser consultation dashboard
- Records browser microphone audio and transcribes it with Whisper
- Handles incoming Twilio voice calls for medical queries
- Processes queries through AI-powered medical experts using Groq LLM
- Provides real-time medical advice with medication recommendations
- Supports both REST API endpoints and voice call handling
- Maintains conversation history for context-aware responses

## 🏗️ Architecture

<img width="8192" height="3541" alt="image" src="https://github.com/user-attachments/assets/c9a0872c-8931-4e20-bc9a-587a417e1509" />


## ✨ Features

- Consultation dashboard UI
- Whisper voice-to-text transcription
- Voice call integration with Twilio
- AI-Powered Medical Analysis using Groq LLM
- Multi-Agent System with CrewAI
- RESTful APIs for easy integration
- Browser microphone recording
- Medication Recommendations
- Environment-based Credential Management

## 📋 Prerequisites

- Node.js v14+
- Python 3.8+
- Twilio Account (https://www.twilio.com/console)
- Groq API Key (https://console.groq.com/keys)

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install express body-parser twilio groq-sdk dotenv
pip install langchain_groq crewai python-dotenv fastapi uvicorn
```

### 2. Setup Environment Variables
Create `.env` file:
```env
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=your_twilio_number
TWILIO_TO_NUMBER=patient_number
TWILIO_VOICE_URL=https://your-ngrok-domain.ngrok-free.app/twilio/voice
GROQ_API_KEY=your_groq_key
GROQ_API_KEY_JS=your_groq_key
MEDICAL_API_URL=http://127.0.0.1:8000/process-query
WHISPER_MODEL=whisper-large-v3
```

### 3. Run Servers

**Express Server:**
```bash
npm start
```

**FastAPI Servers:**
```bash
uvicorn app25:app --reload
```

**Make Twilio Call:**
```bash
node call.js
```

## 🔌 API Endpoints

**GET /** - Consultation dashboard UI  
**GET /api/health** - UI/API bridge health  
**POST /api/query** - Direct medical query endpoint  
**POST /api/transcribe-audio** - Browser audio transcription with Whisper  
**POST /twilio/voice** - Twilio voice webhook  
**POST /process-query** - Medical analysis (FastAPI)

## 🔐 Security

- All credentials stored in `.env`
- `.env` added to `.gitignore` - never committed
- No hardcoded secrets in source code
- Environment variables loaded at runtime

## 🛠️ Technologies

**Node.js:** Express, Twilio SDK, Groq SDK, dotenv, ws  
**Python:** FastAPI, Uvicorn, CrewAI, LangChain, python-dotenv  
**External:** Twilio, Groq LLM, Whisper

---

