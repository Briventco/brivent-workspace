"""Browser checks for tasks, directory, settings and permissions. See e2e/README.md."""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
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


def user_action(page, name, action):
    """Row actions in User Management sit behind a "..." menu, as in the design."""
    page.get_by_role("button", name=f"Actions for {name}").click()
    page.get_by_role("menu").get_by_role("menuitem", name=action).click()


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
        global sync_playwright_instance
        sync_playwright_instance = playwright
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
                    run_ui_polish(browser, admin_token)
                    if "avatar" in call("GET", "/me", admin_token)["user"]:
                        run_avatars(browser, admin_token)
                    if "unreadMessages" in call("GET", "/tasks/summary", admin_token)["summary"]:
                        run_messages(browser, admin_token)
                        run_replies(browser, admin_token)
                        run_links(browser, admin_token)
                        if has_attachments(admin_token):
                            run_attachments(browser, admin_token)
                        if has_link_previews(admin_token):
                            run_link_previews(browser, admin_token)
                    if "learning.view" in call("GET", "/me", admin_token)["user"]["permissions"]:
                        run_learning(browser, admin_token)
                        if has_programs(admin_token):
                            run_learning_programs(browser, admin_token)
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
        user_action(page, intern_name, "Reset password")
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
        row.get_by_role("button", name=f"Actions for {name}").click()
        menu = admin.get_by_role("menu")
        expect(menu.get_by_role("menuitem", name="Reset password")).to_have_count(0)
        expect(menu.get_by_role("menuitem", name="Deactivate")).to_be_visible()
        admin.keyboard.press("Escape")
        expect(menu).to_have_count(0)
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
        user_action(admin, name, "Reset password")
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
        user_action(admin, name, "Reset password")
        admin.get_by_role("dialog").get_by_role("button", name="Reset password").click()
        expect_manual_link(admin.get_by_role("dialog"))
        admin.unroute_all()
    step("Failed email: link and copy button on add, resend and reset (failure simulated)", email_failures)

    def deactivate_pending():
        name5, email5 = f"E2E Off {RUN}", f"e2e.off.{RUN}@example.test"
        invite(admin, name5, email5)
        user_action(admin, name5, "Deactivate")
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
        card.get_by_role("button", name="Reply", exact=True).click()
        lead.get_by_label(f"Reply to {name}").fill(f"On it, run {RUN}.")
        lead.get_by_role("button", name="Send reply").click()
        expect(card.get_by_text(f"On it, run {RUN}.")).to_be_visible()
        member.goto(f"{APP}/daily")
        expect(member.get_by_text(f"On it, run {RUN}.")).to_be_visible()
        expect(member.get_by_role("button", name="Reply", exact=True)).to_have_count(0)
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

    def empty_without_enrollment():
        # Everyone can take a course from the library, so Learning shows before any enrollment.
        expect(learner.get_by_role("link", name="Learning", exact=True)).to_be_visible()
        learner.goto(f"{APP}/learning")
        expect(learner.get_by_role("heading", name="No learning yet")).to_be_visible()
        expect(learner.get_by_role("link", name="Browse courses")).to_be_visible()
        expect(learner.get_by_role("button", name="New track")).to_have_count(0)

    step("learning: Learning shows without an enrollment, with a clear empty page", empty_without_enrollment)

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


LAYOUT_SHIFT = """
window.__cls = 0;
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value;
}).observe({ type: 'layout-shift', buffered: true });
"""


def run_ui_polish(browser, admin_token):
    long_name = f"Oluwaseyifunmi Adeyemi-Bankole Gbadamosi {RUN}"
    person = active_user(admin_token, long_name, f"e2e.longname.{RUN}@example.test")
    lead_auth = call("POST", "/auth/login", body=dict(zip(("email", "password"), credentials("TEAM_LEAD"))))
    task = call(
        "POST",
        "/tasks",
        lead_auth["token"],
        {
            "title": f"{PREFIX} a deliberately long task title that has to wrap onto a second line in a narrow card",
            "priority": "MEDIUM",
            "assigneeIds": [lead_auth["user"]["id"]],
        },
    )["task"]

    admin = new_page(browser, {"width": 1280, "height": 900})
    log_in(admin, "SUPER_ADMIN")

    def tab_titles():
        open_nav_link(admin, "My Tasks")
        expect(admin).to_have_title("My Tasks · Brivent Workspace")
        admin.goto(f"{APP}/tasks/{task['id']}")
        expect(admin).to_have_title(f"{task['title']} · Brivent Workspace")
        open_nav_link(admin, "Projects")
        expect(admin).to_have_title("Projects · Brivent Workspace")

    step("Polish: every tab is titled, and detail pages name what's open", tab_titles)

    intern_name = call(
        "POST", "/auth/login", body=dict(zip(("email", "password"), credentials("INTERN")))
    )["user"]["name"]

    def user_menu():
        open_nav_link(admin, "User Management")
        trigger = admin.get_by_role("button", name=f"Actions for {intern_name}")
        card = admin.locator(".card", has=trigger)
        expect(trigger).to_be_visible()
        box, frame = trigger.bounding_box(), card.bounding_box()
        assert box["x"] + box["width"] <= frame["x"] + frame["width"], "the menu button is cut off at 1280"
        expect_no_sideways_scroll(admin, "User Management at 1280")

        trigger.focus()
        admin.keyboard.press("Enter")
        menu = admin.get_by_role("menu", name=f"Actions for {intern_name}")
        expect(menu.get_by_role("menuitem", name="Edit")).to_be_focused()
        admin.keyboard.press("ArrowDown")
        expect(menu.get_by_role("menuitem", name="Reset password")).to_be_focused()
        admin.keyboard.press("Escape")
        expect(menu).to_have_count(0)
        expect(trigger).to_be_focused()

        # Scrolling moves the menu with its button rather than closing it under the pointer.
        trigger.click()
        admin.mouse.wheel(0, 120)
        admin.wait_for_timeout(200)
        expect(menu).to_be_visible()
        admin.keyboard.press("Escape")

        # Active people with no department fit on one page, wherever the full list puts you.
        admin.goto(f"{APP}/users?department=none")
        own = admin.get_by_role("row", name=re.compile("\\(you\\)")).first
        own.get_by_role("button", name=re.compile("^Actions for")).click()
        expect(admin.get_by_role("menuitem", name="Edit")).to_be_visible()
        expect(admin.get_by_role("menuitem", name="Deactivate")).to_have_count(0)
        admin.keyboard.press("Escape")

    step("Polish: User Management fits at 1280, with row actions in a keyboard menu", user_menu)

    def full_names():
        admin.goto(f"{APP}/directory")
        name = admin.locator(".truncate", has_text=long_name).first
        expect(name).to_be_visible()
        name.hover()
        expect(admin.locator(f'[title="{long_name}"]').first).to_be_attached()

    step("Polish: a name cut short shows in full on hover", full_names)

    def keeps_data():
        open_nav_link(admin, "Projects")
        expect(admin.get_by_role("heading", name="Projects", exact=True)).to_be_visible()
        expect(admin.locator("main .card").first).to_be_visible()
        open_nav_link(admin, "My Tasks")
        held = []
        admin.route("**/api/projects*", lambda route: held.append(route))
        open_nav_link(admin, "Projects")
        # The request is held unanswered, so anything showing came from the last visit.
        expect(admin.locator("main .card").first).to_be_visible(timeout=2_000)
        expect(admin.get_by_role("status", name=re.compile("Loading"))).to_have_count(0)
        for route in held:
            route.continue_()
        admin.unroute("**/api/projects*")

    step("Polish: coming back to a page shows its last data at once", keeps_data)

    def rollback():
        admin.goto(f"{APP}/tasks?view=all")
        row = admin.locator("li, tr").filter(has_text=task["title"]).first
        select = row.get_by_role("combobox")
        expect(select).to_have_value("TODO")
        admin.route(
            "**/api/tasks/*/status",
            lambda route: route.fulfill(status=500, json={"error": {"code": "E2E", "message": "Server trouble."}}),
        )
        select.select_option("IN_PROGRESS")
        expect(admin.get_by_text(re.compile("It's back to To do"))).to_be_visible()
        expect(select).to_have_value("TODO")
        admin.unroute("**/api/tasks/*/status")

        admin.goto(f"{APP}/tasks/{task['id']}")
        status = admin.get_by_label("Status")
        admin.route("**/api/tasks/*/status", lambda route: admin.wait_for_timeout(1_500) or route.continue_())
        status.select_option("BLOCKED")
        expect(admin.get_by_text("Blocked", exact=True).first).to_be_visible(timeout=1_000)
        expect(admin.get_by_text("Moved to Blocked.")).to_be_visible()
        admin.unroute("**/api/tasks/*/status")

    step("Polish: status shows at once, and rolls back with a toast if the save fails", rollback)

    lead = browser.new_context(viewport={"width": 1440, "height": 900}).new_page()
    lead.add_init_script(LAYOUT_SHIFT)
    lead.on("console", lambda m: m.type == "error" and "Failed to load resource" not in m.text and console_problems.append(m.text[:200]))
    log_in(lead, "TEAM_LEAD")

    def own_tasks():
        lead.goto(f"{APP}/")
        lead.wait_for_load_state("networkidle")
        lead.wait_for_timeout(500)
        shift = lead.evaluate("window.__cls")
        assert shift < 0.1, f"the dashboard moved by {shift} while loading"

        card = lead.locator(".card", has=lead.get_by_role("heading", name="Your own tasks"))
        row = card.get_by_role("link", name=re.compile(re.escape(task["title"][:40])))
        title, status = row.locator(".title"), row.locator(".badge").first
        assert title.bounding_box()["y"] + title.bounding_box()["height"] <= status.bounding_box()["y"] + 1, \
            "the status should sit under the title"

    step("Polish: the dashboard loads without jumping, and own tasks put the title first", own_tasks)
    lead.context.close()

    def reduced_motion():
        page = browser.new_context(reduced_motion="reduce").new_page()
        log_in(page, "TEAM_LEAD")
        duration = page.evaluate("getComputedStyle(document.querySelector('.btn')).transitionDuration")
        assert all(float(part.rstrip("ms")) < 0.01 or part.endswith("ms") and float(part[:-2]) < 1 for part in duration.split(", ")), duration
        page.context.close()

    step("Polish: reduced motion turns transitions off", reduced_motion)

    def phone_with_long_names():
        page = new_page(browser, MOBILE)
        log_in(page, "SUPER_ADMIN")
        for path in ("/", "/directory", "/users", "/projects", "/learning", "/settings", f"/tasks/{task['id']}"):
            page.goto(f"{APP}{path}")
            page.get_by_role("heading", level=1).first.wait_for()
            expect_no_sideways_scroll(page, f"{path} with long names")
        page.context.close()

    step("Polish: long names and titles never push a phone page sideways", phone_with_long_names)

    admin.context.close()
    call("POST", f"/users/{person['id']}/deactivate", admin_token)


