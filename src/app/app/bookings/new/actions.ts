"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { createBooking } from "@/lib/applications";
import { aedToFils } from "@/lib/money";

const schema = z.object({
  customerId: z.string().min(1),
  members: z.array(z.object({ travelerId: z.string(), productId: z.string().nullable() })).min(1, "Pick at least one traveler"),
  purpose: z.enum(["BUSINESS", "TOURISM", "CONFERENCE", "TRAINING", "FAMILY"]),
  travelStart: z.coerce.date(),
  travelEnd: z.coerce.date(),
  bundle: z.enum(["STANDARD", "PRIORITY", "PROTECT"]),
  courier: z.enum(["NONE", "DROP_OFF", "PICKUP"]),
  courierAddress: z.string().optional(),
  discountAed: z.number().min(0).optional(),
  notes: z.string().optional(),
});

export async function createBookingAction(payload: unknown): Promise<{ error?: string }> {
  const user = await requireMember("applications.create");
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  let id: string;
  try {
    const b = await createBooking(user, { ...d, discountFils: aedToFils(d.discountAed ?? 0), courierAddress: d.courierAddress || null, notes: d.notes || null });
    id = b.id;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create the booking." };
  }
  revalidatePath("/app");
  redirect(`/app/bookings/${id}?ok=${encodeURIComponent("Quote created — send it to the customer")}`);
}
