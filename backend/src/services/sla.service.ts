/**
 * SLA Engine — Pure business-hours calculation service.
 *
 * Rules (from project context):
 *  - Business hours: Monday–Friday, 09:00–18:00 (9 h/day)
 *  - Timezone:       Configurable (defaults to UTC)
 *  - Exclusions:     Weekends + configurable public holidays → 0 hours
 *  - Out-of-hours:   Clock starts at 09:00 of the NEXT valid business day
 *
 * SLA Policies:
 *  URGENT  → 1 h first-response / 4 h resolution
 *  HIGH    → 4 h / 24 h
 *  MEDIUM  → 8 h / 48 h
 *  LOW     → 24 h / 72 h
 *
 * SLA State thresholds:
 *  ON_TRACK : 0 – 75 % of budget consumed
 *  AT_RISK  : > 75 % consumed (but deadline not yet passed)
 *  BREACHED : wall-clock "now" >= target deadline
 */

import { DateTime } from "luxon";

// ─── Constants ───────────────────────────────────────────────────────────────

const BUSINESS_START_HOUR = 9; // 09:00 inclusive
const BUSINESS_END_HOUR = 18; // 18:00 exclusive

// ─── Public types ────────────────────────────────────────────────────────────

export type SLAState = "ON_TRACK" | "AT_RISK" | "BREACHED";

export interface SLAStatus {
  state: SLAState;
  targetDate: Date;
  remainingBusinessMinutes: number;
  percentageConsumed: number;
}

// SLA budgets from context.md
export const SLA_POLICIES = {
  URGENT: { firstResponseHours: 1, resolutionHours: 4 },
  HIGH: { firstResponseHours: 4, resolutionHours: 24 },
  MEDIUM: { firstResponseHours: 8, resolutionHours: 48 },
  LOW: { firstResponseHours: 24, resolutionHours: 72 },
} as const;

export type Priority = keyof typeof SLA_POLICIES;

// ─── Private helpers ─────────────────────────────────────────────────────────

/** Returns true if the Luxon DateTime falls on Saturday (6) or Sunday (7). */
function isWeekend(dt: DateTime): boolean {
  return dt.weekday >= 6;
}

/**
 * Returns true if the Luxon DateTime's calendar day matches any holiday.
 * Comparison is done at the "start-of-day" level within the given timezone,
 * so the time component of each holiday Date is irrelevant.
 */
function isHoliday(dt: DateTime, holidays: Date[], timezone: string): boolean {
  const dayStart = dt.startOf("day").valueOf();
  return holidays.some((h) => {
    const hDay = DateTime.fromJSDate(h, { zone: timezone })
      .startOf("day")
      .valueOf();
    return hDay === dayStart;
  });
}

/** Returns true only if the day is Mon–Fri AND not a public holiday. */
function isBusinessDay(
  dt: DateTime,
  holidays: Date[],
  timezone: string
): boolean {
  return !isWeekend(dt) && !isHoliday(dt, holidays, timezone);
}

/** 09:00 on the same calendar day as `dt`. */
function dayBusinessStart(dt: DateTime): DateTime {
  return dt.startOf("day").set({ hour: BUSINESS_START_HOUR });
}

/** 18:00 on the same calendar day as `dt`. */
function dayBusinessEnd(dt: DateTime): DateTime {
  return dt.startOf("day").set({ hour: BUSINESS_END_HOUR });
}

/**
 * Given any DateTime, return the start of the next calendar day that is
 * a valid business day (Mon–Fri, not a holiday), at 09:00 in that timezone.
 */
function nextBusinessDayStart(
  dt: DateTime,
  holidays: Date[],
  timezone: string
): DateTime {
  // Advance at least one calendar day, then keep skipping until a business day.
  let candidate = dt
    .startOf("day")
    .plus({ days: 1 })
    .set({ hour: BUSINESS_START_HOUR });

  while (!isBusinessDay(candidate, holidays, timezone)) {
    candidate = candidate.plus({ days: 1 });
  }

  return candidate;
}

/**
 * Clamp `startDate` to the earliest valid business moment:
 *  - Weekend / holiday           → next business day 09:00
 *  - Before 09:00 on a weekday  → same day 09:00
 *  - At or after 18:00           → next business day 09:00
 *  - Within 09:00–18:00          → as-is
 */
