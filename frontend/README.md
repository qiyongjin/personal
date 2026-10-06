# Frontend

独立 React + TypeScript + Vite 项目。这里的安装和构建不依赖 Python、后端源码或数据库。后端 API 契约为 `/api/*`，完整浏览器流程需要可用的 API 服务。

## 开发

```sh
npm ci
npm run dev
# 类型检查、Lint 和生产构建
npm run lint
npm run build
npm run preview
```

默认 <http://localhost:5173>。可复制 `.env.example` 为 `.env.development`。Vite 自动读取本目录的环境文件，不会读取后端账号配置。

| 配置 | 默认与用途 |
| --- | --- |
| `VITE_DEV_PORT` | 5173；改端口需同步后端 APP_ORIGIN、PDF_RENDER_URL |
| `API_PROXY_TARGET` | http://127.0.0.1:3001，仅开发/preview 代理使用 |
| `VITE_API_BASE_URL` | 空表示同域 `/api`；可填 http://localhost:3001 或 https://api.example.com，不带 `/api` 和尾斜线 |

直接跨域示例：前端设置 `VITE_API_BASE_URL=http://localhost:3001`；后端设置 `APP_ORIGIN=http://localhost:5173`。两个服务重启后从 localhost 打开网站。不要在直接跨域模式混用 localhost 和 127.0.0.1，否则 SameSite Cookie 可能无法携带。客户端已统一携带凭据，后端只允许配置的前端来源。所有 VITE_* 变量均为公开构建配置，不可存密钥。

## 目录

- `src/`：页面、后台表单、自定义弹框、语言状态和 HTTP 客户端。
- `shared/`：Zod 类型和校验、ResumeDocument、简历 CSS、UI 语言资源；公开页/预览/打印共用正文。
- `src/print.tsx` + `print.html`：无 API 请求的打印入口，暴露 `window.renderResume` 供后端注入快照。
- `public/`：图标等静态文件。PDF 由 `/api/resume/pdf` 动态接口下载。

`npm run build` 同时输出 `dist/index.html`、`dist/print.html` 和哈希资源/中文字体。不要只部署 index.html 或删除打印页。打印页本身不包含简历数据；后端仅在隔离浏览器内填充当前快照。

## 独立部署

静态部署 `dist/`，服务器配置 SPA 路由回退；`/print.html` 必须返回真实打印文件，不能回退到应用页。跨域部署在构建时设置 VITE_API_BASE_URL，改地址需重新构建。若空值，则部署服务器必须反代 `/api` 到后端。