def touch_swipe(page, locator, dx, dy=0, steps=8):
    """A real touch swipe through the browser, since Playwright only taps."""
    box = locator.bounding_box()
    x, y = box["x"] + 40, box["y"] + box["height"] / 2
    session = page.context.new_cdp_session(page)
    session.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y}]})
    for n in range(1, steps + 1):
        session.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x + dx * n / steps, "y": y + dy * n / steps}]})
    session.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    session.detach()


def touch_hold(page, locator, ms=700):
    box = locator.bounding_box()
    point = {"x": box["x"] + 40, "y": box["y"] + box["height"] / 2}
    session = page.context.new_cdp_session(page)
    session.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [point]})
    page.wait_for_timeout(ms)
    session.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    session.detach()


def run_replies(browser, admin_token):
    lead_auth = call("POST", "/auth/login", body=dict(zip(("email", "password"), credentials("TEAM_LEAD"))))
    intern_auth = call("POST", "/auth/login", body=dict(zip(("email", "password"), credentials("INTERN"))))
    lead_token, intern_token = lead_auth["token"], intern_auth["token"]
    lead_user, intern_user = lead_auth["user"], intern_auth["user"]
    channel = call("POST", "/channels", lead_token, {"name": f"e2e-replies-{RUN}", "visibility": "PUBLIC"})["conversation"]
    call("POST", f"/channels/{channel['id']}/join", intern_token)
    label = f"#{channel['name']}"
    state = {}

    sender = new_page(browser)
    receiver = new_page(browser)
    log_in(sender, "TEAM_LEAD")
    log_in(receiver, "INTERN")

    def reply_and_cancel():
        original = post_message(intern_token, channel["id"], f"{PREFIX} is the report ready?")
        state["original"] = original
        sender.goto(f"{APP}/messages/{channel['id']}")
        receiver.goto(f"{APP}/messages/{channel['id']}")
        row = message_list(sender).get_by_role("listitem").filter(has_text="is the report ready?")
        row.hover()
        row.get_by_role("button", name="Reply", exact=True).click()
        bar = sender.get_by_role("status").filter(has_text=f"Replying to {intern_user['name']}")
        expect(bar).to_contain_text("is the report ready?")
        # The quote bar makes the composer taller, and the latest message stays in view above it.
        expect(message_list(sender).get_by_role("listitem").last).to_be_in_viewport(ratio=0.9)
        expect(message_box(sender, label)).to_be_focused()
        sender.keyboard.press("Escape")
        expect(bar).to_have_count(0)

        row.hover()
        row.get_by_role("button", name="Reply", exact=True).click()
        expect(bar).to_be_visible()
        bar.get_by_role("button", name="Cancel reply").click()
        expect(bar).to_have_count(0)

    step("replies: Reply shows a quote bar, and Esc or X cancels it", reply_and_cancel)

    def send_reply():
        before = call("GET", "/tasks/summary", intern_token)["summary"]["unreadMentions"]
        receiver.goto(f"{APP}/tasks")
        row = message_list(sender).get_by_role("listitem").filter(has_text="is the report ready?")
        row.hover()
        row.get_by_role("button", name="Reply", exact=True).click()
        with sender.expect_request(lambda r: r.method == "POST" and r.url.endswith("/messages")) as sent:
            send_message(sender, label, f"{PREFIX} yes, it's ready")
        assert sent.value.post_data_json["replyToId"] == state["original"]["id"]
        reply = message_list(sender).get_by_role("listitem").filter(has_text="yes, it's ready")
        expect(reply.locator(".reply-quote")).to_contain_text(intern_user["name"])
        expect(reply.locator(".reply-quote")).to_contain_text("is the report ready?")
        expect(sender.get_by_role("status").filter(has_text="Replying to")).to_have_count(0)

        nav = receiver.get_by_role("link", name=re.compile("^Internal Messages"))
        expect(nav).to_contain_text("unread")
        after = call("GET", "/tasks/summary", intern_token)["summary"]["unreadMentions"]
        assert after == before + 1, f"a reply should count as a mention: {before} -> {after}"
        receiver.goto(f"{APP}/messages/{channel['id']}")
        quote = message_list(receiver).get_by_role("listitem").filter(has_text="yes, it's ready").locator(".reply-quote")
        expect(quote).to_contain_text("is the report ready?")
        expect(quote).to_have_class(re.compile("is-mine"))

    step("replies: a reply sends replyToId, quotes the original, and counts as a mention", send_reply)

    def live_quote_updates():
        quote = message_list(sender).get_by_role("listitem").filter(has_text="yes, it's ready").locator(".reply-quote")
        row = message_list(receiver).get_by_role("listitem").filter(has_text="is the report ready?").first
        row.hover()
        row.get_by_role("button", name="Edit message").click()
        box = receiver.get_by_role("textbox", name="Edit message")
        box.fill(f"{PREFIX} is the quarterly report ready?")
        box.press("Enter")
        expect(quote).to_contain_text("is the quarterly report ready?")

        row = message_list(receiver).get_by_role("listitem").filter(has_text="is the quarterly report ready?").first
        row.hover()
        row.get_by_role("button", name="Delete message").click()
        receiver.get_by_role("dialog").get_by_role("button", name="Delete").click()
        expect(quote).to_contain_text("Original message deleted")
        expect(quote).not_to_contain_text("quarterly")

    step("replies: editing or deleting the original updates every quote live", live_quote_updates)

    def jump_to_original():
        people = []
        for n in range(2):
            person = active_user(admin_token, f"E2E Talker {n} {RUN}", f"e2e.talker{n}.{RUN}@example.test")
            token = call("POST", "/auth/login", body={"email": person["email"], "password": person["password"]})["token"]
            call("POST", f"/channels/{channel['id']}/join", token)
            people.append((person, token))
        first = post_message(people[0][1], channel["id"], f"{PREFIX} the very first question")
        for n in range(58):
            post_message(people[n % 2][1], channel["id"], f"Filler line {n:02d}.")
        call(
            "POST",
            f"/conversations/{channel['id']}/messages",
            lead_token,
            {"body": f"{PREFIX} answering the first question", "clientId": f"e2e-jump-{RUN}", "replyToId": first["id"]},
        )
        sender.goto(f"{APP}/messages/{channel['id']}")
        original = sender.locator(f"#message-{first['id']}")
        expect(original).to_have_count(0)
        message_list(sender).get_by_role("button", name=re.compile("Go to the original message")).last.click()
        expect(original).to_be_in_viewport()
        expect(original).to_have_class(re.compile("is-highlighted"))
        expect(original).not_to_have_class(re.compile("is-highlighted"), timeout=5_000)
        for person, _ in people:
            call("POST", f"/users/{person['id']}/deactivate", admin_token)

    step("replies: clicking a quote loads older pages and highlights the original", jump_to_original)

    def phone_gestures():
        page = browser.new_context(viewport=MOBILE, has_touch=True, is_mobile=True).new_page()
        log_in(page, "INTERN")
        page.goto(f"{APP}/messages/{channel['id']}")
        row = message_list(page).get_by_role("listitem").filter(has_text="answering the first question").last
        expect(row).to_be_visible()
        expect(row.get_by_role("button", name="Reply", exact=True)).to_be_hidden()
        touch_hold(page, row)
        expect(row.get_by_role("button", name="Reply", exact=True)).to_be_visible()

        touch_swipe(page, row, 90)
        bar = page.get_by_role("status").filter(has_text=f"Replying to {lead_user['name']}")
        expect(bar).to_contain_text("answering the first question")
        expect_no_sideways_scroll(page, "conversation with a reply")
        send_message(page, label, f"{PREFIX} sent from a phone")
        expect(message_list(page).get_by_role("listitem").filter(has_text="sent from a phone").locator(".reply-quote")).to_be_visible()

        touch_swipe(page, row, 20, 60)
        expect(page.get_by_role("status").filter(has_text="Replying to")).to_have_count(0)
        page.context.close()

    step("replies: on phones, hold shows Reply and swiping right replies", phone_gestures)

    sender.context.close()
    receiver.context.close()


