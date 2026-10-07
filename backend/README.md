# 简历后端

FastAPI + SQLite，仅提供当前前端需要的认证、简历、英文生成和 PDF 接口。Python 3.12/3.13，使用 uv 管理依赖。

## 安装和启动

在 backend 目录执行：

```sh
uv python install 3.12
uv sync --python 3.12
uv run python -m app.cli password
```

密码至少 12 个字符。新环境创建 `.env.dev`，已有配置请直接编辑：

```dotenv
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=这里填写密码命令输出的完整哈希
APP_ORIGIN=http://localhost:5173
```

然后启动：

```sh
uv run python -m app.cli check
uv run python main.py --reload
```

默认监听 http://127.0.0.1:3001，开发接口文档为 `/api/docs`。前端在另一个终端执行 `cd frontend && npm run dev`。端口占用时先停止旧服务，或通过 `PORT=3002 uv run python main.py --reload` 换端口，并同步前端 `API_PROXY_TARGET`。

`uv sync` 自动创建 `.venv`，`uv run` 自动使用它。只运行后端可使用 `uv sync --no-dev` 和 `uv run --no-dev python main.py --reload`。手动激活命令为 `source .venv/bin/activate`。

## 接口

| 方法 | 地址                                       | 用途               |
| ---- | ------------------------------------------ | ------------------ |
| POST | `/api/auth/login`                        | 管理员登录         |
| GET  | `/api/auth/session`                      | 检查登录状态       |
| POST | `/api/auth/logout`                       | 退出登录           |
| GET  | `/api/resume?lang=zh` 或 `lang=en`     | 读取公开简历       |
| PUT  | `/api/admin/resume`                      | 保存简历，需要登录 |
| POST | `/api/admin/resume/translate`            | 生成英文，需要登录 |
| GET  | `/api/resume/pdf?lang=zh` 或 `lang=en` | 下载最新简历 PDF   |

保存时携带当前 `version`，版本冲突返回 409。未发布或过期的英文简历返回 409。写操作要求来自配置的前端 Origin；会话通过 HttpOnly Cookie 保存。

## 数据和配置

默认数据库为 `data/resume.sqlite`。启动时创建缺失的表，只在空数据库导入 `resources/initial-resume.json`；已有简历不会被覆盖。旧简历表缺少 `english` 列时自动补充该列。当前仅使用 SQLite，不需要独立迁移命令。备份数据库文件前请停止服务，并保留同目录的 SQLite WAL 文件（若存在）。

环境变量优先于配置文件。开发读取 `.env.development`、`.env.dev`、`.env`；生产设置 `APP_ENV=production`，读取 `.env.production`、`.env.prod`、`.env`。按上述顺序优先取值。修改配置后重新启动。

