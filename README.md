# Medical Query Analysis System

A comprehensive AI-powered medical consultation platform that combines voice call capabilities with intelligent medical analysis using Groq LLM.

## 🎯 Overview

This project implements a medical consultation system that:
- Handles incoming Twilio voice calls for medical queries
- Processes queries through AI-powered medical experts using Groq LLM
- Provides real-time medical advice with medication recommendations
- Supports both REST API endpoints and voice call handling
- Maintains conversation history for context-aware responses

## 🏗️ Architecture



## ✨ Features

- Voice Call Integration with Twilio
- AI-Powered Medical Analysis using Groq LLM
- Multi-Agent System with CrewAI
- RESTful APIs for easy integration
- Real-time Processing
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
GROQ_API_KEY=your_groq_key
GROQ_API_KEY_JS=your_groq_key
```

### 3. Run Servers

**Express Server:**
```bash
node index1.js
```

**FastAPI Servers:**
```bash
python app15.py
# or
uvicorn app25:app --reload
```

**Make Twilio Call:**
```bash
node call.js
```

## 🔌 API Endpoints

**POST /transcribe** - Handle Twilio voice calls  
**POST /query** - Direct medical query endpoint  
**POST /medical-analysis** - Medical analysis (FastAPI)

## 🔐 Security

- All credentials stored in `.env`
- `.env` added to `.gitignore` - never committed
- No hardcoded secrets in source code
- Environment variables loaded at runtime

## 🛠️ Technologies

**Node.js:** Express, Twilio SDK, Groq SDK, dotenv  
**Python:** FastAPI, Uvicorn, CrewAI, LangChain, python-dotenv  
**External:** Twilio, Groq LLM (Llama 3 8B)

---

**Last Updated:** February 1, 2026 | **Version:** 1.0
