/**
 * FR-058: 自動削除バッチジョブ
 *
 * 法人ごとの保持期間(retentionDays)に基づいて、
 * 期限切れの案件データを自動削除する。
 *
 * 実行: npx tsx src/server/batch/auto-delete.ts
 * cron: 毎日深夜に実行推奨（0 3 * * *）
 */

import { PrismaClient } from "@/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/mvp3";
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  console.log("[AutoDelete] Starting auto-deletion batch...");

  try {
    // Get all organizations with their retention settings
    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true, retentionDays: true },
    });

    for (const org of orgs) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - org.retentionDays);

      console.log(`[AutoDelete] Org: ${org.name} (${org.id}), retention: ${org.retentionDays} days, cutoff: ${cutoffDate.toISOString()}`);

      // Find cases that are closed and past retention period
      const expiredCases = await prisma.case.findMany({
        where: {
          organizationId: org.id,
          status: "CLOSED",
          closedAt: { lt: cutoffDate },
        },
        select: { id: true },
      });

      if (expiredCases.length === 0) {
        console.log(`[AutoDelete] No expired cases for ${org.name}`);
        continue;
      }

      const caseIds = expiredCases.map((c) => c.id);
      console.log(`[AutoDelete] Deleting ${caseIds.length} expired cases for ${org.name}`);

      // Delete in order to respect foreign key constraints
      // 1. Delete meeting-related data
      const meetings = await prisma.meeting.findMany({
        where: { caseId: { in: caseIds } },
        select: { id: true },
      });
      const meetingIds = meetings.map((m) => m.id);

      if (meetingIds.length > 0) {
        await prisma.riskItem.deleteMany({ where: { meetingId: { in: meetingIds } } });
        await prisma.transcript.deleteMany({ where: { meetingId: { in: meetingIds } } });
        await prisma.meeting.deleteMany({ where: { id: { in: meetingIds } } });
      }

      // 2. Delete pre-chat data
      const preChats = await prisma.preChat.findMany({
        where: { caseId: { in: caseIds } },
        select: { id: true },
      });
      const preChatIds = preChats.map((p) => p.id);

      if (preChatIds.length > 0) {
        await prisma.aIChatMessage.deleteMany({ where: { preChatId: { in: preChatIds } } });
        await prisma.preChatAnswer.deleteMany({ where: { preChatId: { in: preChatIds } } });
        await prisma.preChat.deleteMany({ where: { id: { in: preChatIds } } });
      }

      // 3. Delete script generation data
      const scriptGens = await prisma.scriptGeneration.findMany({
        where: { caseId: { in: caseIds } },
        select: { id: true },
      });
      const scriptGenIds = scriptGens.map((s) => s.id);

      if (scriptGenIds.length > 0) {
        await prisma.scriptVersion.deleteMany({ where: { scriptGenerationId: { in: scriptGenIds } } });
        await prisma.scriptGeneration.deleteMany({ where: { id: { in: scriptGenIds } } });
      }

      // 4. Delete case references and assignments
      await prisma.caseReference.deleteMany({
        where: { OR: [{ fromCaseId: { in: caseIds } }, { toCaseId: { in: caseIds } }] },
      });
      await prisma.caseAssignment.deleteMany({ where: { caseId: { in: caseIds } } });
      await prisma.progressHistory.deleteMany({ where: { caseId: { in: caseIds } } });

      // 5. Delete cases (audit logs are preserved - FR-074)
      await prisma.case.deleteMany({ where: { id: { in: caseIds } } });

      // Log the deletion
      await prisma.auditLog.create({
        data: {
          organizationId: org.id,
          eventType: "auto_deletion",
          details: {
            deletedCaseCount: caseIds.length,
            retentionDays: org.retentionDays,
            cutoffDate: cutoffDate.toISOString(),
          } as any,
        },
      });

      console.log(`[AutoDelete] Deleted ${caseIds.length} cases for ${org.name}`);
    }

    console.log("[AutoDelete] Batch completed successfully");
  } catch (error) {
    console.error("[AutoDelete] Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
