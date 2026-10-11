"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { normalizeUaeMobile } from "@/lib/validators";
import { CUSTOMER_SOURCES } from "@/lib/types";

const schema = z.object({
  name: z.string().trim().min(2, "Customer name is required"),
  phone: z.string().trim().min(5, "A WhatsApp number is required"),
  email: z.union([z.email(), z.literal("")]).optional(),
  emirate: z.string().optional(),
  source: z.enum(Object.keys(CUSTOMER_SOURCES) as [string, ...string[]]),
  notes: z.string().optional(),
  nationality: z.string().optional(),
});

export async function saveCustomer(formData: FormData) {
  const user = await requireMember("customers.manage");
  const id = String(formData.get("id") ?? "");
  const back = id ? `/app/customers/${id}` : "/app/customers";
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`${back}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const d = parsed.data;
  const phone = normalizeUaeMobile(d.phone) ?? d.phone;
  const data = { name: d.name, phone, email: d.email || null, emirate: d.emirate || null, source: d.source, notes: d.notes || null };
  if (id) {
    await db.customer.updateMany({ where: { id, enterpriseId: user.enterpriseId }, data });
    revalidatePath(back);
    redirect(`${back}?ok=Saved`);
  }
  const dup = await db.customer.findFirst({ where: { enterpriseId: user.enterpriseId, phone } });
  if (dup) redirect(`/app/customers/${dup.id}?error=${encodeURIComponent("A customer with this number already exists — opened their file.")}`);
  // The customer is usually also the main applicant: create them as the first household member.
  const [first, ...rest] = d.name.split(" ");
  const customer = await db.customer.create({
    data: {
      ...data,
      enterpriseId: user.enterpriseId,
      assignedToId: user.id,
      members: d.nationality ? { create: { enterpriseId: user.enterpriseId, firstName: first, lastName: rest.join(" ") || "-", nationality: d.nationality, relationship: "SELF", phone } } : undefined,
    },
  });
  await audit({ id: user.id, name: user.name, enterpriseId: user.enterpriseId }, "customer.created", "Customer", customer.id);
  redirect(`/app/customers/${customer.id}?ok=${encodeURIComponent("Customer created — add family members below")}`);
}
