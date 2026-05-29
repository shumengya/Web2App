import type { Env } from "../env";

export type BuildStatus =
  | "pending"
  | "queued"
  | "in_progress"
  | "completed"
  | "failed";

export interface BuildRecord {
  id: string;
  app_name: string;
  app_name_en: string;
  app_identifier: string;
  app_version: string;
  status: BuildStatus;
  workflow_run_id: number | null;
  windows_url: string | null;
  android_url: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export async function insertBuild(
  env: Env,
  record: {
    id: string;
    appName: string;
    appNameEn: string;
    appIdentifier: string;
    appVersion: string;
  },
): Promise<BuildRecord> {
  await env.DB.prepare(
    `INSERT INTO builds (id, app_name, app_name_en, app_identifier, app_version, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
  )
    .bind(
      record.id,
      record.appName,
      record.appNameEn,
      record.appIdentifier,
      record.appVersion,
    )
    .run();

  const row = await getBuild(env, record.id);
  if (!row) throw new Error("Failed to insert build");
  return row;
}

export async function getBuild(
  env: Env,
  id: string,
): Promise<BuildRecord | null> {
  const row = await env.DB.prepare("SELECT * FROM builds WHERE id = ?")
    .bind(id)
    .first<BuildRecord>();
  return row ?? null;
}

export async function listBuilds(
  env: Env,
  limit = 20,
): Promise<BuildRecord[]> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM builds ORDER BY created_at DESC LIMIT ?",
  )
    .bind(limit)
    .all<BuildRecord>();
  return results ?? [];
}

export async function updateBuild(
  env: Env,
  id: string,
  patch: Partial<
    Pick<
      BuildRecord,
      | "status"
      | "workflow_run_id"
      | "windows_url"
      | "android_url"
      | "error"
    >
  >,
): Promise<BuildRecord | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return getBuild(env, id);

  fields.push("updated_at = datetime('now')");
  values.push(id);

  await env.DB.prepare(
    `UPDATE builds SET ${fields.join(", ")} WHERE id = ?`,
  )
    .bind(...values)
    .run();

  return getBuild(env, id);
}

export function toPublicBuild(record: BuildRecord) {
  return {
    id: record.id,
    appName: record.app_name,
    appNameEn: record.app_name_en || record.app_name,
    appIdentifier: record.app_identifier,
    appVersion: record.app_version || "1.0.0",
    status: record.status,
    workflowRunId: record.workflow_run_id,
    windowsUrl: record.windows_url,
    androidUrl: record.android_url,
    error: record.error,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}
