import { z } from "zod";
import { protectedProcedure, withPermission, router } from "../router";
import { writeAuditLog, AuditEventTypes } from "@/server/services/audit";
import { TRPCError } from "@trpc/server";

export const scriptGenerationRouter = router({
  // Get script generation for a case
  getByCase: protectedProcedure
    .input(z.object({ caseId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.scriptGeneration.findUnique({
        where: { caseId: input.caseId },
        include: {
          versions: {
            orderBy: { version: "desc" },
            include: { editedBy: { select: { name: true } } },
          },
        },
      });
    }),

  // FR-116, FR-117: 入力の保存
  saveInputs: withPermission("case:update")
    .input(
      z.object({
        caseId: z.string(),
        inquiryEmailText: z.string().optional(),
        preAiResponseText: z.string().optional(),
        usePreAiResponse: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { caseId, ...data } = input;

      return ctx.prisma.scriptGeneration.upsert({
        where: { caseId },
        create: { caseId, ...data },
        update: data,
      });
    }),

  // FR-118: 台本生成
  generate: withPermission("case:update")
    .input(z.object({ caseId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const scriptGen = await ctx.prisma.scriptGeneration.findUnique({
        where: { caseId: input.caseId },
      });
      if (!scriptGen) throw new TRPCError({ code: "NOT_FOUND", message: "入力データがありません" });

      // FR-120: 過去案件の傾向算出（同一法人内）
      const pastCases = await ctx.tenantDb.case.findMany({
        where: {
          id: { not: input.caseId },
          status: { in: ["MEETING_ENDED", "CLOSED"] },
        },
        select: {
          category: true,
          issue: true,
          conclusion: true,
          action: true,
          referencePoint: true,
        },
        take: 20,
      } as any);

      const pastCasesSummary = (pastCases as any[])
        .map((c: any) => `カテゴリ: ${c.category ?? "不明"}, 争点: ${c.issue ?? "—"}, 結論: ${c.conclusion ?? "—"}, 対応: ${c.action ?? "—"}`)
        .join("\n");

      // Get template prompt
      const caseData = await ctx.prisma.case.findUnique({
        where: { id: input.caseId },
        select: { templateSnapshot: true },
      });
      const templateSnapshot = caseData?.templateSnapshot as any;
      const scriptPrompt = templateSnapshot?.scriptPrompt ?? "";

      const { generateScript } = await import("@/server/services/ai");

      const result = await generateScript(
        scriptGen.inquiryEmailText ?? "",
        scriptGen.preAiResponseText,
        scriptGen.usePreAiResponse,
        pastCasesSummary,
        scriptPrompt
      );

      // Save generated script
      const updated = await ctx.prisma.scriptGeneration.update({
        where: { caseId: input.caseId },
        data: {
          generatedScript: result as any,
          generationLog: {
            generator: ctx.session.user.id,
            timestamp: new Date().toISOString(),
            inputsUsed: {
              inquiryEmail: !!scriptGen.inquiryEmailText,
              preAiResponse: scriptGen.usePreAiResponse,
            },
            pastCasesCount: (pastCases as any[]).length,
          } as any,
        },
      });

      // FR-119: Create initial version
      const lastVersion = await ctx.prisma.scriptVersion.findFirst({
        where: { scriptGenerationId: updated.id },
        orderBy: { version: "desc" },
      });

      await ctx.prisma.scriptVersion.create({
        data: {
          scriptGenerationId: updated.id,
          version: (lastVersion?.version ?? 0) + 1,
          content: result as any,
          editedById: ctx.session.user.id,
        },
      });

      // FR-122: 台本生成ログ
      await writeAuditLog({
        organizationId: ctx.session.user.organizationId,
        userId: ctx.session.user.id,
        caseId: input.caseId,
        eventType: AuditEventTypes.SCRIPT_GENERATED,
        details: {
          pastCasesCount: (pastCases as any[]).length,
          usedPreAiResponse: scriptGen.usePreAiResponse,
        },
      });

      return updated;
    }),

  // FR-119: 生成結果の編集と保存
  saveVersion: withPermission("case:update")
    .input(
      z.object({
        caseId: z.string(),
        content: z.object({
          scenarios: z.string(),
          issues: z.string(),
          questions: z.string(),
          pastTrends: z.string(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const scriptGen = await ctx.prisma.scriptGeneration.findUnique({
        where: { caseId: input.caseId },
      });
      if (!scriptGen) throw new TRPCError({ code: "NOT_FOUND" });

      // Update current script
      await ctx.prisma.scriptGeneration.update({
        where: { caseId: input.caseId },
        data: { generatedScript: input.content as any },
      });

      // Create new version
      const lastVersion = await ctx.prisma.scriptVersion.findFirst({
        where: { scriptGenerationId: scriptGen.id },
        orderBy: { version: "desc" },
      });

      return ctx.prisma.scriptVersion.create({
        data: {
          scriptGenerationId: scriptGen.id,
          version: (lastVersion?.version ?? 0) + 1,
          content: input.content as any,
          editedById: ctx.session.user.id,
        },
      });
    }),
});
