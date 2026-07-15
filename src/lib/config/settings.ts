import { prisma } from "@/lib/prisma";

/**
 * Global settings live in the `Setting` table (admin-editable). These constants
 * are only fallback defaults used when a key is missing — the seed inserts the
 * real rows, and admins can override them at runtime. This keeps magic numbers
 * (like the 5000 volumetric divisor) out of the domain code.
 */
export const SETTING_KEYS = {
  VOLUMETRIC_DIVISOR: "volumetricDivisor",
  CURRENCY: "currency",
} as const;

export const SETTING_DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.VOLUMETRIC_DIVISOR]: "5000",
  [SETTING_KEYS.CURRENCY]: "INR",
};

export type SettingsMap = Record<string, string>;

/** Loads all settings, layered over the defaults. */
export async function getSettingsMap(): Promise<SettingsMap> {
  const rows = await prisma.setting.findMany();
  const map: SettingsMap = { ...SETTING_DEFAULTS };
  for (const row of rows) map[row.key] = row.value;
  return map;
}

export function getVolumetricDivisor(map: SettingsMap): number {
  const n = Number(map[SETTING_KEYS.VOLUMETRIC_DIVISOR]);
  return Number.isFinite(n) && n > 0 ? n : 5000;
}

export function getCurrency(map: SettingsMap): string {
  return map[SETTING_KEYS.CURRENCY] ?? "INR";
}
