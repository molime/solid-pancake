import subprocess, sys, os
from pathlib import Path

plan = Path('C:\\Users\\pinol\\Documents\\Work\\atriax\\solid-pancake\\.conclave-runs\\20260706_100122\\plan_final.md').read_text(encoding='utf-8')
conclave_dir = Path('C:\\Users\\pinol\\Documents\\Work\\conclave')
cfg = conclave_dir / 'conclave.cloud.yaml'

task = Path('C:\\Users\\pinol\\Documents\\Work\\atriax\\solid-pancake\\.hermes-pipeline\\20260706_095614\\session6_task.md').read_text(encoding='utf-8')

env = os.environ.copy()
env['HERMES_PIPELINE_ACTIVE'] = '1'
env['PYTHONUTF8'] = '1'
env['PYTHONIOENCODING'] = 'utf-8:replace'

args = [
    sys.executable, '-m', 'conclave.cli',
    '--config', str(cfg),
    'run',
    '--project', 'atriax',
    '--task', task,
    '--plan-file', str(plan_path),
    '--max-review-iters', '3',
]

result = subprocess.run(args, cwd=str(conclave_dir), text=True, encoding='utf-8', errors='replace', env=env)
print(result.stdout, end='')
print(result.stderr, end='', file=sys.stderr)
sys.exit(result.returncode)
