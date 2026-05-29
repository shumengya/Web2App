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

  const data = (await readJson(response)) as CreateBuildResponse;
  if (!response.ok) {
    throw new Error(data.error ?? "上传失败");
  }
  return data;
}

export async function fetchBuild(id: string): Promise<Build> {
  const response = await fetch(apiUrl(`/api/builds/${id}`));
  const data = (await readJson(response)) as Build;
  if (!response.ok) {
    const errorData = data as Build & ApiErrorResponse;
    throw new Error(errorData.error ?? "Failed to load build");
  }
  return data;
}

export async function fetchBuilds(): Promise<Build[]> {
  const response = await fetch(apiUrl("/api/builds"));
  const data = (await readJson(response)) as { builds: Build[] };
  if (!response.ok) {
    throw new Error("Failed to load builds");
  }
  return data.builds;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Unexpected response from server: ${text.slice(0, 200)}`);
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