def make_png(width, height, shade=0):
    """A real PNG, built here so the test needs no image files or libraries."""
    import struct
    import zlib

    def chunk(kind, data):
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    rows = b"".join(
        b"\x00" + b"".join(bytes(((x + shade) % 256, (y * 2) % 256, 160)) for x in range(width))
        for y in range(height)
    )
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b"")


def choose_picture(page, name, mime, data):
    page.get_by_label("Choose a profile picture").set_input_files({"name": name, "mimeType": mime, "buffer": data})


def run_avatars(browser, admin_token):
    person = active_user(admin_token, f"E2E Picture {RUN}", f"e2e.picture.{RUN}@example.test")
    page = new_page(browser)
    log_in_as(page, person["email"], person["password"])
    top_bar_photo = page.get_by_role("button", name=re.compile("^Account menu")).locator("img")

    def prompt():
        page.goto(f"{APP}/")
        card = page.get_by_role("complementary", name="Add a profile picture")
        expect(card).to_be_visible()
        expect(card.get_by_role("link", name="Add a picture")).to_have_attribute("href", "/settings")
        card.get_by_role("button", name="Dismiss").click()
        expect(card).to_have_count(0)
        page.reload()
        expect(page.get_by_role("heading", name=GREETING)).to_be_visible()
        expect(card).to_have_count(0)

    step("avatars: a gentle dashboard prompt that stays dismissed", prompt)

    def refused_files():
        open_nav_link(page, "Settings")
        expect(page.get_by_role("button", name="Upload picture")).to_be_visible()
        choose_picture(page, "party.gif", "image/gif", b"GIF89a" + b"\x00" * 64)
        expect(page.get_by_role("alert")).to_contain_text("GIFs can't be used")
        choose_picture(page, "IMG_0042.HEIC", "image/heic", b"\x00" * 64)
        expect(page.get_by_role("alert")).to_contain_text("HEIC")
        choose_picture(page, "huge.png", "image/png", b"\x89PNG" + b"\x00" * (5 * 1024 * 1024 + 10))
        expect(page.get_by_role("alert")).to_contain_text("over 5 MB")
        expect(page.get_by_role("dialog")).to_have_count(0)

    step("avatars: GIF, HEIC and files over 5 MB are refused with a clear reason", refused_files)

    def server_error_keeps_old():
        choose_picture(page, "face.png", "image/png", make_png(400, 300))
        dialog = page.get_by_role("dialog", name="Position your picture")
        expect(dialog.get_by_role("img", name=re.compile("Picture preview"))).to_be_visible()
        page.route(
            "**/api/me/avatar",
            lambda route: route.fulfill(
                status=415,
                json={"error": {"code": "UNSUPPORTED_FILE_TYPE", "message": "Use a JPEG, PNG or WebP image."}},
            ),
        )
        dialog.get_by_role("button", name="Save picture").click()
        expect(dialog.get_by_text("Use a JPEG, PNG or WebP image.")).to_be_visible()
        expect(top_bar_photo).to_have_count(0)
        page.unroute("**/api/me/avatar")
        dialog.get_by_role("button", name="Cancel").click()

    step("avatars: a refused upload explains itself and keeps the old picture", server_error_keeps_old)

    def upload():
        choose_picture(page, "face.png", "image/png", make_png(800, 600))
        dialog = page.get_by_role("dialog", name="Position your picture")
        frame = dialog.get_by_role("img", name=re.compile("Picture preview"))
        expect(frame.locator("img")).to_be_visible()
        expect(dialog.get_by_text("couldn't be opened")).to_have_count(0)
        before = frame.locator("img").evaluate("img => img.style.transform")
        box = frame.bounding_box()
        page.mouse.move(box["x"] + 128, box["y"] + 128)
        page.mouse.down()
        page.mouse.move(box["x"] + 60, box["y"] + 128, steps=5)
        page.mouse.up()
        assert frame.locator("img").evaluate("img => img.style.transform") != before, "dragging didn't move it"
        dialog.get_by_label("Zoom").fill("1.6")
        frame.focus()
        page.keyboard.press("ArrowLeft")

        def slow(route):
            assert route.request.method == "PUT"
            assert "multipart/form-data" in route.request.headers["content-type"]
            page.wait_for_timeout(800)
            route.continue_()

        page.route("**/api/me/avatar", slow)
        dialog.get_by_role("button", name="Save picture").click()
        expect(dialog.get_by_role("status", name=re.compile("Uploading"))).to_be_visible()
        expect(top_bar_photo).to_have_count(0)
        expect(page.get_by_text("Profile picture updated.")).to_be_visible()
        page.unroute("**/api/me/avatar")
        expect(top_bar_photo).to_be_visible()
        expect(top_bar_photo).to_have_attribute("loading", "lazy")
        me = call("GET", "/me", call("POST", "/auth/login", body={"email": person["email"], "password": person["password"]})["token"])["user"]
        assert me["avatar"] and me["avatar"]["small"].endswith("-128.webp"), me["avatar"]
        state["first"] = me["avatar"]["small"]
        expect(page.get_by_role("button", name="Change picture")).to_be_visible()
        expect_no_sideways_scroll(page, "Settings with a picture")

    state = {}
    step("avatars: crop by dragging and zooming, then upload with progress", upload)

    def everywhere():
        admin = new_page(browser)
        log_in(admin, "SUPER_ADMIN")
        admin.goto(f"{APP}/directory")
        card = admin.get_by_role("listitem").filter(has_text=person["name"])
        photo = card.locator(".av img")
        # The directory's avatars are the large size, so it shows the 512px picture.
        expect(photo).to_have_attribute("src", state["first"].replace("-128.webp", "-512.webp"))
        expect(photo).to_have_attribute("loading", "lazy")
        box = card.locator(".av").bounding_box()
        assert abs(box["width"] - box["height"]) < 1, "the picture squashed its circle"

        admin.route("**/uploads/**", lambda route: route.abort())
        admin.route(re.compile(r".*/avatars/.*"), lambda route: route.abort())
        admin.reload()
        circle = admin.get_by_role("listitem").filter(has_text=person["name"]).locator(".av")
        expect(circle.locator("img")).to_have_count(0)
        words = person["name"].split()
        expect(circle).to_have_text((words[0][0] + words[-1][0]).upper())
        admin.unroute_all()
        state["admin"] = admin

    step("avatars: pictures show for everyone, lazily, and fall back to initials", everywhere)

    def change_picture():
        page.goto(f"{APP}/settings")
        choose_picture(page, "newer.png", "image/png", make_png(300, 500, shade=90))
        page.get_by_role("dialog", name="Position your picture").get_by_role("button", name="Save picture").click()
        expect(page.get_by_text("Profile picture updated.")).to_be_visible()
        expect(top_bar_photo).not_to_have_attribute("src", re.compile(re.escape(state["first"].rsplit("/", 1)[1])))

    step("avatars: changing the picture gives it a new address", change_picture)

    def admin_removes():
        admin = state["admin"]
        admin.goto(f"{APP}/users?department=none")
        user_action(admin, person["name"], "Remove picture")
        dialog = admin.get_by_role("dialog")
        expect(dialog).to_contain_text("initials will show instead")
        dialog.get_by_role("button", name="Remove picture").click()
        expect(admin.get_by_text(f"{person['name']}'s picture has been removed.")).to_be_visible()
        admin.get_by_role("button", name=f"Actions for {person['name']}").click()
        expect(admin.get_by_role("menuitem", name="Remove picture")).to_have_count(0)
        admin.keyboard.press("Escape")
        admin.context.close()

        lead = new_page(browser)
        log_in(lead, "TEAM_LEAD")
        lead.goto(f"{APP}/users")
        expect(lead.get_by_role("heading", name="You don't have access to this")).to_be_visible()
        lead.context.close()

    step("avatars: Super Admin removes someone's picture after confirming", admin_removes)

    def remove_own():
        page.goto(f"{APP}/settings")
        choose_picture(page, "again.png", "image/png", make_png(200, 200, shade=40))
        page.get_by_role("dialog", name="Position your picture").get_by_role("button", name="Save picture").click()
        expect(top_bar_photo).to_be_visible()
        page.get_by_role("button", name="Remove", exact=True).click()
        page.get_by_role("dialog").get_by_role("button", name="Remove").click()
        expect(page.get_by_text("Profile picture removed.")).to_be_visible()
        expect(top_bar_photo).to_have_count(0)
        expect(page.get_by_role("button", name="Upload picture")).to_be_visible()

    step("avatars: anyone can remove their own picture", remove_own)

    def phone():
        small = new_page(browser, MOBILE)
        log_in_as(small, person["email"], person["password"])
        small.goto(f"{APP}/settings")
        choose_picture(small, "phone.png", "image/png", make_png(640, 480))
        dialog = small.get_by_role("dialog", name="Position your picture")
        expect(dialog.get_by_role("button", name="Save picture")).to_be_in_viewport()
        expect_no_sideways_scroll(small, "the crop dialog")
        dialog.get_by_role("button", name="Cancel").click()
        small.context.close()

    step("avatars: upload and crop work at 375px", phone)

    page.context.close()
    call("POST", f"/users/{person['id']}/deactivate", admin_token)


