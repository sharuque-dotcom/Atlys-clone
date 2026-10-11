// Staff roles inside a travel agency.
export const ROLES = ["OWNER", "ADMIN", "AGENT", "ACCOUNTANT"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, { en: string; ar: string }> = {
  OWNER: { en: "Owner", ar: "المالك" },
  ADMIN: { en: "Branch manager", ar: "مدير الفرع" },
  AGENT: { en: "Visa agent", ar: "وكيل تأشيرات" },
  ACCOUNTANT: { en: "Accountant", ar: "محاسب" },
};

/** Permission matrix — the single source of truth for RBAC checks. */
export const PERMISSIONS = {
  "customers.manage": ["OWNER", "ADMIN", "AGENT"],
  "applications.create": ["OWNER", "ADMIN", "AGENT"],
  "applications.viewAll": ["OWNER", "ADMIN", "AGENT", "ACCOUNTANT"],
  "payments.record": ["OWNER", "ADMIN", "AGENT", "ACCOUNTANT"],
  "billing.view": ["OWNER", "ADMIN", "ACCOUNTANT"],
  "pricing.manage": ["OWNER", "ADMIN"],
  "org.manage": ["OWNER", "ADMIN"],
  "integrations.manage": ["OWNER", "ADMIN"],
  "audit.view": ["OWNER", "ADMIN"],
} as const satisfies Record<string, readonly Role[]>;
export type Permission = keyof typeof PERMISSIONS;

export function can(role: string | null | undefined, permission: Permission) {
  return !!role && (PERMISSIONS[permission] as readonly string[]).includes(role);
}

export const RELATIONSHIPS = {
  SELF: { en: "Main applicant", ar: "مقدم الطلب الرئيسي" },
  SPOUSE: { en: "Spouse", ar: "الزوج/الزوجة" },
  CHILD: { en: "Child", ar: "ابن/ابنة" },
  PARENT: { en: "Parent", ar: "الوالد/الوالدة" },
  SIBLING: { en: "Sibling", ar: "أخ/أخت" },
  OTHER: { en: "Other relative", ar: "قريب آخر" },
} as const;
export type Relationship = keyof typeof RELATIONSHIPS;

export const EMPLOYMENT = {
  EMPLOYED: { en: "Employed (salaried)", ar: "موظف" },
  SELF_EMPLOYED: { en: "Business owner / freelancer", ar: "صاحب عمل / مستقل" },
  DEPENDENT: { en: "Dependent (sponsored by family)", ar: "معال (على كفالة العائلة)" },
  STUDENT: { en: "Student", ar: "طالب" },
  RETIRED: { en: "Retired", ar: "متقاعد" },
  UNEMPLOYED: { en: "Not working", ar: "لا يعمل" },
} as const;
export type Employment = keyof typeof EMPLOYMENT;

export const CUSTOMER_SOURCES = {
  WALK_IN: "Walk-in",
  WHATSAPP: "WhatsApp",
  REFERRAL: "Referral",
  SOCIAL: "Instagram / Facebook",
  WEBSITE: "Website",
  REPEAT: "Repeat customer",
} as const;

export const BOOKING_STATUSES = {
  QUOTED: { en: "Quote sent", tone: "gray" },
  CONFIRMED: { en: "Confirmed", tone: "blue" },
  IN_PROGRESS: { en: "In progress", tone: "violet" },
  COMPLETED: { en: "Completed", tone: "green" },
  CANCELLED: { en: "Cancelled", tone: "red" },
} as const;
export type BookingStatus = keyof typeof BOOKING_STATUSES;

export const PAYMENT_METHODS = {
  CASH: "Cash",
  CARD: "Card (POS)",
  BANK_TRANSFER: "Bank transfer",
  PAYMENT_LINK: "Payment link",
} as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;

export const APP_STATUSES = [
  "DRAFT",
  "DOCS_PENDING",
  "IN_REVIEW",
  "APPOINTMENT_BOOKED",
  "SUBMITTED",
  "ISSUED",
  "REJECTED",
  "CANCELLED",
] as const;
export type AppStatus = (typeof APP_STATUSES)[number];

export const STATUS_META: Record<AppStatus, { en: string; ar: string; tone: "gray" | "amber" | "blue" | "violet" | "green" | "red" }> = {
  DRAFT: { en: "Quoted", ar: "عرض سعر", tone: "gray" },
  DOCS_PENDING: { en: "Documents needed", ar: "مستندات مطلوبة", tone: "amber" },
  IN_REVIEW: { en: "Preparing file", ar: "قيد تجهيز الملف", tone: "blue" },
  APPOINTMENT_BOOKED: { en: "Appointment booked", ar: "تم حجز الموعد", tone: "violet" },
  SUBMITTED: { en: "Submitted to embassy", ar: "قُدِّم إلى السفارة", tone: "blue" },
  ISSUED: { en: "Visa issued", ar: "صدرت التأشيرة", tone: "green" },
  REJECTED: { en: "Refused", ar: "مرفوضة", tone: "red" },
  CANCELLED: { en: "Cancelled", ar: "ملغاة", tone: "gray" },
};

/** Allowed status transitions for the operations workflow. */
export const TRANSITIONS: Record<AppStatus, AppStatus[]> = {
  DRAFT: ["DOCS_PENDING", "IN_REVIEW", "CANCELLED"],
  DOCS_PENDING: ["IN_REVIEW", "CANCELLED"],
  IN_REVIEW: ["DOCS_PENDING", "APPOINTMENT_BOOKED", "SUBMITTED", "CANCELLED"],
  APPOINTMENT_BOOKED: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["ISSUED", "REJECTED"],
  ISSUED: [],
  REJECTED: [],
  CANCELLED: [],
};

export const ACTIVE_STATUSES: AppStatus[] = ["DOCS_PENDING", "IN_REVIEW", "APPOINTMENT_BOOKED", "SUBMITTED"];

// Service levels the AGENCY sells (suggested prices; scaled by the agency's markup).
export const BUNDLES = {
  STANDARD: { en: "Standard", ar: "قياسي", feeAed: 0, desc: "Document check, application filing, appointment booking and status updates." },
  PRIORITY: { en: "Express", ar: "سريع", feeAed: 249, desc: "Same-day file preparation, earliest available appointment, priority processing where the embassy offers it." },
  PROTECT: { en: "Express + Refund", ar: "سريع + استرداد", feeAed: 449, desc: "Express handling plus a refund of the agency's service fee if the visa is refused (your agency's guarantee)." },
} as const;
export type Bundle = keyof typeof BUNDLES;

import type { DocumentRequirementKey } from "./catalog";

export const DOC_TYPES: (DocumentRequirementKey | "OTHER")[] = [
  "PASSPORT", "PHOTO", "EMIRATES_ID", "RESIDENCE_VISA", "BANK_STATEMENT", "SALARY_CERTIFICATE", "NOC",
  "TRADE_LICENSE", "INVITATION_LETTER", "TRAVEL_INSURANCE", "FLIGHT_RESERVATION", "HOTEL_BOOKING",
  "OLD_PASSPORTS", "DS160_CONFIRMATION", "CONFERENCE_REGISTRATION", "BIRTH_CERTIFICATE", "MARRIAGE_CERTIFICATE",
  "SPONSOR_DOCUMENTS", "SPONSORSHIP_LETTER", "PARENTAL_CONSENT", "SCHOOL_LETTER", "PENSION_PROOF", "OTHER",
];
export type DocType = (typeof DOC_TYPES)[number];