function getEffectiveStart(
  startDate: Date,
  holidays: Date[],
  timezone: string
): DateTime {
  const dt = DateTime.fromJSDate(startDate, { zone: timezone });

  if (!isBusinessDay(dt, holidays, timezone)) {
    return nextBusinessDayStart(dt, holidays, timezone);
  }

  const start = dayBusinessStart(dt);
  const end = dayBusinessEnd(dt);

  if (dt < start) return start;
  if (dt >= end) return nextBusinessDayStart(dt, holidays, timezone);

  return dt;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Calculate the wall-clock Date by which `budgetInBusinessHours` of business
 * time will have elapsed since `startDate`, respecting holidays and timezone.
 *
 * @param startDate             When the SLA clock begins (UTC JS Date)
 * @param budgetInBusinessHours Total business-hour budget
 * @param holidays              Array of JS Dates representing holiday days
 * @param timezone              IANA timezone string (e.g. "Asia/Kolkata")
 */
export function calculateSLATargetDate(
  startDate: Date,
  budgetInBusinessHours: number,
  holidays: Date[] = [],
  timezone = "UTC"
): Date {
  let remainingMinutes = budgetInBusinessHours * 60;
  let current = getEffectiveStart(startDate, holidays, timezone);

  while (remainingMinutes > 0) {
    const end = dayBusinessEnd(current);
    const minutesLeftToday = end.diff(current, "minutes").minutes;

    if (remainingMinutes <= minutesLeftToday) {
      // Budget exhausted within this business day
      current = current.plus({ minutes: remainingMinutes });
      remainingMinutes = 0;
    } else {
      // Consume the rest of today and advance to the next business day
      remainingMinutes -= minutesLeftToday;
      current = nextBusinessDayStart(current, holidays, timezone);
    }
  }

  return current.toJSDate();
}

/**
 * Count how many business minutes elapsed between `from` and `to`,
 * using the same effective-start clamping as `calculateSLATargetDate`.
 *
 * Returns 0 if `to` is before or at the effective start.
 */
export function calculateElapsedBusinessMinutes(
  from: Date,
  to: Date,
  holidays: Date[] = [],
  timezone = "UTC"
): number {
  const effectiveFrom = getEffectiveStart(from, holidays, timezone);
  const todt = DateTime.fromJSDate(to, { zone: timezone });

  if (todt <= effectiveFrom) return 0;

  let current = effectiveFrom;
  let elapsed = 0;

  while (current < todt) {
    // Safety: if we somehow land on a non-business day, skip ahead
    if (!isBusinessDay(current, holidays, timezone)) {
      current = nextBusinessDayStart(current, holidays, timezone);
      continue;
    }

    const end = dayBusinessEnd(current);

    // Accumulate up to whichever comes first: `to` or end-of-business-day
    const periodEnd = todt < end ? todt : end;
    elapsed += periodEnd.diff(current, "minutes").minutes;

    if (todt <= end) break; // `to` falls within today → done

    current = nextBusinessDayStart(current, holidays, timezone);
  }

  return Math.round(elapsed);
}

/**
 * Calculate the full SLA status for a ticket.
 *
 * @param startDate             When the ticket was created
 * @param budgetInBusinessHours The SLA budget in business hours
 * @param holidays              Public holidays to exclude
 * @param timezone              IANA timezone string
 * @param now                   Override "now" (useful for testing)
 */
export function calculateSLAStatus(
  startDate: Date,
  budgetInBusinessHours: number,
  holidays: Date[] = [],
  timezone = "UTC",
  now: Date = new Date()
): SLAStatus {
  const budgetMinutes = budgetInBusinessHours * 60;
  const targetDate = calculateSLATargetDate(
    startDate,
    budgetInBusinessHours,
    holidays,
    timezone
  );

  const nowdt = DateTime.fromJSDate(now, { zone: timezone });
  const targetdt = DateTime.fromJSDate(targetDate, { zone: timezone });

  // Wall-clock breach: deadline has already passed
  if (nowdt >= targetdt) {
    return {
      state: "BREACHED",
      targetDate,
      remainingBusinessMinutes: 0,
      percentageConsumed: 100,
    };
  }

  const elapsedMinutes = calculateElapsedBusinessMinutes(
    startDate,
    now,
    holidays,
    timezone
  );

  const percentageConsumed = (elapsedMinutes / budgetMinutes) * 100;
  const remainingBusinessMinutes = Math.max(0, budgetMinutes - elapsedMinutes);

  // > 75 % consumed but not yet breached → AT_RISK
  const state: SLAState = percentageConsumed > 75 ? "AT_RISK" : "ON_TRACK";

  return {
    state,
    targetDate,
    remainingBusinessMinutes,
    percentageConsumed,
  };
}
