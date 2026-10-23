# SkillSwap — Student Skill Exchange Platform

<p align="center">
  <strong>Learn Together. Teach Each Other. Grow Together.</strong>
</p>

<p align="center">
  <a href="https://skillswap-pu28.onrender.com"><strong>🚀 Visit Live Application</strong></a>
  &nbsp; | &nbsp;
  <a href="https://github.com/Aryan123go/SkillSwap"><strong>📂 GitHub Repository</strong></a>
</p>

---

## 📌 About the Project

**SkillSwap** is a student-to-student skill exchange platform designed to make peer-to-peer learning accessible, collaborative, and free.

Every student has something they can teach and something they want to learn. One student might be proficient in Java but want to learn web development, while another might know web development and want to improve their programming skills. SkillSwap connects such students so they can learn from each other through a mutually beneficial exchange.

Instead of paying for courses or relying entirely on traditional learning resources, students can discover peers with complementary skills, exchange learning requests, arrange sessions, communicate through private chat, and share feedback after completing their sessions.

The platform is built around a simple idea:

> **Everyone has a skill worth sharing, and everyone has something new to learn.**

SkillSwap is a free-to-use platform with no subscriptions, paid tiers, or payment system. It encourages collaborative learning, community building, and practical knowledge sharing among students.

### 🌐 Live Demo

**Try SkillSwap here:** https://skillswap-pu28.onrender.com

The application is deployed on Render. As the project uses free hosting, the backend may take some time to start after a period of inactivity.

---

## ✨ Features

### 👤 Authentication and Profiles
- Student registration, login, and logout.
- Secure authentication using JWT-based tokens stored in HTTP-only cookies.
- Profile creation and editing.
- Teaching skills, learning interests, and proficiency levels.
- Public student profiles to explore other learners.

### 🔍 Discover Students and Match Skills
- Browse and search for students based on their skills.
- Filter students using relevant discovery criteria.
- Get recommendations based on complementary teaching and learning skills.
- View skill-match scores to understand why students may be suitable learning partners.
- Find students whose expertise aligns with your learning goals.

### 🤝 Skill Exchange Requests
- Send exchange requests to other students.
- Accept or reject incoming requests.
- Cancel requests when necessary.
- Manage the lifecycle of a proposed skill exchange.

### 📅 Learning Session Management
- Propose learning sessions with other students.
- Confirm or decline proposed sessions.
- Cancel or reschedule sessions when plans change.
- Track the status of learning sessions.

### 💬 Real-Time Private Chat
- Communicate privately with other students.
- Exchange messages using Socket.IO.
- Persist messages in MongoDB so conversation history can be retrieved.
- View unread-message indicators and inbox updates.

### ⭐ Reviews and Reputation
- Submit reviews for eligible completed sessions.
- View ratings and reputation summaries on student profiles.
- Use feedback to make more informed decisions when choosing learning partners.

### 🎨 User Interface
- Responsive interface for desktop and mobile screens.
- Light and dark themes.
- Consistent navigation between discovery, profiles, requests, sessions, and messages.

### 🧪 Development and Testing
- Development-only demo-profile seeding for testing realistic student interactions.
- Support for testing workflows with two separate accounts.
- Backend tests and frontend linting.
- Production frontend build through Vite.

---

## 🛠️ Technology Stack

SkillSwap uses the MERN stack, with additional libraries for authentication, validation, real-time communication, and development quality.

| Technology | Purpose |
|---|---|
| **MongoDB** | NoSQL database for users, skills, exchange requests, sessions, conversations, messages, and reviews. |
| **Express.js 5** | Backend web framework for defining API routes and handling HTTP requests. |
| **React 19** | Component-based frontend for building interactive user interfaces. |
| **Node.js** | JavaScript runtime for executing the backend server. |
| **Vite 8** | Frontend development server and production build tool. |
| **React Router 7** | Client-side navigation between application pages. |
| **Mongoose 8** | MongoDB object modelling, schemas, and database operations. |
| **Socket.IO** | Real-time communication for private messaging and chat updates. |
| **JWT** | Authentication tokens for verifying logged-in users. |
| **bcryptjs** | Password hashing before storing passwords in the database. |
| **cookie-parser** | Reading cookies used for authentication. |
| **Zod** | Input validation and data-shape validation. |
| **CORS** | Configuring which frontend origins can access the backend. |
| **Oxlint** | Static analysis and linting of frontend JavaScript code. |
| **Node.js Test Runner** | Running backend automated tests. |
| **npm Workspaces** | Managing the frontend and backend packages from one repository. |
| **Render** | Hosting the deployed web application and backend service. |
| **MongoDB Atlas** | Cloud-hosted MongoDB database option for persistent application data. |
| **Git and GitHub** | Version control and source-code management. |

### How the Technologies Work Together

