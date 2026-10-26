import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, type Section } from "@/components/LegalPage";

const SECTIONS: Section[] = [
  {
    en: ["What we collect", "Account details (name, email), the questions and documents you submit, contracts you generate, and activity logs of AI requests. We do not sell personal data."],
    ar: ["ما نجمعه", "بيانات الحساب (الاسم والبريد)، والأسئلة والمستندات التي تقدّمها، والعقود التي تنشئها، وسجلات نشاط طلبات الذكاء الاصطناعي. لا نبيع البيانات الشخصية."],
  },
  {
    en: ["How we use it", "To provide the service: answering questions, auditing contracts, generating documents and keeping your workspace. We do not use your content to train AI models."],
    ar: ["كيف نستخدمها", "لتقديم الخدمة: الإجابة عن الأسئلة وتدقيق العقود وإنشاء المستندات وحفظ مساحة عملك. لا نستخدم محتواك لتدريب نماذج الذكاء الاصطناعي."],
  },
  {
    en: ["AI processing", "Text you submit to AI features is sent to our AI provider to produce the answer. Remove personal identifiers before submitting wherever possible. [Provider name and hosting region to be completed.]"],
    ar: ["معالجة الذكاء الاصطناعي", "يُرسل النص الذي تقدّمه لميزات الذكاء الاصطناعي إلى مزوّد الذكاء الاصطناعي لإنتاج الإجابة. يُفضّل حذف المعرّفات الشخصية قبل الإرسال متى أمكن. [يُستكمل اسم المزوّد ومنطقة الاستضافة.]"],
  },
  {
    en: ["Storage and security", "Data is stored in a managed database with per-account isolation, and files are stored privately. Access to your records is limited to your account or your firm."],
    ar: ["التخزين والأمان", "تُخزَّن البيانات في قاعدة بيانات مُدارة مع عزل لكل حساب، وتُحفظ الملفات بشكل خاص. يقتصر الوصول إلى سجلاتك على حسابك أو مكتبك."],
  },
  {
    en: ["Your rights", "Under the Saudi Personal Data Protection Law you may request access, correction or deletion of your data. [Contact address to be completed.]"],
    ar: ["حقوقك", "بموجب نظام حماية البيانات الشخصية في المملكة يحق لك طلب الاطلاع على بياناتك أو تصحيحها أو حذفها. [يُستكمل عنوان التواصل.]"],
  },
  {
    en: ["Retention", "We keep your data while your account is active and delete it on request, except where the law requires retention."],
    ar: ["الاحتفاظ", "نحتفظ ببياناتك ما دام حسابك فعّالاً ونحذفها عند الطلب، إلا إذا اشترط النظام الاحتفاظ بها."],
  },
];

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy Policy — Mithaq" }] }),
  component: () => (
    <LegalPage
      title={{ en: "Privacy Policy", ar: "سياسة الخصوصية" }}
      subtitle={{ en: "What we collect and how we protect it.", ar: "ما نجمعه وكيف نحميه." }}
      sections={SECTIONS}
    />
  ),
});
