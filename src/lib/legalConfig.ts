export const LEGAL_CONFIG_KEYS = ["LEGAL_ENTITY_NAME", "LEGAL_ENTITY_REGISTRATION", "LEGAL_ENTITY_ADDRESS", "LEGAL_CONTACT_EMAIL"] as const;

export function legalIdentityStatus() {
  const values = Object.fromEntries(LEGAL_CONFIG_KEYS.map(key => [key, process.env[key]?.trim() || null]));
  const missing = LEGAL_CONFIG_KEYS.filter(key => !values[key]);
  return { values, missing, productionReady: missing.length === 0 };
}
