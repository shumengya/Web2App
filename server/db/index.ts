import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type BuildStatus =
  | "pending"
  | "queued"
  | "in_progress"
  | "completed"
  | "failed";

export interface BuildRecord {
  id: string;
  app_name: string;
  app_identifier: string;
  status: BuildStatus;
  workflow_run_id: number | null;
  windows_url: string | null;
  android_url: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dataDir = path.resolve(__dirname, "../../data");
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "web2app.db");
  db = new Database(dbPath);
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  db.exec(schema);
  return db;
}

export function insertBuild(record: {
  id: string;
  appName: string;
  appIdentifier: string;
}): BuildRecord {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO builds (id, app_name, app_identifier, status)
       VALUES (@id, @appName, @appIdentifier, 'pending')`,
    )
    .run(record);

  return getBuild(record.id)!;
}

export function getBuild(id: string): BuildRecord | null {
  const row = getDb()
    .prepare("SELECT * FROM builds WHERE id = ?")
    .get(id) as BuildRecord | undefined;
  return row ?? null;
}

export function listBuilds(limit = 20): BuildRecord[] {
  return getDb()
    .prepare("SELECT * FROM builds ORDER BY created_at DESC LIMIT ?")
    .all(limit) as BuildRecord[];
}

export function updateBuild(
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
): BuildRecord | null {
  const fields: string[] = [];
  const params: Record<string, unknown> = { id };

  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      fields.push(`${key} = @${key}`);
      params[key] = value;
    }
  }

  if (fields.length === 0) return getBuild(id);

  fields.push("updated_at = datetime('now')");
  getDb()
    .prepare(`UPDATE builds SET ${fields.join(", ")} WHERE id = @id`)
    .run(params);

  return getBuild(id);
}

export function toPublicBuild(record: BuildRecord) {
  return {
    id: record.id,
    appName: record.app_name,
    appIdentifier: record.app_identifier,
    status: record.status,
    workflowRunId: record.workflow_run_id,
    windowsUrl: record.windows_url,
    androidUrl: record.android_url,
    error: record.error,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}
