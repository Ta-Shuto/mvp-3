/**
 * Template Snapshot Service (FR-092)
 *
 * Controls when template changes take effect on cases.
 * Templates are snapshotted at specific points in the case lifecycle:
 * - "on_create": When the case is created (default)
 * - "on_meeting_start": When the meeting starts
 * - "always_latest": Always use the latest template (no snapshot)
 *
 * The snapshot is stored in Case.templateSnapshot as JSON.
 */

import prisma from "@/server/db/client";

type SnapshotTiming = "on_create" | "on_meeting_start" | "always_latest";

/**
 * Take a snapshot of the current template for a case
 */
export async function createTemplateSnapshot(
  caseId: string,
  useCase: string
): Promise<void> {
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: { organizationId: true },
  });

  if (!caseData) return;

  const template = await prisma.template.findFirst({
    where: {
      organizationId: caseData.organizationId,
      useCase: useCase as any,
    },
  });

  if (!template) return;

  const snapshot = {
    templateId: template.id,
    preQuestions: template.preQuestions,
    aiChatPrompt: template.aiChatPrompt,
    summaryPrompt: template.summaryPrompt,
    scriptPrompt: template.scriptPrompt,
    riskDetectionPrompt: template.riskDetectionPrompt,
    rephrasingPrompt: template.rephrasingPrompt,
    defaultTone: template.defaultTone,
    snapshotAt: new Date().toISOString(),
  };

  await prisma.case.update({
    where: { id: caseId },
    data: { templateSnapshot: snapshot as any },
  });
}

/**
 * FR-092: Refresh template snapshot if the timing setting requires it
 */
export async function refreshSnapshotIfNeeded(
  caseId: string,
  trigger: "meeting_start"
): Promise<void> {
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      organizationId: true,
      useCase: true,
      templateSnapshot: true,
    },
  });

  if (!caseData) return;

  // Check organization's template timing setting
  const org = await prisma.organization.findUnique({
    where: { id: caseData.organizationId },
    select: { notificationSettings: true },
  });

  const settings = org?.notificationSettings as any;
  let timing: SnapshotTiming = "on_create";
  try {
    const parsed = typeof settings === "string" ? JSON.parse(settings) : settings;
    timing = parsed?.templateApplyTiming || "on_create";
  } catch { /* use default */ }

  if (timing === "always_latest" || (timing === "on_meeting_start" && trigger === "meeting_start")) {
    await createTemplateSnapshot(caseId, caseData.useCase);
  }
}

/**
 * Get the effective template for a case
 * If "always_latest", fetch from the template table directly
 * Otherwise, use the stored snapshot
 */
export async function getEffectiveTemplate(caseId: string): Promise<any> {
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      organizationId: true,
      useCase: true,
      templateSnapshot: true,
    },
  });

  if (!caseData) return null;

  // Check if we should use latest
  const org = await prisma.organization.findUnique({
    where: { id: caseData.organizationId },
    select: { notificationSettings: true },
  });

  const settings = org?.notificationSettings as any;
  let timing: SnapshotTiming = "on_create";
  try {
    const parsed = typeof settings === "string" ? JSON.parse(settings) : settings;
    timing = parsed?.templateApplyTiming || "on_create";
  } catch { /* use default */ }

  if (timing === "always_latest") {
    const template = await prisma.template.findFirst({
      where: {
        organizationId: caseData.organizationId,
        useCase: caseData.useCase as any,
      },
    });
    return template;
  }

  return caseData.templateSnapshot;
}
