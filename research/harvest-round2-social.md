# Round 2 Harvest — Social / Code-Hosting Channels (model-attributed code)

Research date: 2026-09-22. Scope: GitHub repos/gists, forum threads, and showcase collections where the generating model is declared. Round-1 sources (`research/model-attributed-code-sources.md` — whichai/which-ai, fishslop, Arena/LMArena, Design Arena, agent-runner, DaraDoesCode video, r/ClaudeCode fish thread) are **not re-listed**; nothing materially new was found on them during this round. Every claim carries a source URL. Uncertainties are **[UNVERIFIED]**. No paid APIs, no model invocations; free GitHub search/API, HN Algolia, and web search only.

USE CLASS vocabulary: **demo-eligible** (permissive, republishable) / **sealed-eligible** (usable internally, no redistribution) / **permission-pending** (contact-the-author candidate, named below) / **unusable**.

---

## Source inventory

### 1. nagi-studio/nagi-bench — same prompt × model × harness, runnable artifacts side by side
- **URL:** https://github.com/nagi-studio/nagi-bench · live site https://bench.nagi.fun/ · repo API https://api.github.com/repos/nagi-studio/nagi-bench · tree https://api.github.com/repos/nagi-studio/nagi-bench/git/trees/HEAD?recursive=1 · README https://raw.githubusercontent.com/nagi-studio/nagi-bench/main/README.en.md
- **Contains:** real code/artifacts — `outputs/<model>/<harness>/<case>.<ext>` (raw HTML/SVG/React files, filename = case id), `models/<agent-id>.json` registry (label/vendor/harness/effort/artifactDir/run notes), `cases.json` (bilingual prompts, 5 cases: `mythos-craft`, `pelican-cycling`, `skeleton-watch`, `cs-dust2`, `turf-war`). ~40+ agent registry files at HEAD; registry table in README enumerates ~57 agents (Claude Opus 5/Fable 5/Sonnet 4.x/5, GPT-5.x/6-Astra, Gemini 3.x, Grok 4.x, DeepSeek V4, Kimi K3, MiMo, GLM, Qwen, Doubao, Spark, Inkling…), each paired with a harness (Claude Code, Codex CLI, Cursor, Antigravity, Claude/Gemini/ChatGPT web, Qoder, Kimi Code, Grok Build…).
- **Attribution method:** repo metadata — CI-enforced registry (`models/*.json` declares model × harness × effort per run) plus a **required bilingual provenance `note` per run** ("which harness, what effort, one-shot or fixed"); contributions validated by `scripts/validate-data.ts` (README "Contributing a run").
- **License + USE CLASS:** **none** (`"license": null`, no LICENSE file) → **permission-pending**. Contact: maintainer **Nagi-ovo** (https://github.com/Nagi-ovo, runs "submitted personally by the maintainer Nagi" per README), X **@Nag1ovo** (https://x.com/Nag1ovo), Discord invite in README (https://discord.gg/TEUFxdMbGb).
- **Size:** repo 15,462 KB, 63★/30 forks, created 2026-06-09 (API), homepage bench.nagi.fun.
- **Contamination:** public since 2026-06-09; moderate visibility (63★ + live arena site with voting/leaderboard) → `viral: false`, `public_since: "2026-06-09"`.
- **Extraction shape:** `cases.json` → `Task.brief`/`context.prompt` (prompt key per case id); `models/<agent>.json` → `Provenance.model` + `model_label` (agent registry) + `harness` (registry harness, e.g. `Claude Code`) + effort in `harness_version`/`model_label`; `outputs/<dir>/<case>.<ext>` → `Artifact{form:"single-file"}`; repo URL → `source_url`, `source:"harvested"`.

### 2. pulkitxm/claude-directory — gallery of Claude-generated UI experiments, prompt shipped per project
- **URL:** https://github.com/pulkitxm/claude-directory · API https://api.github.com/repos/pulkitxm/claude-directory · README https://raw.githubusercontent.com/pulkitxm/claude-directory/main/README.md · live directory https://pulkitxm.com/claude-directory
- **Contains:** real code — self-contained project folders under `hero-sections/`, `landing-pages/`, `shaders/`, `ui-design/`, `components-ui/`, `portfolios/`, `animations-loaders/`, `3d-games/`, `templates/`; **every project folder ships its originating `prompt.md`** (GitHub code search reports **581** files named `prompt.md`: https://github.com/search?q=repo%3Apulkitxm%2Fclaude-directory+filename%3Aprompt.md&type=code) plus `demo.mp4` recordings.
- **Attribution method:** repo metadata/author claim — README: "every project here was generated with Claude Fable 5 — this whole repo is vibe coded"; contribution rule requires the `prompt.md` used.
- **License + USE CLASS:** **MIT** (LICENSE in tree; API) → **demo-eligible**.
- **Size:** repo ~12.9 GB (`size: 12934366` KB — dominated by demo videos; **sparse-checkout source folders only**), 561★, created 2026-06-10 (API).
- **Contamination:** public since 2026-06-10; 561★, promoted on the author's site → moderate; `viral: false`.
- **Extraction shape:** for each leaf project dir: `prompt.md` → `context.prompt`; project source files (skip `demo.mp4`, `poster.jpg`, `posters.json`) → `Artifact{form:"tree"}`; model fixed `claude-fable-5` (repo-wide claim); task kind `web-app`, language `typescript`/`javascript`.

### 3. bridge-mind/turbo-kart-rush — one prompt, five Claude sub-agents, full game, prompt verbatim in README
- **URL:** https://github.com/bridge-mind/turbo-kart-rush · API https://api.github.com/repos/bridge-mind/turbo-kart-rush · README https://raw.githubusercontent.com/bridge-mind/turbo-kart-rush/main/README.md · demo https://bridge-mind.github.io/turbo-kart-rush/
- **Contains:** real code — complete Three.js arcade racer (repo languages API: TypeScript 671,761 B / CSS 42,081 B / HTML 738 B; **no asset files** — all meshes/textures/audio generated in code at load). README section "The prompt that built this" reproduces the complete verbatim prompt.
- **Attribution method:** author claim + prompt — README: "produced by **five Claude Fable 5.1 sub-agents** working in parallel from a single prompt, without a single follow-up question… given to Claude Code."
- **License + USE CLASS:** **MIT** (API) → **demo-eligible**.
- **Size:** 1,169 KB, 38★, created 2026-09-01 (API).
- **Contamination:** public since 2026-09-01; small niche visibility → `viral: false`.
- **Extraction shape:** README blockquote under "The prompt that built this" → `context.prompt`; source tree (exclude `docs/screenshots`, `.github`) → `Artifact{form:"tree"}`; model `claude-fable-5.1`, harness `claude-code` (Claude Code named in README).

### 4. harishkotra/same-prompt-multiple-local-models — per-model dirs of raw Python outputs
- **URL:** https://github.com/harishkotra/same-prompt-multiple-local-models · API https://api.github.com/repos/harishkotra/same-prompt-multiple-local-models · README https://raw.githubusercontent.com/harishkotra/same-prompt-multiple-local-models/main/README.md
- **Contains:** real code — two experiments, `game/<model>/` (DeepSeek V4 Flash, MiniMax M3, Mimo 2.5 single-file roguelike .py + Nemotron failure note) and `static-site-generator/<model>/` (Big Pickle, DeepSeek V4 Flash, Mimo V2.5 .py + empty Nemotron dir); both prompts printed **verbatim** in README; per-model comparison tables (lines, syntax, strengths/issues).
- **Attribution method:** directory/filename convention + README table (one model per folder); harness **[UNVERIFIED]** — inference was local ("local models") but no harness/runtime named.
- **License + USE CLASS:** **none** (`license: null`) → **permission-pending**. Contact: **Harish Kotra**, GitHub https://github.com/harishkotra, site https://harishkotra.me (profile API).
- **Size:** 56 KB, created 2026-06-08 (API).
- **Contamination:** public since 2026-06-08; low visibility → `viral: false`.
- **Extraction shape:** split README on `### <Experiment> Prompt` headings → `context.prompt`; each `game/<model>/*.py` (or `static-site-generator/<model>/*.py`) → `Artifact{form:"single-file"}`, `Provenance.model` = dir name, `harness:"unknown"`, `generation_failed:true` for the Nemotron folders.

### 5. ahsameersiddiqui93/excalidraw-clone-1.1 / -1.2 / -1.3 — one prompt, three Claude models, full app each
- **URLs:** https://github.com/ahsameersiddiqui93/excalidraw-clone-1.1 · https://github.com/ahsameersiddiqui93/excalidraw-clone-1.2 · https://github.com/ahsameersiddiqui93/excalidraw-clone-1.3 (APIs: `https://api.github.com/repos/ahsameersiddiqui93/excalidraw-clone-1.{1,2,3}`)
- **Contains:** real code — full React/TypeScript/Vite/rough.js Excalidraw clones (`src/` tree with store/history/renderer/actions/components, `ARCHITECTURE.md`, `SETUP.md`); trees: https://api.github.com/repos/ahsameersiddiqui93/excalidraw-clone-1.1/git/trees/HEAD?recursive=1 (node_modules committed — exclude it).
- **Attribution method:** repo **description/README filename convention** — `README.md` of 1.1 is literally "# excalidraw-clone-1.1 / Sameer-prompt-Sonnet-4.6"; 1.2 = "Sameer-prompt-Opus-4.6"; 1.3 = "Sameer-prompt-Opus-4.8" (README contents fetched via API). Same author, three consecutive repos created 2026-06-22/23 (API), implying one shared prompt — **the prompt text itself is not in any repo** (recursive tree scan for `prompt|brief` matched nothing) **[UNVERIFIED: prompt unpublished]**.
- **License + USE CLASS:** **none** (`license: null` on all three) → **permission-pending**. Contact: GitHub **@ahsameersiddiqui93** (profile API: no blog/email listed).
- **Size:** 17,902 / 19,704 / 14,866 KB respectively (much is committed `node_modules`).
- **Contamination:** public since 2026-06-22; very low visibility → `viral: false`.
- **Extraction shape:** `src/**` (exclude `node_modules`) → `Artifact{form:"tree"}`; model from README line 2; `context.prompt` must be reconstructed or requested from the author — until then mark `context.prompt` empty and down-rank (prompt missing hurts task reconstruction).

### 6. corosolto/client — AI-generated game with per-commit `Agent:` trailers (per-diff attribution)
- **URL:** https://github.com/corosolto/client · API https://api.github.com/repos/corosolto/client · README https://raw.githubusercontent.com/corosolto/client/main/README.md · original prompt https://raw.githubusercontent.com/corosolto/client/main/docs/historico/PROMPT.md · CONTRIBUTING (trailer convention) https://raw.githubusercontent.com/corosolto/client/main/CONTRIBUTING.md
- **Contains:** real code — Three.js browser FPS (repo topics `ai-generated`), full history; original single prompt preserved in `docs/historico/PROMPT.md` (6,910 B per contents API).
- **Attribution method:** **repo metadata / commit trailers** — README: "cada commit diz qual escreveu (trailer `Agent:`, convenção em CONTRIBUTING.md)"; badges name **Claude Fable 5, Claude Opus, Kimi K3, Codex GPT, GLM** (code) and Gemini (2D art). This is the strongest per-diff attribution found in round 2.
- **License + USE CLASS:** **AGPL-3.0** (API) → **sealed-eligible** (redistributing into a permissive demo tier would impose AGPL; internal use fine).
- **Size:** 1,681,101 KB (~1.6 GB), 245★, created 2026-07-17, last pushed 2026-09-22 (API).
- **Contamination:** public since 2026-07-17; 245★ + Discord/Telegram community → moderate; `viral: false`.
- **Extraction shape:** `git log --format=%H%x00%B` → parse `Agent:` trailer per commit → `Provenance.model`/`model_label`; `git diff <parent>..<sha>` (read-only) → `Artifact{form:"diff"}`; `PROMPT.md` → `context.prompt` (repo-wide brief; per-commit briefs **[UNVERIFIED]**).

### 7. ronnie3786 "Model Arena" — gist write-up + four `arena/<model>` branches on a cmux fork (diffs)
- **URLs:** gist https://gist.github.com/ronnie3786/325823c84887ef41f5056716d6f4ac88 (fetched via API: created 2026-03-15, single file `OSS-cmux-model-arena-results.md`) · fork https://github.com/ronnie3786/cmux (API: `fork: true, parent: manaflow-ai/cmux, license: AGPL-3.0`) · branches confirmed via API: `arena/codex`, `arena/gemini`, `arena/opus`, `arena/sonnet`
- **Contains:** **diffs** — four model implementations of cmux issue #997 against pinned base `6c203b5`: GPT-5.4 +863 lines, Claude Opus 4.6 +252, Sonnet 4.6 +424, Gemini 3.1 Pro +231; gist also contains per-model qualitative code review, build results, and branch compare links (gist body).
- **Attribution method:** author claim (gist names model + CLI per run: Claude Code `--dangerously-skip-permissions`, Codex CLI `--full-auto`, Gemini CLI `--yolo`) + **branch-naming convention** `arena/<model>`.
- **License + USE CLASS:** diffs are AGPL-3.0 (inherited fork license, fork API) → **sealed-eligible**. The gist text itself has **no license** (`license: null`, gist API) → gist narrative is **permission-pending** (contact: GitHub **@ronnie3786**).
- **Size:** 1 gist file + 4 branches (~231–863 added lines each); base repo cmux 27,328★ (API) — but only the arena branches are harvested.
- **Contamination:** public since 2026-03-15; HN/Reddit-scale reach not observed → `viral: false`.
- **Extraction shape:** `git fetch` the four branches (static), `git diff 6c203b5...arena/<model>` → `Artifact{form:"diff"}`; model from branch name; task = issue #997 brief (https://github.com/manaflow-ai/cmux/issues/997) → `Task{kind:"refactor", language:"typescript"}` — **[UNVERIFIED: Swift is cmux's primary language; bench `Language` enum is typescript|javascript|python, so these diffs may not fit the schema]**.

### 8. AI-makina (GitHub org) — ten "rebuilt/built with Claude Code" web apps
- **URL:** https://github.com/AI-makina?tab=repositories · flagship https://github.com/AI-makina/Guac-Roll-claude-rebuild (API: `license: null`, 94,567 KB, created 2026-01-08) · org repo list API `https://api.github.com/users/AI-makina/repos?per_page=20`
- **Contains:** real code — 10 web projects (`index.html`/`css`/`js`/`CLAUDE.md` in Guac-Roll root listing via contents API; also Next.js/TypeScript `medvita-pharmacy`, `plexus-connectome`, etc.), all unlicensed.
- **Attribution method:** author claim in repo description — "Guac & Roll food truck website - **rebuilt with Claude Code**" (API description); harness-level only, **model version unstated [UNVERIFIED]**.
- **License + USE CLASS:** **none** on all 10 repos (API) → **permission-pending**. Contact: GitHub org **AI-makina** (no public email/blog in profile page https://github.com/AI-makina); a SkyFynd-affiliated studio per `medvita-pharmacy` description.
- **Size:** 10 repos; largest `Sasha-Khan_fashion-mockup-webpage` 1,033,841 KB, `pattyandbunny` 864,754 KB, `Guac-Roll` 94,567 KB; rest small.
- **Contamination:** public since 2026-01-08; low visibility → `viral: false`.
- **Extraction shape:** per repo: source tree (exclude media) → `Artifact{form:"tree"}`; description regex `with Claude Code` → `Provenance.harness:"claude-code"`, `model:"unknown"`; prompt from `CLAUDE.md` if present **[UNVERIFIED: prompt file present only in some repos]**.

### 9. attogram/ai_test_zone (+ attogram/small-models index) — Ollama Multirun harness logs across many models
- **URLs:** https://github.com/attogram/ai_test_zone (API: **MIT**, 4,864 KB, created 2025-05-24) · index README https://raw.githubusercontent.com/attogram/small-models/main/README.md (API: **CC0-1.0**) · published pages https://attogram.github.io/ai_test_zone/ · example run dir tree via `https://api.github.com/repos/attogram/ai_test_zone/git/trees/HEAD?recursive=1`
- **Contains:** mostly **text** outputs, some code — per run dir `ollama-multirun/<prompt-slug>_<timestamp>/`: `<prompt>.prompt.yaml` (verbatim messages), `<model>.output.txt` (raw completion), `<model>.info.txt` (model metadata written by harness — architecture/parameters/quantization/**model license**, verified on `codellama_7b.info.txt`), `<model>.stats.txt`, `<model>.html`. The companion small-models README indexes a **Code Generation** section → at least some prompts request code.
- **Attribution method:** **harness log** — Ollama Multirun (https://github.com/attogram/ollama-multirun) records model identity per output; filename convention `<model>.*`.
- **License + USE CLASS:** **MIT** (ai_test_zone) / **CC0-1.0** (small-models index) → **demo-eligible**.
- **Size:** ~4.9 MB; run dirs cover dozens of small OSS models (llama3.x, qwen3, gemma3, deepseek-r1, codellama, starcoder…), dozens of prompt runs (one run dir observed per prompt slug; full count **[UNVERIFIED: non-recursive count attempt returned 0 due to API default non-recursive trees]**).
- **Contamination:** public since 2025-05-24; low visibility, GitHub Pages indexed → `viral: false`, `public_since: "2025-05-24"`.
- **Extraction shape:** glob `ollama-multirun/*/*.output.txt` → artifact text; sibling `.prompt.yaml` → `context.prompt` (YAML parse); sibling `.info.txt` → `Provenance.model_label`/`harness_version`; harness `ollama-multirun`; weak fit note: most outputs are prose, code-generation prompts only.

### 10. marqov-dev/quantum-llm-benchmarks — per-model HumanEval JSONL result files
- **URL:** https://github.com/marqov-dev/quantum-llm-benchmarks · API https://api.github.com/repos/marqov-dev/quantum-llm-benchmarks · README https://raw.githubusercontent.com/marqov-dev/quantum-llm-benchmarks/main/README.md · results tree via API `.../git/trees/HEAD?recursive=1`
- **Contains:** real code — `results/<model>_humaneval.jsonl` per model (`claude-opus-4-6`, `claude-opus-4-7`, `claude-sonnet-4-6`, `gemini-2.5-pro`, `deepseek-v4-pro`, `mistral-large-latest`, `meta-llama_llama-4-scout…`, 15 registered models per README) — generated quantum-code completions with the bench harness.
- **Attribution method:** **harness log + filename convention** (`<model>_<suite>.jsonl`); the tool itself records the model passed to `--model` (README quick-start).
- **License + USE CLASS:** **none** (`license: null`; README says "Open benchmark" but there is no LICENSE file) → **permission-pending**. Contact: **Marqov** — site https://marqov.ai (README), results https://polystacks.dev/benchmarks, via repo issues.
- **Size:** 1,069 KB, created 2026-04-28 (API).
- **Contamination:** HumanEval is a public, heavily-copied benchmark → **high contamination on the prompt side**; generated completions are fresh but the task is saturated → likely down-rank for judging.
- **Extraction shape:** parse each `results/*.jsonl` (static JSONL) → completion text → `Artifact{form:"single-file"}`, model from filename, `task{kind:"utility", language:"python"}`, `context.prompt` from the HumanEval entry embedded in each row **[UNVERIFIED: exact row schema — fields not inspected]**.

### 11. hoangsonww/WealthWise-Finance-Tracker — committed agent-session JSONL with model field (angle e, session dump)
- **URL:** https://github.com/hoangsonww/WealthWise-Finance-Tracker (API: **MIT**, 9,412 KB, created 2026-03-03) · dump https://raw.githubusercontent.com/hoangsonww/WealthWise-Finance-Tracker/master/.agent-sessions/sessions/session-001.jsonl (2,777 B)
- **Contains:** a session event log — first line: `{"type":"session_start", …, "data":{"model":"claude-opus-4-6", …}}` followed by exploration/implementation/self-review events (counts, not file contents). The repo source itself is the app; **whether the whole app is that session's output is [UNVERIFIED]**, and the log's events look hand-shaped (agent "ScarletCave", pretty event vocabulary) — provenance authenticity **[UNVERIFIED: could be illustrative]**.
- **Attribution method:** harness-log-shaped metadata (`session_start.data.model`) — weakest of the harness class until authenticated.
- **License + USE CLASS:** **MIT** (API) → **demo-eligible** for the repo code; but per-artifact model link is unconfirmed → treat as **sealed-eligible** pending author confirmation (contact: GitHub **@hoangsonww**).
- **Size:** 9,412 KB repo; 1 session file (2,777 B) found at `.agent-sessions/sessions/` (search hit: `hoangsonww/WealthWise-Finance-Tracker .agent-sessions/sessions/session-001.jsonl`, `claude-opus-4-6` code search).
- **Contamination:** public since 2026-03-03; negligible → `viral: false`.
- **Extraction shape:** JSONL first record → `Provenance.model`; only worth harvesting if the author confirms session→code linkage; repo tree → `Artifact{form:"tree"}`.

### 12. "Built with Claude Code" README-declaration corpus (angle a — 40+ named full apps)
- **URL (search):** https://github.com/search?q=%22Built+with+Claude+Code%22&type=code (executed: `gh search code '"Built with Claude Code"' --filename README.md --limit 40`, **40 unique repos returned, limit-capped → ≥40 [UNVERIFIED: exact total]**)
- **Contains:** real full apps/tools declaring the generator in README badge or prose. Verified exemplars: **Anyesh/wardrowbe** (MIT; Next.js/FastAPI wardrobe app, README badge "Built with Claude Code": https://github.com/Anyesh/wardrowbe), **jordanjoelson/clawdcv** (MIT; Next.js resume editor, badge + `AGENTS.md`: https://github.com/jordanjoelson/clawdcv), **REPPL/itemdeck.app** (GPL-3.0; "Built_with Claude_Code" badge, README https://raw.githubusercontent.com/REPPL/itemdeck.app/main/README.md), **rawprogress/fable-cities** (NOASSERTION; "built in Three.js by AI agents", API), **genspark-ai/clawverse** (MIT, 11,384 KB, 27★, created 2026-03-23; README claims "Built entirely by Genspark AI — 100+ autonomous coding sprints, 17,500 lines of code, zero human-written code": https://raw.githubusercontent.com/genspark-ai/clawverse/main/README.md — agent product named, **base model unstated [UNVERIFIED]**).
- **Attribution method:** author claim / README badge — **harness-level only** ("Claude Code"), model version usually unstated → labels are coarse (`model:"claude", model_label:"Claude Code (unversioned)"`).
- **License + USE CLASS:** **per repo** — MIT exemplars (wardrowbe, clawdcv, clawverse) → **demo-eligible**; GPL-3.0 (itemdeck.app) → **sealed-eligible**; NOASSERTION (fable-cities, Marcinthecloud/iceberg.rest, nitindermohan/raycast-claude-text) → **permission-pending/unusable** pending triage. Full per-repo license list captured in the search batch (40 rows) — triage table: MIT: AI-4-Phi/PhilLit (Apache-2.0), KaylaGel/reskilled-cli, ibrahimqureshae/mdflux, career-ops-hq/career-ops, intentdriven/abcd, johnkf5-ops/the-dev-squad, sethdford/shipwright, etc. (batch output).
- **Size:** 40 repos in first page; sizes 8 KB (gedrih) – 94,830 KB (the-dev-squad) (API batch).
- **Contamination:** each public since its created_at (2025-11 → 2026-08 in batch); individually low-visibility → `viral: false`.
- **Extraction shape:** per repo: README badge regex `Built with Claude Code` → harness; source tree → `Artifact{form:"tree"}`; prompt **[UNVERIFIED: usually absent — many repos carry `CLAUDE.md`/`AGENTS.md` which is instructions, not the generation prompt]**; down-rank items without a recoverable brief.

### 13. madewithclaude.com / madewithclaude/awesome-claude-artifacts — Claude Artifacts gallery (angle d)
- **URLs:** https://madewithclaude.com/ (site read during research; category pages `/artifacts/programming`, `/artifacts/game`, …) · repo https://github.com/madewithclaude/awesome-claude-artifacts (API: `license: null`, **5 KB** — essentially only a README pointer list, created 2024-07-11) · linked artifacts on `https://claude.site/artifacts/<uuid>` (README examples: AWS Services Galaxy, Azure Dashboard, Space Jam game)
- **Contains:** single-file React/HTML/SVG artifacts (README: "Code snippets or scripts, HTML pages, React components…"); hosted on claude.site with share/remix links; each lists the prompt/context in the contributor's issue text (contribution instructions in README).
- **Attribution method:** platform attribution — artifacts published *as Claude Artifacts* are Claude-generated by construction (site/repo claim); specific Claude version unstated (README references "Claude 3" era) → coarse label.
- **License + USE CLASS:** **none** on repo or artifact content found → **permission-pending**. Contact: madewithclaude.com (site "How to Contribute" flow) or repo issues https://github.com/madewithclaude/awesome-claude-artifacts/issues.
- **Size:** repo 5 KB (3 linked artifacts); site homepage shows ~10 featured + 11 category indexes — site-wide count **[UNVERIFIED]**.
- **Contamination:** public since 2024-07-11 → old-model outputs, low virality.
- **Extraction shape:** crawl site category indexes (static HTML read worked) → artifact pages → code blocks; requires **fetching artifact bytes only** (no JS execution); model `claude` (unversioned). Low priority: old models, license unclear.

### 14. yikerman/awesome-ai-slop — slop showcase index (angle f; discovery only)
- **URL:** https://github.com/yikerman/awesome-ai-slop (API: **WTFPL**, branch `master`) · README https://raw.githubusercontent.com/yikerman/awesome-ai-slop/master/README.md
- **Contains:** **no code artifacts** — an editorial list of ~25 repos/papers claimed to be AI slop (openclaw, bolt.diy, RuView, langchain…), each with a snarky judgment.
- **Attribution method:** third-party editorial claim ("this repo is AI slop") — **no per-artifact model labels**; many listed repos are human-authored projects the author disdains → attribution unreliable.
- **License + USE CLASS:** WTFPL for the list itself, but the pointed-to repos carry their own licenses → as a corpus source: **unusable**; as a **discovery index** it is useful (each bullet is a lead to re-triage individually).
- **Size:** one README (~25 bullets).
- **Contamination:** n/a (list only).
- **Extraction shape:** parse README bullet links → queue each target for the same per-repo license/attribution triage as source #12; never ingest the list's claims as labels.

### 15. VIBER-CODERS-ANON/AI_SLOP_SURVIVORS — slop-named gallery repo without attribution (angle f)
- **URL:** https://github.com/VIBER-CODERS-ANON/AI_SLOP_SURVIVORS (API: `license: null`, 142,642 KB, GDScript, 17★, created 2025-08-19; contents API shows a Godot game project; `README.md` fetch → 404, **no README exists**)
- **Contains:** real code (Godot/GDScript game: `game.tscn`, `game_controller.gd`, design docs `DOC_*.md`), plus stray build tmp files (`game.tscn*.tmp`).
- **Attribution method:** **name only** ("AI_SLOP_SURVIVORS") — no README, no model named anywhere found → **[UNVERIFIED: not established as model-attributed]**.
- **License + USE CLASS:** **none** + no attribution → **unusable** (fails both the license and label bars).
- **Size:** 142,642 KB.
- **Contamination:** public since 2025-08-19.
- **Extraction shape:** none — contact org (https://github.com/VIBER-CODERS-ANON) only if attribution surfaces later.

### 16. harishkotra/which-model-wrote-this — same-prompt two-model guess quiz (angle g; unusable for static harvest)
- **URL:** https://github.com/harishkotra/which-model-wrote-this (API: `license: null`, 106 KB, created 2026-09-21) · README https://raw.githubusercontent.com/harishkotra/which-model-wrote-this/main/README.md · tree via API `.../git/trees/HEAD?recursive=1`
- **Contains:** prompts committed (`server/src/prompts.ts`), five prompts × two models = ten outputs — **but `data/` contains only `.gitkeep`; outputs and ground truth are fetched/bound at call time** (README: "Ground truth is bound at call time"), i.e., live provider calls at runtime.
- **Attribution method:** harness-bound ground truth (runtime), **not persisted in the repo**.
- **License + USE CLASS:** `license: null` + outputs not committed + harvesting would require **executing the repo and calling provider APIs** → **unusable** (both license bar and the static-only execution posture).
- **Size:** 106 KB.
- **Contamination:** created 2026-09-21 (yesterday); negligible.
- **Extraction shape:** none under current constraints; keep on the permission list only if the author commits frozen outputs (contact: same as source #4, Harish Kotra).

### 17. Reddit / HN / X threads with code links (angles b, c) — surveyed, thin
- **r/ClaudeAI "I made Claude and Gemini build the same website":** https://www.reddit.com/r/ClaudeAI/comments/1pnh14j/i_made_claude_and_gemini_build_the_same_website/ — screenshots + discussion; commenters point at Anthropic's frontend skill (thread SERP snippet via web search). Direct `.json` fetch blocked (HTTP 403 during research) → attachment inventory **[UNVERIFIED]**. **USE CLASS: unusable as harvested corpus** (Reddit ToS content, no confirmed code link); attribution = author claim.
- **r/ClaudeCode/r/LocalLLaMA same-prompt searches:** Reddit JSON API returned HTML/403 (https://www.reddit.com/r/ClaudeCode/search.json?q=same+prompt…) → coverage via `web_search site:reddit.com` only; the same-prompt threads surfaced (e.g. https://www.reddit.com/r/PromptEngineering/comments/1ps6fsr/) are prose comparisons, **no code repos attached** → unusable.
- **HN Algolia (Show HN):** https://hn.algolia.com/api/v1/search?query=%22same%20prompt%22%20models%20code&tags=show_hn and https://hn.algolia.com/api/v1/search?query=%22same%20prompt%20%22%20%22claude%22%20%22gemini%22%20github — surfaced *comparison tools* (seeARMS/council MIT, stanleycyang/yardstiq MIT, Prompt-Run, Lunon, Bike4Mind), **not published output corpora**; one exception: **Show HN: Pokerbattle.ai** (https://news.ycombinator.com/ via https://pokerbattle.ai/) promises "release the summarized traces + hand histories after the event" (text, not code) → watch item, unusable for code today.
- **Gist search** (https://gist.github.com/search?q=%22same+prompt%22+claude+gpt&specify=gists): 192 results; notable: **ronnie3786 model-arena gist** (→ source #7), **DUBSOpenHub hackathon-replay** (14 models debate transcript, markdown only → unusable), **AlvisoOculus ISO-tax** (5 models × math answers, no code → unusable).
- **X/nitter:** https://nitter.tiekoetter.com/search?f=tweets&q=%22same%20prompt%22%20claude%20gpt%20github → HTTP 429 during research; X coverage this round is **[UNVERIFIED: rate-limited]**, mitigated by the web_search fallbacks above.

---

## Quick fitness table

| # | Source | Real code? | Label method | License → USE CLASS | Size | Public since |
|---|---|---|---|---|---|---|
| 1 | nagi-studio/nagi-bench | yes (HTML/SVG/React) | CI-enforced registry + per-run note | none → **permission-pending** (Nagi-ovo) | 15 MB, ~57 agents × 5 cases | 2026-06-09 |
| 2 | pulkitxm/claude-directory | yes (TS/JS trees) + prompt.md ×581 | author claim (Fable 5) + per-project prompt | MIT → **demo-eligible** | ~12.9 GB (videos) | 2026-06-10 |
| 3 | bridge-mind/turbo-kart-rush | yes (TS game, zero assets) | author claim + verbatim prompt | MIT → **demo-eligible** | 1.2 MB | 2026-09-01 |
| 4 | harishkotra/same-prompt-multiple-local-models | yes (Python) + prompts | directory convention + README table | none → **permission-pending** (Harish Kotra) | 56 KB | 2026-06-08 |
| 5 | ahsameersiddiqui93/excalidraw-clone ×3 | yes (React/TS trees) | README/description convention | none → **permission-pending** (@ahsameersiddiqui93) | ~52 MB (node_modules) | 2026-06-22 |
| 6 | corosolto/client | yes + original prompt | **git `Agent:` trailer per commit** | AGPL-3.0 → **sealed-eligible** | 1.6 GB, 245★ | 2026-07-17 |
| 7 | ronnie3786 arena branches + gist | 4 diffs vs pinned base | branch name + author claim | AGPL-3.0 → **sealed-eligible**; gist none → pending | ~1.8k added lines | 2026-03-15 |
| 8 | AI-makina org (10 apps) | yes (HTML/TS) | description claim "Claude Code" | none → **permission-pending** (org) | 10 repos, ≤1 GB each | 2026-01-08 |
| 9 | attogram/ai_test_zone | text (+some code) + prompts | harness log (Ollama Multirun) | MIT / CC0 → **demo-eligible** | 4.9 MB | 2025-05-24 |
| 10 | quantum-llm-benchmarks | yes (JSONL completions) | harness log + filename | none → **permission-pending** (Marqov) | 1.1 MB | 2026-04-28 |
| 11 | WealthWise session JSONL | repo yes; link unconfirmed | session_start.data.model | MIT, link **[UNVERIFIED]** → sealed pending | 9.4 MB | 2026-03-03 |
| 12 | "Built with Claude Code" corpus | yes (≥40 repos) | README badge (harness-level) | per-repo: MIT→**demo-eligible**, GPL→sealed, none→pending | 40 repos, 8 KB–95 MB | 2025-11→2026-08 |
| 13 | madewithclaude gallery | yes (single-file artifacts) | platform (Claude Artifacts) | none → **permission-pending** | repo 5 KB; site count [UNVERIFIED] | 2024-07-11 |
| 14 | awesome-ai-slop | no (index) | editorial claim | WTFPL list → **unusable** as corpus, discovery only | 1 README | — |
| 15 | AI_SLOP_SURVIVORS | yes (GDScript) but unattributed | none | none → **unusable** | 143 MB | 2025-08-19 |
| 16 | which-model-wrote-this | prompts only; outputs runtime | runtime ground truth (not committed) | none → **unusable** (static posture) | 106 KB | 2026-09-21 |
| 17 | Reddit/HN/X threads | mostly no | author claim | platform ToS → **unusable** | n/a | n/a |

**Demo-eligible count: 5 distinct sources** (#2, #3, #9, MIT slice of #12, plus MIT exemplars) — meets the ≥3 bar.

---

## Search coverage (for the record)

- **GitHub code search:** `"Built with Claude Code" --filename README.md` (40 repos); `"Generated with Claude Code" path:README.md` (40, mostly tool docs); `"Same prompt" "Claude" "GPT" path:README.md`; `"claude-opus-4-6" extension:jsonl`; `"sessionId" "model" path:.claude`; `path:results "claude" filename:.jsonl`.
- **GitHub repo search:** `same prompt` (30 rows → sources #4, plus isbetter/fox-ai-roundtable tools); `rebuilt with Claude` (#8); `made with bolt.new` (15 — all single-app, model unstated → subsumed by #12's harness-level class); `model arena code`; `AI slop`; `slop hall of fame` (0); `--topic claude-artifacts` (#13); `--topic ai-generated` (#6, #12 slice); `v0 chat export` (0); `cursor chat export` (15 — tools only, **no corpus dumps found**); `claude code session transcript` (15 viewer tools, **no dump repos with model metadata** beyond #11); `which model wrote` (#16).
- **HN Algolia:** queries listed under source #17.
- **Reddit:** direct JSON blocked (403); used `web_search site:reddit.com`.
- **X:** nitter 429 (rate-limited) → **[UNVERIFIED coverage]**.
- **Gists:** search page for `"same prompt" claude gpt` (192 hits, top results triaged under #17).

Negative findings worth recording: no v0/bolt **export** corpus exists (export tools absent/empty); no Cursor/Claude-Code **session-dump corpus** beyond #11; bolt.new repos declare the harness but never the model, so angle (d) collapses into the harness-level class of #12.

---

## Extraction plan — top 5 sources → `src/types.ts` Item schema

**Safety posture (binding, per maintainer):** corpus code from the internet is **hostile data and is never executed** — extraction is text-only: clone/download and statically parse JSON/YAML/Markdown/code files; **never** run `npm install`/`pip install`/`cargo build`/`go run`, tests, examples, demos, or any repo script/hook (postinstall is an attack vector), and **never fetch remote resources at extract time beyond the artifact bytes themselves**; a source that can only be harvested by executing its code is classified **unusable** (e.g., #16).

Shared field mapping for all five: `provenance.source="harvested"`, `provenance.source_url=<repo/gist URL>`, `provenance.harness` = real harness name or `"unknown"` (schema allows harvested harness strings per the `harness: string` field and its comment), `provenance.temperature` omitted (optional, absent on harvests), `provenance.generated_at` = repo `created_at` (or commit date for diffs), `contamination.public_since` = repo `created_at`, `contamination.viral` per table above, `license.redistribution` = `"demo-eligible"` only for MIT/CC0/WTFPL, else `"sealed-only"` with `license.notes` carrying the permission-pending contact.

1. **nagi-studio/nagi-bench (#1):** `git clone --depth 1` (no submodules, no scripts). Parse `cases.json` → for each case id: `Task{id: "nagi-"+caseId, kind: caseId==="cs-dust2"?"web-app":(caseId==="turf-war"?"utility":"web-app"), brief: case prompt EN, language: caseId==="cs-dust2"?"typescript":"javascript", tests_expected:false}` and `context.prompt`. Parse `models/<agent>.json` → `Provenance.model` (vendor model id), `model_label` (registry label + effort), `harness` (registry harness field). Read `outputs/<artifactDir>/<case>.<ext>` as text → `Artifact{form:"single-file", files:[{path, content}]}`. Skip `"evaluation":"showcase"` runs (README excludes them from rankings). Blocked on license → emit sealed-tier items only **after** Nagi-ovo grants permission; until then the plan is ready but ingest waits.
2. **pulkitxm/claude-directory (#2):** sparse-checkout source category dirs only (never `demo.mp4`/`posters.json`/root dotfiles). For each leaf project dir containing `prompt.md`: `context.prompt` = that file; `Artifact{form:"tree"}` = all text source files in the dir (extensions ts/tsx/js/jsx/html/css/json/md excluding README); `Provenance.model="claude-fable-5"`, `model_label="Claude Fable 5"`, `harness:"claude"` (README says generated with Claude; exact surface **[UNVERIFIED]** → use `"unknown"` if we want strictness); `Task{kind:"web-app", brief: first line of prompt.md, language: inferred from file extensions}`; `LicenseInfo{spdx:"MIT", redistribution:"demo-eligible"}` → **tier "demo" immediately**.
3. **bridge-mind/turbo-kart-rush (#3):** single clone; `context.prompt` = blockquoted text under README heading "The prompt that built this" (parse between that heading and the next `##`); `Artifact{form:"tree"}` = repo text files minus `docs/`, `.github/`; `Provenance.model="claude-fable-5.1"`, `model_label="Claude Fable 5.1 (5 sub-agents)"`, `harness:"claude-code"`; `Task{kind:"web-app", brief:"Build a AAA-quality Mario Kart clone in Three.js with five sub-agents, no questions", language:"typescript"}`; MIT → `tier:"demo"`.
4. **harishkotra/same-prompt-multiple-local-models (#4):** single clone; split README into the two experiment prompts (verbatim fenced blocks) → `context.prompt` per experiment; each `<experiment>/<model>/*.py` → `Artifact{form:"single-file"}` with `Provenance.model=<dir>`, `harness:"unknown"`, `model_label` from README table; failed dirs (Nemotron) → `generation_failed:true` with the human-authored failure note as content; `Task{kind:"utility", language:"python", brief:"Build a complete single-file terminal roguelike/SSG, stdlib only"}`; no license → **hold** as permission-pending (Harish Kotra), plan ready.
5. **corosolto/client (#6):** `git clone` the repo only (never build/run); **static** git-history parse: `git log --format=%H|%aI|%B` → split commits by `Agent:` trailer → per-commit `Provenance.model`/`model_label` (map trailer values: Claude Fable 5 / Claude Opus / Kimi K3 / Codex GPT / GLM; Gemini commits are 2D art, skip); `git diff <parent>..<sha>` output text → `Artifact{form:"diff"}`; `context.prompt` = `docs/historico/PROMPT.md` for the seed commit, per-later-commits use the commit subject as `Task.brief` (**[UNVERIFIED: no per-commit brief]**); `LicenseInfo{spdx:"AGPL-3.0", redistribution:"sealed-only"}` → `tier:"sealed"`.
