import { Prisma } from "@prisma/client";

export function toMoney(value: number): Prisma.Decimal {
  if (!Number.isFinite(value)) throw new Error("Valor monetário inválido.");
  return new Prisma.Decimal(value).toDecimalPlaces(2);
}
