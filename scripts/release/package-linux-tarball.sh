#!/usr/bin/env bash

set -euo pipefail

exec bash scripts/release/packaging/linux/tarball.sh "$@"
