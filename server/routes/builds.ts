import { Router } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import {
  getBuild,
  insertBuild,
  listBuilds,
  toPublicBuild,
  updateBuild,
  type BuildStatus,
} from "../db/index.js";
import {
  getActionsRunUrl,
  getReleaseAssets,
  getWorkflowRun,
  triggerBuildWorkflow,
  uploadSiteZip,
} from "../services/github.js";
import {
  normalizeAppIdentifier,
  slugifyIdentifier,
  validateChineseAppName,
  validateEnglishAppName,
  validateZipBuffer,
  ZipValidationError,
} from "../services/zip.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

const maxUploadMb = Number(process.env.MAX_UPLOAD_MB ?? "50");
const maxUploadBytes = maxUploadMb * 1024 * 1024;

export const buildsRouter = Router();

buildsRouter.get("/", (_req, res) => {
  const builds = listBuilds().map(toPublicBuild);
  res.json({ builds });
});

buildsRouter.get("/:id", async (req, res) => {
  const record = getBuild(req.params.id);
  if (!record) {
    res.status(404).json({ error: "Build not found" });
    return;
  }

  const refreshed = await refreshBuildStatus(record);
  res.json({
    ...toPublicBuild(refreshed),
    actionsUrl: getActionsRunUrl(refreshed.workflow_run_id),
  });
});

buildsRouter.post("/", upload.single("file"), async (req, res) => {
  try {
    const appNameZh = validateChineseAppName(
      String(req.body.appNameZh ?? req.body.appName ?? ""),
    );
    const appNameEn = validateEnglishAppName(
      String(req.body.appNameEn ?? ""),
    );
    const identifierInput = String(req.body.identifier ?? "").trim();

    if (!req.file) {
      res.status(400).json({ error: "file is required" });
      return;
    }

    if (!req.file.originalname.toLowerCase().endsWith(".zip")) {
      res.status(400).json({ error: "Only .zip files are supported" });
      return;
    }

    const { normalizedBuffer } = validateZipBuffer(req.file.buffer, maxUploadBytes);
    const jobId = nanoid(10);
    const slug = slugifyIdentifier(appNameEn) || jobId.toLowerCase();
    const appIdentifier = normalizeAppIdentifier(
      identifierInput || `com.web2app.${slug}`,
    );

    insertBuild({
      id: jobId,
      appName: appNameZh,
      appNameEn,
      appIdentifier,
    });

    await uploadSiteZip(jobId, normalizedBuffer);
    updateBuild(jobId, { status: "queued" });

    const workflowRunId = await triggerBuildWorkflow({
      jobId,
      appName: appNameZh,
      appNameEn,
      appIdentifier,
    });

    updateBuild(jobId, {
      workflow_run_id: workflowRunId,
      status: "in_progress",
    });

    res.status(201).json({
      id: jobId,
      status: "in_progress",
      workflowRunId,
    });
  } catch (error) {
    if (error instanceof ZipValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }

    console.error(error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to create build",
    });
  }
});

async function refreshBuildStatus(record: ReturnType<typeof getBuild> & object) {
  if (!record.workflow_run_id) return record;
  if (record.status === "completed" || record.status === "failed") {
    return record;
  }

  try {
    const run = await getWorkflowRun(record.workflow_run_id);

    if (run.status === "queued") {
      return updateBuild(record.id, { status: "queued" }) ?? record;
    }

    if (run.status === "in_progress") {
      return updateBuild(record.id, { status: "in_progress" }) ?? record;
    }

    if (run.status === "completed") {
      if (run.conclusion === "success") {
        const assets = await getReleaseAssets(record.id);
        return (
          updateBuild(record.id, {
            status: "completed",
            windows_url: assets.windowsUrl,
            android_url: assets.androidUrl,
            error:
              assets.windowsUrl && assets.androidUrl
                ? null
                : "Build finished but release assets were not found yet",
          }) ?? record
        );
      }

      return (
        updateBuild(record.id, {
          status: "failed",
          error: `Workflow failed with conclusion: ${run.conclusion ?? "unknown"}`,
        }) ?? record
      );
    }

    return record;
  } catch (error) {
    return (
      updateBuild(record.id, {
        status: "failed",
        error: error instanceof Error ? error.message : "Status refresh failed",
      }) ?? record
    );
  }
}

export function buildPublicMeta(record: ReturnType<typeof getBuild>) {
  if (!record) return null;
  return {
    ...toPublicBuild(record),
    actionsUrl: getActionsRunUrl(record.workflow_run_id),
  };
}

export type { BuildStatus };
