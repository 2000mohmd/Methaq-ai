import { useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LogoMark } from "@/components/brand/Logo";
import { streamAI, type Msg } from "@/lib/ai-stream";
import { useI18n } from "@/i18n";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  module: string;
  moduleAr: string;
  context: string;
  suggestions: { en: string; ar: string }[];
};

export function AiAssistant({ open, onOpenChange, module, moduleAr, context, suggestions }: Props) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const ask = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    setInput("");
    setBusy(true);
    const userMsg: Msg = {
      role: "user",
      content: `Context — my ${module} records (JSON):\n${context}\n\nQuestion: ${content}`,
    };
    setMsgs((m) => [...m, { role: "user", content }, { role: "assistant", content: "" }]);
    try {
      await streamAI([...msgs, userMsg].slice(-20), { mode: module }, (d) =>
        setMsgs((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: copy[copy.length - 1].content + d };
          return copy;
        }),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI error");
      setMsgs((m) => m.slice(0, -1));
    }
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogoMark className="size-5" />
            {ar ? `مساعد ${moduleAr}` : `${module} assistant`}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-48 flex-1 space-y-4 overflow-y-auto py-2">
          {msgs.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {ar
                  ? "اسأل عن سجلاتك — المساعد يرى بيانات هذه الصفحة."
                  : "Ask about your records — the assistant can see this page's data."}
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s.en}
                    onClick={() => ask(ar ? s.ar : s.en)}
                    className="rounded-full border border-border px-3 py-1.5 text-xs text-navy transition-colors hover:border-teal hover:text-teal"
                  >
                    {ar ? s.ar : s.en}
                  </button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] rounded-2xl bg-navy px-4 py-2.5 text-sm text-white"
                    : "max-w-[95%] whitespace-pre-wrap text-sm leading-relaxed"
                }
              >
                {m.content}
                {busy && i === msgs.length - 1 && m.role === "assistant" && (
                  <Loader2 className="mt-1 size-4 animate-spin text-teal" />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-end gap-2 border-t border-border pt-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            placeholder={ar ? "اكتب سؤالك…" : "Type your question…"}
            className="min-h-10 resize-none"
            rows={1}
          />
          <Button size="icon" onClick={() => ask(input)} disabled={busy || !input.trim()} aria-label="Send">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Sparkles className="size-3 text-teal" />
          {ar ? "المساعد ليس بديلاً عن محامٍ مرخّص." : "The assistant is not a substitute for a licensed lawyer."}
        </p>
      </DialogContent>
    </Dialog>
  );
}
