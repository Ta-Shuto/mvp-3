import { z } from "zod";
import { protectedProcedure, withPermission, router } from "../router";
import { writeAuditLog, AuditEventTypes } from "@/server/services/audit";
import { TRPCError } from "@trpc/server";

export const meetingRouter = router({
  // 面談取得
  getByCase: protectedProcedure
    .input(z.object({ caseId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.meeting.findMany({
        where: { caseId: input.caseId },
        include: {
          transcripts: { orderBy: { timestamp: "asc" } },
          riskItems: { orderBy: { timestamp: "asc" } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  // FR-049: 面談終了
  end: withPermission("meeting:manage")
    .input(z.object({ meetingId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const meeting = await ctx.prisma.meeting.findUnique({
        where: { id: input.meetingId },
        include: { case: true },
      });
      if (!meeting) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.prisma.meeting.update({
        where: { id: input.meetingId },
        data: {
          endedAt: new Date(),
          endReason: "MANUAL",
        },
      });

      await ctx.prisma.case.update({
        where: { id: meeting.caseId },
        data: { status: "MEETING_ENDED" },
      });

      await writeAuditLog({
        organizationId: ctx.session.user.organizationId,
        userId: ctx.session.user.id,
        caseId: meeting.caseId,
        eventType: AuditEventTypes.MEETING_ENDED,
        details: { reason: "MANUAL" },
      });

      return updated;
    }),

  // FR-054: 文字起こし検索
  searchTranscripts: protectedProcedure
    .input(
      z.object({
        meetingId: z.string(),
        keyword: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.transcript.findMany({
        where: {
          meetingId: input.meetingId,
          text: { contains: input.keyword, mode: "insensitive" },
        },
        orderBy: { timestamp: "asc" },
      });
    }),

  // FR-055: リスク一覧
  getRiskItems: protectedProcedure
    .input(z.object({ meetingId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.riskItem.findMany({
        where: { meetingId: input.meetingId },
        orderBy: { timestamp: "asc" },
      });
    }),

  // リスク項目の採択/却下
  updateRiskItemStatus: withPermission("meeting:manage")
    .input(
      z.object({
        riskItemId: z.string(),
        status: z.enum(["ACCEPTED", "REJECTED"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.riskItem.update({
        where: { id: input.riskItemId },
        data: { status: input.status },
      });
    }),

  // FR-114: 面談要点の取得・更新
  getSummary: protectedProcedure
    .input(z.object({ meetingId: z.string() }))
    .query(async ({ ctx, input }) => {
      const meeting = await ctx.prisma.meeting.findUnique({
        where: { id: input.meetingId },
        select: { meetingSummary: true },
      });
      return meeting?.meetingSummary;
    }),

  updateSummary: withPermission("meeting:manage")
    .input(
      z.object({
        meetingId: z.string(),
        summary: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.meeting.update({
        where: { id: input.meetingId },
        data: { meetingSummary: input.summary },
      });
    }),

  // FR-110: 面談履歴一覧（横断検索）
  listHistory: protectedProcedure
    .input(
      z.object({
        keyword: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        page: z.number().default(1),
        limit: z.number().default(20),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const filters = (input ?? {}) as any;
      const orgId = ctx.session.user.organizationId;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {
        case: { organizationId: orgId },
        endedAt: { not: null },
      };

      if (filters.dateFrom || filters.dateTo) {
        where.startedAt = {};
        if (filters.dateFrom) (where.startedAt as Record<string, unknown>).gte = new Date(filters.dateFrom);
        if (filters.dateTo) (where.startedAt as Record<string, unknown>).lte = new Date(filters.dateTo);
      }

      if (filters.keyword) {
        where.meetingSummary = { contains: filters.keyword, mode: "insensitive" };
      }

      const skip = ((filters.page ?? 1) - 1) * (filters.limit ?? 20);

      const [meetings, total] = await Promise.all([
        ctx.prisma.meeting.findMany({
          where,
          orderBy: { startedAt: "desc" },
          skip,
          take: filters.limit ?? 20,
          include: {
            case: {
              select: {
                id: true,
                category: true,
                primaryAssignee: { select: { name: true } },
              },
            },
          },
        }),
        ctx.prisma.meeting.count({ where }),
      ]);

      return {
        meetings,
        total,
        page: filters.page ?? 1,
        totalPages: Math.ceil(total / (filters.limit ?? 20)),
      };
    }),
});
