# SkillSwap

**SkillSwap** is a student-to-student skill exchange platform. Students can discover peers with complementary skills, request an exchange, arrange learning sessions, chat privately, and review one another after completed sessions. The project is free to use: it has no paid tiers, subscriptions, or payment flow.

## Features

- Student registration, login, logout, and profile editing.
- A skill catalogue with teaching and learning skills and proficiency levels.
- Searchable, filterable student discovery and explainable skill-match recommendations.
- Exchange requests with accept, reject, and cancel workflows.
- Session proposals, confirmation, decline, cancellation, and rescheduling.
- Private real-time chat using Socket.IO, with persisted message history.
- Unread-message indicators and inbox updates.
- Reviews for completed sessions and profile reputation summaries.
- Responsive UI with light and dark themes.
- Development-only demo-profile seeding for testing two-account workflows.

## Technology stack

| Area | Technologies |
|---|---|
| Frontend | React 19, React Router 7, Vite 8, JavaScript, CSS |
| Backend | Node.js, Express 5, JavaScript ES modules |
| Database | MongoDB, Mongoose 8 |
| Authentication | JWT in an HTTP-only cookie, `bcryptjs`, `cookie-parser` |
| Real-time messaging | Socket.IO server and client |
| Validation and security | Zod, CORS allowlist, Express JSON size limit, server-side authorization and validation |
| Testing and quality | Node.js test runner, Oxlint, Vite production build |
| Package management | npm workspaces and `package-lock.json` |

## Repository structure

```text
SkillSwap/
├── client/
│   ├── public/             # Static public assets
│   ├── src/                # React pages, components, API client, styles
│   ├── .env.example        # Frontend environment-variable example
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── server/
│   ├── src/                # Express app, routes, controllers, models, services
│   ├── scripts/            # Development-only demo-data utilities
│   ├── test/               # Backend tests
│   ├── .env.example        # Backend environment-variable example
│   └── package.json
├── DEMO_DATA.md            # Safe demo data and two-account testing guide
├── .gitignore
├── package.json            # npm workspace scripts
├── package-lock.json
└── README.md
```

## Requirements

- Node.js **20.19+** or **22.12+** (use a supported Node.js LTS release compatible with Vite 8).
- npm, included with Node.js.
- A MongoDB database, such as MongoDB Atlas.

## Run locally

### 1. Install dependencies

From the repository root:

```bash
npm install
```

### 2. Configure the backend

Copy `server/.env.example` to `server/.env` and set the values:

```dotenv
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-host>/<database>
JWT_SECRET=<a-random-secret-at-least-32-characters-long>
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

Use your actual MongoDB connection string locally. URL-encode special characters in database credentials when required. Keep `server/.env` private and never commit it.

### 3. Configure the frontend if needed

For local development, the Vite proxy sends `/api` and `/socket.io` requests to `http://localhost:5000` by default, so `client/.env` is normally unnecessary. If the API is hosted at another origin, copy `client/.env.example` to `client/.env` and set:

```dotenv
VITE_API_URL=http://localhost:5000
```

Do not add a trailing slash. A `VITE_` variable is bundled into frontend code, so **never put secrets in it**.

### 4. Start the application

Open two terminals in the repository root.

Terminal 1 — backend:

```bash
npm run dev:server
```

Terminal 2 — frontend:

```bash
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`. The API health endpoint is `http://localhost:5000/api/health`.

## Available commands

Run these from the repository root:

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite frontend |
| `npm run dev:server` | Start the backend in watch mode |
| `npm run build` | Build the frontend for production |
| `npm run preview` | Preview the built frontend locally |
| `npm run lint` | Lint frontend source with Oxlint |
| `npm test` | Run backend tests |
| `npm run check` | Run frontend lint, frontend build, and backend tests |
| `npm start` | Start the backend in production mode |

## Environment variables

### Backend (`server/.env`)

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB connection string. The server uses the `skillswap` database name. |
| `JWT_SECRET` | Yes | Random secret of at least 32 characters used to sign authentication tokens. |
| `CLIENT_URL` | Yes | Comma-separated list of allowed frontend origins, without paths. |
| `PORT` | No | Port for the API; defaults to `5000`. Hosting providers often set this automatically. |
| `NODE_ENV` | Recommended | Set to `production` in production and `development` locally. Controls production cookie and origin behavior. |

