# Brivent Workspace

> **Internal work management and collaboration platform for Brivent Global Innovations Limited.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-6.1-646cff.svg)](https://vitejs.dev/)

---

## 1. Product Principle

> **"Every person should know what to do, every task should have an owner, every important decision should be traceable, and every resource should have controlled access."**

Brivent Workspace unifies daily task management, team routine coordination (9 AM–5 PM West Africa Time), project tracking, internal communication, institutional SOPs & documents, and administrative access control.

---

## 2. Key Screen Deliverables

The application is fully interactive and incorporates realistic operational data for **Engineering, Operations, Management, Finance, Sales, and Customer Support**:

1. **Sign-In & Invitation Acceptance (`/invite`)**:
   - Branded sign-in portal with quick demo persona logins.
   - 48-hour secure invitation token acceptance workflow with password initialization and Code of Conduct compliance agreement.
2. **Main Dashboard**:
   - Role-adaptive welcome header with local West Africa Time (WAT) awareness.
   - Priority Metrics: Tasks Due Today, High-Priority Tasks, Active Blockers, and Awaiting Review.
   - Today's assigned tasks quick view and project milestone progress.
   - Company & department announcements with formal acknowledgment tracking.
3. **Work Management & Tasks (`/tasks`)**:
   - **Kanban Board** & **List View** with column status workflows (`Backlog`, `To Do`, `In Progress`, `Blocked`, `In Review`, `Completed`).
   - Quick filters: My Assigned Tasks, All Tasks, Department Tasks, Awaiting Review, Blocked.
   - Search by title, description, or teammate name.
4. **Task Detail Drawer**:
   - Slide-over drawer with status progression controls.
   - **Enforced Workflow Approval**: Tasks requiring review cannot be marked completed without designated reviewer or lead authorization.
   - **Blocker Declaration Modal**: Mandatory blocker explanation when flagging an item as `BLOCKED`.
   - Subtasks checklist with real-time percentage progress bar.
   - Linked GitHub Pull Request integration preview.
   - Real-time discussion comments stream with author roles and timestamps.
   - Activity audit trail logging every state transition and reassignment.
5. **Projects & Initiatives (`/projects`)**:
   - Project cards with visibility indicators (`ORGANIZATION`, `DEPARTMENT`, `PRIVATE / CONFIDENTIAL`).
   - Milestone checklist, team contributors roster, and linked GitHub repositories.
   - Project creation modal.
6. **Internal Messages (`/messages`)**:
   - Department channels (`#general-announcements`, `#engineering`, `#operations-coordination`).
   - 1-on-1 Direct Messages with team leads and peers.
   - Interactive message composer with timestamping.
7. **Company Knowledge & SOPs (`/docs`)**:
   - Categorized document repository: Policies, SOPs, Engineering Specs, Finance & Treasury.
   - **Access-Controlled Reader**: Interns and unauthorized roles are strictly locked out of confidential executive compensation and audit records.
   - Compliance acknowledgment action logging to the audit trail.
8. **Team Directory (`/directory`)**:
   - Comprehensive member directory across all departments.
   - Employee profile drawer displaying reporting managers, work email, working hours schedule, and privacy notices.
9. **Daily 9 AM–5 PM Routine & Check-ins (`/daily`)**:
   - 3-step workday routine guide (Start of day standup $\to$ Midday execution $\to$ End of day signoff).
   - Interactive standup submission form: Today's planned tasks, yesterday's completed work, blockers, and assistance requests.
   - Feed of submitted daily check-ins across the team.
10. **Administration & Security Audit (`/admin`)**:
    - Member management table with role and status indicators.
    - Token-based user invitation generator (48h expiry).
    - **Instant Session Revocation**: Immediate kill switch for active session JWTs and refresh tokens.
    - **Comprehensive Offboarding Modal**: Step-by-step checklist to revoke external access across GitHub, Google Workspace, Providus Bank, and WhatsApp groups.
    - Role-Based Access Control (RBAC) governance matrix.
    - Immutable security audit log viewer recording actors, IP addresses, targets, and timestamps.
11. **Settings & WhatsApp Integration (`/settings`)**:
    - In-app notification triggers (assignments, review requests, deadlines, mentions).
    - WhatsApp Business Cloud API integration card with phone binding and quiet hours configuration.
    - *Clearly marked as pending backend Phase 3 deployment with approved Meta template preview.*

---

## 3. Live Role Switcher (Demo Feature)

To test how Brivent Workspace dynamically adapts UI and RBAC visibility according to each user's privilege, use the top banner to toggle between demo personas:

| Persona | Name | Role | Department | Key Differences |
|---|---|---|---|---|
| **Super Admin** | Dr. Babatunde Brivent | `SUPER_ADMIN` | Executive | Access to Admin Portal, Audit Logs, Session Kills, Confidential Docs |
| **Engineering Lead** | Emeka Okonkwo | `DEPARTMENT_LEAD` | Engineering | Task creation, PR approvals, milestone oversight |
| **Senior Frontend Dev** | Aisha Bello | `TEAM_MEMBER` | Engineering | Task execution, submitting for review, commenting |
| **Intern (Restricted)** | Samuel Kalu | `INTERN` | Engineering | **Locked out of Admin, cannot create tasks, locked out of confidential docs** |
| **Operations Lead** | Ibrahim Musa | `OPERATIONS` | Operations | User invitation permissions, onboarding & offboarding coordination |
| **Finance Lead** | Ngozi Eze | `FINANCE` | Finance | Authorized access to Confidential Financial & Treasury documents |

---

## 4. Getting Started

### Prerequisites
- Node.js 18+ (tested on Node v24)
- npm 10+

### Development Server
```bash
# Install dependencies (already completed)
npm install

# Start local Vite development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build
```bash
# Compile TypeScript and bundle assets
npm run build

# Preview production build locally
npm run preview
```

---

## 5. Architecture & Code Structure

```
src/
├── components/
│   ├── layout/            # Shell, TopNavbar, Sidebar, RoleSwitcherBanner, GlobalSearchModal
│   ├── tasks/             # TaskKanbanBoard, TaskListView, TaskDetailDrawer, TaskCreateModal, BlockerModal, Badges
│   └── ui/                # Accessible primitives (Button, Modal, Drawer, Card, Badge, Input, Select, EmptyState)
├── context/
│   └── WorkspaceContext.tsx # Centralized React state, active user, toast alerts, global search
├── data/
│   └── mockData.ts        # Comprehensive Nigerian & international enterprise dataset
├── services/
│   └── workspaceService.ts # Decoupled service layer persisting state with localStorage & validation
├── types/
│   └── index.ts           # Unified TypeScript definitions (User, Task, Project, Document, AuditLog, etc.)
├── views/                 # Top-level screen views (Dashboard, Tasks, Projects, Admin, Settings, etc.)
├── App.tsx
├── main.tsx
└── index.css              # Custom Tailwind utilities & scrollbar styling
```

---

## 6. Security Principles

1. **Backend First:** Frontend checks enhance UX and role awareness. Real security must always be enforced at the API route, server action, and database authorization layers.
2. **Least Privilege:** Intern and trainee roles cannot create tasks, access confidential documents, or review code approvals.
3. **Offboarding Completeness:** Disabling a workspace user account does not automatically revoke external third-party access; an explicit checklist enforces revoking GitHub, Google Workspace, and WhatsApp access.