def run_links(browser, admin_token):
    lead_auth = call("POST", "/auth/login", body=dict(zip(("email", "password"), credentials("TEAM_LEAD"))))
    token = lead_auth["token"]
    channel = call("POST", "/channels", token, {"name": f"e2e-links-{RUN}", "visibility": "PUBLIC"})["conversation"]
    long_url = "https://example.com/a/very/long/path/that/keeps/going/on/and/on/forever?query=1"
    task = call("POST", "/tasks", token, {"title": f"{PREFIX} linked from chat", "priority": "LOW", "assigneeIds": [lead_auth["user"]["id"]]})["task"]
    post_message(token, channel["id"], f"see {long_url}, or brivent.co.")
    post_message(token, channel["id"], "mail ada@brivent.co about it, e.g. tomorrow, and open report.pdf")
    post_message(token, channel["id"], f"the task {APP}/tasks/{task['id']} please")
    page = new_page(browser)
    log_in(page, "TEAM_LEAD")

    def clickable():
        page.goto(f"{APP}/messages/{channel['id']}")
        links = message_list(page).locator("a.msg-link")
        expect(links).to_have_count(2)
        long_link = links.nth(0)
        expect(long_link).to_have_attribute("href", long_url)
        expect(long_link).to_have_attribute("target", "_blank")
        expect(long_link).to_have_attribute("rel", "noopener noreferrer")
        expect(long_link).to_have_attribute("title", long_url)
        expect(long_link).to_contain_text("…")
        expect(long_link.locator(".ms")).to_have_count(1)
        bare = links.nth(1)
        expect(bare).to_have_attribute("href", "https://brivent.co")
        expect(bare).to_have_text("brivent.co")
        row = message_list(page).get_by_role("listitem").filter(has_text="mail ada@brivent.co")
        expect(row.locator("a")).to_have_count(0)
        card = message_list(page).get_by_role("listitem").filter(has_text="the task").get_by_role("link", name=re.compile("linked from chat")).last
        expect(card).to_have_attribute("href", f"/tasks/{task['id']}")

    step("links: http and bare domains are links that open safely, and task links stay cards", clickable)

    def opens_in_new_tab():
        # Stands in for the real site, so the test doesn't depend on the internet.
        page.context.route("https://brivent.co/**", lambda route: route.fulfill(body="<title>Brivent</title>", content_type="text/html"))
        with page.context.expect_page() as opened:
            message_list(page).locator("a.msg-link").nth(1).click()
        tab = opened.value
        tab.wait_for_load_state()
        assert tab.url.rstrip("/") == "https://brivent.co", tab.url
        assert tab.evaluate("window.opener") is None, "the new tab can reach back into the app"
        tab.close()
        page.context.unroute("https://brivent.co/**")
        expect(page).to_have_url(re.compile(f"/messages/{channel['id']}"))

    step("links: a link opens in a new tab and leaves Messages where it was", opens_in_new_tab)

    def phone():
        small = new_page(browser, MOBILE)
        log_in(small, "TEAM_LEAD")
        small.goto(f"{APP}/messages/{channel['id']}")
        expect(message_list(small).locator("a.msg-link").first).to_be_visible()
        expect_no_sideways_scroll(small, "long links on a phone")
        small.context.close()

    step("links: long links never push a phone sideways", phone)
    page.context.close()


FAKE_MIC = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"]


def photo_file(name, width=640, height=480, shade=0):
    return {"name": name, "mimeType": "image/png", "buffer": make_png(width, height, shade)}


def attach_photos(page, files):
    page.get_by_label("Choose photos to attach").set_input_files(files)


def tray(page):
    return page.get_by_role("list", name="Photos to send")


def mic_browser(browser):
    """Chrome with a fake microphone, so recordings are real audio without a person speaking."""
    return browser.browser_type.launch(executable_path=os.environ.get("E2E_CHROMIUM") or None, args=FAKE_MIC)


def record_for(page, seconds):
    expect(page.get_by_role("button", name="Record a voice note")).to_be_visible()
    page.get_by_role("button", name="Record a voice note").click()
    # Recording starts once the browser hands over the microphone, which can take a moment.
    expect(page.get_by_role("timer")).to_be_visible(timeout=15_000)
    page.wait_for_timeout(int(seconds * 1000))
    page.get_by_role("button", name="Stop recording").click()
    expect(page.get_by_role("group", name="Voice note ready to send")).to_be_visible()


def has_attachments(token):
    """The route exists when a bad conversation id is refused as invalid rather than not found."""
    try:
        call("POST", "/conversations/not-an-id/attachments", token, {})
    except urllib.error.HTTPError as error:
        return error.code != 404
    return True


