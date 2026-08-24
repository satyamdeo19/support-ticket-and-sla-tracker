/**
 * Unit tests for the SLA Engine (sla.service.ts).
 *
 * All dates are pinned to UTC to eliminate DST ambiguity:
 *   2024-01-08 (Mon)  2024-01-09 (Tue)  2024-01-10 (Wed)
 *   2024-01-11 (Thu)  2024-01-12 (Fri)  2024-01-13 (Sat)
 *   2024-01-14 (Sun)  2024-01-15 (Mon)  2024-01-16 (Tue)
 *
 * Run with: bun run test
 */

import { describe, it, expect } from "vitest";
import {
  calculateSLATargetDate,
  calculateElapsedBusinessMinutes,
  calculateSLAStatus,
  SLA_POLICIES,
} from "../../src/services/sla.service";

// Shorthand: parse an ISO string into a JS Date
const d = (iso: string): Date => new Date(iso);
const TZ = "UTC";

// ─── calculateSLATargetDate ───────────────────────────────────────────────────

describe("calculateSLATargetDate", () => {
  // ── Normal weekday ──────────────────────────────────────────────────────────

  it("normal weekday: Mon 10:00 + 4 h → Mon 14:00", () => {
    const result = calculateSLATargetDate(
      d("2024-01-08T10:00:00.000Z"),
      4,
      [],
      TZ
    );
    expect(result).toEqual(d("2024-01-08T14:00:00.000Z"));
  });

  it("budget fits exactly in one day: Mon 09:00 + 9 h → Mon 18:00", () => {
    const result = calculateSLATargetDate(
      d("2024-01-08T09:00:00.000Z"),
      9,
      [],
      TZ
    );
    expect(result).toEqual(d("2024-01-08T18:00:00.000Z"));
  });

  it("URGENT policy (1 h): Mon 09:00 + 1 h → Mon 10:00", () => {
    const { firstResponseHours } = SLA_POLICIES.URGENT;
    const result = calculateSLATargetDate(
      d("2024-01-08T09:00:00.000Z"),
      firstResponseHours,
      [],
      TZ
    );
    expect(result).toEqual(d("2024-01-08T10:00:00.000Z"));
  });

  // ── Before business hours ───────────────────────────────────────────────────

  it("before hours: Mon 07:00 → effective start Mon 09:00, +4 h = Mon 13:00", () => {
    const result = calculateSLATargetDate(
      d("2024-01-08T07:00:00.000Z"),
      4,
      [],
      TZ
    );
    expect(result).toEqual(d("2024-01-08T13:00:00.000Z"));
  });

  it("before hours: Mon 00:00 → Mon 09:00, +4 h = Mon 13:00", () => {
    const result = calculateSLATargetDate(
      d("2024-01-08T00:00:00.000Z"),
      4,
      [],
      TZ
    );
    expect(result).toEqual(d("2024-01-08T13:00:00.000Z"));
  });

  // ── After business hours ────────────────────────────────────────────────────

  it("after hours: Mon 20:00 → effective start Tue 09:00, +4 h = Tue 13:00", () => {
    const result = calculateSLATargetDate(
      d("2024-01-08T20:00:00.000Z"),
      4,
      [],
      TZ
    );
    expect(result).toEqual(d("2024-01-09T13:00:00.000Z"));
  });

  it("exactly at business end: Mon 18:00 → effective start Tue 09:00, +1 h = Tue 10:00", () => {
    const result = calculateSLATargetDate(
      d("2024-01-08T18:00:00.000Z"),
      1,
      [],
      TZ
    );
    expect(result).toEqual(d("2024-01-09T10:00:00.000Z"));
  });

  // ── Friday evening edge case ────────────────────────────────────────────────

  it("Friday edge: Fri 17:00 + 4 h → 1 h Fri + 3 h Mon = Mon 12:00", () => {
    // Fri 17:00–18:00 = 1 h consumed; remaining 3 h spill to Mon 09:00–12:00
    const result = calculateSLATargetDate(
      d("2024-01-12T17:00:00.000Z"),
      4,
      [],
      TZ
    );
    expect(result).toEqual(d("2024-01-15T12:00:00.000Z"));
  });

  it("Friday edge: Fri 16:00 + 4 h → 2 h Fri + 2 h Mon = Mon 11:00", () => {
    const result = calculateSLATargetDate(
      d("2024-01-12T16:00:00.000Z"),
      4,
      [],
      TZ
    );
    expect(result).toEqual(d("2024-01-15T11:00:00.000Z"));
  });

  // ── Weekend creation ────────────────────────────────────────────────────────

  it("Saturday creation: Sat 10:00 → Mon 09:00, +4 h = Mon 13:00", () => {
    const result = calculateSLATargetDate(
      d("2024-01-13T10:00:00.000Z"),
      4,
      [],
      TZ
    );
    expect(result).toEqual(d("2024-01-15T13:00:00.000Z"));
  });

  it("Sunday creation: Sun 10:00 → Mon 09:00, +4 h = Mon 13:00", () => {
    const result = calculateSLATargetDate(
      d("2024-01-14T10:00:00.000Z"),
      4,
      [],
      TZ
    );
    expect(result).toEqual(d("2024-01-15T13:00:00.000Z"));
  });

  // ── Multi-day budget ────────────────────────────────────────────────────────

  it("multi-day: Mon 10:00 + 20 h → 8 h Mon + 9 h Tue + 3 h Wed = Wed 12:00", () => {
    const result = calculateSLATargetDate(
      d("2024-01-08T10:00:00.000Z"),
      20,
      [],
      TZ
    );
    expect(result).toEqual(d("2024-01-10T12:00:00.000Z"));
  });

  it("full week: Mon 09:00 + 45 h (= 5 business days) → Fri 18:00 same week", () => {
    // 5 days × 9 h = 45 h → exhausted exactly at end of Friday
    const result = calculateSLATargetDate(
      d("2024-01-08T09:00:00.000Z"),
      45,
      [],
      TZ
    );
    expect(result).toEqual(d("2024-01-12T18:00:00.000Z")); // Friday 18:00
  });

  // ── Public holiday spanning ─────────────────────────────────────────────────

  it("holiday: Sat creation, Mon is holiday → effective Tue 09:00, +4 h = Tue 13:00", () => {
    const monHoliday = [d("2024-01-15T00:00:00.000Z")]; // Mon Jan 15 is a holiday
    const result = calculateSLATargetDate(
      d("2024-01-13T10:00:00.000Z"), // Saturday
      4,
      monHoliday,
      TZ
    );
    expect(result).toEqual(d("2024-01-16T13:00:00.000Z")); // Tuesday
  });

  it("holiday mid-calc: Fri 17:00 + 4 h, Mon holiday → 1 h Fri + 3 h Tue = Tue 12:00", () => {
    const monHoliday = [d("2024-01-15T00:00:00.000Z")]; // Mon Jan 15 is a holiday
    const result = calculateSLATargetDate(
      d("2024-01-12T17:00:00.000Z"), // Friday 17:00
      4,
      monHoliday,
      TZ
    );
    expect(result).toEqual(d("2024-01-16T12:00:00.000Z")); // Tuesday 12:00
  });

  it("consecutive holidays: Mon + Tue are holidays → effective start Wed 09:00", () => {
    const twoHolidays = [
      d("2024-01-15T00:00:00.000Z"), // Mon
      d("2024-01-16T00:00:00.000Z"), // Tue
    ];
    const result = calculateSLATargetDate(
      d("2024-01-13T00:00:00.000Z"), // Saturday
      4,
      twoHolidays,
      TZ
    );
    expect(result).toEqual(d("2024-01-17T13:00:00.000Z")); // Wednesday 13:00
  });
});

