import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchBuild, statusLabel, type Build } from "../api";

export default function JobStatus() {
  const { id } = useParams<{ id: string }>();
  const [build, setBuild] = useState<Build | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (!id) {
    return <p className="error">缺少任务 ID</p>;
  }

  return (
    <section className="card">
      <div className="status-header">
        <h2>构建任务</h2>
        <Link to="/">返回上传</Link>
      </div>

      {error ? <p className="error">{error}</p> : null}

      {build ? (
        <>
          <dl className="meta">
            <div>
              <dt>任务 ID</dt>
              <dd>{build.id}</dd>
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
              <dd>{build.appIdentifier}</dd>
            </div>
            <div>
              <dt>状态</dt>
              <dd>
                <span className={`badge badge-${build.status}`}>
                  {statusLabel(build.status)}
                </span>
              </dd>
            </div>
          </dl>

          {build.status === "completed" ? (
            <div className="downloads">
              <h3>下载安装包</h3>
              <div className="download-actions">
                {build.windowsUrl ? (
                  <a className="button" href={build.windowsUrl} target="_blank" rel="noreferrer">
                    下载 Windows 版
                  </a>
                ) : (
                  <span className="muted">Windows 安装包尚未就绪</span>
                )}
                {build.androidUrl ? (
                  <a className="button secondary" href={build.androidUrl} target="_blank" rel="noreferrer">
                    下载 Android 版
                  </a>
                ) : (
                  <span className="muted">Android 安装包尚未就绪</span>
                )}
              </div>
            </div>
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
            <p className="hint">正在轮询 GitHub Actions 状态，请稍候...</p>
          ) : null}
        </>
      ) : (
        <p className="hint">加载任务信息...</p>
      )}
    </section>
  );
}
