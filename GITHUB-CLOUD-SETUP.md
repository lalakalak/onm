# GitHub cloud roster setup

The React app now has a **Connect shared GitHub roster** option. It reads from:
`https://onm-roster-api.abhikath08.workers.dev/roster`

When connected, log in to the app using the admin account stored in the roster JSON. Before making edits, use **Enable cloud saving** and enter the `ADMIN_PASSWORD` value configured as a Cloudflare Worker secret. The password is held in memory for the current session and is not written into the app files.

## Important: upload a real app data file first

The current GitHub file shown in the setup screenshot contains only:
`{"name":"Abhishek"}`

That is a connectivity test, not an O&M Shift Manager data file. The app requires an object with `employees`, `roster`, and `leaves` arrays (and optionally `monthlyPlans` and `users`). Use **Export JSON** from the existing app, then commit that exported app data as `onm.json` in the root of `lalakalak/Onmjson` on branch `main`.

## Worker configuration

- `GH_TOKEN`: Cloudflare Worker secret with GitHub repository Contents read/write permission, scoped to `lalakalak/Onmjson`.
- `ADMIN_PASSWORD`: Cloudflare Worker secret for the admin write endpoint.
- Public GET endpoint: `/roster`
- Authenticated PUT endpoint: `/roster`, header `X-Admin-Password`

Never place the GitHub token in React code, Android source, or an APK. The shared password scheme is a simple initial setup; use stronger per-user server-side authentication before broad distribution.

## Build

From `OM-Shift-Manager-Android/web`, run `npm install` then `npm run build`. The Android project can then be built using the included instructions. Build verification was not possible in the current environment because dependencies were not installed.
