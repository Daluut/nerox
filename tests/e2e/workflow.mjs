// End-to-end workflow test against a running Nerox + Supabase.
//
//   E2E_BASE_URL=http://localhost:3000 npm run test:e2e
//
// Needs: the app running, a Supabase project with email confirmation turned OFF
// (so sign-ups get a session immediately), and a Chromium. Set CHROME_PATH to a
// Chromium/Chrome binary, or run `npx playwright install chromium` first.
// Each run uses fresh email addresses, so it can be re-run without resetting data.
import { chromium } from "playwright-core";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const RUN = Date.now().toString(36);
const PASSWORD = "correct-horse-1";
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const ok = (s) => console.log("✓", s);
const browsers = [];
const pageErrors = [];

async function page({ mobile = false } = {}) {
  // One browser per user keeps sessions strictly separate.
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
  browsers.push(b);
  const c = await b.newContext(mobile ? { viewport: { width: 390, height: 844 } } : { viewport: { width: 1440, height: 900 } });
  const p = await c.newPage();
  p.on("pageerror", (e) => {
    console.log("  [pageerror]", e.message);
    pageErrors.push(e.message);
  });
  return p;
}

/** New users see the tutorial on their first app page; step through it or skip it. */
async function handleTour(p, { walk = false } = {}) {
  const start = p.locator("text=Show me around");
  await start.waitFor({ timeout: 5000 }).catch(() => {});
  if (!(await start.isVisible())) return false;
  if (!walk) {
    await p.click("text=Skip tour");
    return true;
  }
  await start.click();
  for (let i = 0; i < 20 && !(await p.locator("text=You're all set").isVisible()); i++) await p.getByRole("button", { name: /^Next/ }).click();
  await p.click("text=Start using Nerox");
  return true;
}

async function signUp(p, name, email, url = `${BASE}/signup`) {
  await p.goto(url);
  await p.fill("#name", name);
  await p.fill("#email", email);
  await p.fill("#password", PASSWORD);
  await p.click("button[type=submit]");
}

