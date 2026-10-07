# 项目启动

# 安装 Python 3.12

uv python install 3.12

# 创建虚拟环境

uv venv --python 3.12

# 激活虚拟环境

source .venv/bin/activate

# 安装项目全部依赖（包含 uvicorn）

uv sync

# 启动后端，开启热重载

uv run python main.py --reload
