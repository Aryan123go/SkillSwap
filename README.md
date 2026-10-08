# SkillSwap

SkillSwap is a student-to-student skill exchange platform. Phase 1 delivers account authentication, editable profiles, and a persistent skill catalogue.

## Requirements

- Node.js 20.19+ or 22.12+
- MongoDB Atlas connection string

## Setup

1. Run `npm install` from the repository root.
2. Copy `server/.env.example` to `server/.env` and provide `MONGODB_URI` and a strong `JWT_SECRET` (at least 32 characters). Keep this file private.
3. Copy `client/.env.example` to `client/.env` if the API is not at `http://localhost:5000`.
4. Start the API with `npm run dev:server`.
5. Start Vite in a second terminal with `npm run dev`.

The API connects to MongoDB and initializes the Phase 1 skill catalogue before listening on `PORT`. The frontend uses HTTP-only cookie authentication and never persists session state in local storage.

## Commands

- `npm run dev` — start the frontend
- `npm run dev:server` — start the API in watch mode
- `npm run build` — build the frontend
- `npm run lint` — lint frontend sources
- `npm start` — start the API

## Phase 1 endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout` (authenticated)
- `GET /api/auth/me` (authenticated)
- `GET /api/users/me` (authenticated)
- `PUT /api/users/me` (authenticated)
- `GET /api/users/:id`
- `GET /api/skills`

No exchange, messaging, matching, review, or admin workflows are included.
