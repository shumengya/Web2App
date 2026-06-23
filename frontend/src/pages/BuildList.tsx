import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchBuilds, statusLabel, type Build } from "../api/client";
import { getBuildDuration, isBuildFinished } from "../lib/duration";

export default function BuildList() {
  const [builds, setBuilds] = useState<Build[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedPkg, setSelectedPkg] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetchBuilds()
      .then(setBuilds)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "加载失败"),
      );
  }, []);

  const packages = useMemo(() => {
    const map = new Map<
      string,
      { appName: string; latestAt: string; count: number }
    >();
    for (const b of builds) {
      const existing = map.get(b.appIdentifier);
      if (!existing) {
        map.set(b.appIdentifier, {
          appName: b.appName,
          latestAt: b.createdAt,
          count: 1,
        });
      } else {
        existing.count++;
        if (b.createdAt > existing.latestAt) {
          existing.latestAt = b.createdAt;
          existing.appName = b.appName;
        }
      }
    }
    return [...map.entries()]
      .sort((a, b) => b[1].latestAt.localeCompare(a[1].latestAt))
      .map(([appIdentifier, { appName, count }]) => ({
        appIdentifier,
        appName,
        count,
      }));
  }, [builds]);

  const filtered = selectedPkg
    ? builds.filter((b) => b.appIdentifier === selectedPkg)
    : builds;

  function selectPkg(pkg: string | null) {
    setSelectedPkg(pkg);
    setSidebarOpen(false);
  }

  return (
    <div className="builds-layout">
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`builds-sidebar${sidebarOpen ? " sidebar-open" : ""}`}>
        <div className="sidebar-header">
          <span className="sidebar-title">包名筛选</span>
          <button
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="关闭侧边栏"
          >
            ✕
          </button>
        </div>
        <ul className="pkg-list">
          <li>
            <button
              className={`pkg-item${!selectedPkg ? " pkg-item-active" : ""}`}
              onClick={() => selectPkg(null)}
            >
              <span className="pkg-info">
                <span className="pkg-name">全部</span>
              </span>
              <span className="pkg-count">{builds.length}</span>
            </button>
          </li>
          {packages.map(({ appIdentifier, appName, count }) => (
            <li key={appIdentifier}>
              <button
                className={`pkg-item${selectedPkg === appIdentifier ? " pkg-item-active" : ""}`}
                onClick={() => selectPkg(appIdentifier)}
              >
                <span className="pkg-info">
                  <span className="pkg-name">{appName}</span>
                  <span className="pkg-en">{appIdentifier}</span>
                </span>
                <span className="pkg-count">{count}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="builds-main">
        <div className="builds-topbar">
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(true)}
            aria-label="打开包名筛选"
          >
            ☰
          </button>
          <h1 className="page-title">构建记录</h1>
        </div>
        <p className="page-lead">
          {selectedPkg
            ? `${selectedPkg} 的构建记录`
            : "最近 20 条构建任务。"}
        </p>

        <section className="doc-section">
          {error ? <p className="error-text">{error}</p> : null}
          {!error && filtered.length === 0 ? (
            <p className="prose">暂无构建记录。</p>
          ) : null}
          {filtered.length > 0 ? (
            <ul className="build-list">
              {filtered.map((build) => (
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
      </div>
    </div>
  );
}
