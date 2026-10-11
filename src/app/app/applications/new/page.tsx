import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { travelerScope } from "@/lib/scope";
import { PageHeader } from "@/components/ui";
import { Wizard, type WizardTraveler } from "./Wizard";

type SP = Promise<Record<string, string | undefined>>;

export default async function NewApplication({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await requireMember("applications.create");
  const [travelers, costCenters, policy, shipping] = await Promise.all([
    db.traveler.findMany({ where: travelerScope(user), include: { documents: true }, orderBy: { firstName: "asc" } }),
    db.costCenter.findMany({ where: { enterpriseId: user.enterpriseId }, orderBy: { code: "asc" } }),
    db.policy.findUnique({ where: { enterpriseId: user.enterpriseId } }),
    db.branch.findMany({ where: { enterpriseId: user.enterpriseId } }),
  ]);
  const now = new Date();
  const data: WizardTraveler[] = travelers.map((t) => ({
    id: t.id,
    name: `${t.firstName} ${t.lastName}`,
    designation: t.designation,
    nationality: t.nationality,
    uaeResident: t.uaeResident,
    passportExpiry: t.passportExpiry?.toISOString() ?? null,
    residenceVisaExpiry: t.residenceVisaExpiry?.toISOString() ?? null,
    emiratesIdExpiry: t.emiratesIdExpiry?.toISOString() ?? null,
    monthlySalaryAed: t.monthlySalaryAed,
    joinedAt: t.joinedAt?.toISOString() ?? null,
    priorRejections: t.priorRejections,
    travelHistory: t.travelHistory.split(",").filter(Boolean),
    docTypes: t.documents.filter((d) => !d.expiresAt || d.expiresAt > now).map((d) => d.type),
  }));

  return (
    <div>
      <PageHeader title="New visa application" subtitle="Pick travelers, tell us the trip — we work out the rest per passport." />
      <Wizard
        travelers={data}
        preselected={sp.traveler ? [sp.traveler] : []}
        presetDestination={sp.destination}
        costCenters={costCenters.map((c) => ({ id: c.id, label: `${c.code} — ${c.name}` }))}
        plan={user.enterprise.plan}
        policy={{
          allowPriority: policy?.allowPriority ?? true,
          allowProtect: policy?.allowProtect ?? true,
          blocked: policy?.blockedDestinations.split(",").filter(Boolean) ?? [],
          autoApproveBelowFils: policy?.requireApproval ? policy.autoApproveBelowFils : null,
        }}
        defaultAddress={shipping.find((b) => b.type === "SHIPPING")?.address ?? shipping[0]?.address ?? ""}
      />
    </div>
  );
}
