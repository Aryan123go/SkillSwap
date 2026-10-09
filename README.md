# SkillSwap

SkillSwap is a free student-to-student skill exchange platform. Students discover learning partners, receive deterministic recommendations based on complementary skills, and manage exchange requests. All registered students have access to all core features: there are no paid tiers, subscriptions, membership fees, payment flows, or plan-based limits.

## Requirements

- Node.js 20.19+ or 22.12+
- MongoDB Atlas connection string

## Setup

1. Run `npm install` from the repository root.
2. Copy `server/.env.example` to `server/.env` and provide `MONGODB_URI` and a strong `JWT_SECRET` (at least 32 characters). Keep this file private.
3. Copy `client/.env.example` to `client/.env` only if the API needs a non-default base URL.
4. Start the API with `npm run dev:server`.
5. Start Vite in a second terminal with `npm run dev`.

The API connects to MongoDB and initializes the skill catalogue before listening on `PORT`. Start the API and frontend in separate terminals for local development. The frontend uses HTTP-only cookie authentication and never persists session state in local storage.

## Commands

- `npm run dev` — start the frontend
- `npm run dev:server` — start the API in watch mode
- `npm run build` — build the frontend
- `npm run lint` — lint frontend sources
- `npm test --workspace server` — run backend tests
- `npm start` — start the API

## Features

- JWT-backed student accounts, editable profiles, and a persistent skill catalogue.
- Authenticated, paginated student discovery with case-insensitive name/skill search and filters for teaching skill, learning skill, proficiency, and college.
- Backend match scoring using the existing skill names, aliases, and proficiency levels. Each matched direction scores 40 points, each direction with at least one teacher at or above the learner's listed proficiency adds 5 points, and a two-way complementary exchange adds 10 points (maximum 100). Unrelated skills do not add points. Proficiency scores are not invented; an unrecognized/missing level adds no compatibility points. Recommendations are ordered by score and then student name.
- Exchange requests can be sent for a student's learning interests, with an optional offered skill and introductory message. Recipients can accept or reject pending requests; senders can cancel pending requests. Decisions are atomic, and only the two participants can view a request.
- Acceptance does not schedule a session. Chat, calendars, reviews, notifications, AI services, and payment features are not part of this release.

## API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout` (authenticated)
- `GET /api/auth/me` (authenticated)
- `GET /api/users/me` (authenticated)
- `PUT /api/users/me` (authenticated)
- `GET /api/users/:id`
- `GET /api/skills`
- `GET /api/users/discover` (authenticated; `q`, `teachingSkill`, `learningSkill`, `proficiency`, `college`, `page`, `limit`)
- `GET /api/users/recommendations` (authenticated; same filters, returns complementary matches only)
- `POST /api/exchange-requests` (authenticated)
- `GET /api/exchange-requests/sent` (authenticated; paginated)
- `GET /api/exchange-requests/received` (authenticated; paginated)
- `GET /api/exchange-requests/:id` (authenticated participant only)
- `PATCH /api/exchange-requests/:id/accept` (authenticated recipient; pending only)
- `PATCH /api/exchange-requests/:id/reject` (authenticated recipient; pending only)
- `PATCH /api/exchange-requests/:id/cancel` (authenticated sender; pending only)

Discovery responses contain only public profile fields and safe skill records. Match results include score, matched skills, and human-readable reasons. Request bodies accept `recipient`, `requestedSkill`, optional `offeredSkill`, and optional `message`; clients cannot set status, sender, or recipient identity beyond selecting the intended recipient, which is checked against the authenticated student.

## Database and request lifecycle

`ExchangeRequest` references the sender, recipient, and catalogue skills; it does not duplicate profile data. Its statuses are `PENDING`, `ACCEPTED`, `REJECTED`, and `CANCELLED`. A partial unique index prevents duplicate pending requests for a sender/recipient/requested-skill tuple while allowing a later request after rejection or cancellation. Status transitions use conditional atomic updates to prevent competing actions from both succeeding.

## Commands and environment

Required server variables: `MONGODB_URI`, `JWT_SECRET` (at least 32 characters), and `CLIENT_URL` (one or more comma-separated allowed frontend origins). `PORT` is optional. `VITE_API_URL` is optional; leave it unset for same-origin deployments or set it to the API origin as needed. Never commit `.env` files or credentials.

Vercel can host the frontend and free-tier-compatible services can be used for MongoDB Atlas and API hosting, subject to provider limits and terms. Configure the production `CLIENT_URL`, frontend API URL, and MongoDB network access for the chosen deployment. No paid API key or AI service is needed.

See `client/.env.example` and `server/.env.example` for variable names and examples without credentials. The frontend bundles system fonts locally and does not require a third-party font request. Auth middleware loads only the current user's required account fields; skill profiles are populated only by endpoints that need them. Request histories are paginated and fetched through a single aggregation.

## Known limitations

- Requests are not a scheduling mechanism; accepted students must coordinate later through channels outside this phase.
- There is no live update service; request lists can be manually refreshed.
- Matching is deterministic and uses existing skill names, aliases, and proficiency values. It does not use paid AI, popularity, or unrelated skills.
- The backend test suite covers validation, auth middleware access control, matching calculations, and pagination. Database-backed request lifecycle behavior should also be verified against a configured MongoDB test database before production use.
