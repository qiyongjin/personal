"""Run the Python API from this project: python main.py --reload."""

import sys

from app.cli import run

if __name__ == "__main__":
    run(["serve", *sys.argv[1:]])
