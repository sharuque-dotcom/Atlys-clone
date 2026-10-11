"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { createApplication } from "@/lib/applications";
import { db } from "@/lib/db";

const schema = z.object({
  travelerIds: z.array(z.string()).min(1, "Pick at least one traveler"),
  productByTraveler: z.record(z.string(), z.string()),
  purpose: z.enum(["BUSINESS", "TOURISM", "CONFERENCE", "TRAINING", "FAMILY"]),
  travelStart: z.coerce.date(),
  travelEnd: z.coerce.date(),
  bundle: z.enum(["STANDARD", "PRIORITY", "PROTECT"]),
  courier: z.enum(["NONE", "DROP_OFF", "PICKUP"]),
  courierAddress: z.string().optional(),
  costCenterId: z.string().optional(),
  tripName: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateResult = { error?: string };

export async function createApplications(payload: unknown): Promise<CreateResult> {
  const user = await requireMember("applications.create");
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const ids: string[] = [];
  let tripId: string | null = null;
  try {
    if (d.travelerIds.length > 1 && d.tripName) {
      const firstProduct = d.productByTraveler[d.travelerIds[0]];
      const trip = await db.trip.create({
        data: { enterpriseId: user.enterpriseId, name: d.tripName, destination: firstProduct?.split("-")[0] ?? "", purpose: d.purpose, startDate: d.travelStart, endDate: d.travelEnd },
      });
      tripId = trip.id;
    }
    for (const travelerId of d.travelerIds) {
      const productId = d.productByTraveler[travelerId];
      if (!productId) continue; // visa-free travelers are skipped
      const app = await createApplication(user, {
        travelerId,
        productId,
        purpose: d.purpose,
        travelStart: d.travelStart,
        travelEnd: d.travelEnd,
        bundle: d.bundle,
        courier: d.courier,
        courierAddress: d.courierAddress || null,
        costCenterId: d.costCenterId || null,
        tripId,
        notes: d.notes || null,
      });
      ids.push(app.id);
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create the application." };
  }
  if (ids.length === 0) return { error: "Nobody in this group needs a visa — no application was created." };
  revalidatePath("/app");
  redirect(ids.length === 1 ? `/app/applications/${ids[0]}?ok=Application+created` : tripId ? `/app/trips/${tripId}?ok=${ids.length}+applications+created` : `/app/applications?ok=${ids.length}+applications+created`);
}
