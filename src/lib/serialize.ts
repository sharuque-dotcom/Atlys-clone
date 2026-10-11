import type { Application } from "@prisma/client";
import { parsePricing, parseRisk } from "./applications";

export function serializeApplication(a: Application & { traveler: { employeeId: string | null; firstName: string; lastName: string } }) {
  return {
    ref: a.ref,
    status: a.status,
    destination: a.destination,
    productId: a.productId,
    purpose: a.purpose,
    travelStart: a.travelStart,
    travelEnd: a.travelEnd,
    bundle: a.bundle,
    traveler: { employeeId: a.traveler.employeeId, name: `${a.traveler.firstName} ${a.traveler.lastName}` },
    risk: parseRisk(a),
    pricing: parsePricing(a),
    appointmentAt: a.appointmentAt,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}
