import { customAlphabet } from "nanoid";

// GitHub published releases reject tag names ending with '-'.
const generateJobId = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  10,
);
import type { Env } from "../env";
import {
  getBuild,
  insertBuild,
  listBuilds,
  toPublicBuild,
  updateBuild,
  type BuildRecord,
} from "../db/builds";
import { jsonResponseWithCors } from "../lib/response";
import {
  getActionsRunUrl,
  getReleaseAssets,
  getWorkflowRun,
  triggerBuildWorkflow,
  uploadBuildFile,
  uploadSiteZip,
} from "../services/github";
import { IconValidationError, resolveIconUpload } from "../services/icon";
import {
  validateAppVersion,
  VersionValidationError,
} from "../services/version";
import {
  normalizeAppIdentifier,
  slugifyIdentifier,
  validateChineseAppName,
  validateEnglishAppName,
  validateZipBuffer,
  ZipValidationError,
} from "../services/zip";

function apiJson(
  request: Request,
  data: unknown,
  status = 200,
): Response {
  return jsonResponseWithCors(request, data, status);
}

function apiError(request: Request, message: string, status: number): Response {
  return jsonResponseWithCors(request, { error: message }, status);
}

function maxUploadBytes(env: Env): number {
  const mb = Number(env.MAX_UPLOAD_MB ?? "50");
  return mb * 1024 * 1024;
}

export async function handleBuildsRequest(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  const path = url.pathname;

  if (path === "/api/builds" && request.method === "GET") {
    const builds = (await listBuilds(env)).map(toPublicBuild);
    return apiJson(request, { builds });
  }

  const match = path.match(/^\/api\/builds\/([^/]+)$/);
  if (match) {
    const id = match[1];

    if (request.method === "GET") {
      const record = await getBuild(env, id);
      if (!record) {
        return apiError(request, "Build not found", 404);
      }

      const refreshed = await refreshBuildStatus(env, record);
      return apiJson(request, {
        ...toPublicBuild(refreshed),
        actionsUrl: getActionsRunUrl(env, refreshed.workflow_run_id),
      });
    }

    return apiError(request, "Method not allowed", 405);
  }

  if (path === "/api/builds" && request.method === "POST") {
    return createBuild(request, env);
  }

  return apiError(request, "Not found", 404);
}

async function createBuild(request: Request, env: Env): Promise<Response> {
  try {
    const formData = await request.formData();
    const appNameZh = validateChineseAppName(
      String(formData.get("appNameZh") ?? formData.get("appName") ?? ""),
    );
    const appNameEn = validateEnglishAppName(
      String(formData.get("appNameEn") ?? ""),
    );
    const identifierInput = String(formData.get("identifier") ?? "").trim();
    const appVersion = validateAppVersion(
      String(formData.get("appVersion") ?? ""),
    );

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return apiError(request, "file is required", 400);
    }

    if (!file.name.toLowerCase().endsWith(".zip")) {
      return apiError(request, "Only .zip files are supported", 400);
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    const { normalizedBuffer } = validateZipBuffer(buffer, maxUploadBytes(env));
    const jobId = generateJobId();
    const slug = slugifyIdentifier(appNameEn) || jobId.toLowerCase();
    const appIdentifier = normalizeAppIdentifier(
      identifierInput || `com.web2app.${slug}`,
    );

    await insertBuild(env, {
      id: jobId,
      appName: appNameZh,
      appNameEn,
      appIdentifier,
      appVersion,
    });

    await uploadSiteZip(env, jobId, normalizedBuffer);
    await uploadBuildFile(
      env,
      jobId,
      "version.txt",
      new TextEncoder().encode(appVersion),
    );

    const iconFile = formData.get("icon");
    if (iconFile instanceof File && iconFile.size > 0) {
      const iconBuffer = new Uint8Array(await iconFile.arrayBuffer());
      const { repoPath } = resolveIconUpload(iconFile, iconBuffer);
      await uploadBuildFile(env, jobId, repoPath, iconBuffer);
    }

    await updateBuild(env, jobId, { status: "queued" });

    const workflowRunId = await triggerBuildWorkflow(env, {
      jobId,
      appName: appNameZh,
      appNameEn,
      appIdentifier,
      appVersion,
    });

    await updateBuild(env, jobId, {
      workflow_run_id: workflowRunId,
      status: "in_progress",
    });

    return apiJson(
      request,
      {
        id: jobId,
        status: "in_progress",
        workflowRunId,
      },
      201,
    );
  } catch (error) {
    if (
      error instanceof ZipValidationError ||
      error instanceof VersionValidationError ||
      error instanceof IconValidationError
    ) {
      return apiError(request, error.message, 400);
    }

    console.error(error);
    return apiError(
      request,
      error instanceof Error ? error.message : "Failed to create build",
      500,
    );
  }
}

async function refreshBuildStatus(
  env: Env,
  record: BuildRecord,
): Promise<BuildRecord> {
  if (!record.workflow_run_id) return record;
  if (record.status === "completed" || record.status === "failed") {
    return record;
  }

  try {
    const run = await getWorkflowRun(env, record.workflow_run_id);

    if (run.status === "queued") {
      return (await updateBuild(env, record.id, { status: "queued" })) ?? record;
    }

    if (run.status === "in_progress") {
      return (
        (await updateBuild(env, record.id, { status: "in_progress" })) ?? record
      );
    }

    if (run.status === "completed") {
      if (run.conclusion === "success") {
        const assets = await getReleaseAssets(env, record.id);
        return (
          (await updateBuild(env, record.id, {
            status: "completed",
            windows_url: assets.windowsUrl,
            android_url: assets.androidUrl,
            error:
              assets.windowsUrl && assets.androidUrl
                ? null
                : "Build finished but release assets were not found yet",
          })) ?? record
        );
      }

      return (
        (await updateBuild(env, record.id, {
          status: "failed",
          error: `Workflow failed with conclusion: ${run.conclusion ?? "unknown"}`,
        })) ?? record
      );
    }

    return record;
  } catch (error) {
    return (
      (await updateBuild(env, record.id, {
        status: "failed",
        error: error instanceof Error ? error.message : "Status refresh failed",
      })) ?? record
    );
  }
}
