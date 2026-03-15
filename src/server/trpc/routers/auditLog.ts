import { z } from "zod";
import { withPermission, router } from "../router";

export const auditLogRouter = router({
  // FR-072, FR-073: 監査ログ一覧（フィルタ検索付き）
  list: withPermission("audit_log:read")
    .input(
      z.object({
        userId: z.string().optional(),
        caseId: z.string().optional(),
        eventType: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        page: z.number().default(1),
        limit: z.number().default(50),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const filters = (input ?? {}) as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};

      if (filters.userId) where.userId = filters.userId;
      if (filters.caseId) where.caseId = filters.caseId;
      if (filters.eventType) where.eventType = filters.eventType;

      if (filters.dateFrom || filters.dateTo) {
        where.createdAt = {};
        if (filters.dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(filters.dateFrom);
        if (filters.dateTo) (where.createdAt as Record<string, unknown>).lte = new Date(filters.dateTo);
      }

      const skip = ((filters.page ?? 1) - 1) * (filters.limit ?? 50);

      const [logs, total] = await Promise.all([
        ctx.tenantDb.auditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: filters.limit ?? 50,
          include: {
            user: { select: { name: true, email: true } },
          },
        }),
        ctx.prisma.auditLog.count({
          where: { ...where, organizationId: ctx.session.user.organizationId },
        }),
      ]);

      return {
        logs,
        total,
        page: filters.page ?? 1,
        totalPages: Math.ceil(total / (filters.limit ?? 50)),
      };
    }),
});
