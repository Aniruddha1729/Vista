# Vista deployment guide

Deployment target: Vercel for the React/Vite app, Render for the Express API, and MongoDB Atlas. Razorpay stays in Test Mode. Vista does not use Route or automatic transfers; organiser withdrawals remain ledger-recorded requests.

## 1. MongoDB Atlas

1. Create an Atlas project and a MongoDB deployment in a region near the Render service.
2. Create a database user with a strong generated password and `readWrite` access to the Vista database. URL-encode special characters in the password when placing it in the URI.
3. In Network Access, allow the Render service's outbound IP addresses. If your Render plan does not provide stable outbound IPs, use an appropriate Atlas network connectivity option for that plan and restrict access as tightly as possible; avoid leaving the database open to every IP.
4. Copy the Atlas connection string and set the database name to `vista` (or another chosen database name). This is `MONGODB_URI`.

## 2. Deploy the API to Render

Connect this repository to Render and create a Blueprint from the root `render.yaml`. The service uses `server` as its root directory, runs the TypeScript build, starts the compiled server, and checks `/api/health`.

The Blueprint uses a Starter web service. Profile images are uploaded directly from the API to Cloudinary, so they do not depend on Render's temporary filesystem or a persistent disk. Create a Cloudinary account, then copy the cloud name, API key, and API secret from its Dashboard into the Render environment. Vista signs uploads on the server and stores the returned secure image URL in the user profile.

Set these values in the Render service environment. Render supplies `PORT` automatically.

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Atlas connection string |
| `CLIENT_URL` | Frontend origin(s), comma-separated, with no paths; set the final Vercel origin after frontend deployment |
| `JWT_ACCESS_SECRET` | Long random secret, different from refresh secret |
| `JWT_REFRESH_SECRET` | Separate long random secret |
| `QR_SIGNING_SECRET` | Long random secret |
| `BANK_DETAILS_ENCRYPTION_KEY` | Exactly 64 hexadecimal characters (32 random bytes) |
| `BREVO_API_KEY` | Brevo API key |
| `BREVO_SENDER_EMAIL` | Verified sender address in Brevo |
| `BREVO_SENDER_NAME` | `Vista Events` or your chosen sender name |
| `REPORT_ISSUE_TO_EMAIL` | Issue report recipient address |
| `GEMINI_API_KEY` | Gemini API key used by Vee |
| `GEMINI_MODEL` | Model enabled for your Gemini key; defaults to `gemini-3.8-flash` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `RAZORPAY_KEY_ID` | Razorpay **test** key ID beginning with `rzp_test_` |
| `RAZORPAY_KEY_SECRET` | Matching Razorpay test key secret |
| `RAZORPAY_WEBHOOK_SECRET` | A strong webhook secret you choose in Razorpay and enter here |
| `PLATFORM_FEE_BPS` | `300` (3%) |
| `PORT` | Leave to Render |

Generate each app secret locally with a password manager or Node's crypto module. For the bank key, for example, run `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and copy the result directly into Render. Never commit secret values.

Keep the Razorpay account in Test Mode, use only `rzp_test_` credentials, and do not enter live credentials. Razorpay Route activation and transfers are intentionally not part of this deployment.

## 3. Deploy the frontend to Vercel

Import the repository into Vercel and set the project Root Directory to `Vista`. Vercel detects Vite; the build command is `npm run build`, and the output directory is `dist`. `Vista/vercel.json` sends deep links back to the SPA entry point so routes such as `/events/<id>` work on refresh.

Set this Vercel environment variable for Preview and Production:

| Variable | Value |
|---|---|
| `VITE_API_URL` | Render API origin, such as `https://vista-api.onrender.com` (no trailing slash and no `/api`) |

Vite publishes `VITE_*` values into browser code. Only put the public API origin there, never secrets.

## 4. Finish CORS and deploy order

Recommended order: create Atlas and allow the API network; deploy the Render API with a temporary valid `CLIENT_URL` origin; deploy Vercel with `VITE_API_URL` set to the Render origin; then replace Render's `CLIENT_URL` with the final Vercel production origin and any explicitly trusted preview origins, separated by commas, and redeploy/restart the API. CORS compares exact origins (scheme, host, and port), and cookies are enabled for approved origins.

In production, the refresh cookie is `httpOnly`, `secure`, and `SameSite=None` for the cross-site Vercel/Render setup. The browser requests include credentials. Render's proxy is trusted so HTTPS is detected correctly.

## 5. Razorpay webhook

In the Razorpay Dashboard, switch to **Test Mode**, open Webhooks, and add this URL after Render is deployed:

`https://<your-render-service>.onrender.com/api/webhooks/razorpay`

Choose the payment and refund events Vista handles, including `payment.captured`, `refund.created`, `refund.processed`, and `refund.failed`. Do not enable live mode, Route, transfers, or payout integration. Set the same webhook secret in Render as `RAZORPAY_WEBHOOK_SECRET`. The server verifies the signature against the raw request bytes; repeated event deliveries are safe because ledger entries are unique by Razorpay ID and entry type.

## 6. Smoke checks

Replace the host below with your Render service origin:

```sh
curl.exe -i https://<your-render-service>.onrender.com/api/health
```

Expect HTTP 200 and JSON with `status: "ok"` and `database.connected: true`. A disconnected database reports HTTP 503.

The route should exist and reject an unsigned payload with HTTP 400 (it must not return 404):

```sh
curl.exe -i -X POST https://<your-render-service>.onrender.com/api/webhooks/razorpay -H "Content-Type: application/json" --data "{}"
```

Then check:

- Open the Vercel home page and refresh a deep link such as `/events/<event-id>`.
- Confirm signup/login, refresh-cookie renewal, email verification, and logout.
- Confirm event lists/details load from the deployed API and owner-only event editing still works.
- In Razorpay Test Mode, complete a test payment and verify the payment and gateway fee ledger entries from the signed webhook.
- Verify the Withdraw page reports ledger totals; withdrawals remain requests recorded in Vista and do not transfer money automatically.
- Confirm Vee responds through Gemini; event email, invitations, Cloudinary profile image uploads, and notifications work using their configured service credentials.

## Local setup

Copy `Vista/.env.example` to `Vista/.env` and set `VITE_API_URL=http://localhost:4000`. Copy `server/.env.example` to `server/.env` and fill in local values. Start the API from `server` with `npm run dev` and the frontend from `Vista` with `npm run dev`. The server validates required settings at startup and rejects non-test Razorpay key IDs.
