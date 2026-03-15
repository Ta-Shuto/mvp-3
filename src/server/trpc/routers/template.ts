import { z } from "zod";
import { protectedProcedure, withPermission, router } from "../router";
import { writeAuditLog, AuditEventTypes } from "@/server/services/audit";
import { TRPCError } from "@trpc/server";

export const templateRouter = router({
  // FR-059: テンプレ一覧
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.tenantDb.template.findMany({
      include: {
        updatedBy: { select: { name: true } },
        versions: {
          select: { id: true, version: true, createdAt: true },
          orderBy: { version: "desc" },
          take: 5,
        },
      },
    });
  }),

  // FR-059: ユースケース別テンプレ取得
  getByUseCase: protectedProcedure
    .input(z.object({ useCase: z.enum(["VOLUNTARY_RETIREMENT", "AUDIT"]) }))
    .query(async ({ ctx, input }) => {
      const template = await ctx.tenantDb.template.findFirst({
        where: { useCase: input.useCase },
        include: {
          updatedBy: { select: { name: true } },
        },
      });

      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return template;
    }),

  // FR-060~069: テンプレ更新
  update: withPermission("template:update")
    .input(
      z.object({
        useCase: z.enum(["VOLUNTARY_RETIREMENT", "AUDIT"]),
        preQuestions: z.array(z.object({
          text: z.string(),
          order: z.number(),
          isActive: z.boolean(),
        })).optional(),
        aiChatPrompt: z.string().optional(),
        summaryPrompt: z.string().optional(),
        scriptPrompt: z.string().optional(),
        riskDetectionPrompt: z.string().optional(),
        rephrasingPrompt: z.string().optional(),
        defaultTone: z.enum(["POLITE", "NEUTRAL", "STRONG"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { useCase, ...data } = input;
      const orgId = ctx.session.user.organizationId;

      // Get or create template
      const existing = await ctx.tenantDb.template.findFirst({
        where: { useCase },
      });

      const updateData: Record<string, unknown> = { ...data, updatedById: ctx.session.user.id };
      if (data.preQuestions) {
        updateData.preQuestions = JSON.stringify(data.preQuestions);
      }

      const template = await ctx.prisma.template.upsert({
        where: {
          organizationId_useCase: { organizationId: orgId, useCase },
        },
        create: {
          organizationId: orgId,
          useCase,
          ...updateData,
        },
        update: updateData,
      });

      // FR-070/093: バージョン作成
      const lastVersion = await ctx.prisma.templateVersion.findFirst({
        where: { templateId: template.id },
        orderBy: { version: "desc" },
      });

      await ctx.prisma.templateVersion.create({
        data: {
          templateId: template.id,
          version: (lastVersion?.version ?? 0) + 1,
          content: {
            preQuestions: template.preQuestions,
            aiChatPrompt: template.aiChatPrompt,
            summaryPrompt: template.summaryPrompt,
            scriptPrompt: template.scriptPrompt,
            riskDetectionPrompt: template.riskDetectionPrompt,
            rephrasingPrompt: template.rephrasingPrompt,
            defaultTone: template.defaultTone,
          },
        },
      });

      await writeAuditLog({
        organizationId: orgId,
        userId: ctx.session.user.id,
        eventType: AuditEventTypes.TEMPLATE_UPDATED,
        details: { useCase, updatedFields: Object.keys(data) },
      });

      return template;
    }),

  // FR-093: バージョン一覧
  getVersions: protectedProcedure
    .input(z.object({ useCase: z.enum(["VOLUNTARY_RETIREMENT", "AUDIT"]) }))
    .query(async ({ ctx, input }) => {
      const template = await ctx.tenantDb.template.findFirst({
        where: { useCase: input.useCase },
      });
      if (!template) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.prisma.templateVersion.findMany({
        where: { templateId: template.id },
        orderBy: { version: "desc" },
      });
    }),

  // FR-093: バージョン復元
  restore: withPermission("template:update")
    .input(
      z.object({
        useCase: z.enum(["VOLUNTARY_RETIREMENT", "AUDIT"]),
        versionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const version = await ctx.prisma.templateVersion.findUnique({
        where: { id: input.versionId },
        include: { template: true },
      });
      if (!version) throw new TRPCError({ code: "NOT_FOUND" });

      const content = version.content as Record<string, unknown>;

      const template = await ctx.prisma.template.update({
        where: { id: version.templateId },
        data: {
          preQuestions: content.preQuestions as string,
          aiChatPrompt: content.aiChatPrompt as string,
          summaryPrompt: content.summaryPrompt as string,
          scriptPrompt: content.scriptPrompt as string,
          riskDetectionPrompt: content.riskDetectionPrompt as string,
          rephrasingPrompt: content.rephrasingPrompt as string,
          defaultTone: content.defaultTone as "POLITE" | "NEUTRAL" | "STRONG",
          updatedById: ctx.session.user.id,
        },
      });

      // Mark version as restored
      await ctx.prisma.templateVersion.update({
        where: { id: input.versionId },
        data: {
          restoredBy: ctx.session.user.id,
          restoredAt: new Date(),
        },
      });

      await writeAuditLog({
        organizationId: ctx.session.user.organizationId,
        userId: ctx.session.user.id,
        eventType: AuditEventTypes.TEMPLATE_RESTORED,
        details: { useCase: input.useCase, restoredVersion: version.version },
      });

      return template;
    }),
});
