#!/usr/bin/env bash
set -euo pipefail
cd /c/Users/pinol/Documents/Work/atriax/solid-pancake
python "C:/Users/pinol/AppData/Local/hermes/skills/orchestration/multi-model-dev-pipeline/scripts/pipeline.py" \
  --project atriax \
  --task "$(cat .hermes-pipeline/20260706_095614/session6_task.md)" \
  --plan-mode conclave \
  --auto
