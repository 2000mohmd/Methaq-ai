import { createFileRoute } from "@tanstack/react-router";

import { RecordModule, type Field } from "@/components/app/RecordModule";

const FIELDS: Field[] = [{key:"title",en:"Title",ar:"العنوان",required:true},{key:"client_name",en:"Client",ar:"الموكل"},{key:"practice_area",en:"Practice area",ar:"مجال الممارسة",type:"select",options:["Corporate","Litigation","Labour","Real estate","Family","Criminal","IP"]},{key:"court",en:"Court",ar:"المحكمة"},{key:"status",en:"Status",ar:"الحالة",type:"select",options:["open","pending","closed"]}];

export const Route = createFileRoute("/app/matters")({
  head: () => ({ meta: [{ title: "Matters — Mithaq eFirm" }] }),
  component: () => (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <RecordModule table="matters" title={{ en: "Matters", ar: "القضايا" }} fields={FIELDS} />
  ),
});
