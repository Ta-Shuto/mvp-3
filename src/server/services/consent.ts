/**
 * Consent Management Service (FR-088~090)
 *
 * FR-088: 同意取得設定（no_entry / record_only / proceed）
 * FR-089: 同意ログの記録（日時、対象、方法、バージョン、会議URL）
 * FR-090: インアプリ同意（notificationSettings.inAppConsent）
 */

import prisma from "@/server/db/client";
import { writeAuditLog } from "./audit";

interface ConsentSettings {
  noConsentAction: "no_entry" | "record_only" | "proceed";
  logItems: string[];
}

interface ConsentLogEntry {
  organizationId: string;
  caseId: string;
  meetingId?: string;
  userId?: string;
  method: "pre_chat" | "in_app" | "verbal";
  meetingUrl?: string;
  version?: string;
}

/**
 * Get consent settings for an organization
 */
export async function getConsentSettings(organizationId: string): Promise<ConsentSettings> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { consentSettings: true },
  });

  const settings = org?.consentSettings as any;
  if (!settings) {
    return { noConsentAction: "no_entry", logItems: ["datetime", "target", "method", "version", "meetingUrl"] };
  }

  return typeof settings === "string" ? JSON.parse(settings) : settings;
}

/**
 * FR-089: Record consent log
 */
export async function recordConsentLog(entry: ConsentLogEntry): Promise<void> {
  const settings = await getConsentSettings(entry.organizationId);

  const logData: Record<string, unknown> = {};

  if (settings.logItems.includes("datetime")) {
    logData.datetime = new Date().toISOString();
  }
  if (settings.logItems.includes("target") && entry.caseId) {
    logData.caseId = entry.caseId;
  }
  if (settings.logItems.includes("method")) {
    logData.method = entry.method;
  }
  if (settings.logItems.includes("version") && entry.version) {
    logData.version = entry.version;
  }
  if (settings.logItems.includes("meetingUrl") && entry.meetingUrl) {
    logData.meetingUrl = entry.meetingUrl;
  }

  await writeAuditLog({
    organizationId: entry.organizationId,
    userId: entry.userId,
    caseId: entry.caseId,
    eventType: "consent_recorded",
    details: logData,
  });
}

/**
 * FR-088: Check if meeting can proceed based on consent status
 */
export async function checkConsentForMeeting(
  organizationId: string,
  caseId: string
): Promise<{ canProceed: boolean; action: string; hasConsent: boolean }> {
  const settings = await getConsentSettings(organizationId);

  // Check if pre-chat consent was given
  const preChat = await prisma.preChat.findUnique({
    where: { caseId },
    select: { consentAt: true },
  });

  const hasConsent = !!preChat?.consentAt;

  if (hasConsent) {
    return { canProceed: true, action: "proceed", hasConsent: true };
  }

  switch (settings.noConsentAction) {
    case "no_entry":
      return { canProceed: false, action: "no_entry", hasConsent: false };
    case "record_only":
      return { canProceed: true, action: "record_only", hasConsent: false };
    case "proceed":
      return { canProceed: true, action: "proceed", hasConsent: false };
    default:
      return { canProceed: false, action: "no_entry", hasConsent: false };
  }
}
