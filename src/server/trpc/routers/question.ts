import { protectedProcedure, router } from "../router";
import { z } from "zod";

export const questionRouter = router({
  // テンプレートの事前質問一覧を取得
  list: protectedProcedure.query(async ({ ctx }) => {
    const templates = await ctx.tenantDb.template.findMany({
      include: {
        updatedBy: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
    }) as any[];

    return templates.map((t: any) => ({
      id: t.id,
      useCase: t.useCase,
      questions: (t.preQuestions as any[]) ?? [],
      updatedAt: t.updatedAt,
      updatedBy: t.updatedBy,
    }));
  }),

  // 回答済み案件の質問・回答一覧
  getAnswers: protectedProcedure.query(async ({ ctx }) => {
    const preChats = await ctx.tenantDb.preChat.findMany({
      where: { isSubmitted: true },
      include: {
        answers: true,
        case: {
          select: {
            id: true,
            caseName: true,
            category: true,
            caseCategory: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    });

    return preChats;
  }),

  // 質問テンプレートを更新
  updateQuestions: protectedProcedure
    .input(
      z.object({
        templateId: z.string(),
        questions: z.array(
          z.object({
            id: z.string(),
            label: z.string(),
            type: z.string().optional(),
            required: z.boolean().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.tenantDb.template.update({
        where: { id: input.templateId },
        data: {
          preQuestions: input.questions,
          updatedById: ctx.session.user.id,
        },
      });
    }),
});
