# End-to-end checks

Drives the app in a real browser as a Super Admin, a Team Lead and an Intern.

## Setup

```bash
pip install playwright
playwright install chromium
```

Each account must already exist, have changed its temporary password, and hold its usual role.

## Run

Start the app with `npm run dev`, then:

```bash
export E2E_SUPER_ADMIN_EMAIL=... E2E_SUPER_ADMIN_PASSWORD=...
export E2E_TEAM_LEAD_EMAIL=...   E2E_TEAM_LEAD_PASSWORD=...
export E2E_INTERN_EMAIL=...      E2E_INTERN_PASSWORD=...
npm run e2e
```

Never commit these values.

| Variable | Default | Meaning |
|---|---|---|
| `E2E_APP_URL` | `http://localhost:3000` | The app under test |
| `E2E_API_URL` | The value in `.env.local` | The API, used to look up names and clean up |
| `E2E_CHROMIUM` | Playwright's own | Path to a Chromium binary |
| `E2E_DESTRUCTIVE` | Off | Set to `1` to run steps that leave a trace |

## What it changes

Every task it creates has a title starting `[e2e]`, and they're all deleted when the run ends, even after a failure.

Logging out ends every session on all devices. Each account used here is signed out everywhere, so use dedicated test accounts rather than your own.

`E2E_DESTRUCTIVE=1` also adds a user and resets their password. **Users can't be deleted**, so don't use it against production.
