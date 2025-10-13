#!/usr/bin/env bash
set -euo pipefail

# This shim keeps legacy tooling working while the project transitions
to the Makefile-driven test workflow.
exec make test
