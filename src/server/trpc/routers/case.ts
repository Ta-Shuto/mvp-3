import { z } from "zod";
import { protectedProcedure, withPermission, router } from "../router";
import { writeAuditLog, AuditEventTypes } from "@/server/services/audit";
import { TRPCError } from "@trpc/server";

const caseCategoryEnum = z.enum(["HARASSMENT", "FRAUD", "SAFETY", "OTHER"]);
const riskLevelEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
const intakeChannelEnum = z.enum(["EMAIL", "PHONE", "WEB_FORM", "IN_PERSON"]);

export const caseRouter = router({
  // 案件一覧
  list: protectedProcedure
    .input(
      z.object({
        useCase: z.enum(["VOLUNTARY_RETIREMENT", "AUDIT"]).optional(),
        status: z.enum(["PRE_INPUT_PENDING", "PRE_INPUT_SUBMITTED", "IN_MEETING", "MEETING_ENDED", "CLOSED"]).optional(),
        progress: z.enum(["RECEPTION", "INITIAL_JUDGMENT", "INVESTIGATION_PLAN", "PREPARATION", "EXECUTION", "RECORDING", "POLICY_DECISION", "COMPLETED"]).optional(),
        caseCategory: caseCategoryEnum.optional(),
        riskLevel: riskLevelEnum.optional(),
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
      if (filters.caseCategory) where.caseCategory = filters.caseCategory;
      if (filters.riskLevel) where.riskLevel = filters.riskLevel;

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
          { caseName: { contains: filters.keyword, mode: "insensitive" } },
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

  // 案件詳細
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

  // 新規案件作成（拡張版）
  create: withPermission("case:create")
    .input(
      z.object({
        useCase: z.enum(["VOLUNTARY_RETIREMENT", "AUDIT"]).default("VOLUNTARY_RETIREMENT"),
        caseName: z.string().min(1),
        caseCategory: caseCategoryEnum,
        riskLevel: riskLevelEnum.optional(),
        intakeChannel: intakeChannelEnum.optional(),
        reportContent: z.string().optional(),
        meetingUrl: z.string().url().optional(),
        scheduledAt: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 会議URL重複チェック
      if (input.meetingUrl) {
        const existing = await ctx.tenantDb.case.findFirst({
          where: {
            meetingUrl: input.meetingUrl,
            status: { in: ["IN_MEETING", "PRE_INPUT_PENDING", "PRE_INPUT_SUBMITTED"] },
          },
        });
        if (existing) {
          return { existingCaseId: existing.id, created: false };
        }
      }

      const newCase = await ctx.tenantDb.case.create({
        data: {
          useCase: input.useCase,
          caseName: input.caseName,
          caseCategory: input.caseCategory,
          riskLevel: input.riskLevel,
          intakeChannel: input.intakeChannel,
          reportContent: input.reportContent,
          meetingUrl: input.meetingUrl,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
          primaryAssigneeId: ctx.session.user.id,
        },
      });

      // Create pre-chat
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

  // AI分析：通報内容からカテゴリ・リスク・案件名を自動分類
  analyzeReport: withPermission("case:create")
    .input(z.object({ reportContent: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        const client = new Anthropic();

        const response = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 512,
          messages: [
            {
              role: "user",
              content: `以下の内部通報・相談内容を分析し、JSON形式で回答してください。

通報内容:
${input.reportContent}

以下のJSON形式で回答してください（JSONのみ、説明不要）:
{
  "caseName": "案件名（簡潔に、20文字以内）",
  "caseCategory": "HARASSMENT" | "FRAUD" | "SAFETY" | "OTHER",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "URGENT",
  "summary": "概要（50文字以内）"
}

カテゴリの判定基準:
- HARASSMENT: パワハラ、セクハラ、いじめ、嫌がらせ等
- FRAUD: 不正経理、横領、情報漏洩、コンプライアンス違反等
- SAFETY: 労災、安全衛生、メンタルヘルス等
- OTHER: 上記に該当しないもの

リスクレベルの判定基準:
- URGENT: 即座の対応が必要（身体的危険、重大な法令違反等）
- HIGH: 早急な対応が必要（継続的なハラスメント、大規模不正等）
- MEDIUM: 通常の対応フロー（単発事象、軽微な違反等）
- LOW: 情報提供レベル（匿名の噂、確認事項等）`,
            },
          ],
        });

        const text = response.content[0].type === "text" ? response.content[0].text : "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          return { caseName: "", caseCategory: "OTHER" as const, riskLevel: "MEDIUM" as const, summary: "" };
        }

        const parsed = JSON.parse(jsonMatch[0]);
        return {
          caseName: parsed.caseName ?? "",
          caseCategory: (["HARASSMENT", "FRAUD", "SAFETY", "OTHER"].includes(parsed.caseCategory) ? parsed.caseCategory : "OTHER") as "HARASSMENT" | "FRAUD" | "SAFETY" | "OTHER",
          riskLevel: (["LOW", "MEDIUM", "HIGH", "URGENT"].includes(parsed.riskLevel) ? parsed.riskLevel : "MEDIUM") as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
          summary: parsed.summary ?? "",
        };
      } catch {
        return { caseName: "", caseCategory: "OTHER" as const, riskLevel: "MEDIUM" as const, summary: "" };
      }
    }),

  // 進捗更新
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

  // 次の作業と期限の登録
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

  // 案件サマリー更新
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

  // 担当割当変更
  updateAssignees: withPermission("case:assign")
    .input(
      z.object({
        id: z.string(),
        assigneeIds: z.array(z.string()),
        primaryAssigneeId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.caseAssignment.deleteMany({ where: { caseId: input.id } });

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

  // 案件クローズ
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

  // 類似案件検索
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

      if (sourceCase.caseCategory) {
        where.caseCategory = sourceCase.caseCategory;
      } else if (sourceCase.category) {
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

  // 参考案件リンク登録
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
