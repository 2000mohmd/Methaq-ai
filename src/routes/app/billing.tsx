import { createFileRoute } from "@tanstack/react-router";

import { RecordModule, type Field } from "@/components/app/RecordModule";

const FIELDS: Field[] = [{key:"number",en:"Invoice #",ar:"رقم الفاتورة",required:true},{key:"client_name",en:"Client",ar:"الموكل"},{key:"amount",en:"Amount",ar:"المبلغ",type:"number",required:true},{key:"currency",en:"Currency",ar:"العملة",type:"select",options:["SAR","AED","QAR","KWD","EGP","USD"]},{key:"status",en:"Status",ar:"الحالة",type:"select",options:["draft","sent","paid","overdue"]},{key:"due_date",en:"Due",ar:"الاستحقاق",type:"date",list:false}];

export const Route = createFileRoute("/app/billing")({
  head: () => ({ meta: [{ title: "Billing — Mithaq eFirm" }] }),
  component: () => (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <RecordModule table="invoices" title={{ en: "Billing", ar: "الفوترة" }} fields={FIELDS} summary={(r: any[])=>[{en:"Invoiced",ar:"المفوتر",value:r.reduce((s,x)=>s+Number(x.amount||0),0).toLocaleString()},{en:"Paid",ar:"المدفوع",value:r.filter(x=>x.status==="paid").reduce((s,x)=>s+Number(x.amount||0),0).toLocaleString()},{en:"Invoices",ar:"الفواتير",value:String(r.length)}]} />
  ),
});
