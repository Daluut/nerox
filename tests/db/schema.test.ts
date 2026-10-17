import { beforeAll, describe, expect, it } from "vitest";
import { createDb } from "./harness";

/**
 * Integration tests for the database layer: migrations, row-level security,
 * workspace isolation, integrity triggers, activity, notifications and the
 * transactional functions the app calls.
 */
let h: Awaited<ReturnType<typeof createDb>>;
let ana: string, ben: string, cleo: string, outsider: string;
let ws: string, otherWs: string, project: string;
const taskIds: Record<string, string> = {};

const tasksJson = JSON.stringify([
  { key: "db", title: "Database schema", priority: "high", start_date: "2026-10-19", due_date: "2026-10-23", estimate_hours: 8 },
  { key: "api", title: "API", priority: "high", start_date: "2026-10-23", due_date: "2026-10-30", estimate_hours: 16, depends_on: ["db"] },
  { key: "fe", title: "Frontend integration", due_date: "2026-11-06", depends_on: ["api"] },
  { key: "test", title: "Testing", due_date: "2026-11-12", depends_on: ["fe"] },
]);

beforeAll(async () => {
  h = await createDb();
  ana = await h.createUser("ana@example.com", "Ana");
  ben = await h.createUser("ben@example.com", "Ben");
  cleo = await h.createUser("cleo@example.com");
  outsider = await h.createUser("eve@example.com", "Eve");
  ws = await h.as(ana, async () => (await h.q<{ id: string }>("select public.create_workspace('Studio') as id"))[0].id);
  otherWs = await h.as(outsider, async () => (await h.q<{ id: string }>("select public.create_workspace('Eve Co') as id"))[0].id);
});

describe("accounts and workspaces", () => {
  it("creates a profile for each new auth user", async () => {
    const rows = await h.q<{ display_name: string }>("select display_name from profiles where id = any($1) order by email", [[ana, cleo]]);
    expect(rows.map((r) => r.display_name)).toEqual(["Ana", "cleo"]);
  });

  it("makes the workspace creator its owner", async () => {
    const rows = await h.as(ana, () => h.q("select role from workspace_members where workspace_id = $1", [ws]));
    expect(rows).toEqual([{ role: "owner" }]);
  });

  it("rejects workspace creation without a session", async () => {
    await expect(h.as("", () => h.q("select public.create_workspace('X')"))).rejects.toThrow();
  });
});

describe("project creation", () => {
  it("creates a project with members, milestones, tasks and dependencies atomically", async () => {
    project = await h.as(ana, async () =>
      (
        await h.q<{ id: string }>(
          "select public.create_project($1, 'Coursework app', 'desc', '2026-10-19', '2026-11-16', null, '{}', $2::jsonb, $3::jsonb) as id",
          [ws, JSON.stringify([{ name: "Feature complete", target_date: "2026-11-06" }]), tasksJson],
        )
      )[0].id,
    );
    const tasks = await h.as(ana, () => h.q<{ id: string; title: string; workspace_id: string }>("select id, title, workspace_id from tasks where project_id = $1", [project]));
    expect(tasks).toHaveLength(4);
    expect(tasks.every((t) => t.workspace_id === ws)).toBe(true);
    for (const t of tasks) taskIds[t.title] = t.id;
    const deps = await h.as(ana, () => h.q("select * from task_dependencies where project_id = $1", [project]));
    expect(deps).toHaveLength(3);
    const ms = await h.as(ana, () => h.q("select name from milestones where project_id = $1", [project]));
    expect(ms).toEqual([{ name: "Feature complete" }]);
    const members = await h.as(ana, () => h.q("select user_id from project_members where project_id = $1", [project]));
    expect(members).toEqual([{ user_id: ana }]);
  });

  it("rolls back everything when one part fails", async () => {
    const bad = JSON.stringify([{ key: "a", title: "" }]); // violates the title check
    await expect(
      h.as(ana, () => h.q("select public.create_project($1, 'Broken', '', null, null, null, '{}', '[]', $2::jsonb)", [ws, bad])),
    ).rejects.toThrow();
    const rows = await h.as(ana, () => h.q("select id from projects where name = 'Broken'"));
    expect(rows).toHaveLength(0);
  });

  it("rejects a start date after the deadline", async () => {
    await expect(
      h.as(ana, () => h.q("select public.create_project($1, 'Backwards', '', '2026-12-01', '2026-11-01', null)", [ws])),
    ).rejects.toThrow();
  });
});

