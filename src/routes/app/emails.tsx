import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HexPattern } from "@/components/brand/HexPattern";
import { AiAssistant } from "@/components/app/AiAssistant";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { sendEmail } from "@/lib/emails.functions";

export const Route = createFileRoute("/app/emails")({
  head: () => ({ meta: [{ title: "Emails — Mithaq eFirm" }] }),
  component: Emails,
});

type Sent = {
  id: string;
  to_address: string;
  subject: string | null;
  status: string;
  error: string | null;
  created_at: string;
};

const EMPTY = { to: "", subject: "", body: "", from: "" };

function Emails() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [rows, setRows] = useState<Sent[]>([]);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [aiOpen, setAiOpen] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const load = async () => {
    const { data, error } = await db
      .from("sent_emails")
      .select("id,to_address,subject,status,error,created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as Sent[]);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async () => {
    if (!form.to.trim() || !form.subject.trim() || !form.body.trim()) {
      toast.error(ar ? "أكمل الحقول المطلوبة" : "Fill in recipient, subject and message");
      return;
    }
    setSending(true);
    try {
      const res = await sendEmail({
        data: {
          to: form.to.trim(),
          subject: form.subject.trim(),
          text: form.body,
          from: form.from.trim() || undefined,
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        load();
        return;
      }
      toast.success(ar ? "تم إرسال الرسالة" : "Email sent");
      setOpen(false);
      setForm(EMPTY);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message.slice(0, 300) : ar ? "فشل الإرسال" : "Send failed");
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: string) => {
    const { error } = await db.from("sent_emails").delete().eq("id", id);
    if (error) toast.error(error.message);
    load();
  };

  return (
    <div className="p-6 sm:p-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-navy">{ar ? "البريد" : "Emails"}</h1>
        <Input className="ms-auto w-56" placeholder={ar ? "بحث…" : "Search…"} />
        <Button variant="outline" onClick={() => setAiOpen(true)}>
          <Sparkles className="size-4 text-teal" /> {ar ? "اسأل الذكاء الاصطناعي" : "Ask AI"}
        </Button>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" /> {ar ? "رسالة جديدة" : "Compose"}
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="relative mt-6 overflow-hidden rounded-2xl border border-border bg-navy-tint">
          <HexPattern className="text-navy" opacity={0.06} />
          <div className="relative max-w-md px-8 py-16">
            <Mail className="size-6 text-teal" />
            <p className="mt-4 leading-relaxed text-muted-foreground">
              {ar
                ? "لم تُرسل أي رسالة بعد. أنشئ أول رسالة للبدء."
                : "No emails sent yet. Compose your first one to get started."}
            </p>
            <Button className="mt-6" onClick={() => setOpen(true)}>
              <Plus className="size-4" /> {ar ? "رسالة جديدة" : "Compose"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{ar ? "إلى" : "To"}</th>
                <th className="px-4 py-3 text-start font-medium">{ar ? "الموضوع" : "Subject"}</th>
                <th className="px-4 py-3 text-start font-medium">{ar ? "الحالة" : "Status"}</th>
                <th className="px-4 py-3 text-start font-medium">{ar ? "التاريخ" : "Date"}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3">{r.to_address}</td>
                  <td className="max-w-xs truncate px-4 py-3">{r.subject ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-xs " +
                        (r.status === "sent"
                          ? "bg-teal/10 text-teal"
                          : "bg-destructive/10 text-destructive")
                      }
                    >
                      {r.status === "sent" ? (ar ? "أُرسلت" : "Sent") : ar ? "فشلت" : "Failed"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(r.created_at).toLocaleString(ar ? "ar" : "en")}
                  </td>
                  <td className="px-2 text-end">
                    <button onClick={() => remove(r.id)} aria-label="Delete">
                      <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ar ? "رسالة جديدة" : "Compose email"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span>{ar ? "إلى" : "To"} *</span>
              <Input
                type="email"
                value={form.to}
                onChange={(e) => setForm({ ...form, to: e.target.value })}
                placeholder="name@example.com"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>{ar ? "الموضوع" : "Subject"} *</span>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </label>
            <label className="grid gap-1 text-sm">
              <span>{ar ? "نص الرسالة" : "Message"} *</span>
              <textarea
                className="min-h-36 rounded-lg border border-input bg-background px-3 py-2"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>{ar ? "المرسل (اختياري)" : "From (optional)"}</span>
              <Input
                value={form.from}
                onChange={(e) => setForm({ ...form, from: e.target.value })}
                placeholder="Mithaq Alarabia <notify@yourfirm.com>"
              />
              <span className="text-xs text-muted-foreground">
                {ar
                  ? "اتركه فارغاً لاستخدام المرسل الافتراضي. لإرسال الرسائل من نطاق مكتبك، يجب أولاً توثيق النطاق في حساب Resend."
                  : "Leave empty to use the default sender. To send from your firm's own domain, verify that domain in your Resend account first."}
              </span>
            </label>
            <Button onClick={send} disabled={sending}>
              <Mail className="size-4" /> {sending ? (ar ? "جارٍ الإرسال…" : "Sending…") : ar ? "إرسال" : "Send"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AiAssistant
        open={aiOpen}
        onOpenChange={setAiOpen}
        module="Emails"
        moduleAr="البريد"
        context={JSON.stringify(rows.slice(0, 30))}
        suggestions={[
          { en: "Draft a professional update email for a client about their case", ar: "صغ رسالة تحديث مهنية لعميل بخصوص قضيته" },
          { en: "Draft a polite payment reminder for an overdue invoice", ar: "صغ رسالة تذكير مهنية بفاتورة متأخرة" },
          { en: "Draft a hearing confirmation email to a client", ar: "صغ رسالة تأكيد جلسة إلى عميل" },
        ]}
      />
    </div>
  );
}
