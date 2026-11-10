import { describe, expect, it } from "vitest";
import {
  addDays,
  countWeekdays,
  formatDateRange,
  isIsoDate,
  rangesOverlap,
  todayIn,
} from "@/lib/dates";

describe("isIsoDate", () => {
  it("accepts real calendar dates only", () => {
    expect(isIsoDate("2026-11-10")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("11/10/2026")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });
});

describe("countWeekdays", () => {
  it("counts Monday to Friday inclusively", () => {
    expect(countWeekdays("2026-11-09", "2026-11-13")).toBe(5); // Mon-Fri
    expect(countWeekdays("2026-11-09", "2026-11-15")).toBe(5); // through Sunday
    expect(countWeekdays("2026-11-14", "2026-11-15")).toBe(0); // weekend
    expect(countWeekdays("2026-11-10", "2026-11-10")).toBe(1);
    expect(countWeekdays("2026-11-13", "2026-11-09")).toBe(0);
  });
});

describe("rangesOverlap", () => {
  it("treats ranges as inclusive", () => {
    expect(rangesOverlap("2026-11-09", "2026-11-13", "2026-11-13", "2026-11-20")).toBe(true);
    expect(rangesOverlap("2026-11-09", "2026-11-13", "2026-11-14", "2026-11-20")).toBe(false);
    expect(rangesOverlap("2026-11-01", "2026-11-30", "2026-11-10", "2026-11-11")).toBe(true);
  });
});

describe("addDays and todayIn", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("uses the given time zone", () => {
    const instant = new Date("2026-11-10T03:00:00Z"); // evening of Nov 9 in Chicago
    expect(todayIn("America/Chicago", instant)).toBe("2026-11-09");
    expect(todayIn("UTC", instant)).toBe("2026-11-10");
  });
});

describe("formatDateRange", () => {
  it("shortens ranges sensibly", () => {
    expect(formatDateRange("2026-11-10", "2026-11-10")).toBe("Nov 10, 2026");
    expect(formatDateRange("2026-11-10", "2026-11-14")).toBe("Nov 10 – 14, 2026");
    expect(formatDateRange("2026-11-28", "2026-12-02")).toBe("Nov 28 – Dec 2, 2026");
    expect(formatDateRange("2026-12-30", "2027-01-02")).toBe("Dec 30, 2026 – Jan 2, 2027");
  });
});