| 配置                                         | 默认或用途                                    |
| -------------------------------------------- | --------------------------------------------- |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` | 必填；登录使用原始密码                        |
| `APP_ORIGIN`                               | http://localhost:5173，生产需要 HTTPS         |
| `DATABASE_PATH`                            | data/resume.sqlite，相对 backend 目录         |
| `DATABASE_URL`                             | 可选 SQLite URL，设置后优先于 DATABASE_PATH   |
| `HOST` / `PORT`                          | 127.0.0.1 / 3001                              |
| `PDF_RENDER_URL`                           | APP_ORIGIN + /print.html                      |
| `CHROMIUM_EXECUTABLE_PATH`                 | 可选，使用已有 Chromium                       |
| `PDF_TIMEOUT`                              | 45 秒                                         |
| `TRANSLATION_URL`                          | 可选，已有 LibreTranslate 服务的 HTTP(S) 地址 |
| `TRANSLATION_API_KEY`                      | 可选，翻译服务密钥                            |
| `TRANSLATION_TIMEOUT`                      | 180 秒                                        |
| `FORWARDED_ALLOW_IPS`                      | 可选，可信反向代理 IP/CIDR                    |
| `COOKIE_SAMESITE`                          | strict；生产 HTTPS 可设置 none                |

英文生成需要提供支持中文到英文的 LibreTranslate 服务并设置 `TRANSLATION_URL`，未配置时返回 503；也可以在前端手动编辑英文。后端不负责启动翻译服务。

PDF 下载需要可访问的前端 `/print.html` 和 Chromium，首次执行：

```sh
uv run playwright install chromium
```

PDF 使用前端打印模板和当前数据库快照。未安装浏览器或前端不可达时，下载接口返回 503，其他接口仍可使用。

## 代码和检查

`main.py` 为启动入口；`app/cli.py` 只保留启动、密码生成和配置检查。`app/api/` 为接口，`app/core/` 为配置和请求保护，`app/services/` 为翻译/PDF，`models.py`、`database.py`、`repository.py` 为 SQLite 存储。`resources/` 包含初始简历与英文错误提示。

```sh
uv run ruff check app tests main.py
uv run pytest
```

接口测试使用临时数据库，PDF 和翻译调用使用替身，不访问真实数据或外部服务。

## Linux 服务器：Gunicorn + systemd

`main.py` 同时提供 `main:app`，服务器在 backend 目录安装依赖后可以运行：

```sh
uv sync --frozen --no-dev --python 3.12
.venv/bin/gunicorn -k uvicorn.workers.UvicornWorker -w 4 -b 127.0.0.1:8080 --timeout 120 --keep-alive 5 --access-logfile - --error-logfile - main:app
```

部署时创建或编辑 `.env.production`，填写管理员账号、密码哈希及 `APP_ORIGIN=https://你的实际前端域名`。密码哈希可用 `.venv/bin/python -m app.cli password` 生成。生产环境不会读取 `.env.dev`。直接手动运行生产服务时加 `APP_ENV=production`，systemd 模板已设置它。

可选 `PDF_RENDER_URL=https://你的前端域名/print.html`；首次安装 PDF 浏览器时以服务运行用户执行 `.venv/bin/playwright install chromium`，缺失系统依赖时执行 `.venv/bin/playwright install-deps chromium`（需要系统管理权限）。

1. 将项目上传到服务器，在服务器重新创建虚拟环境，不要上传 Mac 的 `.venv`。
2. 编辑 `deploy/personal-backend.service`：将两处 `/srv/personal/backend` 替换为实际 backend 绝对路径；`User` / `Group` 设置为有项目读写权限的服务器账号和组（当前模板为 admin）。可通过 `pwd -P` 和 `id` 查路径与账号信息。
3. 检查生产配置，然后安装并启用服务：

```sh
APP_ENV=production .venv/bin/python -m app.cli check
sudo cp deploy/personal-backend.service /etc/systemd/system/personal-backend.service
sudo systemd-analyze verify /etc/systemd/system/personal-backend.service
sudo systemctl daemon-reload
sudo systemctl enable --now personal-backend
sudo systemctl status personal-backend --no-pager
```

服务直接运行虚拟环境中的 Gunicorn，运行期间不安装依赖。开机启动、异常自动重启，日志记录到 journal：

```sh
sudo journalctl -u personal-backend -n 100 --no-pager
sudo journalctl -u personal-backend -f
sudo systemctl restart personal-backend
sudo systemctl stop personal-backend
curl -i http://127.0.0.1:8080/api/auth/session
```

启动前停止原来的手动服务，确保 8080 未被占用。Nginx 的 `/api/` 配置 `proxy_pass http://127.0.0.1:8080;`（末尾不加 `/`，保留 `/api/` 路径），保留 Host/Origin，并设置 X-Forwarded-For、X-Forwarded-Proto。翻译可能需要 180 秒，Nginx 可设置 `proxy_read_timeout 210s;`。公开访问使用 HTTPS，生产登录 Cookie 为 Secure。

4 个 worker 共用数据库和登录会话，首次建表及种子写入支持并发启动。登录限流、翻译忙状态和 PDF 并发限制仍是每个 worker 独立计算；PDF 最多同时运行 8 个任务。当前 SQLite 实现保留，此部署改动不切换数据库。

`uvicorn.workers` 已被官方弃用，目前保留与你的命令兼容。后续可安装 `uvicorn-worker`，将 `-k` 改为 `uvicorn_worker.UvicornWorker`。参见 https://www.uvicorn.org/deployment/ 。
