export const ROLES = ["OWNER", "ADMIN", "TRAVEL_MANAGER", "APPROVER", "FINANCE", "EMPLOYEE"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, { en: string; ar: string }> = {
  OWNER: { en: "Owner", ar: "المالك" },
  ADMIN: { en: "Admin", ar: "مسؤول" },
  TRAVEL_MANAGER: { en: "Travel manager", ar: "مدير السفر" },
  APPROVER: { en: "Approver", ar: "معتمِد" },
  FINANCE: { en: "Finance", ar: "المالية" },
  EMPLOYEE: { en: "Employee", ar: "موظف" },
};

/** Permission matrix — the single source of truth for RBAC checks. */
export const PERMISSIONS = {
  "travelers.manage": ["OWNER", "ADMIN", "TRAVEL_MANAGER"],
  "applications.create": ["OWNER", "ADMIN", "TRAVEL_MANAGER", "EMPLOYEE"],
  "applications.viewAll": ["OWNER", "ADMIN", "TRAVEL_MANAGER", "APPROVER", "FINANCE"],
  "applications.approve": ["OWNER", "ADMIN", "APPROVER"],
  "billing.view": ["OWNER", "ADMIN", "FINANCE"],
  "org.manage": ["OWNER", "ADMIN"],
  "integrations.manage": ["OWNER", "ADMIN"],
  "audit.view": ["OWNER", "ADMIN"],
} as const satisfies Record<string, readonly Role[]>;
export type Permission = keyof typeof PERMISSIONS;

export function can(role: string | null | undefined, permission: Permission) {
  return !!role && (PERMISSIONS[permission] as readonly string[]).includes(role);
}

export const APP_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
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
  DRAFT: { en: "Draft", ar: "مسودة", tone: "gray" },
  PENDING_APPROVAL: { en: "Awaiting approval", ar: "بانتظار الموافقة", tone: "amber" },
  DOCS_PENDING: { en: "Documents needed", ar: "مستندات مطلوبة", tone: "amber" },
  IN_REVIEW: { en: "Expert review", ar: "مراجعة الخبراء", tone: "blue" },
  APPOINTMENT_BOOKED: { en: "Appointment booked", ar: "تم حجز الموعد", tone: "violet" },
  SUBMITTED: { en: "Submitted to embassy", ar: "قُدِّم إلى السفارة", tone: "blue" },
  ISSUED: { en: "Visa issued", ar: "صدرت التأشيرة", tone: "green" },
  REJECTED: { en: "Refused", ar: "مرفوضة", tone: "red" },
  CANCELLED: { en: "Cancelled", ar: "ملغاة", tone: "gray" },
};

/** Allowed status transitions for the operations workflow. */
export const TRANSITIONS: Record<AppStatus, AppStatus[]> = {
  DRAFT: ["PENDING_APPROVAL", "DOCS_PENDING", "CANCELLED"],
  PENDING_APPROVAL: ["DOCS_PENDING", "IN_REVIEW", "CANCELLED"],
  DOCS_PENDING: ["IN_REVIEW", "CANCELLED"],
  IN_REVIEW: ["DOCS_PENDING", "APPOINTMENT_BOOKED", "SUBMITTED", "CANCELLED"],
  APPOINTMENT_BOOKED: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["ISSUED", "REJECTED"],
  ISSUED: [],
  REJECTED: [],
  CANCELLED: [],
};

export const ACTIVE_STATUSES: AppStatus[] = ["PENDING_APPROVAL", "DOCS_PENDING", "IN_REVIEW", "APPOINTMENT_BOOKED", "SUBMITTED"];

export const BUNDLES = {
  STANDARD: { en: "Standard", ar: "قياسي", feeAed: 0, desc: "Expert review, auto-filled forms, document prep, 24/7 WhatsApp support." },
  PRIORITY: { en: "Priority", ar: "أولوية", feeAed: 249, desc: "Fast-track appointment hunting, priority processing where the embassy offers it, dedicated specialist." },
  PROTECT: { en: "Priority + Protect", ar: "أولوية + حماية", feeAed: 449, desc: "Everything in Priority plus a 100% refund of service fees and a free re-application if the visa is refused." },
} as const;
export type Bundle = keyof typeof BUNDLES;

import type { DocumentRequirementKey } from "./catalog";

export const DOC_TYPES: (DocumentRequirementKey | "OTHER")[] = [
  "PASSPORT", "PHOTO", "EMIRATES_ID", "RESIDENCE_VISA", "BANK_STATEMENT", "SALARY_CERTIFICATE", "NOC",
  "TRADE_LICENSE", "INVITATION_LETTER", "TRAVEL_INSURANCE", "FLIGHT_RESERVATION", "HOTEL_BOOKING",
  "OLD_PASSPORTS", "DS160_CONFIRMATION", "CONFERENCE_REGISTRATION", "OTHER",
];
export type DocType = (typeof DOC_TYPES)[number];
