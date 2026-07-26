# Doctor/Clinic Knowledge-Based Chatbot - Implementation Plan

## Overview
A self-hosted, RAG-powered chatbot for doctor/clinic websites that answers patient queries about services, treatments, and doctors, then books appointments. Includes an admin panel with appointment status management (Booked → Confirmed → Completed).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend (Admin) | React.js + Tailwind CSS + React Router |
| Backend API | Node.js + Express.js |
| Database | PostgreSQL + pgvector extension |
| RAG Engine | pgvector (embeddings) + Ollama (local LLM) |
| NLU | Intent classification via Ollama + keyword matching |
| Auth | JWT (Admin panel) |
| Chat Widget | Embeddable vanilla JS widget (floating bubble) |
| ORM | Prisma |

## Project Structure

```
Chatbot/
├── PLAN.md
├── docker-compose.yml
├── backend/
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── src/
│   │   ├── index.js
│   │   ├── config/
│   │   │   ├── database.js
│   │   │   ├── ollama.js
│   │   │   └── pgvector.js
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   └── errorHandler.js
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── chat.routes.js
│   │   │   ├── admin.routes.js
│   │   │   ├── service.routes.js
│   │   │   ├── doctor.routes.js
│   │   │   ├── appointment.routes.js
│   │   │   └── knowledge.routes.js
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   ├── chat.controller.js
│   │   │   ├── service.controller.js
│   │   │   ├── doctor.controller.js
│   │   │   ├── appointment.controller.js
│   │   │   └── knowledge.controller.js
│   │   ├── services/
│   │   │   ├── rag.service.js
│   │   │   ├── nlu.service.js
│   │   │   ├── chat.service.js
│   │   │   ├── appointment.service.js
│   │   │   └── embedding.service.js
│   │   └── utils/
│   │       └── helpers.js
│   └── uploads/
├── frontend/
│   ├── package.json
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       ├── context/
│       │   └── AuthContext.jsx
│       ├── components/
│       │   ├── Layout.jsx
│       │   ├── ProtectedRoute.jsx
│       │   ├── Sidebar.jsx
│       │   ├── StatusBadge.jsx
│       │   └── StatsCard.jsx
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Dashboard.jsx
│       │   ├── Appointments.jsx
│       │   ├── Services.jsx
│       │   ├── Doctors.jsx
│       │   ├── KnowledgeBase.jsx
│       │   └── ChatLogs.jsx
│       └── api/
│           └── axios.js
└── widget/
    ├── index.html
    ├── chatbot.js
    └── chatbot.css
```

## Database Schema

### Tables
1. **users** - Admin/staff accounts (email, password_hash, role)
2. **doctors** - Doctor profiles (name, specialization, availability schedule)
3. **services** - Clinic services (name, description, duration, price, linked doctor)
4. **appointments** - Bookings (patient info, doctor, service, date/time, status)
5. **chat_sessions** - Chat conversations (visitor_id, timestamps)
6. **chat_messages** - Individual messages (role, content, intent)
7. **knowledge_base** - RAG knowledge base (title, content, category, vector embedding)

### Status Flow
```
booked → confirmed → completed
```

## RAG Pipeline

### Flow
```
User Message → Intent Detection → Entity Extraction → Knowledge Retrieval → Response Generation → Reply
```

### Components
1. **NLU Service**: Detects intent (inquiry, book, cancel, etc.) and extracts entities (doctor name, date, service)
2. **Embedding Service**: Generates vector embeddings via Ollama (nomic-embed-text model)
3. **RAG Service**: pgvector similarity search to find relevant knowledge chunks
4. **Chat Service**: Combines context + retrieved knowledge to generate response via Ollama (llama3.2 model)

### Intents
- service_inquiry: "What services do you offer?"
- doctor_inquiry: "Who are your doctors?"
- treatment_inquiry: "Do you do root canals?"
- book_appointment: "I want to book an appointment"
- check_availability: "Is Dr. Smith available tomorrow?"
- cancel_appointment: "Cancel my appointment"
- general: "What are your hours?"

## Implementation Steps

1. Project setup + Docker Compose (PostgreSQL + pgvector + Ollama)
2. Backend: Prisma schema + migrations + seed data
3. Backend: Config + Auth middleware (JWT)
4. Backend: RAG engine (pgvector + Ollama)
5. Backend: NLU service (intent detection + entity extraction)
6. Backend: Chat service + API routes
7. Backend: Appointment service + availability logic
8. Backend: Admin CRUD routes (services, doctors, knowledge base)
9. Admin Panel: React app with routing
10. Admin Panel: All pages (Login, Dashboard, Appointments, Services, Doctors, KB, ChatLogs)
11. Embeddable Chat Widget
12. Seed sample clinic data + testing
