# SPM Banking — AI Relationship Manager Platform

An AI-powered decision support platform for bank relationship managers (RMs): one workspace that shows every customer's holdings, flags who needs attention, and uses AI to explain decisions that transparent rules make.

## Features

- **Customer 360** — accounts, deposits, loans and limits, cards, insurance, investments, 90-day transactions and AI history for one customer, with relationship health and cash-flow analysis.
- **RM Action Center** — early-warning alerts (overdue EMIs, expired KYC, missed salary credit, high EMI burden, maxed-out cards) and next-best products with reasons, across the whole book.
- **Bank view** — deposits, loan book, CASA and credit-deposit ratios, product-line breakdowns.
- **AI modules**
  - **G1 Credit exposure brief** — rule-based risk score + AI-written brief.
  - **G2 Counselling prep** — RAG over the bank's policy library for 15 products.
  - **G3 Document intelligence** — PDF/DOCX parsing and Tesseract OCR, extraction checked against the customer record.
  - **G4 Limit increase** — deterministic ASK / ASK WITH CONDITIONS / HOLD OFF (with KYC and dormancy gates), explained by AI.
- **Explainable by design** — decisions come from rules; every AI result is labelled "AI-generated" or "Fallback · not AI".
- **Secure** — JWT sessions, bcrypt-hashed passwords, login lockout, input validation, CORS restricted to the frontend.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite, React Router, Recharts, Axios |
| Backend | Node.js, Express 5, Mongoose |
| Database | MongoDB Atlas |
| AI | Groq (primary), Google Gemini (fallback), RAG over a policy collection |
| Documents | Tesseract.js, pdf-parse, mammoth |
| Security | jsonwebtoken, bcryptjs |
| Tests | Node.js built-in test runner |

## Getting started

Requirements: Node.js 20+ and a MongoDB Atlas (or local MongoDB) database.

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env        # then fill in MONGO_URI, JWT_SECRET and at least one Gemini key
npm run seed                # first run only: loads customers, loans, products and policies
npm start                   # http://localhost:3001

# 2. Frontend (new terminal)
cd frontend
npm install
cp .env.example .env
npm run dev                 # http://localhost:5173
```

On first start the backend creates a login from `DEFAULT_ADMIN_USER_ID` and `DEFAULT_ADMIN_PASSWORD` in `backend/.env` if that user doesn't exist yet.

## Deploying (Render)

`render.yaml` deploys both parts from this repo: the API (`spm-banking-api`, Node web service) and the web app (`spm-banking-web`, static site).

1. In MongoDB Atlas → **Network Access**, allow `0.0.0.0/0` (Render's free tier has no fixed IP).
2. In Render: **New → Blueprint**, pick this repository, and enter the secret values it asks for (`MONGO_URI`, `DEFAULT_ADMIN_USER_ID`, `DEFAULT_ADMIN_PASSWORD`, Gemini / Groq keys). `JWT_SECRET` is generated automatically.
3. If Render gives either service a different address than `https://spm-banking-api.onrender.com` / `https://spm-banking-web.onrender.com`, update `FRONTEND_URL` (API) and `VITE_API_BASE_URL` (web app) to match and redeploy.

Free Render services sleep after 15 minutes idle; the first request after that takes about a minute.

> `npm run seed` erases saved analyses. On a database that already has data, use `npm run seed:products` and `npm run seed:policies` instead.

## Scripts (backend)

| Command | What it does |
| --- | --- |
| `npm start` | Start the API |
| `npm test` | Run the unit tests |
| `npm run seed` | Full reseed from `dataset/` plus generated products and policies |
| `npm run seed:products` | Regenerate accounts, deposits, cards, insurance, investments and transactions |
| `npm run seed:policies` | Load `backend/knowledge/*.txt` into the policy collection |

## Project structure

```text
backend/    Express API: routes, models, services (engines, AI, RAG, OCR), scripts, knowledge base
frontend/   React app: Customer 360, Action Center, bank view, G1–G4, history
dataset/    Source CSV data (customers, loans, limits and collateral)
```

## Note on data

Customers, loans, limits and collateral come from the project dataset. Accounts, deposits, cards, insurance, investments and transactions are generated synthetic demo data — not real customer information.
