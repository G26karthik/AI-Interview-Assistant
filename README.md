# AI Interview Assistant (Swipe Internship Assignment)

A full-stack-ready React + Vite application that fulfils the **Swipe Internship – AI-Powered Interview Assistant** brief. The app guides candidates through an AI-led, timed interview while giving interviewers a live dashboard to review progress, scoring, and transcripts.

> **Live Demo**: _Add your deployed Netlify/Vercel URL here_

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Core Features](#core-features)
- [Interview Experience](#interview-experience)
- [Interviewer Dashboard](#interviewer-dashboard)
- [Persistence & Resume Logic](#persistence--resume-logic)
- [Getting Started](#getting-started)
	- [Prerequisites](#prerequisites)
	- [Installation](#installation)
	- [Running Locally](#running-locally)
- [Configuration](#configuration)
	- [Environment Variables](#environment-variables)
	- [Why Use a Proxy?](#why-use-a-proxy)
- [Testing](#testing)
- [Building for Production](#building-for-production)
- [Deployment Notes](#deployment-notes)
	- [Vercel](#vercel)
	- [Netlify](#netlify)
- [Project Structure](#project-structure)
- [Known Limitations](#known-limitations)
- [Roadmap Ideas](#roadmap-ideas)

## Architecture Overview
- **Frontend**: React 18 + Vite + Ant Design
- **State**: Redux Toolkit with `redux-persist` (localStorage) for cross-tab persistence
- **AI Layer**: Groq API (Llama 3.1) with optional serverless proxy for secure key usage
- **Document Parsing**: `pdfjs-dist` for PDFs, `mammoth` for DOCX
- **Build/Test**: Vite build pipeline, Vitest + Testing Library

## Core Features
- 📄 **Resume ingestion**: Upload PDF/DOCX, extract Name, Email, Phone.
- � **Contact capture assist**: If a detail is missing, the chat politely asks for it—no separate form required.
- �🧠 **AI-driven interview**: 6-question plan (2 Easy @ 20 s, 2 Medium @ 60 s, 2 Hard @ 120 s). Questions are streamed from Groq.
- ⏱️ **Per-question timers**: Auto-submit on timeout, answers scored immediately by AI.
-  **Interviewer dashboard**: Score-ordered candidate list, search, transcript viewer, resume snippet, PDF export.
- 💾 **Persistence**: Timers, answers, scoring, and resume text survive reloads via `redux-persist`.
- 📡 **Offline scoring queue**: Retries pending AI scoring jobs when connectivity returns.

## Interview Experience
1. Candidate uploads a resume.
2. App auto-populates Name/Email/Phone directly in the chat, prompting for any missing fields before starting.
3. The AI streams a question per difficulty tier. Timer begins as soon as the question is fully displayed.
4. Answer submission is manual or automatic when time expires (blank answers are allowed).
5. After six questions, Groq produces a weighted score and concise interview summary.

## Interviewer Dashboard
- Default sorting by score (highest first); supports Ant Design column sorting and name/email search.
- Detail modal reveals:
	- Contact info (name/email/phone)
	- AI-generated summary
	- Resume preview (first 400 chars)
	- Full question & answer transcript with per-question scores
- PDF export (`jsPDF`) for offline review or sharing.

## Persistence & Resume Logic
- `redux-persist` stores entire `candidates` slice in localStorage.
- Session timers track `remaining`, `startedAt`, and `needsWelcome` so reloading rehydrates the countdown accurately.
- `beforeunload` hook pauses active interviews and flags them for the Welcome Back modal on the next visit.
- Contact info prompts are persisted in the chat log, preserving context if the tab reloads mid-intake.

## Getting Started

### Prerequisites
- Node.js **18+** (enable native fetch and Vite compatibility)
- npm **9+** (ships with recent Node versions)

### Installation
```bash
npm install
```

### Running Locally
```bash
npm run dev
```
- Opens the dev server at http://localhost:5173
- Ensure an AI key is configured (see [Configuration](#configuration)) or the UI will block interviews with an “AI unavailable” banner.

## Configuration

### Environment Variables
Create a `.env` file in the project root with **one** of the following setups:

```
# Option A: Direct browser key (development only)
VITE_GROQ_API_KEY=your_groq_key

# Option B: Secure proxy (recommended for production)
VITE_USE_PROXY=true
```

If neither variable is set, the chat tab displays an error banner and interviewing is disabled.

### Why Use a Proxy?
- Shipping the Groq key to the browser is convenient for local testing but unsafe for public deployments.
- Use the included serverless functions to keep the key server-side:
	- `api/groq-proxy.js` (Vercel)
	- `netlify/functions/groq-proxy.js` (Netlify)

Set the platform’s `GROQ_API_KEY` environment variable and point the frontend to the proxy by enabling `VITE_USE_PROXY=true`.

## Testing
```bash
npm test
```
- Runs Vitest suites for the Redux slice and timer hook.
- Uses jsdom environment to simulate browser APIs.

## Building for Production
```bash
npm run build
```
- Outputs optimized assets to `dist/`.
- The pdf.js worker is ~2 MB, so Vite will warn about large chunks—this is expected because the worker must ship in full.

## Deployment Notes

### Vercel
1. Push the repo to GitHub.
2. Create a Vercel project and import the repo.
3. Set environment variables:
	 - `VITE_USE_PROXY=true`
	 - `GROQ_API_KEY=<your key>` (used by `api/groq-proxy.js`)
4. Deploy. Vercel auto-builds using `npm run build` and serves the Vite output plus `/api/groq-proxy`.

### Netlify
1. Push repo and connect it in Netlify.
2. Configure build settings:
	 - Build command: `npm run build`
	 - Publish directory: `dist`
3. Add environment variables:
	 - `VITE_USE_PROXY=true`
	 - `GROQ_API_KEY=<your key>`
4. Netlify detects the `netlify/functions` directory and deploys `groq-proxy` at `/.netlify/functions/groq-proxy`.
5. Confirm your frontend is pointing to that path (default setup already does).

## Project Structure
```
├── api/                     # Vercel serverless proxy
├── netlify/functions/       # Netlify serverless proxy
├── src/
│   ├── api/groq.js          # Groq client wrappers + streaming helpers
│   ├── components/          # UI components (chat, dashboard, resume uploader)
│   ├── features/            # Redux slices (candidates + session state)
│   ├── hooks/useTimer.js    # Persistent timer hook
│   ├── store.js             # Redux store + persistence wiring
│   ├── utils/resumeParser.js# PDF/DOCX parsing + field extraction
│   └── tests/               # Vitest suites
├── package.json
├── vite.config.js / vitest.config.js
└── README.md
```

## Known Limitations
- A valid Groq API key (or working proxy) is required—without it the interview tab is locked.
- AI responses depend on Groq availability and latency; failures fall back to friendly error messages or neutral scores.
- Large resumes are truncated (first 2,500 chars) to keep prompts within model limits.

## Roadmap Ideas
- Background worker to automatically retry pending scoring operations.
- Rich analytics for interviewer dashboard (topic heatmaps, trend lines).
- Audio-assisted interviews (text-to-speech for questions, speech-to-text for answers).
- Role-based authentication to separate interviewer/candidate views.

---

This project is released under the MIT License. Contributions and forks are welcome—feel free to open an issue or PR!*** End Patch
