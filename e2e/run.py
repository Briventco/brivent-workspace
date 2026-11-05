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
    email, password = credentials(role)
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
            run_admin(browser, page, admin_task, throwaway_task, intern_name)
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
        if not DESTRUCTIVE:
            return
        name, email = f"E2E Reset {RUN}", f"e2e.reset.{RUN}@example.test"
        page.get_by_role("button", name="Add user").click()
        dialog = page.get_by_role("dialog")
        dialog.get_by_label("Full name").fill(name)
        dialog.get_by_label("Work email").fill(email)
        dialog.get_by_role("button", name="Generate a password").click()
        dialog.get_by_role("button", name="Add user").click()
        dialog.get_by_role("button", name="Done").click()
        page.get_by_role("button", name=f"Reset password for {name}").click()
        page.get_by_role("dialog").get_by_role("button", name="Reset password").click()
        expect(page.get_by_role("heading", name="Temporary password")).to_be_visible()
        expect(page.get_by_role("dialog").get_by_role("button", name="Copy")).to_be_visible()
        page.get_by_role("dialog").get_by_role("button", name="Done").click()
    step("Super Admin: reset password confirms first", reset_dialog)


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
