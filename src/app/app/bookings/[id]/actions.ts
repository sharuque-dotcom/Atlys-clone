"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { confirmBooking, transition, syncBookingStatus } from "@/lib/applications";
import { aedToFils } from "@/lib/money";
import { PAYMENT_METHODS } from "@/lib/types";
import { newPortalToken } from "@/lib/refs";

function back(id: string, key: "ok" | "error", msg: string): never {
  revalidatePath(`/app/bookings/${id}`);
  redirect(`/app/bookings/${id}?${key}=${encodeURIComponent(msg)}`);
}

export async function confirmBookingAction(formData: FormData) {
  const id = String(formData.get("id"));
  const user = await requireMember("applications.create");
  try {
    await confirmBooking(user, id);
  } catch (e) {
    back(id, "error", e instanceof Error ? e.message : "Failed");
  }
  back(id, "ok", "Booking confirmed — processing started and the customer was notified");
}

export async function recordPayment(formData: FormData) {
  const id = String(formData.get("id"));
  const user = await requireMember("payments.record");
  const booking = await db.booking.findFirst({ where: { id, enterpriseId: user.enterpriseId }, include: { payments: true } });
  if (!booking) back(id, "error", "Booking not found");
  const amountFils = aedToFils(Number(formData.get("amount")) || 0);
  const method = String(formData.get("method"));
  if (amountFils <= 0) back(id, "error", "Enter an amount");
  if (!(method in PAYMENT_METHODS)) back(id, "error", "Pick a payment method");
  const paid = booking!.payments.reduce((s, p) => s + p.amountFils, 0);
  if (paid + amountFils > booking!.sellTotalFils) back(id, "error", "That's more than the balance due.");
  await db.payment.create({
    data: { enterpriseId: user.enterpriseId, bookingId: id, amountFils, method, reference: String(formData.get("reference") ?? "").trim() || null, receivedBy: user.name },
  });
  await audit({ id: user.id, name: user.name, enterpriseId: user.enterpriseId }, "payment.recorded", "Booking", id, { amountFils, method });
  // A payment on a quote means the customer said yes.
  if (booking!.status === "QUOTED") await confirmBooking(user, id);
  back(id, "ok", "Payment recorded");
}

export async function cancelBooking(formData: FormData) {
  const id = String(formData.get("id"));
  const user = await requireMember("applications.create");
  const booking = await db.booking.findFirst({ where: { id, enterpriseId: user.enterpriseId }, include: { applications: true } });
  if (!booking) back(id, "error", "Booking not found");
  for (const a of booking!.applications.filter((x) => !["SUBMITTED", "ISSUED", "REJECTED", "CANCELLED"].includes(x.status))) {
    await transition(user, a.id, "CANCELLED", "Booking cancelled");
  }
  await db.booking.update({ where: { id }, data: { status: "CANCELLED" } });
  await syncBookingStatus(id);
  await audit({ id: user.id, name: user.name, enterpriseId: user.enterpriseId }, "booking.cancelled", "Booking", id);
  back(id, "ok", "Booking cancelled");
}

export async function rotatePortalLink(formData: FormData) {
  const id = String(formData.get("id"));
  const user = await requireMember("applications.create");
  await db.booking.updateMany({ where: { id, enterpriseId: user.enterpriseId }, data: { portalToken: newPortalToken() } });
  await audit({ id: user.id, name: user.name, enterpriseId: user.enterpriseId }, "booking.portal_link_rotated", "Booking", id);
  back(id, "ok", "New customer link generated — the old link no longer works");
}
