# Harvest Round 2 — Model-Attributed Code in Datasets & Benchmark Artifact Packages

Research date: 2026-09-22. Round 2 of the corpus-harvest effort. Scope: research datasets and
benchmark artifact packages that contain **model-attributed code artifacts** — Hugging Face
datasets (trajectories, model outputs, arena dumps), SWE-bench-family rollout sets, academic
artifact packages (Zenodo/figshare), Kaggle datasets, and "LLM output" collections with code
answers.

- Round 1 (`research/model-attributed-code-sources.md`) mapped 11 non-dataset sources. Per
  assignment, the three round-1 HF/arena datasets (**lmarena…/webdev-arena-preference-10k**,
  **lmarena…/leaderboard-dataset**, **lmsys/chatbot_arena_conversations**) are NOT re-tread here.
- Every claim below carries a source URL (dataset cards read raw from the Hub, HF metadata API,
  HF datasets-server, Kaggle API, Zenodo API, papers). Uncertainties are marked **[UNVERIFIED]**.
- No paid APIs and no model invocations were used; all evidence came from free HTTP reads of
  primary pages. No files outside this one were modified.

## USE CLASS legend (as defined by the assignment)

| Class | Meaning |
|---|---|
| `demo-eligible` | Permissive license, republishable in the demo tier (gated-but-redistributable still counts) |
| `sealed-eligible` | Usable internally; no redistribution of the artifacts |
| `permission-pending` | Contact-the-author candidate (named contact) before use |
| `unusable` | No license / no redistribution / no usable attribution — do not ingest |

---

## Summary table (26 distinct named sources)

| # | Source | URL | License | USE CLASS | Per-row model label? | Size | Code form |
|---|---|---|---|---|---|---|---|
| 1 | nebius/SWE-agent-trajectories | https://huggingface.co/datasets/nebius/SWE-agent-trajectories | CC-BY-4.0 (+Llama-output & per-repo caveats) | demo-eligible | **YES** `model_name` | 80,036 rows | diffs + edit snippets in trajectory |
| 2 | SWE-bench/SWE-smith-trajectories | https://huggingface.co/datasets/SWE-bench/SWE-smith-trajectories | MIT | demo-eligible | **YES** `model` | 76,002 rows (3 splits) | diff (`patch`) + full trajectory |
| 3 | Kwai-Klear/SWE-smith-mini_swe_agent_plus-trajectories-66k | https://huggingface.co/datasets/Kwai-Klear/SWE-smith-mini_swe_agent_plus-trajectories-66k | MIT | demo-eligible (attribution weak) | no — teacher unknown | 65,994 rows | edit snippets in `messages` |
| 4 | SWE-Gym/OpenHands-SFT-Trajectories | https://huggingface.co/datasets/SWE-Gym/OpenHands-SFT-Trajectories | MIT | demo-eligible (attribution weak) | no | 491 rows | edit snippets in `messages` |
| 5 | SWE-Gym/OpenHands-Sampled-Trajectories (+Verifier/Moatless siblings) | https://huggingface.co/datasets/SWE-Gym/OpenHands-Sampled-Trajectories | **no license tag** | unusable | no | 6,055 rows | diff (`test_result.git_patch`) + trajectory |
| 6 | R2E-Gym/R2EGym-SFT-Trajectories | https://huggingface.co/datasets/R2E-Gym/R2EGym-SFT-Trajectories | **no license tag** | permission-pending | no | 3,231 rows | edit snippets in `messages` |
| 7 | nebius/SWE-rebench-openhands-trajectories | https://huggingface.co/datasets/nebius/SWE-rebench-openhands-trajectories | CC-BY-4.0 | demo-eligible | no (dataset-level: Qwen3-Coder-480B) | 67,074 rows | unified diff + full trajectory |
| 8 | nvidia/SWE-Zero-openhands-trajectories | https://huggingface.co/datasets/nvidia/SWE-Zero-openhands-trajectories | CC-BY-4.0 (+per-row repo SPDX) | demo-eligible | no (dataset-level: Qwen3-Coder-480B) | 318,115 rows | unified diff + full trajectory |
| 9 | nvidia/SWE-Hero-openhands-trajectories | https://huggingface.co/datasets/nvidia/SWE-Hero-openhands-trajectories | CC-BY-4.0 (+per-row repo SPDX) | demo-eligible | no (dataset-level: Qwen3-Coder-480B) | 34,269 rows | unified diff + full trajectory |
| 10 | AlienKevin/SWE-ZERO-12M-trajectories | https://huggingface.co/datasets/AlienKevin/SWE-ZERO-12M-trajectories | Apache-2.0 | demo-eligible | no (dataset-level: mini-coder-1.7b, temp 1.0) | 12,290,800 rows | edit snippets (execution-free) |
| 11 | tarsur385/swe-verified-gemini3-flash-trajectories | https://huggingface.co/datasets/tarsur385/swe-verified-gemini3-flash-trajectories | Apache-2.0 | demo-eligible | **YES** `model` (+`temperature` 0.8) | 296 rows | git diff + full trajectory |
| 12 | OpenHandsCommunity/Devin-SWE-bench-output | https://huggingface.co/datasets/OpenHandsCommunity/Devin-SWE-bench-output | MIT | demo-eligible | **YES** `model_name_or_path`="Devin" | 1,140 rows | unified diffs |
| 13 | SWE-Factory/DeepSWE-Agent-Kimi-K2-Trajectories-2.8K | https://huggingface.co/datasets/SWE-Factory/DeepSWE-Agent-Kimi-K2-Trajectories-2.8K | MIT | demo-eligible (attribution via name) | no (name-level claim) | ~2,800 rows | edit snippets in `messages` |
| 14 | open-thoughts/AgentTrove | https://huggingface.co/datasets/open-thoughts/AgentTrove | Apache-2.0 | demo-eligible | **YES** `original_teacher` (14+ models) | 1,696,847 rows | terminus-2 trajectory traces |
| 15 | nvidia/Nemotron-Terminal-Corpus | https://huggingface.co/datasets/nvidia/Nemotron-Terminal-Corpus | CC-BY-4.0 | demo-eligible (attribution [UNVERIFIED]) | [UNVERIFIED] — card silent on teacher | ~366k trajectories | terminal traces [UNVERIFIED schema] |
| 16 | internlm/WildClawBench-Trajectories | https://huggingface.co/datasets/internlm/WildClawBench-Trajectories | MIT | demo-eligible | **YES** `model_name` | 60 tasks × ≥12 models (parquet <1K rows) + raw tarballs | full agent-produced files + trajectories |
| 17 | ChrisDing1105/unified-agent-trajectories | https://huggingface.co/datasets/ChrisDing1105/unified-agent-trajectories | `license: other`, **no blanket license** | permission-pending | **YES** `_meta.model_name`/`_meta.source_model_id` | 2,410 trajectories, 8 model groups | multimodal trajectories |
| 18 | cx-cmu/agent_trajectories | https://huggingface.co/datasets/cx-cmu/agent_trajectories | **gated + no license tag** | permission-pending | [UNVERIFIED: gated] — 5 models/benchmark (DeepSeek-R1, DeepSeek-V3.2, …) | 8,653 records, 8.5 GB | benchmark trajectories (jsonl/parquet) |
| 19 | lmsys/lmsys-chat-1m | https://huggingface.co/datasets/lmsys/lmsys-chat-1m | **gated + no license tag** | permission-pending | **YES** per-row model name | ~1M conversations / 25 models | text answers (code snippets incidental) |
| 20 | lmarena-ai/arena-human-preference-55k | https://huggingface.co/datasets/lmarena-ai/arena-human-preference-55k | Apache-2.0 | demo-eligible | **YES** `model_a`/`model_b` | 57,477 rows | markdown answers incl. code snippets |
| 21 | lmarena-ai/arena-human-preference-140k | https://huggingface.co/datasets/lmarena-ai/arena-human-preference-140k | CC-BY-4.0 prompts; **outputs = provider ToS** | sealed-eligible | **YES** `model_a`/`model_b` + `is_code` flag | 135,634 rows | conversations incl. code |
| 22 | trl-lib/chatbot_arena_completions | https://huggingface.co/datasets/trl-lib/chatbot_arena_completions | **no license tag** | unusable | **NO** (no model field) | 32,980 rows | chat messages |
| 23 | openbmb/UltraFeedback | https://huggingface.co/datasets/openbmb/UltraFeedback | MIT (HF card) | demo-eligible | **YES** `completions[i].model` | 64k prompts × 4 = 256k completions | code answers in markdown |
| 24 | Kaggle: visual-scene-instructions-for-generative-llms | https://www.kaggle.com/datasets/alexandrelemercier/visual-scene-instructions-for-generative-llms | Apache 2.0 | demo-eligible (language caveat) | no — pipeline-level author claim | 2,173 rows, 1.7 MB | full SVG code files |
| 25 | Zenodo: SILC artifact | https://zenodo.org/records/13196914 | CC-BY-4.0 | demo-eligible (contents [UNVERIFIED]) | [UNVERIFIED] | 1 × 2.86 GB zip | [UNVERIFIED] — inspect before use |
| 26 | Zenodo: SourceTracker replication pkg | https://zenodo.org/records/18375484 | CC-BY-4.0 | unusable (**corpus not redistributed**) | n/a | scripts + checkpoints only | none (data withheld) |

