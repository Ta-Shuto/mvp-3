import { z } from "zod";
import { publicProcedure, protectedProcedure, withPermission, router } from "../router";
import { writeAuditLog, AuditEventTypes } from "@/server/services/audit";
import { TRPCError } from "@trpc/server";
import prisma from "@/server/db/client";

export const preChatRouter = router({
  // Get pre-chat by token (public - for interviewees)
  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const preChat = await prisma.preChat.findUnique({
        where: { token: input.token },
        include: {
          answers: true,
          messages: { orderBy: { createdAt: "asc" } },
          case: {
            select: {
              id: true,
              useCase: true,
              templateSnapshot: true,
              organization: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });

      if (!preChat || !preChat.urlActive) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid or expired link" });
      }

      return preChat;
    }),

  // FR-025: 同意
  consent: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const preChat = await prisma.preChat.findUnique({
        where: { token: input.token },
      });
      if (!preChat || !preChat.urlActive) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return prisma.preChat.update({
        where: { token: input.token },
        data: { consentAt: new Date() },
      });
    }),

  // FR-026, FR-028: 回答保存（オートセーブ）
  saveAnswer: publicProcedure
    .input(
      z.object({
        token: z.string(),
        questionId: z.string(),
        answerText: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const preChat = await prisma.preChat.findUnique({
        where: { token: input.token },
      });
      if (!preChat || !preChat.urlActive || preChat.isSubmitted) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot save answer" });
      }

      return prisma.preChatAnswer.upsert({
        where: {
          id: (
            await prisma.preChatAnswer.findFirst({
              where: { preChatId: preChat.id, questionId: input.questionId },
            })
          )?.id ?? "",
        },
        create: {
          preChatId: preChat.id,
          questionId: input.questionId,
          answerText: input.answerText,
        },
        update: {
          answerText: input.answerText,
        },
      });
    }),

  // FR-029: AIチャット
  sendAiMessage: publicProcedure
    .input(
      z.object({
        token: z.string(),
        content: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const preChat = await prisma.preChat.findUnique({
        where: { token: input.token },
        include: {
          messages: { orderBy: { createdAt: "asc" } },
          case: {
            select: {
              templateSnapshot: true,
              organization: { select: { id: true } },
            },
          },
        },
      });
      if (!preChat || !preChat.urlActive || preChat.isSubmitted) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      // Save user message
      await prisma.aIChatMessage.create({
        data: {
          preChatId: preChat.id,
          role: "user",
          content: input.content,
        },
      });

      // Call Claude API with template prompt (FR-029)
      const { generateAIResponse } = await import("@/server/services/ai");
      const templateSnapshot = preChat.case.templateSnapshot as any;
      const aiChatPrompt = templateSnapshot?.aiChatPrompt || "あなたは面談の事前相談を受けるAIアシスタントです。丁寧に、共感を持って対応してください。";

      const chatHistory = preChat.messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
      chatHistory.push({ role: "user", content: input.content });

      let aiResponse: string;
      try {
        aiResponse = await generateAIResponse({
          systemPrompt: aiChatPrompt,
          messages: chatHistory,
        });
      } catch {
        aiResponse = "申し訳ございません。現在AI応答を生成できません。しばらくしてから再試行してください。";
      }

      // Save AI response
      const aiMessage = await prisma.aIChatMessage.create({
        data: {
          preChatId: preChat.id,
          role: "assistant",
          content: aiResponse,
        },
      });

      return aiMessage;
    }),

  // FR-030: 提出
  submit: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const preChat = await prisma.preChat.findUnique({
        where: { token: input.token },
        include: { case: { select: { organizationId: true } } },
      });
      if (!preChat || !preChat.urlActive || preChat.isSubmitted) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      const updated = await prisma.preChat.update({
        where: { token: input.token },
        data: {
          isSubmitted: true,
          submittedAt: new Date(),
        },
      });

      // Update case status
      await prisma.case.update({
        where: { id: preChat.caseId },
        data: { status: "PRE_INPUT_SUBMITTED" },
      });

      await writeAuditLog({
        organizationId: preChat.case.organizationId,
        caseId: preChat.caseId,
        eventType: AuditEventTypes.PRE_CHAT_SUBMITTED,
      });

      return updated;
    }),

  // FR-033: 面談担当者向け事前チャット全文閲覧
  getFullChat: protectedProcedure
    .input(z.object({ caseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const preChat = await prisma.preChat.findUnique({
        where: { caseId: input.caseId },
        include: {
          answers: true,
          messages: { orderBy: { createdAt: "asc" } },
        },
      });

      if (!preChat) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // FR-036: 閲覧ログ記録
      await writeAuditLog({
        organizationId: ctx.session.user.organizationId,
        userId: ctx.session.user.id,
        caseId: input.caseId,
        eventType: AuditEventTypes.PRE_CHAT_VIEWED,
      });

      return preChat;
    }),

  // FR-094: URL再発行
  reissueUrl: withPermission("pre_chat:manage")
    .input(z.object({ caseId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const preChat = await prisma.preChat.findUnique({
        where: { caseId: input.caseId },
      });
      if (!preChat) throw new TRPCError({ code: "NOT_FOUND" });

      // Invalidate old URL and create new token
      const updated = await prisma.preChat.update({
        where: { id: preChat.id },
        data: {
          token: require("crypto").randomUUID(),
          urlActive: true,
          isSubmitted: false,
          submittedAt: null,
        },
      });

      await writeAuditLog({
        organizationId: ctx.session.user.organizationId,
        userId: ctx.session.user.id,
        caseId: input.caseId,
        eventType: AuditEventTypes.PRE_CHAT_URL_REISSUED,
      });

      return updated;
    }),
});
