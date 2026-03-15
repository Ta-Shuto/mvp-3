import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth/config";
import prisma from "@/server/db/client";
import { createBotWithRetry } from "@/server/services/meeting-bot";
import { checkConsentForMeeting, recordConsentLog } from "@/server/services/consent";
import { writeAuditLog, AuditEventTypes } from "@/server/services/audit";

/**
 * POST /api/meeting/start
 * Starts a meeting: creates a Meeting record, triggers Bot to join the call,
 * and validates consent status.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  const { caseId } = await req.json();

  if (!caseId) {
    return NextResponse.json({ error: "caseId required" }, { status: 400 });
  }

  try {
    // Get case data
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        organization: {
          select: {
            id: true,
            retrySettings: true,
            notificationSettings: true,
            autoEndSettings: true,
          },
        },
      },
    });

    if (!caseData) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    // Tenant check
    if (caseData.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // FR-088: Check consent
    const consentCheck = await checkConsentForMeeting(caseData.organizationId, caseId);
    if (!consentCheck.canProceed) {
      return NextResponse.json(
        { error: "同意が取得されていないため、面談を開始できません。", action: consentCheck.action },
        { status: 403 }
      );
    }

    // Create meeting record
    const meeting = await prisma.meeting.create({
      data: {
        caseId,
        startedAt: new Date(),
      },
    });

    // Update case status
    await prisma.case.update({
      where: { id: caseId },
      data: { status: "IN_MEETING" },
    });

    // FR-081: Create bot and send to meeting
    let botId: string | null = null;
    if (caseData.meetingUrl) {
      const retrySettings = (caseData.organization as any).retrySettings;
      let parsed = { maxRetries: 3, retryIntervalSeconds: 30 };
      try {
        parsed = typeof retrySettings === "string" ? JSON.parse(retrySettings) : retrySettings;
      } catch { /* use defaults */ }

      const notifSettings = (caseData.organization as any).notificationSettings;
      let notifParsed: any = {};
      try {
        notifParsed = typeof notifSettings === "string" ? JSON.parse(notifSettings) : notifSettings;
      } catch { /* ignore */ }

      try {
        const result = await createBotWithRetry(
          {
            meetingUrl: caseData.meetingUrl,
            botName: notifParsed.botDisplayName ? "面談サポートBot" : undefined,
            chatMessage: notifParsed.botChatMessage ? "面談サポートBotが参加しました。録音を開始します。" : undefined,
            maxParticipants: 5,
          },
          parsed
        );
        botId = result.botId;
      } catch (error) {
        console.error("[Meeting] Bot creation failed:", error);
        // Meeting continues without bot
      }
    }

    // FR-089: Record consent log
    if (consentCheck.hasConsent) {
      await recordConsentLog({
        organizationId: caseData.organizationId,
        caseId,
        meetingId: meeting.id,
        userId: user.id,
        method: "pre_chat",
        meetingUrl: caseData.meetingUrl ?? undefined,
      });
    }

    // Audit log
    await writeAuditLog({
      organizationId: caseData.organizationId,
      userId: user.id,
      caseId,
      eventType: AuditEventTypes.MEETING_STARTED,
      details: {
        meetingId: meeting.id,
        botId,
        consentStatus: consentCheck.action,
      },
    });

    return NextResponse.json({
      meetingId: meeting.id,
      botId,
      consentStatus: consentCheck.action,
    });
  } catch (error) {
    console.error("[Meeting] Start error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
