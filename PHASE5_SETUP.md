# SkillSwap Phase 5 — chat setup and verification

## Install the new dependencies

From the repository root, run:

```bash
npm install
```

This installs `socket.io` in the server workspace and `socket.io-client` in the client workspace, and updates `package-lock.json`. The package registry was unreachable in the environment used to prepare these changes, so the lockfile could not be regenerated here. Do not use `npm ci` until `npm install` has updated the lockfile.

## Run locally

Terminal 1:

```bash
npm run dev:server
```

Terminal 2:

```bash
npm run dev
```

The local Vite proxy forwards `/api` and `/socket.io` to `http://localhost:5000` by default. If the API runs elsewhere, set `API_PROXY_TARGET` before starting Vite.

## Manual test checklist

1. Register/login as Student A and Student B in separate browser profiles.
2. Student A sends an exchange request to Student B.
3. Student B accepts it.
4. Sign in as either participant and open **Messages**. The accepted exchange should appear.
5. Open the conversation in both browser profiles and send messages from each side. New messages should appear without refreshing.
6. Refresh a conversation; previously sent messages should still be present.
7. Send a message while the socket is disconnected (or temporarily stop the API) and confirm the UI shows a recoverable error. REST fallback is used when the socket is not connected.
8. Try opening a conversation ID from a third, unrelated account. The API/socket must deny access.
9. Try chat for a pending, rejected, or cancelled exchange request. Access must be denied.
10. Check browser console and server logs for errors.

## Deployment note

Socket.IO needs a persistent Node.js HTTP server that supports WebSocket connections. A frontend deployed on Vercel can use a separately hosted compatible API/socket server; do not assume a Vercel serverless function can keep Socket.IO connections alive. Configure `CLIENT_URL` and `VITE_API_URL` for the actual deployment origins. No paid service is required by this implementation, but free-tier provider limits can change.