1. **Frontend:** React renders the interface, while React Router manages page navigation. Vite provides the development environment and builds the frontend for deployment.
2. **Backend:** Node.js and Express receive API requests, validate inputs, enforce authorization, and execute application logic.
3. **Database:** Mongoose connects the backend to MongoDB and manages the application's stored data.
4. **Authentication:** Passwords are hashed using bcryptjs. JWT-based authentication uses HTTP-only cookies to help protect authentication tokens from direct JavaScript access.
5. **Real-time communication:** Socket.IO enables chat messages and live inbox updates without requiring users to repeatedly refresh the page.
6. **Deployment:** Render hosts the application, while MongoDB Atlas can provide the persistent cloud database.

---

## 🏗️ Application Architecture

The application follows a client-server architecture.

```text
                    STUDENT
                       |
                       v
              React Frontend (Vite)
                       |
              HTTP / REST API
                       |
                       v
             Node.js + Express
                       |
          +------------+------------+
          |            |            |
          v            v            v
     Authentication  Business     Validation
        (JWT)         Logic         (Zod)
          |            |            |
          +------------+------------+
                       |
                       v
                Mongoose ODM
                       |
                       v
                  MongoDB
                      

       React Frontend <----> Socket.IO
                    Real-Time Chat
```

The frontend handles presentation and user interaction, while the backend is responsible for application logic, authentication, validation, and access control. MongoDB stores the persistent application data.

The backend also uses Socket.IO for real-time messaging, with conversation and message data persisted through the database.

---

## 📂 Project Structure

```text
SkillSwap/
├── client/
│   ├── public/              # Public static assets
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Application pages
│   │   ├── services/        # Frontend API and related services
│   │   └── ...              # Styles, utilities, and other source files
│   ├── .env.example         # Frontend environment template
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── server/
│   ├── src/
│   │   ├── controllers/     # Request handlers
│   │   ├── models/          # MongoDB/Mongoose models
│   │   ├── routes/          # API route definitions
│   │   ├── services/        # Business logic and supporting services
│   │   └── ...              # Configuration, middleware, and server code
│   ├── scripts/             # Development utilities
│   ├── test/                # Backend tests
│   ├── .env.example         # Backend environment template
│   └── package.json
│
├── DEMO_DATA.md             # Demo data and testing guide
├── render.yaml              # Render deployment configuration
├── .gitignore
├── package.json             # Root workspace configuration and scripts
├── package-lock.json
└── README.md
```

*The exact files and subdirectories may evolve as the project develops.*

---

## 🚀 Getting Started

Follow these instructions to run SkillSwap locally.

### Prerequisites

Install the following:

- **Node.js:** Version 20.19+ or 22.12+, compatible with Vite 8.
- **npm:** Included with Node.js.
- **MongoDB:** A local MongoDB instance or a MongoDB Atlas database.
- **Git:** To clone the repository.

### 1. Clone the Repository

```bash
git clone https://github.com/Aryan123go/SkillSwap.git
cd SkillSwap
```

### 2. Install Dependencies

Run this command from the project root:

```bash
npm install
```

The repository uses npm workspaces to manage the frontend and backend dependencies.

### 3. Configure the Backend

Create a local environment file by copying the example.

**Windows PowerShell:**

```powershell
Copy-Item server/.env.example server/.env
```

**macOS/Linux:**

```bash
cp server/.env.example server/.env
```

Configure the variables in `server/.env`:

```dotenv
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_random_secret_of_at_least_32_characters
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

Replace the example values with your actual configuration.

- `MONGODB_URI`: Your MongoDB connection string.
- `JWT_SECRET`: A strong, randomly generated secret containing at least 32 characters.
- `CLIENT_URL`: The origin of the local frontend.
- `PORT`: The backend port; defaults to `5000`.
- `NODE_ENV`: Set to `development` for local development.

If your MongoDB password contains special characters, URL-encode them when required by the connection-string format.

**Security:** Never commit `server/.env`, database credentials, or JWT secrets to GitHub.

### 4. Configure the Frontend

For local development, Vite proxies `/api` and `/socket.io` requests to the backend at `http://localhost:5000` by default. Therefore, a frontend environment file is normally unnecessary.

If you need to configure a different API origin, copy `client/.env.example` to `client/.env` and set:

```dotenv
VITE_API_URL=http://localhost:5000
```

Do not include a trailing slash if the application expects the origin in this format.

Variables prefixed with `VITE_` are exposed to the frontend bundle. **Never store passwords, database URIs, JWT secrets, or other private credentials in frontend environment variables.**

### 5. Run the Application

Open two terminals from the repository root.

**Terminal 1 — Backend**

```bash
npm run dev:server
```

**Terminal 2 — Frontend**

```bash
npm run dev
```

Open the URL printed by Vite, usually:

http://localhost:5173

The backend health endpoint is available at:

http://localhost:5000/api/health

---

## 📜 Available Scripts

Run these commands from the repository root.

| Command | Description |
|---|---|
| `npm run dev` | Start the frontend development server. |
| `npm run dev:server` | Start the backend in development/watch mode. |
| `npm run build` | Build the frontend for production. |
| `npm run preview` | Preview the production frontend build locally. |
| `npm run lint` | Run frontend linting with Oxlint. |
| `npm test` | Run backend tests. |
| `npm run check` | Run the configured lint, build, and backend test checks. |
| `npm start` | Start the backend in production mode. |