// ─── calculateElapsedBusinessMinutes ─────────────────────────────────────────

describe("calculateElapsedBusinessMinutes", () => {
  it("same day: Mon 10:00 → Mon 12:00 = 120 min", () => {
    expect(
      calculateElapsedBusinessMinutes(
        d("2024-01-08T10:00:00.000Z"),
        d("2024-01-08T12:00:00.000Z"),
        [],
        TZ
      )
    ).toBe(120);
  });

  it("from before hours → effective start 09:00: 07:00→11:00 = 120 min", () => {
    // Effective from = 09:00, so only 09:00–11:00 = 120 min counted
    expect(
      calculateElapsedBusinessMinutes(
        d("2024-01-08T07:00:00.000Z"),
        d("2024-01-08T11:00:00.000Z"),
        [],
        TZ
      )
    ).toBe(120);
  });

  it("overnight: Mon 17:00 → Tue 10:00 = 60 min Mon + 60 min Tue = 120 min", () => {
    expect(
      calculateElapsedBusinessMinutes(
        d("2024-01-08T17:00:00.000Z"),
        d("2024-01-09T10:00:00.000Z"),
        [],
        TZ
      )
    ).toBe(120);
  });

  it("spanning weekend: Fri 17:00 → Mon 10:00 = 60 min Fri + 60 min Mon = 120 min", () => {
    expect(
      calculateElapsedBusinessMinutes(
        d("2024-01-12T17:00:00.000Z"),
        d("2024-01-15T10:00:00.000Z"),
        [],
        TZ
      )
    ).toBe(120);
  });

  it("full business day: Mon 09:00 → Mon 18:00 = 540 min", () => {
    expect(
      calculateElapsedBusinessMinutes(
        d("2024-01-08T09:00:00.000Z"),
        d("2024-01-08T18:00:00.000Z"),
        [],
        TZ
      )
    ).toBe(540);
  });

  it("to before effective from → 0 min", () => {
    expect(
      calculateElapsedBusinessMinutes(
        d("2024-01-08T12:00:00.000Z"),
        d("2024-01-08T10:00:00.000Z"),
        [],
        TZ
      )
    ).toBe(0);
  });

  it("same instant → 0 min", () => {
    const t = d("2024-01-08T10:00:00.000Z");
    expect(calculateElapsedBusinessMinutes(t, t, [], TZ)).toBe(0);
  });

  it("after-hours `to` capped at 18:00: Mon 09:00 → Mon 20:00 = 540 min", () => {
    expect(
      calculateElapsedBusinessMinutes(
        d("2024-01-08T09:00:00.000Z"),
        d("2024-01-08T20:00:00.000Z"),
        [],
        TZ
      )
    ).toBe(540);
  });

  it("holiday excluded: Fri 17:00 → Tue 10:00 with Mon holiday = 60 + 60 = 120 min", () => {
    const monHoliday = [d("2024-01-15T00:00:00.000Z")];
    expect(
      calculateElapsedBusinessMinutes(
        d("2024-01-12T17:00:00.000Z"),
        d("2024-01-16T10:00:00.000Z"),
        monHoliday,
        TZ
      )
    ).toBe(120);
  });
});

