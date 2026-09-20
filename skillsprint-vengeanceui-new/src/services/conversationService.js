import { read, write, uid } from "./storage";
import { getApplications } from "./applicationService";
import { isFollowing } from "./followService";
import { getOrganization } from "./organizationService";

// Default is the safest setting from the product spec: an organization can
// only be messaged by students who have applied to one of its opportunities.
export const MESSAGE_SETTINGS = ["applicants", "applicants_and_followers", "anyone"];

export function getMessageSettings(org) {
  return org?.messageSettings || "applicants";
}

/**
 * Can this student start/continue a conversation with this organization?
 * Mirrors the platform rule: applied, shortlisted/selected, or (if the
 * organization allows it) simply following.
 */
export function canStudentMessageOrganization(studentId, organizationId) {
  const org = getOrganization(organizationId);
  if (!org) return false;

  const hasApplied = getApplications().some(a => a.studentId === studentId && a.organizationId === organizationId);
  if (hasApplied) return true;

  const setting = getMessageSettings(org);
  if (setting === "anyone") return true;
  if (setting === "applicants_and_followers" && isFollowing(studentId, organizationId, "organization")) return true;

  return false;
}

export function getConversations() { return read("conversations", []); }
export function getConversation(id) { return getConversations().find(c => c.id === id) || null; }

/**
 * A conversation's canonical identity is (studentId, organizationId) — not
 * individual user accounts — so any authorized teammate on the organization
 * side sees the same thread. `user` is the logged-in account (student or
 * organization role).
 */
export function getConversationsForUser(user) {
  if (!user) return [];
  return getConversations()
    .filter(c => user.role === "student" ? c.studentId === user.id : c.organizationId === user.organizationId)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export function findConversation(studentId, organizationId) {
  return getConversations().find(
    c => c.studentId === studentId && c.organizationId === organizationId
  ) || null;
}

/**
 * Get or create the single conversation between a student and an
 * organization. Throws if the platform's messaging rules don't currently
 * permit it (this is the server-side-equivalent check — never trust a
 * frontend-only gate for this).
 */
export function getOrCreateConversation(studentId, organizationId) {
  const existing = findConversation(studentId, organizationId);
  if (existing) return existing;

  if (!canStudentMessageOrganization(studentId, organizationId)) {
    throw new Error("Messaging isn't available yet. Apply to an opportunity from this organization to start a conversation.");
  }

  const now = new Date().toISOString();
  const conversation = {
    id: uid("conversation"),
    studentId,
    organizationId,
    createdAt: now,
    updatedAt: now
  };
  write("conversations", [...getConversations(), conversation]);
  return conversation;
}

export function touchConversation(id) {
  const conversations = getConversations();
  write("conversations", conversations.map(c => c.id === id ? { ...c, updatedAt: new Date().toISOString() } : c));
}
