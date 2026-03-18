import { describe, it, expect } from "vitest";
import { hasPermission, requirePermission } from "../rbac";

describe("RBAC", () => {
  describe("hasPermission", () => {
    it("ADMIN has all standard permissions", () => {
      expect(hasPermission("ADMIN", "case:read")).toBe(true);
      expect(hasPermission("ADMIN", "case:create")).toBe(true);
      expect(hasPermission("ADMIN", "case:update")).toBe(true);
      expect(hasPermission("ADMIN", "case:close")).toBe(true);
      expect(hasPermission("ADMIN", "case:assign")).toBe(true);
      expect(hasPermission("ADMIN", "case:read_all")).toBe(true);
      expect(hasPermission("ADMIN", "user:manage")).toBe(true);
      expect(hasPermission("ADMIN", "audit_log:read")).toBe(true);
      expect(hasPermission("ADMIN", "settings:update")).toBe(true);
      expect(hasPermission("ADMIN", "template:update")).toBe(true);
    });

    it("ADMIN does not have ops:read", () => {
      expect(hasPermission("ADMIN", "ops:read")).toBe(false);
    });

    it("INTERVIEWER has limited permissions", () => {
      expect(hasPermission("INTERVIEWER", "case:read")).toBe(true);
      expect(hasPermission("INTERVIEWER", "case:create")).toBe(true);
      expect(hasPermission("INTERVIEWER", "case:update")).toBe(true);
      expect(hasPermission("INTERVIEWER", "meeting:manage")).toBe(true);
      expect(hasPermission("INTERVIEWER", "template:read")).toBe(true);
    });

    it("INTERVIEWER cannot close or assign cases", () => {
      expect(hasPermission("INTERVIEWER", "case:close")).toBe(false);
      expect(hasPermission("INTERVIEWER", "case:assign")).toBe(false);
      expect(hasPermission("INTERVIEWER", "user:manage")).toBe(false);
      expect(hasPermission("INTERVIEWER", "audit_log:read")).toBe(false);
    });

    it("INTERVIEWEE has no permissions", () => {
      expect(hasPermission("INTERVIEWEE", "case:read")).toBe(false);
      expect(hasPermission("INTERVIEWEE", "meeting:manage")).toBe(false);
    });

    it("OPERATOR has only ops:read", () => {
      expect(hasPermission("OPERATOR", "ops:read")).toBe(true);
      expect(hasPermission("OPERATOR", "case:read")).toBe(false);
      expect(hasPermission("OPERATOR", "user:manage")).toBe(false);
    });

    it("SYSTEM has specific permissions", () => {
      expect(hasPermission("SYSTEM", "case:update")).toBe(true);
      expect(hasPermission("SYSTEM", "meeting:manage")).toBe(true);
      expect(hasPermission("SYSTEM", "pre_chat:manage")).toBe(true);
      expect(hasPermission("SYSTEM", "case:read")).toBe(false);
    });
  });

  describe("requirePermission", () => {
    it("does not throw for valid permission", () => {
      expect(() => requirePermission("ADMIN", "case:read")).not.toThrow();
    });

    it("throws for missing permission", () => {
      expect(() => requirePermission("INTERVIEWEE", "case:read")).toThrow(
        "Permission denied"
      );
    });

    it("includes permission and role in error message", () => {
      expect(() => requirePermission("OPERATOR", "case:create")).toThrow(
        "Permission denied: case:create for role OPERATOR"
      );
    });
  });
});
