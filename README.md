<div align="center">

# AI Interview Assistant

An AI‑powered, timed technical interview conducted in the browser. Candidates upload a resume, answer 6 adaptive difficulty questions with visible timers, and receive an internally stored AI score + summary. Interviewers get a live dashboard with sortable results, transcripts, and export.

<strong>Non‑technical summary:</strong> This app lets a recruiter send one link. A candidate drops in their resume, the system asks timed questions, scores the answers using AI, and the recruiter sees organized results—without installing anything.

<br/>

_Add Deployment URL here (Netlify / Vercel)_

</div>

---

## 1. What This Delivers (Spec / JD Alignment Checklist)
| Requirement (JD) | Delivered | Notes |
|------------------|-----------|-------|
| Upload resume (PDF/DOCX) | ✅ | Parsed client‑side (pdfjs + mammoth) |
| Auto extract name / email / phone | ✅ | Heuristic extraction + normalization |
| Prompt user for any missing contact fields | ✅ | Chat injects polite requests (no extra form) |
| Generate 6 AI questions (2 Easy, 2 Medium, 2 Hard) | ✅ | Difficulty plan fixed and enforced |
| Timed questions (20s / 60s / 120s) | ✅ | Per‑question countdown; auto submit on zero |
| AI scoring of each answer | ✅ | Structured JSON scoring per response |
| Weighted final score + summary | ✅ | Difficulty weights applied | 
| Persist state across refresh / accidental close | ✅ | redux‑persist + Welcome Back modal |
| Dashboard: list candidates, sorted | ✅ | Default sort by score, column sorting, search |
| View per‑question transcript & scores | ✅ | Modal detail view |
| Export or store results | ✅ | PDF export via jsPDF |
| Graceful handling of AI/API errors | ✅ | Fallback messages, retry queue for scoring |
| Clean UI (React + modern toolkit) | ✅ | Ant Design components |
| No exposed secret keys in production | ✅ | Optional serverless proxy for Groq |

---

