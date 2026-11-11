# UI audit

November 2026. Every page was screenshotted at 375, 768, 1280 and 1440px as Super Admin, Team Lead and Intern (228 page loads), against a local backend seeded with awkward data:

- names and positions over 40 characters
- a task with 10 assignees
- task titles over 100 characters
- an unbroken 140-character word in a message
- 120 users and 120 tasks

Each page was compared with its artboard in `docs/design/`.

As well as the screenshots, a script checked every page for:

- sideways scroll
- text cut off with no way to read it
- buttons clipped by their card or wrapping
- squashed avatars
- layout shift while loading
- the tab title

## Findings

### Layout

- [x] **User Management:** the actions column overflowed the card, cutting off Deactivate and hiding the Edit button on your own row. Row actions now sit in a "..." menu, as the design shows. Resend and Reactivate stay as visible buttons. Department and position share one column, so the table fits at 1280. On smaller screens it scrolls inside its card with the name column pinned.
- [x] **User Management:** long departments and positions wrapped into five-line rows. They now take one line each, with the full text on hover.
- [x] **Dashboard, "Your own tasks":** the status pill and title sat side by side, squeezing the title into a narrow column. The title is now first, with status, deadline and assignees underneath.
- [x] **Project detail:** the task list squeezed titles the same way. It uses the same layout, with priority included.
- [x] **Dashboard, overdue table:** a long assignee name and position wrapped into a tall cell. Both now take one line each.
- [x] **Dashboard, "Not checked in yet":** name and position competed on one line, leaving "Oluwaseyi...". Position now sits under the name.
- [x] **Learners table:** the Track column wrapped a word per line. It now has a sensible width and shows up to two lines.
- [x] **Task detail:** a long "Created by" value wrapped into a four-line right-aligned block. Labels now sit above values in that narrow column.
- [x] **Phones:** Team Directory, My learning, Tracks and Projects scrolled sideways at 375px with long names, by 140 to 277px. Grid items can now shrink below their content.
- [x] **Settings at 375px:** the profile details pushed past the screen. Labels and values now wrap.

### Cut-off text

- [x] **Truncated text:** 109 places truncated with no way to see the full text, including names, positions, titles, channel names and the top bar. Any text cut short with an ellipsis now shows in full on hover or keyboard focus, through one listener for the whole app. Places with room wrap instead: Settings, the people lists on the dashboard, and task titles in stacked rows.

### Loading

- [x] **Dashboard:** it jumped while loading, with layout shift up to 0.69. Each card loaded separately, and the unread-messages line arrived late. The dashboard now waits for all its cards behind a skeleton shaped like the page, and the unread count starts from the summary. Shift is now 0.
- [x] **Daily Check-in:** the past check-ins dropped 580px when the form loaded. The form waits for its task list behind a placeholder of the same height.
- [x] **Every other page:** shift is under 0.04. Anything over 0.1 is noticeable.
- [x] **Moving between pages:** each page refetched from a blank skeleton. Main pages now show their last data at once and refresh in the background. This covers the dashboard, tasks, task detail, projects, project detail, directory, users, the calendar, check-ins, learning and messages. The cache is in memory only, and is emptied whenever the signed-in person changes.

### Feedback

- [x] **Status changes:** these waited for the server. Status on the task list and task detail now changes straight away and rolls back with a toast if the save fails.
- [x] **Other updates:** RSVP, marking a learning resource done and reading a conversation also update straight away, with the same rollback.
- [x] **Pressed states:** there was no pressed feedback. Buttons, chips, menu items and the bottom bar now respond on press, and cards that are links have a hover state. Reduced motion turns transitions and the press movement off.

### Consistency

- [x] **Tab titles:** they used "|", and detail pages only said "Task", "Project" or "Track". Every tab is now "Page · Brivent Workspace", and detail pages name what's open.
- [x] **Menus:** three different hand-made menus existed. There's now one shared `Menu`, keyboard-driven and fixed to the viewport so a table or card can't clip it. It's used for User Management row actions.

## Checked and fine

- **Avatars:** none squashed at any width.
- **Buttons:** none wrap or are clipped by their card.
- **Long unbroken text:** messages break it inside the bubble.
- **10 assignees:** these show as three faces and "+7", with every name on hover.
- **Long lists:** 120 users paginate at 50 per page, and 120 tasks page the same way.
- **States:** empty, loading, error and no-access are unchanged on every page.

## Not changed

- **User Management on phones:** the mobile artboard shows user cards. The table scrolls with the name pinned instead, which the brief allows. Cards would be a separate piece of work.
