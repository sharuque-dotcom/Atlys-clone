export type Locale = "en" | "ar";

const dict = {
  "nav.dashboard": { en: "Dashboard", ar: "لوحة التحكم" },
  "nav.applications": { en: "Applications", ar: "الطلبات" },
  "nav.new": { en: "New booking", ar: "حجز جديد" },
  "nav.bookings": { en: "Bookings", ar: "الحجوزات" },
  "nav.customers": { en: "Customers", ar: "العملاء" },
  "nav.pricing": { en: "Pricing & margins", ar: "الأسعار والهوامش" },
  "nav.checker": { en: "Visa checker", ar: "مدقق التأشيرات" },
  "nav.billing": { en: "Statements & VAT", ar: "الكشوف والضريبة" },
  "nav.organization": { en: "Agency & team", ar: "الوكالة والفريق" },
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
  "dash.active": { en: "Visas in progress", ar: "تأشيرات قيد المعالجة" },
  "dash.issued": { en: "Visas issued (90 days)", ar: "تأشيرات صادرة (90 يومًا)" },
  "dash.revenue": { en: "Sales this month", ar: "المبيعات هذا الشهر" },
  "dash.margin": { en: "Margin this month", ar: "الهامش هذا الشهر" },
  "dash.outstanding": { en: "Customer balances due", ar: "مستحقات العملاء" },
  "dash.expiring": { en: "Customer passports & visas expiring", ar: "جوازات وتأشيرات العملاء المنتهية قريبًا" },
  "dash.pending": { en: "Needs action", ar: "يتطلب إجراء" },
  "landing.hero": { en: "The visa desk for UAE travel agencies.", ar: "مكتب التأشيرات لوكالات السفر في الإمارات." },
  "landing.sub": {
    en: "Quote a family of five for Schengen in two minutes — every passport, every child's fee, every document. Your brand, your price, our back office.",
    ar: "قدّم عرض سعر لعائلة من خمسة أفراد لتأشيرة شنغن في دقيقتين — كل جواز وكل رسوم للأطفال وكل مستند. علامتك التجارية وسعرك، ومكتبنا الخلفي.",
  },
  "landing.cta": { en: "Open your agency account", ar: "افتح حساب وكالتك" },
  "landing.signin": { en: "Sign in", ar: "تسجيل الدخول" },
} as const;

export type DictKey = keyof typeof dict;

export function t(key: DictKey, locale: Locale) {
  return dict[key][locale];
}

export function dirOf(locale: Locale) {
  return locale === "ar" ? "rtl" : "ltr";
}
