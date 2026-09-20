/**
 * governmentVerificationService.js
 *
 * Abstraction over "compare organization details against authoritative
 * government records" (e.g. MCA/CIN lookup, GSTIN search, Udyam/MSME
 * registry). No official API is wired into this prototype.
 *
 * THIS PROVIDER IS A MOCK. It never scrapes government websites, never
 * bypasses CAPTCHA/auth/rate limits, and never claims a real registry match.
 * It exists only so the rest of the verification pipeline (confidence
 * calculation, status mapping, UI) has a stable shape to build against.
 *
 * To go to production:
 *   - Implement a real provider (e.g. MCA API, GSTIN verification API,
 *     Udyam Registration API) behind the same `verifyWithGovernmentRecords`
 *     signature.
 *   - Keep the `provider` field in the result so the UI can distinguish a
 *     mock check from a live one, and never let a mock result be displayed
 *     as if it were a live government match.
 */

const PROVIDER_NAME = "mock-government-registry (demo only — not a live registry)";

function seededMatch(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 100;
}

export function verifyWithGovernmentRecords(org) {
  const reference = org?.businessProof?.reference || "";
  const hasReference = reference.trim().length >= 4;

  if (!hasReference) {
    return {
      provider: PROVIDER_NAME,
      governmentRecordFound: false,
      matchedFields: [],
      status: "NOT_FOUND",
      checkedAt: new Date().toISOString()
    };
  }

  const seed = `${org.id}:${reference}`;
  const roll = seededMatch(seed);
  // Deterministic demo behavior: the vast majority of well-formed
  // references "match" so the happy path is easy to see; a small band
  // deliberately mismatches so the "Needs Attention" path is reachable too.
  const recordFound = roll < 88;

  const matchedFields = recordFound
    ? ["organizationName", "registrationNumber", "organizationType"].concat(
        seededMatch(seed + "addr") < 75 ? ["registeredAddress"] : []
      )
    : [];

  return {
    provider: PROVIDER_NAME,
    governmentRecordFound: recordFound,
    matchedFields,
    status: recordFound ? "MATCHED" : "NOT_FOUND",
    referenceChecked: reference,
    checkedAt: new Date().toISOString()
  };
}
