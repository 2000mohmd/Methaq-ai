import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Briefcase, Receipt } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/app/portal")({
  head: () => ({ meta: [{ title: "Client portal — Mithaq" }] }),
  component: Portal,
});

type Row = Record<string, string | number | null>;

function Portal() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [matters, setMatters] = useState<Row[]>([]);
  const [invoices, setInvoices] = useState<Row[]>([]);
  const [email, setEmail] = useState("");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setEmail(u.user?.email ?? "");
      const { data: clients } = await supabase.from("clients").select("name").ilike("email", u.user?.email ?? "__none__");
      const names = (clients ?? []).map((c) => c.name);
      if (!names.length) return;
      const [{ data: m }, { data: i }] = await Promise.all([
        supabase.from("matters").select("id,title,practice_area,court,status").in("client_name", names),
        supabase.from("invoices").select("id,number,amount,currency,due_date,status").in("client_name", names),
      ]);
      setMatters((m ?? []) as Row[]);
      setInvoices((i ?? []) as Row[]);
    })();
  }, []);

  const Table = ({ rows, cols }: { rows: Row[]; cols: string[] }) =>
    rows.length === 0 ? (
      <p className="mt-3 text-sm text-muted-foreground">{ar ? "لا شيء بعد." : "Nothing yet."}</p>
    ) : (
      <table className="mt-3 w-full text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={String(r["id"])} className="border-t border-border">
              {cols.map((c) => <td key={c} className="py-2">{String(r[c] ?? "—")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    );

  return (
    <div className="grid gap-6 p-6 sm:p-10">
      <div>
        <h1 className="text-2xl font-semibold text-navy">{ar ? "بوابة العميل" : "Client portal"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {ar
            ? `يرى الموكّل هنا قضاياه وفواتيره عندما يطابق بريده (${email}) بريد سجلّه لدى المكتب.`
            : `Clients see their own matters and invoices here when their sign-in email (${email}) matches their client record at the firm.`}
        </p>
      </div>
      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="flex items-center gap-2 font-semibold text-navy"><Briefcase className="size-4 text-teal" />{ar ? "قضاياي" : "My matters"}</h2>
        <Table rows={matters} cols={["title", "practice_area", "court", "status"]} />
      </section>
      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="flex items-center gap-2 font-semibold text-navy"><Receipt className="size-4 text-teal" />{ar ? "فواتيري" : "My invoices"}</h2>
        <Table rows={invoices} cols={["number", "amount", "currency", "due_date", "status"]} />
      </section>
    </div>
  );
}
