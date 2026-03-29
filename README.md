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

## ⚙️ Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Firebase account](https://console.firebase.google.com/)
- [Gemini API Key](https://aistudio.google.com/)

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd "SAATHI APP/nyaya-saathi"
   ```

2. **Install Frontend Dependencies**:
   ```bash
   npm install
   ```

3. **Install Server Dependencies**:
   ```bash
   cd server
   npm install
   cd ..
   ```

### Configuration

Create a `.env` file in the root directory and add your credentials:

```env
VITE_FIREBASE_API_KEY=your_apiKey
VITE_FIREBASE_AUTH_DOMAIN=your_authDomain
VITE_FIREBASE_PROJECT_ID=your_projectId
VITE_FIREBASE_STORAGE_BUCKET=your_storageBucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messagingSenderId
VITE_FIREBASE_APP_ID=your_appId
VITE_GEMINI_API_KEY=your_gemini_key
```

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

## 📂 Project Structure

- `src/`: Main React application files.
  - `App.jsx`: Core routing and voice logic.
  - `firebase.js`: Firebase initialization.
  - `locales.js`: Localization support.
  - `services/`: API and utility logic (Gemini, SMS).
- `server/`: Backend scripts for SMS notifications.
- `public/`: Static assets and media.

---

## 🌟 Mission
*To ensure that every unorganized worker in India has a voice and the tools to claim their rightful government benefits.*

---
Made with ❤️ by the Nyaya Saathi Team.
