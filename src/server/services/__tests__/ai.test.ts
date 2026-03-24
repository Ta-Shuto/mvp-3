import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Gemini SDK before importing the module
const mockGenerateContent = vi.fn();
vi.mock("@google/generative-ai", () => {
  return {
    GoogleGenerativeAI: class MockGoogleGenerativeAI {
      getGenerativeModel() {
        return {
          generateContent: mockGenerateContent,
        };
      }
    },
  };
});

// Set API key before import
process.env.GEMINI_API_KEY = "test-key";

import {
  generateAIResponse,
  generatePreChatSummary,
  generateScript,
  rephraseText,
  generateMeetingSummary,
  detectRisks,
} from "../ai";

describe("AI service", () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
    process.env.GEMINI_API_KEY = "test-key";
  });

  describe("generateAIResponse", () => {
    it("returns text from Gemini API response", async () => {
      mockGenerateContent.mockResolvedValue({
        response: { text: () => "テスト応答" },
      });

      const result = await generateAIResponse({
        systemPrompt: "テスト",
        messages: [{ role: "user", content: "質問" }],
      });

      expect(result).toBe("テスト応答");
    });

    it("throws on API error", async () => {
      mockGenerateContent.mockRejectedValue(new Error("API error"));

      await expect(
        generateAIResponse({
          systemPrompt: "test",
          messages: [{ role: "user", content: "test" }],
        })
      ).rejects.toThrow("AI応答の生成に失敗しました");
    });
  });

  describe("generatePreChatSummary", () => {
    it("formats chat messages and answers into prompt", async () => {
      mockGenerateContent.mockResolvedValue({
        response: { text: () => "要約結果" },
      });

      const result = await generatePreChatSummary(
        [
          { role: "user", content: "質問です" },
          { role: "assistant", content: "回答です" },
        ],
        [{ questionId: "q1", answerText: "回答テキスト" }],
        "カスタムプロンプト"
      );

      expect(result).toBe("要約結果");
    });
  });

  describe("generateScript", () => {
    it("generates script with 4 sections", async () => {
      const mockResponse = `## シナリオ\nシナリオ内容\n## 争点ポイント\n争点内容\n## 質問リスト\n質問内容\n## 過去の傾向\n傾向内容`;
      mockGenerateContent.mockResolvedValue({
        response: { text: () => mockResponse },
      });

      const result = await generateScript(
        "メール内容",
        null,
        false,
        "",
        "台本プロンプト"
      );

      expect(result.scenarios).toContain("シナリオ");
      expect(result.issues).toContain("争点");
      expect(result.questions).toContain("質問");
      expect(result.pastTrends).toContain("過去");
    });

    it("includes preAiResponse when enabled", async () => {
      mockGenerateContent.mockResolvedValue({
        response: { text: () => "result" },
      });

      await generateScript("email", "AI回答", true, "", "prompt");

      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs.contents[0].parts[0].text).toContain("事前AI回答結果");
    });
  });

  describe("rephraseText", () => {
    it("uses correct tone mapping", async () => {
      mockGenerateContent.mockResolvedValue({
        response: { text: () => "丁寧な文章" },
      });

      const result = await rephraseText("テスト文", "formal");

      expect(result).toBe("丁寧な文章");
    });
  });

  describe("generateMeetingSummary", () => {
    it("formats transcripts with timestamps", async () => {
      mockGenerateContent.mockResolvedValue({
        response: { text: () => "要約" },
      });

      await generateMeetingSummary([
        { speaker: "A", text: "発言1", timestamp: 65 },
        { speaker: "B", text: "発言2", timestamp: 130 },
      ]);

      const callArgs = mockGenerateContent.mock.calls[0][0];
      const userContent = callArgs.contents[0].parts[0].text;
      expect(userContent).toContain("[1:05] A: 発言1");
      expect(userContent).toContain("[2:10] B: 発言2");
    });
  });

  describe("detectRisks", () => {
    it("parses JSON response correctly", async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            '{"isRisky": true, "reason": "不適切発言", "confidence": "HIGH", "rephrasing": "言い換え"}',
        },
      });

      const result = await detectRisks("テスト発言", "Speaker A", "リスク検出プロンプト");

      expect(result.isRisky).toBe(true);
      expect(result.reason).toBe("不適切発言");
      expect(result.confidence).toBe("HIGH");
      expect(result.rephrasing).toBe("言い換え");
    });

    it("returns safe defaults on parse failure", async () => {
      mockGenerateContent.mockResolvedValue({
        response: { text: () => "invalid json" },
      });

      const result = await detectRisks("テスト", "A", "prompt");

      expect(result.isRisky).toBe(false);
      expect(result.confidence).toBe("LOW");
    });
  });
});
