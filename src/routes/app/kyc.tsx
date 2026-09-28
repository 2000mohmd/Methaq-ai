import { createFileRoute } from "@tanstack/react-router";

import { RecordModule, type Field } from "@/components/app/RecordModule";

const FIELDS: Field[] = [{key:"name",en:"Client",ar:"الموكل",required:true},{key:"client_type",en:"Type",ar:"النوع",type:"select",options:["individual","company"]},{key:"kyc_status",en:"KYC status",ar:"حالة التحقق",type:"select",options:["pending","verified","rejected"]},{key:"notes",en:"Notes",ar:"ملاحظات"}];

export const Route = createFileRoute("/app/kyc")({
  head: () => ({ meta: [{ title: "KYC — Mithaq eFirm" }] }),
  component: () => (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <RecordModule table="clients" title={{ en: "KYC", ar: "اعرف عميلك" }} fields={FIELDS} />
  ),
});
