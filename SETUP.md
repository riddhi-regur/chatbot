# ClinicBot - Complete Setup & Run Guide

## Project Summary

ClinicBot is a **knowledge-based AI chatbot** designed for doctor/clinic websites. It uses **RAG (Retrieval-Augmented Generation)** to intelligently answer patient queries about services, treatments, and doctors, then books appointments through a multi-step conversation flow.

### Key Features

| Feature | Description |
|---------|-------------|
| **RAG-Powered Chatbot** | Uses pgvector for vector search + Ollama for local LLM response generation |
| **Intent Detection** | NLU service detects 9 intent types (booking, inquiry, cancellation, etc.) |
| **Multi-Step Booking** | Guides patient through name → service → date → time → confirmation |
| **Embeddable Widget** | Floating chat bubble that can be added to any website with one script tag |
| **Admin Panel** | Full React dashboard for managing appointments, services, doctors, and knowledge base |
| **Appointment Status** | Booked → Confirmed → Completed workflow |
| **Knowledge Base** | 15 pre-seeded articles covering services, treatments, policies, and clinic info |
| **Local & Free** | Entirely self-hosted using PostgreSQL + Ollama (no API keys needed) |

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React.js + Tailwind CSS | Admin panel UI |
| Backend | Node.js + Express.js | REST API server |
| Database | PostgreSQL 16 + pgvector | App data + vector embeddings |
| LLM Engine | Ollama (nomic-embed-text + llama3.2) | Embeddings + response generation |
| Auth | JWT (JSON Web Tokens) | Admin authentication |
| ORM | Prisma | Database access layer |
| Widget | Vanilla JavaScript | Embeddable chat component |

---

## Prerequisites

Before running the project, install these tools:

### 1. Docker Desktop
- **Download:** https://docs.docker.com/get-docker/
- **Why:** Runs PostgreSQL with pgvector extension
- **Verify:** Open terminal and run `docker --version`

### 2. Node.js (version 18 or higher)
- **Download:** https://nodejs.org/
- **Why:** Runs the backend API and frontend dev server
- **Verify:** `node --version` (should show v18+)
- **Verify:** `npm --version`

### 3. Ollama (for AI/RAG features)
- **Download:** https://ollama.ai/
- **Why:** Runs the local LLM for chat responses and embeddings
- **Verify:** `ollama --version`

---

## Step-by-Step Setup

### Step 1: Start PostgreSQL Database

Open a terminal in the project root folder and run:

```bash
docker compose up -d
```

This will:
- Download the `pgvector/pgvector:pg16` Docker image (first time only, ~300MB)
- Start PostgreSQL on port **5432**
- Enable the **pgvector** extension for vector similarity search
- Create database `clinic_chatbot` with user `chatbot` / password `chatbot123`

**Verify it's running:**
```bash
docker ps
```
You should see a container named `chatbot-db` with status "Up".

**To stop later:**
```bash
docker compose down
```

---

### Step 2: Start Ollama + Download AI Models

Open a **separate terminal** and run:

```bash
ollama serve
```

Then open **another terminal** and pull the required models:

```bash
# Embedding model (for vector search / RAG)
ollama pull nomic-embed-text

# Chat model (for generating responses)
ollama pull llama3.2
```

**Note:** The first download takes 5-15 minutes depending on your internet speed.
- `nomic-embed-text` (~274MB) - Converts text to vector embeddings
- `llama3.2` (~2GB) - Generates natural language responses

**Verify models are downloaded:**
```bash
ollama list
```

**Keep `ollama serve` running in its terminal throughout.**

---

### Step 3: Setup Backend

Open a **new terminal** and navigate to the backend folder:

```bash
cd backend
```

**Install dependencies:**
```bash
npm install
```

**Generate Prisma client:**
```bash
npx prisma generate
```

**Push database schema to PostgreSQL:**
```bash
npx prisma db push
```

**Seed the database with sample data:**
```bash
npx prisma db seed
```

This creates:
- 1 admin user (admin@clinic.com / admin123)
- 3 doctors with specializations
- 12 clinic services
- 15 knowledge base articles for RAG
- 4 sample appointments

**Start the backend server:**
```bash
npm run dev
```

**Verify:** You should see:
```
Database connected & pgvector extension enabled
pgvector tables initialized
Server running on http://localhost:4000
```

**Keep this terminal running.**

---

### Step 4: Setup Admin Panel (Frontend)

