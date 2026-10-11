"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { transition } from "@/lib/applications";
import { audit } from "@/lib/audit";
import { APP_STATUSES, type AppStatus } from "@/lib/types";
import { applicationScope } from "@/lib/scope";

function back(id: string, key: "ok" | "error", msg: string): never {
  redirect(`/app/applications/${id}?${key}=${encodeURIComponent(msg)}`);
}

/** Agency staff record progress after filing at the centre (appointment, submission, decision). */
export async function opsTransition(formData: FormData) {
  const id = String(formData.get("id"));
  const to = String(formData.get("to")) as AppStatus;
  const note = String(formData.get("note") ?? "").trim() || undefined;
  const user = await requireMember("applications.create");
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
  const user = await requireMember("applications.create");
  const app = await db.application.findFirst({ where: { id, ...applicationScope(user) } });
  if (!app) back(id, "error", "Not found");
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
  if (!app || !body) back(id, "error", "Note is empty");
  await db.message.create({ data: { enterpriseId: user.enterpriseId, applicationId: id, authorName: user.name, body: body.slice(0, 4000) } });
  await audit({ id: user.id, name: user.name, enterpriseId: user.enterpriseId }, "message.posted", "Application", id);
  revalidatePath(`/app/applications/${id}`);
  redirect(`/app/applications/${id}#messages`);
}
