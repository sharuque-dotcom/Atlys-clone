// Country reference data (ISO 3166-1 alpha-2) with English & Arabic names.
// Covers the nationalities most represented in the UAE workforce plus all destinations in the catalog.

export type Country = { code: string; en: string; ar: string; flag: string };

const RAW: [string, string, string][] = [
  ["AE", "United Arab Emirates", "الإمارات العربية المتحدة"],
  ["SA", "Saudi Arabia", "المملكة العربية السعودية"],
  ["QA", "Qatar", "قطر"],
  ["KW", "Kuwait", "الكويت"],
  ["BH", "Bahrain", "البحرين"],
  ["OM", "Oman", "عُمان"],
  ["IN", "India", "الهند"],
  ["PK", "Pakistan", "باكستان"],
  ["BD", "Bangladesh", "بنغلاديش"],
  ["PH", "Philippines", "الفلبين"],
  ["LK", "Sri Lanka", "سريلانكا"],
  ["NP", "Nepal", "نيبال"],
  ["EG", "Egypt", "مصر"],
  ["JO", "Jordan", "الأردن"],
  ["LB", "Lebanon", "لبنان"],
  ["SY", "Syria", "سوريا"],
  ["IQ", "Iraq", "العراق"],
  ["IR", "Iran", "إيران"],
  ["SD", "Sudan", "السودان"],
  ["MA", "Morocco", "المغرب"],
  ["TN", "Tunisia", "تونس"],
  ["DZ", "Algeria", "الجزائر"],
  ["PS", "Palestine", "فلسطين"],
  ["YE", "Yemen", "اليمن"],
  ["AF", "Afghanistan", "أفغانستان"],
  ["NG", "Nigeria", "نيجيريا"],
  ["KE", "Kenya", "كينيا"],
  ["ET", "Ethiopia", "إثيوبيا"],
  ["UG", "Uganda", "أوغندا"],
  ["ZA", "South Africa", "جنوب أفريقيا"],
  ["CN", "China", "الصين"],
  ["ID", "Indonesia", "إندونيسيا"],
  ["MY", "Malaysia", "ماليزيا"],
  ["TH", "Thailand", "تايلاند"],
  ["VN", "Vietnam", "فيتنام"],
  ["SG", "Singapore", "سنغافورة"],
  ["JP", "Japan", "اليابان"],
  ["KR", "South Korea", "كوريا الجنوبية"],
  ["RU", "Russia", "روسيا"],
  ["UA", "Ukraine", "أوكرانيا"],
  ["KZ", "Kazakhstan", "كازاخستان"],
  ["UZ", "Uzbekistan", "أوزبكستان"],
  ["TR", "Türkiye", "تركيا"],
  ["GE", "Georgia", "جورجيا"],
  ["AZ", "Azerbaijan", "أذربيجان"],
  ["AM", "Armenia", "أرمينيا"],
  ["GB", "United Kingdom", "المملكة المتحدة"],
  ["IE", "Ireland", "أيرلندا"],
  ["US", "United States", "الولايات المتحدة"],
  ["CA", "Canada", "كندا"],
  ["MX", "Mexico", "المكسيك"],
  ["BR", "Brazil", "البرازيل"],
  ["AU", "Australia", "أستراليا"],
  ["NZ", "New Zealand", "نيوزيلندا"],
  ["FR", "France", "فرنسا"],
  ["DE", "Germany", "ألمانيا"],
  ["IT", "Italy", "إيطاليا"],
  ["ES", "Spain", "إسبانيا"],
  ["PT", "Portugal", "البرتغال"],
  ["NL", "Netherlands", "هولندا"],
  ["BE", "Belgium", "بلجيكا"],
  ["CH", "Switzerland", "سويسرا"],
  ["AT", "Austria", "النمسا"],
  ["GR", "Greece", "اليونان"],
  ["SE", "Sweden", "السويد"],
  ["NO", "Norway", "النرويج"],
  ["DK", "Denmark", "الدنمارك"],
  ["FI", "Finland", "فنلندا"],
  ["PL", "Poland", "بولندا"],
  ["CZ", "Czechia", "التشيك"],
  ["HU", "Hungary", "المجر"],
  ["RO", "Romania", "رومانيا"],
  ["MV", "Maldives", "جزر المالديف"],
  ["MU", "Mauritius", "موريشيوس"],
  ["SC", "Seychelles", "سيشل"],
  ["TZ", "Tanzania", "تنزانيا"],
];

