import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { startDueRun } from "@/lib/agent/schedule";
import { scheduledCheck } from "@/lib/google/sync";
import { sweepFinishedJobs } from "@/lib/jobs/retention";
import { recoverInterruptedJobs, STALE_JOB_MS } from "@/lib/jobs/runner";
import { logServerError } from "@/lib/log";
import { startDueStartupsRefresh } from "@/lib/startups/schedule";

// On Vercel nothing runs between requests, so the timers instrumentation.ts
// starts on a server are this one daily cron (vercel.json) instead. The jobs
// it queues finish under the runner's waitUntil(). Nightly backups stay off:
// a function's disk doesn't outlive it.

export const maxDuration = 300;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const TASKS: [string, () => Promise<unknown>][] = [
  ["interrupted jobs", () => recoverInterruptedJobs(STALE_JOB_MS)],
  ["job sweep", () => sweepFinishedJobs()],
  ["job agent schedule", () => startDueRun()],
  ["startups schedule", () => startDueStartupsRefresh()],
  ["inbox check", () => scheduledCheck()],
];

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  const ran: Record<string, "ok" | "failed"> = {};
  for (const [name, task] of TASKS) {
    try {
      await task();
      ran[name] = "ok";
    } catch (error) {
      logServerError(name, error);
      ran[name] = "failed";
    }
  }
  return NextResponse.json(ran, { headers: { "cache-control": "no-store" } });
}