// ─── calculateSLAStatus ───────────────────────────────────────────────────────

describe("calculateSLAStatus", () => {
  // 4 h = 240 min budget; start Mon 09:00; target Mon 13:00

  it("ON_TRACK: 0% consumed at effective start", () => {
    const { state, percentageConsumed, remainingBusinessMinutes } =
      calculateSLAStatus(
        d("2024-01-08T09:00:00.000Z"),
        4,
        [],
        TZ,
        d("2024-01-08T09:00:00.000Z")
      );
    expect(state).toBe("ON_TRACK");
    expect(percentageConsumed).toBeCloseTo(0);
    expect(remainingBusinessMinutes).toBe(240);
  });

  it("ON_TRACK: 50% consumed (2 h of 4 h)", () => {
    const { state, percentageConsumed, remainingBusinessMinutes } =
      calculateSLAStatus(
        d("2024-01-08T09:00:00.000Z"),
        4,
        [],
        TZ,
        d("2024-01-08T11:00:00.000Z") // 2 h elapsed
      );
    expect(state).toBe("ON_TRACK");
    expect(percentageConsumed).toBeCloseTo(50);
    expect(remainingBusinessMinutes).toBe(120);
  });

  it("ON_TRACK: exactly 75% consumed (3 h of 4 h) — boundary, still ON_TRACK", () => {
    const { state } = calculateSLAStatus(
      d("2024-01-08T09:00:00.000Z"),
      4,
      [],
      TZ,
      d("2024-01-08T12:00:00.000Z") // 3 h = 75%
    );
    expect(state).toBe("ON_TRACK"); // > 75% needed for AT_RISK
  });

  it("AT_RISK: 75.4% consumed (181 min of 240 min)", () => {
    const { state, percentageConsumed } = calculateSLAStatus(
      d("2024-01-08T09:00:00.000Z"),
      4,
      [],
      TZ,
      d("2024-01-08T12:01:00.000Z") // 3 h 1 min = 181 min ≈ 75.4%
    );
    expect(state).toBe("AT_RISK");
    expect(percentageConsumed).toBeGreaterThan(75);
  });

  it("AT_RISK: 80% consumed (192 min of 240 min)", () => {
    const { state } = calculateSLAStatus(
      d("2024-01-08T09:00:00.000Z"),
      4,
      [],
      TZ,
      d("2024-01-08T12:12:00.000Z") // 3 h 12 min = 192 min = 80%
    );
    expect(state).toBe("AT_RISK");
  });

  it("BREACHED: now is past targetDate", () => {
    const { state, remainingBusinessMinutes, percentageConsumed } =
      calculateSLAStatus(
        d("2024-01-08T09:00:00.000Z"),
        4,
        [],
        TZ,
        d("2024-01-08T14:00:00.000Z") // past the Mon 13:00 target
      );
    expect(state).toBe("BREACHED");
    expect(remainingBusinessMinutes).toBe(0);
    expect(percentageConsumed).toBe(100);
  });

  it("BREACHED: much later, same result", () => {
    const { state } = calculateSLAStatus(
      d("2024-01-08T09:00:00.000Z"),
      4,
      [],
      TZ,
      d("2024-01-10T12:00:00.000Z") // days later
    );
    expect(state).toBe("BREACHED");
  });

  // ── Full state-transition sequence ──────────────────────────────────────────

  it("state transitions: ON_TRACK → AT_RISK → BREACHED over time", () => {
    const start = d("2024-01-08T09:00:00.000Z"); // 4 h budget → target 13:00

    // 30 min elapsed → 12.5% → ON_TRACK
    expect(
      calculateSLAStatus(start, 4, [], TZ, d("2024-01-08T09:30:00.000Z")).state
    ).toBe("ON_TRACK");

    // 2 h elapsed → 50% → ON_TRACK
    expect(
      calculateSLAStatus(start, 4, [], TZ, d("2024-01-08T11:00:00.000Z")).state
    ).toBe("ON_TRACK");

    // 3 h 1 min → just over 75% → AT_RISK
    expect(
      calculateSLAStatus(start, 4, [], TZ, d("2024-01-08T12:01:00.000Z")).state
    ).toBe("AT_RISK");

    // Past 13:00 → BREACHED
    expect(
      calculateSLAStatus(start, 4, [], TZ, d("2024-01-08T13:01:00.000Z")).state
    ).toBe("BREACHED");
  });

  // ── remainingBusinessMinutes decrements correctly ──────────────────────────

  it("remainingBusinessMinutes: 240 → 180 → 120 as time passes", () => {
    const start = d("2024-01-08T09:00:00.000Z");

    const at1h = calculateSLAStatus(
      start,
      4,
      [],
      TZ,
      d("2024-01-08T10:00:00.000Z")
    );
    expect(at1h.remainingBusinessMinutes).toBe(180);

    const at2h = calculateSLAStatus(
      start,
      4,
      [],
      TZ,
      d("2024-01-08T11:00:00.000Z")
    );
    expect(at2h.remainingBusinessMinutes).toBe(120);
  });

  // ── Holiday + SLA state ────────────────────────────────────────────────────

  it("BREACHED with holiday: target pushed to Tue, now past Tue target", () => {
    const monHoliday = [d("2024-01-15T00:00:00.000Z")];
    // Sat creation + Mon holiday → effective start Tue 09:00, 4 h → Tue 13:00
    const { state } = calculateSLAStatus(
      d("2024-01-13T10:00:00.000Z"), // Saturday
      4,
      monHoliday,
      TZ,
      d("2024-01-16T14:00:00.000Z") // Tue 14:00 → past Tue 13:00
    );
    expect(state).toBe("BREACHED");
  });

  it("ON_TRACK with holiday: target on Tue, now still on Tue before target", () => {
    const monHoliday = [d("2024-01-15T00:00:00.000Z")];
    const { state } = calculateSLAStatus(
      d("2024-01-13T10:00:00.000Z"), // Saturday
      4,
      monHoliday,
      TZ,
      d("2024-01-16T10:00:00.000Z") // Tue 10:00 → 1 h into the 4 h window = 25%
    );
    expect(state).toBe("ON_TRACK");
  });

  // ── Friday evening + SLA state ─────────────────────────────────────────────

  it("AT_RISK spanning weekend: Fri 17:00 + 4 h budget, checked Mon 11:30", () => {
    // effective start: Fri 17:00; target: Mon 12:00
    // Mon 11:30 → 1 h Fri + 2.5 h Mon = 3.5 h / 4 h = 87.5% → AT_RISK
    const { state } = calculateSLAStatus(
      d("2024-01-12T17:00:00.000Z"),
      4,
      [],
      TZ,
      d("2024-01-15T11:30:00.000Z")
    );
    expect(state).toBe("AT_RISK");
  });
});
