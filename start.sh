#!/usr/bin/env sh
# Starts the 3D viewer locally (offline). Requires python3.
cd "$(dirname "$0")" && exec python3 tools/serve.py
