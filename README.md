# Web2App

将已构建好的静态网页（zip，入口 `index.html`）转换为 **Windows 桌面应用** 与 **Android APK**。本仓库包含：

- `frontend/`：React + Vite 上传与构建状态页面（文档风格 UI）
- `worker/`：Cloudflare Worker API（zip 校验、GitHub 上传、workflow 触发）
- `template/`：最小 Tauri 2 壳，CI 中注入用户静态资源后打包
- `.github/workflows/build-app.yml`：并行构建 Windows / Android 并发布 Release

## 架构

1. 用户访问 Worker 托管的前端并上传 zip
2. Worker 校验 zip 后，通过 GitHub Contents API 上传到 `builds/{jobId}/site.zip`
3. Worker 触发 `build-app.yml` workflow
4. GitHub Actions 解压 zip 到 `template/dist/`，构建 Windows 与 Android
5. `finalize` job 创建 Release：`build-{jobId}`，前端轮询并展示下载链接

本地/生产均由 **一个 Worker** 提供 `/api/*` 与静态资源（`wrangler deploy` 一键部署）。

## 前置条件

- Node.js 20+
- [Cloudflare 账号](https://dash.cloudflare.com/) 与 [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- 一个 GitHub 仓库（建议名称 `Web2App`）
- Personal Access Token，权限至少包含：`repo`、`workflow`

## 快速开始（本地）

### 1. 安装依赖

```bash
npm install
```

### 2. 配置密钥

```bash
cp .dev.vars.example .dev.vars
```

编辑 `.dev.vars`（Wrangler 本地开发自动加载）：

```env
GITHUB_TOKEN=ghp_xxx
GITHUB_OWNER=your-github-username
GITHUB_REPO=Web2App
DEFAULT_BRANCH=main
MAX_UPLOAD_MB=50
```

### 3. 初始化 D1（本地）

```bash
npm run db:migrate:local
```

### 4. 构建前端并启动

```bash
npm run build -w frontend
npm run dev
```

- 前端开发服务器：<http://localhost:5173>（`/api` 代理到 Worker `8787`）
- Worker：<http://127.0.0.1:8787>

首次 `wrangler dev` 前需存在 `frontend/dist`（`npm run build -w frontend`）。

### 5. 上传测试

准备一个 zip，根目录包含 `index.html`，也可使用 `examples/sample-site/` 打包。

## 部署到 Cloudflare

### 1. 登录并创建 D1

```bash
wrangler login
wrangler d1 create web2app
```

将命令输出的 `database_id` 写入根目录 `wrangler.toml` 中对应 `[[d1_databases]]` 条目（若 Wrangler 未自动写入）。

```bash
npm run db:migrate:remote
```

### 2. 配置生产密钥

```bash
wrangler secret put GITHUB_TOKEN
```

在 `wrangler.toml` 的 `[vars]` 中设置 `GITHUB_OWNER`、`GITHUB_REPO`（或使用 `wrangler secret put` 存放全部变量）。

### 3. 一键部署

```bash
npm run deploy
```

等价于：构建 `frontend/dist` → `wrangler deploy`（Worker API + 静态资源 + D1 绑定）。

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/health` | 健康检查 |
| `POST` | `/api/builds` | `multipart/form-data`: `file`, `appNameZh`, `appNameEn`, `appVersion`（默认当天如 `2026.5.29`），可选 `identifier`、`icon`（PNG/JPG/ICO） |
| `GET` | `/api/builds/:id` | 查询构建状态与下载链接 |
| `GET` | `/api/builds` | 最近 20 条构建记录 |

## GitHub Actions 说明

`build-app.yml` 通过 `workflow_dispatch` 触发，输入：

- `job_id`
- `app_name`
- `app_name_en`
- `app_identifier`
- `app_version`

构建产物发布到 Release tag：`build-{job_id}`。

### 应用图标

构建前会从上传 zip 的 `template/dist/` 中查找图标（根目录或单层子目录）：

1. `logo.png`（优先）
2. `favicon.ico`
3. 若都未找到，使用模板内置默认图标

### Android 签名

- CI 先构建未签名 APK，再用 `apksigner` 签名
- 生产环境建议在仓库 Settings → Secrets 配置 `ANDROID_KEYSTORE_BASE64` 等

本地生成 keystore：

```bash
bash scripts/generate-android-keystore.sh web2app-release.jks web2app
```

## 目录结构

```
Web2App/
├── frontend/            # React + Vite 前端
├── worker/              # Cloudflare Worker API + D1 migrations
├── wrangler.toml        # 统一部署配置
├── template/            # Tauri 2 模板
├── .github/workflows/   # CI 构建（未随 Worker 迁移改动）
└── examples/            # 示例静态站点
```

## 常见问题

**`wrangler dev` 找不到静态资源**

- 运行 `npm run build -w frontend`

**workflow_dispatch 返回 404**

- 确认 workflow 已在默认分支
- 确认 `DEFAULT_BRANCH` 与仓库默认分支一致

**D1 表不存在**

- 本地：`npm run db:migrate:local`
- 远程：`npm run db:migrate:remote`

**Release 没有下载链接**

- 等待 `finalize` job 完成
- 检查 Windows / Android job 是否都成功
