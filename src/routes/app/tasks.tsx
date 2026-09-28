import { createFileRoute } from "@tanstack/react-router";

import { RecordModule, type Field } from "@/components/app/RecordModule";

const FIELDS: Field[] = [{key:"title",en:"Task",ar:"المهمة",required:true},{key:"matter",en:"Matter",ar:"القضية"},{key:"due_date",en:"Due",ar:"الاستحقاق",type:"date"},{key:"priority",en:"Priority",ar:"الأولوية",type:"select",options:["low","medium","high"]},{key:"status",en:"Status",ar:"الحالة",type:"select",options:["todo","in progress","done"]}];

export const Route = createFileRoute("/app/tasks")({
  head: () => ({ meta: [{ title: "Tasks — Mithaq eFirm" }] }),
  component: () => (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <RecordModule table="tasks" title={{ en: "Tasks", ar: "المهام" }} fields={FIELDS} />
  ),
});
