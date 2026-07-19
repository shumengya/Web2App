import type { Env } from "./env";
import { handleBuildsRequest } from "./routes/builds";
import {
  corsPreflightResponse,
  jsonResponseWithCors,
} from "./lib/response";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);

      if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
        return corsPreflightResponse(request);
      }

      if (url.pathname === "/api/health") {
        return jsonResponseWithCors(request, { ok: true });
      }

      if (url.pathname.startsWith("/api/builds")) {
        return await handleBuildsRequest(request, env, url);
      }

      // 静态资源 / SPA 回退（需 wrangler.toml [assets] binding = "ASSETS"）
      if (!env.ASSETS) {
        return jsonResponseWithCors(
          request,
          {
            error:
              "ASSETS binding is not configured. Set [assets] binding = \"ASSETS\" in wrangler.toml and redeploy.",
          },
          500,
        );
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error("Unhandled worker error:", error);
      return jsonResponseWithCors(
        request,
        {
          error:
            error instanceof Error
              ? error.message
              : "Internal server error",
        },
        500,
      );
    }
  },
};
