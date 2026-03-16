# ChalkAI 🎓
### Speak any topic. Watch knowledge come alive.

An AI-powered educational explainer that generates real-time, interleaved mixed-media learning experiences — streaming narration, AI-generated SVG diagrams, audio narration, and interactive quizzes — all from a single voice or text prompt.

## 🏆 Built for Gemini Live Agent Challenge
**Category:** Creative Storyteller — Multimodal Storytelling with Interleaved Output

## ✨ Features
- 🎤 **Voice Input** — Speak your topic using Web Speech API
- ✍️ **Live Streaming** — Explanation streams word-by-word via Gemini 2.5 Flash
- 🎨 **AI Diagrams** — Gemini generates SVG educational diagrams inline between paragraphs
- 🔊 **Audio Narration** — Text-to-speech reads the explanation aloud as it streams
- 🧠 **Smart Quiz** — Auto-generated multiple choice quiz to test understanding

## 🛠️ Tech Stack
- **Frontend:** React + Vite, hosted on Netlify
- **Backend:** Python FastAPI, hosted on Google Cloud Run
- **AI:** Google Gemini 2.5 Flash (Google GenAI SDK)
- **Voice:** Web Speech API (browser-native, free)

## 🚀 Live Demo
- **Frontend:** https://chalkai-app.netlify.app
- **Backend:** https://chalkai-backend-595425747104.us-central1.run.app

## ☁️ Google Cloud Deployment
Backend is deployed on Google Cloud Run:
- Project: chalkai-app-2026
- Region: us-central1
- Service: chalkai-backend
- Health check: https://chalkai-backend-595425747104.us-central1.run.app/health

## 📦 How to Run Locally

### Backend
```bash
cd backend
pip install -r requirements.txt
# Add your GEMINI_API_KEY to .env
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## 🔑 Environment Variables
Create `backend/.env`:
GEMINI_API_KEY=your_gemini_api_key_here

## 📐 Architecture
See `architecture-diagram.svg` for the full system architecture.

## 🎯 How It Works
1. User speaks or types any educational topic
2. FastAPI sends prompt to Gemini 2.5 Flash
3. Explanation streams back word-by-word
4. Web Speech API reads it aloud simultaneously
5. Gemini generates 3 SVG diagrams that appear inline between paragraphs
6. A 3-question quiz is generated to test understanding

## 👨‍💻 Built With
- Google GenAI SDK
- Google Cloud Run
- FastAPI + Python
- React + Vite
