import { z } from "zod";
import { protectedProcedure, router } from "../router";

export const dashboardRouter = router({
  // FR-101: 要対応案件（期限7日以内 + 期限超過）
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

  // FR-102: 更新が止まっている案件（7日以上更新なし）
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

  // FR-103: 案件の状況サマリー（進捗×状態の件数集計）
  getSummary: protectedProcedure.query(async ({ ctx }) => {
    const cases = await ctx.tenantDb.case.findMany({
      select: {
        progress: true,
        status: true,
      },
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
