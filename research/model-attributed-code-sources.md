# Model-Attributed Code Sources — Research Notes

Research date: 2026-09-22. Scope: public, model-attributed code artifacts usable as a corpus for judging code taste (aesthetics of generated code/UI). Every claim below carries a source URL. Uncertainties are marked **[UNVERIFIED]**. Non-goals respected: no benchmark design opinions, no linter/formatter/test-suite material, no code changes outside this file.

---

## Named leads (resolved)

### Lead 1 — t3.gg / Theo re-running "fishslop" with different models: **FOUND**

Theo Browne (@theo, t3.gg) created a one-shot browser aquarium game called **Fishslop** and has been re-running the same artifact concept across models:

- **Original run (GPT-6 Astra)** — 2026-09-03: "GPT-6 Astra is world class at Blender and 3 dimensional reasoning. This was a 1-shot game it created, all running in browser." (video attached): https://x.com/theo/status/2095599934766764338 (readable mirror used during research: https://nitter.tiekoetter.com/theo/status/2095599934766764338)
- **Cost claim** — 2026-09-06: "Fishslop would have been under $30 to generate.": https://x.com/theo/status/2096465864220639391
- **Re-run with Grok 4.7 (his second attempt)** — 2026-09-22: "Grok 4.7's Fishslop run is the worst I've seen this year. This is my second attempt (in the first one, the submarine and all the fish moved backwards)" (video attached): https://x.com/theo/status/2102268148674400520
- **Third-party re-run claim (Claude Fable 5.1)** — reply by @bil0090 in the original thread: "Fable 5.1 wasent able to make fish slop look this good" (i.e., a community member re-ran the prompt on Fable 5.1); replies also say "Fish bench!" (@pvncher) and "let's make this a bench" (@victornunez): thread https://x.com/theo/status/2095599934766764338
- Search for the re-run corpus on X (nitter index): https://nitter.tiekoetter.com/search?f=tweets&q=fishslop