describe("workspace isolation", () => {
  it("hides other workspaces' projects and tasks", async () => {
    const projects = await h.as(outsider, () => h.q("select id from projects where id = $1", [project]));
    const tasks = await h.as(outsider, () => h.q("select id from tasks where project_id = $1", [project]));
    expect(projects).toHaveLength(0);
    expect(tasks).toHaveLength(0);
  });

  it("blocks writes into a workspace you don't belong to, even with a known ID", async () => {
    await expect(
      h.as(outsider, () => h.q("insert into tasks (project_id, workspace_id, title, creator_id) values ($1, $2, 'sneaky', $3)", [project, otherWs, outsider])),
    ).rejects.toThrow(/row-level security/);
    const updated = await h.as(outsider, () => h.q("update tasks set title = 'pwned' where id = $1 returning id", [taskIds["API"]]));
    expect(updated).toHaveLength(0);
    const deleted = await h.as(outsider, () => h.q("delete from projects where id = $1 returning id", [project]));
    expect(deleted).toHaveLength(0);
  });

  it("ignores a client-supplied workspace_id and derives it from the project", async () => {
    const rows = await h.as(ana, () =>
      h.q<{ workspace_id: string }>("insert into tasks (project_id, workspace_id, title, creator_id) values ($1, $2, 'Spoof', $3) returning workspace_id", [project, otherWs, ana]),
    );
    expect(rows[0].workspace_id).toBe(ws);
  });

  it("does not expose profiles of people outside your workspaces", async () => {
    const rows = await h.as(outsider, () => h.q("select id from profiles where id = $1", [ana]));
    expect(rows).toHaveLength(0);
  });
});

describe("invitations and roles", () => {
  it("lets a member join through a valid invitation and rejects reuse", async () => {
    await h.as(ana, () =>
      h.q("insert into invitations (workspace_id, role, token_hash, invited_by, expires_at) values ($1, 'member', 'hash-ben', $2, now() + interval '7 days')", [ws, ana]),
    );
    const joined = await h.as(ben, async () => (await h.q<{ ws: string }>("select public.accept_invitation('hash-ben') as ws"))[0].ws);
    expect(joined).toBe(ws);
    await expect(h.as(cleo, () => h.q("select public.accept_invitation('hash-ben')"))).rejects.toThrow(/already been used/);
  });

  it("rejects expired invitations and invitations addressed to someone else", async () => {
    await h.as(ana, () =>
      h.q(
        "insert into invitations (workspace_id, role, token_hash, invited_by, expires_at, email) values ($1, 'viewer', 'hash-old', $2, now() - interval '1 day', null), ($1, 'viewer', 'hash-dan', $2, now() + interval '1 day', 'dan@example.com')",
        [ws, ana],
      ),
    );
    await expect(h.as(cleo, () => h.q("select public.accept_invitation('hash-old')"))).rejects.toThrow(/expired/);
    await expect(h.as(cleo, () => h.q("select public.accept_invitation('hash-dan')"))).rejects.toThrow(/different email/);
  });

  it("does not let members create invitations", async () => {
    await expect(
      h.as(ben, () => h.q("insert into invitations (workspace_id, role, token_hash, invited_by, expires_at) values ($1, 'admin', 'x', $2, now() + interval '1 day')", [ws, ben])),
    ).rejects.toThrow(/row-level security/);
  });

  it("gives viewers read-only access", async () => {
    await h.as(ana, () =>
      h.q("insert into invitations (workspace_id, role, token_hash, invited_by, expires_at) values ($1, 'viewer', 'hash-cleo', $2, now() + interval '1 day')", [ws, ana]),
    );
    await h.as(cleo, () => h.q("select public.accept_invitation('hash-cleo')"));
    const visible = await h.as(cleo, () => h.q("select id from tasks where project_id = $1", [project]));
    expect(visible.length).toBeGreaterThan(0);
    await expect(
      h.as(cleo, () => h.q("insert into tasks (project_id, workspace_id, title, creator_id) values ($1, $2, 'nope', $3)", [project, ws, cleo])),
    ).rejects.toThrow(/row-level security/);
    const updated = await h.as(cleo, () => h.q("update tasks set status = 'done' where id = $1 returning id", [taskIds["API"]]));
    expect(updated).toHaveLength(0);
    await expect(
      h.as(cleo, () => h.q("insert into comments (task_id, workspace_id, author_id, content) values ($1, $2, $3, 'hi')", [taskIds["API"], ws, cleo])),
    ).rejects.toThrow(/row-level security/);
  });

  it("enforces role-change rules on the server", async () => {
    await expect(h.as(ben, () => h.q("select public.set_member_role($1, $2, 'member')", [ws, cleo]))).rejects.toThrow(/permission/);
    await h.as(ana, () => h.q("select public.set_member_role($1, $2, 'admin')", [ws, ben]));
    // An admin may not create other admins or touch the owner.
    await expect(h.as(ben, () => h.q("select public.set_member_role($1, $2, 'admin')", [ws, cleo]))).rejects.toThrow(/permission/);
    await expect(h.as(ben, () => h.q("select public.set_member_role($1, $2, 'viewer')", [ws, ana]))).rejects.toThrow(/permission/);
    await h.as(ben, () => h.q("select public.set_member_role($1, $2, 'member')", [ws, cleo]));
    const roles = await h.as(ana, () => h.q("select user_id, role from workspace_members where workspace_id = $1 order by joined_at", [ws]));
    expect(roles).toEqual([
      { user_id: ana, role: "owner" },
      { user_id: ben, role: "admin" },
      { user_id: cleo, role: "member" },
    ]);
  });
});

