import { read, write, uid } from "./storage";
import { getConversation, touchConversation } from "./conversationService";
import { createNotification } from "./notificationService";
import { getOrganization, getOrganizationUserIds } from "./organizationService";

export function getMessages(conversationId) {
  return read("messages", [])
    .filter(m => m.conversationId === conversationId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

/**
 * senderUser: the full logged-in user sending the message (student or
 * organization account). The recipient is resolved from the conversation
 * and notified.
 */
export function sendMessage(conversationId, senderUser, text) {
  const trimmed = (text || "").trim();
  if (!trimmed) throw new Error("Message can't be empty.");
  const conversation = getConversation(conversationId);
  if (!conversation) throw new Error("Conversation not found.");

  const isStudentSender = senderUser.role === "student" && senderUser.id === conversation.studentId;
  const isOrgSender = senderUser.role === "organization" && senderUser.organizationId === conversation.organizationId;
  if (!isStudentSender && !isOrgSender) throw new Error("You don't have access to this conversation.");

  const message = {
    id: uid("message"),
    conversationId,
    senderId: senderUser.id,
    senderRole: senderUser.role,
    message: trimmed,
    createdAt: new Date().toISOString(),
    readAt: null
  };
  write("messages", [...read("messages", []), message]);
  touchConversation(conversationId);

  if (isStudentSender) {
    // Notify every user account on the organization side.
    getOrganizationUserIds(conversation.organizationId).forEach(userId => {
      createNotification({
        userId,
        type: "new_message",
        title: `New message from ${senderUser.name}`,
        message: trimmed.slice(0, 140),
        referenceId: conversationId
      });
    });
  } else {
    createNotification({
      userId: conversation.studentId,
      type: "new_message",
      title: `New message from ${getOrganization(conversation.organizationId)?.name || "an organization"}`,
      message: trimmed.slice(0, 140),
      referenceId: conversationId
    });
  }

  return message;
}

export function markConversationRead(conversationId, readerRole) {
  const messages = read("messages", []);
  write("messages", messages.map(m =>
    m.conversationId === conversationId && m.senderRole !== readerRole && !m.readAt
      ? { ...m, readAt: new Date().toISOString() }
      : m
  ));
}

export function getUnreadCountForConversation(conversationId, readerRole) {
  return getMessages(conversationId).filter(m => m.senderRole !== readerRole && !m.readAt).length;
}
