# GitHub cloud roster setup

The app reads shared data from `https://onm-roster-api.abhikath08.workers.dev/roster`.

## Cloudflare Worker update required
Use `cloudflare-worker/worker.js` and follow `cloudflare-worker/README.md`. Keep `GH_TOKEN` as a Cloudflare secret and add `AUTH_SECRET` as a separate long random Cloudflare secret. Do not place either secret in the React app or APK.

## GitHub JSON
The file `lalakalak/Onmjson`, branch `main`, root file `onm.json` must contain valid app data: `employees`, `roster`, and `leaves` arrays, plus `monthlyPlans` and `users` as needed. The test-only JSON `{"name":"Abhishek"}` is not valid app data.

## New behavior
- Android WebView DOM storage is enabled so login/session storage works.
- The app calls the Worker with CORS/preflight support.
- Admin login obtains a signed 30-day token from `/auth/login`; cloud saving is enabled automatically for that signed-in admin. There is no separate “Enable cloud saving” button.
- Login session is remembered on the same device until it expires or the user logs out. A password is not stored in browser storage.
- Viewers remain read-only.

After deploying the Worker update, build and install the updated APK once. Future React changes still require a new APK until the app is switched to hosted React.
