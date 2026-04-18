# ⛓ Kredz — Deployment Guide

## Project Structure

```
kredz-deploy/
├── kredz-final/          # FastAPI backend
│   ├── main.py           # All API routes
│   ├── database.py       # Supabase helpers
│   ├── ai_verifier.py    # Anthropic AI verification
│   ├── hasher.py         # SHA-256 bundle hashing
│   ├── schemas.py        # Pydantic response models
│   ├── requirements.txt
│   ├── .env.example      # Copy → .env and fill in secrets
│   └── Dockerfile
├── frontend-final/       # React + Vite + Tailwind frontend
│   ├── src/
│   │   ├── contexts/AuthContext.tsx   # Auth → backend API
│   │   ├── pages/StudentDashboard.tsx # Credentials from backend
│   │   ├── components/SubmitCredentialDialog.tsx  # POSTs to backend
│   │   └── ...
│   ├── .env              # VITE_API_URL for local dev
│   ├── .env.example
│   ├── Dockerfile        # Multi-stage: build → nginx
│   └── nginx.conf        # SPA routing
├── docker-compose.yml    # Run both services together
├── render.yaml           # One-click Render.com deploy
└── .env                  # VITE_API_URL for docker-compose
```

---

## Option A — Local Development (recommended for dev)

### 1. Backend

```bash
cd kredz-final
cp .env.example .env          # fill in your secrets
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend available at **http://localhost:8000**  
API docs at **http://localhost:8000/docs**

### 2. Frontend

```bash
cd frontend-final
cp .env.example .env          # VITE_API_URL=http://localhost:8000
npm install --legacy-peer-deps
npm run dev
```

Frontend available at **http://localhost:8080**

---

## Option B — Docker Compose (full stack, one command)

```bash
# 1. Fill in backend secrets
cp kredz-final/.env.example kredz-final/.env
# edit kredz-final/.env

# 2. Set the public backend URL baked into the frontend build
# (for local docker: leave as http://localhost:8000)
cp .env.example .env 2>/dev/null || true

# 3. Build and start
docker-compose up --build

# Frontend → http://localhost:80
# Backend  → http://localhost:8000
```

---

## Option C — Render.com (cloud, free tier)

### Step 1 — Backend

1. Create a new **Web Service** on Render, point it at `kredz-final/`
2. Runtime: **Python 3**
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables (from `.env.example`)

### Step 2 — Frontend

1. Create a new **Static Site** on Render, point it at `frontend-final/`
2. Build command: `npm ci --legacy-peer-deps && npm run build`
3. Publish directory: `dist`
4. Add rewrite rule: `/* → /index.html` (handles SPA routing)
5. Add env var: `VITE_API_URL=https://your-backend.onrender.com`

### Step 3 — Link them

Back in your **backend** service, set:
- `NGROK_URL` = your backend Render URL (e.g. `https://kredz-backend.onrender.com`)
- `APP_FRONT_URL` = your frontend Render URL (e.g. `https://kredz-frontend.onrender.com`)
- `ALLOWED_ORIGINS` = your frontend URL (same as `APP_FRONT_URL`)

Or use the **render.yaml** blueprint for one-click deploy.

---

## Option D — Railway / Fly.io / VPS

Same principle as Render:
- Backend: Python web service, env vars from `.env.example`
- Frontend: Static site, `VITE_API_URL` pointing to backend

---

## Required Environment Variables

### Backend (`kredz-final/.env`)

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_KEY` | Supabase anon key |
| `ANTHROPIC_API_KEY` | For AI credential verification |
| `NGROK_URL` | Public URL of this backend (for QR codes) |
| `APP_FRONT_URL` | Public URL of the frontend (for mentor deep-links) |
| `ALLOWED_ORIGINS` | Comma-separated frontend origins for CORS |
| `SECRET_KEY` | Any random string |
| `SMTP_USER` | Gmail address for sending mentor emails |
| `SMTP_PASSWORD` | Gmail App Password (not your real password) |

### Frontend (`frontend-final/.env`)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend base URL, no trailing slash |

---

## Gmail App Password Setup

1. Enable 2FA on your Google account
2. Go to **Google Account → Security → App Passwords**
3. Generate a password for "Mail"
4. Use that as `SMTP_PASSWORD` (not your real Gmail password)

---

## How Authentication Works

- **Students & Mentors** register/login through the React frontend → FastAPI → Supabase
- Sessions are stored in `sessionStorage` (cleared on tab close, not persisted across browser sessions — safe by default)
- No passwords are ever stored in the frontend after login

## How Credentials Work

1. Student fills the "Add credential" form → `POST /api/submit` (multipart)
2. Backend generates a SHA-256 bundle hash, saves to Supabase, generates a QR code, emails the mentor
3. Mentor clicks the deep-link in the email → lands on `/mentor-verify?token=…` → logs in → sees the credential → approves or rejects
4. Student's dashboard refreshes from `GET /api/dashboard/{student_id}`
