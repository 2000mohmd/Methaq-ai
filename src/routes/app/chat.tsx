import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, MessageSquarePlus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LogoMark } from "@/components/brand/Logo";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { streamAI } from "@/lib/ai-stream";

export const Route = createFileRoute("/app/chat")({
  head: () => ({ meta: [{ title: "Mithaq Chat — Legal AI" }] }),
  component: ChatPage,
});

type Msg = { role: "user" | "assistant"; content: string };
type Conv = { id: string; title: string };

const MODES = [
  { id: "research", en: "Research", ar: "بحث قانوني" },
  { id: "drafting", en: "Drafting", ar: "صياغة" },
  { id: "contract review", en: "Contract review", ar: "مراجعة عقود" },
  { id: "due diligence", en: "Due diligence", ar: "العناية الواجبة" },
];
const JURIS = ["Saudi Arabia", "UAE", "Qatar", "Kuwait", "Bahrain", "Oman", "Egypt", "Jordan", "Lebanon"];

function ChatPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [convs, setConvs] = useState<Conv[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("research");
  const [juris, setJuris] = useState("Saudi Arabia");
  const endRef = useRef<HTMLDivElement>(null);

  const loadConvs = async () => {
    const { data } = await supabase.from("conversations").select("id,title").order("updated_at", { ascending: false });
    setConvs(data ?? []);
  };
  useEffect(() => {
    loadConvs();
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const open = async (id: string) => {
    setActive(id);
    const { data } = await supabase.from("messages").select("role,content").eq("conversation_id", id).order("created_at");
    setMsgs((data as Msg[]) ?? []);
  };

  const remove = async (id: string) => {
    await supabase.from("conversations").delete().eq("id", id);
    if (active === id) {
      setActive(null);
      setMsgs([]);
    }
    loadConvs();
  };

  const send = async (text = input) => {
    const content = text.trim();
    if (!content || busy) return;
    setInput("");
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user!.id;
    let convId = active;
    if (!convId) {
      const { data: prof } = await supabase.from("profiles").select("organization_id").eq("id", uid).single();
      const { data: c, error } = await supabase
        .from("conversations")
        .insert({ user_id: uid, title: content.slice(0, 60), jurisdiction: juris, organization_id: prof?.organization_id ?? null })
        .select("id")
        .single();
      if (error) {
        toast.error(error.message);
        setBusy(false);
        return;
      }
      convId = c.id;
      setActive(convId);
      loadConvs();
    }
    const history: Msg[] = [...msgs, { role: "user", content }];
    setMsgs([...history, { role: "assistant", content: "" }]);
    await supabase.from("messages").insert({ conversation_id: convId, user_id: uid, role: "user", content });
    let acc = "";
    try {
      await streamAI(history, { mode, jurisdiction: juris }, (d) => {
        acc += d;
        setMsgs([...history, { role: "assistant", content: acc }]);
      });
      await supabase.from("messages").insert({ conversation_id: convId, user_id: uid, role: "assistant", content: acc });
      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
    } catch (e) {
      toast.error((e as Error).message);
      setMsgs(history);
    }
    setBusy(false);
  };

  const suggestions = ar
    ? ["ما هي شروط إنهاء عقد العمل في السعودية؟", "صغ اتفاقية عدم إفصاح ثنائية", "راجع هذا البند من حيث المخاطر"]
    : ["What are the termination rules under Saudi labour law?", "Draft a mutual NDA", "Review this clause for risks"];

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <aside className="hidden w-64 shrink-0 flex-col border-e border-border bg-muted/30 md:flex">
        <div className="p-3">
          <Button className="w-full" onClick={() => { setActive(null); setMsgs([]); }}>
            <MessageSquarePlus className="size-4" /> {ar ? "محادثة جديدة" : "New chat"}
          </Button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
          {convs.map((c) => (
            <div key={c.id} className={cn("group flex items-center rounded-lg text-sm", active === c.id ? "bg-teal/10 text-navy" : "hover:bg-muted")}>
              <button className="flex-1 truncate px-3 py-2 text-start" onClick={() => open(c.id)}>{c.title}</button>
              <button className="px-2 opacity-0 group-hover:opacity-100" onClick={() => remove(c.id)} aria-label="Delete">
                <Trash2 className="size-3.5 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
          {MODES.map((m) => (
            <button key={m.id} onClick={() => setMode(m.id)}
              className={cn("rounded-full border px-3 py-1 text-xs", mode === m.id ? "border-teal bg-teal/10 text-navy" : "border-border text-muted-foreground")}>
              {ar ? m.ar : m.en}
            </button>
          ))}
          <select value={juris} onChange={(e) => setJuris(e.target.value)} className="ms-auto rounded-lg border border-border bg-background px-2 py-1 text-xs">
            {JURIS.map((j) => <option key={j}>{j}</option>)}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {msgs.length === 0 ? (
            <div className="mx-auto mt-16 max-w-xl text-center">
              <LogoMark tone="teal" className="mx-auto size-12" />
              <h1 className="mt-4 text-2xl font-semibold text-navy">{ar ? "كيف يمكنني مساعدتك اليوم؟" : "How can I help today?"}</h1>
              <div className="mt-6 grid gap-2">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-xl border border-border px-4 py-3 text-start text-sm hover:border-teal">{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-4">
              {msgs.map((m, i) => (
                <div key={i} className={cn("whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  m.role === "user" ? "ms-auto max-w-[80%] bg-navy text-primary-foreground" : "border border-border bg-card")}>
                  {m.content || <Loader2 className="size-4 animate-spin text-teal" />}
                </div>
              ))}
              <div ref={endRef} />
            </div>
          )}
        </div>
        <div className="border-t border-border p-4">
          <div className="mx-auto flex max-w-3xl gap-2">
            <Textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={ar ? "اكتب سؤالك القانوني أو الصق نص العقد…" : "Ask a legal question or paste a contract…"} />
            <Button onClick={() => send()} disabled={busy} size="icon" className="h-auto w-12">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-muted-foreground">
            {ar ? "ميثاق ليس بديلاً عن محامٍ مرخّص. تحقق من المصادر دائماً." : "Mithaq is not a substitute for a licensed lawyer. Always verify sources."}
          </p>
        </div>
      </section>
    </div>
  );
}
