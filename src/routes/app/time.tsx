import { createFileRoute } from "@tanstack/react-router";

import { RecordModule, type Field } from "@/components/app/RecordModule";

const FIELDS: Field[] = [{key:"description",en:"Work",ar:"العمل",required:true},{key:"matter",en:"Matter",ar:"القضية"},{key:"work_date",en:"Date",ar:"التاريخ",type:"date"},{key:"hours",en:"Hours",ar:"الساعات",type:"number",required:true},{key:"rate",en:"Rate",ar:"السعر",type:"number"}];

export const Route = createFileRoute("/app/time")({
  head: () => ({ meta: [{ title: "Time tracking — Mithaq eFirm" }] }),
  component: () => (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <RecordModule table="time_entries" title={{ en: "Time tracking", ar: "تتبع الوقت" }} fields={FIELDS} summary={(r: any[])=>[{en:"Total hours",ar:"إجمالي الساعات",value:r.reduce((s,x)=>s+Number(x.hours||0),0).toFixed(1)},{en:"Billable value",ar:"القيمة القابلة للفوترة",value:r.reduce((s,x)=>s+Number(x.hours||0)*Number(x.rate||0),0).toLocaleString()},{en:"Entries",ar:"السجلات",value:String(r.length)}]} />
  ),
});
