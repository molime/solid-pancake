# Session 6 pipeline launch notes

Run dir: C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260706_095614

Figma channel: ixrb6ut2 (joined via mcp_figma_join_channel).
Exported PNGs: C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260706_095614\figma
Screen spec: C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260706_095614\figma-candidate-spec.md
Task file: C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260706_095614\session6_task.md

Baseline git status had 40 changed/added files from prior Phase 2 sessions (scheduling, dev harness, etc.). The pipeline will build on top of that baseline.

Branch verified: feature/phase-2-worker-onboarding.

Launch command (Hermes background, notify on complete):
```bash
cd /c/Users/pinol/Documents/Work/atriax/solid-pancake
python "C:/Users/pinol/AppData/Local/hermes/skills/orchestration/multi-model-dev-pipeline/scripts/pipeline.py"   --project atriax   --task-file .hermes-pipeline/20260706_095614/session6_task.md   --plan-mode conclave   --auto
```

--task-file is used because the task is long and contains Windows paths; it avoids quoting issues.
