# Web2App

将已构建好的静态网页（zip，入口 `index.html`）转换为 **Windows 桌面应用** 与 **Android APK**。本仓库包含：

- `web/`：上传与构建状态页面
- `server/`：Express API，负责 zip 校验、GitHub 上传与 workflow 触发
- `template/`：最小 Tauri 2 壳，CI 中注入用户静态资源后打包
- `.github/workflows/build-app.yml`：并行构建 Windows / Android 并发布 Release

## 架构

1. 用户在本地网站上传 zip
2. 后端校验 zip 后，通过 GitHub Contents API 上传到 `builds/{jobId}/site.zip`
3. 后端触发 `build-app.yml` workflow
4. GitHub Actions 解压 zip 到 `template/dist/`，构建 Windows 与 Android
5. `finalize` job 创建 Release：`build-{jobId}`，并返回下载链接

## 前置条件

- Node.js 20+
- 一个 GitHub 仓库（建议名称 `Web2App`）
- Personal Access Token，权限至少包含：
  - `repo`
  - `workflow`

## 快速开始

### 1. 初始化 GitHub 仓库

```bash
git init
git add .
git commit -m "init web2app platform"
git branch -M main
git remote add origin https://github.com/<owner>/Web2App.git
git push -u origin main
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`：

```env
GITHUB_TOKEN=ghp_xxx
GITHUB_OWNER=your-github-username
GITHUB_REPO=Web2App
DEFAULT_BRANCH=main
PORT=3001
MAX_UPLOAD_MB=50
```

### 3. 安装依赖并启动

```bash
npm install
npm run dev
```

- 前端：<http://localhost:5173>
- 后端：<http://localhost:3001>

### 4. 上传测试

准备一个 zip，根目录包含 `index.html`，也可使用 `examples/sample-site/` 打包：

```bash
cd examples/sample-site
powershell Compress-Archive -Path * -DestinationPath ../sample-site.zip -Force
```

在网页中填写应用名称并上传 zip。

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/builds` | `multipart/form-data`: `file`, `appNameZh`, `appNameEn`, 可选 `identifier` |
| `GET` | `/api/builds/:id` | 查询构建状态与下载链接 |
| `GET` | `/api/builds` | 最近 20 条构建记录 |

## GitHub Actions 说明

`build-app.yml` 通过 `workflow_dispatch` 触发，输入：

- `job_id`
- `app_name`
- `app_identifier`

构建产物发布到 Release tag：`build-{job_id}`。

### 应用图标

构建前会从上传 zip 的 `template/dist/` 中查找图标（根目录或单层子目录）：

1. `logo.png`（优先）
2. `favicon.ico`
3. 若都未找到，使用模板内置默认图标

找到后 CI 会执行 `tauri icon` 生成 Windows / Android 所需的多尺寸图标。

### Android 签名与安装

- CI 先构建未签名 APK，再用 `apksigner` **签名**，可直接侧载安装（不修改 Gradle 配置，避免构建失败）
- 未配置 Secrets 时，workflow 会生成临时 CI 证书（密码 `web2app-ci`，仅适合 demo）
- 生产环境建议在仓库 Settings → Secrets 配置：

| Secret | 说明 |
|--------|------|
| `ANDROID_KEYSTORE_BASE64` | `.jks` 文件 base64 |
| `ANDROID_KEYSTORE_PASSWORD` | keystore 密码 |
| `ANDROID_KEY_PASSWORD` | key 密码 |
| `ANDROID_KEY_ALIAS` | 别名，默认 `web2app` |

本地生成 keystore：

```bash
bash scripts/generate-android-keystore.sh web2app-release.jks web2app
```

- 首次 Android 构建会在 CI 中执行 `tauri android init`
- Android 构建依赖 NDK / SDK，workflow 已预装常见组件

### 手动验证 workflow

在 GitHub 仓库 Actions 页选择 **Build App**，手动填写：

- `job_id`: 任意已上传目录名（需先存在 `builds/{job_id}/site.zip`）
- `app_name`: 演示应用
- `app_name_en`: Demo App
- `app_identifier`: com.web2app.demo

## 本地数据

- SQLite：`data/web2app.db`
- 上传临时文件：内存处理，不持久化到磁盘

## Demo 限制

- 无登录鉴权，仅适合本地/内网 demo
- GitHub Actions 有排队时间与额度限制
- 大 zip 会短暂占用仓库空间（finalize 会尝试删除 `site.zip`）
- 未配置自有证书时，各次 CI 构建可能使用不同签名，无法覆盖安装旧版 APK

## 目录结构

```
Web2App/
├── web/                 # Vite + React 前端
├── server/              # Express 后端
├── template/            # Tauri 2 模板
├── .github/workflows/   # CI 构建
├── examples/            # 示例静态站点
└── data/                # 本地 SQLite（运行时生成）
```

## 常见问题

**workflow_dispatch 返回 404**

- 确认 workflow 文件已在默认分支
- 确认 `DEFAULT_BRANCH` 与仓库默认分支一致

**Release 没有下载链接**

- 等待 `finalize` job 完成
- 检查 Windows / Android job 是否都成功

**zip 校验失败**

- 确保 `index.html` 在 zip 根目录，或仅套一层文件夹