describe("tasks, dependencies and history", () => {
  it("prevents circular dependencies with a clear error", async () => {
    await expect(
      h.as(ana, () => h.q("insert into task_dependencies (project_id, workspace_id, predecessor_id, successor_id) values ($1, $2, $3, $4)", [project, ws, taskIds["Testing"], taskIds["Database schema"]])),
    ).rejects.toThrow(/circular_dependency/);
  });

  it("rejects dependencies across projects", async () => {
    const other = await h.as(ana, async () => (await h.q<{ id: string }>("select public.create_project($1, 'Other', '', null, null, null) as id", [ws]))[0].id);
    const t = await h.as(ana, async () =>
      (await h.q<{ id: string }>("insert into tasks (project_id, workspace_id, title, creator_id) values ($1, $2, 'Elsewhere', $3) returning id", [other, ws, ana]))[0].id,
    );
    await expect(
      h.as(ana, () => h.q("insert into task_dependencies (project_id, workspace_id, predecessor_id, successor_id) values ($1, $2, $3, $4)", [project, ws, t, taskIds["API"]])),
    ).rejects.toThrow(/same project/);
  });

  it("only allows assignment to active workspace members", async () => {
    await expect(h.as(ana, () => h.q("update tasks set assignee_id = $1 where id = $2", [outsider, taskIds["API"]]))).rejects.toThrow(/workspace members/);
  });

  it("records completion, reopening and status timing", async () => {
    const done = await h.as(ana, () => h.q<{ completed_at: string | null }>("update tasks set status = 'done' where id = $1 returning completed_at", [taskIds["Database schema"]]));
    expect(done[0].completed_at).not.toBeNull();
    const reopened = await h.as(ana, () => h.q<{ completed_at: string | null }>("update tasks set status = 'todo' where id = $1 returning completed_at", [taskIds["Database schema"]]));
    expect(reopened[0].completed_at).toBeNull();
    const events = await h.as(ana, () => h.q<{ event_type: string }>("select event_type from activity_events where entity_id = $1 order by created_at", [taskIds["Database schema"]]));
    expect(events.map((e) => e.event_type)).toEqual(expect.arrayContaining(["task_created", "task_completed", "task_reopened"]));
  });

  it("does not let clients forge completion or creator fields", async () => {
    const rows = await h.as(ben, () =>
      h.q<{ completed_at: string | null; creator_id: string }>("update tasks set completed_at = now(), creator_id = $1 where id = $2 returning completed_at, creator_id", [ben, taskIds["API"]]),
    );
    expect(rows[0]).toEqual({ completed_at: null, creator_id: ana });
  });

  it("notifies the assignee (not the actor) and logs the assignment", async () => {
    await h.as(ana, () => h.q("update tasks set assignee_id = $1 where id = $2", [ben, taskIds["API"]]));
    const bens = await h.as(ben, () => h.q<{ kind: string; link: string }>("select kind, link from notifications"));
    expect(bens).toEqual([{ kind: "task_assigned", link: `/projects/${project}?task=${taskIds["API"]}` }]);
    const anas = await h.as(ana, () => h.q("select id from notifications"));
    expect(anas).toHaveLength(0);
    // Self-assignment doesn't notify.
    await h.as(ben, () => h.q("update tasks set assignee_id = $1 where id = $2", [ben, taskIds["Testing"]]));
    expect(await h.as(ben, () => h.q("select id from notifications"))).toHaveLength(1);
  });

  it("notifies the assignee about comments and keeps notifications private", async () => {
    await h.as(ana, () => h.q("insert into comments (task_id, workspace_id, author_id, content) values ($1, $2, $3, 'How is it going?')", [taskIds["API"], ws, ana]));
    const kinds = await h.as(ben, () => h.q<{ kind: string }>("select kind from notifications order by created_at"));
    expect(kinds.map((k) => k.kind)).toContain("comment");
    const peek = await h.as(cleo, () => h.q("select id from notifications where recipient_id = $1", [ben]));
    expect(peek).toHaveLength(0);
  });

  it("only lets authors edit their own comments", async () => {
    const updated = await h.as(ben, () => h.q("update comments set content = 'edited' returning id"));
    expect(updated).toHaveLength(0);
  });
});

