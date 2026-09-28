import { createFileRoute } from "@tanstack/react-router";

import { RecordModule, type Field } from "@/components/app/RecordModule";

const FIELDS: Field[] = [{key:"name",en:"Name",ar:"الاسم",required:true},{key:"email",en:"Email",ar:"البريد"},{key:"phone",en:"Phone",ar:"الهاتف"},{key:"source",en:"Source",ar:"المصدر"},{key:"stage",en:"Stage",ar:"المرحلة",type:"select",options:["new","contacted","proposal","won","lost"]}];

export const Route = createFileRoute("/app/leads")({
  head: () => ({ meta: [{ title: "Leads — Mithaq eFirm" }] }),
  component: () => (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <RecordModule table="leads" title={{ en: "Leads", ar: "العملاء المحتملون" }} fields={FIELDS} />
  ),
});
