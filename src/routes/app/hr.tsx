import { createFileRoute } from "@tanstack/react-router";

import { RecordModule, type Field } from "@/components/app/RecordModule";

const FIELDS: Field[] = [{key:"name",en:"Name",ar:"الاسم",required:true},{key:"position",en:"Position",ar:"المنصب"},{key:"email",en:"Email",ar:"البريد"},{key:"start_date",en:"Start date",ar:"تاريخ البدء",type:"date"},{key:"status",en:"Status",ar:"الحالة",type:"select",options:["active","on leave","left"]}];

export const Route = createFileRoute("/app/hr")({
  head: () => ({ meta: [{ title: "HR — Mithaq eFirm" }] }),
  component: () => (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <RecordModule table="employees" title={{ en: "HR", ar: "الموارد البشرية" }} fields={FIELDS} />
  ),
});
