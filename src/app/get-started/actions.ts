"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, currentUser, destroySession } from "@/lib/auth";
import { hashPassword, passwordPolicyErrors, verifyPassword } from "@/lib/password";
import { emailDomain, isCorporateEmail, isValidTrn, normalizeUaeMobile } from "@/lib/validators";
import { newCompanyCode } from "@/lib/refs";
import { audit } from "@/lib/audit";

const back = (path: string, error: string) => redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(error)}`);

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/app");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) back("/get-started", "Email or password is incorrect.");
  await createSession(user!.id);
  redirect(next.startsWith("/") ? next : "/app");
}

export async function demoSignIn() {
  const user = await db.user.findUnique({ where: { email: "layla@falconlogistics.ae" } });
  if (!user) back("/get-started", "Demo data not found — run `npm run setup` first.");
  await createSession(user!.id);
  redirect("/app");
}

const signUpSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  email: z.email("Enter a valid email").transform((e) => e.toLowerCase()),
  password: z.string(),
  confirm: z.string(),
  emailType: z.enum(["CORPORATE", "PERSONAL"]),
});

export async function signUp(formData: FormData) {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("/get-started?mode=signup", parsed.error.issues[0].message);
  const { name, email, password, confirm, emailType } = parsed.data!;
  if (emailType === "CORPORATE" && !isCorporateEmail(email)) back("/get-started?mode=signup", "That looks like a personal email — choose “Personal email” or use your work address.");
  const policy = passwordPolicyErrors(password);
  if (policy.length) back("/get-started?mode=signup", `Password needs ${policy.join(", ")}.`);
  if (password !== confirm) back("/get-started?mode=signup", "Passwords do not match.");
  if (await db.user.findUnique({ where: { email } })) back("/get-started", "An account already exists — please sign in.");
  const user = await db.user.create({ data: { name, email, passwordHash: await hashPassword(password) } });
  await createSession(user.id);
  redirect("/get-started/onboarding");
}

export async function signOut() {
  await destroySession();
  redirect("/");
}

const enterpriseSchema = z.object({
  name: z.string().trim().min(2, "Company name is required"),
  legalName: z.string().trim().min(2, "Legal name (as on trade licence) is required"),
  tradeLicenseNo: z.string().trim().min(3, "Trade licence number is required"),
  licenseAuthority: z.string().trim().min(2),
  emirate: z.string().length(3),
  invoiceType: z.enum(["VAT", "NON_VAT"]),
  trn: z.string().trim().optional(),
  industry: z.string().trim().optional(),
  size: z.string().trim().optional(),
  address: z.string().trim().min(5, "Billing address is required"),
  phone: z.string().trim().optional(),
});

export async function registerEnterprise(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/get-started");
  if (user.enterpriseId) redirect("/app");
  const parsed = enterpriseSchema.safeParse(Object.fromEntries(formData));
  const P = "/get-started/onboarding?step=register";
  if (!parsed.success) back(P, parsed.error.issues[0].message);
  const d = parsed.data!;
  if (d.invoiceType === "VAT" && !isValidTrn(d.trn ?? "")) back(P, "Enter a valid 15-digit TRN (starts with 100) or choose a non-VAT invoice.");
  const phone = d.phone ? normalizeUaeMobile(d.phone) : null;
  if (d.phone && !phone) back(P, "Enter a UAE mobile number, e.g. 050 123 4567.");

  const domain = isCorporateEmail(user.email) ? emailDomain(user.email) : null;
  if (domain && (await db.enterprise.findUnique({ where: { domain } }))) back("/get-started/onboarding", "Your company is already on Safar — request access instead.");

  const enterprise = await db.enterprise.create({
    data: {
      name: d.name,
      legalName: d.legalName,
      tradeLicenseNo: d.tradeLicenseNo,
      licenseAuthority: d.licenseAuthority,
      emirate: d.emirate,
      invoiceType: d.invoiceType,
      trn: d.invoiceType === "VAT" ? d.trn!.replace(/\D/g, "") : null,
      industry: d.industry || null,
      size: d.size || null,
      domain,
      companyCode: newCompanyCode(),
      plan: "STARTER",
      branches: { create: { name: "Head office", type: "BILLING", emirate: d.emirate, address: d.address } },
      costCenters: { create: { code: "GEN", name: "General", budgetFils: 0 } },
      policy: { create: {} },
    },
  });
  await db.user.update({ where: { id: user.id }, data: { enterpriseId: enterprise.id, role: "OWNER", phone } });
  await audit({ id: user.id, name: user.name, enterpriseId: enterprise.id }, "enterprise.created", "Enterprise", enterprise.id);
  redirect("/get-started/onboarding?step=code");
}

export async function requestAccess(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/get-started");
  const enterpriseId = String(formData.get("enterpriseId") ?? "");
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const designation = String(formData.get("designation") ?? "").trim() || null;

  const enterprise = code
    ? await db.enterprise.findUnique({ where: { companyCode: code } })
    : await db.enterprise.findUnique({ where: { id: enterpriseId } });
  if (!enterprise) back("/get-started/onboarding", "That company code wasn't recognised.");

  // A matching company code proves membership — join directly. Otherwise an admin must approve.
  if (code) {
    await db.user.update({ where: { id: user.id }, data: { enterpriseId: enterprise!.id, role: "EMPLOYEE" } });
    await audit({ id: user.id, name: user.name, enterpriseId: enterprise!.id }, "member.joined_with_code", "User", user.id);
    redirect("/app");
  }
  await db.accessRequest.create({ data: { enterpriseId: enterprise!.id, userId: user.id, fullName: user.name, designation } });
  redirect("/get-started/onboarding?step=pending");
}
