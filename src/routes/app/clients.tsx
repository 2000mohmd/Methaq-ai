import { createFileRoute } from "@tanstack/react-router";

import { RecordModule, type Field } from "@/components/app/RecordModule";

const FIELDS: Field[] = [{key:"name",en:"Name",ar:"الاسم",required:true},{key:"email",en:"Email",ar:"البريد"},{key:"phone",en:"Phone",ar:"الهاتف"},{key:"client_type",en:"Type",ar:"النوع",type:"select",options:["individual","company"]},{key:"kyc_status",en:"KYC",ar:"اعرف عميلك",type:"select",options:["pending","verified","rejected"]}];

export const Route = createFileRoute("/app/clients")({
  head: () => ({ meta: [{ title: "Clients — Mithaq eFirm" }] }),
  component: () => (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <RecordModule table="clients" title={{ en: "Clients", ar: "الموكلون" }} fields={FIELDS} />
  ),
});
