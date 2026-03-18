import prisma from "@/server/db/client";

interface AuditLogEntry {
  organizationId: string;
  userId?: string;
  caseId?: string;
  eventType: string;
  details?: Record<string, unknown>;
}

/**
 * Append-only audit log writer (FR-072, FR-074).
 * AuditLog records cannot be edited or deleted.
 */
export async function writeAuditLog(entry: AuditLogEntry) {
  return prisma.auditLog.create({
    data: {
      organizationId: entry.organizationId,
      userId: entry.userId,
      caseId: entry.caseId,
      eventType: entry.eventType,
      details: (entry.details as any) ?? undefined,
    },
  });
}

// Event type constants
export const AuditEventTypes = {
  PRE_CHAT_VIEWED: "pre_chat_viewed",
  SUMMARY_VIEWED: "summary_viewed",
  SCRIPT_VIEWED: "script_viewed",
  SCRIPT_GENERATED: "script_generated",
  CASE_CREATED: "case_created",
  CASE_UPDATED: "case_updated",
  CASE_CLOSED: "case_closed",
  PROGRESS_UPDATED: "progress_updated",
  TEMPLATE_UPDATED: "template_updated",
  TEMPLATE_RESTORED: "template_restored",
  ASSIGNMENT_CHANGED: "assignment_changed",
  PRE_CHAT_SUBMITTED: "pre_chat_submitted",
  PRE_CHAT_URL_REISSUED: "pre_chat_url_reissued",
  MEETING_STARTED: "meeting_started",
  MEETING_ENDED: "meeting_ended",
  EXPORT_DOWNLOADED: "export_downloaded",
  LOGIN: "login",
  LOGOUT: "logout",
  USER_INVITED: "user_invited",
  SETTINGS_UPDATED: "settings_updated",
  CONSENT_RECORDED: "consent_recorded",
  FILE_UPLOADED: "file_uploaded",
  FILE_DELETED: "file_deleted",
  NOTIFICATION_SENT: "notification_sent",
} as const;