## 2. Quick Start (Non‑Technical Friendly)
1. Install Node.js 18+ (from nodejs.org). That’s the only tool required.
2. Clone or download this repository.
3. Open a terminal in the project folder.
4. Run: `npm install` (installs dependencies).
5. Add one environment variable option (see below) to a `.env` file.
6. Run: `npm run dev` then open the printed URL (usually http://localhost:5173).
7. Upload a resume and start interviewing.

If you deploy to Netlify or Vercel, just set the environment variables there—no other backend setup required.

---

## 3. How the Interview Flow Works
1. Candidate uploads a resume (PDF/DOCX). Text gets truncated to a safe prompt size.
2. System auto-detects name/email/phone; any missing items are requested conversationally.
3. Difficulty plan loads (E,E,M,M,H,H). Each question is streamed token‑by‑token from the Groq Llama 3.1 model.
4. Timer starts when the full question has arrived (protects against truncated streaming).
5. Candidate types answer; submitting early stops the timer. On timeout, an empty answer is still scored for consistency.
6. Scoring prompt returns a JSON object (score + rationale). Stored immediately.
7. After 6 answers the final weighted score and a concise summary are generated.
8. Dashboard view updates automatically; interviewer can open details or export PDF.

---

## 4. Core Feature Highlights
| Feature | Implementation Details |
|---------|------------------------|
| Streaming questions | Fetch with ReadableStream; assembled safely, index reconciliation prevents partial overwrite |
| Per-question timers | Redux slice stores `startedAt` + remaining; rehydrates after reload |
| Persistence | Entire candidates slice persisted through `redux-persist` (localStorage) |
| Welcome Back recovery | `needsWelcome` flag set on unload → modal offers Resume / Discard |
| Resume parsing | `pdfjs-dist` + `mammoth`; heuristic regex for contact fields; normalization of phone/email |
| AI integration | Groq Llama 3.1; separate prompts for question generation, scoring, summary |
| Weighted scoring | Difficulty weight map; final composite score computed deterministically |
| Offline / transient error handling | Uns cored answers queued; retry when connectivity returns |
| Dashboard insights | Sort by score, search, modal transcript, pdf export |
| Testing | Vitest for reducers + timer logic |

---

## 5. Architecture Overview
```
React (UI) ─┬─ Ant Design components
            ├─ Redux Toolkit (state)
            │    └─ persisted via localStorage (redux-persist)
            ├─ Groq API wrapper (questions / scoring / summary)
            ├─ Resume Parser (pdfjs + mammoth → heuristics)
            └─ Timer Hook (recomputes remaining time on hydration)
```
Key Files:
- `src/features/candidatesSlice.js` – State machine: interview progression, timers, scoring, summary generation
- `src/components/InterviewChat.jsx` – Streaming Q&A, answer submission, timer binding
- `src/components/InterviewerDashboard.jsx` – Table + detail modal + PDF export
- `src/components/ResumeUploader.jsx` – File ingestion & parsing
- `src/components/WelcomeBackModal.jsx` – Resume / discard decision on reload
- `src/api/groq.js` – Encapsulates Groq fetch calls & prompt templates
- `src/utils/resumeParser.js` – Extraction & normalization heuristics

---

## 6. Data & State Model (Simplified)
```ts
Candidate = {
  id: string,
  name: string,
  email: string,
  phone: string,
  resumeText: string,
  questions: [ { id, difficulty, text, answer, score, rationale } ],
  currentQuestionIndex: number,
  timers: { remaining: number, startedAt: number | null },
  finalScore: number | null,
  summary: string | null,
  status: 'in-progress' | 'completed',
  needsWelcome: boolean
}
```
Timers recalculate remaining = previousRemaining - (now - startedAt) on rehydrate. If <= 0, answer auto-submitted.

---

## 7. Configuration & Environment
Create `.env` with one of:
```
# Dev only (exposes key to browser)
VITE_GROQ_API_KEY=your_key_here

# Production-friendly (use serverless proxy)
VITE_USE_PROXY=true
```
If `VITE_USE_PROXY=true`, deploy one of the included serverless functions and set `GROQ_API_KEY` in the platform dashboard. The frontend detects proxy mode automatically.

Why a proxy? Avoids leaking API keys; isolates prompt surface; lets you add auth or logging later.

---

## 8. Running, Testing, Building
Development:
```
npm install
npm run dev
```
Tests:
```
npm test
```
Production build:
```
npm run build
```
Output goes to `dist/`. Large pdf.js worker chunk warning is expected.

---

## 9. Deployment (Vercel / Netlify)
Vercel Quick Steps:
1. Import repo → set `VITE_USE_PROXY=true` & `GROQ_API_KEY`.
2. Deploy (auto build). Proxy served at `/api/groq-proxy`.

Netlify Quick Steps:
1. Connect repo → build command `npm run build`, publish `dist`.
2. Set `VITE_USE_PROXY=true` & `GROQ_API_KEY`.
3. Proxy runs at `/.netlify/functions/groq-proxy` (already referenced by client code).

---

## 10. Design Decisions & Trade‑offs
| Decision | Rationale | Alternative Considered |
|----------|-----------|------------------------|
| No manual Pause button | Less cognitive load; auto-resume path via modal | Explicit pause/resume controls |
| 6 fixed questions (E,E,M,M,H,H) | Predictable scoring distribution | Dynamic adaptive difficulty |
| LocalStorage persistence | Simplicity for assignment scope | Backend DB (adds infra) |
| Serverless proxy optional | Keeps prod secrets safe; still easy local dev | Always exposing key (security risk) |
| Streaming + index reconciliation | Prevents partial overwrites of questions | Wait for full text (adds latency) |
| Heuristic resume parsing | Fast, no dependency on external NLP | External enrichment API |

---

## 11. Extensibility Ideas
- Add authentication & role separation.
- Plug in speech-to-text for answers; TTS for questions.
- Replace heuristic parser with an embedding or NER service.
- Add analytics dashboard (topic coverage, average scores trend).
- Persist to a backend (Supabase / Firebase / Postgres) for multi-recruiter usage.
- Add proctoring signals (focus change, answer length anomalies).

---

## 12. Limitations
- Requires valid Groq API access; network failures degrade to queued retries.
- Large resumes truncated (~2,500 chars) to control prompt size.
- No authentication or multi-tenant security boundaries (assignment scope).

---

## 13. License
MIT — feel free to fork, extend, or adapt. PRs welcome.

---

## 14. At a Glance (One‑Screen Summary)
Resume in → AI asks 6 timed questions → Each answer scored → Final weighted score + summary → Recruiter views/export results.

---

<sub>Built with React, Vite, Redux Toolkit, Ant Design, Groq (Llama 3.1), pdfjs, mammoth, Vitest.</sub>
