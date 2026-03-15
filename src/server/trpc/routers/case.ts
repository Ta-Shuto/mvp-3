import { z } from "zod";
import { protectedProcedure, withPermission, router } from "../router";
import { writeAuditLog, AuditEventTypes } from "@/server/services/audit";
import { TRPCError } from "@trpc/server";

export const caseRouter = router({
  // FR-013, FR-022, FR-107~109: 案件一覧
  list: protectedProcedure
    .input(
      z.object({
        useCase: z.enum(["VOLUNTARY_RETIREMENT", "AUDIT"]).optional(),
        status: z.enum(["PRE_INPUT_PENDING", "PRE_INPUT_SUBMITTED", "IN_MEETING", "MEETING_ENDED", "CLOSED"]).optional(),
        progress: z.enum(["RECEPTION", "INITIAL_JUDGMENT", "INVESTIGATION_PLAN", "PREPARATION", "EXECUTION", "RECORDING", "POLICY_DECISION", "COMPLETED"]).optional(),
        keyword: z.string().optional(),
        assigneeId: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        page: z.number().default(1),
        limit: z.number().default(20),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const filters = (input ?? {}) as any;
      const { user } = ctx.session;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};

      if (filters.useCase) where.useCase = filters.useCase;
      if (filters.status) where.status = filters.status;
      if (filters.progress) where.progress = filters.progress;

      // FR-113: 案件閲覧範囲制御
      if (user.caseViewScope === "assigned" && user.role === "INTERVIEWER") {
        where.OR = [
          { primaryAssigneeId: user.id },
          { assignments: { some: { userId: user.id } } },
        ];
      }

      if (filters.keyword) {
        where.OR = [
          ...(Array.isArray(where.OR) ? where.OR : []),
          { category: { contains: filters.keyword, mode: "insensitive" } },
          { issue: { contains: filters.keyword, mode: "insensitive" } },
          { conclusion: { contains: filters.keyword, mode: "insensitive" } },
          { action: { contains: filters.keyword, mode: "insensitive" } },
          { referencePoint: { contains: filters.keyword, mode: "insensitive" } },
          { nextTask: { contains: filters.keyword, mode: "insensitive" } },
        ];
      }

      if (filters.assigneeId) {
        where.primaryAssigneeId = filters.assigneeId;
      }

      if (filters.dateFrom || filters.dateTo) {
        where.createdAt = {};
        if (filters.dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(filters.dateFrom);
        if (filters.dateTo) (where.createdAt as Record<string, unknown>).lte = new Date(filters.dateTo);
      }

      const skip = ((filters.page ?? 1) - 1) * (filters.limit ?? 20);

      const [cases, total] = await Promise.all([
        ctx.tenantDb.case.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          skip,
          take: filters.limit ?? 20,
          include: {
            primaryAssignee: { select: { id: true, name: true } },
            meetings: { select: { id: true } },
          },
        }),
        ctx.tenantDb.case.count({ where }),
      ]);

      return {
        cases: cases.map((c: any) => ({
          ...c,
          meetingCount: c.meetings?.length ?? 0,
          meetings: undefined,
        })),
        total,
        page: filters.page ?? 1,
        totalPages: Math.ceil(total / (filters.limit ?? 20)),
      };
    }),

  // FR-019, FR-104: 案件詳細
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const caseData = await ctx.tenantDb.case.findFirst({
        where: { id: input.id },
        include: {
          primaryAssignee: { select: { id: true, name: true } },
          assignments: { include: { user: { select: { id: true, name: true, email: true } } } },
          preChat: { select: { id: true, token: true, isSubmitted: true, submittedAt: true } },
          meetings: { select: { id: true, startedAt: true, endedAt: true, endReason: true } },
          scriptGeneration: { select: { id: true, updatedAt: true } },
          progressHistory: {
            include: { updatedBy: { select: { name: true } } },
            orderBy: { createdAt: "desc" },
          },
          referencesFrom: {
            include: { toCase: { select: { id: true, category: true, issue: true } } },
          },
        },
      });

      if (!caseData) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Case not found" });
      }

      return caseData;
    }),

  // FR-015~018: 新規案件作成
  create: withPermission("case:create")
    .input(
      z.object({
        useCase: z.enum(["VOLUNTARY_RETIREMENT", "AUDIT"]),
        meetingUrl: z.string().url(),
        scheduledAt: z.string().datetime(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // FR-018: 会議URL重複チェック
      const existing = await ctx.tenantDb.case.findFirst({
        where: {
          meetingUrl: input.meetingUrl,
          status: { in: ["IN_MEETING", "PRE_INPUT_PENDING", "PRE_INPUT_SUBMITTED"] },
        },
      });

      if (existing) {
        return { existingCaseId: existing.id, created: false };
      }

      const newCase = await ctx.tenantDb.case.create({
        data: {
          useCase: input.useCase,
          meetingUrl: input.meetingUrl,
          scheduledAt: new Date(input.scheduledAt),
          primaryAssigneeId: ctx.session.user.id,
        },
      });

      // Create pre-chat with auto-generated URL token (FR-020)
      await ctx.prisma.preChat.create({
        data: { caseId: newCase.id },
      });

      // Create assignment
      await ctx.prisma.caseAssignment.create({
        data: { caseId: newCase.id, userId: ctx.session.user.id },
      });

      await writeAuditLog({
        organizationId: ctx.session.user.organizationId,
        userId: ctx.session.user.id,
        caseId: newCase.id,
        eventType: AuditEventTypes.CASE_CREATED,
      });

      return { caseId: newCase.id, created: true };
    }),

  // FR-104: 進捗更新
  updateProgress: withPermission("case:update")
    .input(
      z.object({
        id: z.string(),
        progress: z.enum([
          "RECEPTION", "INITIAL_JUDGMENT", "INVESTIGATION_PLAN",
          "PREPARATION", "EXECUTION", "RECORDING", "POLICY_DECISION", "COMPLETED",
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const current = await ctx.tenantDb.case.findFirst({ where: { id: input.id } });
      if (!current) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.prisma.case.update({
        where: { id: input.id },
        data: { progress: input.progress },
      });

      await ctx.prisma.progressHistory.create({
        data: {
          caseId: input.id,
          previousValue: current.progress,
          currentValue: input.progress,
          updatedById: ctx.session.user.id,
        },
      });

      await writeAuditLog({
        organizationId: ctx.session.user.organizationId,
        userId: ctx.session.user.id,
        caseId: input.id,
        eventType: AuditEventTypes.PROGRESS_UPDATED,
        details: { from: current.progress, to: input.progress },
      });

      return updated;
    }),

  // FR-105: 次の作業と期限の登録
  updateNextTask: withPermission("case:update")
    .input(
      z.object({
        id: z.string(),
        nextTask: z.string().optional(),
        deadline: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.case.update({
        where: { id: input.id },
        data: {
          nextTask: input.nextTask,
          deadline: input.deadline ? new Date(input.deadline) : undefined,
        },
      });
    }),

  // FR-106: 案件サマリー更新
  updateSummary: withPermission("case:update")
    .input(
      z.object({
        id: z.string(),
        category: z.string().optional(),
        issue: z.string().optional(),
        conclusion: z.string().optional(),
        action: z.string().optional(),
        referencePoint: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.case.update({
        where: { id },
        data,
      });
    }),

  // FR-021: 担当割当変更
  updateAssignees: withPermission("case:assign")
    .input(
      z.object({
        id: z.string(),
        assigneeIds: z.array(z.string()),
        primaryAssigneeId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Remove existing assignments
      await ctx.prisma.caseAssignment.deleteMany({ where: { caseId: input.id } });

      // Create new assignments
      await ctx.prisma.caseAssignment.createMany({
        data: input.assigneeIds.map((userId) => ({
          caseId: input.id,
          userId,
        })),
      });

      if (input.primaryAssigneeId) {
        await ctx.prisma.case.update({
          where: { id: input.id },
          data: { primaryAssigneeId: input.primaryAssigneeId },
        });
      }

      await writeAuditLog({
        organizationId: ctx.session.user.organizationId,
        userId: ctx.session.user.id,
        caseId: input.id,
        eventType: AuditEventTypes.ASSIGNMENT_CHANGED,
        details: { assigneeIds: input.assigneeIds },
      });

      return { success: true };
    }),

  // FR-056: 案件クローズ
  close: withPermission("case:close")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.prisma.case.update({
        where: { id: input.id },
        data: { status: "CLOSED", closedAt: new Date() },
      });

      await writeAuditLog({
        organizationId: ctx.session.user.organizationId,
        userId: ctx.session.user.id,
        caseId: input.id,
        eventType: AuditEventTypes.CASE_CLOSED,
      });

      return updated;
    }),

  // FR-111: 類似案件検索
  findSimilar: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const sourceCase = await ctx.tenantDb.case.findFirst({
        where: { id: input.id },
      });
      if (!sourceCase) throw new TRPCError({ code: "NOT_FOUND" });

      const where: Record<string, unknown> = {
        id: { not: input.id },
      };

      if (sourceCase.category) {
        where.category = sourceCase.category;
      }

      return ctx.tenantDb.case.findMany({
        where,
        take: 10,
        orderBy: { updatedAt: "desc" },
        include: {
          primaryAssignee: { select: { id: true, name: true } },
        },
      });
    }),

  // FR-112: 参考案件リンク登録
  addReference: withPermission("case:update")
    .input(
      z.object({
        fromCaseId: z.string(),
        toCaseId: z.string(),
        reason: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.caseReference.create({
        data: input,
      });
    }),
});
