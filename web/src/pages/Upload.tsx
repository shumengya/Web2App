import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createBuild } from "../api";

export default function Upload() {
  const navigate = useNavigate();
  const [appNameZh, setAppNameZh] = useState("");
  const [appNameEn, setAppNameEn] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("请选择 zip 文件");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("appNameZh", appNameZh);
      formData.append("appNameEn", appNameEn);
      if (identifier.trim()) {
        formData.append("identifier", identifier.trim());
      }

      const result = await createBuild(formData);
      navigate(`/jobs/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <h2>上传静态站点</h2>
      <p className="hint">
        压缩包需包含 index.html，大小默认不超过 50MB。中文名用于界面展示，英文名用于安装包与
        Bundle ID 生成。
      </p>
      <form className="form" onSubmit={onSubmit}>
        <label>
          应用中文名
          <input
            value={appNameZh}
            onChange={(e) => setAppNameZh(e.target.value)}
            placeholder="我的应用"
            required
          />
        </label>
        <label>
          应用英文名
          <input
            value={appNameEn}
            onChange={(e) => setAppNameEn(e.target.value)}
            placeholder="My App"
            required
            pattern="[a-zA-Z][a-zA-Z0-9 _.-]*"
            title="以字母开头，仅含英文字母、数字、空格、下划线和连字符"
          />
        </label>
        <label>
          Bundle ID（可选）
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="com.example.myapp"
          />
        </label>
        <label>
          静态网页 zip
          <input
            type="file"
            accept=".zip,application/zip"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" disabled={loading}>
          {loading ? "上传并触发构建..." : "开始构建"}
        </button>
      </form>
    </section>
  );
}
