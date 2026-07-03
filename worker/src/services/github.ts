import type { Env } from "../env";

function getGitHubConfig(env: Env) {
  return {
    owner: (env.GITHUB_OWNER ?? "").trim(),
    repo: (env.GITHUB_REPO ?? "").trim(),
    token: (env.GITHUB_TOKEN ?? "").trim(),
    branch: (env.DEFAULT_BRANCH ?? "main").trim(),
  };
}

function assertGitHubConfig(env: Env) {
  const { owner, repo, token } = getGitHubConfig(env);
  if (!owner || !repo || !token) {
    throw new Error(
      "Missing GITHUB_OWNER, GITHUB_REPO, or GITHUB_TOKEN configuration",
    );
  }
  return { owner, repo, token };
}

async function githubFetch(
  env: Env,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const { token } = assertGitHubConfig(env);
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "web2app-worker",
      ...(init?.headers ?? {}),
    },
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function uploadBuildFile(
  env: Env,
  jobId: string,
  relativePath: string,
  fileBuffer: Uint8Array,
): Promise<void> {
  const { owner, repo } = assertGitHubConfig(env);
  const path = `builds/${jobId}/${relativePath}`;
  const content = bytesToBase64(fileBuffer);

  const put = async (sha?: string) => {
    const body: Record<string, string> = {
      message: sha
        ? `chore: update ${relativePath} for build ${jobId}`
        : `chore: upload ${relativePath} for build ${jobId}`,
      content,
    };
    if (sha) body.sha = sha;

    return githubFetch(env, `/repos/${owner}/${repo}/contents/${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  };

  let response = await put();
  if (response.status === 422) {
    const getResponse = await githubFetch(
      env,
      `/repos/${owner}/${repo}/contents/${path}`,
    );
    if (!getResponse.ok) {
      const text = await getResponse.text();
      throw new Error(`GitHub get content failed (${getResponse.status}): ${text}`);
    }

    const existing = (await getResponse.json()) as {
      sha?: string;
      type?: string;
    };
    if (!existing.sha || existing.type !== "file") {
      throw new Error(`Unexpected content at ${path}`);
    }

    response = await put(existing.sha);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub upload failed (${response.status}): ${text}`);
  }
}

export async function uploadSiteZip(
  env: Env,
  jobId: string,
  zipBuffer: Uint8Array,
): Promise<void> {
  return uploadBuildFile(env, jobId, "site.zip", zipBuffer);
}

export async function triggerBuildWorkflow(
  env: Env,
  input: {
    jobId: string;
    appName: string;
    appNameEn: string;
    appIdentifier: string;
    appVersion: string;
  },
): Promise<number> {
  const { owner, repo, branch } = getGitHubConfig(env);
  assertGitHubConfig(env);

  const dispatchResponse = await githubFetch(
    env,
    `/repos/${owner}/${repo}/actions/workflows/build-app.yml/dispatches`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ref: branch,
        inputs: {
          job_id: input.jobId,
          app_name: input.appName,
          app_name_en: input.appNameEn,
          app_identifier: input.appIdentifier,
          app_version: input.appVersion,
        },
      }),
    },
  );

  if (!dispatchResponse.ok) {
    const text = await dispatchResponse.text();
    throw new Error(
      `Workflow dispatch failed (${dispatchResponse.status}): ${text}`,
    );
  }

  await sleep(3000);

  const since = new Date(Date.now() - 120_000).toISOString();
  const runsResponse = await githubFetch(
    env,
    `/repos/${owner}/${repo}/actions/workflows/build-app.yml/runs?event=workflow_dispatch&per_page=10`,
  );

  if (!runsResponse.ok) {
    const text = await runsResponse.text();
    throw new Error(`Failed to list workflow runs: ${text}`);
  }

  const runsData = (await runsResponse.json()) as {
    workflow_runs: Array<{ id: number; created_at: string }>;
  };

  const run = runsData.workflow_runs
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

export async function getWorkflowRun(env: Env, runId: number) {
  const { owner, repo } = assertGitHubConfig(env);
  const response = await githubFetch(
    env,
    `/repos/${owner}/${repo}/actions/runs/${runId}`,
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get workflow run: ${text}`);
  }

  return (await response.json()) as {
    status: string;
    conclusion: string | null;
  };
}

export async function getReleaseAssets(
  env: Env,
  jobId: string,
): Promise<{
  windowsUrl: string | null;
  androidUrl: string | null;
}> {
  const { owner, repo } = assertGitHubConfig(env);
  const tag = `build-${jobId}`;

  const response = await githubFetch(
    env,
    `/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`,
  );

  if (!response.ok) {
    return { windowsUrl: null, androidUrl: null };
  }

  const release = (await response.json()) as {
    assets: Array<{ name: string; browser_download_url: string }>;
  };

  let windowsInstallerUrl: string | null = null;
  let windowsFallbackUrl: string | null = null;
  let androidUrl: string | null = null;

  for (const asset of release.assets) {
    const name = asset.name.toLowerCase();
    if (name.endsWith("-setup.exe") || name.endsWith(".msi")) {
      windowsInstallerUrl = asset.browser_download_url;
    } else if (
      !windowsFallbackUrl &&
      name.endsWith(".exe")
    ) {
      windowsFallbackUrl = asset.browser_download_url;
    }
    if (
      !androidUrl &&
      (name.endsWith(".apk") || name.includes("android"))
    ) {
      androidUrl = asset.browser_download_url;
    }
  }

  return {
    windowsUrl: windowsInstallerUrl ?? windowsFallbackUrl,
    androidUrl,
  };
}

export function getActionsRunUrl(env: Env, runId: number | null): string | null {
  const { owner, repo } = getGitHubConfig(env);
  if (!runId || !owner || !repo) return null;
  return `https://github.com/${owner}/${repo}/actions/runs/${runId}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
