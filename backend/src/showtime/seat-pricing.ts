// Fixed surcharges for the new 120-seat layout; retain legacy pricing for other types.
export function cinehuntSeatPrice(base: number, code?: string | null, multiplier = 1): number {
  const extras: Record<string, number> = { CH_STANDARD: 0, CH_VIP: 5000, CH_COUPLE: 20000 };
  return code && Object.prototype.hasOwnProperty.call(extras, code)
    ? Math.round(Number(base) + extras[code])
    : Math.round(Number(base) * Number(multiplier));
}
