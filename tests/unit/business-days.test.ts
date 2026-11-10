import { describe, expect, it } from "vitest";
import {
  addBusinessDays,
  businessDaysBetween,
  isBusinessDay,
  isFastStart,
  usFederalHolidays,
} from "@/lib/business-days";

const none = new Set<string>();
const thanksgiving2026 = new Set(["2026-11-26"]);

describe("businessDaysBetween", () => {
  it("counts business days after the start, through the end", () => {
    expect(businessDaysBetween("2026-11-09", "2026-11-16", none)).toBe(5); // Mon -> next Mon
    expect(businessDaysBetween("2026-11-13", "2026-11-16", none)).toBe(1); // Fri -> Mon
    expect(businessDaysBetween("2026-11-10", "2026-11-10", none)).toBe(0);
    expect(businessDaysBetween("2026-11-16", "2026-11-09", none)).toBe(-5);
  });
  it("skips holidays", () => {
    expect(businessDaysBetween("2026-11-23", "2026-11-27", none)).toBe(4);
    expect(businessDaysBetween("2026-11-23", "2026-11-27", thanksgiving2026)).toBe(3);
  });
});

describe("addBusinessDays", () => {
  it("moves across weekends and holidays in both directions", () => {
    expect(addBusinessDays("2026-11-13", 1, none)).toBe("2026-11-16");
    expect(addBusinessDays("2026-11-25", 1, thanksgiving2026)).toBe("2026-11-27");
    expect(addBusinessDays("2026-11-16", -1, none)).toBe("2026-11-13");
    expect(businessDaysBetween("2026-11-02", addBusinessDays("2026-11-02", 20, thanksgiving2026), thanksgiving2026)).toBe(20);
  });
});

describe("isFastStart", () => {
  it("is a fast start below 20 business days", () => {
    const assigned = "2026-11-02";
    const day19 = addBusinessDays(assigned, 19, none);
    const day20 = addBusinessDays(assigned, 20, none);
    expect(isFastStart(assigned, day19, none)).toBe(true);
    expect(isFastStart(assigned, day20, none)).toBe(false);
  });
  it("counts a first input already past as a fast start", () => {
    expect(isFastStart("2026-11-10", "2026-11-01", none)).toBe(true);
  });
});

describe("usFederalHolidays", () => {
  it("returns the 2026 observed dates", () => {
    const dates = Object.fromEntries(usFederalHolidays(2026).map((h) => [h.name, h.date]));
    expect(dates["New Year's Day"]).toBe("2026-01-01");
    expect(dates["Martin Luther King Jr. Day"]).toBe("2026-01-19");
    expect(dates["Presidents' Day"]).toBe("2026-02-16");
    expect(dates["Memorial Day"]).toBe("2026-05-25");
    expect(dates["Juneteenth"]).toBe("2026-06-19");
    expect(dates["Independence Day (observed)"]).toBe("2026-07-03"); // Jul 4 is a Saturday
    expect(dates["Labor Day"]).toBe("2026-09-07");
    expect(dates["Columbus Day"]).toBe("2026-10-12");
    expect(dates["Veterans Day"]).toBe("2026-11-11");
    expect(dates["Thanksgiving Day"]).toBe("2026-11-26");
    expect(dates["Christmas Day"]).toBe("2026-12-25");
  });
  it("moves Sunday holidays to Monday", () => {
    const dates = usFederalHolidays(2027).map((h) => h.date);
    expect(dates).toContain("2027-06-18"); // Juneteenth on Saturday -> Friday
    expect(dates).toContain("2027-07-05"); // Independence Day on Sunday -> Monday
    expect(dates).toContain("2027-12-24"); // Christmas on Saturday -> Friday
  });
  it("only produces weekdays", () => {
    for (const year of [2026, 2027, 2028, 2029]) {
      for (const h of usFederalHolidays(year)) expect(isBusinessDay(h.date, none)).toBe(true);
    }
  });
});
