# Cloudflare Worker update (required for mobile API + account-based cloud writes)

This Worker serves the public roster, handles CORS preflight requests from Android WebView, authenticates administrator sign-in, and accepts writes using a signed 30-day admin session token.

## Deploy
1. Open the existing `onm-roster-api` Worker in Cloudflare Dashboard.
2. Replace its Worker code with `worker.js` from this folder and deploy.
3. In **Settings → Variables and Secrets**, keep the existing `GH_TOKEN` secret (fine-grained token with Contents read/write access only to `lalakalak/Onmjson`).
4. Add a new secret named `AUTH_SECRET` with a long random value (at least 32 random characters). Do not put this value in React or Android source.
5. Confirm `https://onm-roster-api.abhikath08.workers.dev/roster` returns valid app JSON.

The Worker uses `lalakalak/Onmjson`, branch `main`, file `onm.json`. The JSON must include `employees`, `roster`, and `leaves` arrays. Admin accounts in `users` must use the app's SHA-256 `passwordHash` format and `role: "admin"`.

## Behavior
- `GET /roster`: public read with CORS headers.
- `POST /auth/login`: verifies an admin username/password against the user record and returns a signed token valid for 30 days.
- `PUT /roster`: requires `Authorization: Bearer <token>`; viewers cannot obtain an admin token.
- The React app stores the token/session in browser storage for this device. It stores no plaintext password. Log out removes the saved session.

This remains a lightweight app-level auth model. For sensitive production data, move authentication to a proper identity provider and use salted password hashing server-side.