def run_attachments(browser, admin_token):
    lead_auth = call("POST", "/auth/login", body=dict(zip(("email", "password"), credentials("TEAM_LEAD"))))
    intern_auth = call("POST", "/auth/login", body=dict(zip(("email", "password"), credentials("INTERN"))))
    lead_token, intern_token = lead_auth["token"], intern_auth["token"]
    channel = call("POST", "/channels", lead_token, {"name": f"e2e-media-{RUN}", "visibility": "PUBLIC"})["conversation"]
    call("POST", f"/channels/{channel['id']}/join", intern_token)
    url = f"{APP}/messages/{channel['id']}"
    label = f"#{channel['name']}"

    sender = new_page(browser)
    receiver = new_page(browser)
    log_in(sender, "TEAM_LEAD")
    log_in(receiver, "INTERN")
    sender.goto(url)
    receiver.goto(url)

    def three_photos_with_caption():
        held = []
        sender.route("**/attachments", lambda route: held.append(route) if not held else route.continue_())
        attach_photos(sender, [photo_file(f"p{n}.png", shade=n * 40) for n in range(3)])
        expect(tray(sender).get_by_role("listitem")).to_have_count(3)
        expect(tray(sender).get_by_role("progressbar").first).to_be_visible()
        expect(sender.get_by_role("button", name="Send", exact=True)).to_be_disabled()
        held[0].continue_()
        expect(tray(sender).get_by_role("progressbar")).to_have_count(0, timeout=20_000)
        sender.unroute("**/attachments")
        expect(sender.get_by_role("button", name="Send", exact=True)).to_be_enabled()
        with sender.expect_request(lambda r: r.method == "POST" and r.url.endswith("/messages")) as sent:
            send_message(sender, label, f"{PREFIX} three photos")
        assert len(sent.value.post_data_json["attachmentIds"]) == 3
        expect(tray(sender)).to_have_count(0)
        grid = message_list(receiver).get_by_role("listitem").filter(has_text="three photos").locator(".photo-grid-3")
        expect(grid.get_by_role("button", name=re.compile("^Open photo"))).to_have_count(3)
        assert grid.locator("img").first.get_attribute("width"), "photos need their size to hold space"

    step("attachments: photos upload with progress, then send with a caption, live", three_photos_with_caption)

    def photo_only_and_preview():
        attach_photos(sender, [photo_file("solo.png", 800, 400)])
        expect(sender.get_by_role("button", name="Send", exact=True)).to_be_enabled(timeout=20_000)
        sender.get_by_role("button", name="Send", exact=True).click()
        single = message_list(receiver).locator(".photo-single").last
        expect(single).to_be_visible()
        # Held at its own shape. 800 by 400 isn't resized, so that's the ratio it reserves.
        assert "800 / 400" in single.get_attribute("style"), single.get_attribute("style")
        receiver.goto(f"{APP}/messages")
        receiver.set_viewport_size(MOBILE)
        expect(receiver.get_by_role("link", name=re.compile(re.escape(channel["name"])))).to_contain_text("Photo")
        receiver.set_viewport_size(LAPTOP)
        receiver.goto(url)

    step("attachments: a photo needs no caption, and the list says Photo", photo_only_and_preview)

    def paste_drop_and_limits():
        box = message_box(sender, label)
        png = list(make_png(64, 64))
        sender.evaluate(
            """([bytes]) => {
              const data = new DataTransfer();
              data.items.add(new File([new Uint8Array(bytes)], 'pasted.png', { type: 'image/png' }));
              document.querySelector('textarea').dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
            }""",
            [png],
        )
        expect(tray(sender).get_by_role("listitem")).to_have_count(1)
        sender.evaluate(
            """([bytes]) => {
              const data = new DataTransfer();
              data.items.add(new File([new Uint8Array(bytes)], 'dropped.png', { type: 'image/png' }));
              const target = document.querySelector('[aria-label^="Messages in"]');
              for (const type of ['dragenter', 'dragover', 'drop']) {
                target.dispatchEvent(new DragEvent(type, { dataTransfer: data, bubbles: true, cancelable: true }));
              }
            }""",
            [png],
        )
        expect(tray(sender).get_by_role("listitem")).to_have_count(2)
        attach_photos(sender, [photo_file(f"many{n}.png", 32, 32) for n in range(10)])
        expect(tray(sender).get_by_role("listitem")).to_have_count(10)
        expect(sender.get_by_role("alert")).to_contain_text("up to 10 photos")
        for n in range(10):
            tray(sender).get_by_role("button", name=re.compile("^Remove")).first.click()
        expect(tray(sender)).to_have_count(0)
        attach_photos(sender, [{"name": "party.gif", "mimeType": "image/gif", "buffer": b"GIF89a" + b"\0" * 32}])
        expect(sender.get_by_role("alert")).to_contain_text("GIFs can't be sent")
        assert box.input_value() == ""

    step("attachments: paste, drop, the limit of 10 and GIF refusals", paste_drop_and_limits)

    def failed_upload_retries():
        tries = []

        def flaky(route):
            tries.append(1)
            if len(tries) == 1:
                return route.fulfill(status=503, json={"error": {"code": "STORAGE_UNAVAILABLE", "message": "The file couldn't be stored."}})
            return route.continue_()

        sender.route("**/attachments", flaky)
        attach_photos(sender, [photo_file("flaky.png")])
        retry = tray(sender).get_by_role("button", name=re.compile("^Retry"))
        expect(retry).to_be_visible()
        expect(sender.get_by_role("button", name="Send", exact=True)).to_be_disabled()
        retry.click()
        expect(retry).to_have_count(0)
        expect(sender.get_by_role("button", name="Send", exact=True)).to_be_enabled(timeout=20_000)
        sender.unroute("**/attachments")
        tray(sender).get_by_role("button", name=re.compile("^Remove")).click()

    step("attachments: a failed upload shows Retry, and Send waits for it", failed_upload_retries)

    def grid_and_viewer():
        attach_photos(sender, [photo_file(f"six{n}.png", shade=n * 30) for n in range(6)])
        expect(sender.get_by_role("button", name="Send", exact=True)).to_be_enabled(timeout=30_000)
        send_message(sender, label, f"{PREFIX} six photos")
        row = message_list(receiver).get_by_role("listitem").filter(has_text="six photos")
        grid = row.locator(".photo-grid-4")
        expect(grid.get_by_role("button")).to_have_count(4)
        expect(grid.locator(".photo-more")).to_have_text("+2")
        grid.get_by_role("button", name="Open photo 1 of 6").click()
        viewer = receiver.get_by_role("dialog", name=re.compile("Photo 1 of 6 from"))
        expect(viewer).to_be_visible()
        expect(viewer.get_by_role("button", name="Close")).to_be_focused()
        receiver.keyboard.press("ArrowRight")
        expect(receiver.get_by_role("dialog", name=re.compile("Photo 2 of 6"))).to_be_visible()
        receiver.get_by_role("button", name="Previous photo").click()
        expect(receiver.get_by_role("dialog", name=re.compile("Photo 1 of 6"))).to_be_visible()
        expect(receiver.get_by_role("link", name="Download photo")).to_have_attribute("href", re.compile("http"))
        receiver.keyboard.press("Escape")
        expect(receiver.get_by_role("dialog")).to_have_count(0)
        expect(grid.get_by_role("button", name="Open photo 1 of 6")).to_be_focused()

    step("attachments: a grid with +2, and a viewer with next, previous, download and Esc", grid_and_viewer)

    def expired_links_refetch():
        failed = []

        def expire_once(route):
            if not failed:
                failed.append(1)
                return route.fulfill(status=403, body="expired")
            return route.continue_()

        # A fresh browser, so nothing comes from the cache and the first photo really fails.
        page = new_page(browser)
        page.route(re.compile(r".*chat-attachments.*\.webp.*"), expire_once)
        log_in(page, "INTERN")
        refetches = []
        page.on(
            "request",
            lambda r: r.method == "GET" and re.search(r"/conversations/[^/]+/messages", r.url) and refetches.append(r.url),
        )
        page.goto(url)
        expect(message_list(page).locator(".photo-grid-4 img").first).to_be_visible()
        expect.poll(lambda: len(refetches), timeout=15_000).to_be_greater_than(1) if hasattr(expect, "poll") else None
        page.wait_for_timeout(2000)
        assert failed, "no photo request went through the expired route"
        assert len(refetches) > 1, f"a failed photo should fetch the messages again, saw {len(refetches)} fetch"
        page.context.close()

    step("attachments: a photo that fails to load fetches fresh links instead of breaking", expired_links_refetch)

    sender.context.close()
    receiver.context.close()

    loud = mic_browser(browser)
    recorder = loud.new_context(viewport=LAPTOP, permissions=["microphone"]).new_page()
    listener = new_page(browser)
    log_in(recorder, "TEAM_LEAD")
    log_in(listener, "INTERN")
    recorder.goto(url)
    listener.goto(url)
    state = {}

    def record_listen_send():
        expect(recorder.get_by_role("button", name="Record a voice note")).to_be_visible()
        recorder.get_by_role("button", name="Record a voice note").click()
        recorder.get_by_role("button", name="Cancel").click()
        expect(recorder.get_by_role("button", name="Record a voice note")).to_be_visible()

        record_for(recorder, 2.5)
        review = recorder.get_by_role("group", name="Voice note ready to send")
        expect(review.locator("audio")).to_have_attribute("src", re.compile("^blob:"))
        uploads = []

        def slow_upload(route):
            # Held briefly, so the Processing state is there to see however fast the server is.
            uploads.append(route.request.post_data_buffer)
            recorder.wait_for_timeout(1200)
            route.continue_()

        recorder.route("**/attachments", slow_upload)
        review.get_by_role("button", name="Send").click()
        expect(recorder.get_by_role("status").filter(has_text="Processing voice note")).to_be_visible()
        assert b'name="kind"\r\n\r\nVOICE' in uploads[0], "the upload should say it's a voice note"
        player = message_list(listener).locator("[data-voice-player]").last
        expect(player).to_be_visible(timeout=30_000)
        expect(player).to_have_attribute("aria-label", re.compile(r"Voice note, 0:0[1-9]"))
        expect(player.locator(".voice-wave i")).to_have_count(48)
        recorder.unroute("**/attachments")

    step("voice: record, cancel, listen back, then Processing until it arrives live", record_listen_send)

    def playback():
        player = message_list(listener).locator("[data-voice-player]").last
        player.get_by_role("button", name="Play voice note").click()
        expect(player.get_by_role("button", name="Pause voice note")).to_be_visible()
        player.get_by_role("button", name="Pause voice note").click()
        expect(player.get_by_role("button", name="Play voice note")).to_be_visible()
        # Speeds change while paused: a few-second note at 2x would end mid-test.
        speed = player.get_by_role("button", name=re.compile("^Playback speed"))
        speed.click()
        expect(speed).to_have_text("1.5x")
        speed.click()
        expect(speed).to_have_text("2x")
        speed.click()
        expect(speed).to_have_text("1x")
        player.focus()
        listener.keyboard.press("Space")
        expect(player.get_by_role("button", name="Pause voice note")).to_be_visible()
        listener.keyboard.press("Space")
        expect(player.get_by_role("button", name="Play voice note")).to_be_visible()
        wave = player.get_by_role("slider", name="Position in voice note")
        box = wave.bounding_box()
        listener.mouse.click(box["x"] + box["width"] * 0.6, box["y"] + box["height"] / 2)
        expect(wave).not_to_have_attribute("aria-valuenow", "0")

    step("voice: play and pause, 1.5x and 2x, Space on the player, and seeking", playback)

    def one_at_a_time_and_next():
        record_for(recorder, 1.5)
        recorder.get_by_role("group", name="Voice note ready to send").get_by_role("button", name="Send").click()
        players = message_list(listener).locator("[data-voice-player]")
        expect(players).to_have_count(2, timeout=30_000)
        first, second = players.nth(0), players.nth(1)
        second.get_by_role("button", name="Play voice note").click()
        expect(second.get_by_role("button", name="Pause voice note")).to_be_visible()
        first.get_by_role("button", name="Play voice note").click()
        expect(second.get_by_role("button", name="Play voice note")).to_be_visible()
        first.locator("audio").evaluate("audio => { audio.currentTime = Math.max(0, audio.duration - 0.2); }")
        expect(second.get_by_role("button", name="Pause voice note")).to_be_visible(timeout=10_000)

    step("voice: only one plays at a time, and the next in a row starts on its own", one_at_a_time_and_next)

    def quotes_and_preview():
        row = message_list(recorder).get_by_role("listitem").filter(has=recorder.locator("[data-voice-player]")).last
        row.hover()
        row.get_by_role("button", name="Reply", exact=True).click()
        expect(recorder.get_by_role("status").filter(has_text="Replying to")).to_contain_text("Voice note")
        send_message(recorder, label, f"{PREFIX} about that voice note")
        quote = message_list(listener).get_by_role("listitem").filter(has_text="about that voice note").locator(".reply-quote")
        expect(quote).to_contain_text("Voice note")
        conversation = call("GET", "/conversations", intern_token)["conversations"]
        assert any(c["id"] == channel["id"] for c in conversation)

    step("voice: a reply to a voice note quotes it as Voice note", quotes_and_preview)

    def five_minute_limit():
        page = loud.new_context(viewport=LAPTOP, permissions=["microphone"]).new_page()
        page.clock.install()
        log_in(page, "TEAM_LEAD")
        page.goto(url)
        expect(message_list(page)).to_be_visible()
        page.get_by_role("button", name="Record a voice note").click()
        # Only once it's really recording: before that, there's no clock to jump.
        expect(page.get_by_role("timer")).to_be_visible(timeout=15_000)
        page.clock.fast_forward("04:31")
        expect(page.get_by_role("status").filter(has_text="left")).to_be_visible()
        page.clock.fast_forward("00:31")
        expect(page.get_by_role("group", name="Voice note ready to send")).to_be_visible()
        page.get_by_role("button", name="Delete recording").click()
        page.context.close()

    step("voice: a warning at 4:30, and recording stops by itself at 5:00", five_minute_limit)

    def refused_microphone():
        page = new_page(browser)
        page.context.grant_permissions([])
        log_in(page, "INTERN")
        page.goto(url)
        page.get_by_role("button", name="Record a voice note").click()
        expect(page.get_by_role("alert")).to_contain_text(re.compile("Microphone access is blocked|No microphone"))
        page.context.close()

    step("voice: a refused or missing microphone explains what to do", refused_microphone)

    def phone_hold_to_talk():
        phone = loud.new_context(viewport=MOBILE, has_touch=True, is_mobile=True, permissions=["microphone"]).new_page()
        log_in(phone, "TEAM_LEAD")
        phone.goto(url)
        mic = phone.get_by_role("button", name="Record a voice note")
        before = message_list(listener).locator("[data-voice-player]").count()

        touch_hold(phone, mic, ms=1800)
        expect(message_list(listener).locator("[data-voice-player]")).to_have_count(before + 1, timeout=30_000)

        touch_swipe(phone, mic, -130, steps=10)
        phone.wait_for_timeout(1500)
        expect(mic).to_be_visible()
        expect(message_list(listener).locator("[data-voice-player]")).to_have_count(before + 1)

        box = mic.bounding_box()
        point = {"x": box["x"] + box["width"] / 2, "y": box["y"] + box["height"] / 2}
        session = phone.context.new_cdp_session(phone)
        session.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [point]})
        phone.wait_for_timeout(600)
        for n in range(1, 9):
            session.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": point["x"], "y": point["y"] - n * 12}]})
        session.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        session.detach()
        stop = phone.get_by_role("button", name="Stop recording")
        expect(stop).to_be_visible()
        phone.wait_for_timeout(800)
        stop.click()
        expect(phone.get_by_role("group", name="Voice note ready to send")).to_be_visible()
        expect_no_sideways_scroll(phone, "voice review on a phone")
        phone.get_by_role("button", name="Delete recording").click()
        phone.context.close()

    step("voice: on a phone, hold to send, slide left to cancel, slide up to lock", phone_hold_to_talk)

    def safari():
        try:
            engine = sync_playwright_instance.webkit.launch()
        except Exception as error:  # Not installed: say so rather than pass quietly.
            raise AssertionError(f"WebKit isn't available to test Safari: {error}")
        try:
            page = engine.new_context(viewport=LAPTOP).new_page()
            # WebKit starts slowly and takes a few seconds to open the microphone, more on a busy machine.
            page.set_default_timeout(45_000)
            log_in(page, "TEAM_LEAD")
            page.goto(url)
            expect(message_list(page)).to_be_visible(timeout=45_000)
            page.get_by_role("button", name="Record a voice note").click()
            expect(page.get_by_role("timer")).to_be_visible(timeout=45_000)
            page.wait_for_timeout(2000)
            page.get_by_role("button", name="Stop recording").click()
            expect(page.get_by_role("group", name="Voice note ready to send")).to_be_visible(timeout=20_000)
            mime = page.evaluate("MediaRecorder.isTypeSupported('audio/mp4')")
            page.get_by_role("group", name="Voice note ready to send").get_by_role("button", name="Send").click()
            expect(message_list(listener).locator("[data-voice-player]").last).to_have_attribute(
                "aria-label", re.compile(r"Voice note, 0:0[1-9]"), timeout=60_000
            )
            assert mime, "WebKit should record MP4/AAC"
        finally:
            engine.close()

    step("voice: Safari (WebKit) records MP4 that converts and plays everywhere", safari)

    listener.context.close()
    loud.close()


