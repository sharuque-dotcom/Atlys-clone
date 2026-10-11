"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { storeTravelerDocument } from "@/lib/documents";
import { DOCUMENT_LABELS, type DocumentRequirementKey } from "@/lib/catalog";

/** Upload from the customer portal. Authorised only by the unguessable booking token. */
export async function portalUpload(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const travelerId = String(formData.get("travelerId") ?? "");
  const type = String(formData.get("type") ?? "");
  const booking = await db.booking.findUnique({ where: { portalToken: token }, include: { applications: { include: { traveler: true } }, customer: true } });
  if (!booking || booking.status === "CANCELLED") redirect(`/c/${token}`);
  const app = booking!.applications.find((a) => a.travelerId === travelerId);
  if (!app) redirect(`/c/${token}?error=${encodeURIComponent("Traveler not on this booking")}`);
  try {
    await storeTravelerDocument({ traveler: app!.traveler, type, file: formData.get("file"), actor: { name: `${booking!.customer.name} (customer portal)` } });
    await db.applicationEvent.create({
      data: { applicationId: app!.id, type: "CUSTOMER_UPLOAD", message: `Customer uploaded ${DOCUMENT_LABELS[type as DocumentRequirementKey]?.en ?? type}`, actorName: booking!.customer.name },
    });
  } catch (e) {
    redirect(`/c/${token}?error=${encodeURIComponent(e instanceof Error ? e.message : "Upload failed")}#t-${travelerId}`);
  }
  revalidatePath(`/c/${token}`);
  redirect(`/c/${token}?ok=${encodeURIComponent("Thank you — uploaded. We are checking it now.")}#t-${travelerId}`);
}
