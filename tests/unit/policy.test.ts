import { describe, expect, it } from "vitest";
import {
  formatDuration,
  lockoutDurationMs,
  RateLimiter,
  safeRedirectPath,
  validateNewPassword,
} from "@/lib/auth/policy";

const MIN = 60_000;

describe("validateNewPassword", () => {
  it("requires 12 characters", () => {
    expect(validateNewPassword("short pass")).toMatch(/at least 12/);
    expect(validateNewPassword("purple crown ledger")).toBeNull();
  });
  it("rejects passwords containing the username", () => {
    expect(validateNewPassword("my-admin-password-2026", "admin")).toMatch(/username/);
  });
  it("rejects repetitive passwords", () => {
    expect(validateNewPassword("aaaaaaaaaaaaaaaa")).toMatch(/repetitive/);
  });
});

describe("lockoutDurationMs", () => {
  it("does not lock before 5 failures", () => {
    expect(lockoutDurationMs(4)).toBe(0);
  });
  it("doubles from 15 minutes and caps at 24 hours", () => {
    expect(lockoutDurationMs(5)).toBe(15 * MIN);
    expect(lockoutDurationMs(6)).toBe(30 * MIN);
    expect(lockoutDurationMs(7)).toBe(60 * MIN);
    expect(lockoutDurationMs(30)).toBe(24 * 60 * MIN);
  });
});

describe("safeRedirectPath", () => {
  it("allows relative paths", () => {
    expect(safeRedirectPath("/settings?tab=ai")).toBe("/settings?tab=ai");
  });
  it("blocks external and protocol-relative redirects", () => {
    expect(safeRedirectPath("https://evil.example")).toBe("/");
    expect(safeRedirectPath("//evil.example")).toBe("/");
    expect(safeRedirectPath("/\\evil.example")).toBe("/");
    expect(safeRedirectPath(undefined)).toBe("/");
    expect(safeRedirectPath("/login")).toBe("/");
  });
});

describe("RateLimiter", () => {
  it("blocks after the limit of failures within a window, then resets", () => {
    const limiter = new RateLimiter(3, 1000);
    limiter.recordFailure("ip", 0);
    limiter.recordFailure("ip", 100);
    expect(limiter.isBlocked("ip", 200)).toBe(false);
    limiter.recordFailure("ip", 300);
    expect(limiter.isBlocked("ip", 500)).toBe(true);
    expect(limiter.isBlocked("other", 500)).toBe(false);
    expect(limiter.isBlocked("ip", 1000)).toBe(false);
  });
});

describe("formatDuration", () => {
  it("formats minutes and hours", () => {
    expect(formatDuration(60_000)).toBe("1 minute");
    expect(formatDuration(15 * MIN)).toBe("15 minutes");
    expect(formatDuration(120 * MIN)).toBe("2 hours");
  });
});
