import { protectedProcedure, router } from "../router";

export const dashboardRouter = router({
  // 統計カード: 総案件数、対応中案件、ユーザー数
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const [totalCases, activeCases, userCount] = await Promise.all([
      ctx.tenantDb.case.count(),
      ctx.tenantDb.case.count({ where: { status: { not: "CLOSED" } } }),
      ctx.tenantDb.user.count(),
    ]);
    return { totalCases, activeCases, userCount };
  }),

  // リスク評価マトリクス: カテゴリ × リスクレベル
  getRiskMatrix: protectedProcedure.query(async ({ ctx }) => {
    const cases = await ctx.tenantDb.case.findMany({
      where: { status: { not: "CLOSED" } },
      select: { caseCategory: true, riskLevel: true },
    });

    const categories = ["HARASSMENT", "FRAUD", "SAFETY", "OTHER"] as const;
    const levels = ["URGENT", "HIGH", "MEDIUM", "LOW"] as const;

    const matrix: Record<string, Record<string, number>> = {};
    for (const level of levels) {
      matrix[level] = {};
      for (const cat of categories) {
        matrix[level][cat] = 0;
      }
    }

    for (const c of cases) {
      const cat = c.caseCategory ?? "OTHER";
      const level = c.riskLevel ?? "MEDIUM";
      if (matrix[level] && matrix[level][cat] !== undefined) {
        matrix[level][cat]++;
      }
    }

    return matrix;
  }),

  // 最近の案件
  getRecentCases: protectedProcedure.query(async ({ ctx }) => {
    return ctx.tenantDb.case.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        caseName: true,
        category: true,
        status: true,
        caseCategory: true,
        riskLevel: true,
        createdAt: true,
      },
    });
  }),

  // 要対応案件（期限7日以内 + 期限超過）
  getUrgentCases: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return ctx.tenantDb.case.findMany({
      where: {
        status: { not: "CLOSED" },
        deadline: { lte: sevenDaysLater },
      },
      orderBy: { deadline: "asc" },
      include: {
        primaryAssignee: { select: { id: true, name: true } },
      },
    });
  }),

  // 更新が止まっている案件（7日以上更新なし）
  getStaleCases: protectedProcedure.query(async ({ ctx }) => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    return ctx.tenantDb.case.findMany({
      where: {
        status: { not: "CLOSED" },
        updatedAt: { lte: sevenDaysAgo },
      },
      orderBy: { updatedAt: "asc" },
      include: {
        primaryAssignee: { select: { id: true, name: true } },
      },
    });
  }),

  // 案件の状況サマリー（進捗×状態の件数集計）
  getSummary: protectedProcedure.query(async ({ ctx }) => {
    const cases = await ctx.tenantDb.case.findMany({
      select: { progress: true, status: true },
    });

    const summary: Record<string, { active: number; closed: number }> = {};

    for (const c of cases) {
      if (!summary[c.progress]) {
        summary[c.progress] = { active: 0, closed: 0 };
      }
      if (c.status === "CLOSED") {
        summary[c.progress].closed++;
      } else {
        summary[c.progress].active++;
      }
    }

    return summary;
  }),
});
