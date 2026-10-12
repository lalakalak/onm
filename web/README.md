# O&M Shift Manager — JSON-only, role-based login

## Run locally
1. Install Node.js (18+ recommended).
2. Run `npm install`.
3. Run `npm run dev` and open the Vite localhost URL in Chrome or Edge.
4. Open an existing O&M Shift Manager JSON file or create one.
5. Sign in with one of the initial accounts below.

## Initial accounts
- Admin: `admin` / `admin123`
- Roster-only viewer: `viewer` / `viewer123`

After signing in as admin, use **User Management** to create named accounts with the Administrator or Roster viewer role. User accounts and password hashes are stored in the connected JSON file. Passwords are SHA-256 hashed, not stored as plain text.

## Roles
- **Administrator:** can access all pages, change roster plans, manage employees and leave, swap one-day shifts, manage accounts, and import/export JSON.
- **Roster viewer:** can access only Monthly Roster in read-only mode. They can choose the displayed month and download the roster image or formatted Excel workbook, but cannot edit assignments or access other pages.

## Data storage and security note
All app data is saved in the selected JSON file; the app does not use localStorage or IndexedDB. After a browser refresh, reconnect the same JSON file and sign in again. This is a local, client-side role gate. It is not a substitute for server-side authentication in a multi-user or internet-facing deployment; anyone with direct access to the JSON file can alter it.
