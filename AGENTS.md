## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- ALWAYS consult the graph before answering codebase questions. NEVER grep or read raw source files when a graphify query can answer the question. The graph is faster, more complete, and surfaces cross-file relationships you would miss.
- If graphify-out/graph.json does not exist, build it first with `graphify extract --code-only .` then proceed.

## Headroom proxy

This machine runs Headroom v0.33.0 as a token compression proxy. It auto-starts on login.
- Hermes uses port 8788 (Ollama Cloud), Claude Code + Codex use port 8787.
- Do NOT modify ~/.headroom/start-proxies.cmd unless explicitly asked (trailing-space bug risk).
- Headroom compresses tokens in transit; Graphify compresses context by providing scoped subgraph
  queries. Both are active by default in every session.
