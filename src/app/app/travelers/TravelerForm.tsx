import type { Branch, Traveler, User } from "@prisma/client";
import { COUNTRIES } from "@/lib/countries";
import { toInputDate } from "@/lib/dates";
import { saveTraveler } from "./actions";

export function TravelerForm({ traveler, branches, managers }: { traveler?: Traveler; branches: Branch[]; managers: User[] }) {
  const t = traveler;
  return (
    <form action={saveTraveler} className="grid gap-4 p-4 sm:grid-cols-3">
      {t && <input type="hidden" name="id" value={t.id} />}
      <L label="First name"><input name="firstName" required defaultValue={t?.firstName} className="input" /></L>
      <L label="Last name"><input name="lastName" required defaultValue={t?.lastName} className="input" /></L>
      <L label="Nationality (passport)">
        <select name="nationality" required defaultValue={t?.nationality ?? ""} className="input">
          <option value="" disabled>Select…</option>
          {[...COUNTRIES].sort((a, b) => a.en.localeCompare(b.en)).map((c) => <option key={c.code} value={c.code}>{c.flag} {c.en}</option>)}
        </select>
      </L>
      <L label="Work email"><input name="email" type="email" defaultValue={t?.email ?? ""} className="input" /></L>
      <L label="Mobile (WhatsApp)"><input name="phone" defaultValue={t?.phone ?? ""} placeholder="050 123 4567" className="input" /></L>
      <L label="Gender"><select name="gender" defaultValue={t?.gender ?? ""} className="input"><option value="">—</option><option value="MALE">Male</option><option value="FEMALE">Female</option></select></L>
      <L label="Date of birth"><input name="dateOfBirth" type="date" defaultValue={toInputDate(t?.dateOfBirth)} className="input" /></L>
      <L label="Employee ID"><input name="employeeId" defaultValue={t?.employeeId ?? ""} className="input" /></L>
      <L label="Designation"><input name="designation" defaultValue={t?.designation ?? ""} className="input" /></L>
      <L label="Department"><input name="department" defaultValue={t?.department ?? ""} className="input" /></L>
      <L label="Monthly salary (AED)"><input name="monthlySalaryAed" type="number" min={0} defaultValue={t?.monthlySalaryAed ?? ""} className="input" /></L>
      <L label="Joined company"><input name="joinedAt" type="date" defaultValue={toInputDate(t?.joinedAt)} className="input" /></L>
      <L label="Passport no."><input name="passportNo" defaultValue={t?.passportNo ?? ""} className="input uppercase" /></L>
      <L label="Passport expiry"><input name="passportExpiry" type="date" defaultValue={toInputDate(t?.passportExpiry)} className="input" /></L>
      <L label="UAE resident"><label className="flex h-[38px] items-center gap-2 text-sm"><input type="checkbox" name="uaeResident" defaultChecked={t?.uaeResident ?? true} className="size-4 accent-brand-600" /> Holds a UAE residence visa / is a UAE national</label></L>
      <L label="Emirates ID no."><input name="emiratesIdNo" defaultValue={t?.emiratesIdNo ?? ""} placeholder="784-1990-1234567-1" className="input" /></L>
      <L label="Emirates ID expiry"><input name="emiratesIdExpiry" type="date" defaultValue={toInputDate(t?.emiratesIdExpiry)} className="input" /></L>
      <L label="Residence visa expiry"><input name="residenceVisaExpiry" type="date" defaultValue={toInputDate(t?.residenceVisaExpiry)} className="input" /></L>
      <L label="Branch"><select name="branchId" defaultValue={t?.branchId ?? ""} className="input"><option value="">—</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></L>
      <L label="Line manager / approver"><select name="managerId" defaultValue={t?.managerId ?? ""} className="input"><option value="">—</option>{managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></L>
      <L label="Previous visa refusals"><input name="priorRejections" type="number" min={0} defaultValue={t?.priorRejections ?? 0} className="input" /></L>
      <div className="sm:col-span-3"><L label="Countries visited in last 5 years (ISO codes)"><input name="travelHistory" defaultValue={t?.travelHistory.replaceAll(",", ", ") ?? ""} placeholder="GB, FR, US" className="input" /></L></div>
      <div className="sm:col-span-3"><button className="btn-primary">{t ? "Save profile" : "Add traveler"}</button></div>
    </form>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}
