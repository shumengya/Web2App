import "../load-env.js";
import { Octokit } from "octokit";

function getGitHubConfig() {
  return {
    owner: (process.env.GITHUB_OWNER ?? "").trim(),
    repo: (process.env.GITHUB_REPO ?? "").trim(),
    token: (process.env.GITHUB_TOKEN ?? "").trim(),
  };
}

function getOctokit(): Octokit {
  const { owner, repo, token } = getGitHubConfig();
  if (!owner || !repo || !token) {
    throw new Error(
      "Missing GITHUB_OWNER, GITHUB_REPO, or GITHUB_TOKEN environment variables",
    );
  }
  return new Octokit({ auth: token });
}

export function getRepoInfo() {
  const { owner, repo } = getGitHubConfig();
  return { owner, repo };
}

export async function uploadSiteZip(jobId: string, zipBuffer: Buffer): Promise<void> {
  const { owner, repo } = getGitHubConfig();
  const octokit = getOctokit();
  const path = `builds/${jobId}/site.zip`;
  const content = zipBuffer.toString("base64");

  try {
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: `chore: upload site for build ${jobId}`,
      content,
    });
  } catch (error: unknown) {
    const status = (error as { status?: number }).status;
    if (status !== 422) throw error;

    const existing = await octokit.rest.repos.getContent({ owner, repo, path });
    if (Array.isArray(existing.data) || existing.data.type !== "file") {
      throw new Error(`Unexpected content at ${path}`);
    }

    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: `chore: update site for build ${jobId}`,
      content,
      sha: existing.data.sha,
    });
  }
}

export async function triggerBuildWorkflow(input: {
  jobId: string;
  appName: string;
  appIdentifier: string;
}): Promise<number> {
  const { owner, repo } = getGitHubConfig();
  const octokit = getOctokit();

  await octokit.rest.actions.createWorkflowDispatch({
    owner,
    repo,
    workflow_id: "build-app.yml",
    ref: process.env.DEFAULT_BRANCH ?? "main",
    inputs: {
      job_id: input.jobId,
      app_name: input.appName,
      app_identifier: input.appIdentifier,
    },
  });

  await sleep(3000);

  const since = new Date(Date.now() - 120_000).toISOString();
  const runs = await octokit.rest.actions.listWorkflowRuns({
    owner,
    repo,
    workflow_id: "build-app.yml",
    event: "workflow_dispatch",
    per_page: 10,
  });

  const run = runs.data.workflow_runs
    .filter((item) => item.created_at >= since)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )[0];

  if (!run) {
    throw new Error("Failed to locate workflow run after dispatch");
  }

  return run.id;
}

export async function getWorkflowRun(runId: number) {
  const { owner, repo } = getGitHubConfig();
  const octokit = getOctokit();
  const { data } = await octokit.rest.actions.getWorkflowRun({
    owner,
    repo,
    run_id: runId,
  });
  return data;
}

export async function getReleaseAssets(jobId: string): Promise<{
  windowsUrl: string | null;
  androidUrl: string | null;
}> {
  const { owner, repo } = getGitHubConfig();
  const octokit = getOctokit();
  const tag = `build-${jobId}`;

  try {
    const { data: release } = await octokit.rest.repos.getReleaseByTag({
      owner,
      repo,
      tag,
    });

    let windowsUrl: string | null = null;
    let androidUrl: string | null = null;

    for (const asset of release.assets) {
      const name = asset.name.toLowerCase();
      if (
        !windowsUrl &&
        (name.endsWith(".exe") ||
          name.endsWith(".msi") ||
          name.includes("windows"))
      ) {
        windowsUrl = asset.browser_download_url;
      }
      if (
        !androidUrl &&
        (name.endsWith(".apk") || name.includes("android"))
      ) {
        androidUrl = asset.browser_download_url;
      }
    }

    return { windowsUrl, androidUrl };
  } catch {
    return { windowsUrl: null, androidUrl: null };
  }
}

export function getActionsRunUrl(runId: number | null): string | null {
  const { owner, repo } = getGitHubConfig();
  if (!runId || !owner || !repo) return null;
  return `https://github.com/${owner}/${repo}/actions/runs/${runId}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