def has_link_previews(token):
    """The hide route exists when a bad message id is refused as invalid rather than not found."""
    try:
        call("PATCH", "/messages/not-an-id/link-previews", token, {"url": "https://example.com", "isHidden": True})
    except urllib.error.HTTPError as error:
        return error.code != 404
    return True


def run_link_previews(browser, admin_token):
    lead_auth = call("POST", "/auth/login", body=dict(zip(("email", "password"), credentials("TEAM_LEAD"))))
    intern_auth = call("POST", "/auth/login", body=dict(zip(("email", "password"), credentials("INTERN"))))
    channel = call("POST", "/channels", lead_auth["token"], {"name": f"e2e-previews-{RUN}", "visibility": "PUBLIC"})["conversation"]
    call("POST", f"/channels/{channel['id']}/join", intern_auth["token"])
    url = f"{APP}/messages/{channel['id']}"
    label = f"#{channel['name']}"

    sender = new_page(browser)
    receiver = new_page(browser)
    log_in(sender, "TEAM_LEAD")
    log_in(receiver, "INTERN")
    sender.goto(url)
    receiver.goto(url)

    def arrives_live():
        send_message(sender, label, f"{PREFIX} have a look at https://example.com today")
        row = message_list(receiver).get_by_role("listitem").filter(has_text="have a look at")
        expect(row).to_be_visible()
        # The server fetches the page after sending, so the card follows in message:updated.
        card = row.locator(".link-card")
        expect(card).to_be_visible(timeout=20_000)
        expect(card).to_have_class(re.compile("is-new"))
        expect(card).to_contain_text("Example Domain")
        link = card.get_by_role("link")
        expect(link).to_have_attribute("href", re.compile(r"^https://example\.com"))
        expect(link).to_have_attribute("target", "_blank")
        expect(link).to_have_attribute("rel", "noopener noreferrer")
        expect(card.get_by_role("button", name=re.compile("^Hide the preview"))).to_have_count(0)

    step("previews: a card arrives live a moment after sending, and opens safely", arrives_live)

    def sender_hides():
        row = message_list(sender).get_by_role("listitem").filter(has_text="have a look at")
        card = row.locator(".link-card")
        expect(card).to_be_visible(timeout=20_000)
        with sender.expect_request(lambda r: r.method == "PATCH" and r.url.endswith("/link-previews")) as hidden:
            card.get_by_role("button", name=re.compile("^Hide the preview")).click()
        assert hidden.value.post_data_json == {"url": "https://example.com/", "isHidden": True} or hidden.value.post_data_json["isHidden"] is True
        expect(card).to_have_count(0)
        expect(message_list(receiver).get_by_role("listitem").filter(has_text="have a look at").locator(".link-card")).to_have_count(0)

    step("previews: the sender can hide a card, and it goes for everyone", sender_hides)

    def hide_rolls_back():
        send_message(sender, label, f"{PREFIX} and again https://example.com")
        row = message_list(sender).get_by_role("listitem").filter(has_text="and again")
        card = row.locator(".link-card")
        expect(card).to_be_visible(timeout=20_000)
        sender.route("**/link-previews", lambda route: route.fulfill(status=500, json={"error": {"code": "E2E", "message": "Server trouble."}}))
        card.get_by_role("button", name=re.compile("^Hide the preview")).click()
        expect(sender.get_by_text("The preview is still showing.")).to_be_visible()
        expect(card).to_be_visible()
        sender.unroute("**/link-previews")

    step("previews: a failed hide puts the card back with a toast", hide_rolls_back)

    def safe_images():
        def doctor(route):
            response = route.fetch()
            data = response.json()
            for message in data["messages"]:
                if message["linkPreviews"]:
                    message["linkPreviews"] = [
                        {**message["linkPreviews"][0], "imageUrl": "http://insecure.example/picture.png", "faviconUrl": None},
                        {**message["linkPreviews"][0], "url": "https://example.com/broken", "imageUrl": "https://example.com/no-such-image.png"},
                    ]
            route.fulfill(response=response, json=data)

        page = new_page(browser)
        page.route(re.compile(r".*/conversations/[^/]+/messages.*"), doctor)
        log_in(page, "INTERN")
        page.goto(url)
        cards = message_list(page).locator(".link-card")
        expect(cards.first).to_be_visible()
        expect(cards.first.locator("img.link-card-image")).to_have_count(0)
        broken = message_list(page).locator('.link-card:has(a[href="https://example.com/broken"])').first
        expect(broken).to_contain_text("Example Domain")
        expect(broken.locator("img.link-card-image")).to_have_count(0, timeout=15_000)
        expect_no_sideways_scroll(page, "preview cards")
        page.context.close()

    step("previews: only https images load, and a broken one leaves a plain card", safe_images)

    def phone():
        page = new_page(browser, MOBILE)
        log_in(page, "INTERN")
        page.goto(url)
        expect(message_list(page).locator(".link-card").first).to_be_visible()
        expect_no_sideways_scroll(page, "preview cards on a phone")
        page.context.close()

    step("previews: cards fit a phone", phone)

    sender.context.close()
    receiver.context.close()


