import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchBuilds, statusLabel, type Build } from "../api/client";
import { getBuildDuration, isBuildFinished } from "../lib/duration";

export default function BuildList() {
  const [builds, setBuilds] = useState<Build[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBuilds()
      .then(setBuilds)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "加载失败"),
      );
  }, []);

  return (
    <>
      <h1 className="page-title">构建记录</h1>
      <p className="page-lead">最近 20 条构建任务。</p>

      <section className="doc-section">
        {error ? <p className="error-text">{error}</p> : null}
        {!error && builds.length === 0 ? (
          <p className="prose">暂无构建记录。</p>
        ) : null}
        {builds.length > 0 ? (
          <ul className="build-list">
            {builds.map((build) => (
              <li key={build.id}>
                <Link to={`/jobs/${build.id}`}>
                  {build.appName} ({build.appNameEn})
                </Link>
                <div className="meta-line">
                  v{build.appVersion} · {statusLabel(build.status)}
                  {isBuildFinished(build.status)
                    ? ` · 耗时 ${getBuildDuration(build).text}`
                    : null}{" "}
                  · {new Date(build.createdAt).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </>
  );
}