async function main() {
  // 1–3. Register, create a workspace and a project from a template.
  const ana = await page();
  await signUp(ana, "Ana Lopez", `ana-${RUN}@example.com`);
  await ana.waitForURL("**/onboarding");
  await ana.click("text=Set up my workspace");
  await ana.fill("#ws-name", `Studio ${RUN}`);
  await ana.click("text=Create workspace");
  await ana.waitForSelector("text=Start your first project");
  ok("registered and created a workspace");

  await ana.fill("#p-name", "Coursework app");
  await ana.fill("#p-start", day(-14));
  await ana.fill("#p-deadline", day(14));
  await ana.click("text=Continue to tasks");
  await ana.fill('input[aria-label="New task title"]', "Prepare demo video");
  await ana.click("button:has-text('Add')");
  await ana.click("text=Create project");
  await ana.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  const project = ana.url();
  ok("created a project with template tasks, milestones and dependencies");
  if (!(await handleTour(ana, { walk: true }))) throw new Error("first-time tutorial did not appear");
  await ana.reload();
  if (await ana.locator("text=Show me around").isVisible({ timeout: 2000 }).catch(() => false)) throw new Error("tutorial reappeared after finishing");
  ok("first-time tutorial shown once and completed");

  // 4. Invite a team member, who signs up through the link and joins.
  await ana.goto(`${BASE}/team`);
  await ana.click("text=Create invite link");
  const link = await ana.inputValue("input[aria-label='Invitation link']");
  const ben = await page();
  await ben.goto(link);
  await ben.waitForURL("**/login?next=**");
  await ben.waitForLoadState("networkidle");
  await ben.click("text=Create an account");
  await ben.waitForURL("**/signup?next=**");
  await ben.fill("#name", "Ben Okafor");
  await ben.fill("#email", `ben-${RUN}@example.com`);
  await ben.fill("#password", PASSWORD);
  await ben.click("button[type=submit]");
  await ben.waitForURL("**/invite/**");
  await ben.click("text=Accept and join");
  await ben.waitForURL("**/overview");
  await handleTour(ben);
  await ben.waitForSelector("main >> text=Coursework app", { timeout: 15000 }).catch(() => {
    throw new Error("new member can't see the project");
  });
  ok("invited member joined and sees the project");

  // 5–6. Assign a task (the assignee is notified).
  await ana.goto(`${project}/list`);
  await ana.click("a:has-text('Implement API')");
  await ana.waitForSelector("text=Mark complete");
  await ana.selectOption("dialog dd select >> nth=2", { label: "Ben Okafor" });
  await ana.waitForSelector("text=Assigned to Ben Okafor.");
  await ben.goto(`${BASE}/overview`);
  await ben.click("button[aria-label^='Notifications']");
  await ben.waitForSelector("text=You were assigned “Implement API”");
  ok("assignment saved and the assignee was notified");

  // 7. Dependencies: the UI won't offer a task that would create a loop.
  await ana.goto(`${project}/list`);
  await ana.click("a:has-text('Define requirements and scope')");
  await ana.waitForSelector("text=Mark complete");
  await ana.click("button:has-text('+ Waits on')");
  const options = await ana.locator("select[aria-label='Choose task'] option").allTextContents();
  if (options.some((o) => o.includes("Final delivery"))) throw new Error("a circular dependency was offered");
  ok("circular dependency prevented");

  // 8. Complete a task.
  await ana.click("text=Mark complete");
  await ana.waitForSelector("text=Task completed.");
  ok("task completed");

  // Board move persists.
  await ana.goto(`${project}/board`);
  await ana.selectOption('select[aria-label="Move “Write documentation” to"]', "in_review");
  await ana.waitForTimeout(1200);
  await ana.reload();
  if (!(await ana.locator("section[aria-label^='In Review']").textContent()).includes("Write documentation")) throw new Error("board move did not persist");
  ok("board status change persisted");

  // 9–10. Updated project and Pulse.
  await ana.goto(`${project}/pulse`);
  await ana.waitForSelector("text=Contributing factors");
  const pulse = await ana.textContent("main");
  if (!/is overdue/.test(pulse)) throw new Error("Pulse did not report overdue template work");
  ok("Pulse shows an explained risk with evidence");

  // 11. What If?: simulate a delay, save it, then apply it after confirming.
  await ana.goto(`${BASE}/what-if`);
  await ana.waitForSelector("text=Your scenario");
  const apiValue = await ana.locator("#wi-task option", { hasText: "Implement API" }).first().getAttribute("value");
  await ana.selectOption("#wi-task", apiValue);
  await ana.fill("#wi-days", "4");
  await ana.click("text=Add this change");
  await ana.waitForSelector("text=Tasks that would move");
  const moved = await ana.locator("main").textContent();
  if (!/Waits on “Implement API”/.test(moved)) throw new Error("What If? didn't propagate the delay to dependent tasks");
  ok("What If? shows a delay rippling through dependent tasks");
  await ana.fill("#wi-save", "API four days late");
  await ana.click("button:has-text('Save')");
  await ana.waitForSelector("text=Scenario saved.");
  await ana.click("button:has-text('Apply to project')");
  await ana.waitForSelector("text=Apply this scenario to the real project?");
  await ana.click("button:has-text('Apply changes')");
  await ana.waitForSelector("text=Scenario applied.");
  await ana.waitForSelector("text=Applied", { timeout: 15000 });
  ok("scenario saved, then applied only after confirmation");

  // 12. Memory explains itself and shows retrospectives.
  await ana.goto(`${BASE}/memory`);
  await ana.waitForSelector("text=How Memory works");
  await ana.goto(`${BASE}/memory?tab=retros`);
  await ana.waitForSelector("text=What went well");
  ok("Memory page and retrospectives load");

  // Nerox AI answers from the help guide.
  await ana.click("button[aria-label='Ask Nerox AI']");
  await ana.click("text=What does Pulse do?");
  await ana.waitForSelector("text=From the Nerox help guide");
  ok("Nerox AI answers a question");
  await ana.click("button[aria-label='Ask Nerox AI']");

  // 13. Data persists after refresh, and outsiders can't reach it.
  await ana.goto(`${project}/list`);
  await ana.reload();
  await ana.waitForSelector("main >> text=Prepare demo video", { timeout: 15000 }).catch(() => {
    throw new Error("data did not persist");
  });
  const eve = await page();
  await signUp(eve, "Eve", `eve-${RUN}@example.com`);
  await eve.waitForURL("**/onboarding");
  await eve.click("text=Set up my workspace");
  await eve.fill("#ws-name", `Other ${RUN}`);
  await eve.click("text=Create workspace");
  await eve.waitForSelector("text=Start your first project");
  await eve.goto(project);
  await handleTour(eve);
  await eve.waitForLoadState("networkidle");
  if ((await eve.textContent("body")).includes("Prepare demo video")) throw new Error("cross-workspace access");
  ok("data persists; another workspace's user can't open the project by URL");

  // Public pages.
  const visitor = await page();
  await visitor.goto(`${BASE}/pricing`);
  await visitor.waitForSelector("text=Free to start. Room to grow.");
  await visitor.goto(`${BASE}/about`);
  await visitor.waitForSelector("text=Why Nerox is different");
  await visitor.waitForSelector("a[href='https://www.instagram.com/neroxhq/']");
  ok("public pricing and About pages load, with Instagram links");

  // Mobile smoke test.
  const m = await page({ mobile: true });
  await m.goto(`${BASE}/login`);
  await m.fill("#email", `ana-${RUN}@example.com`);
  await m.fill("#password", PASSWORD);
  await m.click("button[type=submit]");
  await m.waitForURL("**/overview");
  await m.click("button[aria-label='Open menu']");
  await m.waitForSelector("div[aria-label='Navigation'] >> text=My Tasks");
  ok("mobile navigation drawer works");
}

main()
  .then(() => {
    if (pageErrors.length) throw new Error(`${pageErrors.length} uncaught page error(s): ${pageErrors[0]}`);
    console.log("\nAll end-to-end checks passed.");
  })
  .catch((e) => {
    console.error("✗", e.message);
    process.exitCode = 1;
  })
  .finally(() => Promise.all(browsers.map((b) => b.close())));