describe("member removal and deletion", () => {
  it("unassigns open work but keeps history when a member is removed", async () => {
    await h.as(ana, () => h.q("update tasks set status = 'done', assignee_id = $1 where id = $2", [cleo, taskIds["Frontend integration"]]));
    await h.as(ana, () => h.q("update tasks set assignee_id = $1 where id = $2", [cleo, taskIds["Database schema"]]));
    await h.as(ana, () => h.q("select public.remove_member($1, $2)", [ws, cleo]));
    const rows = await h.as(ana, () =>
      h.q<{ title: string; assignee_id: string | null }>("select title, assignee_id from tasks where id = any($1) order by title", [[taskIds["Database schema"], taskIds["Frontend integration"]]]),
    );
    expect(rows).toEqual([
      { title: "Database schema", assignee_id: null },
      { title: "Frontend integration", assignee_id: cleo },
    ]);
    const lost = await h.as(cleo, () => h.q("select id from projects"));
    expect(lost).toHaveLength(0);
    // Their name stays readable in history.
    expect(await h.as(ana, () => h.q("select id from profiles where id = $1", [cleo]))).toHaveLength(1);
  });

  it("protects the owner from removal", async () => {
    await expect(h.as(ben, () => h.q("select public.remove_member($1, $2)", [ws, ana]))).rejects.toThrow(/owner/);
  });

  it("deletes a project and its records cleanly, logging the deletion", async () => {
    await h.as(ana, () => h.q("delete from projects where id = $1", [project]));
    expect(await h.as(ana, () => h.q("select id from tasks where project_id = $1", [project]))).toHaveLength(0);
    const log = await h.as(ana, () => h.q<{ data: { name: string } }>("select data from activity_events where event_type = 'project_deleted'"));
    expect(log[0].data.name).toBe("Coursework app");
  });

  it("stores one Pulse snapshot per project per day", async () => {
    const p = await h.as(ana, async () => (await h.q<{ id: string }>("select public.create_project($1, 'Snap', '', null, null, null) as id", [ws]))[0].id);
    const upsert = (score: number) =>
      h.as(ana, () =>
        h.q(
          `insert into pulse_assessments (project_id, workspace_id, snapshot_date, score, status, confidence, factors, risks, algorithm_version)
           values ($1, $2, '2026-10-17', $3, 'healthy', 'high', '[]', '[]', 'pulse-1.0.0')
           on conflict (project_id, snapshot_date) do update set score = excluded.score`,
          [p, ws, score],
        ),
      );
    await upsert(80);
    await upsert(72);
    const rows = await h.as(ana, () => h.q<{ score: string }>("select score from pulse_assessments where project_id = $1", [p]));
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].score)).toBe(72);
  });
});
