import { z } from "zod";
import { protectedProcedure, withPermission, router } from "../router";
import { TRPCError } from "@trpc/server";

export const fileAttachmentRouter = router({
  // List files for a case
  listByCase: protectedProcedure
    .input(z.object({ caseId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.tenantDb.fileAttachment.findMany({
        where: { caseId: input.caseId },
        include: { uploadedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      });
    }),

  // List files for a meeting
  listByMeeting: protectedProcedure
    .input(z.object({ meetingId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.tenantDb.fileAttachment.findMany({
        where: { meetingId: input.meetingId },
        include: { uploadedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      });
    }),

  // Register file metadata (called after upload)
  register: withPermission("case:update")
    .input(
      z.object({
        caseId: z.string().optional(),
        meetingId: z.string().optional(),
        fileName: z.string(),
        fileSize: z.number(),
        mimeType: z.string(),
        s3Key: z.string(),
        category: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.tenantDb.fileAttachment.create({
        data: {
          organizationId: ctx.session.user.organizationId,
          caseId: input.caseId,
          meetingId: input.meetingId,
          uploadedById: ctx.session.user.id,
          fileName: input.fileName,
          fileSize: input.fileSize,
          mimeType: input.mimeType,
          s3Key: input.s3Key,
          category: input.category ?? "general",
        },
      });
    }),

  // Delete file
  delete: withPermission("case:update")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const file = await ctx.tenantDb.fileAttachment.findUnique({
        where: { id: input.id },
      });
      if (!file) throw new TRPCError({ code: "NOT_FOUND" });

      // Delete from S3
      try {
        const { deleteFile } = await import("@/server/services/s3");
        await deleteFile(file.s3Key);
      } catch (e) {
        console.error("S3 delete error:", e);
      }

      return ctx.tenantDb.fileAttachment.delete({ where: { id: input.id } });
    }),
});
