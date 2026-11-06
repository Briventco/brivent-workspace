"""Browser checks for tasks, directory, settings and permissions. See e2e/README.md."""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

REPO = Path(__file__).resolve().parent.parent
APP = os.environ.get("E2E_APP_URL", "http://localhost:3000").rstrip("/")
RUN = str(int(time.time()))[-6:]
PREFIX = f"[e2e] {RUN}"
DESTRUCTIVE = os.environ.get("E2E_DESTRUCTIVE") == "1"
# The backend's console output. Outside production it prints emails there instead of sending them.
BACKEND_LOG = os.environ.get("E2E_BACKEND_LOG")
GREETING = re.compile("^Good (morning|afternoon|evening)")
PASSWORD = "e2e-brand-new-passphrase"
SECOND_PASSWORD = "e2e-another-new-passphrase"
MOBILE = {"width": 375, "height": 720}
LAPTOP = {"width": 1366, "height": 800}
WIDE = {"width": 1440, "height": 900}
NARROW = {"width": 1100, "height": 800}
GALLERY = f"{APP}/design-system"
# Pages built from this list; each must load at phone width without sideways scrolling.
PAGES = ["/", "/tasks", "/messages", "/learning", "/directory", "/settings"]

results = []
console_problems = []


def api_url():
    url = os.environ.get("E2E_API_URL")
    if not url:
        env = (REPO / ".env.local").read_text()
        url = re.search(r"^VITE_API_BASE_URL=(.+)$", env, re.M).group(1)
    return url.strip().rstrip("/")


def credentials(role):
    try:
        return os.environ[f"E2E_{role}_EMAIL"], os.environ[f"E2E_{role}_PASSWORD"]
    except KeyError as missing:
        sys.exit(f"Missing {missing.args[0]}. See e2e/README.md.")


