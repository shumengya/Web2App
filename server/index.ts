import "./load-env.js";
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MulterError } from "multer";
import { buildsRouter } from "./routes/builds.js";

const app = express();
const port = Number(process.env.PORT ?? "3001");

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/builds", buildsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof MulterError) {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    res.status(status).json({ error: err.message });
    return;
  }

  if (err instanceof Error) {
    console.error(err);
    res.status(500).json({ error: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const webDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../web/dist");
app.use(express.static(webDist));
app.get("*", (_req, res, next) => {
  if (_req.path.startsWith("/api")) {
    next();
    return;
  }
  res.sendFile(path.join(webDist, "index.html"), (err) => {
    if (err) next();
  });
});

app.listen(port, "127.0.0.1", () => {
  console.log(`Web2App server listening on http://127.0.0.1:${port}`);
});
