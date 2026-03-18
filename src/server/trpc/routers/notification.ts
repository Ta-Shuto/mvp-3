import { z } from "zod";
import { protectedProcedure, router } from "../router";

export const notificationRouter = router({
  // Get notifications for current user
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional(),
        unreadOnly: z.boolean().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const where: any = { userId: ctx.session.user.id };
      if (input?.unreadOnly) where.isRead = false;

      return ctx.tenantDb.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      });
    }),

  // Get unread count
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return ctx.tenantDb.notification.count({
      where: { userId: ctx.session.user.id, isRead: false },
    });
  }),

  // Mark single notification as read
  markAsRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.tenantDb.notification.updateMany({
        where: { id: input.id, userId: ctx.session.user.id },
        data: { isRead: true },
      });
    }),

  // Mark all as read
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    return ctx.tenantDb.notification.updateMany({
      where: { userId: ctx.session.user.id, isRead: false },
      data: { isRead: true },
    });
  }),
});

/**
 * Helper: Create a notification for a user
 */
export async function createNotification(
  prisma: any,
  params: {
    organizationId: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    linkUrl?: string;
  }
) {
  return prisma.notification.create({ data: params });
}

/**
 * Helper: Notify all users with a specific role in an organization
 */
export async function notifyByRole(
  prisma: any,
  params: {
    organizationId: string;
    role: string;
    type: string;
    title: string;
    message: string;
    linkUrl?: string;
  }
) {
  const users = await prisma.user.findMany({
    where: { organizationId: params.organizationId, role: params.role },
    select: { id: true },
  });

  const { role, ...notifData } = params;
  return Promise.all(
    users.map((u: { id: string }) =>
      prisma.notification.create({
        data: { ...notifData, userId: u.id },
      })
    )
  );
}
