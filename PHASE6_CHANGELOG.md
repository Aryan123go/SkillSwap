# SkillSwap Phase 6 — Chat fixes, reviews, and reputation

## Included in this update

### Chat and session stability
- Unread-message tracking and message previews update from incoming messages.
- The navigation header displays an unread message count.
- Session rendering has additional defensive handling and an app-level React error boundary.

### Reviews and reputation
- Added a `Review` model with a unique `(session, reviewer)` constraint, 1–5 integer ratings, and optional feedback.
- Students can review only sessions they participated in after those sessions are marked `COMPLETED`.
- A student can review the other participant once per completed session; self-reviews and reviews of unrelated sessions are rejected.
- Added `GET /api/reviews/eligible` for completed sessions the current student has not reviewed.
- Added `POST /api/reviews` to submit a review.
- Added `GET /api/reviews/user/:userId` to retrieve a student's average rating, review count, and up to 50 recent reviews.
- Added a Reviews page and navigation link, plus a reputation summary and review list on student profiles.
- Ratings are derived from submitted reviews; there is no paid API or payment flow.
- Reputation aggregates exclude invalid ratings and reviews whose sessions are missing, incomplete, or do not contain both review participants.
- Session detail rendering handles invalid stored dates and missing populated participants without taking down the route. Review API failures are shown as errors rather than empty histories.

## Files added
- `client/src/ReviewsPage.jsx`
- `server/src/models/Review.js`
- `server/src/controllers/review.controller.js`
- `server/src/routes/review.routes.js`
- `server/src/services/review.service.js`
- `server/src/validators/review.validator.js`
- `server/test/review.validator.test.js`
- `server/test/review.service.test.js`

## API
- `GET /api/reviews/eligible` — authenticated student only.
- `POST /api/reviews` — body: `{ "sessionId": "...", "rating": 1, "comment": "..." }`; rating must be an integer from 1 through 5.
- `GET /api/reviews/user/:userId` — authenticated; returns `{ reputation: { averageRating, reviewCount }, reviews }`.

## Test locally
Run these from the repository root:

```bash
npm install
npm run lint
npm run build
npm test --workspace server
```

Also test with two student accounts: complete a session, submit one review from each account, confirm duplicate reviews are rejected, and verify the profile's average/count/review list updates. This ZIP was not tested against a live MongoDB instance or live browser session in this environment.