Open a **new terminal** and navigate to the frontend folder:

```bash
cd frontend
```

**Install dependencies:**
```bash
npm install
```

**Start the dev server:**
```bash
npm run dev
```

**Verify:** You should see:
```
VITE v6.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

**Keep this terminal running.**

---

### Step 5: Access the Application

Open your browser and go to:

| URL | What |
|-----|------|
| http://localhost:5173 | **Admin Panel** - Login with admin@clinic.com / admin123 |
| http://localhost:4000/api/health | **API Health Check** - Should return `{"status":"ok"}` |
| `widget/index.html` (open file) | **Chat Widget Demo** - Test the chatbot |

---

### Step 6: Test the Chatbot

**Option A - Widget Demo Page:**
1. Open `widget/index.html` in your browser
2. Click the blue chat bubble in the bottom-right corner
3. Try these conversations:

```
User: "What services do you offer?"
Bot: [Lists all clinic services with descriptions and prices]

User: "I want to book an appointment"
Bot: "I'd be happy to help! What is your name?"
User: "John Smith"
Bot: "Which service would you like? Here are our services:..."
User: "Teeth Cleaning"
Bot: "What date would you like?"
User: "tomorrow"
Bot: "What time works for you? Available slots: 9:00, 9:30, ..."
User: "10:00"
Bot: [Shows booking summary, asks for confirmation]
User: "confirm"
Bot: "Your appointment has been booked! Booking #5..."
```

**Option B - API Directly:**
```bash
curl -X POST http://localhost:4000/api/chat/send \
  -H "Content-Type: application/json" \
  -d '{"message": "What services do you offer?"}'
```

---

## Admin Panel Features

### Login
- URL: http://localhost:5173/login
- Email: `admin@clinic.com`
- Password: `admin123`

### Dashboard
- Total appointments count
- Today's appointments
- Active doctors & services
- Knowledge base articles count
- Chat sessions count
- Ollama connection status

### Appointments Management
- View all appointments in a table
- Filter by status (Booked, Confirmed, Completed)
- Change status: Booked → Confirmed → Completed
- See patient info, doctor, service, date, time

### Services Management
- View all services with descriptions, prices, duration
- Add new services with doctor assignment
- Delete services

### Doctors Management
- View doctor cards with specializations
- Add new doctors with available days and hours
- Set working hours (start/end time)
- Delete doctors

### Knowledge Base
- View all knowledge articles
- Filter by category (general, service, treatment, faq, policy)
- Add new articles (auto-indexed for RAG)
- Edit existing articles
- Delete articles

---

## Embedding the Widget on a Website

Add these two lines before the closing `</body>` tag of any website:

```html
<!-- ClinicBot Chat Widget -->
<script>
  window.ClinicBotConfig = {
    apiUrl: 'http://YOUR-SERVER-IP:4000/api',
    title: 'Clinic Assistant',
    subtitle: 'We are here to help!',
    greeting: 'Hello! How can I help you today?',
  };
</script>
<script src="http://YOUR-SERVER-IP:4000/widget/chatbot.js"></script>
```

Replace `YOUR-SERVER-IP` with your actual server address.

---

## API Reference

### Public Endpoints (No Auth Required)

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| POST | `/api/chat/send` | Send chat message | `{message, visitorId?}` |
| POST | `/api/chat/close` | End chat session | `{visitorId}` |
| GET | `/api/services` | List all services | - |
| GET | `/api/doctors` | List all doctors | - |
| POST | `/api/appointments` | Book appointment | `{patientName, patientEmail?, patientPhone?, doctorId, serviceId, date, time}` |
| GET | `/api/appointments/availability` | Check slots | `?doctorId=1&date=2025-01-20` |
| GET | `/api/health` | Health check | - |

### Authenticated Endpoints (Bearer Token Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login (returns JWT) |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/admin/dashboard` | Dashboard statistics |
| GET | `/api/appointments` | List appointments (filter: `?status=booked`) |
| PATCH | `/api/appointments/:id/status` | Update status `{status: "confirmed"}` |
| GET/POST/PUT/DELETE | `/api/services/:id?` | CRUD services |
| GET/POST/PUT/DELETE | `/api/doctors/:id?` | CRUD doctors |
| GET/POST/PUT/DELETE | `/api/knowledge/:id?` | CRUD knowledge base |

---

## Project File Structure