### Frontend (`client/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | No | API origin when frontend and backend are hosted separately. Leave unset when using same-origin API routing. |

Only commit the `.env.example` files. Do not commit `.env`, real credentials, database dumps, or production tokens.

## Testing before release

Run:

```bash
npm run check
```

This executes frontend linting, a production build, and backend tests. Passing these checks does not replace end-to-end testing. Before launch, manually test registration/login, profile edits, discovery and filters, requests, session lifecycle, chat and unread indicators, reviews, and both themes on desktop and mobile.

For a safe fictional-profile seeding guide and a two-account demo workflow, see [`DEMO_DATA.md`](./DEMO_DATA.md). Only seed a dedicated development/test database; never point demo seeding at production.

## Deployment overview

The included [`render.yaml`](./render.yaml) deploys the Vite frontend, Express API, and Socket.IO server as one same-origin Render web service, with MongoDB Atlas for persistent data. This preserves the existing HTTP-only cookie authentication and real-time chat without exposing secrets in the frontend.

### Free hobby/demo deployment on Render

1. Push the project to a GitHub repository and create a new Blueprint on [Render](https://dashboard.render.com/blueprints) from that repository. Keep the repository private if it contains work you do not want public.
2. Render reads `render.yaml`. Choose the **Free** instance when prompted, then enter the MongoDB Atlas URI for `MONGODB_URI` in Render's secret environment-variable form. Render generates `JWT_SECRET`; do not put either value in Git, a `VITE_` variable, or chat.
3. In MongoDB Atlas, create a dedicated application database user with only the permissions this app needs. Under Network Access, allow the service's outbound IP ranges shown in its Render dashboard, rather than opening access to every IP when the ranges are available. Keep Atlas authentication and TLS enabled.
4. Wait for the Render deployment to finish, then open the generated `https://<service>.onrender.com` URL. The frontend and `/api/health` endpoint use that same origin; Render supplies the origin to the app automatically.
5. Test registration, login persistence, profile edits, discovery, requests, sessions, chat/unread indicators, and reviews in a fresh browser session. Verify that a browser reload on `/discover` or `/profile/edit` works.

The free Render web service spins down after 15 minutes without inbound traffic, including WebSocket traffic, and may take about a minute to wake up. Free services have ephemeral filesystems and Render explicitly recommends them for hobby/testing rather than production. MongoDB Atlas is separate; confirm its current free-cluster terms, backup policy, and limits before using real student data. Never use demo seeding against the production database.

Vercel is not the selected target for this single-service deployment: the current app expects a shared long-running Express/Socket.IO process. Vercel's serverless/WebSocket support has different lifecycle and scaling constraints and would need a separate chat architecture. Avoid splitting the frontend and API onto unrelated free domains unless you deliberately configure and test cross-site cookie behavior.

Do not add production secrets to this repository. Keep `MONGODB_URI` and `JWT_SECRET` only in the hosting provider's protected environment settings. For an actual production service with reliable wake-free chat, backups, and stable database network access, use paid hosting and verify its current pricing before upgrading.

## API overview

The API is mounted under `/api` and includes routes for:

- `/auth` — register, login, logout, current session.
- `/users` — own profile, public profiles, discovery, recommendations.
- `/skills` — skill catalogue.
- `/exchange-requests` — exchange request lifecycle.
- `/sessions` — session lifecycle.
- `/conversations` — chat conversations and message history.
- `/reviews` — eligible reviews and reputation.
- `/health` — service health check.

Protected routes require a valid authenticated session. The backend enforces ownership and participant authorization; the frontend should not be treated as a security boundary.

## Known limitations

- Request and session lists may require refresh; the app does not provide a universal live-activity feed.
- Sessions are not automatically completed, and scheduling does not check calendar availability or provide video calls.
- The app does not include file uploads, group chat, AI services, or payment features.
- Match scores rank complementary skill matches; they are not probabilities of a successful exchange.

## License

No license has been declared yet. If you intend others to reuse or modify this project publicly, choose and add an appropriate license before publishing.
