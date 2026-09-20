const PREFIX = "skillsprint:";

export function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function write(key, value) {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
  if (key === "currentUser" && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("skillsprint:user-changed", { detail: value }));
  }
  return value;
}

export function uid(prefix = "id") {
  const c = globalThis.crypto;
  if (c?.randomUUID) return `${prefix}_${c.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function seedIfMissing() {
  if (!localStorage.getItem(PREFIX + "tasks")) {
    write("tasks", [
      {
        id: "task_demo_1", organizationId: "org_demo_1",
        title: "Refresh a local business website",
        description: "Update a small business landing page with new services, contact details and accessibility improvements.",
        requiredSkills: ["React", "HTML", "CSS"], duration: "2–3 days",
        deadline: "2026-10-15", workMode: "Remote", location: "Andhra Pradesh",
        reward: "₹2,500", deliverables: ["Updated pages", "Accessibility checklist"],
        status: "Open", createdAt: "2026-09-01T09:00:00Z"
      },
      {
        id: "task_demo_2", organizationId: "org_demo_2",
        title: "Community survey data entry",
        description: "Clean and enter survey responses for a local community program.",
        requiredSkills: ["Excel", "Data Entry"], duration: "1 day",
        deadline: "2026-10-05", workMode: "Hybrid", location: "Vijayawada",
        reward: "₹1,200", deliverables: ["Clean spreadsheet", "Summary counts"],
        status: "Open", createdAt: "2026-09-03T09:00:00Z"
      },
      {
        id: "task_demo_3", organizationId: "org_demo_1",
        title: "Community Data Analysis",
        description: "Analyze anonymized community program data and produce a short insights report with charts.",
        requiredSkills: ["Python", "Pandas", "Data Visualization", "SQL"], duration: "3–4 days",
        deadline: "2026-10-20", workMode: "Remote", location: "Andhra Pradesh",
        reward: "₹3,000", deliverables: ["Cleaned dataset", "Insights report", "Charts"],
        status: "Open", createdAt: "2026-09-05T09:00:00Z"
      }
    ]);
  }
  if (!localStorage.getItem(PREFIX + "organizations")) {
    write("organizations", [
      { id: "org_demo_1", name: "CivicSpark Labs", type: "Startup", organizationType: "Startup", contactPerson: "Demo contact", email: "demo@civicspark.example", location: "Andhra Pradesh", website: "", description: "Community technology projects.", verificationStatus: "Verified", messageSettings: "applicants", businessProof: { type: "Startup Recognition Certificate", reference: "DEMO-CERT-001" }, verificationDocuments: [{ type: "Startup Recognition Certificate", reference: "DEMO-CERT-001", submittedAt: "2026-08-01T09:00:00Z" }], identityProofType: "PAN Card", identityProofSubmitted: true, verificationSubmittedAt: "2026-08-01T09:00:00Z", verificationReviewedAt: "2026-08-02T09:00:00Z", verificationReason: "", verificationConfidence: 97, aiVerification: { organizationNameMatch: 98, registrationNumberMatch: 100, addressMatch: 94, documentTypeValid: true, confidenceScore: 97, warnings: [] }, governmentVerification: { provider: "mock-government-registry (demo only — not a live registry)", governmentRecordFound: true, matchedFields: ["organizationName","registrationNumber","organizationType"], status: "MATCHED" } },
      { id: "org_demo_2", name: "Local Impact NGO", type: "NGO", organizationType: "NGO", contactPerson: "Demo contact", email: "hello@localimpact.example", location: "Vijayawada", website: "", description: "Community development programs.", verificationStatus: "Verified", messageSettings: "applicants", businessProof: { type: "NGO Registration Certificate", reference: "DEMO-CERT-002" }, verificationDocuments: [{ type: "NGO Registration Certificate", reference: "DEMO-CERT-002", submittedAt: "2026-08-01T09:00:00Z" }], identityProofType: "Aadhaar Card", identityProofSubmitted: true, verificationSubmittedAt: "2026-08-01T09:00:00Z", verificationReviewedAt: "2026-08-02T09:00:00Z", verificationReason: "", verificationConfidence: 95, aiVerification: { organizationNameMatch: 96, registrationNumberMatch: 99, addressMatch: 92, documentTypeValid: true, confidenceScore: 95, warnings: [] }, governmentVerification: { provider: "mock-government-registry (demo only — not a live registry)", governmentRecordFound: true, matchedFields: ["organizationName","registrationNumber"], status: "MATCHED" } }
    ]);
  }
  for (const key of [
    "users", "applications", "projects", "submissions", "reviews",
    "follows", "conversations", "messages", "notifications", "orgAuditLogs"
  ]) {
    if (!localStorage.getItem(PREFIX + key)) write(key, []);
  }
}