---

## 🔐 Environment Variables

### Backend

Configure these variables in `server/.env` locally or through the hosting provider's environment settings in production.

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB connection string. |
| `JWT_SECRET` | Yes | Secret used to sign and verify authentication tokens. |
| `CLIENT_URL` | Yes | Allowed frontend origin or comma-separated list of allowed origins, without paths. |
| `PORT` | No | Backend listening port; defaults to `5000` when not supplied. |
| `NODE_ENV` | Recommended | Application environment, such as `development` or `production`. |

### Frontend

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | No | API origin when the frontend needs to communicate with a separately hosted backend. |

Only example environment files should be committed. Keep real `.env` files, database dumps, production tokens, and other secrets out of the repository.

---

## ☁️ Deployment

### Live Application

**[Open SkillSwap](https://skillswap-pu28.onrender.com)**

SkillSwap is deployed on Render. The deployment configuration in `render.yaml` is intended to run the frontend, Express API, and Socket.IO server together as a single web service, with MongoDB Atlas used for persistent database storage.

### Deployment Overview

1. Push the required project source files to GitHub.
2. Configure a MongoDB Atlas database and create an application database user.
3. Create or configure the Render service using the repository and its deployment configuration.
4. Add the required backend environment variables in Render, including `MONGODB_URI`, `JWT_SECRET`, and any required application settings.
5. Deploy the application and verify that the health endpoint responds successfully.
6. Test authentication, discovery, exchange requests, sessions, messaging, and reviews on the live application.

For production, use secure environment-variable settings and appropriate database network-access rules. Never expose database credentials in frontend code or commit them to the repository.

**Free-hosting note:** Free services may spin down after inactivity, which can cause a delay when the application is opened again. Check the current hosting and database provider limits before relying on the deployment for continuous availability or storing real student data.

---

## 🧪 Testing and Quality Checks

Before deploying changes, run:

```bash
npm run check
```

This runs the checks configured by the project, including frontend linting, a production build, and backend tests.

In addition to automated checks, manually test the following workflows:

- Registering, logging in, logging out, and reloading the application.
- Editing a profile and updating teaching and learning skills.
- Searching for students and applying discovery filters.
- Sending, accepting, rejecting, and cancelling exchange requests.
- Proposing, confirming, declining, cancelling, and rescheduling sessions.
- Sending messages between two accounts and checking unread indicators.
- Submitting eligible reviews and viewing reputation summaries.
- Switching between light and dark themes.
- Navigating directly to application routes and using the application on mobile screens.

For demo-data instructions, see [`DEMO_DATA.md`](./DEMO_DATA.md). Use a dedicated development or test database for demo seeding; never run demo seeding against a production database containing real user data.

---

## 🔌 API Overview

The backend exposes REST API routes under `/api`.

| Route | Purpose |
|---|---|
| `/api/auth` | Registration, login, logout, and current authentication session. |
| `/api/users` | User profiles, student discovery, and skill-match recommendations. |
| `/api/skills` | Skill catalogue and related operations. |
| `/api/exchange-requests` | Skill exchange request workflows. |
| `/api/sessions` | Learning session management. |
| `/api/conversations` | Conversations and persisted message history. |
| `/api/reviews` | Reviews and reputation information. |
| `/api/health` | Service health check. |

Authentication and authorization are enforced by the backend for protected operations. Client-side navigation or interface restrictions alone are not considered security controls.

---

## 🔮 Future Improvements

Potential future enhancements include:

- More advanced skill-matching and recommendation algorithms.
- Improved live updates across requests and session workflows.
- Calendar integration and availability-aware session scheduling.
- Group learning sessions and collaborative learning spaces.
- Optional notifications for important account and learning activities.
- More detailed progress tracking and learning-history summaries.
- Additional automated integration and end-to-end tests.

These are possible extensions, not claims that the features are already implemented.

---

## 📌 Known Limitations

- The application does not include subscriptions, paid tiers, or payment processing.
- Session scheduling does not automatically check calendar availability or provide built-in video calls.
- The application does not currently provide file uploads or group chat.
- Some request and session updates may require refreshing the relevant view.
- Skill-match scores are ranking indicators based on skill compatibility, not probabilities of a successful exchange.
- Free hosting may have availability and performance limitations.

---

## 🤝 Contributing

Contributions, bug reports, and suggestions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make your changes and test them locally.
4. Commit your changes with a clear message.
5. Open a pull request describing the changes.

Please do not include secrets, real user credentials, or private database data in commits or issues.

---

## 📄 License

No license has been declared yet. Until a license is added, public availability of this repository does not automatically grant permission to reuse, modify, or redistribute its code.

---

<p align="center">
  <strong>SkillSwap — Learn Together. Teach Each Other. Grow Together.</strong>
</p>
