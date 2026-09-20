import { read, write, uid } from "./storage";

export function getNotifications(userId) {
  return read("notifications", [])
    .filter(n => n.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getUnreadCount(userId) {
  return getNotifications(userId).filter(n => !n.isRead).length;
}

export function createNotification({ userId, type, title, message, referenceId = null }) {
  if (!userId) return null;
  const notifications = read("notifications", []);
  const entry = {
    id: uid("notification"),
    userId,
    type,
    title,
    message,
    referenceId,
    isRead: false,
    createdAt: new Date().toISOString()
  };
  write("notifications", [...notifications, entry]);
  return entry;
}

export function markRead(id) {
  const notifications = read("notifications", []);
  write("notifications", notifications.map(n => n.id === id ? { ...n, isRead: true } : n));
}

export function markAllRead(userId) {
  const notifications = read("notifications", []);
  write("notifications", notifications.map(n => n.userId === userId ? { ...n, isRead: true } : n));
}
