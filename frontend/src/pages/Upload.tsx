import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { assertUploadSize, createBuild } from "../api/client";
import { getDefaultAppVersion } from "../lib/version";
import { formatMaxUploadLabel } from "../lib/upload-limits";

export default function Upload() {
  const navigate = useNavigate();
  const [appNameZh, setAppNameZh] = useState("");
  const [appNameEn, setAppNameEn] = useState("");
  const [appVersion, setAppVersion] = useState(() => getDefaultAppVersion());
  const [identifier, setIdentifier] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [icon, setIcon] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!icon) {
      setIconPreview(null);
      return;
    }
    const url = URL.createObjectURL(icon);
    setIconPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [icon]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("请选择 zip 文件");
      return;
    }

    try {
      assertUploadSize(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "文件过大");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("appNameZh", appNameZh);
      formData.append("appNameEn", appNameEn);
      formData.append("appVersion", appVersion.trim());
      if (identifier.trim()) {
        formData.append("identifier", identifier.trim());
      }
      if (icon) {
        formData.append("icon", icon);
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
    <>
      <h1 className="page-title">上传静态站点</h1>
      <p className="page-lead">
        将包含 index.html 的 zip 打包为 Windows 与 Android 安装包。
      </p>

      <section className="doc-section">
        <h2>使用说明</h2>
        <p className="prose">
          压缩包需包含 index.html（根目录或单层文件夹内），默认不超过{" "}
          {formatMaxUploadLabel()}。
          可单独上传应用图标（PNG / JPG / ICO，优先于 zip 内图标），版本号默认取当天日期（如
          2026.5.29）。中文名用于展示，英文名用于安装包与 Bundle ID。
        </p>
      </section>

      <section className="doc-section">
        <h2>构建参数</h2>
        <form className="form" onSubmit={onSubmit}>
          <label>
            应用中文名
            <input
              type="text"
              value={appNameZh}
              onChange={(e) => setAppNameZh(e.target.value)}
              placeholder="我的应用"
              required
            />
          </label>
          <label>
            应用英文名
            <input
              type="text"
              value={appNameEn}
              onChange={(e) => setAppNameEn(e.target.value)}
              placeholder="My App"
              required
              pattern="[a-zA-Z][a-zA-Z0-9 _.-]*"
              title="以字母开头，仅含英文字母、数字、空格、下划线和连字符"
            />
          </label>
          <label>
            应用版本号
            <input
              type="text"
              value={appVersion}
              onChange={(e) => setAppVersion(e.target.value)}
              placeholder={getDefaultAppVersion()}
              required
              pattern="\d{4}\.\d{1,2}\.\d{1,2}"
              title="格式：YYYY.M.D，例如 2026.5.29"
            />
          </label>
          <label>
            Bundle ID（可选）
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="com.example.myapp"
            />
          </label>
          <label>
            应用图标（可选）
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.ico,image/png,image/jpeg,image/x-icon"
              onChange={(e) => setIcon(e.target.files?.[0] ?? null)}
            />
          </label>
          {iconPreview ? (
            <div className="icon-preview">
              <img src={iconPreview} alt="图标预览" width={64} height={64} />
              <span className="muted">{icon?.name}</span>
            </div>
          ) : null}
          <label>
            静态网页 zip
            <input
              type="file"
              accept=".zip,application/zip"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
          </label>
          {error ? <p className="error-text">{error}</p> : null}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "上传并触发构建…" : "开始构建"}
          </button>
        </form>
      </section>
    </>
  );
}
