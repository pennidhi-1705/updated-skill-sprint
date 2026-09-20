import { read, write, uid } from "./storage";
import { calculateMatch } from "./matchingService";
import { getTask } from "./taskService";
import { getOrganization, getOrganizationUserIds } from "./organizationService";
import { createNotification } from "./notificationService";

export const APPLICATION_STATUSES = ["Pending", "Shortlisted", "Selected", "Rejected"];

export function getApplications() { return read("applications", []); }

export function createApplication({ taskId, studentId, message, portfolio }) {
  const apps = getApplications();
  if (apps.some(a => a.taskId === taskId && a.studentId === studentId)) {
    throw new Error("You already applied to this task.");
  }

  const user = read("users", []).find(u => u.id === studentId);
  const task = getTask(taskId);
  if (!user || user.role !== "student") throw new Error("Student account not found.");
  if (!task) throw new Error("Task not found.");

  const organization = getOrganization(task.organizationId);
  if (!organization || organization.verificationStatus !== "Verified") {
    throw new Error("This opportunity is not available for applications yet.");
  }
  if (task.status !== "Open" && task.status !== "Published") {
    throw new Error("This opportunity is not currently open.");
  }

  const match = calculateMatch(user, task);
  const app = {
    id: uid("application"),
    taskId,
    studentId,
    organizationId: task.organizationId,
    message,
    portfolio,
    matchScore: match.total,
    status: "Pending",
    appliedAt: new Date().toISOString()
  };
  write("applications", [...apps, app]);

  getOrganizationUserIds(task.organizationId).forEach(userId => {
    createNotification({
      userId,
      type: "new_application",
      title: "New application received",
      message: `${user.name} applied to ${task.title}.`,
      referenceId: app.id
    });
  });

  return app;
}

const STATUS_COPY = {
  Shortlisted: title => `🎉 You've been shortlisted for ${title}`,
  Selected: title => `You've been selected for ${title}`,
  Rejected: title => `Your application for ${title} was not selected this time`
};

export function updateApplicationStatus(id, status) {
  if (!APPLICATION_STATUSES.includes(status)) throw new Error("Invalid application status.");

  const apps = getApplications();
  const app = apps.find(a => a.id === id);
  if (!app) throw new Error("Application not found.");

  const updated = { ...app, status };
  write("applications", apps.map(a => a.id === id ? updated : a));

  const task = getTask(app.taskId);
  const copy = STATUS_COPY[status];
  if (copy && task) {
    createNotification({
      userId: app.studentId,
      type: status === "Rejected" ? "application_rejected" : "application_status",
      title: copy(task.title),
      message: status === "Shortlisted"
        ? `${getOrganization(app.organizationId)?.name || "An organization"} is interested in your profile. You can message them directly.`
        : status === "Selected"
          ? "A project workspace has been created for this opportunity."
          : "Keep applying — new opportunities are added regularly.",
      referenceId: app.id
    });
  }

  return updated;
}
