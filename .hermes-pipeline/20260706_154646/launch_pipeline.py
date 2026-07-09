import subprocess, sys, os, time
repo = r"C:\Users\pinol\Documents\Work\atriax\solid-pancake"
task_file = r"C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260706_154646\task.txt"
with open(task_file, "r", encoding="utf-8") as f:
    task = f.read().strip()
env = os.environ.copy()
env["HERMES_PIPELINE_ACTIVE"] = "1"
cmd = [
    r"C:\Program Files\Python312\python.exe",
    r"C:/Users/pinol/AppData/Local/hermes/skills/orchestration/multi-model-dev-pipeline/scripts/pipeline.py",
    "--project", "atriax",
    "--task", task,
    "--plan-mode", "conclave",
    "--auto",
    "--max-review-iters", "4",
]
print("Launching pipeline...")
sys.stdout.flush()
proc = subprocess.run(cmd, cwd=repo, env=env, text=True, encoding="utf-8", errors="replace")
sys.exit(proc.returncode)
