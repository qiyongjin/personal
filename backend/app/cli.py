"""Start the API, validate configuration, or generate an administrator password hash."""

import argparse
import getpass
import logging
import sys

import uvicorn
from pydantic import ValidationError

from .core.config import ROOT, Settings
from .core.security import hash_password


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Personal website backend")
    commands = parser.add_subparsers(dest="command", required=True)
    server = commands.add_parser("serve", help="Start the API")
    server.add_argument("--reload", action="store_true")
    commands.add_parser("password", help="Generate administrator password hash")
    commands.add_parser("check", help="Validate configuration without printing secrets")
    args = parser.parse_args(argv)
    if args.command == "password":
        password = (
            getpass.getpass("设置管理员密码（至少 12 个字符，输入不回显）：")
            if sys.stdin.isatty()
            else sys.stdin.read().removesuffix("\n").removesuffix("\r")
        )
        if not 12 <= len(password) <= 1024:
            raise ValueError("密码长度必须为 12–1024 个字符。")
        print(f"ADMIN_PASSWORD_HASH={hash_password(password)}")
        return
    settings = Settings.load()
    if args.command == "check":
        print(f"配置有效，运行环境：{settings.app_env}")
        return
    if settings.production and args.reload:
        raise ValueError("生产环境不能启用 --reload。")
    uvicorn.run(
        "app.application:create_app",
        factory=True,
        host=settings.host,
        port=settings.port,
        reload=args.reload,
        reload_dirs=[str(ROOT / "app")] if args.reload else None,
        workers=1,
        proxy_headers=bool(settings.forwarded_allow_ips),
        forwarded_allow_ips=settings.forwarded_allow_ips,
        access_log=False,
    )


def run(argv: list[str] | None = None) -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    try:
        main(argv)
    except ValidationError as error:
        for issue in error.errors(include_input=False, include_context=False):
            field = ".".join(str(part).upper() for part in issue["loc"]) or "配置"
            print(f"{field}: {issue['msg']}", file=sys.stderr)
        sys.exit(1)
    except ValueError as error:
        if type(error) is ValueError:
            print(str(error), file=sys.stderr)
        else:
            print(f"命令失败（{type(error).__name__}），请检查 README.md。", file=sys.stderr)
        sys.exit(1)
    except Exception as error:
        print(f"命令失败（{type(error).__name__}），请检查 README.md。", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    run()
