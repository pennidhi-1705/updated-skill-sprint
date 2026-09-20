import { read, write, uid } from "./storage";
import { analyzeVerificationDocuments } from "./aiVerificationService";
import { verifyWithGovernmentRecords } from "./governmentVerificationService";

// PENDING -> the automated pipeline hasn't produced a result yet (rare in
// this synchronous prototype, but kept for UI/status parity with a real
// async pipeline).
// VERIFYING -> pipeline is running (shown briefly in the UI).
// VERIFIED / NEEDS_ATTENTION / REJECTED -> pipeline result. Internal staff
// can still override any of these from the internal review console.
export const ORG_VERIFICATION_STATUSES = ["Pending", "Verifying", "Verified", "Needs Attention", "Rejected"];

export function getOrganizations() { return read("organizations", []); }
export function getOrganization(id) { return getOrganizations().find(o => o.id === id) || null; }

export function isOrganizationVerified(org) {
  return org?.verificationStatus === "Verified";
}

export function getOrganizationUserIds(orgId) {
  return read("users", []).filter(u => u.role === "organization" && u.organizationId === orgId).map(u => u.id);
}

function addAuditLog(orgId, action, performedBy, metadata = {}) {
  const logs = read("orgAuditLogs", []);
  write("orgAuditLogs", [...logs, {
    id: uid("audit"),
    organizationId: orgId,
    action,
    performedBy,
    metadata,
    createdAt: new Date().toISOString()
  }]);
}

export function getAuditLogs(orgId) {
  return read("orgAuditLogs", [])
    .filter(l => l.organizationId === orgId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Runs the AI-assisted document check + mock government record check and
 * writes a structured, internal-only verification result onto the
 * organization record. This is the automated first pass — organizations
 * above a high confidence threshold with a matched government record are
 * marked Verified immediately; everything else is routed to internal
 * review instead of being silently approved or silently rejected.
 */
export function runVerificationPipeline(orgId) {
  const orgs = getOrganizations();
  const org = orgs.find(o => o.id === orgId);
  if (!org) throw new Error("Organization not found.");

  const ai = analyzeVerificationDocuments(org);
  const government = verifyWithGovernmentRecords(org);

  const overallConfidence = Math.round(
    ai.confidenceScore * 0.6 + (government.governmentRecordFound ? 100 : 35) * 0.4
  );

  let status;
  let verificationReason = "";
  if (overallConfidence >= 90 && government.governmentRecordFound && ai.warnings.length === 0) {
    status = "Verified";
  } else if (overallConfidence >= 60) {
    status = "Needs Attention";
    verificationReason = ai.warnings[0] || (!government.governmentRecordFound
      ? "We couldn't confirm this organization against available government records."
      : "Some submitted details need a closer look before we can verify this organization.");
  } else {
    status = "Needs Attention";
    verificationReason = "Submitted information is incomplete, so it couldn't be automatically verified.";
  }

  const updated = {
    ...org,
    verificationStatus: status,
    verificationReason,
    verificationReviewedAt: new Date().toISOString(),
    aiVerification: ai,
    governmentVerification: government,
    verificationConfidence: overallConfidence
  };
  write("organizations", orgs.map(o => o.id === orgId ? updated : o));
  addAuditLog(orgId, "ai_verification_pipeline_run", "system:ai-pipeline", {
    status, confidence: overallConfidence, governmentRecordFound: government.governmentRecordFound
  });
  return updated;
}

/**
 * Create an organization. Verification always starts unresolved — every
 * organization must pass the verification pipeline (and, for borderline
 * cases, internal review) before it can publish tasks.
 */
export function createOrganization(payload) {
  const now = new Date().toISOString();
  const org = {
    id: uid("org"),
    verificationStatus: "Pending",
    organizationType: payload.type || payload.organizationType || "Other",
    verificationDocuments: payload.verificationDocuments || [],
    businessProof: payload.businessProof || null,
    identityProofType: payload.identityProofType || null,
    identityProofSubmitted: Boolean(payload.identityProofSubmitted),
    verificationSubmittedAt: now,
    verificationReviewedAt: null,
    verificationReason: "",
    messageSettings: "applicants",
    createdAt: now,
    ...payload
  };
  write("organizations", [...getOrganizations(), org]);
  addAuditLog(org.id, "organization_registered", org.contactPerson || "unknown");
  runVerificationPipeline(org.id);
  return getOrganization(org.id);
}

/**
 * Organization (re)submits verification proof. Used both at registration
 * time and later from the Organization Verification page, e.g. after a
 * "Needs Attention" result.
 */
export function submitVerification(orgId, data) {
  const orgs = getOrganizations();
  const org = orgs.find(o => o.id === orgId);
  if (!org) throw new Error("Organization not found.");

  const updated = {
    ...org,
    organizationType: data.organizationType || org.organizationType,
    businessProof: data.businessProof ?? org.businessProof,
    verificationDocuments: data.verificationDocuments || org.verificationDocuments || [],
    identityProofType: data.identityProofType ?? org.identityProofType,
    identityProofSubmitted: data.identityProofSubmitted ?? org.identityProofSubmitted,
    verificationStatus: "Verifying",
    verificationReason: "",
    verificationSubmittedAt: new Date().toISOString(),
    verificationReviewedAt: null
  };
  write("organizations", orgs.map(o => o.id === orgId ? updated : o));
  addAuditLog(orgId, "verification_resubmitted", org.contactPerson || "unknown");
  return runVerificationPipeline(orgId);
}

export function updateMessageSettings(orgId, messageSettings) {
  const orgs = getOrganizations();
  const org = orgs.find(o => o.id === orgId);
  if (!org) throw new Error("Organization not found.");
  const updated = { ...org, messageSettings };
  write("organizations", orgs.map(o => o.id === orgId ? updated : o));
  return updated;
}

/**
 * Internal-staff-only override on a verification result. Not reachable from
 * any student- or organization-facing navigation — see the internal review
 * console, which is gated by the "admin" role.
 * action: "approve" | "reject" | "request_info"
 */
export function reviewOrganization(orgId, action, reason = "", performedBy = "internal-reviewer") {
  const orgs = getOrganizations();
  const org = orgs.find(o => o.id === orgId);
  if (!org) throw new Error("Organization not found.");

  const statusByAction = {
    approve: "Verified",
    reject: "Rejected",
    request_info: "Needs Attention"
  };
  const status = statusByAction[action];
  if (!status) throw new Error("Invalid verification action.");

  const updated = {
    ...org,
    verificationStatus: status,
    verificationReason: action !== "approve" ? reason : org.verificationReason,
    verificationReviewedAt: new Date().toISOString()
  };
  write("organizations", orgs.map(o => o.id === orgId ? updated : o));
  addAuditLog(orgId, `manual_review_${action}`, performedBy, { reason });
  return updated;
}
