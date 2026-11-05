# Brivent Workspace

> **Internal work management and collaboration platform for Brivent Global Innovations Limited.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-6.1-646cff.svg)](https://vitejs.dev/)

---

## 1. Product Principle

> **"Every person should know what to do, every task should have an owner, every important decision should be traceable, and every resource should have controlled access."**

Brivent Workspace is the company's internal operating system for projects, tasks and daily work updates.

---

## 2. What Works Today

Everything below runs against the real backend, [brivent-workspace-backend](https://github.com/Briventco/brivent-workspace-backend).

- **Sign-in** with validation and clear error messages.
- **Forced password change**: anyone on a temporary password can't reach the app until they replace it.
- **Sessions**: the user and their permissions load from the backend on start. A 401 clears the session and returns to login.
- **Permissions**: routes and actions are gated on the backend's permission list, never on role names.
- **User management** (`users.view_all`): user table, add user, edit name and role, deactivate and reactivate.
- **Profile**: account details, change password, sign out.

Dashboard, daily check-in, tasks, projects, messages, calendar, documents, directory, notifications and settings are in the app as **Coming soon** pages until the backend supports them.

---

## 3. Getting Started

### Prerequisites
- Node.js 18+
- The backend running locally (see its README)

### Development
```bash
npm install
cp .env.example .env.local   # then set VITE_API_BASE_URL
npm run dev
```
Open [http://localhost:3000](http://localhost:3000). The backend must list this origin in `CORS_ORIGIN`.

`VITE_API_BASE_URL` must include the `/api` prefix, for example `http://localhost:4000/api`.

### Production Build
```bash
npm run build
npm run preview
```
This is a single-page app with real URLs, so the host must serve `index.html` for unknown paths.

---

## 4. Code Structure

```
src/
├── api/
│   ├── client.ts      # Base URL, auth token, error handling, 401 handling
│   ├── mappers.ts     # The only place that knows the backend's user shape
│   ├── auth.ts        # login, /me, change password
│   ├── users.ts       # User management calls
│   └── types.ts       # User, Role, Session
├── components/
│   ├── auth/          # Auth page layout, password change form
│   ├── layout/        # AppShell, Sidebar, TopNavbar
│   ├── ui/            # Button, Input, Modal, AsyncState, ComingSoon and other primitives
│   └── users/         # Add and edit user dialogs
├── context/           # AuthContext (session), ToastContext
├── lib/               # Router, useApiQuery, permission names, validation
├── views/             # One file per page
├── routes.tsx         # Path, page title and required permission for every page
└── App.tsx            # Session states and redirects
```

To add a page: create the view, add it to `routes.tsx`, and add it to the nav in `Sidebar.tsx`. Fetch data with `useApiQuery` and render it through `AsyncState`, which gives you loading, error, 403 and empty states.

---

## 5. Security Principles

1. **Backend First:** Frontend checks enhance UX and role awareness. Real security must always be enforced at the API route, server action, and database authorization layers.
2. **Least Privilege:** The UI shows what the backend's permission list allows and nothing more.
3. **Offboarding Completeness:** Deactivating a workspace account does not revoke third-party access. GitHub, Google Workspace and WhatsApp access must be removed separately.

