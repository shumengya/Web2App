import type { Env } from "./env";
import { handleBuildsRequest } from "./routes/builds";
import {
  corsPreflightResponse,
  jsonResponseWithCors,
} from "./lib/response";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return corsPreflightResponse(request);
    }

    if (url.pathname === "/api/health") {
      return jsonResponseWithCors(request, { ok: true });
    }

    if (url.pathname.startsWith("/api/builds")) {
      return handleBuildsRequest(request, env, url);
    }

    return env.ASSETS.fetch(request);
  },
};
