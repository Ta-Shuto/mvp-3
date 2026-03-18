import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Save original env
const originalEnv = { ...process.env };

describe("meeting-bot service", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  describe("createBot", () => {
    it("returns mock bot when API key is not configured", async () => {
      process.env.RECALL_API_KEY = "";
      // Re-import to get fresh module
      const { createBot } = await import("../meeting-bot");
      const result = await createBot({ meetingUrl: "https://zoom.us/j/123" });
      expect(result.botId).toMatch(/^mock-bot-/);
    });
  });

  describe("getBotStatus", () => {
    it("returns mock status for mock bots", async () => {
      process.env.RECALL_API_KEY = "";
      const { getBotStatus } = await import("../meeting-bot");
      const status = await getBotStatus("mock-bot-12345");
      expect(status.status).toBe("in_meeting");
      expect(status.participantCount).toBe(2);
    });
  });

  describe("validateParticipantCount", () => {
    it("validates participant count against max", async () => {
      process.env.RECALL_API_KEY = "";
      const { validateParticipantCount } = await import("../meeting-bot");
      const result = await validateParticipantCount("mock-bot-123", 5);
      expect(result.valid).toBe(true);
      expect(result.count).toBe(2);
    });

    it("rejects when over max participants", async () => {
      process.env.RECALL_API_KEY = "";
      const { validateParticipantCount } = await import("../meeting-bot");
      // Mock returns 2 participants, so max=1 should fail
      const result = await validateParticipantCount("mock-bot-123", 1);
      expect(result.valid).toBe(false);
    });
  });

  describe("removeBot", () => {
    it("does nothing for mock bots", async () => {
      process.env.RECALL_API_KEY = "";
      const { removeBot } = await import("../meeting-bot");
      await expect(removeBot("mock-bot-123")).resolves.toBeUndefined();
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("getRecordingUrl", () => {
    it("returns null for mock bots", async () => {
      process.env.RECALL_API_KEY = "";
      const { getRecordingUrl } = await import("../meeting-bot");
      const url = await getRecordingUrl("mock-bot-123");
      expect(url).toBeNull();
    });
  });
});
