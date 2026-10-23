import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RESEND_URL = "https://api.resend.com";
const DEFAULT_FROM = process.env["EMAIL_FROM"] ?? "Mithaq <onboarding@resend.dev>"; // set EMAIL_FROM once your domain is verified in Resend

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
  const resendKey = process.env["RESEND_API_KEY"];
  if (!resendKey) throw new Error("Server configuration error: RESEND_API_KEY missing");

  const res = await fetch(`${RESEND_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendKey}`,
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

function friendlyError(raw: string | null): string {
  const s = raw ?? "";
  if (s.includes("verify a domain") || s.includes("testing emails")) {
    return "Your sending domain isn't verified yet, so emails can only go to the account owner's address. Verify your domain in Resend to email anyone.";
  }
  try {
    const msg = JSON.parse(s.replace(/^\d+:\s*/, ""))?.message;
    if (msg) return String(msg).slice(0, 300);
  } catch {
    // ignore
  }
  return "Sending failed. Please try again.";
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

    if (!result.ok) return { ok: false as const, id: null, error: friendlyError(result.error) };
    return { ok: true as const, id: result.providerId, error: null };
  });

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["user", "admin", "client"]),
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
    const isClient = data.role === "client";
    const text = [
      isClient
        ? `${firmName} has invited you to its secure client portal on Mithaq Alarabia, where you can follow your matters and invoices.`
        : `You have been invited to join ${firmName} on Mithaq Alarabia as ${data.role === "admin" ? "an administrator" : "a team member"}.`,
      "",
      "Create your account here:",
      signupUrl,
      "",
      isClient ? "After signing up, open your client portal to see your matters and invoices." : "",
      "— Mithaq Alarabia",
      isClient
        ? "دعاك " + firmName + " إلى بوابة العملاء الآمنة على ميثاق العربية لمتابعة قضاياك وفواتيرك. أنشئ حسابك من الرابط أعلاه."
        : "دُعيت للانضمام إلى " + firmName + " على ميثاق العربية. أنشئ حسابك من الرابط أعلاه.",
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

    if (!result.ok) return { ok: false as const, error: friendlyError(result.error) };
    return { ok: true as const, error: null };
  });
