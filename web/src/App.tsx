import { Route, Routes } from "react-router-dom";
import JobStatus from "./pages/JobStatus";
import Upload from "./pages/Upload";

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Web2App</p>
          <h1>静态网页转原生应用</h1>
        </div>
        <p className="subtitle">上传 zip（含 index.html），自动构建 Windows 与 Android 安装包</p>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Upload />} />
          <Route path="/jobs/:id" element={<JobStatus />} />
        </Routes>
      </main>
    </div>
  );
}
