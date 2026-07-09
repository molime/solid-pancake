import subprocess, sys, shlex, os
from pathlib import Path

run_dir = Path('C:/Users/pinol/Documents/Work/atriax/solid-pancake/.hermes-pipeline/20260706_095614')
task = (run_dir / 'session6_task.md').read_text(encoding='utf-8')

# Write task to a temp file in a shell-safe way and have the shell cat it
# Actually, we can just invoke python main() directly with sys.argv crafted to avoid shell quoting
script = 'C:/Users/pinol/AppData/Local/hermes/skills/orchestration/multi-model-dev-pipeline/scripts/pipeline.py'

os.environ['HERMES_PIPELINE_ACTIVE'] = '1'
os.environ['PYTHONUTF8'] = '1'
os.environ['PYTHONIOENCODING'] = 'utf-8:replace'

# Use python directly to run pipeline with the long task as a single argv
args = [
    sys.executable, str(script),
    '--project', 'atriax',
    '--task', task,
    '--plan-mode', 'conclave',
    '--auto',
]
result = subprocess.run(args, cwd='C:/Users/pinol/Documents/Work/atriax/solid-pancake', text=True, encoding='utf-8', errors='replace')
print(result.stdout, end='')
print(result.stderr, end='', file=sys.stderr)
sys.exit(result.returncode)
