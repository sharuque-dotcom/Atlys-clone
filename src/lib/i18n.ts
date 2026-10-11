export type Locale = "en" | "ar";

const dict = {
  "nav.dashboard": { en: "Dashboard", ar: "لوحة التحكم" },
  "nav.applications": { en: "Applications", ar: "الطلبات" },
  "nav.new": { en: "New application", ar: "طلب جديد" },
  "nav.travelers": { en: "Travelers", ar: "المسافرون" },
  "nav.trips": { en: "Group trips", ar: "الرحلات الجماعية" },
  "nav.approvals": { en: "Approvals", ar: "الموافقات" },
  "nav.checker": { en: "Visa checker", ar: "مدقق التأشيرات" },
  "nav.billing": { en: "Billing & VAT", ar: "الفواتير والضريبة" },
  "nav.organization": { en: "Organization", ar: "المؤسسة" },
  "nav.integrations": { en: "Integrations & API", ar: "التكاملات وواجهة البرمجة" },
  "nav.audit": { en: "Audit log", ar: "سجل التدقيق" },
  "nav.concierge": { en: "Concierge", ar: "خدمة الكونسيرج" },
  "nav.signout": { en: "Sign out", ar: "تسجيل الخروج" },
  "common.search": { en: "Search", ar: "بحث" },
  "common.save": { en: "Save", ar: "حفظ" },
  "common.cancel": { en: "Cancel", ar: "إلغاء" },
  "common.continue": { en: "Continue", ar: "متابعة" },
  "common.back": { en: "Back", ar: "رجوع" },
  "common.viewAll": { en: "View all", ar: "عرض الكل" },
  "common.status": { en: "Status", ar: "الحالة" },
  "common.traveler": { en: "Traveler", ar: "المسافر" },
  "common.destination": { en: "Destination", ar: "الوجهة" },
  "common.dates": { en: "Travel dates", ar: "تواريخ السفر" },
  "common.total": { en: "Total", ar: "الإجمالي" },
  "dash.title": { en: "Good to see you", ar: "أهلاً بعودتك" },
  "dash.active": { en: "Active applications", ar: "طلبات نشطة" },
  "dash.issued": { en: "Visas issued (90 days)", ar: "تأشيرات صادرة (90 يومًا)" },
  "dash.approval": { en: "Approval rate", ar: "نسبة القبول" },
  "dash.spend": { en: "Spend this month", ar: "الإنفاق هذا الشهر" },
  "dash.expiring": { en: "Expiring documents", ar: "مستندات قاربت على الانتهاء" },
  "dash.pending": { en: "Waiting on you", ar: "بانتظار إجرائك" },
  "landing.hero": { en: "Business visas for UAE teams — done in minutes, not weeks.", ar: "تأشيرات الأعمال لفرق الإمارات — تُنجز في دقائق لا أسابيع." },
  "landing.sub": {
    en: "Safar knows every nationality on your payroll, every consulate in Dubai and Abu Dhabi, and every document they'll ask for. Upload once, travel forever.",
    ar: "سفر يعرف كل جنسية في كشوف رواتبك، وكل قنصلية في دبي وأبوظبي، وكل مستند سيطلبونه. ارفع مرة واحدة وسافر دائمًا.",
  },
  "landing.cta": { en: "Start free — go live in 60 seconds", ar: "ابدأ مجانًا — جاهز خلال 60 ثانية" },
  "landing.signin": { en: "Sign in", ar: "تسجيل الدخول" },
} as const;

export type DictKey = keyof typeof dict;

export function t(key: DictKey, locale: Locale) {
  return dict[key][locale];
}

export function dirOf(locale: Locale) {
  return locale === "ar" ? "rtl" : "ltr";
}
