export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  GITHUB_TOKEN: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  DEFAULT_BRANCH?: string;
  MAX_UPLOAD_MB?: string;
}
