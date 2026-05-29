import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchBuild, statusLabel, type Build } from "../api/client";
import {
  formatDateTime,
  getBuildDuration,
  isBuildFinished,
} from "../lib/duration";

export default function JobStatus() {
  const { id } = useParams<{ id: string }>();
  const [build, setBuild] = useState<Build | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    async function poll() {
      try {
        const data = await fetchBuild(id!);
        if (cancelled) return;
        setBuild(data);
        setError(null);

        if (data.status === "completed" || data.status === "failed") {
          return;
        }

        window.setTimeout(poll, 5000);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "加载失败");
        window.setTimeout(poll, 5000);
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!build || isBuildFinished(build.status)) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [build?.status, build?.id]);

  const duration = build ? getBuildDuration(build, now) : null;

  if (!id) {
    return <p className="error-text">缺少任务 ID</p>;
  }

  return (
    <>
      <div className="status-toolbar">
        <h1 className="page-title" style={{ margin: 0 }}>
          构建任务
        </h1>
        <Link to="/">返回上传</Link>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="doc-section">
        {build ? (
          <>
            <dl className="meta-list">
              <div>
                <dt>任务 ID</dt>
                <dd>
                  <code>{build.id}</code>
                </dd>
              </div>
              <div>
                <dt>应用中文名</dt>
                <dd>{build.appName}</dd>
              </div>
              <div>
                <dt>应用英文名</dt>
                <dd>{build.appNameEn}</dd>
              </div>
              <div>
                <dt>Bundle ID</dt>
                <dd>
                  <code>{build.appIdentifier}</code>
                </dd>
              </div>
              <div>
                <dt>版本号</dt>
                <dd>
                  <code>{build.appVersion}</code>
                </dd>
              </div>
              <div>
                <dt>状态</dt>
                <dd>
                  <span className={`badge badge-${build.status}`}>
                    {statusLabel(build.status)}
                  </span>
                </dd>
              </div>
              <div>
                <dt>开始时间</dt>
                <dd>{formatDateTime(build.createdAt)}</dd>
              </div>
              {duration?.finished ? (
                <div>
                  <dt>结束时间</dt>
                  <dd>{formatDateTime(build.updatedAt)}</dd>
                </div>
              ) : null}
              <div>
                <dt>{duration?.finished ? "构建总耗时" : "已用时间"}</dt>
                <dd>
                  <strong>{duration?.text ?? "—"}</strong>
                </dd>
              </div>
            </dl>

            {build.status === "completed" ? (
              <>
                <h3>下载安装包</h3>
                <div className="download-row">
                  {build.windowsUrl ? (
                    <a
                      className="btn btn-primary"
                      href={build.windowsUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      下载 Windows 版
                    </a>
                  ) : (
                    <span className="muted">Windows 安装包尚未就绪</span>
                  )}
                  {build.androidUrl ? (
                    <a
                      className="btn btn-secondary"
                      href={build.androidUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      下载 Android 版
                    </a>
                  ) : (
                    <span className="muted">Android 安装包尚未就绪</span>
                  )}
                </div>
              </>
            ) : null}

            {build.status === "failed" ? (
              <div className="error-box">
                <p>{build.error ?? "构建失败，请查看 GitHub Actions 日志。"}</p>
                {build.actionsUrl ? (
                  <a href={build.actionsUrl} target="_blank" rel="noreferrer">
                    查看 Actions 日志
                  </a>
                ) : null}
              </div>
            ) : null}

            {build.status !== "completed" && build.status !== "failed" ? (
              <p className="prose" style={{ marginTop: "1rem" }}>
                正在轮询 GitHub Actions 状态，请稍候…
              </p>
            ) : null}
          </>
        ) : (
          <p className="prose">加载任务信息…</p>
        )}
      </section>
    </>
  );
}
