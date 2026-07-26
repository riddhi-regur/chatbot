# ClinicBot - Knowledge-Based Clinic Chatbot

A self-hosted, RAG-powered chatbot for doctor/clinic websites. Answers patient queries about services, treatments, and doctors, then books appointments. Includes an admin panel with appointment status management.

> **Detailed setup instructions:** See [SETUP.md](SETUP.md) for full step-by-step guide, troubleshooting, and API reference.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend (Admin) | React.js + Tailwind CSS |
| Backend | Node.js + Express.js |
| Database | PostgreSQL + pgvector |
| RAG Engine | pgvector (embeddings) + Ollama (LLM) |
| Auth | JWT |
| Chat Widget | Embeddable vanilla JS |

## Prerequisites

1. **Docker Desktop** - https://docs.docker.com/get-docker/
2. **Node.js 18+** - https://nodejs.org/
3. **Ollama** - https://ollama.ai/ (for local LLM)

## Quick Start

### 1. Start PostgreSQL + pgvector (Docker)

```bash
docker compose up -d
```

This starts PostgreSQL with pgvector extension on port 5432.

### 2. Start Ollama + Pull Models

```bash
ollama serve
ollama pull nomic-embed-text
ollama pull llama3.2
```

### 3. Setup Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npx prisma db seed
npm run dev
```

Backend runs on http://localhost:4000

### 4. Setup Admin Panel

```bash
cd frontend
npm install
npm run dev
```

Admin panel runs on http://localhost:5173

### 5. View Chatbot Widget Demo

Open `widget/index.html` in your browser to test the chatbot widget.

## Default Login

- **Email:** admin@clinic.com
- **Password:** admin123

## Embedding the Widget

Add this to any website:

```html
<script>
  window.ClinicBotConfig = {
    apiUrl: 'http://your-server:4000/api',
    title: 'Clinic Assistant',
    subtitle: 'How can we help?',
    greeting: 'Hello! How can I help you today?',
  };
</script>
<script src="http://your-server:4000/widget/chatbot.js"></script>
```

## API Endpoints

### Public (Chat Widget)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat/send` | Send chat message |
| POST | `/api/chat/close` | End chat session |
| POST | `/api/appointments` | Book appointment |
| GET | `/api/services` | List services |
| GET | `/api/doctors` | List doctors |
| GET | `/api/appointments/availability` | Check slot availability |

### Authenticated (Admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Admin login |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/admin/dashboard` | Dashboard stats |
| GET/PATCH | `/api/appointments` | Manage appointments |
| GET/POST/PUT/DELETE | `/api/services` | CRUD services |
| GET/POST/PUT/DELETE | `/api/doctors` | CRUD doctors |
| GET/POST/PUT/DELETE | `/api/knowledge` | CRUD knowledge base |

## Appointment Status Flow

```
booked → confirmed → completed
```

## Project Structure

```
Chatbot/
├── docker-compose.yml      # PostgreSQL + pgvector
├── backend/                 # Node.js API
│   ├── prisma/              # Database schema + seed
│   └── src/                 # Express app, services, routes
├── frontend/                # React admin panel
│   └── src/                 # Pages, components, context
└── widget/                  # Embeddable chat widget
```

## Architecture

```
User Message → Intent Detection (NLU) → Entity Extraction
    → pgvector Similarity Search (RAG) → LLM Response Generation (Ollama)
    → Reply to User
```

### Intents Supported
- Service/treatment inquiry
- Doctor inquiry
- Appointment booking (multi-step)
- Availability checking
- Cancellation
- Pricing, hours, contact info
