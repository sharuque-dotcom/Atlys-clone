"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { aedToFils } from "@/lib/money";
import { PRODUCT_BY_ID } from "@/lib/catalog";
import { platformFee } from "@/lib/pricing";

export async function savePricing(formData: FormData) {
  const user = await requireMember("pricing.manage");
  const markupPct = Math.round(Number(formData.get("markupPct")));
  if (!Number.isFinite(markupPct) || markupPct < -50 || markupPct > 300) redirect("/app/pricing?error=Adjustment+must+be+between+-50%25+and+300%25");
  await db.enterprise.update({ where: { id: user.enterpriseId }, data: { markupPct } });
  let below = 0;
  // Selling below Safar's platform fee would lose money on every application.
  const floor = platformFee(user.enterprise.plan).serviceFils;
  for (const productId of PRODUCT_BY_ID.keys()) {
    const raw = String(formData.get(`fee_${productId}`) ?? "").trim();
    if (!raw) {
      await db.agencyPrice.deleteMany({ where: { enterpriseId: user.enterpriseId, productId } });
      continue;
    }
    const fils = aedToFils(Number(raw));
    if (!Number.isFinite(fils) || fils < 0) continue;
    const net = floor;
    if (fils < net) below++;
    await db.agencyPrice.upsert({
      where: { enterpriseId_productId: { enterpriseId: user.enterpriseId, productId } },
      create: { enterpriseId: user.enterpriseId, productId, serviceFeeFils: Math.max(fils, net) },
      update: { serviceFeeFils: Math.max(fils, net) },
    });
  }
  await audit({ id: user.id, name: user.name, enterpriseId: user.enterpriseId }, "pricing.updated", "Enterprise", user.enterpriseId, { markupPct });
  revalidatePath("/app/pricing");
  redirect(`/app/pricing?ok=${encodeURIComponent(below ? `Saved — ${below} fee(s) were below the platform fee and were raised to it` : "Prices saved")}`);
}
