// Pure household helpers (shared by server and the booking wizard in the browser).
import { ageOn, type TravelerFacts } from "./requirements";

export type MemberLike = {
  id: string;
  relationship: string;
  employmentType: string;
  nationality: string;
  uaeResident: boolean;
  dateOfBirth: Date | null;
  monthlySalaryAed: number | null;
  sponsorId: string | null;
};

/** Household facts that change a member's checklist and risk (sponsor income, family size, parents travelling). */
export type HouseholdContext = {
  sponsorSalaryAed: number | null;
  familySize: number;
  bothParentsTravelling: boolean;
};

export function householdContext(traveler: MemberLike, companions: MemberLike[], household: MemberLike[]): HouseholdContext {
  const others = household.filter((h) => h.id !== traveler.id);
  const sponsor =
    others.find((h) => h.id === traveler.sponsorId) ??
    others.find((h) => h.relationship === "SELF" && h.monthlySalaryAed != null) ??
    others.filter((h) => h.monthlySalaryAed != null).sort((a, b) => (b.monthlySalaryAed ?? 0) - (a.monthlySalaryAed ?? 0))[0];
  const rels = new Set(companions.map((c) => c.relationship));
  return {
    sponsorSalaryAed: sponsor?.monthlySalaryAed ?? null,
    familySize: Math.max(1, companions.length),
    bothParentsTravelling: rels.has("SELF") && rels.has("SPOUSE"),
  };
}

export function travelerFacts(traveler: MemberLike, travelStart: Date, ctx?: HouseholdContext): TravelerFacts {
  return {
    nationality: traveler.nationality,
    uaeResident: traveler.uaeResident,
    employmentType: traveler.employmentType,
    age: ageOn(traveler.dateOfBirth, travelStart),
    relationship: traveler.relationship,
    travelsWithBothParents: ctx?.bothParentsTravelling,
  };
}
