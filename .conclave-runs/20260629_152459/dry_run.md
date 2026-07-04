# Conclave dry-run
project: atriax
repo: C:\Users\pinol\Documents\Work\atriax\solid-pancake
task: Smoke test Conclave option wiring only; do not edit files.

role plan          team=[c_plan_agentic[cli_kimi], c_plan_qwen[http_ollama:qwen3.5:cloud], c_plan_kimi27[http_ollama:kimi-k2.7-code:cloud]] aggregate=synthesize
role implement     team=[c_exec[cli_kimi]] aggregate=single
role review        team=[c_rev_glm[http_ollama:glm-5.1:cloud], c_rev_qwen[http_ollama:qwen3-coder:480b-cloud], c_rev_deepseek[http_ollama:deepseek-v4-flash:cloud], c_rev_kimi27[http_ollama:kimi-k2.7-code:cloud]] aggregate=vote quorum=majority
role fix           team=[c_exec[cli_kimi]] aggregate=single
role final_review  team=[c_frontier[cli_codex]] aggregate=vote quorum=all

max_review_iters: 1
gates:
  lint       -> npm run lint
  typecheck  -> npm run typecheck
  unit       -> npm run test
  e2e        -> npm run e2e
  build      -> npm run build
  stress     -> SKIP