What exists / doesn't:
- **Artifact type:** screen-recorded gameplay videos + community screenshots. **The source code is not published**: GitHub repo search for `fishslop` returns no repo under Theo's account (5 unrelated hits, listed below) — https://github.com/search?q=fishslop+user%3At3dotgg&type=repositories ; his public repo list shows no fishslop repo — https://github.com/t3dotgg?tab=repositories . The exact prompt is also not published in any of the cited tweets **[UNVERIFIED: prompt text may exist in his stream/VOD, which was not searched]**.
- **Attribution method:** author claim in the tweet text (model named per video). No harness log, no repo metadata.
- **License:** n/a — nothing redistributable has been published; tweets are X ToS content.
- **Size:** 1 app × at least 2 documented model runs by Theo (Astra, Grok 4.7) + ≥1 claimed community run (Fable 5.1).
- **Fitness for a closed taste-judged test set:** label reproducibility is weak (author claim only, prompt unpublished, "1-shot" is Theo's characterization); artifact as published is video, **not code**; contamination risk high (went viral 2026-09-03, https://x.com/theo/status/2095599934766764338 — later models can be trained on both the videos and coverage, e.g. https://gist.github.com/phuaky/3d0f52d6bb7534d5f60b5ef37871b187 ). Usable as a *motivating example*, not as redistributable corpus material.

Related community repos named "fishslop" (attribution status varies):
- **DingGengJia/fishslop** — https://github.com/DingGengJia/fishslop — a full Three.js submarine/aquarium/feed-fish game (matches Fishslop's concept), created 2026-09-06 (3 days after Theo's tweet), with a **published prompt file** (`docs/prompt.md`) and prompt history (`docs/prompt-history.md`), live at https://dinggengjia.github.io/fishslop/ . Artifact type: full app + prompt+solution history. **Model attribution: [UNVERIFIED] — no model is named in the README or repo metadata.** License: **none (GitHub API `license: null`)** — https://api.github.com/repos/DingGengJia/fishslop . Size: ~10 MB repo, 1 app, 10 revision logs.
- `thatcsguy/fishslop` (https://github.com/thatcsguy/fishslop) and `TheBranth/fishslop` (https://github.com/TheBranth/fishslop) are different games that only share the name — no model attribution found in their READMEs.

### Lead 2 — "a guy who does frontend design comparisons per model": **FOUND (primary candidate), one alternate noted**

**Dara Adedeji — Dara A., aka DaraDoesCode / @daradoescode / GitHub `SunkenInTime`.** He builds and videos a per-model UI-design comparison benchmark:

- Channel/video: "I made EVERY AI model design one website... here's what I found" (DaraDoesCode, 2026-03-25, 21:45) — tests Composer 1.5/2.0, Kimi K2.5, GPT-5.4, Gemini 3.1 Pro, Opus 4.6, with/without a frontend design skill, same prompt each: https://www.youtube.com/watch?v=WccVh77oZf4 (he states in the video he "got the inspiration from seeing Theo do UI benchmarks").
- Benchmark site: **WhichAI.dev / "Which AI Made This?"** — https://www.whichai.dev/ (same content served at https://ui-design-bench.vercel.app/ , the URL in his video description). Meta description: "Compare AI-generated UIs from the same prompt across models, with and without a frontend design skill." The single shared prompt is printed verbatim on the page.
- Source repo (same-prompt multi-model comparison corpus, code included): https://github.com/SunkenInTime/which-ai — README: "We asked a growing list of AI models to design five landing-page concepts… Same prompt. Same brief. Multiple attempts preserved." Top-level dirs are conditions (`with-frontend-design-skill/`, `without-frontend-design-skill/`, `with-ui-sh-skill/`, `with-uncodexify-skill/`), each containing per-model directories (13 model dirs observed under `with-frontend-design-skill`, e.g. `composer-2.0`, `gpt-5.4`, `opus-4.7`, `kimi-k-2.6`): https://api.github.com/repos/SunkenInTime/which-ai/git/trees/2d1618b76b50af6a6c7d1a850f762f12fd105daa
- Identity/profile: GitHub bio "19 cs content creator" — https://github.com/SunkenInTime ; X handle linked from the site — https://x.com/daradoescode ; TikTok @daradoescode (linked from GitHub profile).
- Theo connection: Theo reposted Dara's "video deep diving on the UI Design benchmark I built, featured on @theo's video" — https://x.com/theo/status/2036948040603558208 ; Dara also replied under Theo's Fishslop tweet (thread above).
- **Theo's fork of the benchmark:** https://github.com/t3dotgg/ui-design-bench — listed as "Forked from SunkenInTime/which-ai" on https://github.com/t3dotgg?tab=repositories . The parent repo carries **no license** (GitHub API `"license": null`, no LICENSE file): https://api.github.com/repos/SunkenInTime/which-ai ; no license badge was shown on the fork's row either **[UNVERIFIED: fork license]**.

Alternate identity considered (in case this isn't the person meant): **"How I AI"** (host "Clarivo"), whose episode "Gemini 3 vs. Claude Opus 4.5 vs. GPT-5.1 Codex: Which AI model is the best designer?" runs the exact same prompt across three models in Cursor: https://www.youtube.com/watch?v=6w0i2Wp0knM . The transcript's host introduces herself as "Claireo" and says Codex "is just not your front-end girl" (https://www.youtube.com/watch?v=6w0i2Wp0knM), i.e. the host presents female, so "a guy" more likely points to Dara; also checked DesignCourse/Gary Simon (https://www.youtube.com/@DesignCourse/videos) — no recurring per-model frontend comparison series found there as of research date **[UNVERIFIED]**.

---

## Source inventory (11 distinct named sources)

Fields: URL · contents · artifact type · attribution method · license · size · fitness (contamination / label reproducibility / is-it-code).

### 1. Theo's Fishslop re-run threads (X)
- URL: https://x.com/theo/status/2095599934766764338 , https://x.com/theo/status/2102268148674400520 , https://x.com/theo/status/2096465864220639391
- Contains: one-shot game videos per model (GPT-6 Astra, Grok 4.7), community reply claiming a Fable 5.1 run.
- Artifact type: **videos/screenshots**, no code.
- Attribution: **author claim** (model named in post text).
- License: none for the artifact (X ToS); nothing to license for code since none published.
- Size: ≥3 model runs across 2 authors.
- Fitness: contamination high (viral, 2026-09-03+); label not reproducible (prompt unpublished **[UNVERIFIED]**); artifact is not code → poor standalone fit; good as motivation/case study.

### 2. WhichAI.dev / UI Design Bench (Dara Adedeji) — site + repo
- URL: https://www.whichai.dev/ · https://github.com/SunkenInTime/which-ai · (video) https://www.youtube.com/watch?v=WccVh77oZf4
- Contains: same prompt → landing-page designs per model × per condition, five iterations each, rendered previews + generated source in repo; rankings page and "Lab Guess" game per README: https://github.com/SunkenInTime/which-ai
- Artifact type: **prompt + full generated Next.js/React page trees (real code)**, plus screenshots/previews.
- Attribution: **repo metadata / URL structure** — condition/model directories and `/with-design-skill/<model>/<iteration>` routes (site observed: `grok-4.7`, `fable-5.1`, `opus-5`, `sonnet-5`, `gpt-6-astra`, `gemini-3.8-flash`, `muse-spark-1.3`, `glm-5.3-flash`, `glm-5.2`, `kimi-k3`, `swe-2`, `mimo-x-pro-preview`, `gpt-5.5-high`): https://www.whichai.dev/
- License: **none / all rights reserved** (GitHub API `"license": null`, no LICENSE file): https://api.github.com/repos/SunkenInTime/which-ai . Site funded via Buymeacoffee + Greptile/OpenAI OSS programs (README).
- Size: ~294 MB repo (GitHub API `size: 294490` KB), 113 stars, 13 model dirs × ≥4 conditions × 5 iterations on the older condition trees, 12 current models × 5 iterations in each main condition group on the live site (plus a 13th, `gpt-5.5-high`, in the UI SH group; 2026-09-21 additions e.g. Grok 4.7 noted on page).
- Fitness: contamination moderate (public since 2026-03-21, https://api.github.com/repos/SunkenInTime/which-ai ); label reproducible from directory/URL structure but ultimately **operator-claimed** (generated via Cursor per his video); prompt fixed and published on the page → good reproducibility of input; **artifact is actual code** → strong fit, subject to license (unlicensed → contact author).

### 3. Theo's fork of the benchmark (`t3dotgg/ui-design-bench`)
- URL: https://github.com/t3dotgg/ui-design-bench (fork of https://github.com/SunkenInTime/which-ai, per https://github.com/t3dotgg?tab=repositories )
- Artifact/attribution/license/size: same as source #2; fork, 5 stars, updated 2026-09-04 (repo list page).
- Fitness: same as #2; useful as evidence of Theo's endorsement, not an independent corpus.

### 4. Arena (formerly LMArena) — Code Arena | WebDev leaderboard
- URL: https://arena.ai/leaderboard/code/webdev (method/context: https://arena.ai/blog/new-categories-code-arena )
- Contains: Elo ranking of models on front-end/web-dev tasks; observed snapshot dated **Sep 11, 2026: 679,295 votes, 129 models**, with model IDs, labs, license type (Proprietary/Open Source filter), scores, votes, prices (page read during research).
- Artifact type: **leaderboard/rankings** (the underlying per-battle code is viewable through Arena's battle interface, not bulk-exported on this page **[UNVERIFIED: bulk code export]**).
- Attribution: **harness** — platform records which model produced each response; leaderboard rows keyed by model slug (e.g. `gpt-6-astra-max`, `claude-fable-5.1-max`).
- License: site Terms of Use / Privacy Policy (linked in page footer); no per-dataset license published for leaderboard rows **[UNVERIFIED]**.
- Size: 679k+ votes over 129 models (page snapshot); Arena-wide "10M+ monthly users … 700M+ conversations and 82M+ votes" per https://arena.ai/blog (2026-06-29 post).
- Fitness: labels highly reproducible (harness-recorded); leaderboard itself is not code; battle outputs require platform access; contamination irrelevant for votes but relevant if outputs were used as training data later (public platform).

### 5. HF dataset `lmarena-ai/webdev-arena-preference-10k`
- URL: https://huggingface.co/datasets/lmarena-ai/webdev-arena-preference-10k
- Contains: "10K real-world Webdev Arena battle with 10 state-of-the-art LLMs" (dataset card).
- Artifact type: **prompt + two generated web apps per battle + human winner labels** (text/HTML in JSON), i.e. prompt+solution pairs.
- Attribution: **harness log** (battles produced by WebDev Arena; card links https://web.lmarena.ai and blog post https://blog.lmarena.ai/blog/2025/webdev-arena/ — that blog URL now redirects into https://arena.ai/blog and the 2025 article body did not load during research **[UNVERIFIED: article contents]**).
- License: **custom "Dataset License Agreement" (HF `license: other`)** — gated (name/email/affiliation); grants research + commercial use but **prohibits redistribution** and requires deletion on request (full text on dataset page).
- Size: 10.5k rows (HF listing: "10.5k"), 10 models.
- Fitness: labels harness-reproducible; actual code artifacts; redistribution barred → cannot be republished, only used internally; contamination: public since 2025 (created per HF listing "Updated Mar 10, 2025"). Strong fit for a *closed* (non-redistributed) test set — the license literally enforces closedness.

### 6. HF dataset `lmarena-ai/leaderboard-dataset`
- URL: https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset
- Contains: historical leaderboard snapshots; configs include `webdev`; features `model_name`, `organization`, `license`, `score`, `score_ci_*`, `rank`, `category`, `leaderboard_publish_date` (dataset card).
- Artifact type: tabular scores (**no code**).
- Attribution: **harness/leaderboard metadata** (model_name per row).
- License: **CC-BY-4.0** (card front matter `license: cc-by-4.0`).
- Size: 2.36M rows across configs (HF org listing https://huggingface.co/lmarena-ai ); `webdev` config included with `latest`/`full` splits.
- Fitness: labels fully reproducible and openly licensed, but **no code artifacts** → usable for model metadata/score joins, not for taste judging of artifacts.

### 7. HF dataset `lmsys/chatbot_arena_conversations`
- URL: https://huggingface.co/datasets/lmsys/chatbot_arena_conversations
- Contains: "33K cleaned conversations with pairwise human preferences… April to June 2023", each sample has `model_a`, `model_b`, `winner`, `conversation_a`, `conversation_b`, vote/moderation fields (dataset card/API schema).
- Artifact type: full conversation text (includes **some code answers**, but not UI/rendered artifacts).
- Attribution: **harness log** (`model_a`/`model_b` fields).
- License: HF tag `license:cc` (Creative Commons, variant not specified on the card) + gating disclaimer terms requiring appropriate use and adherence to model providers' ToS: https://huggingface.co/api/datasets/lmsys/chatbot_arena_conversations
- Size: 33,000 rows, ~81 MB unpacked (card `dataset_info`).
- Fitness: labels reproducible; contamination: public since 2023 → very likely in later training data; code share is incidental → weak fit for a *taste* test set, useful as a labeled-conversation precedent.

### 8. Design Arena (platform)
- URL: https://www.designarena.ai/ · methodology: https://notes.designarena.ai/methodology/ · system prompts: https://designarena.ai/system-prompts
- Contains: blind pairwise arena over model outputs; the **Model Arena requires participants to accept text input and return "a single-file html/js/css code file"**; also Builder/Agent/Image/Video/Slides arenas; Elo via Bradley-Terry, ≥15 votes threshold, leaderboard refreshed every 2 hours (methodology page).
- Artifact type: **single-file HTML/CSS/JS designs (real code) + rendered previews + prompts**.
- Attribution: **harness** — models recruited at random, identities hidden during voting, revealed on the leaderboard; system prompts kept constant across providers (methodology page).
- License: system prompts are published (rendered from source); **no license for leaderboard data or battle outputs located on the methodology/homepage; platform ToS apply [UNVERIFIED]** (https://www.designarena.ai/terms returned 404 during research; footer Terms link path not resolved).
- Size: "Millions of people across 190+ countries" (homepage); exact battle count **[UNVERIFIED]**. Active model list and categories documented on methodology page.
- Fitness: labels harness-reproducible (prompt→model mapping controlled by platform); contamination: outputs are public on the platform; actual code (single-file HTML) → good fit if bulk access/licensing can be arranged.

### 9. GitHub `Design-Arena/agent-runner` (open harness)
- URL: https://github.com/Design-Arena/agent-runner (PyPI: https://pypi.org/project/agent-runner/ per https://notes.designarena.ai/ agent-harness announcement surfaced in search: https://notes.designarena.ai/introwhite-label-agent-harness/ )
- Contains: "Turn any model into an agent. Model-agnostic, framework agnostic agent harness." — CLI to run a prompt through any model (`agentrunner run "create a nextjs replica of discord"` per the announcement).
- Artifact type: **tool that produces attributed code runs** (you own the outputs).
- Attribution: **harness log** — you select the model per run, so attribution is exact by construction.
- License: **MIT** (GitHub API): https://api.github.com/repos/Design-Arena/agent-runner
- Size: small Python repo (repo `size: 268` KB, 106 stars, created 2025-11-16).
- Fitness: not a corpus by itself — it is the cleanest *generator* for a fresh, contamination-controlled, exactly-labeled corpus; labels reproducible; outputs are code.

### 10. DaraDoesCode video episode (per-model frontend comparison)
- URL: https://www.youtube.com/watch?v=WccVh77oZf4 ("I made EVERY AI model design one website...", 2026-03-25)
- Contains: side-by-side walkthrough of 5 generations × ~6 models × 2 conditions from one voice-typed prompt; benchmark link in description (https://ui-design-bench.vercel.app/ ).
- Artifact type: **video/screenshots**; the underlying code is in source #2's repo.
- Attribution: **author claim** on camera + repo backing.
- License: YouTube video (platform ToS); no explicit license stated in video/description **[UNVERIFIED]**.
- Size: one episode (~21:45); part of an ongoing per-model comparison series on the channel.
- Fitness: not directly corpus-usable (video), but documents the generation procedure (Cursor, ~$10 cost stated) → supports label reproducibility of source #2.

### 11. r/ClaudeCode same-prompt Codex-vs-Claude fish-game thread
- URL: https://www.reddit.com/r/ClaudeCode/comments/1wd01tk/same_prompt_codex_astra_6_vs_claude_fable_51_a/
- Contains: "Same prompt, Codex (Astra 6) vs Claude (Fable 5.1): 'a game where a fish follows my cursor, super creative and majestic.'" with screenshots and the author's quality assessment.
- Artifact type: **screenshots** (code not attached in the post as read) **[UNVERIFIED: attachments beyond screenshots]**.
- Attribution: **author claim**.
- License: none (Reddit user content under Reddit ToS).
- Size: 1 prompt × 2 models.
- Fitness: anecdotal; label not reproducible (prompt is quoted but harness/settings unstated); not code as published → weak fit; representative of the long tail of "same prompt, two models" threads that exist across Reddit.

---

## Quick comparison (fitness for a closed, taste-judged test set)

| Source | Actual code? | Label method | Label reproducible? | License for reuse | Contamination risk |
|---|---|---|---|---|---|
| Fishslop threads (#1) | No (video) | author claim | No (prompt unpublished) | n/a | High (viral 2026-09) |
| WhichAI.dev repo (#2/#3) | Yes | repo/URL metadata | Operator-claimed; input fixed & published | **None (unlicensed)** | Moderate (public 2026-03+) |
| Arena WebDev board (#4) | Not exported | harness | Yes | Site ToS **[UNVERIFIED]** | n/a (rankings only) |
| webdev-arena-preference-10k (#5) | Yes (HTML) | harness | Yes | Custom — **no redistribution** | Public since 2025 |
| leaderboard-dataset (#6) | No | harness | Yes | CC-BY-4.0 | n/a |
| chatbot_arena_conversations (#7) | Partial (text code) | harness | Yes | `cc` tag + gated terms | High (2023 data) |
| Design Arena (#8) | Yes (single-file HTML) | harness | Yes | **[UNVERIFIED]** | Public platform |
| agent-runner (#9) | Generated by you | harness | Yes (exact) | MIT | Controllable (fresh runs) |
| Dara video (#10) | No (video) | author claim | Procedure documented | YouTube ToS | Moderate |
| Reddit fish thread (#11) | Screenshots | author claim | No | none | Moderate |

## Search coverage for the leads (for the record)
- Fishslop: X/nitter full-text (`fishslop`), GitHub repo search `fishslop`, `fishslop user:t3dotgg` (0 results), GitHub code search `fishslop`, t3dotgg repository tab, https://fishslop.com (unrelated aquarium-seller-style landing page: "Raise fish, protect your aquarium, and hatch pets with friends." — not attributed to Theo), web news roundups (e.g. https://pasqualepillitteri.it/en/news/14472/gpt-6-astra-10-wild-builds ).
- Frontend-comparison creator: YouTube search for same-prompt design comparisons, GitHub repo searches (`which-ai`, `ui-design-bench`), X via daily.dev mirror of Dara's post, Theo's repository tab (surfaced the `ui-design-bench` fork), DesignCourse channel checked (no matching series found **[UNVERIFIED]**).