---

## Source inventory (full contract fields)

### A. SWE-bench-family trajectory / rollout sets (Hugging Face)

#### 1. nebius/SWE-agent-trajectories
- **URL:** https://huggingface.co/datasets/nebius/SWE-agent-trajectories · card: https://huggingface.co/datasets/nebius/SWE-agent-trajectories/raw/main/README.md · metadata: https://huggingface.co/api/datasets/nebius/SWE-agent-trajectories
- **Contains:** 80,036 agent trajectories (train split; 5.63 GB in memory, 1.11 GB download — card `dataset_info`, verified live via the card raw read). Per row: `instance_id`, **`model_name`**, `target` (resolved bool), `trajectory` (JSON list of system/ai/user entries with reasoning + actions + observations), `exit_status`, **`generated_patch`** (final patch/diff produced by the model; unified-diff style — exact serialization **[UNVERIFIED]** for this sibling, but sibling set nebius/SWE-rebench card documents the same field as "unified diff format": https://huggingface.co/datasets/nebius/SWE-rebench-openhands-trajectories ), `eval_logs`.
- **Artifact type:** real code — diffs/patches per row, plus file-edit snippets inside trajectories. Not full files.
- **Attribution:** **per-row harness log** — `model_name` field (card "Dataset Structure" table). Models present include Qwen2.5-72B-Instruct and Llama3-70B-Instruct (secondary source: Nebius's own comparison table in https://huggingface.co/datasets/nebius/SWE-rebench-openhands-trajectories/raw/main/README.md ; full per-row value list **[UNVERIFIED]** without downloading).
- **License / USE CLASS:** `license: cc-by-4.0` (card front matter) → **demo-eligible**, with two card-stated caveats (card License section): (a) "respect the license of each specific repository … the license of each repository at the time of the commit is provided for every instance in nebius/SWE-bench-extra" (https://huggingface.co/datasets/nebius/SWE-bench-extra); (b) "if you intend to use the outputs of these models, you must comply with the Llama 3.1 License" (https://www.llama.com/llama3_1/license/) — i.e., Llama-generated rows carry an extra provider notice (Llama 3.1 permits use of outputs, so redistribution remains viable; attribution still required by CC-BY).
- **Size:** 80,036 rows; 13,389 resolved / 66,647 unresolved (card Dataset Statistics table).
- **Contamination:** public since 2024-12-08 (API `createdAt`); 7,064 downloads (API) — popular but not viral; underlying issues are public GitHub/SWE-bench dev data.
- **Extraction shape:** data-only parquet: `load_dataset("nebius/SWE-agent-trajectories")` or `hf download nebius/SWE-agent-trajectories --repo-type dataset` then read `data/train-*.parquet` with pyarrow. Join `instance_id` → issue text from nebius/SWE-bench-extra or princeton-nlp/SWE-bench dev split. Parse `generated_patch` as a diff; `trajectory` is a JSON string list.

#### 2. SWE-bench/SWE-smith-trajectories
- **URL:** https://huggingface.co/datasets/SWE-bench/SWE-smith-trajectories · card: https://huggingface.co/datasets/SWE-bench/SWE-smith-trajectories/raw/main/README.md
- **Contains:** trajectory dataset used to fine-tune SWE-agent-LM-32B; card prose: "5017 trajectories … generated by running SWE-agent + Claude 3.7 Sonnet on task instances from the SWE-smith dataset" (card). Row schema (card `dataset_info`): `messages`, `instance_id`, `resolved`, **`model`**, `traj_id`, **`patch`**. Three splits = action-format variants: `tool` 24,100 + `xml` 26,076 + `ticks` 25,826 = **76,002 rows total** (verified live: https://datasets-server.huggingface.co/size?dataset=SWE-bench/SWE-smith-trajectories ; card front matter agrees). Reconciliation of "5017" vs 76,002 vs the "49,897 trajectories" figure in Nebius's table (https://huggingface.co/datasets/nebius/SWE-rebench-openhands-trajectories) is **[UNVERIFIED]** — likely format variants × instance multiplicity; dedupe on (`instance_id`, `traj_id`) when harvesting.
- **Artifact type:** real code — final `patch` (diff) per row + full `messages` trajectory (edit commands/snippets).
- **Attribution:** **per-row `model` column** (card schema) + harness claim on card (SWE-agent + Claude 3.7 Sonnet). Nebius's comparison table lists bootstrapping models `claude-3-7-sonnet-20250219`, `claude-3-5-sonnet-20241022`, `gpt-4o-2024-08-06` for this dataset (secondary: https://huggingface.co/datasets/nebius/SWE-rebench-openhands-trajectories).
- **License / USE CLASS:** `license: mit` (card front matter) → **demo-eligible**.
- **Size:** 76,002 rows / 3.17 GB parquet (datasets-server size endpoint, above).
- **Contamination:** public since 2025-04-29 (search API `createdAt`); widely used for SFT (13,897 downloads, API) → outputs likely in later training mixes; for a *taste* bench this matters less than for correctness benches, but flag it.
- **Extraction shape:** parquet per split (`data/tool-*`, `data/xml-*`, `data/ticks-*`); join `instance_id` → `problem_statement` from `SWE-bench/SWE-smith` (card links it; language-specific siblings `SWE-bench/SWE-smith-[lang]` recommended by the SWE-smith card: https://huggingface.co/datasets/SWE-bench/SWE-smith — exact sibling ids **[UNVERIFIED]**).

#### 3. Kwai-Klear/SWE-smith-mini_swe_agent_plus-trajectories-66k
- **URL:** https://huggingface.co/datasets/Kwai-Klear/SWE-smith-mini_swe_agent_plus-trajectories-66k · card: https://huggingface.co/datasets/Kwai-Klear/SWE-smith-mini_swe_agent_plus-trajectories-66k/raw/main/README.md
- **Contains:** 65,994 issue-solving trajectories (card `dataset_info`), schema `instance_id` + `messages` only. Edit snippets (file_editor `str_replace`/`create`, bash) inside messages; **no final patch field**.
- **Attribution:** **dataset-level claim only** — collected "with mini-swe-agent-plus on issues derived from SWE-smith" (card); the generating teacher model is listed as ***unknown*** in Nebius's comparison table (https://huggingface.co/datasets/nebius/SWE-rebench-openhands-trajectories). **No per-row model label.**
- **License / USE CLASS:** `license: mit` (card front matter) → **demo-eligible**, but the missing model attribution weakens fitness — ingest only if dataset-level attribution ("unknown teacher") is acceptable for sealed experiments; not a per-row-attributed source.
- **Size:** 65,994 rows / 4.64 GB (card).
- **Contamination:** public since 2025-05 (HF; exact createdAt **[UNVERIFIED]** — not re-fetched).
- **Extraction shape:** parquet `data/train-*`; parse edit actions from `messages`; reconstruct file states statically by replaying `str_replace`/`create` strings in-process (string manipulation only — **never execute**; see safety posture below).

#### 4. SWE-Gym/OpenHands-SFT-Trajectories (and siblings)
- **URL:** https://huggingface.co/datasets/SWE-Gym/OpenHands-SFT-Trajectories · card: https://huggingface.co/datasets/SWE-Gym/OpenHands-SFT-Trajectories/raw/main/README.md
- **Contains:** 491 rows (card `dataset_info`, split `train.success.oss`), schema = `messages` (role/content) only. No patch field; success-filtered OpenHands trajectories.
- **Attribution:** none per-row. Bootstrapping models for the sibling *Sampled* set are gpt-4o-2024-08-06 + claude-3-5-sonnet-20241022 per Nebius's table (https://huggingface.co/datasets/nebius/SWE-rebench-openhands-trajectories); the SFT set's own model split is **[UNVERIFIED]** (card is silent — front matter contains only `dataset_info` + `license: mit`).
- **License / USE CLASS:** `license: mit` (card front matter) → **demo-eligible** (attribution weak).
- **Size:** 491 rows / 31.8 MB (card).
- **Contamination:** public since 2024-12-23 (HF; exact createdAt **[UNVERIFIED]**).
- **Extraction shape:** parquet; low priority (tiny, unlabeled).

**Related siblings (same org, no license tag):** `SWE-Gym/OpenHands-Sampled-Trajectories` (6,055 rows, schema includes `test_result.git_patch` diff + `resolved` + `run_id` — card: https://huggingface.co/datasets/SWE-Gym/OpenHands-Sampled-Trajectories/raw/main/README.md), `SWE-Gym/OpenHands-Verifier-Trajectories`, `SWE-Gym/MoatlessTools-Sampled-Trajectories` — all lack a `license:` line in front matter and API tags → **unusable** (default all-rights-reserved). See entry 5.

#### 5. SWE-Gym/OpenHands-Sampled-Trajectories (+ Verifier/Moatless siblings)
- **URL:** https://huggingface.co/datasets/SWE-Gym/OpenHands-Sampled-Trajectories
- **Contains:** 6,055 raw OpenHands trajectories (card `dataset_info`, split `train.raw`), schema: `instance_id`, `run_id`, `resolved`, `messages`, `tools`, **`test_result.git_patch`** (per-row final diff), `test_result.report`, `test_result.test_output` (card raw read, link above).
- **Attribution:** none per-row; models gpt-4o-2024-08-06 + claude-3-5-sonnet-20241022 per Nebius's table (secondary).
- **License / USE CLASS:** **no `license:` in card front matter and no `license:` tag in API metadata** (verified: card raw read + https://huggingface.co/api/datasets?search=SWE-Gym&limit=50 shows size/format/library tags only) → **unusable** as-is. Same finding for `OpenHands-Verifier-Trajectories` and `MoatlessTools-Sampled-Trajectories`.
- **Size:** 6,055 rows / 1.44 GB (card).
- **Extraction shape:** would be parquet with a ready-made `git_patch`; only worth pursuing if SWE-Gym relicenses (contact: SWE-Gym org, https://huggingface.co/SWE-Gym).

#### 6. R2E-Gym/R2EGym-SFT-Trajectories
- **URL:** https://huggingface.co/datasets/R2E-Gym/R2EGym-SFT-Trajectories · card: https://huggingface.co/datasets/R2E-Gym/R2EGym-SFT-Trajectories/raw/main/README.md
- **Contains:** 3,231 rows (card `dataset_info`, split `train`), schema `messages` (role/content) only — edit snippets in messages; no patch field.
- **Attribution:** none on card; bootstrapping model "Claude-Sonnet-3.5-v2" per Nebius's comparison table (secondary: https://huggingface.co/datasets/nebius/SWE-rebench-openhands-trajectories).
- **License / USE CLASS:** **no license tag anywhere on the card or in API metadata** (API search result for `r2e` shows tags: size/format/library/region only: https://huggingface.co/api/datasets?search=r2e&limit=50) → **permission-pending**. Named contact: the R2E-Gym HF org (https://huggingface.co/R2E-Gym).
- **Size:** 3,231 rows / 154.8 MB (card).
- **Contamination:** public since 2025-02-09 (API `createdAt`).
- **Extraction shape:** parquet `data/train-*`; contact author first.

#### 7. nebius/SWE-rebench-openhands-trajectories
- **URL:** https://huggingface.co/datasets/nebius/SWE-rebench-openhands-trajectories · card: https://huggingface.co/datasets/nebius/SWE-rebench-openhands-trajectories/raw/main/README.md
- **Contains:** 67,074 trajectories (card Table 1, "Ours" column). Per row: `trajectory_id`, `instance_id`, `repo`, `trajectory` (full conversation: system/assistant/user/tool), **`model_patch`** ("Final code modifications produced by the agent in unified diff format" — card Table 2), `exit_status`, `resolved`, `gen_tests_correct`, `pred_passes_gen_test`.
- **Artifact type:** real code — unified diffs per row + edit/verification snippets in trajectory. No full files.
- **Attribution:** **dataset-level** — "collected using Qwen/Qwen3-Coder-480B-A35B-Instruct with OpenHands (v0.54.0)" (card summary). **No per-row model field** (schema Table 2 confirms).
- **License / USE CLASS:** `license: cc-by-4.0` (card front matter) → **demo-eligible** (single-model attribution is exact by construction: one model for every row).
- **Size:** 67,074 trajectories, 1,823 repos, 3,792 resolved (card Table 1); size band 10K<n<100K (API tags).
- **Contamination:** public since 2025-09-22 (API `createdAt`); Nebius blog: https://nebius.com/blog/posts/openhands-trajectories-with-qwen3-coder-480b
- **Extraction shape:** parquet; `model_patch` → diff items directly; join issue text from nebius/SWE-rebench.

#### 8. nvidia/SWE-Zero-openhands-trajectories
- **URL:** https://huggingface.co/datasets/nvidia/SWE-Zero-openhands-trajectories · card: https://huggingface.co/datasets/nvidia/SWE-Zero-openhands-trajectories/raw/main/README.md
- **Contains:** 318,115 trajectories over 118,092 issues (card Data distribution). Per row: `instance_id`, `repo`, **`license` (SPDX of the underlying repo)**, `trajectory_id`, `trajectory`, **`model_patch`** (unified diff), `dataset` (source dataset name) — card Data Fields table.
- **Attribution:** dataset-level — "trajectories were synthesized using Qwen3-Coder-480B-A35B-Instruct" (card). No per-row model field, but single model by construction.
- **License / USE CLASS:** `license: cc-by-4.0`; card adds "We use MIT, Apache-2.0, BSD-2-Clause, and BSD-3-Clause licenses only … ready for commercial/non-commercial use" (card License/Terms) → **demo-eligible**.
- **Size:** 318,115 trajectories / 8.92 B tokens (card; token count corroborated by AlienKevin's comparison table: https://huggingface.co/datasets/AlienKevin/SWE-ZERO-12M-trajectories).
- **Contamination:** public since 2026-04-17 (API `createdAt`); paper arXiv:2604.01496 (card citation).
- **Extraction shape:** parquet `data/*.parquet`; per-row `license` maps straight into `LicenseInfo.spdx`.

#### 9. nvidia/SWE-Hero-openhands-trajectories
- **URL:** https://huggingface.co/datasets/nvidia/SWE-Hero-openhands-trajectories · card: https://huggingface.co/datasets/nvidia/SWE-Hero-openhands-trajectories/raw/main/README.md
- **Contains:** 34,269 execution-verified trajectories over 11,766 issues (card Data distribution); identical schema to #8 (`instance_id`, `repo`, `license`, `trajectory_id`, `trajectory`, `model_patch`, `dataset`) — API `cardData.dataset_info`: https://huggingface.co/api/datasets/nvidia/SWE-Hero-openhands-trajectories
- **Attribution:** dataset-level — Qwen3-Coder-480B-A35B-Instruct (card).
- **License / USE CLASS:** `license: cc-by-4.0` + permissive-repo note (card) → **demo-eligible**.
- **Size:** 34,269 rows; 14 parquet shards; 14.7 GB storage (API `usedStorage` 14,667,750,391).
- **Contamination:** public since 2026-04-17 (API `createdAt`).
- **Extraction shape:** parquet; same mapping as #8. Differs from SWE-Zero (#10) in being execution-verified (SWE-ZERO paper's follow-up, arXiv:2604.01496, card citation).

#### 10. AlienKevin/SWE-ZERO-12M-trajectories
- **URL:** https://huggingface.co/datasets/AlienKevin/SWE-ZERO-12M-trajectories · card: https://huggingface.co/datasets/AlienKevin/SWE-ZERO-12M-trajectories/raw/main/README.md
- **Contains:** 12,290,800 rollouts / 111.06 B tokens over 122,908 PRs / 3,222 repos / 16 languages (card headline + coverage list). Schema: `instance_id`, `repo`, `messages`, `trajectory_format` ("mini-swe-agent-1"), `exit_status`, `duration_sec` (card Schema table). Edit snippets (one bash command per turn) inside `messages`; **no patch field**; explicitly execution-free: "no trajectory has been checked against ground-truth tests" (card Limitations).
- **Attribution:** dataset-level — 100 rollouts per PR from `ricdomolm/mini-coder-1.7b` at **temperature 1.0** (card Methodology + Sampling settings). No per-row model field.
- **License / USE CLASS:** `license: apache-2.0` (card front matter) → **demo-eligible**.
- **Size:** 12.29 M rows; largest such corpus (card comparison table).
- **Contamination:** public since 2026-04-16 (API `createdAt`); scale-up snapshot 2026-05-12 (card).
- **Extraction shape:** parquet (38+ shards); for the bench, filter to the 3 supported languages (card reports 16 languages present — filter by file extensions seen in messages); reconstruct edits statically; `Provenance.temperature = 1.0` is documented (rare — most sets don't record it).

#### 11. tarsur385/swe-verified-gemini3-flash-trajectories
- **URL:** https://huggingface.co/datasets/tarsur385/swe-verified-gemini3-flash-trajectories · card: https://huggingface.co/datasets/tarsur385/swe-verified-gemini3-flash-trajectories/raw/main/README.md
- **Contains:** 296 graded trajectories (100 SWE-bench Verified instances × 3 samples; 198 resolved) — card. Per row: `instance_id`, `sample`, **`model`**, `reasoning_effort`, **`temperature` (0.8)**, `resolved`, **`patch`** (git diff), `n_steps`, `num_messages`, `messages` (full OpenHands trajectory, OpenAI chat format) — card Schema section.
- **Attribution:** **per-row `model` field** = `gemini-3-flash-preview` (card).
- **License / USE CLASS:** `license: apache-2.0` (card front matter) → **demo-eligible**.
- **Size:** 296 rows (card; size tag n<1K, API).
- **Contamination:** public since 2026-06-29 (API `createdAt`).
- **Extraction shape:** JSON files (`format: json`, API tags); smallest exactly-labeled source — good for smoke-testing the harvest pipeline; sampling params per-row make `Provenance` mapping exact.

#### 12. OpenHandsCommunity/Devin-SWE-bench-output
- **URL:** https://huggingface.co/datasets/OpenHandsCommunity/Devin-SWE-bench-output · card: https://huggingface.co/datasets/OpenHandsCommunity/Devin-SWE-bench-output/raw/main/README.md
- **Contains:** 1,140 rows (verified: https://datasets-server.huggingface.co/size?dataset=OpenHandsCommunity/Devin-SWE-bench-output). Schema (verified via datasets-server first-rows): `instance_id`, **`model_patch`** (unified diff — observed live; e.g. astropy patches with `diff --git` headers), **`model_name_or_path`** = "Devin", `pass_or_fail`.
- **Attribution:** **per-row field** `model_name_or_path`; single model (Devin, Cognition's agent). Whether this mirror matches Cognition's originally published Devin SWE-bench logs **[UNVERIFIED]** (card is front-matter-only: `license: mit`, no prose).
- **License / USE CLASS:** `license: mit` (card front matter) → **demo-eligible**.
- **Size:** 1,140 rows / 3.6 MB (datasets-server).
- **Contamination:** public since 2024-03-21 (API `createdAt`); Devin's 2024 SWE-bench results were widely covered → moderate viral risk for these specific patches.
- **Extraction shape:** parquet/JSON; `model_patch` → diff items directly; no trajectory, no prompt — join prompts from princeton-nlp/SWE-bench.

#### 13. SWE-Factory/DeepSWE-Agent-Kimi-K2-Trajectories-2.8K
- **URL:** https://huggingface.co/datasets/SWE-Factory/DeepSWE-Agent-Kimi-K2-Trajectories-2.8K · card: https://huggingface.co/datasets/SWE-Factory/DeepSWE-Agent-Kimi-K2-Trajectories-2.8K/raw/main/README.md
- **Contains:** ~2.8K trajectories (dataset name; API size band 1K<n<10K). Schema verified live via datasets-server first-rows: **`messages` only** (system prompt of a file_editor/execute_bash agent + GitHub issue user prompt + assistant edit commands). Edit snippets; no patch field; issue text is inline in the first user message (usable as `context.prompt` without a join).
- **Attribution:** **filename/dataset-name convention** — "Kimi-K2" in the dataset id; card body is front-matter only (`license: mit`). No per-row model field. Whether all rows are Kimi-K2 **[UNVERIFIED]** (not stated in card prose).
- **License / USE CLASS:** `license: mit` → **demo-eligible** (attribution is name-level, not per-row).
- **Size:** ~2,800 rows (name); 1K<n<10K (API tags).
- **Contamination:** public since 2025-09-17 (API `createdAt`).
- **Extraction shape:** JSON/parquet rows; parse `messages` statically.

### B. Arena / benchmark output dumps

#### 14. open-thoughts/AgentTrove — the multi-model workhorse
- **URL:** https://huggingface.co/datasets/open-thoughts/AgentTrove · card: https://huggingface.co/datasets/open-thoughts/AgentTrove/raw/main/README.md · metadata: https://huggingface.co/api/datasets/open-thoughts/AgentTrove
- **Contains:** 1,696,847 agent trajectories from 219 source datasets spanning "code repair, shell scripting, mathematical problem-solving, competitive programming, and general computer-use tasks" (card). Format: terminus-2 / ShareGPT `messages` (full tool calls, environment responses, reasoning) — card Data Format. Columns (card Schema): `messages`, **`original_source`** (task source, e.g. `swesmith`, `codeforces`, `nl2bash`, `r2egym`), **`original_teacher`** (teacher model — examples on card: GLM-4.6, GLM-4.7, GLM-5.0, GPT-5.1 Nano, GPT-5, GPT-5-mini, GPT-5-nano, GPT-4o, GPT-OSS-120B, Kimi K2.0 Thinking, Kimi-2.5, MiniMax M2.0, Qwen3, Qwen3-8B, Gemini-2.5-Flash), `reward`, `task_id`, plus per-source extras.
- **Artifact type:** real code inside trajectories (bash edits, file writes, final answers); diffs not guaranteed as separate fields **[UNVERIFIED: per-source presence of patch columns]** (card notes heterogeneous source schemas with null-filling).
- **Attribution:** **per-row `original_teacher`** — strongest per-row, multi-model attribution found in round 2. The card's full source→teacher table (219 repos listed) documents which teacher produced which subset: https://huggingface.co/datasets/open-thoughts/AgentTrove
- **License / USE CLASS:** `license: apache-2.0` (card front matter; API `cardData.license`) → **demo-eligible**. (Individual *source datasets* were merged by OpenThoughts; whether each upstream subset carries compatible terms **[UNVERIFIED]** — Apache-2.0 grant by the publisher is the operative card statement.)
- **Size:** 1,696,847 rows / 19.55 GB storage / 38 parquet shards (API).
- **Contamination:** public since 2026-04-27 (API `createdAt`); 8,241 downloads, 200 likes (API) — prominent but recent; several teacher models (GLM-4.6/4.7, GPT-5.1 Nano era) predate it.
- **Extraction shape:** parquet; filter `original_source ∈ {swesmith, SWEGym, r2egym, codeforces, code_contests, defects 4j, Inferred Bugs, freelancer, repo scaffold, multifile composition, Glaive Code Assistant, MagiCoder Evol Instruct, …}` (code-bearing rows, card table) then per-row `original_teacher` → `provenance.model`. Dedupe near-identical ablation rows (many `exp_*` sources share teachers).

#### 15. nvidia/Nemotron-Terminal-Corpus
- **URL:** https://huggingface.co/datasets/nvidia/Nemotron-Terminal-Corpus · card: https://huggingface.co/datasets/nvidia/Nemotron-Terminal-Corpus/raw/main/README.md
- **Contains:** ~366k "high-quality execution trajectories" — ~226k dataset adapters (Math/Code/SWE → terminal format) + ~140k skill-based synthetic tasks (card Dataset Composition). Terminal-interaction traces (bash-centric code work). Row schema and whether a per-row model field exists: **[UNVERIFIED]** (card documents configs only: `dataset_adapters`, `skill_based_easy|medium|mixed`).
- **Attribution:** **[UNVERIFIED]** — the card does not name the teacher model; release date 2026-02-19 per AlienKevin's comparison table (https://huggingface.co/datasets/AlienKevin/SWE-ZERO-12M-trajectories). Paper: arXiv:2602.21193 (card citation).
- **License / USE CLASS:** `license: cc-by-4.0` (card front matter) → **demo-eligible** on license; attribution must be confirmed from the paper/row schema before ingest (treat as dataset-level pending that).
- **Size:** ~366k trajectories; size band 100K<n<1M (API tags).
- **Contamination:** public since 2026-02 (per AlienKevin table; exact HF createdAt **[UNVERIFIED]**).
- **Extraction shape:** parquet per config; inspect one row statically to confirm schema before planning items.

#### 16. internlm/WildClawBench-Trajectories — full files, frontier models, MIT
- **URL:** https://huggingface.co/datasets/internlm/WildClawBench-Trajectories · card: https://huggingface.co/datasets/internlm/WildClawBench-Trajectories/raw/main/README.md · metadata: https://huggingface.co/api/datasets/internlm/WildClawBench-Trajectories
- **Contains:** complete OpenClaw-harness trajectories for every evaluated model × 60 WildClawBench tasks, in three forms (card table): (a) `train.parquet` — one row per (task, model): `task_id`, `trajectory` (JSON message array), **`model_name`**, `task_category`; (b) `sessions/<model>/<task_id>.jsonl` trace files with original inline image data; (c) **`output_<model>.tar.gz` raw evaluation outputs containing "all files the agent produced (`task_output/`)"** — i.e., **full agent-written files**, plus `score.json`, `usage.json`, logs (card Raw Evaluation Outputs section). Model roster visible in repo siblings (API): `claude_fable5`, `claude_opus_4_8_thinking`, `glm52`, `gpt56_sol`, `grok45`, `hy3`, `intern-s2-preview-397b`, `kimi_k2.7_code`, `kimi_k3`, `muse_spark_1_1`, `qwen3.8-27b-vllm`, `qwen3.8-max` — 12 archives, continuously updated.
- **Artifact type:** real code — full files (`task_output/`) + code snippets in trajectories. WildClawBench has a 12-task **Code Intelligence** category incl. "academic homepage generation" (web-app code) — benchmark card: https://huggingface.co/datasets/internlm/WildClawBench
- **Attribution:** **per-row `model_name`** (card Dataset Structure) + directory-level model attribution for tarballs — harness-recorded (internlm ran the evaluations), the gold standard.
- **License / USE CLASS:** `license: mit` (card front matter; API tags) → **demo-eligible**. (Upstream benchmark tasks are MIT too: https://huggingface.co/datasets/internlm/WildClawBench card front matter.)
- **Size:** parquet <1K rows (60 tasks × ~12 models, size tag n<1K); plus 12 `output_*.tar.gz` archives (API siblings listing).
- **Contamination:** public since 2026-08 (WildClawBench card News: "2026-08 … Released … WildClawBench-Trajectories": https://huggingface.co/datasets/internlm/WildClawBench); frontier-model outputs on a public leaderboard → moderate (raw traces less likely in training than scores).
- **Extraction shape:** `load_dataset("internlm/WildClawBench-Trajectories")` for parquet; `hf download internlm/WildClawBench-Trajectories output_<model>.tar.gz --repo-type dataset` for full files (exact command documented on card). `sessions/` JSONL gives richest per-message provenance.

#### 17. ChrisDing1105/unified-agent-trajectories
- **URL:** https://huggingface.co/datasets/ChrisDing1105/unified-agent-trajectories · card: https://huggingface.co/datasets/ChrisDing1105/unified-agent-trajectories/raw/main/README.md
- **Contains:** 2,410 trajectories from 44 runs across **8 model/configuration groups** (card): `claude-opus-4.8-thinking` (60), `deepseek-v4-flash-0731` (60), `deepseek-v4.1-flash-a` (540), `glm-5.3-flash` (780), `kimi-k2.7-code-highspeed` (60), `qwen3.6-35b-a3b` (610), `qwen3.8-27b` (180), `qwen3.8-max` (120). Format `unified-agent-sft-v1`: `messages` with `reasoning_content` + tool calls, `images` (positional), `tools`, `_meta` (raw model id, run kind, score, status, integrity).
- **Attribution:** **per-row `_meta.model_name` (display) + `_meta.source_model_id` (raw provider id)**, plus directory layout `<benchmark>/<model>/<harness>/try_<N>/data.jsonl` (card Layout + Provenance sections) — three-way (model, harness, run) attribution.
- **License / USE CLASS:** `license: other` with explicit statement: "No new blanket license is granted over upstream benchmark prompts, model-generated content, or referenced assets… Users must review the WildClawBench terms and the terms of the relevant model providers before redistribution or commercial use" (card License section) → **permission-pending**. Named contact: the publisher `ChrisDing1105` on HF (https://huggingface.co/ChrisDing1105); upstream alternative with a clean MIT license is entry #16 — prefer that.
- **Size:** 2,410 trajectories / 2,926 image refs (card); first collection derives from WildClawBench (card) — non-code-heavy but includes its 12 Code Intelligence tasks.
- **Contamination:** public since 2026-09-11 (API `createdAt`) — very fresh, low contamination.
- **Extraction shape:** `snapshot_download(..., allow_patterns=[...])` selective fetch (card Loading section); parse `data.jsonl` statically. Gated behind permission → hold.

#### 18. cx-cmu/agent_trajectories (gated, multi-model)
- **URL:** https://huggingface.co/datasets/cx-cmu/agent_trajectories · metadata: https://huggingface.co/api/datasets/cx-cmu/agent_trajectories
- **Contains:** 8,653 benchmark trajectory records across 6 benchmarks — tau2bench 984, **swebench 747**, terminalbench 1,429, mathhay 1,324, search 3,270, mcpbench 899 — each with **5 models**, 4 passes (API `description` overview table). Files per benchmark: `<name>.jsonl` + `<name>.parquet` plus audit/cleaning reports (API `siblings`). 8.52 GB total (API `usedStorage` 8,520,785,869).
- **Attribution:** API description states "Models: DeepSeek-R1, DeepSeek-V3.2, …" (truncated in API response) with 5 models per benchmark — per-row model labeling is **[UNVERIFIED: gated]** (raw README fetch returned HTTP 401; the dataset is `gated: "auto"`, requiring an HF click-through acceptance).
- **License / USE CLASS:** API `cardData` = `{pretty_name}` only, tags = `region:us` only — **no license declared**; gated access → **permission-pending**. Named contact: the `cx-cmu` HF org (https://huggingface.co/cx-cmu); accept the gate and request/confirm license before any use.
- **Size:** 8,653 records / 8.5 GB (API).
- **Contamination:** public since 2026-03-26 (API `createdAt`).
- **Extraction shape:** after gate acceptance: static JSONL/parquet per benchmark; `swebench.jsonl` (747 rows) is the relevant slice for code.

#### 19. lmsys/lmsys-chat-1m (gated arena dump, 2023)
- **URL:** https://huggingface.co/datasets/lmsys/lmsys-chat-1m · metadata: https://huggingface.co/api/datasets?search=lmsys-1m&limit=10 · paper: arXiv:2309.11998 (API tags `arxiv:2309.11998`)
- **Contains:** 1,000,000 real-world conversations with 25 LLMs (Apr–Aug 2023), "Each sample includes a conversation ID, **model name**, conversation text in OpenAI API JSON format, detected language tag, moderation tag" (API `description`). Text answers; code answers incidental (some conversations are coding requests — share **[UNVERIFIED]** without download; round 1 measured this as "mostly non-code" only for the 2023 33k set).
- **Attribution:** **per-row model name** (description).
- **License / USE CLASS:** API tags contain **no `license:` entry**; dataset is `gated: "auto"` (click-through terms; card notes user consent via "Terms of use" — API description truncated at that point). → **permission-pending** (gated + no declared license). Named contact: LMSYS org (https://huggingface.co/lmsys; site lmsys.org).
- **Size:** 1M<n<10M rows (API tags).
- **Contamination:** public since 2023-09-20 (API `createdAt`); heavily mirrored — search surfaced `musab-mk/lmsys-chat-1m_deduped`, `Nebulous/lmsys-chat-1m-smortmodelsonly`, `lilacai/lilac-lmsys-chat-1m`, `jsonifize/*` derivatives (same search endpoint) → **viral: high**; 2023 outputs are certainly in later training mixes.

#### 20. lmarena-ai/arena-human-preference-55k (Kaggle competition dump)
- **URL:** https://huggingface.co/datasets/lmarena-ai/arena-human-preference-55k · metadata: https://huggingface.co/api/datasets/lmarena-ai/arena-human-preference-55k · competition: https://www.kaggle.com/competitions/lmsys-chatbot-arena/overview (card-linked)
- **Contains:** **57,477 rows** (verified: https://datasets-server.huggingface.co/size?dataset=lmarena-ai/arena-human-preference-55k). Schema verified live (datasets-server first-rows): `id`, **`model_a`**, **`model_b`**, `prompt`, `response_a`, `response_b` (JSON-string arrays of turns), `winner_model_a/b/tie`. Battles across 70+ LLMs (card description). Code answers present as markdown/fenced snippets — verified live in row samples (e.g., a Python boto3 upload-function pair from vicuna-7b vs guanaco-33b, first-rows output) — **not full files**.
- **Attribution:** **per-row `model_a`/`model_b`** — harness log (Chatbot Arena battles).
- **License / USE CLASS:** `license: apache-2.0` (card front matter + API `cardData.license`) → **demo-eligible**. Not gated (API `gated: false`).
- **Size:** 57,477 rows / ~184 MB original CSV (datasets-server size); single `train.csv` file (API `siblings`).
- **Contamination:** public since 2024-05-02 (API `createdAt`); backed by a Kaggle competition with thousands of public kernels **[UNVERIFIED: kernel count]** → **viral: high**. Data window is 2023–2024 arena traffic → likely in training mixes of later models.
- **Extraction shape:** `train.csv` → static CSV parse; filter rows whose responses contain fenced code; `model_a`/`model_b` → provenance; pair the winner flags into item metadata.

#### 21. lmarena-ai/arena-human-preference-140k (has an `is_code` flag)
- **URL:** https://huggingface.co/datasets/lmarena-ai/arena-human-preference-140k · metadata: https://huggingface.co/api/datasets/lmarena-ai/arena-human-preference-140k
- **Contains:** **135,634** text-category battle votes (card `dataset_info`, split `train`, 3.03 GB). Schema (card + API): `id`, **`model_a`**, **`model_b`**, `winner`, `evaluation_session_id`, `evaluation_order`, `conversation_a`/`conversation_b` (full message lists incl. images), `full_conversation`, `conv_metadata`, `category_tag`, language, **`is_code` (bool: "Whether the conversation involves code" — card)**, `timestamp`.
- **Artifact type:** conversations — code answers/snippets inside assistant turns (filter on `is_code == true`); not full files.
- **Attribution:** **per-row `model_a`/`model_b`** — harness log.
- **License / USE CLASS:** HF tag says `cc-by-4.0`, but the card's own License section is explicit: **"User prompts are licensed under CC-BY-4.0, and model outputs are governed by the terms of use set by the respective model providers."** (card raw read: https://huggingface.co/datasets/lmarena-ai/arena-human-preference-140k/raw/main/README.md) → outputs are **not** openly licensed for redistribution → **sealed-eligible** (internal use; no republishing of output text). Not gated (API `gated: false`).
- **Size:** 135,634 rows / 3.03 GB (card `dataset_info`).
- **Contamination:** last modified 2025-08-01 (API); exact createdAt **[UNVERIFIED]** — treat as public ≤2025-08; widely used for preference research (derived dataset exists: `Gholamali/Arena_Human_Preference_90K_features_verified`, CC-BY-4.0, API search result) → moderate-viral.
- **Extraction shape:** parquet; filter `is_code==true`; split conversation into side A (model_a) / side B (model_b); extract fenced code blocks from assistant turns; sealed tier only.

#### 22. trl-lib/chatbot_arena_completions — listed to warn off
- **URL:** https://huggingface.co/datasets/trl-lib/chatbot_arena_completions · card: https://huggingface.co/datasets/trl-lib/chatbot_arena_completions/raw/main/README.md
- **Contains:** 32,880 train + 100 test rows; schema `question_id` + `messages` only (card `dataset_info`). **No model field, no winner field.**
- **Attribution:** **none** — arena completions stripped of model identity.
- **License / USE CLASS:** no `license:` in card front matter (raw read, link above) and none in API tags (search endpoint) → **unusable** (no license + no attribution).
- **Size:** 32,980 rows (card).
- **Extraction shape:** N/A — do not ingest.

### C. "LLM output" collections with code answers

#### 23. openbmb/UltraFeedback
- **URL:** https://huggingface.co/datasets/openbmb/UltraFeedback · metadata: https://huggingface.co/api/datasets/openbmb/UltraFeedback · paper: arXiv:2310.01377 (API tags)
- **Contains:** ~64k prompts × 4 LLM responses = 256k annotated samples across 6 JSONL sources (`evol_instruct`, `false_qa`, `flan`, `sharegpt`, `truthful_qa`, `ultrachat` — API `siblings`) — card description. Row schema verified live (datasets-server first-rows, config `default`): `source`, `instruction`, **`models` (list of the generating model names for the row)**, **`completions[]` each with `model` (per-completion model label)**, `response`, GPT-4-style per-aspect annotations, `critique`, `overall_score`, `fine-grained_score`. Observed per-completion models in the live sample: `alpaca-7b`, `pythia-12b`, `starchat`, `vicuna-33b` (first-rows output).
- **Artifact type:** code answers inside `response` markdown (verified live: C++ programming instruction with code completions; many Python/JS instructions come from evol_instruct/sharegpt) — snippets, not files. **Note:** generated by open-weight 2023-era models — "taste" value is limited to that model generation; still a legitimately attributed multi-model corpus.
- **Attribution:** **per-completion `completions[i].model` + per-row `models`** — dataset-creation claim (documented method, paper arXiv:2310.01377).
- **License / USE CLASS:** HF tag + `cardData.license` = **MIT** (API) → **demo-eligible**. (If OpenBMB's GitHub states different terms, the Hub card is what a consumer sees; secondary conflict **[UNVERIFIED]**.)
- **Size:** 100K<n<1M completions (API tags); 20.8 GB storage (API `usedStorage`).
- **Contamination:** public since 2023-09-23 (API `createdAt`); extremely widely used in reward-model training → **viral: high**.
- **Extraction shape:** JSONL files directly (`evol_instruct.jsonl`, …) — no loader code needed; filter instructions/responses containing code in the bench's 3 languages; per-completion model → provenance (one item per completion).

#### 24. Kaggle: alexandrelemercier/visual-scene-instructions-for-generative-llms
- **URL:** https://www.kaggle.com/datasets/alexandrelemercier/visual-scene-instructions-for-generative-llms · metadata: https://www.kaggle.com/api/v1/datasets/view/alexandrelemercier/visual-scene-instructions-for-generative-llms
- **Contains:** 2,173 `{concept, description, svg}` triples in `combined_train.json` (JSON array), "a complete SVG code block, that includes up to 10 elements" per entry — full, single-file code artifacts. 1,699,015 bytes total (API `totalBytes`), 623 downloads, v26 updated 2025-03-24 (API).
- **Attribution:** **pipeline-level author claim** (API `description` Method section): descriptions generated by "ChatGPT o1 pro, ChatGPT o3-mini-high, Claude 3.7 Sonnet, Mistral AI"; the SVG layer "was asked to ChatGPT o3-mini-high … Separating this task in two steps ensured good precision." → **no per-row model field**; the SVG code itself is attributable to **o3-mini-high for every row** by the documented method; description text is multi-model with no per-row labels.
- **License / USE CLASS:** **Apache 2.0** (API `licenseName`) → **demo-eligible**.
- **Size:** 2,173 rows / 1.7 MB (API).
- **Contamination:** public since ≤2025-03 (v17–v26 dates visible in API `versions`; earlier versions **[UNVERIFIED]**) → moderate.
- **Extraction shape:** download archive via Kaggle API (`kaggle datasets download -d alexandrelemercier/visual-scene-instructions-for-generative-llms`, requires a Kaggle API token; anonymous access **[UNVERIFIED]**), then parse `combined_train.json` statically.
- **Caveat:** SVG is not in `src/types.ts`'s `Language` union (`typescript|javascript|python`) — these items cannot populate `Task.language` without a SPEC.md language extension. Record as low priority for the current bench shape.

### D. Academic artifact packages (Zenodo)

#### 25. SILC artifact ("Whose fault is it anyway? SILC: Safe Integration of LLM-Generated Code")
- **URL:** https://zenodo.org/records/13196914 (concept: https://doi.org/10.5281/zenodo.13148597) · API: https://zenodo.org/api/records/13196914 · paper: arXiv:2410.18703 (https://arxiv.org/abs/2410.18703)
- **Contains:** one file, `silc_artifact.zip`, 2,862,574,644 bytes, md5 3b6d8fced13a5e1e8f0c0b8c6f86793d (Zenodo API `files`). The paper studies integration faults of **LLM-generated code**, so the artifact presumably bundles the generated programs and harness used in the study — **[UNVERIFIED: contents were not downloaded during research; which models generated the code, and whether rows are model-labeled, is unknown until the zip is statically listed]**.
- **Attribution:** **[UNVERIFIED]** — must be confirmed from the paper + a static `unzip -l` / selective extraction before any use.
- **License / USE CLASS:** record metadata `license: cc-by-4.0`, access_right `open` (API `metadata`) → **demo-eligible by license, pending content inspection**; if inspection shows no per-model labels, downgrade to "attribution via paper claim."
- **Size:** 1 × 2.86 GB zip (API).
- **Contamination:** published 2024-08 (API `publication_date` 2024-08-02); niche (37 downloads, API stats) → low.
- **Extraction shape:** download zip over HTTP, list/extract statically — never run anything inside (see safety posture).

#### 26. SourceTracker replication package ("Efficient and Scalable Provenance Tracking for LLM-Generated Code Snippets") — **data withheld**
- **URL:** https://zenodo.org/records/18375484 · API: https://zenodo.org/api/records/18375484
- **Contains:** scripts, configs, a model checkpoint — and an explicit statement: **"Due to licensing constraints, the original training dataset is not redistributed"** (API `metadata.description`). The underlying LLM-generated-code corpus (which is exactly what a taste bench would want) is absent.
- **License / USE CLASS:** record `license: cc-by-4.0` (API) but **no corpus inside** → **unusable** for harvesting (only the preprocessing instructions are reusable).
- **Size:** scripts + `checkpoint-2000plagiarism/` (API description file tree).
- **Contamination:** published 2026-01-26 (API `publication_date`).
- **Extraction shape:** N/A. Recorded as evidence that at least one academic group holds a model-attributed code corpus they cannot legally share — a permission-pending lead if their data source becomes available (contact: record owner via Zenodo).

---

## Extraction plan — top 5

### Safety posture (binding)

Corpus code from the internet is **hostile data** and is **never executed**. Extraction is
strictly text-only: download dataset data files and parse them (JSON / JSONL / Parquet / CSV /
text) with static tooling. Never run example scripts, notebooks, `pip install` steps from dataset
repos, dataset-repo loading-callback code, or any dataset-provided loader that executes repository
code (`dataset.py`, `trust_remote_code=True`, custom `builder.py` with side effects are all
attack vectors). Prefer data-only loads: `hf download … --repo-type dataset` (or direct HTTPS on
`resolve/main/…`) + `pyarrow`/`pandas.read_parquet`/`json`/`csv` parsing. Never run harvested code
to "verify" it — reconstruction (e.g., replaying edit strings) is in-memory string manipulation
only. Any dataset that *requires* remote-code execution to load is classified `unusable` or
`permission-pending` and excluded; none of the five below do (all ship plain parquet/JSONL/CSV).

### Common schema mapping to `src/types.ts` (`Item`)

| `Item` field | Mapping from harvested rows |
|---|---|
| `id` | `harvest:<dataset-slug>:<row-key>` — row-key = `instance_id`(+`traj_id`/`sample`), `task_id`+`model_name`, `id`, or `original_source`+`task_id`+index |
| `tier` | `"demo"` iff USE CLASS is `demo-eligible`, else `"sealed"`; permission-pending/unusable sources are never ingested |
| `task.kind` | SWE issue rows → `"fix"`; WildClawBench homepage/HTML tasks → `"web-app"`; arena/utility prompts → `"utility"`/`"web-app"` by prompt content; refactor prompts → `"refactor"` |
| `task.brief` | SWE `problem_statement` (joined from SWE-smith / SWE-bench); arena `prompt`; WildClawBench task text (from benchmark repo, MIT); AgentTrove first user message |
| `task.language` | Infer from file paths/extensions in the artifact; keep only `typescript`/`javascript`/`python` (union in `src/types.ts`) — this filter excludes C++/Go/etc. rows from UltraFeedback and the SVG corpus (#24) |
| `task.tests_expected` | `true` for SWE-bench-derived rows (FAIL_TO_PASS exists); `false` otherwise |
| `task.seed` | Optional: base file contents from the issue's repo commit (text checkout of the *base repo* — again, never executed) |
| `artifact.form` | `"diff"` when a patch field exists (sources 1,2,5,7,8,9,11,12); `"tree"` when files are reconstructable (WildClawBench `task_output/`, SWE edit-replay); `"single-file"` for fenced-code/arena snippets |
| `artifact.files[]` | diff → parse `diff --git` headers into `path` + hunk text (or apply hunks to seed textually); `task_output/` → `{path, content}` pairs; arena snippets → synthesised path like `answer.py`/`answer.js` |
| `context.prompt` | problem statement / arena prompt / task prompt; `context.explanation` = final assistant summary message where present |
| `provenance.model` | normalized slug of the per-row label (`model_name`, `model`, `original_teacher`, `model_a`/`model_b` → one item per side); `model_label` = the raw label verbatim |
| `provenance.harness` | ⚠ **schema friction:** `Provenance.harness` is the literal union `"openrouter-chat-completions"` — harvested items were not produced by that harness. Recording requires a SPEC.md extension (e.g., a `"harvested:<name>"` variant) or an explicitly documented placeholder. Out of scope for this research file; flagged for the Main agent. |
| `provenance.harness_version` | HF repo revision SHA (API `sha`) at download time — exact and reproducible |
| `provenance.temperature` | Only source 11 (0.8) and 10 (1.0) document it per-dataset; everything else is **[UNVERIFIED]** — needs a SPEC decision (type requires `number`; no null allowed) |
| `provenance.generated_at` | HF/Kaggle/Zenodo `createdAt` (second precision where available) |
| `provenance.source` / `source_url` | `"harvested"` + dataset URL (required by type for harvested items) |
| `license.spdx` / `license.redistribution` | card license → `"demo-eligible"` or `"sealed-only"` (the type's enum); provider-ToS/output-restricted sets (source 21) → `"sealed-only"` + `notes` quoting the card's License section |
| `contamination.public_since` | HF/Kaggle/Zenodo creation date (YYYY-MM-DD) |
| `contamination.viral` | `true` where mirror/competition evidence exists (55k→Kaggle competition; lmsys-chat-1m→4+ derivative datasets; UltraFeedback→ubiquitous RM training); `false`/conservative otherwise |

### Plan 1 — open-thoughts/AgentTrove (demo, per-row multi-model)
- **Download:** `hf download open-thoughts/AgentTrove --repo-type dataset --local-dir data/agenttrove` (38 parquet shards, ~19.6 GB) — data files only; **do not** fetch or run anything else in the repo.
- **Parse:** `pyarrow.parquet.read_table(...)` (static).
- **Filter:** `original_source ∈` code-bearing set from the card table (`swesmith`, `SWEGym`, `r2egym`, `codeforces`, `code_contests`, `defects 4j`, `Inferred Bugs`, `repo scaffold`, `multifile composition`, `Glaive Code Assistant`, `MagiCoder Evol Instruct`, `freelancer` for JS/TS/Py web tasks); dedupe `exp_*` ablation duplicates.
- **Map:** `original_teacher` → `provenance.model`/`model_label`; `messages` → parse assistant tool-call file writes/edits into `artifact` (`"tree"` via in-memory edit replay; never execute); `task_id` → `id`; `reward` → item metadata; license MIT/Apache mapping per table; `public_since = 2026-04-27`.

### Plan 2 — SWE-bench/SWE-smith-trajectories (demo, per-row model, diffs)
- **Download:** `hf download SWE-bench/SWE-smith-trajectories --repo-type dataset` (3.17 GB, 3 split families) + `hf download SWE-bench/SWE-smith --repo-type dataset` for `problem_statement` joins (mono dataset; or the `[lang]` sibling restricted to python/js/ts — exact ids **[UNVERIFIED]**).
- **Parse:** parquet per split; **dedupe (`instance_id`, `traj_id`) across `tool`/`xml`/`ticks`** (format variants of the same trajectory — counts differ slightly, so treat as variants, not copies, until checked).
- **Map:** `model` → provenance (claude-3-7-sonnet / claude-3-5-sonnet / gpt-4o expected); `patch` → `artifact.form = "diff"`; `messages` → `context.explanation` (final assistant message) and reasoning metadata; `problem_statement` → `task.brief`; language filter python/js/ts; `license.spdx = "MIT"`, `redistribution = "demo-eligible"`; `public_since = 2025-04-29`.

### Plan 3 — nebius/SWE-agent-trajectories (demo, per-row model, largest per-row-labelled SWE set)
- **Download:** `hf download nebius/SWE-agent-trajectories --repo-type dataset` (1.11 GB compressed).
- **Parse:** parquet → `trajectory` is a JSON string: `json.loads` it (static).
- **Filter:** keep rows with non-empty `generated_patch`; prefer `target == true` (resolved) for "good code" samples and `false` for slop-rich candidates — the bench can use both; join prompts from `nebius/SWE-bench-extra` (card-provided link) or princeton-nlp/SWE-bench dev.
- **Map:** `model_name` → provenance (Qwen2.5-72B / Llama3-70B rows; Llama rows get the Llama-3.1 output-license note in `license.notes`); `generated_patch` → diff artifact; `trajectory` `[system]` entry → harness/prompt metadata; `license.spdx = "CC-BY-4.0"`, `redistribution = "demo-eligible"` with repo-license + Llama notes; `public_since = 2024-12-08`.

### Plan 4 — internlm/WildClawBench-Trajectories (demo, full files, frontier models)
- **Download:** `hf download internlm/WildClawBench-Trajectories --repo-type dataset` for `train.parquet` + the `output_<model>.tar.gz` archives that contain `task_output/` (exact command is on the card); optionally `sessions/<model>/*.jsonl`.
- **Parse:** parquet (one row per task×model) + `tarfile` listing/extraction (static) + JSONL.
- **Filter:** `task_category` → keep **Code Intelligence** (12 tasks incl. homepage generation → `task.kind = "web-app"`) plus any other category whose `task_output/` contains .ts/.js/.py files (static extension scan).
- **Map:** `model_name` → provenance (12+ frontier models: claude-fable-5, claude-opus-4.8-thinking, gpt-5.6-sol, glm-5.2, grok-4.5, kimi-k3, kimi-k2.7-code, muse-spark-1.1, hy3, qwen3.8-max, qwen3.8-27b, intern-s2-preview-397b — ids per API siblings; display names per card/leaderboard); `task_output/` files → `artifact.files[]` (`"tree"`/`"single-file"`); `trajectory` JSON → `context.explanation`; license MIT → demo tier; `public_since = 2026-08`; viral = false (fresh).

### Plan 5 — lmarena-ai/arena-human-preference-140k (sealed, per-row models + `is_code`)
- **Download:** `hf download lmarena-ai/arena-human-preference-140k --repo-type dataset` (1.61 GB compressed parquet) — not gated (API `gated: false`).
- **Parse:** parquet (static).
- **Filter:** `is_code == true` (the field exists precisely for this — card schema); drop multimodal rows (content blocks with `image`) to stay within a text/code bench.
- **Map:** split `conversation_a`/`conversation_b` → **two items per row**, `provenance.model = model_a` / `model_b`, `winner` → item metadata; fenced-code blocks in assistant turns → `artifact` (`"single-file"`, synthesised filename from language detection); `language`/`category_tag` → task metadata; **`tier = "sealed"`, `license.redistribution = "sealed-only"`** with `notes` quoting: prompts CC-BY-4.0, outputs per provider ToS (card License section); `public_since ≤ 2025-08-01`, viral = moderate.

**Runners-up (already verified, promote if any top-5 disappoints):**
- `OpenHandsCommunity/Devin-SWE-bench-output` — MIT, 1,140 per-row-labelled Devin diffs; zero joins needed for labels.
- `tarsur385/swe-verified-gemini3-flash-trajectories` — Apache-2.0, per-row model + temperature + resolved; ideal pipeline smoke test.
- `lmarena-ai/arena-human-preference-55k` — Apache-2.0, 57,477 per-row battles, code snippets, but 2024-vintage + high virality.

---

## Search coverage (for the record)

- Hugging Face REST API full-text searches: `trajectories`, `SWE-Gym`, `swe-smith`, `openhands`,
  `swe-agent`, `r2e`, `arena`, `lmsys-1m`, `design2code`
  (`https://huggingface.co/api/datasets?search=…`).
- Dataset cards read raw (`/raw/main/README.md`) for 20 datasets; metadata (`/api/datasets/<id>`)
  for gating/license/createdAt/siblings; datasets-server `first-rows`/`size` for live schema and
  exact row counts (UltraFeedback, 55k, Devin, SWE-smith, R2E sample sets, DeepSWE).
- Kaggle public API: `datasets/list?search=llm generated code`, `datasets/list?search=chatbot
  arena`, `datasets/view/<owner>/<slug>` (licenses, byte counts, version history, full
  descriptions).
- Zenodo API: `records?q="LLM-generated code"`; SILC + SourceTracker records read in full;
  corroboration search for the SILC paper (arXiv:2410.18703).
- Gate behavior recorded honestly: `lmsys/lmsys-1m` (401 on raw+API — not pursued further;
  lmsys-chat-1m used instead), `cx-cmu/agent_trajectories` (401 on raw README, metadata API OK).
- Known gaps: Design2Code (SALT-NLP) family inspected and **excluded** — those datasets contain
  human reference HTML/screenshots, not model outputs
  (https://huggingface.co/api/datasets?search=design2code); figshare not separately swept beyond
  search parity with Zenodo **[UNVERIFIED: figshare-specific sweep]**; SWE-bench *leaderboard*
  submission dumps (per-model patches behind the official leaderboard) not located as a bulk
  public artifact **[UNVERIFIED]**.
