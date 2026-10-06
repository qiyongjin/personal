# 在线简历工作台

同一 Git 仓库下的两个独立项目：**frontend/**（React + TypeScript + Vite）和 **pythonapi/**（FastAPI + SQLAlchemy + Alembic）。各自拥有依赖锁、环境配置、启动入口、测试和 Dockerfile，可以独立开发、构建和部署。

公开简历 `/resume`，编辑后台 `/admin/resume`。支持分模块编辑、中英文生成后校对、版本冲突检测和最新 PDF 下载。保存即公开；默认 SQLite，可按需迁移 PostgreSQL。

```text
frontend/       前端项目，页面、编辑器、语言切换、共享简历和打印模板
pythonapi/      Python API 项目，认证、数据库、翻译、PDF、迁移与管理命令
integration/    两个项目之间的契约测试及浏览器联调入口
compose.yaml    分别构建、运行前端和 API 的部署编排
```

## 开发启动：两个终端

需要 Node.js 22.16+、Python 3.12/3.13、uv。请在各自项目目录安装和运行。

终端一，启动 Python API：

```sh
cd pythonapi
uv sync --frozen
uv run --frozen playwright install chromium
uv run --frozen python main.py --reload
```

终端二，启动前端：

```sh
cd frontend
npm ci
npm run dev
```

网页：[http://localhost:5173](http://localhost:5173)。API 文档：[http://127.0.0.1:3001/api/docs](http://127.0.0.1:3001/api/docs)。前端开发服务器默认代理 `/api` 到 `127.0.0.1:3001`，后端不会提供网页。

**本次拆分已保留并移动原配置到 `pythonapi/.env.dev`、`pythonapi/.env.prod`，原数据库到 `pythonapi/data/`，不要用示例覆盖它们。** 拆分前备份为 `pythonapi/data/resume.pre-project-split.sqlite`。如果终端还激活着旧根目录虚拟环境，先 `deactivate`，再使用上面的 `uv run`；也可 `source pythonapi/.venv/bin/activate` 后在 `pythonapi/` 运行 `python main.py --reload`。

仅首次克隆的新环境：在 `pythonapi/` 复制 `.env.example` 为 `.env.dev`，执行 `uv run python -m app.cli password`，填写用户名及生成的完整哈希。前端默认无需配置；可复制 `frontend/.env.example` 为 `frontend/.env.development` 修改端口/接口地址。任何 `VITE_*` 变量都会公开到浏览器，不可填密码或密钥。

## 项目独立性

前端无需安装 Python 即可开发/构建；页面取数、登录需要可用的 API。API 无需安装 Node.js 或读取前端源码即可启动、管理数据库和测试。PDF 为复用网页的 React 简历模板，通过 `PDF_RENDER_URL` 访问一个可用的前端 `/print.html`，注入当前数据库快照后打印；模板服务不可用时返回可重试错误，不会返回旧 PDF。

[前端开发与部署](frontend/README.md) · [Python API 工程与运维](pythonapi/README.md) · [联调测试](integration/README.md)

## 分开部署

```sh
# 在 pythonapi/.env.prod 配置生产管理员和 APP_ORIGIN=https://你的前端域名
# API_ENV_FILE 可指定另一份生产配置文件
docker compose up -d --build
# 如需本地 LibreTranslate：
docker compose -f compose.yaml -f compose.translate.yaml up -d --build
```

两个镜像使用各自目录作为构建上下文。前端 Nginx 暴露在 `127.0.0.1:8080`，API 监听 3001（主机仅绑定 127.0.0.1）；外层 HTTPS 代理转发到 8080。前端反代 `/api` 到 Python 容器，PDF 使用容器内部前端地址。SQLite 继续使用原来的 `resume-data` 卷，禁止用 `down -v` 删除生产数据。旧单服务部署若出现 `resume` 孤立容器，应在确认备份后停止、移除旧容器，保留数据卷。

也可将两个目录分别部署至不同主机，配置前端 `VITE_API_BASE_URL`、后端 `APP_ORIGIN` 和 `PDF_RENDER_URL`；跨域 Cookie、CSP 和 HTTPS 的具体设置见两个项目说明。
