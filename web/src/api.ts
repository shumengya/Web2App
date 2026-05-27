export type BuildStatus =
  | "pending"
  | "queued"
  | "in_progress"
  | "completed"
  | "failed";

export interface Build {
  id: string;
  appName: string;
  appIdentifier: string;
  status: BuildStatus;
  workflowRunId: number | null;
  windowsUrl: string | null;
  androidUrl: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  actionsUrl?: string | null;
}

export async function createBuild(formData: FormData): Promise<{ id: string }> {
  const response = await fetch("/api/builds", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Upload failed");
  }
  return data;
}

export async function fetchBuild(id: string): Promise<Build> {
  const response = await fetch(`/api/builds/${id}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to load build");
  }
  return data;
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
