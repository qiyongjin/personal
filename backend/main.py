"""CLI entry point and Gunicorn ASGI application (main:app)."""

import sys

from app.cli import run

if __name__ == "__main__":
    run(["serve", *sys.argv[1:]])
else:
    from app.application import create_app

    app = create_app()
