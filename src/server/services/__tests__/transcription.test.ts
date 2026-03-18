import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkDelay,
  normalizeText,
  mapConfidence,
  processTranscriptChunk,
} from "../transcription";

describe("transcription service", () => {
  describe("normalizeText", () => {
    it("converts full-width alphanumeric to half-width", () => {
      expect(normalizeText("Ａｂｃ１２３")).toBe("Abc123");
    });

    it("converts full-width spaces to half-width", () => {
      expect(normalizeText("テスト\u3000データ")).toBe("テスト データ");
    });

    it("collapses multiple whitespace", () => {
      expect(normalizeText("hello   world")).toBe("hello world");
    });

    it("trims leading and trailing whitespace", () => {
      expect(normalizeText("  test  ")).toBe("test");
    });

    it("handles mixed Japanese and English text", () => {
      expect(normalizeText("日本語ＡＢＣとEnglish")).toBe("日本語ABCとEnglish");
    });

    it("handles empty string", () => {
      expect(normalizeText("")).toBe("");
    });
  });

  describe("mapConfidence", () => {
    it("returns HIGH for score >= 0.85", () => {
      expect(mapConfidence(0.85)).toBe("HIGH");
      expect(mapConfidence(0.95)).toBe("HIGH");
      expect(mapConfidence(1.0)).toBe("HIGH");
    });

    it("returns MEDIUM for score >= 0.6 and < 0.85", () => {
      expect(mapConfidence(0.6)).toBe("MEDIUM");
      expect(mapConfidence(0.7)).toBe("MEDIUM");
      expect(mapConfidence(0.84)).toBe("MEDIUM");
    });

    it("returns LOW for score < 0.6", () => {
      expect(mapConfidence(0.5)).toBe("LOW");
      expect(mapConfidence(0.0)).toBe("LOW");
    });

    it("returns MEDIUM when undefined", () => {
      expect(mapConfidence(undefined)).toBe("MEDIUM");
    });
  });

  describe("checkDelay", () => {
    it("returns no delay when receivedAt is not set", () => {
      const result = checkDelay({
        meetingId: "m1",
        speaker: "A",
        text: "hello",
        timestamp: 10,
        isFinal: true,
      });
      expect(result.hasDelay).toBe(false);
      expect(result.delayMs).toBe(0);
    });

    it("detects delay over 5 seconds", () => {
      const now = Date.now();
      const result = checkDelay({
        meetingId: "m1",
        speaker: "A",
        text: "hello",
        timestamp: 10,
        isFinal: true,
        receivedAt: now - 6000,
      });
      expect(result.hasDelay).toBe(true);
      expect(result.delayMs).toBeGreaterThanOrEqual(5000);
    });

    it("no delay within 5 seconds", () => {
      const now = Date.now();
      const result = checkDelay({
        meetingId: "m1",
        speaker: "A",
        text: "hello",
        timestamp: 10,
        isFinal: true,
        receivedAt: now - 1000,
      });
      expect(result.hasDelay).toBe(false);
    });
  });

  describe("processTranscriptChunk", () => {
    it("normalizes text and maps confidence", () => {
      const result = processTranscriptChunk({
        meetingId: "m1",
        speaker: "Speaker A",
        text: "テスト\u3000ＡＢＣ",
        timestamp: 30.5,
        isFinal: true,
        confidence: 0.9,
      });

      expect(result.text).toBe("テスト ABC");
      expect(result.confidence).toBe("HIGH");
      expect(result.speaker).toBe("Speaker A");
      expect(result.meetingId).toBe("m1");
      expect(result.isFinal).toBe(true);
      expect(result.delay.hasDelay).toBe(false);
    });

    it("handles chunk with delay", () => {
      const result = processTranscriptChunk({
        meetingId: "m1",
        speaker: "B",
        text: "遅延テスト",
        timestamp: 60,
        isFinal: false,
        confidence: 0.5,
        receivedAt: Date.now() - 10000,
      });

      expect(result.confidence).toBe("LOW");
      expect(result.isFinal).toBe(false);
      expect(result.delay.hasDelay).toBe(true);
    });
  });
});
