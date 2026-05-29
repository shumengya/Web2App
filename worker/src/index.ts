import type { Env } from "./env";
import { handleBuildsRequest } from "./routes/builds";
import { jsonResponse } from "./lib/response";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return jsonResponse({ ok: true });
    }

    if (url.pathname.startsWith("/api/builds")) {
      return handleBuildsRequest(request, env, url);
    }

    return env.ASSETS.fetch(request);
  },
};
