import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "../lib/upload-limits";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export type BuildStatus =
  | "pending"
  | "queued"
  | "in_progress"
  | "completed"
  | "failed";

export interface Build {
  id: string;
  appName: string;
  appNameEn: string;
  appIdentifier: string;
  appVersion: string;
  status: BuildStatus;
  workflowRunId: number | null;
  windowsUrl: string | null;
  androidUrl: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  actionsUrl?: string | null;
}

interface ApiErrorResponse {
  error?: string;
}

interface CreateBuildResponse {
  id: string;
  error?: string;
}

function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export function assertUploadSize(file: File): void {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`zip 不能超过 ${MAX_UPLOAD_MB}MB，请压缩后重试`);
  }
}

export async function createBuild(formData: FormData): Promise<{ id: string }> {
  let response: Response;
  try {
    response = await fetch(apiUrl("/api/builds"), {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new Error(
      "无法连接后端，请确认已运行 npm run dev 且 wrangler 已启动",
    );
  }

  const data = (await readResponseBody(response)) as CreateBuildResponse;
  if (!response.ok) {
    throw new Error(data.error ?? "上传失败");
  }
  return data;
}

export async function fetchBuild(id: string): Promise<Build> {
  const response = await fetch(apiUrl(`/api/builds/${id}`));
  const data = (await readResponseBody(response)) as Build;
  if (!response.ok) {
    const errorData = data as Build & ApiErrorResponse;
    throw new Error(errorData.error ?? "Failed to load build");
  }
  return data;
}

export async function fetchBuilds(): Promise<Build[]> {
  const response = await fetch(apiUrl("/api/builds"));
  const data = (await readResponseBody(response)) as { builds: Build[] };
  if (!response.ok) {
    throw new Error("Failed to load builds");
  }
  return data.builds;
}

function parseCloudflareHtmlError(status: number, text: string): string {
  const codeMatch = text.match(/cloudflare[^0-9]*(\d{4})/i);
  const cfCode = codeMatch?.[1];

  if (status === 413) {
    return `上传体积过大（HTTP 413），请压缩 zip 到 ${MAX_UPLOAD_MB}MB 以内`;
  }
  if (status === 502 || status === 503 || status === 524) {
    return `服务器处理超时或暂时不可用（HTTP ${status}）。请缩小 zip 体积后重试，或稍后再试`;
  }
  if (cfCode === "1102" || text.includes("1102")) {
    return "Worker CPU 时间超限（Cloudflare 1102）。请缩小 zip 或升级 Workers 付费套餐";
  }
  if (cfCode === "1101" || text.includes("1101")) {
    return "Worker 运行时错误（Cloudflare 1101）。请检查 zip 是否损坏，或查看部署日志";
  }

  return `服务器返回了错误页面（HTTP ${status}），通常因 zip 过大或 Worker 超时。请压缩到 ${MAX_UPLOAD_MB}MB 以内后重试`;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};

  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      /* fall through */
    }
  }

  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    throw new Error(parseCloudflareHtmlError(response.status, text));
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error(
      `服务器返回了无法解析的响应（HTTP ${response.status}）：${text.slice(0, 120)}`,
    );
  }
}

export function statusLabel(status: BuildStatus): string {
  switch (status) {
    case "pending":
      return "准备中";
    case "queued":
      return "排队中";
    case "in_progress":
      return "构建中";
    case "completed":
      return "已完成";
    case "failed":
      return "失败";
    default:
      return status;
  }
}
