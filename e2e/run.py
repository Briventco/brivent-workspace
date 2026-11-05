"""Browser checks for tasks, directory, settings and permissions. See e2e/README.md."""
import json
import os
import re
import sys
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

REPO = Path(__file__).resolve().parent.parent
APP = os.environ.get("E2E_APP_URL", "http://localhost:3000").rstrip("/")
RUN = str(int(time.time()))[-6:]
PREFIX = f"[e2e] {RUN}"
DESTRUCTIVE = os.environ.get("E2E_DESTRUCTIVE") == "1"
# The backend's console output. Outside production it prints emails there instead of sending them.
BACKEND_LOG = os.environ.get("E2E_BACKEND_LOG")
PASSWORD = "e2e-brand-new-passphrase"
SECOND_PASSWORD = "e2e-another-new-passphrase"
MOBILE = {"width": 375, "height": 720}
LAPTOP = {"width": 1366, "height": 800}
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
    expect(page.get_by_role("heading", name=re.compile("^Welcome"))).to_be_visible(timeout=45_000)


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


def expect_url_is(page, path):
    """The whole address, so a surviving token or a redirect both fail."""
    expect(page).to_have_url(f"{APP}{path}")


def invite(admin, name, email):
    admin.goto(f"{APP}/users")
    admin.get_by_role("button", name="Add user").click()
    dialog = admin.get_by_role("dialog")
    dialog.get_by_label("Full name").fill(name)
    dialog.get_by_label("Work email").fill(email)
    dialog.get_by_role("button", name="Send invite").click()
    dialog.get_by_role("button", name="Done").click()


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
            run_public_pages(browser)
            run_admin(browser, page, admin_task, throwaway_task, intern_name)
            if DESTRUCTIVE and BACKEND_LOG:
                run_invites(browser, page)
            run_team_lead(browser, lead_task, lead_name, intern_name)
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


def run_admin(browser, page, title, throwaway, intern_name):
    def dashboard():
        log_in(page, "SUPER_ADMIN")
        for label in ("Open", "Overdue", "Done this week"):
            expect(page.get_by_text(label, exact=True).first).to_be_visible()
        expect(page.get_by_role("heading", name="Team-wide")).to_be_visible()
        expect(page.get_by_role("heading", name="My tasks due soon")).to_be_visible()
        expect(page.get_by_role("link", name="Notifications")).to_have_count(0)
    step("Super Admin: dashboard shows team counts, lists and no bell", dashboard)

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
        group = page.get_by_role("group", name="Task views")
        for label in ("My tasks", "Tasks I assigned", "Unassigned", "All tasks"):
            expect(group.get_by_role("button", name=label)).to_be_visible()
        group.get_by_role("button", name="Tasks I assigned").click()
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
        admin.get_by_role("button", name="Add user").click()
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
        expect(row.get_by_text("Pending", exact=True)).to_be_visible()
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

        def add_email(route):
            response = route.fetch()
            route.fulfill(response=response, json={**response.json(), "email": email3})

        page.route(f"{api_url()}/auth/set-password", add_email)
        page.goto(emailed_link(email3, "/set-password"))
        fill_passwords(page, PASSWORD)
        page.get_by_role("button", name="Set password").click()
        expect(page.get_by_label("Work email")).to_have_value(email3)
        expect(page.get_by_label("Password", exact=True)).to_be_focused()
        assert email3 not in page.url
        page.context.close()
    step("Login: fills the email in when the API sends one (response simulated)", prefills_email)

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
        admin.get_by_role("button", name="Add user").click()
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
        expect(row.get_by_text("Pending", exact=True)).to_be_visible()
    step("Pending user: deactivate, then reactivate returns them to Pending", deactivate_pending)
    fresh.context.close()


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
        page.get_by_role("group", name="Task views").get_by_role("button", name="Tasks I assigned").click()
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
        expect(page.get_by_role("group", name="Task views")).to_have_count(0)
        expect(page.get_by_role("link", name=assigned_title)).to_be_visible()
        expect(page.get_by_role("link", name=admin_title)).to_be_visible()
        page.get_by_label(f"Status of {assigned_title}").select_option("IN_PROGRESS")
        expect(page.get_by_text("Moved to In Progress.")).to_be_visible()
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
