import type { Build, BuildStatus } from "../api/client";

function parseDbDate(value: string): number {
  const normalized = value.includes("T")
    ? value
    : `${value.replace(" ", "T")}Z`;
  const ms = Date.parse(normalized);
  return Number.isNaN(ms) ? Date.now() : ms;
}

export function formatDurationMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  if (totalSec < 60) {
    return `${totalSec} 秒`;
  }

  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) {
    return sec > 0 ? `${min} 分 ${sec} 秒` : `${min} 分`;
  }

  const hour = Math.floor(min / 60);
  const remMin = min % 60;
  return remMin > 0 ? `${hour} 小时 ${remMin} 分` : `${hour} 小时`;
}

export function isBuildFinished(status: BuildStatus): boolean {
  return status === "completed" || status === "failed";
}

export function getBuildDuration(
  build: Pick<Build, "createdAt" | "updatedAt" | "status">,
  now = Date.now(),
): { ms: number; text: string; finished: boolean } {
  const start = parseDbDate(build.createdAt);
  const finished = isBuildFinished(build.status);
  const end = finished ? parseDbDate(build.updatedAt) : now;
  const ms = Math.max(0, end - start);

  return {
    ms,
    finished,
    text: finished
      ? formatDurationMs(ms)
      : `${formatDurationMs(ms)}（进行中）`,
  };
}

export function formatDateTime(value: string): string {
  return new Date(parseDbDate(value)).toLocaleString();
}
