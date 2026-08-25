#!/usr/bin/env python3
"""Start the Ahoy Player web preview."""

from pathlib import Path
import subprocess
import sys


PROJECT_ROOT = Path(__file__).resolve().parent


def main() -> int:
    command = ["npm", "run", "dev:web", *sys.argv[1:]]
    try:
        return subprocess.run(command, cwd=PROJECT_ROOT).returncode
    except FileNotFoundError:
        print("Could not find npm. Install Node.js and npm, then try again.", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nPreview stopped.")
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
