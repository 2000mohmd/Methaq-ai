import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { sendInvite } from "@/lib/emails.functions";

export const Route = createFileRoute("/app/admin")({
  head: () => ({ meta: [{ title: "Admin console — Mithaq" }] }),
  component: Admin,
});

type Member = { id: string; email: string | null; full_name: string | null };
type Role = { id: string; user_id: string; role: string };
type Log = { id: string; action: string; resource: string | null; user_id: string | null; created_at: string };
type Invite = { id: string; email: string; role: string; status: string };

function Admin() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [me, setMe] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [orgName, setOrgName] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviting, setInviting] = useState(false);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setMe(u.user.id);
    const { data: p } = await supabase.from("profiles").select("organization_id").eq("id", u.user.id).single();
    const org = p?.organization_id ?? null;
    setOrgId(org);
    if (!org) return setIsAdmin(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const [{ data: r }, { data: m }, { data: o }, { data: l }, { data: iv }] = await Promise.all([
      supabase.from("user_roles").select("id,user_id,role").eq("organization_id", org),
      supabase.from("profiles").select("id,email,full_name").eq("organization_id", org),
      supabase.from("organizations").select("name").eq("id", org).single(),
      supabase.from("audit_logs").select("id,action,resource,user_id,created_at").eq("organization_id", org).order("created_at", { ascending: false }).limit(100),
      db.from("invitations").select("id,email,role,status").eq("organization_id", org).order("created_at", { ascending: false }),
    ]);
    const rs = (r ?? []) as Role[];
    setRoles(rs);
    setMembers((m ?? []) as Member[]);
    setOrgName(o?.name ?? "");
    setLogs((l ?? []) as Log[]);
    setInvites((iv ?? []) as Invite[]);
    setIsAdmin(rs.some((x) => x.user_id === u.user!.id && (x.role === "owner" || x.role === "admin")));
  }

  useEffect(() => { load(); }, []);

  async function saveOrg() {
    if (!orgId || !orgName.trim()) return;
    const { error } = await supabase.from("organizations").update({ name: orgName.trim() }).eq("id", orgId);
    if (error) toast.error(error.message);
    else toast.success(ar ? "تم الحفظ" : "Saved");
  }

  async function removeRole(id: string) {
    const { error } = await supabase.from("user_roles").delete().eq("id", id);
    if (error) toast.error(error.message);
    load();
  }

  async function invite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await sendInvite({ data: { email: inviteEmail.trim(), role: inviteRole, origin: window.location.origin } });
      if (!res.ok) {
        toast.error(res.error);
        load();
        return;
      }
      toast.success(ar ? "تم إرسال الدعوة" : "Invitation sent");
      setInviteEmail("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message.slice(0, 300) : ar ? "فشلت الدعوة" : "Invite failed");
    } finally {
      setInviting(false);
    }
  }

  if (isAdmin === null) return <div className="p-4 text-sm text-muted-foreground sm:p-10">…</div>;
  if (!isAdmin)
    return (
      <div className="p-4 sm:p-10">
        <ShieldCheck className="size-6 text-teal" />
        <p className="mt-3 text-muted-foreground">{ar ? "هذه الصفحة متاحة لمالكي ومسؤولي المكتب فقط." : "Only firm owners and admins can open this page."}</p>
      </div>
    );

  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.full_name || members.find((m) => m.id === id)?.email || "—";

  return (
    <div className="grid grid-cols-1 gap-6 p-4 sm:p-10">
      <h1 className="text-2xl font-semibold text-navy">{ar ? "لوحة الإدارة" : "Admin console"}</h1>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="font-semibold text-navy">{ar ? "المكتب" : "Firm"}</h2>
        <div className="mt-3 flex max-w-md gap-2">
          <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
          <Button onClick={saveOrg}>{ar ? "حفظ" : "Save"}</Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="font-semibold text-navy">{ar ? "الفريق والأدوار" : "Team & roles"}</h2>
        <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-border">
                <td className="py-2 pe-3">{m.full_name || m.email}</td>
                <td className="py-2 pe-3 text-muted-foreground">{m.email}</td>
                <td className="py-2">
                  {roles.filter((r) => r.user_id === m.id).map((r) => (
                    <span key={r.id} className="me-2 inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs">
                      {r.role}
                      {m.id !== me && (
                        <button className="-my-1.5 -me-1.5 p-1.5" onClick={() => removeRole(r.id)} aria-label="Remove role"><Trash2 className="size-3 text-muted-foreground hover:text-destructive" /></button>
                      )}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <h3 className="mt-5 font-medium text-navy">{ar ? "دعوة عضو جديد" : "Invite a new member"}</h3>
        <div className="mt-2 flex max-w-lg flex-wrap gap-2">
          <Input className="h-10 w-full sm:h-9 sm:w-auto sm:min-w-52 sm:flex-1" type="email" placeholder={ar ? "البريد الإلكتروني" : "Email"}
            value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
          <select className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-base sm:flex-none sm:text-sm" value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}>
            <option value="user">{ar ? "عضو" : "Member"}</option>
            <option value="admin">{ar ? "مسؤول" : "Admin"}</option>
          </select>
          <Button onClick={invite} disabled={inviting}>
            <UserPlus className="size-4" />
            {inviting ? (ar ? "جارٍ الإرسال…" : "Sending…") : ar ? "دعوة" : "Invite"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {ar
            ? "تُرسل الدعوة بالبريد الإلكتروني، وينشئ العضو حسابه من الرابط الموجود فيها."
            : "The invitation is sent by email; the new member creates their account from the link inside it."}
        </p>
        {invites.length > 0 && (
          <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {invites.map((iv) => (
                <tr key={iv.id} className="border-t border-border">
                  <td className="py-2 pe-3">{iv.email}</td>
                  <td className="py-2 pe-3 text-muted-foreground">{iv.role}</td>
                  <td className="py-2">
                    <span className={"rounded-full px-2 py-0.5 text-xs " + (iv.status === "sent" ? "bg-teal/10 text-teal" : "bg-destructive/10 text-destructive")}>
                      {iv.status === "sent" ? (ar ? "أُرسلت" : "Sent") : ar ? "فشلت" : "Failed"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="font-semibold text-navy">{ar ? "سجل التدقيق" : "Audit log"}</h2>
        {logs.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{ar ? "لا توجد أحداث بعد." : "No activity yet."}</p>
        ) : (
          <div className="mt-3 max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="whitespace-nowrap py-2 pe-3 text-muted-foreground">{new Date(l.created_at).toLocaleString(ar ? "ar" : "en")}</td>
                    <td className="py-2 pe-3">{nameOf(l.user_id)}</td>
                    <td className="py-2 pe-3">{l.action}</td>
                    <td className="py-2 text-muted-foreground">{l.resource ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
