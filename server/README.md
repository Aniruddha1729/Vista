# Vista API

This is a small Express API. Start here when following a request:

1. `src/server.ts` loads environment settings, connects to MongoDB, and starts the server.
2. `src/app.ts` installs middleware and mounts the API routes.
3. Each route sends the request to a controller, which validates input and uses the Mongoose models.

Invitations stay `pending` until the recipient accepts. The API saves a hash of a random invite link, sends the chosen email design through Brevo, and checks that the signed-in account uses the invited email before reserving a place and creating a ticket.

Team registration follows the same clear sequence: the leader chooses a team size allowed by the event, enters a team name, and sends an email request to each teammate. Every teammate signs in (or creates and verifies an account) using the invited email, then accepts their individual link within 48 hours. Until everyone accepts, no seats are held. Once the full team accepts, one atomic event update reserves the entire team size; then each person receives their own registration and QR ticket. If enough seats are no longer available, the team remains unconfirmed and the leader sees that status in My events.

Hosts choose registration limits from fixed options in the event editor: individual only, teams of 2, or ranges such as 2–3. Both the editor and API enforce those limits, and team members are represented as individual attendees for check-in and tickets.

Email code lives in `src/services/email.ts`; the four inline-CSS invite designs are in `src/services/invite-template.ts`. Set `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, and `BREVO_SENDER_NAME` in the local `.env` to send messages. The sender address must be enabled in Brevo.

Vee uses Gemini through the server-side `GEMINI_API_KEY`. `GEMINI_MODEL` defaults to `gemini-3.5-flash-lite` and `GEMINI_FALLBACK_MODEL` defaults to `gemini-3.8-flash`; both model values are configurable through environment variables. Add the Gemini API key to `server/.env`; it is never sent to the browser. Vee receives a small, validated recent chat history and the current page route, plus Vista feature context and instructions not to claim it performed account actions. The primary model retries 429, 503, and timeouts twice with 1s and 3s backoff and a 30-second timeout per attempt. A primary 404 skips directly to one fallback attempt; other primary failures also proceed to one fallback attempt except 400, 401, and 403, which stop immediately.

Profile images are uploaded from memory to Cloudinary using `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`; only the resulting secure image URL is stored in the user record. Render does not need a persistent disk for avatar uploads.

## Payments and organiser ledger

Paid event amounts and all accounting entries use integer paise. Razorpay orders are created by `src/controllers/payment.controller.ts`; `src/controllers/razorpay-webhook.controller.ts` receives signed callbacks at `POST /api/webhooks/razorpay`. Configure `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and the webhook signing secret in `.env`. Subscribe the Razorpay webhook to `payment.captured`, `refund.created`, `refund.processed`, `refund.failed`, and the relevant payout/transfer status events. The webhook signature is checked against the original raw request body. Each provider event is deduplicated using the unique `(razorpayId, type)` ledger index.

Organiser earnings are calculated from `LedgerEntry`; there is no persisted balance field. Vista applies a 3% platform fee. The event organiser chooses whether the applicant pays that fee at checkout or it is deducted from organiser earnings. Razorpay gateway fee and tax are read from the payment record; an unknown fee blocks withdrawals until it can be reconciled. Requests are idempotent and serialized per event while the ledger balance is checked. Razorpay Route is not enabled in Vista yet: withdrawal requests are recorded, but bank transfers and held transfers are not sent until Route is activated and linked-account onboarding is implemented.

Copy `.env.example` to `.env` and set local values before starting the API. The `.env` file is ignored by Git. New accounts must verify their email through Brevo before they can sign in. If a verification email does not arrive, use the resend form at `/verify-email`.

Run `npm install` in this folder, then `npm run dev`. The health check is available at `http://localhost:4000/api/health`. Run `npm run build` to compile TypeScript before using `npm start`.

To add the sample events, demo organizer, and one confirmed sample registration to the configured database, run `npm run seed`. The demo account is `demo@vista.test` / `VistaDemo2026!` (username: `vistademo`). The seed is safe to run again; it updates these named sample records.
