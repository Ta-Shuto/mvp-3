import { z } from "zod";
import { protectedProcedure, withPermission, router } from "../router";
import { writeAuditLog, AuditEventTypes } from "@/server/services/audit";

export const orgSettingsRouter = router({
  // 法人設定取得
  get: protectedProcedure.query(async ({ ctx }) => {
    const org = await ctx.prisma.organization.findUnique({
      where: { id: ctx.session.user.organizationId },
      select: {
        retentionDays: true,
        meetingUrlReuseRule: true,
        autoEndSettings: true,
        notificationSettings: true,
        consentSettings: true,
        retrySettings: true,
      },
    });
    return org;
  }),

  // 法人設定更新
  update: withPermission("settings:update")
    .input(
      z.object({
        retentionDays: z.number().min(1).optional(),
        meetingUrlReuseRule: z.enum(["new_case", "append"]).optional(),
        autoEndSettings: z
          .object({
            silenceMinutes: z.number().min(1),
            endOnNoParticipants: z.boolean(),
            maxDurationHours: z.number().min(1),
          })
          .optional(),
        autoDeleteEnabled: z.boolean().optional(),
        autoDeleteRetentionMonths: z.number().min(1).optional(),
        autoDeleteTargetStatuses: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = {};
      if (input.retentionDays !== undefined) data.retentionDays = input.retentionDays;
      if (input.meetingUrlReuseRule !== undefined) data.meetingUrlReuseRule = input.meetingUrlReuseRule;
      if (input.autoEndSettings !== undefined) data.autoEndSettings = input.autoEndSettings;

      const updated = await ctx.prisma.organization.update({
        where: { id: orgId },
        data,
      });

      await writeAuditLog({
        organizationId: orgId,
        userId: ctx.session.user.id,
        eventType: AuditEventTypes.SETTINGS_UPDATED,
        details: input,
      });

      return updated;
    }),
});