YT_FAKE = """
window.YT = {
  PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 },
  Player: function (element, options) {
    const player = this;
    player.time = 0;
    player.getCurrentTime = () => player.time;
    player.getDuration = () => 120;
    player.destroy = () => {};
    player.fire = (state, time) => { player.time = time; options.events.onStateChange({ data: state }); };
    window.__players = (window.__players || []).concat(player);
  },
};
window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady();
"""


def has_programs(token):
    try:
        call("GET", "/learning/cohorts", token)
    except urllib.error.HTTPError as error:
        return error.code != 404
    return True


def run_learning_programs(browser, admin_token):
    lead_auth = call("POST", "/auth/login", body=dict(zip(("email", "password"), credentials("TEAM_LEAD"))))
    lead_token, lead_user = lead_auth["token"], lead_auth["user"]
    ada = active_user(admin_token, f"E2E Ada Builder {RUN}", f"e2e.ada.{RUN}@example.test")
    ben = active_user(admin_token, f"E2E Ben Builder {RUN}", f"e2e.ben.{RUN}@example.test")
    course_title = f"{PREFIX} Next.js foundations"
    track_title = f"{PREFIX} Learn then build"
    program_name = f"{PREFIX} Cohort one"
    state = {}

    lead = new_page(browser)
    learner = new_page(browser)
    log_in(lead, "TEAM_LEAD")
    log_in_as(learner, ada["email"], ada["password"])

    def library_before_enrollment():
        learner.goto(f"{APP}/learning")
        expect(learner.get_by_role("heading", name="No learning yet")).to_be_visible()
        tabs = learner.get_by_role("tablist", name="Learning views")
        expect(tabs.get_by_role("tab", name="Courses")).to_be_visible()
        expect(tabs.get_by_role("tab", name="Programs")).to_have_count(0)
        learner.get_by_role("link", name="Browse courses").click()
        expect(learner).to_have_url(re.compile(r"tab=courses"))
        expect(learner.get_by_role("button", name="Add a course")).to_have_count(0)

    step("programs: a learner without an enrollment can browse courses, but not add them", library_before_enrollment)

    def add_course():
        lead.goto(f"{APP}/learning?tab=courses")
        lead.get_by_role("button", name="Add a course").click()
        dialog = lead.get_by_role("dialog", name="Add a course")
        dialog.get_by_label("Title").fill(course_title)
        dialog.get_by_label("Provider").fill("Vercel")
        dialog.get_by_label("Course link").fill("http://nextjs.org/learn")
        dialog.get_by_role("button", name="Add course").click()
        expect(dialog.get_by_text("Use a full https link to the course.")).to_be_visible()
        dialog.get_by_label("Course link").fill("https://nextjs.org/learn")
        dialog.get_by_label("Proof of finishing").select_option("CERTIFICATE_LINK")
        dialog.get_by_label(re.compile("^Topics")).fill("nextjs, react")
        dialog.get_by_role("button", name="Add course").click()
        expect(lead.get_by_text("Course added to the library.")).to_be_visible()
        # Adding opens the new course.
        expect(lead.get_by_role("heading", name=course_title)).to_be_visible()
        expect(lead).to_have_url(re.compile(r"/learning/courses/[0-9a-f-]{36}$"))
        state["course"] = lead.url.rsplit("/", 1)[1]
        lead.get_by_role("link", name="Course library").click()
        expect(lead.get_by_role("list", name="Courses").get_by_text(course_title)).to_be_visible()

    step("programs: a Team Lead adds an external course, with https enforced", add_course)

    def quick_setup():
        lead.goto(f"{APP}/learning?tab=programs")
        lead.get_by_role("button", name="Learn then build").click()
        dialog = lead.get_by_role("dialog", name="Learn then build")
        dialog.get_by_label("Track title").fill(track_title)
        dialog.get_by_role("button", name="Create track").click()
        expect(dialog.get_by_text("Choose at least one course to learn from.")).to_be_visible()
        expect(dialog.get_by_text("Name at least 2 skills, separated by commas.")).to_be_visible()
        expect(dialog.get_by_text("Say what they should hand in.")).to_be_visible()
        dialog.get_by_label(f"{course_title} (Vercel)").check()
        dialog.get_by_label("What to build").fill("A small shop with a cart.")
        dialog.get_by_label("Deliverables").fill("A code link and a live link.")
        dialog.get_by_label("Builds").select_option("TEAM")
        dialog.get_by_label("Skills").fill(f"Next.js {RUN}, Teamwork {RUN}")
        expect(dialog.get_by_label("Unlock the build only once the learning is done")).to_be_checked()
        dialog.get_by_role("button", name="Create track").click()
        expect(lead.get_by_text(f"{track_title} is ready. Now choose who's on it.")).to_be_visible()

        program = lead.get_by_role("dialog", name="New program")
        expect(program.get_by_label("Track")).to_have_value(re.compile("[0-9a-f-]{36}"))
        state["track"] = program.get_by_label("Track").input_value()
        expect(program.get_by_label("Builds")).to_have_value("TEAM")
        program.get_by_label("Name").fill(program_name)
        for person in (ada, ben):
            pick_assignee(program, person["name"], "Learners")
        program.get_by_label("Mentor").select_option(lead_user["id"])
        program.get_by_role("button", name="Start program").click()
        expect(lead.get_by_text(f"{program_name} has started with 2 learners.")).to_be_visible()
        expect(lead).to_have_url(re.compile(r"/learning/programs/[0-9a-f-]{36}$"))
        state["program"] = lead.url.rsplit("/", 1)[1]
        expect(lead.get_by_role("heading", name=program_name)).to_be_visible()
        expect(lead.get_by_text("Team build", exact=False).first).to_be_visible()
        rows = lead.get_by_role("table", name="Learners in this program").locator("tbody tr")
        expect(rows).to_have_count(2)
        expect(rows.filter(has_text=ada["name"])).to_contain_text("Locked")

    step("programs: Learn then build makes a published track, then starts a team program on it", quick_setup)

    def builder_shows_types():
        lead.goto(f"{APP}/learning/tracks/{state['track']}")
        expect(lead.get_by_role("heading", name=track_title)).to_be_visible()
        rows = lead.locator(".track-item")
        expect(rows.filter(has_text=course_title)).to_contain_text("Course")
        expect(rows.filter(has_text="Build").first).to_be_visible()
        expect(lead.get_by_label("Lock builds until the learning before them is done")).to_be_checked()

        card = lead.locator(".card", has=lead.get_by_role("button", name=re.compile("^Rename Learn")))
        card.get_by_role("button", name="Add item").click()
        panel = lead.get_by_role("dialog", name="New item")
        panel.get_by_label("Type").select_option("COURSE")
        panel.get_by_role("button", name="Add item").click()
        expect(panel.get_by_text("Choose a course.")).to_be_visible()
        panel.get_by_role("button", name="Close").click()

        card.get_by_role("button", name="Add item").click()
        panel = lead.get_by_role("dialog", name="New item")
        panel.get_by_label("Type").select_option("BUILD")
        expect(panel.get_by_label(re.compile("^What to build"))).to_be_visible()
        expect(panel.get_by_label("Builds")).to_be_visible()
        panel.get_by_role("button", name="Close").click()

    step("programs: the track builder shows course and build items, and the build lock", builder_shows_types)

    def build_locked():
        learner.goto(f"{APP}/learning")
        tabs = learner.get_by_role("tablist", name="Learning views")
        expect(tabs.get_by_role("tab", name="Programs")).to_be_visible()
        learner.get_by_role("link", name=re.compile(re.escape(track_title))).first.click()
        build = learner.locator("li", has_text="Unlocks after the learning")
        expect(build).to_have_count(1)
        build.get_by_role("button").click()
        panel = learner.get_by_role("dialog")
        expect(panel.get_by_text("This build unlocks once the learning before it is done.")).to_be_visible()
        expect(panel.get_by_label("Code link")).to_have_count(0)
        panel.get_by_role("button", name="Close").click()
        state["enrollment"] = learner.url.rsplit("/", 1)[1]

    step("programs: the build stays locked until the learning is done", build_locked)

    def send_proof():
        learner.goto(f"{APP}/learning/courses/{state['course']}")
        expect(learner.get_by_role("heading", name=course_title)).to_be_visible()
        learner.get_by_role("button", name="Start course").click()
        expect(learner.get_by_text("In progress", exact=True)).to_be_visible()
        learner.get_by_role("button", name="Send for review").click()
        expect(learner.get_by_text("Add the link to your certificate.")).to_be_visible()
        learner.get_by_label("Certificate link").fill("http://example.test/cert")
        learner.get_by_role("button", name="Send for review").click()
        expect(learner.get_by_text("Use a full https link.")).to_be_visible()
        learner.get_by_label("Certificate link").fill("https://example.test/cert/ada")
        learner.get_by_role("button", name="Send for review").click()
        expect(learner.get_by_text("Sent for review.")).to_be_visible()
        expect(learner.get_by_text("Waiting for review", exact=True).first).to_be_visible()

    step("programs: a learner starts the course and sends a certificate link", send_proof)

    def review_proof():
        lead.goto(f"{APP}/learning?tab=reviews")
        entry = lead.get_by_role("button", name=re.compile(re.escape(course_title)))
        expect(entry).to_contain_text("Course proof · Vercel")
        entry.click()
        panel = lead.get_by_role("dialog")
        expect(panel.get_by_role("heading", name=course_title)).to_be_visible()
        expect(panel.get_by_role("link", name="https://example.test/cert/ada")).to_be_visible()
        panel.get_by_role("button", name="Request changes").click()
        expect(panel.get_by_text(re.compile("note", re.I)).first).to_be_visible()
        panel.get_by_label(re.compile("^Note")).fill("That link is to someone else's certificate.")
        panel.get_by_role("button", name="Request changes").click()
        expect(lead.get_by_text("Changes requested.")).to_be_visible()

        learner.reload()
        expect(learner.get_by_text("That link is to someone else's certificate.")).to_be_visible()
        learner.get_by_label("Certificate link").fill("https://example.test/cert/ada-2")
        learner.get_by_role("button", name="Send again").click()
        expect(learner.get_by_text("Sent for review.")).to_be_visible()

        lead.reload()
        lead.get_by_role("button", name=re.compile(re.escape(course_title))).click()
        lead.get_by_role("dialog").get_by_role("button", name="Approve").click()
        expect(lead.get_by_text("Course approved.")).to_be_visible()
        learner.reload()
        expect(learner.get_by_text("Done", exact=True)).to_be_visible()

    step("programs: the mentor asks for changes with a note, then approves the course", review_proof)

    def team_build():
        learner.goto(f"{APP}/learning/enrollments/{state['enrollment']}")
        expect(learner.locator("li", has_text="Unlocks after the learning")).to_have_count(0)
        learner.locator("li", has_text="Build").get_by_role("button").first.click()
        panel = learner.get_by_role("dialog")
        expect(panel.get_by_text("A small shop with a cart.")).to_be_visible()
        expect(panel.get_by_text("One submission counts for the whole team.")).to_be_visible()
        panel.get_by_role("button", name="Send the build").click()
        expect(panel.get_by_text("Add the link to the code.")).to_be_visible()
        panel.get_by_label("Code link").fill("https://github.com/example/shop")
        panel.get_by_label(re.compile("^Live link")).fill("http://shop.example.test")
        panel.get_by_role("button", name="Send the build").click()
        expect(panel.get_by_text("Use a full https link.")).to_be_visible()
        panel.get_by_label(re.compile("^Live link")).fill("https://shop.example.test")
        panel.get_by_role("button", name="Send the build").click()
        expect(learner.get_by_text("Sent for the whole team.")).to_be_visible()

        lead.goto(f"{APP}/learning/programs/{state['program']}")
        rows = lead.get_by_role("table", name="Learners in this program").locator("tbody tr")
        expect(rows.filter(has_text=ada["name"])).to_contain_text("Unlocked")
        expect(rows.filter(has_text=ben["name"])).to_contain_text("Locked")
        expect(lead.get_by_text(f"Sent by {ada['name']}")).to_be_visible()
        expect(lead.get_by_role("link", name="https://github.com/example/shop")).to_be_visible()

    step("programs: one learner sends the team build, and the program page shows it", team_build)

    def review_team_build():
        lead.goto(f"{APP}/learning?tab=reviews")
        entry = lead.get_by_role("button", name=re.compile("Team build"))
        expect(entry).to_be_visible()
        entry.click()
        panel = lead.get_by_role("dialog")
        panel.get_by_role("group", name="Score", exact=True).get_by_role("button", name="4 out of 5").click()
        panel.get_by_role("group", name=f"Score for {ada['name']}").get_by_role("button", name="5 out of 5").click()
        panel.get_by_label(f"Note for {ada['name']}").fill("Led the cart work.")
        with lead.expect_request(lambda r: r.method == "POST" and "/review" in r.url) as sent:
            panel.get_by_role("button", name="Approve").click()
        body = sent.value.post_data_json
        assert body["memberReviews"] == [{"learnerId": ada["id"], "score": 5, "note": "Led the cart work."}], body

        learner.reload()
        learner.locator("li", has_text="Build").get_by_role("button").first.click()
        panel = learner.get_by_role("dialog")
        expect(panel.get_by_text("Led the cart work.", exact=False)).to_be_visible()
        expect(panel.get_by_text(f"Sent by {ada['name']} for the team", exact=False)).to_be_visible()

    step("programs: a team build is reviewed with a score and note for one person", review_team_build)

    def youtube_progress():
        course = call("POST", "/learning/courses", lead_token, {
            "title": f"{PREFIX} Watch here",
            "provider": "YouTube",
            "format": "YOUTUBE",
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "youtubeUrls": ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
            "level": "BEGINNER",
        })["course"]
        page = new_page(browser)
        log_in_as(page, ben["email"], ben["password"])
        page.route("https://www.youtube.com/iframe_api", lambda route: route.fulfill(content_type="text/javascript", body=YT_FAKE))
        page.goto(f"{APP}/learning/courses/{course['id']}")
        page.get_by_role("button", name="Start course").click()
        expect(page.get_by_role("region", name=re.compile("^Video:"))).to_be_visible()
        page.wait_for_function("window.__players && window.__players.length === 1")
        expect(page.get_by_role("img", name="0% watched")).to_be_visible()
        page.evaluate("window.__players[0].fire(YT.PlayerState.PLAYING, 0)")
        with page.expect_response(lambda r: r.request.method == "POST" and "/videos/" in r.url) as sent:
            page.evaluate("window.__players[0].fire(YT.PlayerState.PAUSED, 120)")
        assert sent.value.request.post_data_json == {"watchedSeconds": 120, "durationSeconds": 120}, sent.value.request.post_data_json
        # The server only credits what could have played since the last report: 30 seconds at first.
        expect(page.get_by_role("img", name="25% watched")).to_be_visible()
        # A second report inside 10 seconds is refused with 429, which the page ignores.
        with page.expect_response(lambda r: r.request.method == "POST" and "/videos/" in r.url) as again:
            page.evaluate("window.__players[0].fire(YT.PlayerState.ENDED, 120)")
        assert again.value.status == 429, again.value.status
        page.wait_for_timeout(500)
        expect(page.locator(".toast, [role=alert]").filter(has_text=re.compile("10 seconds|went wrong"))).to_have_count(0)
        expect(page.get_by_role("img", name="25% watched")).to_be_visible()
        page.context.close()

    step("programs: a YouTube course reports watching, capped by the server, and ignores 429", youtube_progress)

    lead.context.close()
    learner.context.close()
    for person in (ada, ben):
        call("POST", f"/users/{person['id']}/deactivate", admin_token)


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
        user_action(admin, lead_name, "Edit")
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
        user_action(admin, lead_name, "Edit")
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
        user_action(admin, intern_name, "Edit")
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
        user_action(admin, intern_name, "Edit")
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
