import { createFileRoute } from "@tanstack/react-router";

import { RecordModule, type Field } from "@/components/app/RecordModule";

const FIELDS: Field[] = [{key:"title",en:"Hearing",ar:"الجلسة",required:true},{key:"hearing_date",en:"Date",ar:"التاريخ",type:"date"},{key:"court",en:"Court",ar:"المحكمة"},{key:"matter",en:"Matter",ar:"القضية"},{key:"location",en:"Location",ar:"المكان"}];

export const Route = createFileRoute("/app/calendar")({
  head: () => ({ meta: [{ title: "Hearings & calendar — Mithaq eFirm" }] }),
  component: () => (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <RecordModule table="hearings" title={{ en: "Hearings & calendar", ar: "الجلسات والتقويم" }} fields={FIELDS} />
  ),
});
