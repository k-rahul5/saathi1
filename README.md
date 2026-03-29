# Nyaya Saathi ⚖️
### *Empowering Unorganized Workers Through AI-Driven Voice Support*

**Nyaya Saathi** is a voice-first web application designed to bridge the gap between unorganized workers and legal/governmental resources. By providing a multi-lingual, speech-enabled platform, it simplifies grievance redressal and access to government schemes for those who may have limited literacy or technical skills.

---

## 🚀 Key Features

- **🎙️ Voice-First Interface**: A hands-free experience where workers can file complaints or ask legal questions simply by speaking.
- **🗣️ Multi-lingual Transcription**: Real-time speech-to-text supporting both **English** and **Telugu**, ensuring accessibility for a wider demographic.
- **🤖 AI Grievance Assistant**: Powered by **Google Gemini**, the system automatically analyzes voice inputs to provide instant legal guidance and structured complaint summaries.
- **📋 Admin Dashboard**: A centralized portal for administrators to manage worker grievances, update their status, and publish new government schemes.
- **🏛️ Unified Welfare Portal**: Direct access to the latest government schemes (like E-Shram, PM-SYM) with automated eligibility checks.
- **💬 SMS Notifications**: Automated status updates for filed complaints, keeping workers informed without needing constant internet access.

---

## 🛠️ Tech Stack

- **Frontend**: 
  - [React 19](https://reactjs.org/) (Vite-powered)
  - [Vanilla CSS](https://developer.mozilla.org/en-US/docs/Web/CSS) (Modular design with glassmorphism)
- **Backend & Storage**: 
  - [Firebase](https://firebase.google.com/) (Firestore for DB, Authentication, and Storage for audio files)
  - [Node.js](https://nodejs.org/) (Express server for SMS integration)
- **AI & ML**: 
  - [Google Generative AI (Gemini 1.5)](https://ai.google.dev/) (Complaint analysis & transcription refinement)
- **Communication**:
  - Web Speech API (Native browser Speech-to-Text)
  - Twilio/SMS Logic for real-time mobile updates

---




### Running the Project

1. **Start the Frontend**:
   ```bash
   npm run dev
   ```

2. **Start the SMS Server**:
   ```bash
   node server/sms-server.js
   ```

---


## 🌟 Mission
*To ensure that every unorganized worker in India has a voice and the tools to claim their rightful government benefits.*

---
Made with ❤️ by the Nyaya Saathi Team.
