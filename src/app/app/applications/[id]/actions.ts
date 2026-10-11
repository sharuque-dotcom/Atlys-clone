"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { transition, checklist, missingRequired } from "@/lib/applications";
import { audit } from "@/lib/audit";
import { can, APP_STATUSES, type AppStatus } from "@/lib/types";
import { applicationScope } from "@/lib/scope";

function back(id: string, key: "ok" | "error", msg: string): never {
  redirect(`/app/applications/${id}?${key}=${encodeURIComponent(msg)}`);
}

// Separate actions per button: a submit button's name/value is not reliably sent with server actions.
export async function approveApplication(formData: FormData) {
  return decideApproval(formData, "approve");
}
export async function declineApplication(formData: FormData) {
  return decideApproval(formData, "decline");
}

async function decideApproval(formData: FormData, decision: "approve" | "decline") {
  const id = String(formData.get("id"));
  const note = String(formData.get("note") ?? "").trim();
  const user = await requireMember("applications.approve");
  const app = await db.application.findFirst({ where: { id, enterpriseId: user.enterpriseId }, include: { traveler: { include: { documents: true } } } });
  if (!app || app.status !== "PENDING_APPROVAL") back(id, "error", "This application is not awaiting approval.");
  if (app!.createdById === user.id && user.role === "APPROVER") back(id, "error", "You can't approve your own request.");
  try {
    if (decision === "approve") {
      const next: AppStatus = missingRequired(checklist(app!, app!.traveler)) > 0 ? "DOCS_PENDING" : "IN_REVIEW";
      await transition(user, id, next, `Approved by ${user.name}${note ? `: ${note}` : ""}`, { approvedById: user.id, approvedAt: new Date() });
    } else {
      await transition(user, id, "CANCELLED", `Declined by ${user.name}${note ? `: ${note}` : ""}`);
    }
  } catch (e) {
    back(id, "error", e instanceof Error ? e.message : "Failed");
  }
  revalidatePath("/app/approvals");
  back(id, "ok", decision === "approve" ? "Approved" : "Declined");
}

/** Operations console — in production this is driven by Safar's ops team / embassy integrations. */
export async function opsTransition(formData: FormData) {
  const id = String(formData.get("id"));
  const to = String(formData.get("to")) as AppStatus;
  const note = String(formData.get("note") ?? "").trim() || undefined;
  const user = await requireMember("org.manage");
  if (!APP_STATUSES.includes(to)) back(id, "error", "Unknown status");
  const extra: Record<string, unknown> = {};
  if (to === "APPOINTMENT_BOOKED") {
    const at = String(formData.get("appointmentAt") ?? "");
    const center = String(formData.get("appointmentCenter") ?? "");
    if (!at) back(id, "error", "Pick the appointment date & time.");
    extra.appointmentAt = new Date(at);
    extra.appointmentCenter = center || null;
  }
  try {
    await transition(user, id, to, note, extra);
  } catch (e) {
    back(id, "error", e instanceof Error ? e.message : "Failed");
  }
  back(id, "ok", "Status updated");
}

export async function cancelApplication(formData: FormData) {
  const id = String(formData.get("id"));
  const user = await requireMember();
  const app = await db.application.findFirst({ where: { id, ...applicationScope(user) } });
  if (!app) back(id, "error", "Not found");
  if (app!.createdById !== user.id && !can(user.role, "applications.approve")) back(id, "error", "Only the requester or an approver can cancel.");
  try {
    await transition(user, id, "CANCELLED", `Cancelled by ${user.name}`);
  } catch (e) {
    back(id, "error", e instanceof Error ? e.message : "Failed");
  }
  back(id, "ok", "Application cancelled");
}

export async function postMessage(formData: FormData) {
  const id = String(formData.get("id"));
  const body = String(formData.get("body") ?? "").trim();
  const user = await requireMember();
  const app = await db.application.findFirst({ where: { id, ...applicationScope(user) } });
  if (!app || !body) back(id, "error", "Message is empty");
  await db.message.create({ data: { enterpriseId: user.enterpriseId, applicationId: id, authorName: user.name, body: body.slice(0, 4000) } });
  // Concierge auto-acknowledgement; a human specialist picks the thread up from the ops queue.
  await db.message.create({
    data: { enterpriseId: user.enterpriseId, applicationId: id, authorName: "Safar Concierge", fromAgent: true, body: `Thanks ${user.name.split(" ")[0]} — a visa specialist has your message on ${app!.ref} and will reply here and on WhatsApp shortly.` },
  });
  await audit({ id: user.id, name: user.name, enterpriseId: user.enterpriseId }, "message.posted", "Application", id);
  revalidatePath(`/app/applications/${id}`);
  redirect(`/app/applications/${id}#messages`);
}
