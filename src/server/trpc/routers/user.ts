import { z } from "zod";
import { withPermission, router } from "../router";
import { writeAuditLog, AuditEventTypes } from "@/server/services/audit";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";

export const userRouter = router({
  // ユーザー一覧（担当案件数・面談数を含む）
  list: withPermission("user:manage")
    .query(async ({ ctx }) => {
      const users = await ctx.tenantDb.user.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          assignedCases: { select: { id: true } },
          primaryCases: {
            select: {
              id: true,
              meetings: { select: { id: true } },
            },
          },
        },
      });

      return users.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        department: u.department,
        role: u.role,
        caseCount: u.primaryCases?.length ?? 0,
        meetingCount: u.primaryCases?.reduce(
          (acc: number, c: any) => acc + (c.meetings?.length ?? 0),
          0
        ) ?? 0,
        createdAt: u.createdAt,
      }));
    }),

  // ユーザー招待（新規作成）
  invite: withPermission("user:manage")
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6),
        department: z.string().optional(),
        role: z.enum(["ADMIN", "INTERVIEWER", "INTERVIEWEE", "OPERATOR"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // メール重複チェック
      const existing = await ctx.prisma.user.findUnique({
        where: { email: input.email },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "このメールアドレスは既に登録されています",
        });
      }

      const passwordHash = await bcrypt.hash(input.password, 10);

      const user = await ctx.prisma.user.create({
        data: {
          organizationId: ctx.session.user.organizationId,
          name: input.name,
          email: input.email,
          passwordHash,
          department: input.department || null,
          role: input.role,
        },
      });

      await writeAuditLog({
        organizationId: ctx.session.user.organizationId,
        userId: ctx.session.user.id,
        eventType: AuditEventTypes.USER_INVITED,
        details: { action: "user_invited", targetUserId: user.id, targetEmail: input.email },
      });

      return { id: user.id, name: user.name, email: user.email };
    }),

  // ユーザー更新
  update: withPermission("user:manage")
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        department: z.string().optional(),
        role: z.enum(["ADMIN", "INTERVIEWER", "INTERVIEWEE", "OPERATOR"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const targetUser = await ctx.tenantDb.user.findFirst({
        where: { id },
      });
      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "ユーザーが見つかりません" });
      }

      return ctx.prisma.user.update({
        where: { id },
        data,
      });
    }),

  // ユーザー削除
  delete: withPermission("user:manage")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // 自分自身は削除不可
      if (input.id === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "自分自身を削除することはできません",
        });
      }

      const targetUser = await ctx.tenantDb.user.findFirst({
        where: { id: input.id },
      });
      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "ユーザーが見つかりません" });
      }

      await ctx.prisma.user.delete({ where: { id: input.id } });

      return { success: true };
    }),
});