def call(method, path, token=None, body=None):
    request = urllib.request.Request(
        api_url() + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "Content-Type": "application/json",
            **({"Authorization": f"Bearer {token}"} if token else {}),
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        raw = response.read()
    return json.loads(raw) if raw else None


def step(name, action):
    try:
        action()
        results.append((True, name))
        print(f"PASS {name}", flush=True)
    except Exception as error:  # Keep going, so one run reports every failure.
        results.append((False, name))
        print(f"FAIL {name}\n     {str(error)[:300]}", flush=True)


def emailed_link(address, path):
    """The newest link printed for this address. Emails can land just after the response."""
    pattern = re.compile(rf"https?://\S+{path}\?token=\S+")
    for _ in range(50):
        emails = Path(BACKEND_LOG).read_text().split("[email not sent] To: ")
        links = [link for email in emails if email.startswith(address) for link in pattern.findall(email)]
        if links:
            return links[-1]
        time.sleep(0.1)
    raise AssertionError(f"No {path} link was printed for {address}")


def new_page(browser, viewport=LAPTOP):
    page = browser.new_context(viewport=viewport).new_page()

    def record(message):
        # A rejected request logs a browser line we can't suppress. It isn't an app error.
        if message.type in ("error", "warning") and "Failed to load resource" not in message.text:
            console_problems.append(f"{message.type}: {message.text[:200]} @ {page.url}")

    page.on("console", record)
    page.on("pageerror", lambda error: console_problems.append(f"pageerror: {error}"))
    return page


def log_in(page, role):
    log_in_as(page, *credentials(role))


def log_in_as(page, email, password):
    page.goto(f"{APP}/login")
    page.get_by_label("Work email").fill(email)
    page.get_by_label("Password", exact=True).fill(password)
    page.get_by_role("button", name="Sign in").click()
    expect(page.get_by_role("heading", name=GREETING)).to_be_visible(timeout=45_000)


def open_nav_link(page, name):
    page.get_by_role("navigation", name="Main").get_by_role("link", name=re.compile(name)).click()


def pick_assignee(dialog, name, label="Assignee"):
    picker = dialog.get_by_role("combobox", name=label)
    picker.click()
    picker.fill(name.split()[0])
    dialog.get_by_role("option", name=re.compile(re.escape(name))).click()
    picker.press("Escape")


def create_task(page, title, assignee=None):
    page.get_by_role("button", name="New task").click()
    dialog = page.get_by_role("dialog")
    dialog.get_by_label("Title").fill(title)
    dialog.get_by_label("Description").fill("Created by the e2e script.")
    dialog.get_by_label("Priority").select_option("HIGH")
    if assignee:
        pick_assignee(dialog, assignee)
    dialog.get_by_role("button", name="Create task").click()
    expect(page.get_by_role("heading", name=title)).to_be_visible()


def fill_passwords(page, password, confirm=None):
    page.get_by_label("New password", exact=True).fill(password)
    page.get_by_label("Confirm new password").fill(confirm or password)


def has_projects(token):
    try:
        return "projects" in call("GET", "/projects?limit=1", token)
    except urllib.error.HTTPError:
        return False


def is_weekend():
    return datetime.now(timezone(timedelta(hours=1))).weekday() >= 5


def expect_url_is(page, path):
    """The whole address, so a surviving token or a redirect both fail."""
    expect(page).to_have_url(f"{APP}{path}")


def invite(admin, name, email):
    admin.goto(f"{APP}/users")
    admin.get_by_role("button", name="Invite user").click()
    dialog = admin.get_by_role("dialog")
    dialog.get_by_label("Full name").fill(name)
    dialog.get_by_label("Work email").fill(email)
    dialog.get_by_role("button", name="Send invite").click()
    dialog.get_by_role("button", name="Done").click()


def call_wat_date():
    now = datetime.now(timezone(timedelta(hours=1)))
    return f"{now:%A}, {now.day} {now:%B}"


def expect_no_sideways_scroll(page, label):
    fits = page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    assert fits, f"{label} scrolls sideways at 375px"


def check_mobile(browser, role):
    page = new_page(browser, MOBILE)
    log_in(page, role)
    for path in PAGES:
        page.goto(APP + path)
        page.get_by_role("heading", level=1).first.wait_for()
        expect_no_sideways_scroll(page, path)
    page.context.close()


def clean_up(admin_token):
    removed = 0
    for path in ("/tasks?limit=100", "/tasks?limit=100&page=2"):
        for task in call("GET", path, admin_token)["tasks"]:
            if task["title"].startswith(PREFIX):
                call("DELETE", f"/tasks/{task['id']}", admin_token)
                removed += 1
    return removed


def main():
    admin_email, admin_password = credentials("SUPER_ADMIN")
    lead_email, lead_password = credentials("TEAM_LEAD")
    intern_email, intern_password = credentials("INTERN")

    admin_token = call("POST", "/auth/login", body={"email": admin_email, "password": admin_password})["token"]
    lead = call("POST", "/auth/login", body={"email": lead_email, "password": lead_password})["user"]
    intern = call("POST", "/auth/login", body={"email": intern_email, "password": intern_password})["user"]
    lead_name, intern_name = lead["name"], intern["name"]

    admin_task = f"{PREFIX} admin"
    lead_task = f"{PREFIX} lead assigns intern"
    throwaway_task = f"{PREFIX} delete me"

    with sync_playwright() as playwright:
        executable = os.environ.get("E2E_CHROMIUM")
        browser = playwright.chromium.launch(executable_path=executable or None)
        page = new_page(browser)
        try:
            run_foundations(browser)
            run_public_pages(browser)
            run_shell(browser)
            run_dashboard(browser, admin_token)
            run_admin(browser, page, admin_task, throwaway_task, intern_name)
            if DESTRUCTIVE and BACKEND_LOG:
                run_invites(browser, page)
                if "checkedInToday" in call("GET", "/tasks/summary", admin_token)["summary"]:
                    run_checkins(browser, admin_token)
                if has_projects(admin_token):
                    run_projects(browser, admin_token)
                    run_meetings(browser, admin_token)
                    run_departments(browser, admin_token)
                    run_multi_assignee(browser, admin_token)
                    if "unreadMessages" in call("GET", "/tasks/summary", admin_token)["summary"]:
                        run_messages(browser, admin_token)
                    if "learning.view" in call("GET", "/me", admin_token)["user"]["permissions"]:
                        run_learning(browser, admin_token)
            run_team_lead(browser, lead_task, lead_name, intern_name)
            run_permissions(lead_email, lead_password)
            run_intern(browser, lead_task, admin_task)
            for role in ("SUPER_ADMIN", "TEAM_LEAD", "INTERN"):
                step(f"{role}: every page fits 375px", lambda: check_mobile(browser, role))
            step("logout returns to sign in and ends the session", lambda: check_logout(page))
        finally:
            browser.close()

    # Logout ended every session, so this needs a fresh token.
    token = call("POST", "/auth/login", body={"email": admin_email, "password": admin_password})["token"]
    print(f"\nCleaned up {clean_up(token)} e2e task(s).")

    if console_problems:
        print("\nConsole problems:", *console_problems, sep="\n  ")
    passed = sum(ok for ok, _ in results)
    print(f"\n{passed} passed, {len(results) - passed} failed, {len(console_problems)} console problem(s)")
    sys.exit(0 if passed == len(results) and not console_problems else 1)


def rgb(color):
    return "rgb({}, {}, {})".format(*(int(color[i:i + 2], 16) for i in (1, 3, 5)))


def open_gallery(browser, viewport=LAPTOP, **context):
    page = browser.new_context(viewport=viewport, **context).new_page()
    page.on("pageerror", lambda error: console_problems.append(f"pageerror: {error}"))
    page.goto(GALLERY)
    page.get_by_role("heading", name="Workspace design system").wait_for()
    return page


def run_foundations(browser):
    """Needs the dev server: the /design-system gallery isn't in production builds."""
    page = open_gallery(browser)

    def tokens():
        expected = json.loads((REPO / "src/assets/brivent/tokens/tokens.json").read_text())["light"]
        actual = page.evaluate(
            """names => {
                const style = getComputedStyle(document.documentElement);
                return names.map(name => style.getPropertyValue('--' + name).trim());
            }""",
            list(expected),
        )
        wrong = [
            name for name, value in zip(expected, actual)
            if value.lower() != str(expected[name]).lower()
        ]
        assert not wrong, f"tokens differ from the design: {wrong}"
    step("Foundations: every light token matches the design's tokens.json", tokens)

    def fonts_and_colours():
        body = page.evaluate(
            """() => {
                const style = getComputedStyle(document.body);
                return { font: style.fontFamily, color: style.color };
            }"""
        )
        assert body["font"].startswith('Inter'), body["font"]
        assert body["color"] == rgb("#0D0E2B"), body["color"]
        assert page.evaluate("document.fonts.ready.then(() => document.fonts.check('600 14px Inter'))")
        button = page.get_by_role("button", name="New task")
        expect(button).to_have_css("background-color", rgb("#152BF9"))
        expect(button).to_have_css("height", "36px")
    step("Foundations: Inter loads, and buttons use the brand colour at 36px", fonts_and_colours)

    def icons():
        blank = page.evaluate("[...document.querySelectorAll('.ms')].filter(i => !i.querySelector('svg')).length")
        total = page.evaluate("document.querySelectorAll('.ms svg').length")
        assert total > 20 and blank == 0, f"{total} icons, {blank} blank"
    step("Foundations: every icon resolves to a real SVG", icons)

    def focus_ring():
        page.get_by_role("button", name="Cancel").first.focus()
        page.keyboard.press("Tab")
        ring = page.evaluate("getComputedStyle(document.activeElement).boxShadow")
        assert rgb("#152BF9").replace("rgb", "") in ring.replace("rgb", ""), ring
    step("Foundations: keyboard focus shows the brand ring", focus_ring)

    def loading_button():
        expect(page.get_by_text("Sending invite")).to_be_visible()
        loading = page.locator('button[aria-busy="true"]')
        expect(loading).to_be_disabled()
    step("Button: loading shows a progress word and can't be pressed twice", loading_button)

    def reveal():
        field = page.get_by_label("Password", exact=True)
        expect(field).to_have_attribute("type", "password")
        page.get_by_role("button", name="Show characters").click()
        expect(field).to_have_attribute("type", "text")
        page.get_by_role("button", name="Hide characters").click()
        expect(field).to_have_attribute("type", "password")
        expect(page.get_by_text("Use at least 12 characters.")).to_be_visible()
    step("Input: password reveal and error message", reveal)

    def switch():
        toggle = page.get_by_role("switch", name="WhatsApp alerts")
        toggle.focus()
        page.keyboard.press("Space")
        expect(toggle).to_have_attribute("aria-checked", "false")
        page.keyboard.press("Enter")
        expect(toggle).to_have_attribute("aria-checked", "true")
        expect(page.get_by_role("switch", name="Email digest")).to_be_disabled()
    step("Switch: works by keyboard, and disabled stays disabled", switch)

    def tabs_and_chips():
        tabs = page.get_by_role("tablist", name="Task views")
        tabs.get_by_role("tab", name="My tasks").focus()
        page.keyboard.press("ArrowRight")
        expect(tabs.get_by_role("tab", name="Tasks I assigned")).to_be_focused()
        expect(tabs.get_by_role("tab", name="Tasks I assigned")).to_have_attribute("aria-selected", "true")
        page.keyboard.press("ArrowLeft")
        page.keyboard.press("ArrowLeft")
        expect(tabs.get_by_role("tab", name="All tasks")).to_have_attribute("aria-selected", "true")

        chip = page.get_by_role("button", name="Overdue")
        expect(chip).to_have_attribute("aria-pressed", "true")
        chip.click()
        expect(chip).to_have_attribute("aria-pressed", "false")

        view = page.get_by_role("group", name="View")
        view.get_by_role("button", name="Board").click()
        expect(view.get_by_role("button", name="Board")).to_have_attribute("aria-pressed", "true")
    step("Tabs, Chip, view switch: arrows wrap, and state is announced", tabs_and_chips)

    def table():
        row = page.get_by_role("row", name=re.compile("Design the Friday post"))
        row.focus()
        page.keyboard.press("Enter")
        expect(row).to_have_attribute("aria-selected", "true")
        expect(row).to_have_css("height", "56px")
        other = page.get_by_role("row", name=re.compile("Fix order sync delay"))
        other.click()
        expect(other).to_have_attribute("aria-selected", "true")
    step("Table: rows are 56px and open by click or Enter", table)

    def toasts():
        page.get_by_role("button", name="Show error toast").click()
        toast = page.get_by_role("alert").filter(has_text="Couldn't save your changes")
        expect(toast.get_by_text("Your text is still here.")).to_be_visible()
        toast.get_by_role("button", name="Try again").click()
        expect(page.get_by_role("status").filter(has_text="Saved")).to_be_visible()
        expect(toast).to_have_count(0)
        page.get_by_role("button", name="Show success toast").click()
        success = page.get_by_role("status").filter(has_text="Invite sent to Yusuf Garba")
        success.get_by_role("button", name="Dismiss notification").click()
        expect(success).to_have_count(0)
    step("Toast: description, action, dismiss", toasts)

    def modal():
        opener = page.get_by_role("button", name="Open modal")
        opener.click()
        dialog = page.get_by_role("dialog", name="Deactivate Emeka Obi?")
        expect(dialog.get_by_label("Reason")).to_be_focused()
        for _ in range(8):
            page.keyboard.press("Tab")
            assert page.evaluate("!!document.activeElement.closest('[role=dialog]')"), "focus left the modal"
        page.keyboard.press("Escape")
        expect(dialog).to_have_count(0)
        expect(opener).to_be_focused()
    step("Modal: focus moves in, stays in, Esc closes, focus returns", modal)
    page.context.close()

    def panel(viewport, scrim, width):
        view = open_gallery(browser, viewport)
        view.get_by_role("button", name="Open side panel").click()
        dialog = view.get_by_role("dialog", name="Task title sits here")
        expect(dialog).to_be_visible()
        box = dialog.bounding_box()
        assert round(box["width"]) == width, box
        expect(view.locator(".panel-scrim")).to_have_count(1 if scrim else 0)
        expect_no_sideways_scroll(view, "side panel")
        view.keyboard.press("Escape")
        expect(dialog).to_have_count(0)
        view.context.close()
    step("Side panel: 480px with no scrim at 1440", lambda: panel(WIDE, False, 480))
    step("Side panel: scrim under 1280", lambda: panel(NARROW, True, 480))
    step("Side panel: full screen at 375", lambda: panel(MOBILE, True, 375))

    def phone():
        view = open_gallery(browser, MOBILE)
        expect_no_sideways_scroll(view, "gallery")
        expect(view.get_by_role("button", name="New task")).to_have_css("height", "44px")
        expect(view.get_by_role("button", name="Save", exact=True)).to_have_css("height", "44px")
        view.get_by_role("button", name="Open modal").click()
        box = view.get_by_role("dialog").bounding_box()
        assert round(box["width"]) == 375 and round(box["height"]) == 720, box
        view.context.close()
    step("Phone: 44px buttons, no sideways scroll, full screen modal", phone)

    def skeleton():
        view = open_gallery(browser, reduced_motion="reduce")
        view.locator(".sk").first.wait_for()
        name = view.locator(".sk").first.evaluate("el => getComputedStyle(el).animationName")
        assert name == "none", name
        view.context.close()
    step("Skeleton: appears after the delay, shimmer off with reduced motion", skeleton)


def run_permissions(lead_email, lead_password):
    def server_refuses():
        session = call("POST", "/auth/login", body={"email": lead_email, "password": lead_password})
        assert "tasks.delete" not in session["user"]["permissions"]
        try:
            call("DELETE", "/tasks/00000000-0000-4000-8000-000000000000", session["token"])
        except urllib.error.HTTPError as error:
            assert error.code == 403, error.code
        else:
            raise AssertionError("delete was allowed")
    step("Team Lead: the API refuses delete too, matching the hidden button", server_refuses)


def run_admin(browser, page, title, throwaway, intern_name):
    def dashboard():
        log_in(page, "SUPER_ADMIN")
        for label in ("Open", "Overdue", "Blocked", "Done this week"):
            expect(page.locator(".kpi").get_by_text(label, exact=True).first).to_be_visible()
        expect(page.get_by_role("heading", name="Overdue across the team")).to_be_visible()
        expect(page.get_by_role("heading", name="Open work by person")).to_be_visible()
        expect(page.get_by_role("heading", name="Your own tasks")).to_be_visible()
        expect(page.get_by_role("link", name="Notifications")).to_have_count(0)
    step("Super Admin: dashboard shows team numbers, overdue, workload and own tasks", dashboard)

    def create():
        create_task(page, title, intern_name)
        expect(page.get_by_text(intern_name).first).to_be_visible()
    step("Super Admin: create a task with the searchable assignee picker", create)

    def edit():
        page.get_by_role("button", name="Edit").click()
        dialog = page.get_by_role("dialog")
        dialog.get_by_label("Priority").select_option("URGENT")
        dialog.get_by_role("button", name="Save changes").click()
        expect(page.get_by_text("Task updated.")).to_be_visible()
        expect(page.get_by_text("Urgent", exact=True).first).to_be_visible()
    step("Super Admin: edit a task", edit)

    def comment():
        page.get_by_label("Add a comment").fill("Comment from the e2e script.")
        page.get_by_role("button", name="Post comment").click()
        expect(page.get_by_text("Comment from the e2e script.")).to_be_visible()
    step("Super Admin: comment with author and time", comment)

    def delete():
        open_nav_link(page, "My Tasks")
        create_task(page, throwaway)
        page.get_by_role("button", name="Delete").click()
        dialog = page.get_by_role("dialog")
        expect(dialog.get_by_role("button", name="Cancel")).to_be_focused()
        dialog.get_by_role("button", name="Delete task").click()
        expect(page.get_by_text("Task deleted.")).to_be_visible()
        expect(page.get_by_role("heading", name="My Tasks")).to_be_visible()
    step("Super Admin: delete asks first", delete)

    def views():
        open_nav_link(page, "My Tasks")
        group = page.get_by_role("tablist", name="Task views")
        for label in ("My tasks", "Tasks I assigned", "Unassigned", "All tasks"):
            expect(group.get_by_role("tab", name=label)).to_be_visible()
        group.get_by_role("tab", name="Tasks I assigned").click()
        expect(page.get_by_role("link", name=title)).to_be_visible()
    step("Super Admin: all four task views, and the task under Tasks I assigned", views)

    def filters():
        page.get_by_label("Filter by priority").select_option("URGENT")
        expect(page.get_by_role("link", name=title)).to_be_visible()
        page.get_by_label("Filter by priority").select_option("LOW")
        expect(page.get_by_role("link", name=title)).to_have_count(0)
        page.get_by_label("Filter by priority").select_option("")
    step("Super Admin: priority filter narrows the list", filters)

    def directory():
        open_nav_link(page, "Team Directory")
        page.get_by_label("Search by name").fill(intern_name.split()[0])
        expect(page.get_by_text(intern_name)).to_be_visible()
        page.get_by_label("Access level").select_option("SUPER_ADMIN")
        expect(page.get_by_text(intern_name)).to_have_count(0)
        expect(page.locator("main").get_by_text("@")).to_have_count(0)
    step("Super Admin: directory search and role filter, no emails shown", directory)

    def settings():
        open_nav_link(page, "Settings")
        expect(page.get_by_role("heading", name="My profile")).to_be_visible()
        expect(page.get_by_role("heading", name="Change password")).to_be_visible()
        expect(page.get_by_role("button", name="Log out")).to_be_visible()
    step("Super Admin: settings shows profile, password and log out", settings)

    def reset_dialog():
        open_nav_link(page, "User Management")
        page.get_by_role("button", name=f"Reset password for {intern_name}").click()
        dialog = page.get_by_role("dialog")
        expect(dialog.get_by_role("heading", name="Reset password?")).to_be_visible()
        dialog.get_by_role("button", name="Cancel").click()
        expect(dialog).to_have_count(0)
    step("Super Admin: reset password confirms first", reset_dialog)


def run_public_pages(browser):
    page = new_page(browser, MOBILE)

    def links_stay_put():
        for path, heading in (("/set-password", "Set your password"), ("/reset-password", "Reset your password")):
            page.goto(f"{APP}{path}?token=not-a-real-token")
            expect(page.get_by_role("heading", name=heading)).to_be_visible()
            expect_url_is(page, path)
            expect_no_sideways_scroll(page, path)
    step("Signed out: emailed links stay on their page and leave the address bar", links_stay_put)

    def dead_link():
        page.goto(f"{APP}/set-password?token=not-a-real-token")
        fill_passwords(page, PASSWORD)
        page.get_by_role("button", name="Set password").click()
        expect(page.get_by_role("alert")).to_contain_text("expired or has already been used")
        expect(page.get_by_role("alert")).to_contain_text("new invite")
    step("Set password: a dead link explains what to do", dead_link)

    def no_token():
        page.goto(f"{APP}/reset-password")
        expect(page.get_by_role("alert")).to_contain_text("incomplete")
        expect_url_is(page, "/reset-password")
    step("Reset password: without a token, says to reopen the email", no_token)

    def checks_input():
        page.goto(f"{APP}/set-password?token=not-a-real-token")
        fill_passwords(page, "short", "short")
        page.get_by_role("button", name="Set password").click()
        expect(page.get_by_text("Use at least 12 characters.")).to_be_visible()
        fill_passwords(page, PASSWORD, SECOND_PASSWORD)
        page.get_by_role("button", name="Set password").click()
        expect(page.get_by_text("Those passwords don't match.")).to_be_visible()
    step("Set password: short and mismatched passwords never reach the server", checks_input)

    def forgot_link():
        page.goto(f"{APP}/login")
        expect(page.get_by_text("Ask your administrator")).to_have_count(0)
        page.get_by_role("link", name="Forgot password?").click()
        expect_url_is(page, "/forgot-password")
        expect(page.get_by_role("heading", name="Forgot password?")).to_be_visible()
        expect_no_sideways_scroll(page, "/forgot-password")
    step("Login: Forgot password? opens the email form", forgot_link)
    page.context.close()


def run_invites(browser, admin):
    """Needs a local backend, because it reads the emails from that backend's console."""
    name, email = f"E2E Invite {RUN}", f"e2e.invite.{RUN}@example.test"
    fresh = new_page(browser)
    old_link = {}

    def add_user():
        open_nav_link(admin, "User Management")
        admin.get_by_role("button", name="Invite user").click()
        dialog = admin.get_by_role("dialog")
        expect(dialog.get_by_label("Temporary password")).to_have_count(0)
        expect(dialog.locator("input[type=password]")).to_have_count(0)
        dialog.get_by_label("Full name").fill(name)
        dialog.get_by_label("Work email").fill(email)
        dialog.get_by_label("Access level").select_option("INTERN")
        dialog.get_by_role("button", name="Send invite").click()
        expect(dialog.get_by_text(f"Invite sent to {email}")).to_be_visible()
        expect(dialog.get_by_role("button", name="Copy")).to_have_count(0)
        dialog.get_by_role("button", name="Done").click()
    step("Add user: name, email, role, then Invite sent to the address", add_user)

    def pending_row():
        row = admin.get_by_role("row", name=re.compile(re.escape(name)))
        expect(row.get_by_text("Pending invite", exact=True)).to_be_visible()
        expect(row.get_by_role("button", name=f"Resend invite to {name}")).to_be_visible()
        expect(row.get_by_role("button", name=f"Reset password for {name}")).to_have_count(0)
        expect(row.get_by_role("button", name=f"Deactivate {name}")).to_be_visible()
    step("User Management: pending user gets the badge and Resend invite", pending_row)

    def resend():
        old_link["url"] = emailed_link(email, "/set-password")
        admin.get_by_role("button", name=f"Resend invite to {name}").click()
        dialog = admin.get_by_role("dialog")
        expect(dialog.get_by_text(f"Invite sent to {email}")).to_be_visible()
        dialog.get_by_role("button", name="Done").click()
    step("Resend invite: confirms the address", resend)

    def old_link_dies():
        for _ in range(50):
            if emailed_link(email, "/set-password") != old_link["url"]:
                break
            time.sleep(0.1)
        fresh.goto(old_link["url"])
        fill_passwords(fresh, PASSWORD)
        fresh.get_by_role("button", name="Set password").click()
        expect(fresh.get_by_role("alert")).to_contain_text("expired or has already been used")
    step("Resend invite: the previous link no longer works", old_link_dies)

    def set_password():
        fresh.goto(emailed_link(email, "/set-password"))
        expect_url_is(fresh, "/set-password")
        fill_passwords(fresh, PASSWORD)
        fresh.get_by_role("button", name="Set password").click()
        expect(fresh.get_by_text("Password set, please log in.")).to_be_visible()
        expect_url_is(fresh, "/login")
    step("Set password: real link, then Password set on the login page", set_password)

    def log_in_after():
        log_in_as(fresh, email, PASSWORD)
        expect(fresh.get_by_text(name.split()[0]).first).to_be_visible()
        admin.reload()
        row = admin.get_by_role("row", name=re.compile(re.escape(name)))
        expect(row.get_by_text("Active", exact=True)).to_be_visible()
        expect(row.get_by_role("button", name=f"Resend invite to {name}")).to_have_count(0)
    step("Invited user logs in with the password they chose, and shows as Active", log_in_after)

    def first_day():
        expect(fresh.get_by_role("heading", name="Nothing on your plate yet")).to_be_visible()
        token = call("POST", "/auth/login", body={"email": email, "password": PASSWORD})["token"]
        if "checkedInToday" not in call("GET", "/tasks/summary", token)["summary"]:
            return
        if not is_weekend():
            expect(fresh.get_by_text("You haven't checked in today")).to_be_visible()
        call("PUT", "/checkins/today", token, {
            "workCompleted": "First day.",
            "priorities": "Getting set up.",
            "blockers": f"Blocked by {name}",
        })
        fresh.reload()
        if not is_weekend():
            expect(fresh.get_by_text(re.compile("^Checked in at"))).to_be_visible()
        lead = new_page(browser)
        log_in(lead, "TEAM_LEAD")
        blocker = lead.locator("li", has_text=f"Blocked by {name}")
        expect(blocker).to_be_visible()
        blocker.get_by_role("button", name="Mark handled").click()
        expect(blocker).to_have_count(0)
        lead.context.close()
        admin.reload()
    step("New user: empty dashboard, check-in card, then the lead handles the blocker", first_day)

    def used_link():
        link = emailed_link(email, "/set-password")
        page = new_page(browser)
        page.goto(link)
        fill_passwords(page, SECOND_PASSWORD)
        page.get_by_role("button", name="Set password").click()
        expect(page.get_by_role("alert")).to_contain_text("expired or has already been used")
        page.context.close()
    step("Set password: a used link is refused", used_link)

    def signed_in_tab():
        name2, email2 = f"E2E Tab {RUN}", f"e2e.tab.{RUN}@example.test"
        invite(admin, name2, email2)
        token = "sessionStorage.getItem('brivent.authToken')"
        assert fresh.evaluate(token), "This tab should still be signed in"
        fresh.goto(emailed_link(email2, "/set-password"))
        expect(fresh.get_by_role("heading", name="Set your password")).to_be_visible()
        fill_passwords(fresh, PASSWORD)
        fresh.get_by_role("button", name="Set password").click()
        expect(fresh.get_by_text("Password set, please log in.")).to_be_visible()
        expect_url_is(fresh, "/login")
        assert fresh.evaluate(token) is None
    step("Set password: an invite opened in a signed-in tab still reaches login", signed_in_tab)

    def prefills_email():
        name3, email3 = f"E2E Fill {RUN}", f"e2e.fill.{RUN}@example.test"
        invite(admin, name3, email3)
        page = new_page(browser)
        page.goto(emailed_link(email3, "/set-password"))
        fill_passwords(page, PASSWORD)
        page.get_by_role("button", name="Set password").click()
        expect(page.get_by_label("Work email")).to_have_value(email3)
        expect(page.get_by_label("Password", exact=True)).to_be_focused()
        assert email3 not in page.url
        page.context.close()
    step("Login: fills the email in after setting a password", prefills_email)

    def forgot():
        page = new_page(browser)
        page.goto(f"{APP}/forgot-password")
        page.get_by_label("Work email").fill(f"nobody.{RUN}@example.test")
        page.get_by_role("button", name="Send reset link").click()
        unknown = page.get_by_role("status").inner_text()
        page.goto(f"{APP}/forgot-password")
        page.get_by_label("Work email").fill(email)
        page.get_by_role("button", name="Send reset link").click()
        assert page.get_by_role("status").inner_text() == unknown, "Answer depends on the account"
        page.goto(emailed_link(email, "/reset-password"))
        expect_url_is(page, "/reset-password")
        fill_passwords(page, SECOND_PASSWORD)
        page.get_by_role("button", name="Reset password").click()
        expect(page.get_by_text("Password reset, please log in.")).to_be_visible()
        log_in_as(page, email, SECOND_PASSWORD)
        page.context.close()
    step("Forgot password: same answer for anyone, then the link resets it", forgot)

    def used_reset_link():
        page = new_page(browser)
        page.goto(emailed_link(email, "/reset-password"))
        fill_passwords(page, PASSWORD)
        page.get_by_role("button", name="Reset password").click()
        expect(page.get_by_role("alert")).to_contain_text("expired or has already been used")
        page.get_by_role("link", name="Forgot password?").click()
        expect_url_is(page, "/forgot-password")
        page.context.close()
    step("Reset password: a used link points to Forgot password?", used_reset_link)

    def rate_limited():
        page = new_page(browser)
        address = f"e2e.limit.{RUN}@example.test"
        limit = page.get_by_role("alert").filter(has_text="Too many requests")
        for _ in range(11):  # The API allows 3 per email and 10 per IP address.
            page.goto(f"{APP}/forgot-password")
            page.get_by_label("Work email").fill(address)
            page.get_by_role("button", name="Send reset link").click()
            page.get_by_role("status").or_(limit).wait_for()
            if limit.count():
                break
        expect(limit).to_be_visible()
        page.context.close()
    step("Forgot password: repeated requests show the rate limit", rate_limited)

    def admin_reset():
        admin.reload()
        admin.get_by_role("button", name=f"Reset password for {name}").click()
        dialog = admin.get_by_role("dialog")
        expect(dialog.get_by_text("stop working immediately")).to_be_visible()
        dialog.get_by_role("button", name="Reset password").click()
        expect(dialog.get_by_text(f"A password reset email was sent to {email}")).to_be_visible()
        expect(dialog.get_by_role("button", name="Copy")).to_have_count(0)
        dialog.get_by_role("button", name="Done").click()
        page = new_page(browser)
        page.goto(f"{APP}/login")
        page.get_by_label("Work email").fill(email)
        page.get_by_label("Password", exact=True).fill(SECOND_PASSWORD)
        page.get_by_role("button", name="Sign in").click()
        expect(page.get_by_role("alert")).to_be_visible()
        page.context.close()
    step("Admin reset: warns, says the email was sent, old password stops", admin_reset)

    def email_failures():
        fake_link = f"{APP}/set-password?token=simulated-link"
        admin.context.grant_permissions(["clipboard-read", "clipboard-write"], origin=APP)

        def fail_email(route):
            if route.request.method != "POST":
                return route.fallback()
            response = route.fetch()
            route.fulfill(response=response, json={**response.json(), "emailSent": False, "link": fake_link})

        def expect_manual_link(dialog):
            expect(dialog.get_by_role("heading", name="Email didn't send")).to_be_visible()
            expect(dialog.get_by_text("share this link with them yourself")).to_be_visible()
            expect(dialog.get_by_text(fake_link)).to_be_visible()
            dialog.get_by_role("button", name="Copy").click()
            expect(dialog.get_by_role("button", name="Copied")).to_be_visible()
            assert admin.evaluate("navigator.clipboard.readText()") == fake_link
            dialog.get_by_role("button", name="Done").click()

        for path in ("/users", "/users/*/resend-invite", "/users/*/reset-password"):
            admin.route(f"{api_url()}{path}", fail_email)
        name4, email4 = f"E2E Fail {RUN}", f"e2e.fail.{RUN}@example.test"
        admin.get_by_role("button", name="Invite user").click()
        dialog = admin.get_by_role("dialog")
        dialog.get_by_label("Full name").fill(name4)
        dialog.get_by_label("Work email").fill(email4)
        dialog.get_by_role("button", name="Send invite").click()
        expect_manual_link(dialog)
        admin.get_by_role("button", name=f"Resend invite to {name4}").click()
        expect_manual_link(admin.get_by_role("dialog"))
        admin.get_by_role("button", name=f"Reset password for {name}").click()
        admin.get_by_role("dialog").get_by_role("button", name="Reset password").click()
        expect_manual_link(admin.get_by_role("dialog"))
        admin.unroute_all()
    step("Failed email: link and copy button on add, resend and reset (failure simulated)", email_failures)

    def deactivate_pending():
        name5, email5 = f"E2E Off {RUN}", f"e2e.off.{RUN}@example.test"
        invite(admin, name5, email5)
        admin.get_by_role("button", name=f"Deactivate {name5}").click()
        admin.get_by_role("dialog").get_by_role("button", name="Deactivate").click()
        row = admin.get_by_role("row", name=re.compile(re.escape(name5)))
        expect(row.get_by_text("Deactivated", exact=True)).to_be_visible()
        expect(row.get_by_role("button", name=f"Resend invite to {name5}")).to_have_count(0)
        admin.get_by_role("button", name=f"Reactivate {name5}").click()
        admin.get_by_role("dialog").get_by_role("button", name="Reactivate").click()
        expect(admin.get_by_text("is pending again")).to_be_visible()
        expect(row.get_by_text("Pending invite", exact=True)).to_be_visible()
    step("Pending user: deactivate, then reactivate returns them to Pending", deactivate_pending)
    fresh.context.close()


def run_dashboard(browser, admin_token):
    page = new_page(browser)

    def member_view():
        log_in(page, "INTERN")
        expect(page.get_by_role("heading", name="Overdue across the team")).to_have_count(0)
        expect(page.get_by_role("heading", name="Open work by person")).to_have_count(0)
        for label in ("Open", "Overdue", "Due today", "Done this week"):
            expect(page.locator(".kpi").get_by_text(label, exact=True).first).to_be_visible()
    step("Dashboard: Interns get their own numbers and no team cards", member_view)

    def numbers_link():
        for label, url, chip in (
            ("Open", "/tasks?preset=open", "Open"),
            ("Due today", "/tasks?preset=dueToday", "Due today"),
            ("Done this week", "/tasks?preset=doneThisWeek", "Done this week"),
            ("Overdue", "/tasks?overdue=true", "Overdue only"),
        ):
            page.goto(f"{APP}/")
            page.locator("a.kpi").filter(has_text=label).first.click()
            expect(page).to_have_url(f"{APP}{url}")
            expect(page.locator("main .chip.on", has_text=chip)).to_be_visible()
    step("Dashboard: every number opens its filtered list", numbers_link)

    def fields_stay_hidden():
        def strip(route):
            response = route.fetch()
            summary = response.json()["summary"]
            for field in ("checkedInToday", "teamCheckins", "upcomingMeetings"):
                summary.pop(field, None)
            route.fulfill(response=response, json={"summary": summary})

        other = new_page(browser)
        other.route(f"{api_url()}/tasks/summary", strip)
        log_in(other, "INTERN")
        expect(other.get_by_role("heading", name="Needs your attention")).to_be_visible()
        expect(other.get_by_text("checked in today")).to_have_count(0)
        expect(other.get_by_text("Checked in at")).to_have_count(0)
        expect(other.get_by_role("heading", name="Today's meetings")).to_have_count(0)
        other.context.close()
        other = new_page(browser)
        other.route(f"{api_url()}/tasks/summary", strip)
        log_in(other, "TEAM_LEAD")
        expect(other.get_by_role("heading", name="Overdue across the team")).to_be_visible()
        expect(other.get_by_role("heading", name="Blockers raised today")).to_have_count(0)
        expect(other.get_by_role("heading", name="Not checked in yet")).to_have_count(0)
        expect(other.locator(".kpi").get_by_text("Checked in today")).to_have_count(0)
        other.context.close()
    step("Dashboard: check-in and meeting parts stay hidden without their fields (simulated)", fields_stay_hidden)

    def page_error():
        other = new_page(browser)
        log_in(other, "INTERN")
        other.route(f"{api_url()}/tasks/summary", lambda route: route.abort())
        other.reload()
        expect(other.get_by_role("heading", name="Couldn't load your dashboard")).to_be_visible()
        other.unroute_all()
        other.get_by_role("button", name="Try again").click()
        expect(other.get_by_role("heading", name="Needs your attention")).to_be_visible()
        other.context.close()
    step("Dashboard: a failed load explains itself and Try again recovers (simulated)", page_error)

    def card_error():
        other = new_page(browser)
        log_in(other, "TEAM_LEAD")

        def fail_list(route):
            return route.abort() if "/tasks/summary" not in route.request.url else route.fallback()

        other.route(f"{api_url()}/tasks?*", fail_list)
        other.reload()
        expect(other.get_by_role("heading", name="Couldn't load tasks").first).to_be_visible()
        expect(other.get_by_role("heading", name=GREETING)).to_be_visible()
        expect(other.locator(".kpi").first).to_be_visible()
        other.context.close()
    step("Dashboard: one failed card leaves the rest working (simulated)", card_error)

    def wat_everywhere():
        context = browser.new_context(viewport=LAPTOP, timezone_id="America/New_York")
        other = context.new_page()
        log_in(other, "INTERN")
        heading = other.locator("main header p").first.inner_text()
        expected = call_wat_date()
        assert heading == expected, f"{heading} is not {expected}"
        context.close()
    step("Dashboard: the date is WAT even for a viewer in another timezone", wat_everywhere)

    def phones():
        for role in ("INTERN", "TEAM_LEAD"):
            other = new_page(browser, MOBILE)
            log_in(other, role)
            expect(other.locator(".kpi:visible")).to_have_count(3 if role == "INTERN" else 4)
            expect_no_sideways_scroll(other, f"/ as {role}")
            other.context.close()
    step("Dashboard: phone versions fit 375px with the designed numbers", phones)

    def widths():
        for width in (1280, 1440):
            for role in ("INTERN", "TEAM_LEAD"):
                other = new_page(browser, {"width": width, "height": 900})
                log_in(other, role)
                expect_no_sideways_scroll(other, f"/ at {width} as {role}")
                other.context.close()
    step("Dashboard: fits 1280 and 1440 for both versions", widths)
    page.context.close()


def run_checkins(browser, admin_token):
    name, email = f"E2E Checkin {RUN}", f"e2e.checkin.{RUN}@example.test"
    blocker = f"Waiting on the login for run {RUN}."
    task_title = f"{PREFIX} checkin chip"
    user = call("POST", "/users", admin_token, {"name": name, "email": email, "role": "INTERN"})["user"]
    member = new_page(browser)
    member.goto(emailed_link(email, "/set-password"))
    fill_passwords(member, PASSWORD)
    member.get_by_role("button", name="Set password").click()
    member.get_by_label("Password", exact=True).fill(PASSWORD)
    member.get_by_role("button", name="Sign in").click()
    expect(member.get_by_role("heading", name=GREETING)).to_be_visible()
    call("POST", "/tasks", admin_token, {"title": task_title, "assigneeIds": [user["id"]]})
    draft_key = f"brivent.checkinDraft.{user['id']}."

    def no_team_tab():
        expect(member.get_by_role("link", name="Daily Check-in")).not_to_contain_text("Soon")
        member.goto(f"{APP}/daily")
        expect(member.get_by_role("heading", name="Daily check-in", exact=True)).to_be_visible()
        expect(member.get_by_role("tablist", name="Check-in views")).to_have_count(0)
        member.goto(f"{APP}/daily?tab=team")
        expect(member.get_by_role("heading", name="Team check-ins are for leads")).to_be_visible()
        member.get_by_role("link", name="Go to my check-in").click()
        expect(member.get_by_role("button", name="Submit check-in")).to_be_visible()
    step("Check-in: members get one view, and team links explain themselves", no_team_tab)

    def required():
        member.get_by_role("button", name="Submit check-in").click()
        expect(member.get_by_text("Say what you finished yesterday.")).to_be_visible()
        expect(member.get_by_text("Say what you're working on today.")).to_be_visible()
    step("Check-in: the two required answers are asked for", required)

    def autosave():
        member.get_by_label("What did you finish yesterday?").fill("Wrote the first draft.")
        expect(member.get_by_text(re.compile("Draft saved"))).to_be_visible(timeout=6_000)
        member.reload()
        expect(member.get_by_label("What did you finish yesterday?")).to_have_value("Wrote the first draft.")
    step("Check-in: autosaves a draft that survives a refresh", autosave)

    def chips_and_blocker():
        member.get_by_role("button", name=task_title).click()
        expect(member.get_by_label("What are you working on today?")).to_have_value(task_title)
        member.get_by_label("Anything blocking you?").fill(blocker)
        expect(member.get_by_text("Your lead will see this at the top of their review.")).to_be_visible()
    step("Check-in: a task chip links and inserts the task, and blockers warn", chips_and_blocker)

    def submit():
        member.get_by_role("button", name="Submit check-in").click()
        expect(member.get_by_text("Check-in submitted.")).to_be_visible()
        expect(member.get_by_role("button", name="Update check-in")).to_be_visible()
        expect(member.get_by_text(re.compile("^Submitted "))).to_be_visible()
        keys = member.evaluate("Object.keys(localStorage)")
        assert not [key for key in keys if key.startswith(draft_key)], "The draft outlived the submit"
    step("Check-in: submits and clears the draft", submit)

    def edit():
        field = member.get_by_label("What did you finish yesterday?")
        field.fill("Wrote and sent the first draft.")
        with member.expect_request(lambda request: request.method == "PUT") as saved:
            member.get_by_role("button", name="Update check-in").click()
        body = saved.value.post_data_json
        assert body["blockers"] == blocker and len(body["taskIds"]) == 1, "PUT would clear them"
        expect(member.get_by_text("Check-in updated.")).to_be_visible()
        member.reload()
        expect(field).to_have_value("Wrote and sent the first draft.")
        expect(member.get_by_label("Anything blocking you?")).to_have_value(blocker)
    step("Check-in: edits keep the blocker and links", edit)

    def lock_mid_edit():
        def locked(route):
            if route.request.method != "PUT":
                return route.fallback()
            route.fulfill(status=409, json={"error": {"code": "CHECKIN_LOCKED", "message": "Locked."}})

        other = new_page(browser)
        log_in_as(other, email, PASSWORD)
        other.goto(f"{APP}/daily")
        other.route(f"{api_url()}/checkins/today", locked)
        other.get_by_role("button", name="Update check-in").click()
        expect(other.get_by_text("Locked at 6:00 PM")).to_be_visible()
        expect(other.get_by_text("your last changes weren't saved")).to_be_visible()
        expect(other.get_by_role("button", name="Update check-in")).to_have_count(0)
        other.context.close()
    step("Check-in: a save refused at 18:00 shows the locked view (simulated)", lock_mid_edit)

    def locked_on_load():
        def read_only(route):
            response = route.fetch()
            body = response.json()
            body["checkin"]["editable"] = False
            route.fulfill(response=response, json=body)

        other = new_page(browser)
        log_in_as(other, email, PASSWORD)
        other.route(f"{api_url()}/checkins/today", read_only)
        other.goto(f"{APP}/daily")
        expect(other.get_by_text("Locked at 6:00 PM")).to_be_visible()
        expect(other.locator("main textarea")).to_have_count(0)
        expect(other.get_by_text(blocker)).to_be_visible()
        other.context.close()
    step("Check-in: after 18:00 it opens read-only (simulated)", locked_on_load)

    def late_first_submission():
        def no_checkin_yet(route):
            if route.request.method == "GET":
                return route.fulfill(json={"checkin": None})
            response = route.fetch()
            body = response.json()
            body["checkin"].update({"editable": False, "isLate": True})
            route.fulfill(response=response, json=body)

        other = new_page(browser)
        log_in_as(other, email, PASSWORD)
        other.route(f"{api_url()}/checkins/today", no_checkin_yet)
        other.goto(f"{APP}/daily")
        other.get_by_label("What did you finish yesterday?").fill("Sent late.")
        other.get_by_label("What are you working on today?").fill("Still sending.")
        other.get_by_label("Anything blocking you?").fill(blocker)
        other.get_by_role("button", name="Submit check-in").click()
        expect(other.get_by_text("Locked at 6:00 PM")).to_be_visible()
        expect(other.get_by_text("Late", exact=True)).to_be_visible()
        expect(other.locator("main textarea")).to_have_count(0)
        other.context.close()
    step("Check-in: a first submission after 18:00 is late and can't be edited (simulated)", late_first_submission)

    lead = new_page(browser)
    log_in(lead, "TEAM_LEAD")
    card = lead.locator("article", has_text=blocker)

    def review():
        lead.goto(f"{APP}/daily")
        expect(lead.get_by_role("tab", name="Team review")).to_have_attribute("aria-selected", "true")
        expect(lead.get_by_role("heading", name=re.compile("Blockers raised today"))).to_be_visible()
        expect(card).to_be_visible()
        expect(lead.get_by_role("heading", name=re.compile("Not submitted"))).to_be_visible()
        expect(lead.get_by_role("button", name=re.compile("Nudge"))).to_have_count(0)
        lead.get_by_role("button", name=re.compile("Not submitted")).click()
        expect(card).to_have_count(0)
        lead.get_by_role("button", name=re.compile("All")).first.click()
        expect(card).to_be_visible()
    step("Check-in review: blockers first, filters work, no nudges", review)

    def reply():
        card.get_by_role("button", name="Reply").click()
        lead.get_by_label(f"Reply to {name}").fill(f"On it, run {RUN}.")
        lead.get_by_role("button", name="Send reply").click()
        expect(card.get_by_text(f"On it, run {RUN}.")).to_be_visible()
        member.goto(f"{APP}/daily")
        expect(member.get_by_text(f"On it, run {RUN}.")).to_be_visible()
        expect(member.get_by_role("button", name="Reply")).to_have_count(0)
    step("Check-in review: a reply shows on their check-in", reply)

    def make_task():
        card.get_by_role("button", name="Make a task").click()
        dialog = lead.get_by_role("dialog")
        expect(dialog.get_by_label("Title")).to_have_value(blocker)
        expect(dialog.get_by_label("Description")).to_have_value(re.compile(re.escape(name)))
        dialog.get_by_label("Title").fill(f"{PREFIX} from blocker")
        dialog.get_by_role("button", name="Create task").click()
        expect(lead.get_by_text("Task created.")).to_be_visible()
        expect(lead.get_by_role("dialog")).to_have_count(0)
    step("Check-in review: Make a task opens the form prefilled from the blocker", make_task)

    def handled():
        card.get_by_role("button", name="Mark handled").click()
        expect(card.get_by_text("Handled", exact=True)).to_be_visible()
        expect(card.get_by_role("button", name="Make a task")).to_have_count(0)
        card.get_by_role("button", name="Reopen").click()
        expect(card.get_by_role("button", name="Mark handled")).to_be_visible()
    step("Check-in review: mark handled, then reopen", handled)

    def other_day():
        lead.get_by_role("button", name="Previous day").click()
        expect(card).to_have_count(0)
        lead.get_by_role("button", name="Next day").click()
        expect(card).to_be_visible()
        expect(lead.get_by_role("button", name="Next day")).to_have_count(0)
    step("Check-in review: earlier days, and no going past today", other_day)

    def review_error():
        other = new_page(browser)
        log_in(other, "TEAM_LEAD")
        other.route(f"{api_url()}/checkins/team*", lambda route: route.abort())
        other.goto(f"{APP}/daily")
        expect(other.get_by_role("heading", name="Couldn't load check-ins")).to_be_visible()
        other.unroute_all()
        other.get_by_role("button", name="Try again").click()
        expect(other.get_by_role("heading", name=re.compile("Not submitted"))).to_be_visible()
        other.context.close()
    step("Check-in review: a failed load offers Try again (simulated)", review_error)

    def history():
        page = new_page(browser)
        log_in(page, "INTERN")
        page.goto(f"{APP}/daily")
        expect(page.get_by_role("heading", name="My past check-ins")).to_be_visible()
        page.get_by_label("Show").select_option("thisMonth")
        expect(page.get_by_role("heading", name="My past check-ins")).to_be_visible()
        expect(page.get_by_text("Couldn't load check-ins")).to_have_count(0)
        page.context.close()
    step("Check-in: history loads for every range", history)

    def manager_form():
        lead.get_by_role("tab", name="My check-in").click()
        expect(lead.get_by_label("What did you finish yesterday?")).to_be_visible()
        expect(lead).to_have_url(f"{APP}/daily?tab=mine")
    step("Check-in: managers submit their own under My check-in", manager_form)

    def fits():
        for width in (375, 1280, 1440):
            for login, path in (((email, PASSWORD), "/daily"), (credentials("TEAM_LEAD"), "/daily?tab=team")):
                page = new_page(browser, {"width": width, "height": 800})
                log_in_as(page, *login)
                page.goto(APP + path)
                page.get_by_role("heading", level=1).wait_for()
                expect_no_sideways_scroll(page, f"{path} at {width}")
                page.context.close()
    step("Check-in: form and review fit 375, 1280 and 1440", fits)
    member.context.close()
    lead.context.close()


def run_projects(browser, admin_token):
    project_name = f"{PREFIX} Servra"
    task_title = f"{PREFIX} project task"
    other_task = f"{PREFIX} someone else's task"
    intern_name = call("POST", "/auth/login", body=dict(zip(("email", "password"), credentials("INTERN"))))["user"]
    lead = new_page(browser)
    log_in(lead, "TEAM_LEAD")
    project_url = {}

    def create():
        expect(lead.get_by_role("link", name="Projects")).not_to_contain_text("Soon")
        open_nav_link(lead, "Projects")
        lead.get_by_role("button", name="New project").click()
        panel = lead.get_by_role("dialog")
        panel.get_by_label("Project name").fill(project_name)
        panel.get_by_label("What is it for?").fill("Orders over WhatsApp.")
        panel.get_by_label("Start date").fill("2026-12-20")
        panel.get_by_label("Target date").fill("2026-12-01")
        panel.get_by_role("button", name="Create project").click()
        expect(panel.get_by_text("can't be before the start")).to_be_visible()
        panel.get_by_label("Target date").fill("2026-12-28")
        picker = panel.get_by_role("combobox", name="Members")
        picker.click()
        picker.fill(intern_name["name"].split()[0])
        panel.get_by_role("option", name=re.compile(re.escape(intern_name["name"]))).click()
        panel.get_by_role("button", name="Create project").click()
        expect(lead.get_by_role("heading", name=project_name)).to_be_visible()
        project_url["url"] = lead.url
        expect(lead.get_by_text("Owner", exact=False).first).to_be_visible()
        expect(lead.get_by_role("button", name=re.compile("Delete"))).to_have_count(0)
    step("Projects: a manager creates one, and bad dates are caught", create)

    def task_in_project():
        lead.locator("main").get_by_role("button", name="New task").first.click()
        dialog = lead.get_by_role("dialog")
        select = dialog.get_by_label("Project")
        expect(select).to_have_value(project_url["url"].rsplit("/", 1)[1])
        dialog.get_by_label("Title").fill(task_title)
        pick_assignee(dialog, intern_name["name"])
        dialog.get_by_role("button", name="Create task").click()
        expect(lead.get_by_role("heading", name=task_title)).to_be_visible()
        expect(lead.get_by_role("link", name=project_name)).to_be_visible()
        lead.goto(project_url["url"])
        expect(lead.get_by_role("link", name=re.compile(re.escape(task_title)))).to_be_visible()
    step("Projects: New task from a project presets it", task_in_project)

    def task_list():
        open_nav_link(lead, "My Tasks")
        lead.get_by_role("tab", name="All tasks").click()
        lead.get_by_label("Filter by project").select_option(label=project_name)
        expect(lead.get_by_role("link", name=task_title)).to_be_visible()
        expect(lead.get_by_role("link", name=project_name).first).to_be_visible()
        expect(lead.locator("main").get_by_role("link", name=re.compile(re.escape(PREFIX) + " lead"))).to_have_count(0)
    step("Tasks: project filter and project tags on rows", task_list)

    def card():
        open_nav_link(lead, "Projects")
        tile = lead.get_by_role("link", name=re.compile(re.escape(project_name)))
        expect(tile).to_contain_text("0 of 1 tasks done")
        expect(tile).to_contain_text("Dec 28")
        lead.get_by_label("Search projects").fill("no such project")
        expect(lead.get_by_role("heading", name="No projects match")).to_be_visible()
        lead.get_by_role("button", name="Clear search").click()
        expect(tile).to_be_visible()
    step("Projects: cards show progress and dates, and search clears", card)

    def intern_view():
        page = new_page(browser)
        log_in(page, "INTERN")
        page.goto(f"{APP}/projects")
        expect(page.get_by_role("button", name="New project")).to_have_count(0)
        page.get_by_role("link", name=re.compile(re.escape(project_name))).click()
        expect(page.get_by_role("heading", name=project_name)).to_be_visible()
        expect(page.get_by_role("button", name="Edit project")).to_have_count(0)
        expect(page.get_by_role("button", name="New task")).to_have_count(0)
        expect(page.get_by_role("button", name=re.compile("^Remove"))).to_have_count(0)
        page.context.close()
    step("Projects: members can look but get no manager actions", intern_view)

    def read_only_comments():
        project_id = project_url["url"].rsplit("/", 1)[1]
        task = call("POST", "/tasks", admin_token, {"title": other_task, "projectId": project_id})["task"]
        page = new_page(browser)
        log_in(page, "INTERN")
        page.goto(f"{APP}/tasks/{task['id']}")
        expect(page.get_by_role("heading", name=other_task)).to_be_visible()
        expect(page.get_by_label("Add a comment")).to_have_count(0)
        page.context.close()
    step("Tasks: someone seeing a task through its project can't comment", read_only_comments)

    def not_a_member():
        other = call("POST", "/projects", admin_token, {"name": f"{PREFIX} private"})["project"]
        intern = new_page(browser)
        log_in(intern, "INTERN")
        intern.goto(f"{APP}/projects/{other['id']}")
        expect(intern.get_by_role("heading", name="You're not on this project")).to_be_visible()
        intern.get_by_role("link", name="All projects").click()
        expect(intern.get_by_role("heading", name="Projects", exact=True)).to_be_visible()
        intern.context.close()
        lead.goto(f"{APP}/projects/{other['id']}")
        expect(lead.get_by_role("heading", name=f"{PREFIX} private")).to_be_visible()
        expect(lead.get_by_role("button", name="Edit project")).to_have_count(0)
        expect(lead.get_by_role("button", name="Add")).to_have_count(0)
    step("Projects: no access off the project, and leads only edit their own", not_a_member)

    def members():
        lead.goto(project_url["url"])
        lead.get_by_role("button", name=f"Remove {intern_name['name']}").click()
        dialog = lead.get_by_role("dialog")
        expect(dialog.get_by_text("Their tasks stay in the project")).to_be_visible()
        dialog.get_by_role("button", name="Remove").click()
        expect(lead.get_by_text(f"{intern_name['name']} has been removed.")).to_be_visible()
        expect(lead.get_by_role("link", name=re.compile(re.escape(task_title)))).to_be_visible()
        lead.get_by_role("button", name="Add", exact=True).click()
        picker = lead.get_by_role("combobox", name="Add a member")
        picker.click()
        picker.fill(intern_name["name"].split()[0])
        lead.get_by_role("option", name=re.compile(re.escape(intern_name["name"]))).click()
        expect(lead.get_by_role("button", name=f"Remove {intern_name['name']}")).to_be_visible()
    step("Projects: remove a member, keep their tasks, add them back", members)

    def complete():
        lead.get_by_role("button", name="Edit project").click()
        panel = lead.get_by_role("dialog")
        expect(panel.get_by_text("Use Completed")).to_be_visible()
        expect(panel.get_by_role("button", name=re.compile("Delete"))).to_have_count(0)
        panel.get_by_label("Status").select_option("COMPLETED")
        panel.get_by_role("button", name="Save changes").click()
        expect(lead.get_by_text("Project updated.")).to_be_visible()
        expect(lead.locator("main .badge", has_text="Completed").first).to_be_visible()
        expect(lead.locator("main").get_by_role("button", name="New task")).to_have_count(0)
        lead.goto(f"{APP}/projects")
        lead.get_by_role("tab", name=re.compile("Completed")).click()
        expect(lead.get_by_role("link", name=re.compile(re.escape(project_name)))).to_be_visible()
    step("Projects: Completed replaces delete and takes no new tasks", complete)

    def states():
        page = new_page(browser)
        log_in(page, "INTERN")
        page.route(f"{api_url()}/projects*", lambda route: route.abort())
        page.goto(f"{APP}/projects")
        expect(page.get_by_role("heading", name="Couldn't load projects")).to_be_visible()
        page.unroute_all()
        page.route(
            f"{api_url()}/projects*",
            lambda route: route.fulfill(json={"projects": [], "total": 0, "page": 1, "limit": 100}),
        )
        page.get_by_role("button", name="Try again").click()
        expect(page.get_by_role("heading", name="No projects yet")).to_be_visible()
        expect(page.get_by_role("button", name="New project")).to_have_count(0)
        page.context.close()
    step("Projects: error and empty states, with no action for members (simulated)", states)

    def fits():
        for width in (375, 1280, 1440):
            page = new_page(browser, {"width": width, "height": 800})
            log_in(page, "TEAM_LEAD")
            for path in ("/projects", project_url["url"].replace(APP, "")):
                page.goto(APP + path)
                page.get_by_role("heading", level=1).wait_for()
                expect_no_sideways_scroll(page, f"{path} at {width}")
            page.context.close()
    step("Projects: list and detail fit 375, 1280 and 1440", fits)
    lead.context.close()


def wat_today():
    return datetime.now(timezone(timedelta(hours=1))).strftime("%Y-%m-%d")


def at(time_of_day):
    return f"{wat_today()}T{time_of_day}:00+01:00"


def active_user(admin_token, name, email):
    """A real invited account that has set its password, read from the console email."""
    user = call("POST", "/users", admin_token, {"name": name, "email": email, "role": "TEAM_MEMBER"})["user"]
    token = re.search(r"token=(\S+)", emailed_link(email, "/set-password")).group(1)
    call("POST", "/auth/set-password", body={"token": token, "newPassword": PASSWORD})
    return {**user, "password": PASSWORD}


def run_multi_assignee(browser, admin_token):
    login = dict(zip(("email", "password"), credentials("TEAM_LEAD")))
    lead_auth = call("POST", "/auth/login", body=login)
    lead_user, lead_token = lead_auth["user"], lead_auth["token"]
    intern_user = call(
        "POST", "/auth/login", body=dict(zip(("email", "password"), credentials("INTERN")))
    )["user"]
    # Enough people to fill a task: Lead, Intern, Admin and these eight make eleven.
    extra = [
        active_user(admin_token, f"E2E Share {chr(65 + n)} {RUN}", f"e2e.share{n}.{RUN}@example.test")
        for n in range(8)
    ]
    ana, ben = extra[0], extra[1]
    shared = f"{PREFIX} shared work"

    lead = new_page(browser)
    log_in(lead, "TEAM_LEAD")
    sent = []

    def record(request):
        if request.method in ("POST", "PATCH", "PUT") and "/tasks" in request.url and request.post_data:
            sent.append((request.method, request.url.split("/api")[1], json.loads(request.post_data)))

    lead.on("request", record)
    task_id = {}

    def create():
        lead.goto(f"{APP}/tasks")
        lead.get_by_role("button", name="New task").click()
        dialog = lead.get_by_role("dialog")
        dialog.get_by_label("Title").fill(shared)
        picker = dialog.get_by_role("combobox", name="Assignees")
        picker.click()
        picker.fill("E2E Share A")
        option = dialog.get_by_role("option", name=re.compile(re.escape(ana["name"])))
        option.click()
        expect(dialog.get_by_role("listbox")).to_be_visible()
        picker.fill("E2E Share B")
        dialog.get_by_role("option", name=re.compile(re.escape(ben["name"]))).click()
        picker.press("Escape")
        expect(dialog.get_by_role("listbox")).to_have_count(0)
        expect(dialog.get_by_label("Title")).to_have_value(shared)
        expect(dialog.get_by_role("button", name=f"Remove {ana['name']}")).to_be_visible()
        sent.clear()
        dialog.get_by_role("button", name="Create task").click()
        expect(lead.get_by_role("heading", name=shared)).to_be_visible()
        method, path, body = sent[0]
        assert (method, path) == ("POST", "/tasks"), sent
        assert body["assigneeIds"] == [ana["id"], ben["id"]] and "assigneeId" not in body, body
        task_id["id"] = lead.url.rsplit("/", 1)[1]
    step("New task: pick two people in a row, sent as assigneeIds", create)

    def detail_lists_everyone():
        section = lead.get_by_role("heading", name="Assignees · 2").locator("..")
        for person in (ana, ben):
            row = section.get_by_role("listitem").filter(has_text=person["name"])
            expect(row).to_contain_text(f"Assigned by {lead_user['name']}")
    step("Task detail lists every assignee with who assigned them", detail_lists_everyone)

    def add_and_remove():
        picker = lead.get_by_role("combobox", name="Add assignee")
        picker.click()
        picker.fill(intern_user["name"].split()[0])
        sent.clear()
        lead.get_by_role("option", name=re.compile(re.escape(intern_user["name"]))).click()
        expect(lead.get_by_role("heading", name="Assignees · 3")).to_be_visible()
        method, path, body = sent[0]
        assert (method, path) == ("PUT", f"/tasks/{task_id['id']}/assignees") and len(sent) == 1, sent
        assert set(body["assigneeIds"]) == {ana["id"], ben["id"], intern_user["id"]}, body
        sent.clear()
        lead.get_by_role("button", name=f"Remove {ben['name']}").click()
        expect(lead.get_by_role("heading", name="Assignees · 2")).to_be_visible()
        assert set(sent[0][2]["assigneeIds"]) == {ana["id"], intern_user["id"]}, sent
    step("Task detail: add and remove send everyone who stays", add_and_remove)

    def any_assignee_acts():
        member = new_page(browser)
        log_in_as(member, ana["email"], ana["password"])
        member.goto(f"{APP}/tasks")
        expect(member.get_by_role("link", name=shared)).to_be_visible()
        intern = new_page(browser)
        log_in(intern, "INTERN")
        intern.goto(f"{APP}/tasks")
        expect(intern.get_by_role("link", name=shared)).to_be_visible()
        intern.goto(f"{APP}/tasks/{task_id['id']}")
        intern.get_by_label("Status").select_option("IN_PROGRESS")
        expect(intern.get_by_text("Moved to In progress.")).to_be_visible()
        intern.get_by_label("Add a comment").fill("The second assignee can comment.")
        intern.get_by_role("button", name="Post comment").click()
        expect(intern.get_by_text("The second assignee can comment.")).to_be_visible()
        expect(intern.get_by_role("combobox", name="Add assignee")).to_have_count(0)
        expect(intern.get_by_role("button", name=re.compile("^Remove "))).to_have_count(0)
        intern.context.close()
        member.context.close()
    step("My Tasks, status and comments work for any assignee, with no add or remove for them", any_assignee_acts)

    def stack():
        ids = [ana["id"], ben["id"], extra[2]["id"], extra[3]["id"], extra[4]["id"]]
        call("PUT", f"/tasks/{task_id['id']}/assignees", lead_token, {"assigneeIds": ids})
        lead.goto(f"{APP}/tasks?view=all")
        row = lead.get_by_role("listitem").filter(has=lead.get_by_role("link", name=shared))
        faces = row.locator(".av-stack").first
        expect(faces.locator(".av")).to_have_count(3)
        expect(faces).to_contain_text("+2")
        expect(faces).to_have_attribute("title", re.compile(re.escape(extra[4]["name"])))
    step("Task rows stack three faces, then +2, with every name on hover", stack)

    def edit_form():
        lead.goto(f"{APP}/tasks/{task_id['id']}")
        lead.get_by_role("button", name="Edit").click()
        dialog = lead.get_by_role("dialog")
        dialog.get_by_role("button", name=f"Remove {extra[4]['name']}").click()
        sent.clear()
        dialog.get_by_role("button", name="Save changes").click()
        expect(lead.get_by_role("heading", name="Assignees · 4")).to_be_visible()
        assert sent[0][0] == "PATCH" and list(sent[0][2]) == ["assigneeIds"], sent
        assert set(sent[0][2]["assigneeIds"]) == {p["id"] for p in extra[:4]}, sent
    step("Edit form: changes go through PATCH assigneeIds, and unchanged people stay", edit_form)

    def ten_is_the_limit():
        people = [lead_user["id"], intern_user["id"]] + [person["id"] for person in extra]
        call("PUT", f"/tasks/{task_id['id']}/assignees", lead_token, {"assigneeIds": people})
        lead.reload()
        expect(lead.get_by_role("heading", name="Assignees · 10")).to_be_visible()
        expect(lead.get_by_role("combobox", name="Add assignee")).to_have_count(0)
        expect(lead.get_by_text("A task can have up to 10 people.")).to_be_visible()
        lead.get_by_role("button", name="Edit").click()
        dialog = lead.get_by_role("dialog")
        expect(dialog.get_by_role("combobox", name="Assignees")).to_have_count(0)
        expect(dialog.get_by_text("A task can have up to 10 people.")).to_be_visible()
        dialog.get_by_role("button", name="Cancel").click()
        try:
            eleventh = call("POST", "/auth/login", body={"email": credentials("SUPER_ADMIN")[0], "password": credentials("SUPER_ADMIN")[1]})["user"]["id"]
            call("PUT", f"/tasks/{task_id['id']}/assignees", lead_token, {"assigneeIds": people + [eleventh]})
            raise AssertionError("The server should refuse an eleventh assignee")
        except urllib.error.HTTPError as error:
            assert error.code == 400, error.code
    step("Ten people is the limit: pickers go away, and the server agrees", ten_is_the_limit)

    def deactivated_stays():
        call("POST", f"/users/{extra[7]['id']}/deactivate", admin_token)
        lead.reload()
        expect(lead.get_by_role("listitem").filter(has_text=extra[7]["name"])).to_be_visible()
        lead.get_by_role("button", name=f"Remove {extra[6]['name']}").click()
        expect(lead.get_by_role("heading", name="Assignees · 9")).to_be_visible()
        expect(lead.get_by_role("listitem").filter(has_text=extra[7]["name"])).to_be_visible()
    step("A deactivated assignee stays, and saving others doesn't remove them", deactivated_stays)

    def everywhere():
        small = f"{PREFIX} linked task"
        project = call("POST", "/projects", lead_token, {"name": f"{PREFIX} shared project"})["project"]
        task = call("POST", "/tasks", lead_token, {
            "title": small, "assigneeIds": [intern_user["id"], ben["id"]], "projectId": project["id"],
        })["task"]

        lead.goto(f"{APP}/projects/{project['id']}")
        row = lead.get_by_role("listitem").filter(has=lead.get_by_role("link", name=small))
        expect(row.locator(".av-stack .av")).to_have_count(2)
        lead.get_by_label("Filter by assignee").select_option(label=ben["name"])
        expect(lead.get_by_role("link", name=small)).to_be_visible()

        today = datetime.now(timezone(timedelta(hours=1))).strftime("%Y-%m-%d")
        meeting = call("POST", "/meetings", lead_token, {
            "title": f"{PREFIX} linked meeting", "startsAt": f"{today}T22:00:00+01:00",
            "endsAt": f"{today}T22:30:00+01:00", "attendeeIds": [], "taskIds": [task["id"]],
        })["meeting"]
        lead.goto(f"{APP}/calendar?meeting={meeting['id']}")
        linked = lead.get_by_role("dialog").get_by_role("listitem").filter(has_text=small)
        expect(linked.locator(".av")).to_have_count(2)

        intern_token = call(
            "POST", "/auth/login", body=dict(zip(("email", "password"), credentials("INTERN")))
        )["token"]
        call("PUT", "/checkins/today", intern_token, {
            "workCompleted": "Finished.", "priorities": "Plan.", "blockers": "", "taskIds": [task["id"]],
        })
        lead.goto(f"{APP}/daily?tab=team")
        linked = lead.get_by_role("listitem").filter(has=lead.get_by_role("link", name=small)).last
        expect(linked.locator(".av")).to_have_count(2)

        lead.goto(f"{APP}/")
        workload = lead.get_by_role("heading", name="Open work by person").locator("../..")
        expect(workload.get_by_role("link", name=re.compile(re.escape(ben["name"])))).to_be_visible()
    step("Project detail, meetings, check-ins and workload show everyone on a task", everywhere)

    def phone():
        small = new_page(browser, MOBILE)
        log_in(small, "TEAM_LEAD")
        small.goto(f"{APP}/tasks/{task_id['id']}")
        expect(small.get_by_role("heading", name="Assignees · 9")).to_be_visible()
        expect_no_sideways_scroll(small, "shared task")
        small.goto(f"{APP}/tasks?view=all")
        expect(small.get_by_role("link", name=shared)).to_be_visible()
        expect_no_sideways_scroll(small, "task list")
        small.context.close()
    step("Shared tasks fit 375px", phone)

    for person in extra[:7]:
        call("POST", f"/users/{person['id']}/deactivate", admin_token)


# Lets a test cut the socket while REST keeps working, which is the state polling exists for.
SOCKET_SPY = """
const NativeSocket = window.WebSocket;
window.__sockets = [];
window.WebSocket = class extends NativeSocket {
  constructor(url, ...rest) {
    if (window.__blockSockets) throw new Error('Blocked by the test');
    super(url, ...rest);
    window.__sockets.push(this);
  }
};
"""


def message_box(page, label):
    return page.get_by_role("combobox", name=f"Message {label}")


def message_list(page):
    return page.get_by_role("list", name=re.compile("^Messages in"))


def send_message(page, label, text):
    box = message_box(page, label)
    box.fill(text)
    box.press("Enter")


def open_conversation(page, name):
    page.get_by_role("link", name=re.compile(rf"^{re.escape(name)}\b")).click()


def conversation_named(token, name):
    conversations = call("GET", "/conversations", token)["conversations"]
    return next(c for c in conversations if c["name"] == name or (c["otherUser"] or {}).get("name") == name)


def post_message(token, conversation_id, body):
    return call(
        "POST",
        f"/conversations/{conversation_id}/messages",
        token,
        {"body": body, "clientId": f"e2e-{time.time_ns()}"},
    )["message"]


def run_messages(browser, admin_token):
    lead_auth = call("POST", "/auth/login", body=dict(zip(("email", "password"), credentials("TEAM_LEAD"))))
    intern_auth = call("POST", "/auth/login", body=dict(zip(("email", "password"), credentials("INTERN"))))
    lead_token, lead_user = lead_auth["token"], lead_auth["user"]
    intern_token, intern_user = intern_auth["token"], intern_auth["user"]
    general_id = conversation_named(intern_token, "general")["id"]
    public_channel = f"e2e-open-{RUN}"
    private_channel = f"e2e-private-{RUN}"
    history_channel = f"e2e-history-{RUN}"
    ana = active_user(admin_token, f"E2E Chat Ana {RUN}", f"e2e.chat0.{RUN}@example.test")
    ben = active_user(admin_token, f"E2E Chat Ben {RUN}", f"e2e.chat1.{RUN}@example.test")
    dee = active_user(admin_token, f"E2E Chat Dee {RUN}", f"e2e.chat2.{RUN}@example.test")

    # Two windows, two people: everything in the first half is checked arriving in the other one.
    sender = new_page(browser)
    receiver = new_page(browser)
    receiver.add_init_script(SOCKET_SPY)
    log_in(sender, "TEAM_LEAD")
    log_in(receiver, "INTERN")

    def nav_shows_messages():
        link = sender.get_by_role("link", name=re.compile("^Internal Messages"))
        expect(link).to_be_visible()
        expect(link).not_to_contain_text("Soon")
        expect(sender.get_by_role("link", name=re.compile("^Knowledge & SOPs"))).to_contain_text("Soon")
        link.click()
        expect(sender.get_by_role("heading", name="Pick a conversation")).to_be_visible()
        channels = sender.get_by_role("region", name="Channels")
        expect(channels.get_by_role("link", name=re.compile("^general"))).to_be_visible()
        expect(channels.get_by_role("link", name=re.compile("^announcements"))).to_be_visible()

    step("messages: nav item ships without Soon, and lists default channels", nav_shows_messages)

    open_conversation_ids = {}

    def live_new_message():
        open_conversation(sender, "general")
        receiver.goto(f"{APP}/messages/{general_id}")
        text = f"{PREFIX} hello from the lead"
        expect(message_box(receiver, "#general")).to_be_visible()
        send_message(sender, "#general", text)
        expect(message_list(receiver).get_by_text(text)).to_have_count(1)
        expect(message_list(sender).get_by_text(text)).to_have_count(1)
        expect(message_box(sender, "#general")).to_have_value("")

    step("messages: a message arrives live in the other window, once in each", live_new_message)

    def shift_enter():
        box = message_box(sender, "#general")
        box.fill("first line")
        box.press("Shift+Enter")
        box.type("second line")
        expect(box).to_have_value("first line\nsecond line")
        box.press("Enter")
        expect(message_box(sender, "#general")).to_have_value("")
        expect(message_list(receiver).get_by_text("second line")).to_have_count(1)

    step("messages: Shift+Enter is a new line, Enter sends", shift_enter)

    def live_edit():
        text = f"{PREFIX} before edit"
        send_message(sender, "#general", text)
        row = message_list(sender).get_by_role("listitem").filter(has_text=text)
        row.hover()
        row.get_by_role("button", name="Edit message").click()
        box = sender.get_by_role("textbox", name="Edit message")
        box.fill(f"{PREFIX} after edit")
        box.press("Enter")
        edited = message_list(receiver).get_by_role("listitem").filter(has_text=f"{PREFIX} after edit")
        expect(edited).to_contain_text("(edited)")
        expect(message_list(receiver).get_by_text(text)).to_have_count(0)

    step("messages: an edit shows live, labelled edited", live_edit)

    def live_delete():
        row = message_list(sender).get_by_role("listitem").filter(has_text=f"{PREFIX} after edit")
        row.hover()
        row.get_by_role("button", name="Delete message").click()
        sender.get_by_role("dialog").get_by_role("button", name="Delete").click()
        expect(message_list(receiver).get_by_text("Message deleted")).to_have_count(1)
        expect(message_list(receiver).get_by_text(f"{PREFIX} after edit")).to_have_count(0)

    step("messages: a delete shows live as Message deleted", live_delete)

    def someone_elses_message():
        row = message_list(receiver).get_by_role("listitem").filter(has_text="second line")
        row.hover()
        expect(row.get_by_role("button", name="Edit message")).to_have_count(0)
        expect(row.get_by_role("button", name="Delete message")).to_have_count(0)

    step("messages: an intern gets no edit or delete on other people's messages", someone_elses_message)

    def mention_picker():
        box = message_box(sender, "#general")
        box.fill("hi @")
        box.type("Ina")
        listbox = sender.get_by_role("listbox", name="People to mention")
        expect(listbox.get_by_role("option", name=re.compile(intern_user["name"]))).to_be_visible()
        box.press("Enter")
        expect(box).to_have_value(f"hi @{intern_user['name']} ")
        with sender.expect_request(
            lambda r: r.method == "POST" and r.url.endswith("/messages")
        ) as sent:
            box.type("please look")
            box.press("Enter")
        assert f"@[{intern_user['name']}]({intern_user['id']})" in sent.value.post_data_json["body"]
        expect(message_list(receiver).locator(".mention.is-me")).to_have_text(f"@{intern_user['name']}")

    step("messages: @ picks a person and sends the mention written for the API", mention_picker)

    def unread_badges():
        receiver.goto(f"{APP}/tasks")
        nav = receiver.get_by_role("link", name=re.compile("^Internal Messages"))
        expect(nav).to_be_visible()
        before = call("GET", "/tasks/summary", intern_token)["summary"]["unreadMessages"]
        send_message(sender, "#general", f"{PREFIX} plain unread")
        send_message(
            sender,
            "#general",
            f"@[{intern_user['name']}]({intern_user['id']}) unread mention",
        )
        expect(nav).to_contain_text(f"{before + 2} unread")
        nav.click()
        row = receiver.get_by_role("link", name=re.compile("^general"))
        expect(row).to_contain_text(f"{before + 2} unread")
        expect(row).to_contain_text("1 mentions")
        expect(row.locator(".font-bold")).to_be_visible()
        row.click()
        expect(nav).not_to_contain_text("unread")
        expect(row.locator(".count-badge")).to_have_count(0)
        assert call("GET", "/tasks/summary", intern_token)["summary"]["unreadMessages"] == 0

    step("messages: unread and mention counts arrive live and clear on reading", unread_badges)

    def dashboard_count():
        receiver.goto(f"{APP}/")
        post_message(lead_token, general_id, f"{PREFIX} for the dashboard")
        expect(receiver.get_by_role("link", name="1 unread message")).to_be_visible()
        receiver.get_by_role("link", name="1 unread message").click()
        expect(receiver.get_by_role("heading", name="Messages", exact=True)).to_be_visible()

    step("messages: the dashboard shows unread and links to messages", dashboard_count)

    def task_card():
        task = call(
            "POST",
            "/tasks",
            lead_token,
            {"title": f"{PREFIX} linked task", "priority": "MEDIUM", "assigneeIds": [intern_user["id"]]},
        )["task"]
        post_message(lead_token, general_id, f"see {APP}/tasks/{task['id']} thanks")
        receiver.goto(f"{APP}/messages/{general_id}")
        card = message_list(receiver).get_by_role("link", name=re.compile("linked task")).last
        expect(card).to_contain_text("To do")
        call("PATCH", f"/tasks/{task['id']}/status", lead_token, {"status": "BLOCKED"})
        receiver.evaluate("window.dispatchEvent(new Event('focus'))")
        expect(card).to_contain_text("Blocked")
        expect(message_list(receiver)).not_to_contain_text(f"/tasks/{task['id']}")

    step("messages: a task link is a card whose status stays current", task_card)

    def error_states():
        def refuse(route):
            return route.fulfill(status=500, json={"error": {"code": "E2E", "message": "Server trouble."}})

        receiver.route("**/api/conversations", refuse)
        receiver.goto(f"{APP}/messages")
        expect(receiver.get_by_role("heading", name="Couldn't load your messages")).to_be_visible()
        # The socket's ready event refetches too, and would clear the error by itself if it came
        # after the route is lifted, so it has to pass first.
        receiver.wait_for_timeout(1_500)
        receiver.unroute("**/api/conversations")
        receiver.get_by_role("button", name="Try again").click()
        expect(receiver.get_by_role("region", name="Channels")).to_be_visible()

        receiver.route("**/api/conversations/*/messages", refuse)
        open_conversation(receiver, "general")
        expect(receiver.get_by_role("heading", name="Couldn't load messages")).to_be_visible()
        expect(receiver.get_by_role("region", name="Channels")).to_be_visible()
        receiver.wait_for_timeout(1_500)
        receiver.unroute("**/api/conversations/*/messages")
        receiver.get_by_role("button", name="Try again").click()
        expect(message_list(receiver)).to_be_visible()

    step("messages: a failed load stays in its own pane, with Try again", error_states)

    def failed_send():
        sent = []

        def fail_first(route):
            if route.request.method != "POST":
                return route.fallback()
            sent.append(route.request.post_data_json["clientId"])
            return route.abort() if len(sent) == 1 else route.fallback()

        sender.route("**/api/conversations/*/messages", fail_first)
        text = f"{PREFIX} survives a failure"
        send_message(sender, "#general", text)
        row = message_list(sender).get_by_role("listitem").filter(has_text=text)
        expect(row).to_contain_text("Message didn't send")
        open_nav_link(sender, "My Tasks")
        open_nav_link(sender, "Internal Messages")
        open_conversation(sender, "general")
        expect(row).to_contain_text("Message didn't send")
        row.get_by_role("button", name="Resend").click()
        expect(message_list(receiver).get_by_text(text)).to_have_count(1)
        expect(message_list(sender).get_by_text(text)).to_have_count(1)
        expect(row).not_to_contain_text("Message didn't send")
        sender.unroute("**/api/conversations/*/messages")
        assert len(sent) == 2 and sent[0] == sent[1], f"expected one clientId reused, got {sent}"

    step("messages: a failed send keeps the text and Resend reuses its clientId", failed_send)

    def announcements():
        channel = conversation_named(intern_token, "announcements")["id"]
        receiver.goto(f"{APP}/messages/{channel}")
        expect(receiver.get_by_text("Only Super Admin, Admin and Operations can post")).to_be_visible()
        expect(receiver.get_by_role("combobox")).to_have_count(0)
        admin = new_page(browser)
        log_in(admin, "SUPER_ADMIN")
        admin.goto(f"{APP}/messages/{channel}")
        send_message(admin, "#announcements", f"{PREFIX} office closes at 4")
        expect(message_list(receiver).get_by_text("office closes at 4")).to_be_visible()
        admin.context.close()

    step("messages: #announcements hides the composer from people who can't post", announcements)

    def required_channels():
        receiver.goto(f"{APP}/messages/{general_id}")
        receiver.get_by_role("button", name="Conversation details").click()
        panel = receiver.get_by_role("dialog")
        expect(panel.get_by_role("switch", name="Mute this conversation")).to_be_visible()
        expect(panel.get_by_role("button", name="Leave channel")).to_have_count(0)
        expect(panel.get_by_role("button", name="Archive channel")).to_have_count(0)
        expect(panel.get_by_role("button", name="Edit channel")).to_have_count(0)
        panel.get_by_role("button", name="Close").click()

    step("messages: #general offers no leave, archive or edit", required_channels)

    def create_channel_permissions():
        receiver.get_by_role("button", name="New conversation").click()
        expect(receiver.get_by_role("button", name="New channel")).to_have_count(0)
        receiver.keyboard.press("Escape")

    step("messages: an intern can't create a channel", create_channel_permissions)

    def create_public_channel():
        sender.get_by_role("button", name="New conversation").click()
        sender.get_by_role("button", name="New channel").click()
        dialog = sender.get_by_role("dialog", name="New channel")
        name = dialog.get_by_label("Name")
        name.fill("Bad Name!")
        expect(name).to_have_value("bad-name")
        name.fill("general")
        dialog.get_by_role("button", name="Create channel").click()
        expect(dialog.get_by_text(re.compile("name", re.I)).first).to_be_visible()
        name.fill(public_channel)
        dialog.get_by_label(re.compile("^Description")).fill("Open to everyone.")
        dialog.get_by_role("button", name="Create channel").click()
        expect(sender.get_by_role("heading", name=public_channel, exact=True)).to_be_visible()
        expect(sender).to_have_url(re.compile(r"/messages/[0-9a-f-]{36}$"))

    step("messages: a Team Lead creates a channel, and a taken name stays on the form", create_public_channel)

    def empty_channel():
        expect(sender.get_by_role("heading", name=f"Say hello to #{public_channel}")).to_be_visible()

    step("messages: a new channel invites the first message", empty_channel)

    def browse_and_join():
        channel = conversation_named(lead_token, public_channel)["id"]
        post_message(lead_token, channel, f"{PREFIX} welcome")
        receiver.get_by_role("button", name="New conversation").click()
        receiver.get_by_role("button", name="Browse channels").click()
        receiver.get_by_role("button", name=f"Open {public_channel}").click()
        expect(message_list(receiver).get_by_text(f"{PREFIX} welcome")).to_be_visible()
        expect(receiver.get_by_role("combobox")).to_have_count(0)
        receiver.get_by_role("button", name="Join channel").click()
        expect(message_box(receiver, f"#{public_channel}")).to_be_visible()
        expect(receiver.get_by_role("region", name="Channels")).to_contain_text(public_channel)
        send_message(receiver, f"#{public_channel}", f"{PREFIX} glad to join")
        expect(message_list(sender).get_by_text(f"{PREFIX} glad to join")).to_be_visible()

    step("messages: browse, read before joining, then join and post", browse_and_join)

    def leave_channel():
        receiver.get_by_role("button", name="Conversation details").click()
        receiver.get_by_role("button", name="Leave channel").click()
        receiver.get_by_role("alertdialog").or_(receiver.get_by_role("dialog", name=re.compile("^Leave"))).get_by_role(
            "button", name="Leave", exact=True
        ).click()
        expect(receiver).to_have_url(f"{APP}/messages")
        expect(receiver.get_by_role("region", name="Channels")).not_to_contain_text(public_channel)

    step("messages: leaving a channel takes it off the list", leave_channel)

    def edit_and_archive():
        renamed = f"{public_channel}-new"
        call("POST", f"/channels/{conversation_named(lead_token, public_channel)['id']}/join", intern_token)
        channel = conversation_named(lead_token, public_channel)["id"]
        sender.goto(f"{APP}/messages/{channel}")
        receiver.goto(f"{APP}/messages/{channel}")
        sender.get_by_role("button", name="Conversation details").click()
        sender.get_by_role("button", name="Edit channel").click()
        dialog = sender.get_by_role("dialog", name="Edit channel")
        dialog.get_by_label("Name").fill(renamed)
        dialog.get_by_role("button", name="Save changes").click()
        expect(sender.get_by_role("heading", name=renamed, exact=True)).to_be_visible()
        expect(receiver.get_by_role("heading", name=renamed, exact=True)).to_be_visible()

        sender.get_by_role("button", name="Conversation details").click()
        sender.get_by_role("button", name="Archive channel").click()
        sender.get_by_role("button", name="Archive", exact=True).click()
        expect(sender).to_have_url(f"{APP}/messages")
        expect(receiver).to_have_url(f"{APP}/messages")
        expect(receiver.get_by_text(f"#{renamed} was archived.")).to_be_visible()
        expect(receiver.get_by_role("region", name="Channels")).not_to_contain_text(renamed)

    step("messages: a rename shows live, and archiving closes the channel for its members", edit_and_archive)

    def private_channel_access():
        channel = call(
            "POST",
            "/channels",
            lead_token,
            {"name": private_channel, "visibility": "PRIVATE", "description": "Just us."},
        )["conversation"]
        open_conversation_ids["private"] = channel["id"]
        receiver.goto(f"{APP}/messages/{channel['id']}")
        expect(receiver.get_by_role("heading", name="This channel is private")).to_be_visible()
        expect(receiver.get_by_role("link", name="Back to messages")).to_be_visible()

    step("messages: a private channel shows no access from a link", private_channel_access)

    def add_to_private():
        sender.goto(f"{APP}/messages/{open_conversation_ids['private']}")
        sender.get_by_role("button", name="Conversation details").click()
        sender.get_by_role("button", name="Add people").click()
        dialog = sender.get_by_role("dialog", name=re.compile("^Add people"))
        pick_assignee(dialog, intern_user["name"], "People")
        dialog.get_by_role("button", name="Add people").click()
        expect(sender.get_by_text("Added 1 person.")).to_be_visible()
        receiver.goto(f"{APP}/messages")
        expect(receiver.get_by_role("region", name="Channels")).to_contain_text(private_channel)

    step("messages: a member adds someone to a private channel", add_to_private)

    def start_dm():
        receiver.goto(f"{APP}/messages")
        receiver.get_by_role("button", name="New conversation").click()
        receiver.get_by_role("button", name="New direct message").click()
        picker = receiver.get_by_role("dialog", name="New direct message")
        picker.get_by_role("combobox").fill(ana["name"].split()[0])
        picker.get_by_role("option", name=re.compile(ana["name"])).click()
        expect(message_box(receiver, ana["name"])).to_be_visible()
        expect(receiver.get_by_role("heading", name="Say hello to " + ana["name"])).to_be_visible()
        send_message(receiver, ana["name"], f"{PREFIX} hi Ana")
        expect(message_list(receiver).get_by_text(f"{PREFIX} hi Ana")).to_be_visible()

    step("messages: start a DM from the conversation list", start_dm)

    def dm_from_directory():
        dm_url = conversation_named(intern_token, ana["name"])["id"]
        receiver.goto(f"{APP}/directory")
        card = receiver.get_by_role("listitem").filter(has_text=intern_user["name"])
        expect(card.get_by_role("button", name=re.compile("^Message"))).to_have_count(0)
        receiver.get_by_role("button", name=f"Message {ana['name']}").click()
        expect(receiver).to_have_url(f"{APP}/messages/{dm_url}")
        expect(message_list(receiver).get_by_text(f"{PREFIX} hi Ana")).to_be_visible()

    step("messages: Message in the directory opens the same DM, never for yourself", dm_from_directory)

    def load_older():
        admin_channel = call(
            "POST", "/channels", admin_token, {"name": history_channel, "visibility": "PUBLIC"}
        )["conversation"]["id"]
        open_conversation_ids["history"] = admin_channel
        tokens = []
        for person in (ana, ben):
            token = call(
                "POST", "/auth/login", body={"email": person["email"], "password": person["password"]}
            )["token"]
            call("POST", f"/channels/{admin_channel}/join", token)
            tokens.append(token)
        open_conversation_ids["ana_token"] = tokens[0]
        for number in range(60):
            post_message(tokens[number % 2], admin_channel, f"History line {number + 1:02d}.")

        receiver.goto(f"{APP}/messages/{admin_channel}")
        rows = message_list(receiver).get_by_text(re.compile("^History line"))
        expect(rows).to_have_count(50)
        expect(rows.last).to_be_in_viewport()
        receiver.locator(".overflow-y-auto", has=message_list(receiver)).evaluate("el => el.scrollTo(0, 0)")
        expect(rows).to_have_count(60)
        expect(rows.first).to_have_text("History line 01.")
        expect(receiver.get_by_text("History line 11.")).to_be_in_viewport()

    step("messages: scrolling up loads older messages and keeps your place", load_older)

    def rate_limited():
        page = new_page(browser)
        log_in_as(page, ana["email"], ana["password"])
        page.goto(f"{APP}/messages/{open_conversation_ids['history']}")
        text = f"{PREFIX} over the limit"
        send_message(page, f"#{history_channel}", text)
        row = message_list(page).get_by_role("listitem").filter(has_text=text)
        expect(row).to_contain_text("Message didn't send")
        expect(row.get_by_role("button", name="Resend")).to_be_visible()
        page.context.close()

    step("messages: the rate limit keeps the typed text with Resend", rate_limited)

    def mute():
        receiver.goto(f"{APP}/messages/{general_id}")
        receiver.get_by_role("button", name="Conversation details").click()
        receiver.get_by_role("switch", name="Mute this conversation").click()
        expect(receiver.get_by_role("switch", name="Mute this conversation")).to_be_checked()
        receiver.get_by_role("button", name="Close").click()
        receiver.goto(f"{APP}/tasks")
        post_message(lead_token, general_id, f"{PREFIX} while muted")
        nav = receiver.get_by_role("link", name=re.compile("^Internal Messages"))
        receiver.wait_for_timeout(1_000)
        expect(nav).not_to_contain_text("unread")
        post_message(
            lead_token, general_id, f"@[{intern_user['name']}]({intern_user['id']}) still counts"
        )
        expect(nav).to_contain_text("1 unread")
        call("PATCH", f"/conversations/{general_id}/mute", intern_token, {"isMuted": False})

    step("messages: muting leaves out messages, but mentions still count", mute)

    def reconnect():
        receiver.goto(f"{APP}/messages/{general_id}")
        expect(message_box(receiver, "#general")).to_be_visible()
        receiver.route("**/socket.io/**", lambda route: route.abort())
        receiver.evaluate("window.__blockSockets = true; window.__sockets.forEach((s) => s.close())")
        expect(receiver.get_by_text("Reconnecting…")).to_be_visible(timeout=15_000)

        while_down = f"{PREFIX} sent while the socket is down"
        post_message(lead_token, general_id, while_down)
        expect(message_list(receiver).get_by_text(while_down)).to_have_count(1, timeout=20_000)

        gap = f"{PREFIX} sent just before it returns"
        post_message(lead_token, general_id, gap)
        receiver.unroute("**/socket.io/**")
        receiver.evaluate("window.__blockSockets = false")
        expect(receiver.get_by_text("Reconnecting…")).to_be_hidden(timeout=20_000)
        expect(message_list(receiver).get_by_text(gap)).to_have_count(1)
        expect(message_list(receiver).get_by_text(while_down)).to_have_count(1)

        # The socket client reports the block on its way to the fallback. It's the test's own error.
        console_problems[:] = [p for p in console_problems if "Blocked by the test" not in p]

        live = f"{PREFIX} live again"
        post_message(lead_token, general_id, live)
        expect(message_list(receiver).get_by_text(live)).to_have_count(1)

    step("messages: a dropped socket shows Reconnecting, polls, then catches up with no duplicates", reconnect)

    def deactivated_people():
        page = new_page(browser)
        log_in_as(page, ben["email"], ben["password"])
        page.goto(f"{APP}/directory")
        page.get_by_role("button", name=f"Message {dee['name']}").click()
        expect(message_box(page, dee["name"])).to_be_visible()
        page.context.close()
        dee_token = call(
            "POST", "/auth/login", body={"email": dee["email"], "password": dee["password"]}
        )["token"]
        conversation = conversation_named(dee_token, ben["name"])["id"]
        post_message(dee_token, conversation, f"{PREFIX} last words")

        signed_in = new_page(browser)
        log_in_as(signed_in, dee["email"], dee["password"])
        signed_in.goto(f"{APP}/messages/{conversation}")
        expect(message_box(signed_in, ben["name"])).to_be_visible()
        call("POST", f"/users/{dee['id']}/deactivate", admin_token)
        expect(signed_in).to_have_url(re.compile("/login"))
        signed_in.context.close()

        page = new_page(browser)
        log_in_as(page, ben["email"], ben["password"])
        page.goto(f"{APP}/messages/{conversation}")
        name = message_list(page).get_by_text(dee["name"]).first
        expect(name).to_have_class(re.compile("text-text-3"))
        expect(page.get_by_text("is no longer active")).to_be_visible()
        expect(page.get_by_role("combobox")).to_have_count(0)
        page.context.close()

    step("messages: a deactivated person keeps old messages under a muted name", deactivated_people)

    def phone():
        page = new_page(browser, MOBILE)
        log_in(page, "INTERN")
        page.goto(f"{APP}/messages")
        expect(page.locator(".bottom-bar")).to_be_visible()
        expect_no_sideways_scroll(page, "messages list")
        open_conversation(page, "general")
        box = message_box(page, "#general")
        expect(box).to_be_visible()
        expect(box).to_be_in_viewport()
        expect(page.locator(".bottom-bar")).to_have_count(0)
        expect_no_sideways_scroll(page, "conversation")
        text = f"{PREFIX} from a phone"
        send_message(page, "#general", text)
        expect(message_list(page).get_by_text(text)).to_have_count(1)
        page.get_by_role("link", name="Back to messages").click()
        expect(page.get_by_role("heading", name="Messages", exact=True)).to_be_visible()
        expect(page.get_by_role("combobox")).to_have_count(0)
        page.context.close()

        touch = browser.new_context(viewport=MOBILE, has_touch=True, is_mobile=True).new_page()
        log_in(touch, "INTERN")
        touch.goto(f"{APP}/messages/{general_id}")
        row = message_list(touch).get_by_role("listitem").filter(has_text=text)
        expect(row.get_by_role("button", name="Delete message")).to_be_hidden()
        row.get_by_text(text).tap()
        expect(row.get_by_role("button", name="Delete message")).to_be_visible()

        touch.route(
            "**/api/conversations/*/messages",
            lambda route: route.abort() if route.request.method == "POST" else route.fallback(),
        )
        send_message(touch, "#general", f"{PREFIX} failed on a phone")
        expect(touch.get_by_role("button", name="Resend")).to_be_in_viewport()
        touch.context.close()

    step("messages: on a phone the list and the conversation are separate screens", phone)

    def widths():
        for viewport in ({"width": 1280, "height": 800}, WIDE):
            page = new_page(browser, viewport)
            log_in(page, "INTERN")
            page.goto(f"{APP}/messages/{general_id}")
            expect(page.get_by_role("region", name="Channels")).to_be_visible()
            expect(message_box(page, "#general")).to_be_in_viewport()
            expect_no_sideways_scroll(page, f"conversation at {viewport['width']}")
            page.context.close()

    step("messages: both panes fit at 1280 and 1440", widths)

    def logout_closes_socket():
        receiver.goto(f"{APP}/messages/{general_id}")
        expect(message_box(receiver, "#general")).to_be_visible()
        receiver.get_by_role("button", name=re.compile("^Account menu")).click()
        receiver.get_by_role("button", name="Log out").click()
        expect(receiver).to_have_url(re.compile("/login"))
        receiver.wait_for_function(
            "window.__sockets.some((s) => s.url.includes('socket.io')) && "
            "window.__sockets.filter((s) => s.url.includes('socket.io'))"
            ".every((s) => s.readyState !== WebSocket.OPEN)"
        )

    step("messages: logging out closes the socket", logout_closes_socket)

    sender.context.close()
    receiver.context.close()
    for person in (ana, ben):
        call("POST", f"/users/{person['id']}/deactivate", admin_token)


def add_track_item(page, module, kind, title, day=None, link=None, skill=None):
    card = page.locator(".card", has=page.get_by_role("button", name=f"Rename {module}"))
    card.get_by_role("button", name="Add item").click()
    panel = page.get_by_role("dialog", name="New item")
    panel.get_by_label("Type").select_option(kind)
    panel.get_by_label("Title").fill(title)
    if link:
        panel.get_by_label(re.compile("^Link")).fill(link)
    if day is not None:
        panel.get_by_label(re.compile("^Due day")).fill(str(day))
    if skill:
        panel.get_by_label(skill).check()
    panel.get_by_role("button", name="Add item").click()
    expect(page.get_by_text(title, exact=True)).to_be_visible()


def add_track_module(page, title):
    page.get_by_label("New module").fill(title)
    page.get_by_role("button", name="Add module").click()
    expect(page.get_by_role("button", name=f"Rename {title}")).to_be_visible()


def open_track_item(page, title):
    page.get_by_role("button", name=re.compile(re.escape(title))).click()
    return page.get_by_role("dialog", name=title)


def run_learning(browser, admin_token):
    lead_auth = call("POST", "/auth/login", body=dict(zip(("email", "password"), credentials("TEAM_LEAD"))))
    intern_auth = call("POST", "/auth/login", body=dict(zip(("email", "password"), credentials("INTERN"))))
    lead_token, lead_user = lead_auth["token"], lead_auth["user"]
    intern_token, intern_user = intern_auth["token"], intern_auth["user"]
    late = active_user(admin_token, f"E2E Late Learner {RUN}", f"e2e.late.{RUN}@example.test")
    late_token = call("POST", "/auth/login", body={"email": late["email"], "password": late["password"]})["token"]

    title = f"{PREFIX} Frontend basics"
    skill_one, skill_two = f"React {RUN}", f"Testing {RUN}"
    guide, page_work, wrap_up = f"Read the guide {RUN}", f"Build a page {RUN}", f"Wrap up {RUN}"
    state = {}

    lead = new_page(browser)
    learner = new_page(browser)
    log_in(lead, "TEAM_LEAD")
    log_in(learner, "INTERN")

    def hidden_without_enrollment():
        expect(learner.get_by_role("link", name="Daily Check-in")).to_be_visible()
        expect(learner.get_by_role("link", name="Learning", exact=True)).to_have_count(0)
        learner.goto(f"{APP}/learning")
        expect(learner.get_by_role("heading", name="No learning yet")).to_be_visible()
        expect(learner.get_by_role("button", name="New track")).to_have_count(0)

    step("learning: no sidebar item without an enrollment, and a clear empty page", hidden_without_enrollment)

    def role_tabs():
        open_nav_link(lead, "Learning")
        tabs = lead.get_by_role("tablist", name="Learning views")
        for name in ("Review queue", "My learners", "Tracks"):
            expect(tabs.get_by_role("tab", name=name)).to_be_visible()
        expect(tabs.get_by_role("tab", name="All learners")).to_have_count(0)
        expect(tabs.get_by_role("tab", name="My learning")).to_have_count(0)
        expect(lead.get_by_role("heading", name="Nothing waiting for review")).to_be_visible()

    step("learning: a Team Lead gets the reviewer tabs, without All learners", role_tabs)

    def build_track():
        lead.get_by_role("button", name="New track").click()
        dialog = lead.get_by_role("dialog", name="New track")
        dialog.get_by_label("Title").fill(title)
        dialog.get_by_role("button", name="Create track").click()
        expect(lead.get_by_role("heading", name=title)).to_be_visible()
        expect(lead).to_have_url(re.compile(r"/learning/tracks/[0-9a-f-]{36}$"))
        state["track"] = lead.url.rsplit("/", 1)[1]
        expect(lead.get_by_role("button", name="Publish")).to_be_disabled()

        lead.get_by_label(re.compile("^Description")).fill("The first month.")
        lead.get_by_role("button", name="Save details").click()
        expect(lead.get_by_text("Track saved.")).to_be_visible()

        for skill in (skill_one, skill_two):
            lead.get_by_label("New skill").fill(skill)
            lead.get_by_role("button", name="Add", exact=True).click()
            expect(lead.get_by_role("button", name=f"Rename {skill}")).to_be_visible()

        add_track_module(lead, "Week 1")
        add_track_module(lead, "Week 2")
        add_track_item(lead, "Week 1", "RESOURCE", wrap_up, day=5, link="https://example.test/wrap")
        add_track_item(lead, "Week 1", "RESOURCE", guide, day=1, link="https://example.test/guide")
        add_track_item(lead, "Week 2", "ASSIGNMENT", page_work, day=3, skill=skill_one)

    step("learning: build a draft with details, skills, modules and items", build_track)

    def bad_link():
        card = lead.locator(".card", has=lead.get_by_role("button", name="Rename Week 2"))
        card.get_by_role("button", name="Add item").click()
        panel = lead.get_by_role("dialog", name="New item")
        panel.get_by_label("Title").fill("Insecure")
        panel.get_by_label(re.compile("^Link")).fill("http://example.test")
        panel.get_by_role("button", name="Add item").click()
        expect(panel.get_by_text("Use a full https link.")).to_be_visible()
        panel.get_by_role("button", name="Close").click()

    step("learning: an item link must be https", bad_link)

    def titles():
        track = call("GET", f"/learning/tracks/{state['track']}", lead_token)["track"]
        return [[item["title"] for item in module["items"]] for module in track["modules"]]

    def reorder():
        rows = lead.locator(".track-item")
        rows.filter(has_text=guide).drag_to(rows.filter(has_text=wrap_up))
        expect(rows.first).to_contain_text(guide)
        assert titles() == [[guide, wrap_up], [page_work]], titles()

        lead.get_by_role("button", name=f"Move {wrap_up} down").click()
        expect(lead.locator(".card", has=lead.get_by_role("button", name="Rename Week 2")).locator(".track-item").first).to_contain_text(wrap_up)
        assert titles() == [[guide], [wrap_up, page_work]], titles()

        lead.get_by_role("button", name=f"Move {page_work} up").click()
        expect(lead.locator(".card", has=lead.get_by_role("button", name="Rename Week 2")).locator(".track-item").first).to_contain_text(page_work)
        assert titles() == [[guide], [page_work, wrap_up]], titles()

    step("learning: drag and arrow buttons reorder items, across modules too", reorder)

    def publish_and_enroll():
        lead.get_by_role("button", name="Publish").click()
        expect(lead.get_by_text(re.compile("^Published ·"))).to_be_visible()
        lead.get_by_role("button", name="Enroll learners").click()
        dialog = lead.get_by_role("dialog", name="Enroll learners")
        expect(dialog.get_by_label("Track")).to_have_value(state["track"])
        dialog.get_by_role("button", name="Enroll", exact=True).click()
        expect(dialog.get_by_text("Choose at least one learner.")).to_be_visible()
        pick_assignee(dialog, intern_user["name"], "Learners")
        expect(dialog.get_by_label("Mentor").locator("option", has_text=intern_user["name"])).to_have_count(0)
        dialog.get_by_label("Mentor").select_option(lead_user["id"])
        dialog.get_by_role("button", name="Enroll", exact=True).click()
        expect(lead.get_by_text("Enrolled 1 learner.")).to_be_visible()

    step("learning: publish, then enroll a learner with a mentor", publish_and_enroll)

    def double_enroll():
        lead.get_by_role("button", name="Enroll learners").click()
        dialog = lead.get_by_role("dialog", name="Enroll learners")
        pick_assignee(dialog, intern_user["name"], "Learners")
        dialog.get_by_label("Mentor").select_option(lead_user["id"])
        dialog.get_by_role("button", name="Enroll", exact=True).click()
        expect(dialog.get_by_text(re.compile("Nobody was enrolled"))).to_be_visible()
        dialog.get_by_role("button", name="Cancel").click()

    step("learning: enrolling someone twice says nobody was added", double_enroll)

    def foreign_track():
        track = call("POST", "/learning/tracks", admin_token, {"title": f"{PREFIX} Admin track"})["track"]
        lead.goto(f"{APP}/learning/tracks/{track['id']}")
        expect(lead.get_by_role("heading", name=f"{PREFIX} Admin track")).to_be_visible()
        expect(lead.get_by_role("button", name="Publish")).to_have_count(0)
        expect(lead.get_by_role("button", name="Add module")).to_have_count(0)
        expect(lead.get_by_role("button", name="Save details")).to_have_count(0)
        expect(lead.get_by_label("Title")).to_be_disabled()

    step("learning: a Team Lead can read someone else's track, but not edit it", foreign_track)

    def my_learning():
        learner.goto(f"{APP}/")
        expect(learner.get_by_role("link", name="Learning", exact=True)).to_be_visible()
        expect(learner.get_by_role("link", name="Open my learning")).to_contain_text(guide)
        learner.get_by_role("link", name="Open my learning").click()
        card = learner.get_by_role("link", name=re.compile(re.escape(title)))
        expect(card).to_contain_text("On track")
        expect(card).to_contain_text("Next up")
        expect(card).to_contain_text(guide)
        expect(card.get_by_role("img", name=re.compile("0% complete"))).to_be_visible()
        card.click()
        expect(learner.get_by_role("heading", name=title)).to_be_visible()
        state["enrollment"] = learner.url.rsplit("/", 1)[1]

    step("learning: the dashboard and My learning show progress, health and next up", my_learning)

    def resource():
        panel = open_track_item(learner, guide)
        expect(panel.get_by_role("link", name="Open link")).to_have_attribute("href", "https://example.test/guide")
        panel.get_by_role("button", name="Mark as done").click()
        expect(learner.get_by_text("Marked as done.")).to_be_visible()
        expect(learner.get_by_role("button", name=re.compile(re.escape(guide)))).to_contain_text("Done")
        expect(learner.get_by_role("img", name=re.compile("33% complete"))).to_be_visible()

    step("learning: a resource opens its link and can be marked as done", resource)

    def submit():
        panel = open_track_item(learner, page_work)
        panel.get_by_role("button", name="Submit", exact=True).click()
        expect(panel.get_by_text("Add a short note for your reviewer.")).to_be_visible()
        panel.get_by_label(re.compile("^Link to your work")).fill("http://insecure.test")
        panel.get_by_label("Note").fill("Ready for review.")
        panel.get_by_role("button", name="Submit", exact=True).click()
        expect(panel.get_by_text("Use a full https link.")).to_be_visible()
        panel.get_by_label(re.compile("^Link to your work")).fill("https://example.test/first")
        panel.get_by_role("button", name="Submit", exact=True).click()
        expect(learner.get_by_role("button", name=re.compile(re.escape(page_work)))).to_contain_text("Waiting for review")

    step("learning: an assignment takes a link and note, checked before sending", submit)

    def request_changes():
        lead.goto(f"{APP}/")
        tile = lead.get_by_role("link", name=re.compile("^Awaiting review"))
        expect(tile).to_contain_text("1")
        tile.click()
        lead.get_by_role("button", name=re.compile(re.escape(page_work))).click()
        panel = lead.get_by_role("dialog", name=page_work)
        expect(panel.get_by_role("link", name="https://example.test/first")).to_be_visible()
        expect(panel.get_by_text("Ready for review.")).to_be_visible()
        panel.get_by_role("button", name="Request changes").click()
        expect(panel.get_by_text("Say what needs to change.")).to_be_visible()
        panel.get_by_label("Feedback").fill("Add the empty state.")
        panel.get_by_role("group", name="Score").get_by_role("button", name="2 out of 5").click()
        panel.get_by_role("button", name="Request changes").click()
        expect(lead.get_by_role("heading", name="Nothing waiting for review")).to_be_visible()

    step("learning: the review queue opens the work, and changes need feedback", request_changes)

    def resubmit():
        learner.reload()
        row = learner.get_by_role("button", name=re.compile(re.escape(page_work)))
        expect(row).to_contain_text("Changes requested")
        row.click()
        panel = learner.get_by_role("dialog", name=page_work)
        expect(panel.get_by_text("Add the empty state.")).to_be_visible()
        expect(panel.get_by_text("Score 2 of 5")).to_be_visible()
        panel.get_by_label("Note").fill("Added it.")
        panel.get_by_role("button", name="Resubmit").click()
        expect(row).to_contain_text("Waiting for review")

    step("learning: requested changes show the feedback and offer Resubmit", resubmit)

    def approve():
        lead.goto(f"{APP}/learning?tab=reviews")
        lead.get_by_role("button", name=re.compile(re.escape(page_work))).click()
        panel = lead.get_by_role("dialog", name=page_work)
        expect(panel.get_by_text("Latest submission · attempt 2")).to_be_visible()
        panel.get_by_role("group", name="Score").get_by_role("button", name="4 out of 5").click()
        panel.get_by_role("button", name="Approve").click()
        expect(lead.get_by_role("heading", name="Nothing waiting for review")).to_be_visible()

    step("learning: a reviewer approves the second attempt with a score", approve)

    def rate_self():
        learner.reload()
        learner.get_by_role("button", name="Rate myself").click()
        dialog = learner.get_by_role("dialog", name="Rate myself")
        expect(dialog.get_by_role("button", name="Save ratings")).to_be_disabled()
        dialog.get_by_role("group", name=skill_one).get_by_role("button", name="3 out of 5").click()
        dialog.get_by_role("button", name="Save ratings").click()
        row = learner.get_by_role("row", name=re.compile(skill_one))
        expect(row.get_by_role("cell").nth(2)).to_have_text("3")

    step("learning: a learner rates themselves, and the score shows", rate_self)

    def mentor_page():
        lead.goto(f"{APP}/learning/enrollments/{state['enrollment']}")
        expect(lead.get_by_role("heading", name=title)).to_be_visible()
        expect(lead.get_by_text("Changes requested", exact=True).first).to_be_visible()
        expect(lead.get_by_text("4 of 5")).to_be_visible()
        expect(lead.get_by_role("heading", name="Skill ratings over time")).to_be_visible()

        for score in ("2", "4"):
            lead.get_by_role("button", name="Rate skills").click()
            dialog = lead.get_by_role("dialog", name="Rate skills")
            dialog.get_by_role("group", name=skill_one).get_by_role("button", name=f"{score} out of 5").click()
            dialog.get_by_role("button", name="Save ratings").click()
            expect(dialog).to_be_hidden()

        row = lead.get_by_role("row", name=re.compile(skill_one)).first
        expect(row.get_by_role("cell").nth(1)).to_have_text("4")
        expect(row.get_by_title("Improving")).to_be_visible()
        expect(lead.get_by_role("img", name=re.compile(f"^{skill_one}: 3 ratings"))).to_be_visible()
        lead.get_by_text("View as a table").click()
        expect(lead.get_by_role("table", name="Every skill rating").get_by_role("row")).to_have_count(4)

        open_track_item(lead, wrap_up)
        panel = lead.get_by_role("dialog", name=wrap_up)
        expect(panel.get_by_role("button", name="Mark as done")).to_have_count(0)
        panel.get_by_role("button", name="Close").click()

    step("learning: the mentor sees the chart, scores and Rate skills, but can't do the work", mentor_page)

    def finish():
        learner.reload()
        panel = open_track_item(learner, wrap_up)
        panel.get_by_role("button", name="Mark as done").click()
        expect(learner.get_by_role("img", name=re.compile("100% complete"))).to_be_visible()
        expect(learner.locator("main").get_by_text("Completed", exact=True)).to_be_visible()

    step("learning: finishing the last item completes the track", finish)

    def behind_first():
        long_ago = call("GET", "/learning/tracks", lead_token)["tracks"]
        assert any(track["id"] == state["track"] for track in long_ago)
        start = (datetime.now(timezone.utc) - timedelta(days=12)).strftime("%Y-%m-%d")
        enrolled = call(
            "POST",
            "/learning/enrollments",
            lead_token,
            {"trackId": state["track"], "learnerIds": [late["id"]], "mentorId": lead_user["id"], "startDate": start},
        )["enrollments"][0]
        state["late_enrollment"] = enrolled["id"]

        lead.goto(f"{APP}/")
        behind = lead.get_by_role("link", name=re.compile("^Learners behind"))
        expect(behind).to_contain_text("1")
        behind.click()
        expect(lead).to_have_url(re.compile("tab=learners&health=BEHIND"))
        table = lead.get_by_role("region", name="Learners")
        expect(table).to_contain_text(late["name"])
        expect(table).not_to_contain_text(intern_user["name"])

        lead.get_by_label("Health").select_option("")
        expect(table).to_contain_text(intern_user["name"])
        expect(table.get_by_role("row").nth(1)).to_contain_text(late["name"])
        expect(table.get_by_role("row").nth(2)).to_contain_text("Completed")

        lead.get_by_label("Health").select_option("PAUSED")
        expect(lead.get_by_role("heading", name="Nobody matches this filter")).to_be_visible()
        lead.get_by_role("button", name="Clear filter").click()
        expect(lead.get_by_role("region", name="Learners")).to_be_visible()

    step("learning: Learners behind links to a filtered table, with Behind first", behind_first)

    def all_learners():
        admin = new_page(browser)
        log_in(admin, "SUPER_ADMIN")
        admin.goto(f"{APP}/learning?tab=all")
        tabs = admin.get_by_role("tablist", name="Learning views")
        expect(tabs.get_by_role("tab", name="All learners")).to_have_attribute("aria-selected", "true")
        table = admin.get_by_role("region", name="Learners")
        expect(table).to_contain_text(late["name"])
        table.get_by_role("link", name=late["name"]).click()
        admin.get_by_role("button", name="Pause").click()
        admin.get_by_role("dialog").get_by_role("button", name="Pause").click()
        expect(admin.locator("main").get_by_text("Paused", exact=True)).to_be_visible()
        admin.context.close()

        page = new_page(browser)
        log_in_as(page, late["email"], late["password"])
        page.goto(f"{APP}/learning/enrollments/{state['late_enrollment']}")
        panel = open_track_item(page, guide)
        expect(panel.get_by_role("link", name="Open link")).to_be_visible()
        expect(panel.get_by_role("button", name="Mark as done")).to_have_count(0)
        page.context.close()

    step("learning: All learners for admins, and pausing stops a learner's actions", all_learners)

    def no_access():
        page = new_page(browser)
        log_in_as(page, late["email"], late["password"])
        page.goto(f"{APP}/learning/enrollments/{state['enrollment']}")
        expect(page.get_by_role("heading", name="This learning record isn't yours to see")).to_be_visible()
        expect(page.get_by_role("link", name="Back to learning")).to_be_visible()
        page.goto(f"{APP}/learning/tracks/{state['track']}")
        expect(page.get_by_role("heading", name="You don't have access to this")).to_be_visible()
        page.context.close()

    step("learning: someone else's progress and the builder show no access", no_access)

    def failures():
        def refuse(route):
            return route.fulfill(status=500, json={"error": {"code": "E2E", "message": "Server trouble."}})

        learner.route("**/api/learning/enrollments?*", refuse)
        learner.goto(f"{APP}/learning")
        expect(learner.get_by_role("heading", name="Couldn't load your learning")).to_be_visible()
        learner.unroute("**/api/learning/enrollments?*")
        learner.get_by_role("button", name="Try again").click()
        expect(learner.get_by_role("link", name=re.compile(re.escape(title)))).to_be_visible()

    step("learning: a failed load offers Try again", failures)

    def fits_every_width():
        for viewport in (MOBILE, {"width": 1280, "height": 800}, WIDE):
            label = f"at {viewport['width']}"
            page = new_page(browser, viewport)
            log_in(page, "TEAM_LEAD")
            for path in (
                "/learning?tab=learners",
                "/learning?tab=tracks",
                f"/learning/tracks/{state['track']}",
                f"/learning/enrollments/{state['enrollment']}",
            ):
                page.goto(f"{APP}{path}")
                expect(page.get_by_text(re.compile(re.escape(RUN))).first).to_be_visible()
                expect_no_sideways_scroll(page, f"{path} {label}")
            page.context.close()

    step("learning: reviewer pages fit 375, 1280 and 1440", fits_every_width)

    lead.context.close()
    learner.context.close()
    call("POST", f"/users/{late['id']}/deactivate", admin_token)


def run_departments(browser, admin_token):
    lead_login = dict(zip(("email", "password"), credentials("TEAM_LEAD")))
    intern_login = dict(zip(("email", "password"), credentials("INTERN")))
    lead_auth = call("POST", "/auth/login", body=lead_login)
    lead_user, lead_token = lead_auth["user"], lead_auth["token"]
    intern_user = call("POST", "/auth/login", body=intern_login)["user"]
    lead_name, intern_name = lead_user["name"], intern_user["name"]
    invited, invited_email = f"E2E Placed {RUN}", f"e2e.placed.{RUN}@example.test"
    department_name, position_name = f"E2E Studio {RUN}", f"E2E Animator {RUN}"
    stand_in, stand_in_email = f"E2E Stand-in {RUN}", f"e2e.standin.{RUN}@example.test"

    departments = call("GET", "/departments", admin_token)["departments"]
    by_name = {department["name"]: department for department in departments}
    creative, engineering = by_name["Creative"], by_name["Engineering"]
    designer = next(p for p in creative["positions"] if p["name"] == "Graphic Designer")

    def clear(user_id):
        call("PATCH", f"/users/{user_id}", admin_token, {"departmentId": None, "positionId": None})

    # Everyone but the seeded admin may carry a placement from an earlier run.
    clear(lead_user["id"])
    clear(intern_user["id"])

    admin = new_page(browser)
    log_in(admin, "SUPER_ADMIN")
    lead = new_page(browser)
    log_in(lead, "TEAM_LEAD")
    intern = new_page(browser)
    log_in(intern, "INTERN")
    bodies = []

    def record(request):
        if request.method in ("POST", "PATCH") and "/users" in request.url and request.post_data:
            bodies.append(json.loads(request.post_data))

    admin.on("request", record)

    def falls_back():
        expect(lead.locator(".topbar .me")).to_contain_text("Team Lead")
        call("PATCH", f"/users/{lead_user['id']}", admin_token, {"departmentId": creative["id"]})
        lead.reload()
        expect(lead.locator(".topbar .me")).to_contain_text("Creative")
        expect(lead.locator(".topbar .me")).not_to_contain_text("Team Lead")
        call(
            "PATCH",
            f"/users/{lead_user['id']}",
            admin_token,
            {"departmentId": creative["id"], "positionId": designer["id"]},
        )
        lead.reload()
        expect(lead.locator(".topbar .me")).to_contain_text("Graphic Designer")
        lead.locator(".topbar .me").click()
        expect(lead.locator(".popover")).to_contain_text("Graphic Designer")
        clear(lead_user["id"])
    step("Display: position, then department, then access level", falls_back)

    def prompt():
        admin.goto(f"{APP}/")
        banner = admin.get_by_role("status").filter(has_text="no department")
        expect(banner).to_be_visible()
        expect(lead.get_by_text("no department")).to_have_count(0)
        lead.goto(f"{APP}/")
        expect(lead.get_by_role("heading", level=1)).to_be_visible()
        expect(lead.get_by_text("no department")).to_have_count(0)
        banner.get_by_role("link", name="Assign them").click()
        expect(admin).to_have_url(re.compile(r"/users\?department=none$"))
        expect(admin.get_by_label("Department")).to_have_value("none")
        expect(admin.get_by_role("row", name=re.compile(re.escape(lead_name)))).to_be_visible()
        expect(admin.get_by_text("Pat Pending")).to_have_count(0)
    step("Dashboard prompt: Super Admin only, opens the active people with no department", prompt)

    def edit_placement():
        admin.get_by_role("button", name=f"Edit {lead_name}").click()
        dialog = admin.get_by_role("dialog")
        expect(dialog.get_by_label("Access level")).to_be_visible()
        expect(dialog.get_by_label("Position")).to_be_disabled()
        dialog.get_by_label("Department").select_option(label="Creative")
        options = dialog.get_by_label("Position").locator("option").all_inner_texts()
        assert "Graphic Designer" in options and "Backend Developer" not in options, options
        dialog.get_by_label("Position").select_option(label="Graphic Designer")
        bodies.clear()
        dialog.get_by_role("button", name="Save changes").click()
        expect(dialog).to_have_count(0)
        assert bodies == [{"departmentId": creative["id"], "positionId": designer["id"]}], bodies
        expect(admin.get_by_role("row", name=re.compile(re.escape(lead_name)))).to_have_count(0)
    step("Edit user: positions follow the department, both sent, row leaves the no-department list", edit_placement)

    def move_department():
        admin.get_by_label("Department").select_option(label="Creative")
        row = admin.get_by_role("row", name=re.compile(re.escape(lead_name)))
        expect(row.get_by_role("cell", name="Graphic Designer")).to_be_visible()
        expect(admin.get_by_role("row", name=re.compile(re.escape(intern_name)))).to_have_count(0)
        admin.get_by_role("button", name=f"Edit {lead_name}").click()
        dialog = admin.get_by_role("dialog")
        expect(dialog.get_by_label("Position")).to_have_value(designer["id"])
        dialog.get_by_label("Department").select_option(label="Engineering")
        expect(dialog.get_by_label("Position")).to_have_value("")
        bodies.clear()
        dialog.get_by_role("button", name="Save changes").click()
        expect(dialog).to_have_count(0)
        assert bodies == [{"departmentId": engineering["id"], "positionId": None}], bodies
        admin.get_by_label("Department").select_option(label="Engineering")
        row = admin.get_by_role("row", name=re.compile(re.escape(lead_name)))
        expect(row.get_by_role("cell", name="Engineering")).to_be_visible()
        expect(row.get_by_text("Team Lead", exact=True)).to_be_visible()
    step("Moving department clears the position and sends both, so the API accepts it", move_department)

    def invite_form():
        admin.get_by_label("Department").select_option("")
        admin.get_by_role("button", name="Invite user").click()
        dialog = admin.get_by_role("dialog")
        labels = dialog.locator("label").all_inner_texts()
        order = [next(i for i, text in enumerate(labels) if text.startswith(name)) for name in
                 ("Full name", "Work email", "Department", "Position", "Access level")]
        assert order == sorted(order), labels
        dialog.get_by_label("Full name").fill(invited)
        dialog.get_by_label("Work email").fill(invited_email)
        dialog.get_by_label("Department").select_option(label="Creative")
        dialog.get_by_label("Position").select_option(label="Graphic Designer")
        dialog.get_by_label("Access level").select_option("INTERN")
        bodies.clear()
        dialog.get_by_role("button", name="Send invite").click()
        expect(dialog.get_by_text(f"Invite sent to {invited_email}")).to_be_visible()
        assert bodies[0]["departmentId"] == creative["id"] and bodies[0]["positionId"] == designer["id"], bodies
        dialog.get_by_role("button", name="Done").click()
    step("Invite form: name, email, department, position, access level, sent together", invite_form)

    def everywhere():
        call(
            "PATCH",
            f"/users/{intern_user['id']}",
            admin_token,
            {"departmentId": creative["id"], "positionId": designer["id"]},
        )
        title = f"{PREFIX} placed task"
        task = call("POST", "/tasks", lead_token, {"title": title, "assigneeIds": [intern_user["id"]]})["task"]
        assert task["assignees"][0]["position"]["name"] == "Graphic Designer", task["assignees"]

        lead.goto(f"{APP}/tasks?view=team")
        lead.goto(f"{APP}/tasks/{task['id']}")
        expect(lead.get_by_role("listitem").filter(has_text=intern_name)).to_contain_text("Graphic Designer")

        lead.goto(f"{APP}/tasks")
        lead.get_by_role("button", name="New task").click()
        dialog = lead.get_by_role("dialog")
        dialog.get_by_role("combobox", name="Assignee").click()
        dialog.get_by_role("combobox", name="Assignee").fill(intern_name.split()[0])
        option = dialog.get_by_role("option", name=re.compile(re.escape(intern_name)))
        expect(option.locator("span").nth(1)).to_have_text("Graphic Designer")
        dialog.get_by_role("button", name="Cancel").click()

        call("PUT", "/checkins/today", call("POST", "/auth/login", body=intern_login)["token"],
             {"workCompleted": "Finished.", "priorities": "Today's plan.", "blockers": "", "taskIds": []})
        lead.goto(f"{APP}/daily?tab=team")
        expect(lead.locator("main").get_by_text("Graphic Designer").first).to_be_visible()

        project = call("POST", "/projects", lead_token, {
            "name": f"{PREFIX} placed project", "memberIds": [intern_user["id"]],
        })["project"]
        lead.goto(f"{APP}/projects/{project['id']}")
        expect(lead.get_by_role("listitem").filter(has_text=intern_name).filter(has_text="Graphic Designer").first).to_be_visible()

        today = datetime.now(timezone(timedelta(hours=1))).strftime("%Y-%m-%d")
        meeting = call("POST", "/meetings", lead_token, {
            "title": f"{PREFIX} placed meeting",
            "startsAt": f"{today}T22:00:00+01:00",
            "endsAt": f"{today}T22:30:00+01:00",
            "attendeeIds": [intern_user["id"]],
        })["meeting"]
        lead.goto(f"{APP}/calendar?meeting={meeting['id']}")
        panel = lead.get_by_role("dialog")
        expect(panel.get_by_role("listitem").filter(has_text=intern_name)).to_contain_text("Graphic Designer")
    step("Task, assignee picker, check-ins, project members and attendees show the position", everywhere)

    def directory():
        intern.goto(f"{APP}/directory")
        group = intern.get_by_role("region", name="Creative", exact=True)
        expect(group.get_by_text(intern_name)).to_be_visible()
        expect(group.get_by_text("Graphic Designer")).to_be_visible()
        expect(intern.get_by_role("region", name="No department")).to_be_visible()
        intern.get_by_label("Department", exact=True).select_option(label="Engineering")
        expect(intern.locator("main").get_by_text(lead_name)).to_be_visible()
        expect(intern.locator("main").get_by_text(intern_name)).to_have_count(0)
        expect(intern.get_by_role("region", name="Creative", exact=True)).to_have_count(0)
    step("Directory: grouped by department, filters, position under each name", directory)

    def settings():
        intern.goto(f"{APP}/settings")
        details = intern.locator("dl")
        expect(details.get_by_text("Department")).to_be_visible()
        expect(details.get_by_text("Creative")).to_be_visible()
        expect(details.get_by_text("Graphic Designer")).to_be_visible()
        expect(details.get_by_text("Access level")).to_be_visible()
        expect(details.get_by_text("Intern", exact=True)).to_be_visible()
        expect(intern.locator("main select")).to_have_count(0)
    step("Settings: department and position are read only, Role reads Access level", settings)

    def only_super_admin():
        expect(admin.get_by_role("link", name="Departments", exact=True)).to_be_visible()
        expect(lead.get_by_role("link", name="Departments", exact=True)).to_have_count(0)
        lead.goto(f"{APP}/departments")
        expect(lead.get_by_role("heading", name="Departments")).to_have_count(0)
        try:
            call("GET", "/departments?includeArchived=true", lead_token)
            raise AssertionError("The server should refuse archived departments to a Team Lead")
        except urllib.error.HTTPError as error:
            assert error.code == 403, error.code
    step("Departments page: Super Admin only, and the server agrees", only_super_admin)

    panel = admin.get_by_role("dialog")

    def add_department():
        open_nav_link(admin, "Departments")
        admin.get_by_role("button", name="Add department").click()
        panel.get_by_role("button", name="Add department").click()
        expect(panel.get_by_text("Enter a department name.")).to_be_visible()
        panel.get_by_label("Name").fill("creative")
        panel.get_by_role("button", name="Add department").click()
        expect(panel.get_by_text(re.compile("already exists"))).to_be_visible()
        panel.get_by_label("Name").fill(department_name)
        panel.get_by_label("Description").fill("Motion work.")
        panel.get_by_role("button", name="Add department").click()
        expect(panel.get_by_label("New position")).to_be_visible()
        panel.get_by_label("New position").fill(position_name)
        panel.get_by_role("button", name="Add", exact=True).click()
        expect(panel.get_by_text(position_name)).to_be_visible()
        panel.get_by_label("New position").fill(position_name.lower())
        panel.get_by_role("button", name="Add", exact=True).click()
        expect(panel.get_by_text(re.compile("already has a position"))).to_be_visible()
        panel.get_by_label("New position").fill("")
    step("Departments: add, name taken on the field, then add a position, case-only duplicate refused", add_department)

    def set_lead():
        picker = panel.get_by_role("combobox", name="Lead")
        picker.click()
        picker.fill(lead_name.split()[0])
        panel.get_by_role("option", name=re.compile(re.escape(lead_name))).click()
        panel.get_by_role("button", name="Save changes").click()
        expect(panel).to_have_count(0)
        card = admin.get_by_role("listitem").filter(has=admin.get_by_role("heading", name=department_name))
        expect(card).to_contain_text(lead_name)
        expect(card).to_contain_text("0 members")
        expect(card).to_contain_text("1 position")
    step("Departments: set the lead, card shows lead and counts", set_lead)

    def member_count():
        department = next(
            d for d in call("GET", "/departments", admin_token)["departments"] if d["name"] == department_name
        )
        position = department["positions"][0]
        call("PATCH", f"/users/{intern_user['id']}", admin_token,
             {"departmentId": department["id"], "positionId": position["id"]})
        admin.reload()
        card = admin.get_by_role("listitem").filter(has=admin.get_by_role("heading", name=department_name))
        expect(card).to_contain_text("1 member")
    step("Departments: member count follows the people in it", member_count)

    def archive_position():
        admin.get_by_role("button", name=f"Edit {department_name}").click()
        panel.get_by_role("button", name=f"Archive {position_name}").click()
        confirm = admin.get_by_role("dialog", name="Archive position?")
        expect(confirm).to_contain_text("1 person on it will keep it")
        confirm.get_by_role("button", name="Archive").click()
        expect(panel.get_by_role("button", name=f"Restore {position_name}")).to_be_visible()
        panel.get_by_role("button", name="Close", exact=True).first.click()
        expect(panel).to_have_count(0)

        admin.goto(f"{APP}/users")
        admin.get_by_role("button", name=f"Edit {intern_name}").click()
        dialog = admin.get_by_role("dialog")
        select = dialog.get_by_label("Position")
        expect(select.locator("option:checked")).to_have_text(f"{position_name} (archived)")
        dialog.get_by_label("Full name").fill(f"{intern_name}x")
        bodies.clear()
        dialog.get_by_role("button", name="Save changes").click()
        expect(dialog).to_have_count(0)
        assert bodies == [{"name": f"{intern_name}x"}], bodies
        call("PATCH", f"/users/{intern_user['id']}", admin_token, {"name": intern_name})

        admin.reload()
        admin.get_by_role("button", name="Invite user").click()
        dialog = admin.get_by_role("dialog")
        dialog.get_by_label("Department").select_option(label=department_name)
        expect(dialog.get_by_label("Position").locator("option")).to_have_text(["No position"])
        dialog.get_by_role("button", name="Cancel").click()
    step("Archived position: holder keeps it and still saves, nobody new can pick it", archive_position)

    def replaced_lead():
        call("POST", "/users", admin_token, {"name": stand_in, "email": stand_in_email, "role": "TEAM_MEMBER"})
        token = re.search(r"token=(\S+)", emailed_link(stand_in_email, "/set-password")).group(1)
        call("POST", "/auth/set-password", body={"token": token, "newPassword": PASSWORD})
        users = call("GET", "/users?limit=100", admin_token)["users"]
        person = next(user for user in users if user["email"] == stand_in_email)
        department = next(
            d for d in call("GET", "/departments", admin_token)["departments"] if d["name"] == department_name
        )
        call("PATCH", f"/departments/{department['id']}", admin_token, {"leadId": person["id"]})
        call("POST", f"/users/{person['id']}/deactivate", admin_token)
        admin.goto(f"{APP}/departments")
        card = admin.get_by_role("listitem").filter(has=admin.get_by_role("heading", name=department_name))
        expect(card).to_contain_text(f"{stand_in} has been deactivated. Choose a new lead.")
    step("Departments: a deactivated lead raises a warning", replaced_lead)

    def archive_department():
        admin.get_by_role("button", name=f"Edit {department_name}").click()
        panel.get_by_role("button", name="Archive department").click()
        confirm = admin.get_by_role("dialog", name="Archive department?")
        confirm.get_by_role("button", name="Archive").click()
        expect(admin.get_by_role("heading", name=department_name)).to_have_count(0)
        admin.get_by_role("switch", name="Show archived").click()
        expect(admin.get_by_role("heading", name=department_name)).to_be_visible()
        admin.goto(f"{APP}/users")
        admin.get_by_role("button", name=f"Edit {intern_name}").click()
        dialog = admin.get_by_role("dialog")
        expect(dialog.get_by_label("Department").locator("option:checked")).to_have_text(f"{department_name} (archived)")
        dialog.get_by_role("button", name="Cancel").click()
    step("Archived department: leaves the list, can be shown, holder keeps it", archive_department)

    def restore_department():
        admin.goto(f"{APP}/departments")
        admin.get_by_role("switch", name="Show archived").click()
        admin.get_by_role("button", name=f"Edit {department_name}").click()
        panel.get_by_role("button", name="Restore department").click()
        expect(panel.get_by_role("button", name="Archive department")).to_be_visible()
        panel.get_by_role("button", name=f"Restore {position_name}").click()
        expect(panel.get_by_role("button", name=f"Archive {position_name}")).to_be_visible()
    step("Departments: restore a department and a position", restore_department)

    def phones():
        phone = new_page(browser, MOBILE)
        log_in(phone, "SUPER_ADMIN")
        for path, heading in (("/departments", "Departments"), ("/users", "User Management"), ("/directory", "Team Directory")):
            phone.goto(f"{APP}{path}")
            expect(phone.get_by_role("heading", name=heading, level=1)).to_be_visible()
            expect_no_sideways_scroll(phone, path)
        phone.goto(f"{APP}/departments")
        phone.get_by_role("button", name=re.compile("^Edit ")).first.click()
        expect(phone.get_by_role("dialog").get_by_label("New position")).to_be_visible()
        expect_no_sideways_scroll(phone, "department panel")
    step("Departments, users and directory fit 375px", phones)

    # Later checks and the next run start from people with no placement.
    department = next(
        d for d in call("GET", "/departments?includeArchived=true", admin_token)["departments"]
        if d["name"] == department_name
    )
    clear(lead_user["id"])
    clear(intern_user["id"])
    call("PATCH", f"/departments/{department['id']}", admin_token, {"leadId": None, "isArchived": True})


def run_meetings(browser, admin_token):
    title = f"{PREFIX} Bot review"
    block_name = re.compile(re.escape(title))
    secret = f"{PREFIX} private meeting"
    secret_task = f"{PREFIX} private task"
    intern = call("POST", "/auth/login", body=dict(zip(("email", "password"), credentials("INTERN"))))["user"]
    lead_user = call("POST", "/auth/login", body=dict(zip(("email", "password"), credentials("TEAM_LEAD"))))["user"]
    task = call("POST", "/tasks", admin_token, {"title": f"{PREFIX} meeting task", "assigneeIds": [lead_user["id"]]})["task"]

    lead = new_page(browser)
    log_in(lead, "TEAM_LEAD")
    panel = lead.get_by_role("dialog")

    def create():
        expect(lead.get_by_role("link", name="Meetings & Schedule")).not_to_contain_text("Soon")
        expect(lead.get_by_role("link", name="Knowledge & SOPs")).to_contain_text("Soon")
        open_nav_link(lead, "Meetings")
        lead.get_by_role("button", name="New meeting").click()
        panel.get_by_label("Title").fill(title)
        panel.get_by_label("Starts").fill("15:00")
        panel.get_by_label("Ends").fill("14:00")
        panel.get_by_label("Meeting link").fill("http://meet.example.test/abc")
        panel.get_by_role("button", name="Create meeting").click()
        expect(panel.get_by_text("End it after it starts.")).to_be_visible()
        expect(panel.get_by_text("Use a link starting https://")).to_be_visible()
        panel.get_by_label("Ends").fill("15:45")
        panel.get_by_label("Meeting link").fill("https://meet.example.test/abc")
        panel.get_by_label("Location").fill("Board room")
        panel.get_by_label("Agenda").fill("Order sync delay.")
        picker = panel.get_by_role("combobox", name="Attendees")
        picker.click()
        picker.fill(intern["name"].split()[0])
        panel.get_by_role("option", name=re.compile(re.escape(intern["name"]))).click()
        panel.get_by_label("Linked tasks").select_option(label=task["title"])
        panel.get_by_role("button", name="Create meeting").click()
        expect(panel.get_by_role("heading", name=title)).to_be_visible()
        expect(lead.get_by_role("button", name=block_name)).to_be_visible()
    step("Meetings: managers create one, and bad times and http links are caught", create)

    def details():
        expect(panel.get_by_text("Board room")).to_be_visible()
        expect(panel.get_by_text("3:00 to 3:45 PM")).to_be_visible()
        expect(panel.get_by_text("Order sync delay.")).to_be_visible()
        expect(panel.get_by_role("link", name=task["title"])).to_be_visible()
        expect(panel.get_by_text("Organiser")).to_be_visible()
        expect(panel.get_by_text("No reply yet")).to_be_visible()
        join = panel.get_by_role("link", name="Join meeting")
        expect(join).to_have_attribute("href", "https://meet.example.test/abc")
    step("Meetings: the panel shows place, people, agenda, tasks and the join link", details)

    def edit_keeps_lists():
        panel.get_by_role("button", name="Edit").click()
        panel.get_by_label("Location").fill("Ikeja office")
        with lead.expect_request(lambda request: request.method == "PATCH") as saved:
            panel.get_by_role("button", name="Save changes").click()
        body = saved.value.post_data_json
        assert body == {"location": "Ikeja office"}, f"Sent more than the change: {body}"
        expect(lead.get_by_text("Meeting updated.")).to_be_visible()
        expect(panel.get_by_text("Ikeja office")).to_be_visible()
    step("Meetings: a save only sends what changed, so hidden tasks can't be dropped", edit_keeps_lists)

    intern_page = new_page(browser)
    log_in(intern_page, "INTERN")

    def intern_rsvp():
        intern_page.goto(f"{APP}/calendar")
        expect(intern_page.get_by_role("button", name="New meeting")).to_have_count(0)
        intern_page.get_by_role("button", name=block_name).click()
        dialog = intern_page.get_by_role("dialog")
        expect(dialog.get_by_role("button", name="Edit")).to_have_count(0)
        expect(dialog.get_by_role("button", name="Cancel meeting")).to_have_count(0)
        dialog.get_by_role("button", name="Going").click()
        expect(dialog.get_by_role("button", name="Going")).to_have_attribute("aria-pressed", "true")
        expect(dialog.get_by_text("Going", exact=True).last).to_be_visible()
        lead.reload()
        expect(panel.get_by_role("listitem").filter(has_text=intern["name"])).to_contain_text("Going")
    step("Meetings: attendees answer their own invite, with no manager actions", intern_rsvp)

    def dashboard_card():
        intern_page.goto(f"{APP}/")
        card = intern_page.get_by_role("link", name=block_name)
        expect(card).to_be_visible()
        call_token = call("POST", "/auth/login", body=dict(zip(("email", "password"), credentials("INTERN"))))["token"]
        meeting = call("GET", f"/meetings?from={wat_today()}&to={wat_today()}", call_token)["meetings"]
        mine = next(item for item in meeting if item["title"] == title)
        call("POST", f"/meetings/{mine['id']}/rsvp", call_token, {"response": "NO"})
        intern_page.reload()
        expect(intern_page.get_by_role("heading", name="Today's meetings")).to_be_visible()
        expect(card).to_have_count(0)
        call("POST", f"/meetings/{mine['id']}/rsvp", call_token, {"response": "YES"})
    step("Dashboard: Today's meetings lists real meetings and drops invites answered No", dashboard_card)

    def whole_team():
        project = call("POST", "/projects", admin_token, {"name": f"{PREFIX} private project"})["project"]
        hidden = call("POST", "/tasks", admin_token, {"title": secret_task, "projectId": project["id"]})["task"]
        call("POST", "/meetings", admin_token, {
            "title": secret,
            "startsAt": at("16:00"),
            "endsAt": at("16:30"),
            "attendeeIds": [],
            "projectId": project["id"],
            "taskIds": [hidden["id"]],
        })
        intern_page.goto(f"{APP}/calendar")
        name = re.compile(re.escape(secret))
        expect(intern_page.get_by_role("button", name=block_name)).to_be_visible()
        expect(intern_page.get_by_role("button", name=name)).to_have_count(0)
        intern_page.get_by_role("button", name="Whole team").click()
        intern_page.get_by_role("button", name=name).click()
        dialog = intern_page.get_by_role("dialog")
        expect(dialog.get_by_role("heading", name=secret)).to_be_visible()
        expect(dialog.get_by_text("Are you going?")).to_have_count(0)
        expect(dialog.get_by_text("Linked tasks")).to_have_count(0)
        expect(dialog.get_by_text(secret_task)).to_have_count(0)
        expect(dialog.get_by_text(f"{PREFIX} private project")).to_have_count(0)
        expect(intern_page.get_by_text("Something went wrong")).to_have_count(0)
    step("Meetings: Whole team shows everyone's, hiding what the viewer can't see", whole_team)

    def only_organizer_edits():
        lead.goto(f"{APP}/calendar")
        lead.get_by_role("button", name="Whole team").click()
        lead.get_by_role("button", name=re.compile(re.escape(secret))).click()
        expect(panel.get_by_role("heading", name=secret)).to_be_visible()
        expect(panel.get_by_role("button", name="Edit")).to_have_count(0)
        admin = new_page(browser)
        log_in(admin, "SUPER_ADMIN")
        admin.goto(lead.url)
        expect(admin.get_by_role("dialog").get_by_role("button", name="Edit")).to_be_visible()
        admin.context.close()
    step("Meetings: Team Leads only edit their own, and Super Admin can edit any", only_organizer_edits)

    def overlaps():
        call("POST", "/meetings", admin_token, {
            "title": f"{PREFIX} overlap",
            "startsAt": at("15:15"),
            "endsAt": at("15:45"),
            "attendeeIds": [],
        })
        page = new_page(browser)
        log_in(page, "SUPER_ADMIN")
        page.goto(f"{APP}/calendar")
        page.get_by_role("button", name="Whole team").click()
        first = page.get_by_role("button", name=block_name).bounding_box()
        second = page.get_by_role("button", name=re.compile(re.escape(f"{PREFIX} overlap"))).bounding_box()
        assert first["x"] + first["width"] <= second["x"] + 1 or second["x"] + second["width"] <= first["x"] + 1, "They overlap"
        page.context.close()
    step("Meetings: overlapping meetings sit side by side", overlaps)

    def wat_for_everyone():
        context = browser.new_context(viewport=LAPTOP, timezone_id="America/New_York")
        page = context.new_page()
        log_in(page, "INTERN")
        page.goto(f"{APP}/calendar")
        page.get_by_role("button", name=block_name).click()
        expect(page.get_by_role("dialog").get_by_text("3:00 to 3:45 PM")).to_be_visible()
        context.close()
    step("Meetings: times stay in WAT for a viewer in another timezone", wat_for_everyone)

    def phone():
        page = new_page(browser, MOBILE)
        log_in(page, "INTERN")
        page.goto(f"{APP}/calendar")
        expect(page.get_by_role("group", name="Pick a day")).to_be_visible()
        expect(page.get_by_role("region", name="Schedule")).to_have_count(0)
        expect_no_sideways_scroll(page, "/calendar")
        page.get_by_role("button", name=block_name).click()
        box = page.get_by_role("dialog").bounding_box()
        assert box["width"] >= MOBILE["width"] - 1, "The panel isn't full screen"
        page.context.close()
    step("Meetings: phones get a day strip and agenda, with a full-screen panel", phone)

    def day_view():
        lead.goto(f"{APP}/calendar")
        lead.get_by_role("button", name="Day", exact=True).click()
        expect(lead.locator(".week-day")).to_have_count(1)
        expect(lead.get_by_role("button", name="Next day")).to_be_visible()
        lead.get_by_role("button", name="Week", exact=True).click()
        lead.get_by_role("button", name="Show task deadlines").click()
        expect(lead.locator(".chip.on", has_text="Show task deadlines")).to_be_visible()
    step("Meetings: Day and Week views, and the task deadlines overlay", day_view)

    def cancel():
        lead.goto(f"{APP}/calendar")
        lead.get_by_role("button", name=block_name).click()
        panel.get_by_role("button", name="Cancel meeting").click()
        confirm = lead.get_by_role("dialog").filter(has_text="Cancel this meeting?")
        expect(confirm.get_by_text("struck through")).to_be_visible()
        confirm.get_by_role("button", name="Cancel meeting").click()
        expect(lead.get_by_text("Meeting cancelled.")).to_be_visible()
        block = lead.get_by_role("button", name=re.compile(re.escape(title) + ".*cancelled"))
        expect(block).to_have_css("text-decoration-line", "line-through")
        expect(panel.get_by_role("link", name="Join meeting")).to_have_count(0)
        expect(panel.get_by_role("button", name="Edit")).to_have_count(0)
        intern_page.goto(f"{APP}/calendar")
        expect(intern_page.get_by_role("button", name=re.compile(re.escape(title) + ".*cancelled"))).to_be_visible()
    step("Meetings: cancel asks first, then stays struck through for attendees", cancel)

    def cancelled_hidden_from_others():
        token = call("POST", "/auth/login", body=dict(zip(("email", "password"), credentials("TEAM_LEAD"))))["token"]
        mine = call("POST", "/meetings", admin_token, {
            "title": f"{PREFIX} called off",
            "startsAt": at("17:00"),
            "endsAt": at("17:30"),
            "attendeeIds": [],
        })["meeting"]
        call("POST", f"/meetings/{mine['id']}/cancel", admin_token)
        seen = call("GET", f"/meetings?from={wat_today()}&to={wat_today()}&scope=team", token)["meetings"]
        assert mine["id"] not in [item["id"] for item in seen]
        intern_page.goto(f"{APP}/calendar")
        intern_page.get_by_role("button", name="Whole team").click()
        expect(intern_page.get_by_role("button", name=re.compile(re.escape(f"{PREFIX} called off")))).to_have_count(0)
    step("Meetings: cancelled meetings stay off Whole team for people not invited", cancelled_hidden_from_others)

    def states():
        page = new_page(browser)
        log_in(page, "INTERN")
        page.route(f"{api_url()}/meetings*", lambda route: route.abort())
        page.goto(f"{APP}/calendar")
        expect(page.get_by_role("heading", name="Couldn't load meetings")).to_be_visible()
        page.unroute_all()
        page.route(f"{api_url()}/meetings*", lambda route: route.fulfill(json={"meetings": []}))
        page.get_by_role("button", name="Try again").click()
        expect(page.get_by_text("Nothing scheduled for you this week.")).to_be_visible()
        page.unroute_all()
        page.goto(f"{APP}/calendar?meeting=7d4f3e6a-0000-4000-8000-000000000000")
        expect(page.get_by_role("heading", name="This meeting isn't available")).to_be_visible()
        page.context.close()
    step("Meetings: error, empty and missing-meeting states (error and empty simulated)", states)

    def fits():
        for width in (1280, 1440):
            for role in ("INTERN", "TEAM_LEAD"):
                page = new_page(browser, {"width": width, "height": 800})
                log_in(page, role)
                page.goto(f"{APP}/calendar")
                page.get_by_role("heading", level=1).wait_for()
                expect_no_sideways_scroll(page, f"/calendar at {width}")
                page.context.close()
    step("Meetings: fits 1280 and 1440", fits)
    intern_page.context.close()
    lead.context.close()


def run_shell(browser):
    def intern_sidebar():
        page = new_page(browser)
        log_in(page, "INTERN")
        nav = page.get_by_role("navigation", name="Main")
        expect(nav.get_by_role("heading", name="Account")).to_be_visible()
        expect(nav.get_by_role("heading", name="Administration")).to_have_count(0)
        expect(page.get_by_role("button", name="New task")).to_have_count(0)
        page.context.close()
    step("Shell: Interns get Account, never Administration, and no New task", intern_sidebar)

    def collapse():
        page = new_page(browser)
        log_in(page, "TEAM_LEAD")
        expect(page.get_by_role("banner").get_by_role("button", name="New task")).to_be_visible()
        expect(page.get_by_role("button", name="Collapse sidebar")).to_be_visible()
        page.keyboard.press("[")
        expect(page.get_by_role("button", name="Expand sidebar")).to_be_visible()
        page.reload()
        expect(page.get_by_role("button", name="Expand sidebar")).to_be_visible()
        page.get_by_role("button", name="Expand sidebar").click()
        expect(page.get_by_role("button", name="Collapse sidebar")).to_be_visible()
        page.context.close()
    step("Shell: [ collapses the sidebar and the choice survives a refresh", collapse)

    def starts_collapsed():
        page = new_page(browser, {"width": 1100, "height": 720})
        log_in(page, "TEAM_LEAD")
        expect(page.get_by_role("button", name="Expand sidebar")).to_be_visible()
        page.context.close()
    step("Shell: under 1280px the sidebar starts collapsed", starts_collapsed)

    def bottom_bar():
        page = new_page(browser, MOBILE)
        log_in(page, "SUPER_ADMIN")
        nav = page.get_by_role("navigation", name="Main")
        for label in ("Home", "Tasks", "Check-ins", "Messages", "More"):
            box = nav.get_by_role("link", name=label).bounding_box()
            assert box["height"] >= 44, f"{label} is under 44px"
        nav.get_by_role("link", name="More").click()
        expect(page.get_by_role("heading", name="More", exact=True)).to_be_visible()
        main = page.locator("main")
        expect(main.get_by_role("link", name="Projects")).to_be_visible()
        expect(main.get_by_role("link", name="User Management")).to_be_visible()
        expect(main.get_by_role("link", name="My Tasks")).to_have_count(0)
        expect_no_sideways_scroll(page, "/more")
        page.context.close()
    step("Shell: phones get the bottom bar, 44px targets and the More page", bottom_bar)


def run_team_lead(browser, title, lead_name, intern_name):
    page = new_page(browser)

    def sees():
        log_in(page, "TEAM_LEAD")
        expect(page.get_by_role("link", name="User Management")).to_have_count(0)
        expect(page.get_by_role("button", name="New task")).to_be_visible()
    step("Team Lead: can create tasks, no User Management", sees)

    def full_flow():
        open_nav_link(page, "My Tasks")
        create_task(page, title, intern_name)
        expect(page.get_by_role("button", name="Delete")).to_have_count(0)
        open_nav_link(page, "My Tasks")
        page.get_by_role("tablist", name="Task views").get_by_role("tab", name="Tasks I assigned").click()
        expect(page.get_by_role("link", name=title)).to_be_visible()
    step("Team Lead: directory search, assign, then Tasks I assigned, no Delete", full_flow)

    def denied():
        page.goto(f"{APP}/users")
        expect(page.get_by_role("heading", name="You don't have access")).to_be_visible()
    step("Team Lead: /users is denied", denied)
    page.context.close()


def run_intern(browser, assigned_title, admin_title):
    page = new_page(browser)

    def sees():
        log_in(page, "INTERN")
        expect(page.get_by_role("button", name="New task")).to_have_count(0)
        expect(page.get_by_role("link", name="User Management")).to_have_count(0)
        expect(page.get_by_role("heading", name="Team-wide")).to_have_count(0)
    step("Intern: no New task, no User Management, no team counts", sees)

    def my_tasks():
        open_nav_link(page, "My Tasks")
        expect(page.get_by_role("tablist", name="Task views")).to_have_count(0)
        expect(page.get_by_role("link", name=assigned_title)).to_be_visible()
        expect(page.get_by_role("link", name=admin_title)).to_be_visible()
        page.get_by_label(f"Status of {assigned_title}").select_option("IN_PROGRESS")
        expect(page.get_by_text("Moved to In progress.")).to_be_visible()
    step("Intern: sees assigned tasks, no manager tabs, changes status inline", my_tasks)

    def detail():
        page.get_by_role("link", name=assigned_title).click()
        expect(page.get_by_role("heading", name=assigned_title)).to_be_visible()
        expect(page.get_by_role("button", name="Edit")).to_have_count(0)
        expect(page.get_by_role("button", name="Delete")).to_have_count(0)
        page.get_by_label("Add a comment").fill("Intern update from e2e.")
        page.get_by_role("button", name="Post comment").click()
        expect(page.get_by_text("Intern update from e2e.")).to_be_visible()
    step("Intern: can comment, cannot edit or delete", detail)

    def directory():
        open_nav_link(page, "Team Directory")
        expect(page.get_by_role("heading", name="Team Directory")).to_be_visible()
        page.get_by_role("listitem").first.wait_for()
    step("Intern: can read the directory", directory)

    def denied():
        page.goto(f"{APP}/users")
        expect(page.get_by_role("heading", name="You don't have access")).to_be_visible()
    step("Intern: /users is denied", denied)
    page.context.close()


def check_logout(page):
    page.goto(f"{APP}/settings")
    page.get_by_role("button", name="Log out").click()
    expect(page).to_have_url(re.compile("/login"))
    assert page.evaluate("sessionStorage.getItem('brivent.authToken')") is None


if __name__ == "__main__":
    main()
