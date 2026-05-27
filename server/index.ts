import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildsRouter } from "./routes/builds.js";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

const app = express();
const port = Number(process.env.PORT ?? "3001");

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/builds", buildsRouter);

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

app.listen(port, () => {
  console.log(`Web2App server listening on http://localhost:${port}`);
});
