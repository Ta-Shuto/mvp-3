import { protectedProcedure, router } from "../router";

export const analysisRouter = router({
  // カテゴリ別案件数
  getCategoryBreakdown: protectedProcedure.query(async ({ ctx }) => {
    const cases = await ctx.tenantDb.case.findMany({
      select: { caseCategory: true, status: true },
    });

    const categories = ["HARASSMENT", "FRAUD", "SAFETY", "OTHER"] as const;
    const result = categories.map((cat) => ({
      category: cat,
      total: cases.filter((c) => (c.caseCategory ?? "OTHER") === cat).length,
      active: cases.filter(
        (c) => (c.caseCategory ?? "OTHER") === cat && c.status !== "CLOSED"
      ).length,
      closed: cases.filter(
        (c) => (c.caseCategory ?? "OTHER") === cat && c.status === "CLOSED"
      ).length,
    }));

    return result;
  }),

  // ステータス別案件数
  getStatusBreakdown: protectedProcedure.query(async ({ ctx }) => {
    const cases = await ctx.tenantDb.case.findMany({
      select: { status: true },
    });

    const statuses = [
      "PRE_INPUT_PENDING",
      "PRE_INPUT_SUBMITTED",
      "IN_MEETING",
      "MEETING_ENDED",
      "CLOSED",
    ] as const;

    return statuses.map((s) => ({
      status: s,
      count: cases.filter((c) => c.status === s).length,
    }));
  }),

  // リスクレベル別案件数
  getRiskBreakdown: protectedProcedure.query(async ({ ctx }) => {
    const cases = await ctx.tenantDb.case.findMany({
      where: { status: { not: "CLOSED" } },
      select: { riskLevel: true },
    });

    const levels = ["URGENT", "HIGH", "MEDIUM", "LOW"] as const;
    return levels.map((l) => ({
      level: l,
      count: cases.filter((c) => (c.riskLevel ?? "MEDIUM") === l).length,
    }));
  }),

  // 月別案件推移
  getMonthlyTrend: protectedProcedure.query(async ({ ctx }) => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const cases = await ctx.tenantDb.case.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true, status: true },
      orderBy: { createdAt: "asc" },
    });

    const months: Record<string, { created: number; closed: number }> = {};
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months[key] = { created: 0, closed: 0 };
    }

    for (const c of cases) {
      const key = `${c.createdAt.getFullYear()}-${String(c.createdAt.getMonth() + 1).padStart(2, "0")}`;
      if (months[key]) {
        months[key].created++;
        if (c.status === "CLOSED") {
          months[key].closed++;
        }
      }
    }

    return Object.entries(months).map(([month, data]) => ({
      month,
      ...data,
    }));
  }),

  // 平均対応日数
  getAverageResolutionDays: protectedProcedure.query(async ({ ctx }) => {
    const closedCases = await ctx.tenantDb.case.findMany({
      where: { status: "CLOSED", closedAt: { not: null } },
      select: { createdAt: true, closedAt: true },
    });

    if (closedCases.length === 0) return { average: null, count: 0 };

    const totalDays = closedCases.reduce((sum, c) => {
      const days = Math.ceil(
        (c.closedAt!.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      return sum + days;
    }, 0);

    return {
      average: Math.round(totalDays / closedCases.length),
      count: closedCases.length,
    };
  }),

  // 担当者別案件数
  getAssigneeBreakdown: protectedProcedure.query(async ({ ctx }) => {
    const cases = await ctx.tenantDb.case.findMany({
      where: { status: { not: "CLOSED" } },
      select: { primaryAssigneeId: true },
    });

    const users = await ctx.tenantDb.user.findMany({
      select: { id: true, name: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u.name]));
    const countMap = new Map<string, number>();

    for (const c of cases) {
      const key = c.primaryAssigneeId ?? "unassigned";
      countMap.set(key, (countMap.get(key) ?? 0) + 1);
    }

    return Array.from(countMap.entries())
      .map(([id, count]) => ({
        id,
        name: id === "unassigned" ? "未割当" : (userMap.get(id) ?? "不明"),
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }),

  // リスクアイテム統計
  getRiskItemStats: protectedProcedure.query(async ({ ctx }) => {
    const riskItems = await ctx.tenantDb.riskItem.findMany({
      select: { status: true, confidence: true },
    });

    return {
      total: riskItems.length,
      pending: riskItems.filter((r) => r.status === "PENDING").length,
      accepted: riskItems.filter((r) => r.status === "ACCEPTED").length,
      rejected: riskItems.filter((r) => r.status === "REJECTED").length,
      highConfidence: riskItems.filter((r) => r.confidence === "HIGH").length,
    };
  }),
});