function flagOf(code: string) {
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export const COUNTRIES: Country[] = RAW.map(([code, en, ar]) => ({ code, en, ar, flag: flagOf(code) }));
const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function country(code: string | null | undefined): Country {
  if (!code) return { code: "", en: "—", ar: "—", flag: "🏳️" };
  return BY_CODE.get(code.toUpperCase()) ?? { code, en: code, ar: code, flag: flagOf(code) };
}

export function countryName(code: string | null | undefined, locale: string = "en") {
  const c = country(code);
  return locale === "ar" ? c.ar : c.en;
}

export const GCC = ["AE", "SA", "QA", "KW", "BH", "OM"];
export const EU_EEA_CH = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU",
  "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "CH",
];
export const SCHENGEN = [
  "AT", "BE", "BG", "HR", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IS", "IT", "LV", "LI", "LT", "LU",
  "MT", "NL", "NO", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "CH",
];
/** Passports with broad visa-free access to Schengen, UK, Japan etc. (simplified grouping) */
export const STRONG_PASSPORTS = [...EU_EEA_CH, "GB", "US", "CA", "AU", "NZ", "JP", "KR", "SG"];

// ICAO 9303 uses alpha-3 codes inside the MRZ.
export const ALPHA3_TO_ALPHA2: Record<string, string> = {
  ARE: "AE", SAU: "SA", QAT: "QA", KWT: "KW", BHR: "BH", OMN: "OM", IND: "IN", PAK: "PK", BGD: "BD", PHL: "PH",
  LKA: "LK", NPL: "NP", EGY: "EG", JOR: "JO", LBN: "LB", SYR: "SY", IRQ: "IQ", IRN: "IR", SDN: "SD", MAR: "MA",
  TUN: "TN", DZA: "DZ", PSE: "PS", YEM: "YE", AFG: "AF", NGA: "NG", KEN: "KE", ETH: "ET", UGA: "UG", ZAF: "ZA",
  CHN: "CN", IDN: "ID", MYS: "MY", THA: "TH", VNM: "VN", SGP: "SG", JPN: "JP", KOR: "KR", RUS: "RU", UKR: "UA",
  KAZ: "KZ", UZB: "UZ", TUR: "TR", GEO: "GE", AZE: "AZ", ARM: "AM", GBR: "GB", IRL: "IE", USA: "US", CAN: "CA",
  MEX: "MX", BRA: "BR", AUS: "AU", NZL: "NZ", FRA: "FR", DEU: "DE", "D<<": "DE", ITA: "IT", ESP: "ES", PRT: "PT",
  NLD: "NL", BEL: "BE", CHE: "CH", AUT: "AT", GRC: "GR", SWE: "SE", NOR: "NO", DNK: "DK", FIN: "FI", POL: "PL",
  CZE: "CZ", HUN: "HU", ROU: "RO", MDV: "MV", MUS: "MU", SYC: "SC", TZA: "TZ",
};

export const EMIRATES: { code: string; en: string; ar: string }[] = [
  { code: "AUH", en: "Abu Dhabi", ar: "أبوظبي" },
  { code: "DXB", en: "Dubai", ar: "دبي" },
  { code: "SHJ", en: "Sharjah", ar: "الشارقة" },
  { code: "AJM", en: "Ajman", ar: "عجمان" },
  { code: "UAQ", en: "Umm Al Quwain", ar: "أم القيوين" },
  { code: "RAK", en: "Ras Al Khaimah", ar: "رأس الخيمة" },
  { code: "FUJ", en: "Fujairah", ar: "الفجيرة" },
];

export function emirateName(code: string, locale = "en") {
  const e = EMIRATES.find((x) => x.code === code);
  return e ? (locale === "ar" ? e.ar : e.en) : code;
}
