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

async function page({ mobile = false } = {}) {
  // One browser per user keeps sessions strictly separate.
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
  browsers.push(b);
  const c = await b.newContext(mobile ? { viewport: { width: 390, height: 844 } } : { viewport: { width: 1440, height: 900 } });
  const p = await c.newPage();
  p.on("pageerror", (e) => console.log("  [pageerror]", e.message));
  return p;
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

  // 11–12. What If? and Memory are honest about being unbuilt.
  await ana.goto(`${BASE}/what-if`);
  await ana.waitForSelector("text=What If? isn't available yet");
  await ana.goto(`${BASE}/memory`);
  await ana.waitForSelector("text=History recorded in this workspace so far");
  ok("planned features are labelled as not available");

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
  await eve.waitForLoadState("networkidle");
  if ((await eve.textContent("body")).includes("Prepare demo video")) throw new Error("cross-workspace access");
  ok("data persists; another workspace's user can't open the project by URL");

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
  .then(() => console.log("\nAll end-to-end checks passed."))
  .catch((e) => {
    console.error("✗", e.message);
    process.exitCode = 1;
  })
  .finally(() => Promise.all(browsers.map((b) => b.close())));
