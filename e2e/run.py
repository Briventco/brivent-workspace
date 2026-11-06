"""Browser checks for tasks, directory, settings and permissions. See e2e/README.md."""
import json
import os
import re
import sys
import time
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
PAGES = ["/", "/tasks", "/directory", "/settings"]

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


def pick_assignee(dialog, name):
    picker = dialog.get_by_role("combobox", name="Assignee")
    picker.click()
    picker.fill(name.split()[0])
    dialog.get_by_role("option", name=re.compile(re.escape(name))).click()


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
        page.get_by_label("Role").select_option("SUPER_ADMIN")
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
        dialog.get_by_label("Role").select_option("INTERN")
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
    call("POST", "/tasks", admin_token, {"title": task_title, "assigneeId": user["id"]})
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
        member.get_by_role("button", name="Update check-in").click()
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
