import { read, write, uid } from "./storage";
import { getTask } from "./taskService";
import { getOrganization } from "./organizationService";

export function getProjects() { return read("projects", []); }
export function getProject(id) { return getProjects().find(p => p.id === id) || null; }

export function createProject({ taskId, studentId, organizationId }) {
  const task = getTask(taskId);
  const organization = getOrganization(organizationId);
  if (!task) throw new Error("Task not found.");
  if (task.organizationId !== organizationId) throw new Error("Task and organization do not match.");
  if (!organization) throw new Error("Organization not found.");

  const existing = getProjects().find(
    p => p.taskId === taskId && p.studentId === studentId && p.organizationId === organizationId
  );
  if (existing) return existing;

  const project = {
    id: uid("project"),
    taskId,
    studentId,
    organizationId,
    status: "Active",
    createdAt: new Date().toISOString(),
    completedAt: null
  };
  write("projects", [...getProjects(), project]);
  return project;
}

export function saveSubmission(projectId, data) {
  if (!getProject(projectId)) throw new Error("Project not found.");
  const submissions = read("submissions", []);
  const existing = submissions.find(s => s.projectId === projectId);
  const submission = {
    id: existing?.id || uid("submission"),
    projectId,
    ...data,
    status: "Submitted",
    submittedAt: new Date().toISOString()
  };
  write("submissions", [...submissions.filter(s => s.projectId !== projectId), submission]);
  return submission;
}

export function getSubmission(projectId) {
  return read("submissions", []).find(s => s.projectId === projectId) || null;
}

export function reviewProject(projectId, status, feedback = "") {
  if (!["Completed", "Changes Requested"].includes(status)) {
    throw new Error("Invalid review status.");
  }
  const projects = getProjects();
  const project = projects.find(p => p.id === projectId);
  if (!project) throw new Error("Project not found.");

  const updated = {
    ...project,
    status,
    completedAt: status === "Completed" ? new Date().toISOString() : null
  };
  write("projects", projects.map(p => p.id === projectId ? updated : p));

  const submissions = read("submissions", []);
  write(
    "submissions",
    submissions.map(s => s.projectId === projectId ? { ...s, status, feedback } : s)
  );
  return updated;
}
