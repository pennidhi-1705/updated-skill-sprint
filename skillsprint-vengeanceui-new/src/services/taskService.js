import { read, write, uid } from "./storage";
import { getOrganization } from "./organizationService";
import { getFollowersOf } from "./followService";
import { createNotification } from "./notificationService";

export function getTasks() { return read("tasks", []); }
export function getTask(id) { return getTasks().find(t => t.id === id) || null; }

export function createTask(task) {
  const organization = getOrganization(task.organizationId);
  if (!organization) throw new Error("Organization not found.");

  // Unverified organizations can still prepare tasks, but they are saved as
  // Draft and never enter the student marketplace until verification passes.
  const verified = organization.verificationStatus === "Verified";
  const defaultStatus = verified ? "Open" : "Draft";

  const saved = {
    id: uid("task"),
    createdAt: new Date().toISOString(),
    ...task,
    status: task.status || defaultStatus
  };
  write("tasks", [...getTasks(), saved]);

  if (verified && (saved.status === "Open" || saved.status === "Published")) {
    getFollowersOf(organization.id, "organization").forEach(studentId => {
      createNotification({
        userId: studentId,
        type: "followed_org_opportunity",
        title: `${organization.name} posted a new opportunity`,
        message: saved.title,
        referenceId: saved.id
      });
    });
  }

  return saved;
}

export function getPublishedTasks() {
  return getTasks().filter(t => {
    const org = getOrganization(t.organizationId);
    const publishableStatus = t.status === "Open" || t.status === "Published";
    return publishableStatus && org?.verificationStatus === "Verified";
  });
}
