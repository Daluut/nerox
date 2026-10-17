"use client";

import { useState } from "react";
import { Copy, UserPlus, Users } from "lucide-react";
import { createInvitation, removeMember, revokeInvitation, setMemberRole } from "@/lib/actions/workspace";
import { canChangeRole, canRemoveMember, ROLE_DESCRIPTION } from "@/lib/domain/permissions";
import type { Role } from "@/lib/domain/types";
import { useAppData } from "@/components/shell/app-context";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Avatar, Button, ErrorNote, Field, PageHeader, Panel } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { timeAgo } from "@/components/ui/time";

interface MemberRow {
  userId: string;
  name: string;
  email: string | null;
  role: Role;
  joinedAt: string;
  openTasks: number;
}

export function TeamView({
  members,
  invitations,
  canInvite,
  canManage,
}: {
  members: MemberRow[];
  invitations: { id: string; email: string | null; role: string; expiresAt: string }[];
  canInvite: boolean;
  canManage: boolean;
}) {
  const data = useAppData();
  const toast = useToast();
  const [removing, setRemoving] = useState<MemberRow | null>(null);

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 md:px-10">
      <PageHeader
        title="Team"
        description={`${members.length} ${members.length === 1 ? "person" : "people"} in ${data.workspace.name}. Everyone here can see every project.`}
        icon={<Users className="size-6" />}
        color="var(--c-team)"
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title="Members" bodyClassName="p-0">
          <ul className="divide-y divide-line">
            {members.map((m) => {
              const isMe = m.userId === data.userId;
              const assignable = (["admin", "member", "viewer"] as const).filter((r) => r === m.role || canChangeRole(data.role, m.role, r));
              return (
                <li key={m.userId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Avatar name={m.name} size={30} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">
                      {m.name}
                      {isMe && <span className="ml-1.5 font-normal text-faint">(you)</span>}
                    </p>
                    <p className="truncate text-[12px] text-faint">
                      {m.email}
                      {m.email ? ", " : ""}
                      {m.openTasks} open {m.openTasks === 1 ? "task" : "tasks"}, joined {timeAgo(m.joinedAt)}
                    </p>
                  </div>
                  {canManage && m.role !== "owner" && !isMe && assignable.length > 1 ? (
                    <select
                      aria-label={`Role for ${m.name}`}
                      className="field w-auto py-1 text-[12px]"
                      value={m.role}
                      onChange={async (e) => {
                        const r = await setMemberRole({ userId: m.userId, role: e.target.value });
                        if (!r.ok) toast.error(r.error);
                        else toast.success(`${m.name} is now ${e.target.value === "admin" ? "an admin" : `a ${e.target.value}`}.`);
                      }}
                    >
                      {assignable.map((r) => (
                        <option key={r} value={r}>
                          {r[0].toUpperCase() + r.slice(1)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-[12px] capitalize text-muted">{m.role}</span>
                  )}
                  {((canManage && canRemoveMember(data.role, m.role) && !isMe) || (isMe && m.role !== "owner")) && (
                    <button onClick={() => setRemoving(m)} className="text-[12px] text-faint hover:text-danger">
                      {isMe ? "Leave" : "Remove"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>

        <div className="flex flex-col gap-6">
          {canInvite ? <InvitePanel invitations={invitations} /> : <p className="text-[13px] text-muted">Owners and admins can invite people to this workspace.</p>}
          <Panel title="Roles">
            <dl className="space-y-2.5 text-[12px]">
              {(Object.keys(ROLE_DESCRIPTION) as Role[]).map((r) => (
                <div key={r}>
                  <dt className="font-medium capitalize">{r}</dt>
                  <dd className="text-muted">{ROLE_DESCRIPTION[r]}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={removing?.userId === data.userId ? "Leave this workspace?" : `Remove ${removing?.name}?`}
        body={
          <>
            {removing?.userId === data.userId ? "You'll lose access to its projects until someone invites you again." : `${removing?.name} will lose access to the workspace.`} Their open tasks (
            {removing?.openTasks ?? 0}) become unassigned so the work stays visible. Completed work and history keep their name.
          </>
        }
        confirmLabel={removing?.userId === data.userId ? "Leave workspace" : "Remove member"}
        danger
        onConfirm={async () => {
          const r = await removeMember(removing!.userId);
          if (r && !r.ok) return r.error;
          toast.success("Member removed.");
          return null;
        }}
      />
    </div>
  );
}

function InvitePanel({ invitations }: { invitations: { id: string; email: string | null; role: string; expiresAt: string }[] }) {
  const data = useAppData();
  const toast = useToast();
  const [role, setRole] = useState("member");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  return (
    <Panel title="Invite people">
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const r = await createInvitation({ role, email, expiresInDays: 7 });
          setBusy(false);
          if (!r.ok) return setError(r.error);
          setLink(r.data.url);
          setEmail("");
        }}
      >
        <Field label="Email (optional)" htmlFor="inv-email" hint="If set, only this address can use the link.">
          <input id="inv-email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Role" htmlFor="inv-role">
          <select id="inv-role" className="field" value={role} onChange={(e) => setRole(e.target.value)}>
            {data.role === "owner" && <option value="admin">Admin</option>}
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
          </select>
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button type="submit" variant="primary" size="sm" loading={busy}>
          <UserPlus className="size-3.5" /> Create invite link
        </Button>
      </form>
      {link && (
        <div className="mt-4 rounded-md border border-violet/40 bg-violet-soft p-3">
          <p className="text-[12px] text-muted">Single-use link, valid for 7 days. Send it to the person you&apos;re inviting. It won&apos;t be shown again.</p>
          <div className="mt-2 flex gap-2">
            <input readOnly aria-label="Invitation link" className="field py-1 text-[12px]" value={link} onFocus={(e) => e.target.select()} />
            <Button
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  toast.success("Link copied.");
                } catch {
                  toast.error("Couldn't copy. Select the link and copy it manually.");
                }
              }}
            >
              <Copy className="size-3.5" /> Copy
            </Button>
          </div>
        </div>
      )}
      {invitations.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[12px] font-medium text-muted">Pending invitations</p>
          <ul className="flex flex-col gap-2">
            {invitations.map((i) => (
              <li key={i.id} className="flex items-center gap-2 text-[12px]">
                <span className="min-w-0 flex-1 truncate">
                  {i.email ?? "Anyone with the link"} <span className="capitalize text-faint">({i.role})</span>
                </span>
                <span className="text-faint">expires {new Date(i.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                <button
                  onClick={async () => {
                    const r = await revokeInvitation(i.id);
                    if (!r.ok) toast.error(r.error);
                    else toast.success("Invitation revoked.");
                  }}
                  className="text-faint hover:text-danger"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
