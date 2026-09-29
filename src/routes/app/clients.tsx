import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { RecordModule, type Field } from "@/components/app/RecordModule";
import { sendInvite } from "@/lib/emails.functions";
import { useI18n } from "@/i18n";

const FIELDS: Field[] = [{key:"name",en:"Name",ar:"الاسم",required:true},{key:"email",en:"Email",ar:"البريد"},{key:"phone",en:"Phone",ar:"الهاتف"},{key:"client_type",en:"Type",ar:"النوع",type:"select",options:["individual","company"]},{key:"kyc_status",en:"KYC",ar:"اعرف عميلك",type:"select",options:["pending","verified","rejected"]}];

function ClientsPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const invite = useServerFn(sendInvite);

  const inviteToPortal = async (row: Record<string, unknown>) => {
    const email = String(row["email"] ?? "");
    if (!email) {
      toast.error(ar ? "أضف بريد العميل أولاً" : "Add the client's email first");
      return;
    }
    const res = await invite({ data: { email, role: "client", origin: window.location.origin } });
    if (res.ok) {
      toast.success(ar ? "أُرسلت دعوة البوابة" : "Portal invitation sent");
    } else {
      toast.error(res.error ?? (ar ? "فشل الإرسال" : "Sending failed"));
    }
  };

  return (
    <RecordModule
      table="clients"
      title={{ en: "Clients", ar: "الموكلون" }}
      fields={FIELDS}
      rowAction={{
        en: "Invite to portal",
        ar: "دعوة إلى البوابة",
        onClick: inviteToPortal,
        hidden: (r) => Boolean(r["user_id"]),
      }}
    />
  );
}

export const Route = createFileRoute("/app/clients")({
  head: () => ({ meta: [{ title: "Clients — Mithaq eFirm" }] }),
  component: ClientsPage,
});
