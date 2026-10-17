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
- One canonical JavaScript match scorer is used for discovery and recommendations. Per direction, distinct exact skill matches award 10 points each and alias-only matches award 7 each, capped at 30 skill points. Each distinct match with a known teacher proficiency equal to or above the learner's earns 5 points, capped at 10 proficiency points per direction. Matching in both directions earns a 20-point mutual-exchange bonus. The integer score ranges from 0 to 100 and is a ranking indicator, not a probability.
- Exchange requests can be sent for a student's learning interests, with an optional offered skill and introductory message. Recipients can accept or reject pending requests; senders can cancel pending requests. Decisions are atomic, and only the two participants can view a request.
- Either student in an accepted exchange can propose a session. The other participant can confirm or decline; either participant can cancel or propose a reschedule. Rescheduling returns the session to `PROPOSED`, requiring the other participant to confirm the new time.
- Chat, external calendars, video calls, reviews, notifications, AI services, and payment features are not part of this release.

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
- `GET /api/exchange-requests/accepted` (authenticated participant; paginated)
- `POST /api/sessions` (authenticated participant; propose for an accepted request)
- `GET /api/sessions` (authenticated participant; optional `status`, `period=upcoming|past`, `page`, `limit`)
- `GET /api/sessions/:id` (authenticated participant only)
- `PATCH /api/sessions/:id/confirm` (other participant; proposed only)
- `PATCH /api/sessions/:id/decline` (other participant; proposed only)
- `PATCH /api/sessions/:id/cancel` (either participant; proposed or confirmed)
- `PATCH /api/sessions/:id/reschedule` (either participant; proposed or confirmed; requires new `startAt` and `endAt`)
- `PATCH /api/sessions/:id/complete` (either participant; confirmed and after the scheduled end)

Discovery responses contain only public profile fields and safe skill records. Match results include score components, distinct matched skills, and explanations based on the actual matches. Request bodies accept `recipient`, `requestedSkill`, optional `offeredSkill`, and optional `message`; clients cannot set status or sender identity, and recipient selection is checked against the authenticated student. Session organizer and participants are derived from the accepted request and authenticated user; clients cannot provide participant IDs.

## Database and request lifecycle

`ExchangeRequest` references the sender, recipient, and catalogue skills; it does not duplicate profile data. Its statuses are `PENDING`, `ACCEPTED`, `REJECTED`, and `CANCELLED`. A partial unique index prevents duplicate pending requests for a sender/recipient/requested-skill tuple while allowing a later request after rejection or cancellation. Status transitions use conditional atomic updates to prevent competing actions from both succeeding.

`Session` references the accepted exchange request, organizer, exactly two distinct participants, title/notes, UTC-compatible MongoDB `Date` start/end values, and status. Sessions must start in the future and last 15 minutes to 4 hours. The frontend converts local date-time inputs into ISO timestamps and displays returned dates in the viewer's local timezone. Calendar availability is not checked.

Permitted session transitions:

| Current status | Action | Next status | Permission |
|---|---|---|---|
| `PROPOSED` | confirm / decline | `CONFIRMED` / `DECLINED` | Other participant only |
| `PROPOSED` | cancel | `CANCELLED` | Either participant |
| `PROPOSED` | reschedule | `PROPOSED` | Either participant becomes organizer; other participant must confirm |
| `CONFIRMED` | cancel | `CANCELLED` | Either participant |
| `CONFIRMED` | reschedule | `PROPOSED` | Either participant becomes organizer; other participant must confirm |
| `CONFIRMED` | complete | `COMPLETED` | Either participant after scheduled end |
| `DECLINED`, `CANCELLED`, `COMPLETED` | — | terminal | No reopening |

Status updates use conditional MongoDB updates. Confirm/decline and terminal transitions require the expected current status. Rescheduling compares an internal revision counter so competing schedule proposals cannot silently overwrite one another.

### Matching formula and alias resolution

For each direction:

1. Give 10 points per distinct exact normalized-name match or 7 points per alias-only match; cap this component at 30.
2. Give 5 additional points per distinct match where both proficiency values are known and the teacher's level is equal to or higher than the learner's; cap this component at 10.
3. Add a 20-point bonus once if both directions have at least one valid complementary match.

Examples: one compatible exact match in one direction scores `10 + 5 = 15`; one compatible alias-only match scores `7 + 5 = 12`; one compatible exact match each way scores `15 + 15 + 20 = 50`. Two directions at their full component caps plus mutual exchange score `30 + 10 + 30 + 10 + 20 = 100`.

Skill names and aliases are case-insensitive and trimmed. Duplicate terms, including an alias repeating its own skill name, do not count twice. Within a direction, records linked through normalized names or explicit catalogue aliases form one logical match group. Each group contributes points and a `mutualMatchCount` entry only once. Exact matches take precedence over aliases in the group. In an ambiguous alias collision, choose an exact pair first, otherwise resolve by normalized skill name and catalogue ID; return the chosen existing skill record and do not modify catalogue data. Proficiency compatibility is counted once per group only when the selected representative pair has valid levels and the teacher meets the learner's level, so an incompatible exact match is not concealed by a conflicting alias record.

Discovery's base filters and recommendation skill-ID filters run in MongoDB and populate only selected public profile and skill fields. The canonical scorer and ordering run in JavaScript before pagination, preserving globally correct pages. Unfiltered discovery still needs to rank every matching student; very large deployments may need a ranking/search store while preserving the canonical scoring service.

## Commands and environment

Required server variables: `MONGODB_URI`, `JWT_SECRET` (at least 32 characters), and `CLIENT_URL` (one or more comma-separated allowed frontend origins). `PORT` is optional. `VITE_API_URL` is optional; leave it unset for same-origin deployments or set it to the API origin as needed. Never commit `.env` files or credentials.

Vercel can host the frontend and free-tier-compatible services can be used for MongoDB Atlas and API hosting, subject to provider limits and terms. Configure the production `CLIENT_URL`, frontend API URL, and MongoDB network access for the chosen deployment. No paid API key or AI service is needed.

See `client/.env.example` and `server/.env.example` for variable names and examples without credentials. The frontend bundles system fonts locally and does not require a third-party font request. Auth middleware loads only the current user's required account fields; skill profiles are populated only by endpoints that need them. Sent/received request histories use a single paginated aggregation; accepted requests and sessions use bounded pagination.

## Known limitations

- There is no live update service; request and session lists can be manually refreshed.
- Session completion is a participant action after the scheduled end; sessions are not automatically completed.
- The scheduling workflow does not check calendar availability or provide video conferencing.
- Matching uses existing skill names, explicit aliases, and proficiency values; it does not use paid AI, popularity, or unrelated skills.
- Backend tests cover scoring, validation, session model constraints, and unauthenticated API access. Database-backed exchange/session lifecycle scenarios should also be verified against a configured MongoDB test database before production use.
