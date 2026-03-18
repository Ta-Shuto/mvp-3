import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma client
vi.mock("@/server/db/client", () => ({
  default: {
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import { writeAuditLog, AuditEventTypes } from "../audit";
import prisma from "@/server/db/client";

describe("audit service", () => {
  beforeEach(() => {
    vi.mocked(prisma.auditLog.create).mockReset();
  });

  describe("writeAuditLog", () => {
    it("creates audit log entry with all fields", async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({
        id: "log-1",
        organizationId: "org-1",
        userId: "user-1",
        caseId: "case-1",
        eventType: "case_created",
        details: { action: "test" },
        createdAt: new Date(),
      });

      await writeAuditLog({
        organizationId: "org-1",
        userId: "user-1",
        caseId: "case-1",
        eventType: "case_created",
        details: { action: "test" },
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          organizationId: "org-1",
          userId: "user-1",
          caseId: "case-1",
          eventType: "case_created",
          details: { action: "test" },
        },
      });
    });

    it("handles optional fields", async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({
        id: "log-2",
        organizationId: "org-1",
        userId: null,
        caseId: null,
        eventType: "login",
        details: null,
        createdAt: new Date(),
      });

      await writeAuditLog({
        organizationId: "org-1",
        eventType: "login",
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          organizationId: "org-1",
          userId: undefined,
          caseId: undefined,
          eventType: "login",
          details: undefined,
        },
      });
    });
  });

  describe("AuditEventTypes", () => {
    it("contains all expected event types", () => {
      expect(AuditEventTypes.CASE_CREATED).toBe("case_created");
      expect(AuditEventTypes.CASE_UPDATED).toBe("case_updated");
      expect(AuditEventTypes.CASE_CLOSED).toBe("case_closed");
      expect(AuditEventTypes.LOGIN).toBe("login");
      expect(AuditEventTypes.LOGOUT).toBe("logout");
      expect(AuditEventTypes.MEETING_STARTED).toBe("meeting_started");
      expect(AuditEventTypes.MEETING_ENDED).toBe("meeting_ended");
      expect(AuditEventTypes.FILE_UPLOADED).toBe("file_uploaded");
      expect(AuditEventTypes.FILE_DELETED).toBe("file_deleted");
      expect(AuditEventTypes.CONSENT_RECORDED).toBe("consent_recorded");
      expect(AuditEventTypes.NOTIFICATION_SENT).toBe("notification_sent");
    });

    it("has unique values", () => {
      const values = Object.values(AuditEventTypes);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });
});
