import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, type Section } from "@/components/LegalPage";

const SECTIONS: Section[] = [
  {
    en: ["Not legal advice", "Mithaq provides AI-assisted legal information and drafting tools. Its output is not legal advice and creates no lawyer-client relationship. A licensed lawyer must review any output before you rely on it or sign a document."],
    ar: ["ليست استشارة قانونية", "يوفّر ميثاق أدوات معلومات قانونية وصياغة بمساعدة الذكاء الاصطناعي. مخرجاته ليست استشارة قانونية ولا تنشئ علاقة محامٍ وموكل. يجب أن يراجع محامٍ مرخّص أي مخرجات قبل الاعتماد عليها أو توقيع أي مستند."],
  },
  {
    en: ["Accuracy and sources", "Answers cite only sources saved in the legal library and every citation is checked against them. Where no verified source exists the answer is marked as not grounded. Laws change; always confirm against the official text."],
    ar: ["الدقة والمصادر", "تستند الإجابات إلى المصادر المحفوظة في المكتبة القانونية فقط ويُتحقق من كل استشهاد مقابلها. وحيث لا يوجد مصدر موثّق تُعلَّم الإجابة بأنها غير موثّقة. الأنظمة تتغير؛ تحقّق دائماً من النص الرسمي."],
  },
  {
    en: ["Your account", "You are responsible for your account credentials and for the content you upload. Do not upload content you have no right to share. We may suspend accounts that abuse the service."],
    ar: ["حسابك", "أنت مسؤول عن بيانات دخولك وعن المحتوى الذي ترفعه. لا ترفع محتوى لا تملك حق مشاركته. يجوز لنا إيقاف الحسابات التي تسيء استخدام الخدمة."],
  },
  {
    en: ["Contracts and documents", "Generated contracts and audit reports are drafts prepared from your inputs. Official acts, such as marriage contracts executed through the Ministry of Justice, remain government processes that this service does not replace."],
    ar: ["العقود والمستندات", "العقود وتقارير التدقيق المولّدة مسودات معدّة من مدخلاتك. الإجراءات الرسمية، كعقود الزواج الموثّقة عبر وزارة العدل، تبقى إجراءات حكومية لا تحل الخدمة محلها."],
  },
  {
    en: ["Liability", "To the extent permitted by law, the service is provided as is, and we are not liable for decisions made in reliance on its output."],
    ar: ["المسؤولية", "بالقدر الذي يسمح به النظام، تُقدَّم الخدمة كما هي، ولا نتحمل المسؤولية عن القرارات المبنية على مخرجاتها."],
  },
  {
    en: ["Governing law", "These terms are governed by the laws of the Kingdom of Saudi Arabia. [Competent court and contact details to be completed by the firm.]"],
    ar: ["النظام الواجب التطبيق", "تخضع هذه الشروط لأنظمة المملكة العربية السعودية. [تُستكمل المحكمة المختصة وبيانات التواصل من قبل المكتب.]"],
  },
];

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms of Use — Mithaq" }] }),
  component: () => (
    <LegalPage
      title={{ en: "Terms of Use", ar: "شروط الاستخدام" }}
      subtitle={{ en: "Please read before using the service.", ar: "يرجى القراءة قبل استخدام الخدمة." }}
      sections={SECTIONS}
    />
  ),
});
