import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const DEFAULT_FROM = "Mithaq Alarabia <onboarding@resend.dev>";

const emailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(300),
  text: z.string().min(1).max(50000),
  from: z.string().max(200).optional(),
});

async function sendViaResend(
  payload: { to: string; subject: string; text: string; from?: string | undefined },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ ok: boolean; providerId: string | null; error: string | null }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  const resendKey = process.env["RESEND_API_KEY"];
  if (!apiKey) throw new Error("Server configuration error: LOVABLE_API_KEY missing");
  if (!resendKey) throw new Error("Server configuration error: RESEND_API_KEY missing");

  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Connection-Api-Key": resendKey,
    },
    body: JSON.stringify({
      from: payload.from || DEFAULT_FROM,
      to: [payload.to],
      subject: payload.subject,
      text: payload.text,
    }),
  });
  const bodyText = await res.text();
  if (!res.ok) {
    console.error(`Resend request failed [${res.status}]: ${bodyText}`);
    return { ok: false, providerId: null, error: `${res.status}: ${bodyText.slice(0, 500)}` };
  }
  let providerId: string | null = null;
  try {
    providerId = JSON.parse(bodyText)?.id ?? null;
  } catch {
    // non-JSON success body
  }
  return { ok: true, providerId, error: null };
}

export const sendEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => emailSchema.parse(data))
  .handler(async ({ data, context }) => {
    const result = await sendViaResend(data);

    // Log to the firm's sent-email history (RLS-scoped to the caller's org).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data: p } = await sb.from("profiles").select("organization_id").eq("id", context.userId).single();
    if (p?.organization_id) {
      await sb.from("sent_emails").insert({
        organization_id: p.organization_id,
        created_by: context.userId,
        to_address: data.to,
        subject: data.subject,
        body: data.text,
        status: result.ok ? "sent" : "failed",
        provider_id: result.providerId,
        error: result.error,
      });
      await sb.from("audit_logs").insert({
        organization_id: p.organization_id,
        user_id: context.userId,
        action: "email.send",
        resource: data.to,
      });
    }

    if (!result.ok) throw new Error(`Email failed [${result.error}]`);
    return { ok: true as const, id: result.providerId };
  });

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["user", "admin"]),
  origin: z.string().url(),
});

export const sendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => inviteSchema.parse(data))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;

    const { data: p } = await sb.from("profiles").select("organization_id").eq("id", context.userId).single();
    const orgId: string | undefined = p?.organization_id;
    if (!orgId) throw new Error("Finish onboarding first");

    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", context.userId).eq("organization_id", orgId);
    if (!roles?.some((r: { role: string }) => r.role === "owner" || r.role === "admin")) {
      throw new Error("Only firm owners and admins can send invitations");
    }

    const { data: org } = await sb.from("organizations").select("name").eq("id", orgId).single();
    const firmName: string = org?.name ?? "your firm";

    const signupUrl = `${data.origin}/auth?mode=signup&email=${encodeURIComponent(data.email)}`;
    const text = [
      `You have been invited to join ${firmName} on Mithaq Alarabia as ${data.role === "admin" ? "an administrator" : "a team member"}.`,
      "",
      "Create your account here:",
      signupUrl,
      "",
      "— Mithaq Alarabia",
      "دُعِمت للانضمام إلى " + firmName + " على ميثاق العربية. أنشئ حسابك من الرابط أعلاه.",
    ].join("\n");

    const result = await sendViaResend({
      to: data.email,
      subject: `Invitation to join ${firmName} — Mithaq Alarabia`,
      text,
    });

    await sb.from("invitations").upsert(
      {
        organization_id: orgId,
        email: data.email.toLowerCase(),
        role: data.role,
        invited_by: context.userId,
        status: result.ok ? "sent" : "failed",
        error: result.error,
      },
      { onConflict: "organization_id,email" },
    );
    await sb.from("audit_logs").insert({
      organization_id: orgId,
      user_id: context.userId,
      action: "invite.send",
      resource: data.email,
    });

    if (!result.ok) throw new Error(`Invitation failed [${result.error}]`);
    return { ok: true as const };
  });
