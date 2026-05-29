import { Link, Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header-inner">
          <Link to="/" className="site-brand">
            Web2App
          </Link>
          <nav className="site-nav">
            <Link to="/">新建构建</Link>
            <Link to="/jobs">构建记录</Link>
          </nav>
        </div>
      </header>
      <main className="site-main">
        <div className="content">
          <Outlet />
        </div>
      </main>
      <footer className="site-footer">
        静态网页 zip → Windows / Android 原生应用
      </footer>
    </div>
  );
}
