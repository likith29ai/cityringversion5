"use client";

import { useEffect, useState } from "react";

/**
 * Group Validity helpers (isolated feature).
 * - All timestamps are stored in the DB as timestamptz (UTC instant).
 * - All admin input and public display use Asia/Kolkata (IST, UTC+05:30, no DST).
 */

export type ValidityFields = {
  validity_enabled?: boolean | null;
  start_at?: string | null;
  expires_at?: string | null;
};

export type ValidityStatus = "upcoming" | "active" | "expiring_soon" | "expired";

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
export const EXPIRING_SOON_DAYS = 5;

/** "2026-11-10T10:00" (an IST wall-clock value from <input type=datetime-local>) -> ISO string with +05:30 */
export function istInputToIso(value: string): string | null {
  if (!value) return null;
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  const d = new Date(`${withSeconds}+05:30`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** ISO/timestamptz string -> "YYYY-MM-DDTHH:mm" in IST, for <input type=datetime-local> */
export function isoToIstInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "";
  return new Date(t + IST_OFFSET_MS).toISOString().slice(0, 16);
}

/** Current time as an IST datetime-local string, plus optional days offset */
export function nowIstInput(addDays = 0): string {
  const t = Date.now() + addDays * DAY_MS + IST_OFFSET_MS;
  return new Date(t).toISOString().slice(0, 16);
}

/** Add days to an IST datetime-local string, returns an IST datetime-local string */
export function addDaysToIstInput(value: string, days: number): string {
  const iso = istInputToIso(value);
  if (!iso) return value;
  return isoToIstInput(new Date(new Date(iso).getTime() + days * DAY_MS).toISOString());
}

/** e.g. "10 November 2026, 10:00 AM" (IST) */
export function formatIst(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const date = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(d)
    .toUpperCase();
  return `${date}, ${time}`;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Duration between two instants, e.g. "30 Days", "30 Days 4 Hours", "5 Hours 30 Minutes" */
export function formatDuration(startIso: string | null | undefined, endIso: string | null | undefined): string {
  if (!startIso || !endIso) return "";
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (isNaN(ms) || ms <= 0) return "";
  const days = Math.floor(ms / DAY_MS);
  const hours = Math.floor((ms % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((ms % HOUR_MS) / MINUTE_MS);
  const parts: string[] = [];
  if (days) parts.push(plural(days, "Day"));
  if (hours) parts.push(plural(hours, "Hour"));
  if (!days && minutes) parts.push(plural(minutes, "Minute"));
  return parts.length ? parts.join(" ") : "Less than a minute";
}

/** Remaining time as "29 Days 14 Hours 32 Minutes" (seconds shown only in the last hour) */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return "0 Minutes";
  const days = Math.floor(ms / DAY_MS);
  const hours = Math.floor((ms % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((ms % HOUR_MS) / MINUTE_MS);
  const seconds = Math.floor((ms % MINUTE_MS) / 1000);
  if (days > 0) return `${plural(days, "Day")} ${plural(hours, "Hour")} ${plural(minutes, "Minute")}`;
  if (hours > 0) return `${plural(hours, "Hour")} ${plural(minutes, "Minute")}`;
  return `${plural(minutes, "Minute")} ${plural(seconds, "Second")}`;
}

/** true only when validity is switched on AND both timestamps exist */
export function hasValidity(g: ValidityFields | null | undefined): boolean {
  return !!(g && g.validity_enabled && g.start_at && g.expires_at);
}

/** Status computed purely from timestamps + the current time. Returns null when validity is disabled. */
export function getValidityStatus(g: ValidityFields | null | undefined, nowMs: number = Date.now()): ValidityStatus | null {
  if (!hasValidity(g)) return null;
  const start = new Date(g!.start_at as string).getTime();
  const end = new Date(g!.expires_at as string).getTime();
  if (isNaN(start) || isNaN(end)) return null;
  if (nowMs < start) return "upcoming";
  if (nowMs >= end) return "expired";
  if (end - nowMs <= EXPIRING_SOON_DAYS * DAY_MS) return "expiring_soon";
  return "active";
}

/** True when a join request must be refused (upcoming or expired). */
export function isJoinBlocked(status: ValidityStatus | null): boolean {
  return status === "upcoming" || status === "expired";
}

/** Re-render on an interval. Pass 0 to disable (no timer is created). */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!intervalMs) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0); // refresh immediately when the timer (re)starts
    const t = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [intervalMs]);
  return now;
}