```
Chatbot/
├── PLAN.md                          # Implementation plan document
├── README.md                        # Quick overview
├── SETUP.md                         # This file (detailed setup guide)
├── docker-compose.yml               # PostgreSQL + pgvector containers
├── .gitignore
│
├── backend/                         # Node.js + Express API
│   ├── .env                         # Environment variables
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma            # Database schema (7 tables)
│   │   └── seed.ts                  # Sample data seeder
│   └── src/
│       ├── index.js                 # Server entry point
│       ├── config/
│       │   ├── database.js          # Prisma + DB init
│       │   ├── ollama.js            # Ollama LLM client
│       │   └── pgvector.js          # Vector search operations
│       ├── middleware/
│       │   ├── auth.js              # JWT auth middleware
│       │   └── errorHandler.js      # Error handling
│       ├── controllers/             # Request handlers (6 files)
│       ├── routes/                  # API routes (7 files)
│       └── services/                # Business logic (5 files)
│           ├── chat.service.js      # Main chat orchestrator
│           ├── nlu.service.js       # Intent detection + entity extraction
│           ├── rag.service.js       # Vector search + knowledge retrieval
│           ├── appointment.service.js # Booking logic + slot management
│           └── embedding.service.js # Ollama embedding generation
│
├── frontend/                        # React Admin Panel
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── App.jsx                  # Router setup
│       ├── api/axios.js             # API client with JWT
│       ├── context/AuthContext.jsx   # Auth state management
│       ├── components/              # Reusable UI components
│       └── pages/                   # Admin pages (7 files)
│           ├── Login.jsx
│           ├── Dashboard.jsx
│           ├── Appointments.jsx     # Status: booked/confirmed/completed
│           ├── Services.jsx
│           ├── Doctors.jsx
│           ├── KnowledgeBase.jsx
│           └── ChatLogs.jsx
│
└── widget/                          # Embeddable Chat Widget
    ├── index.html                   # Demo page
    ├── chatbot.js                   # Widget logic + API calls
    └── chatbot.css                  # Floating bubble + chat window styles
```

---

## How the RAG Chatbot Works

```
User types message
        │
        ▼
┌──────────────────────┐
│   1. NLU Service     │  Detects intent (book, inquire, cancel...)
│   nlu.service.js     │  Extracts entities (name, date, time...)
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   2. RAG Service     │  Converts query → embedding (Ollama)
│   rag.service.js     │  Searches pgvector for similar knowledge
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   3. Chat Service    │  Builds context from knowledge + history
│   chat.service.js    │  Routes to appropriate handler
└──────────┬───────────┘
           │
     ┌─────┼──────┐
     ▼     ▼      ▼
  Booking  KB    General
  Handler  Query  Chat
     │     │      │
     ▼     ▼      ▼
┌──────────────────────┐
│   4. Response Gen    │  Generates response via Ollama LLM
│                      │  (or uses retrieved KB text directly)
└──────────┬───────────┘
           │
           ▼
    Response to User
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `docker: command not found` | Install Docker Desktop from https://docker.com/get-docker |
| `psql: command not found` | This is fine - we use Docker for PostgreSQL |
| `Cannot connect to PostgreSQL` | Run `docker compose up -d` and wait 10 seconds |
| `Ollama not available` | Make sure `ollama serve` is running in a terminal |
| `nomic-embed-text not found` | Run `ollama pull nomic-embed-text` |
| `llama3.2 not found` | Run `ollama pull llama3.2` |
| `Prisma error after schema change` | Run `npx prisma db push` again |
| `Chat returns generic response` | Ollama may not be running - check `ollama serve` |
| `Widget doesn't load` | Check `apiUrl` in ClinicBotConfig matches your backend URL |
| Port 5432 already in use | Stop other PostgreSQL: `docker stop chatbot-db` |
| Port 4000 already in use | Change PORT in `backend/.env` |

---

## Stopping the Application

```bash
# Stop frontend (Ctrl+C in its terminal)
# Stop backend (Ctrl+C in its terminal)
# Stop Ollama (Ctrl+C in its terminal)

# Stop PostgreSQL database
docker compose down

# To also delete database data
docker compose down -v
```

---

## Rebuilding After Changes

```bash
# If you change prisma/schema.prisma:
cd backend
npx prisma generate
npx prisma db push

# If you change frontend code:
cd frontend
npm run build    # For production build

# If you add new knowledge base items via admin panel:
# They are auto-indexed for RAG - no restart needed
```
