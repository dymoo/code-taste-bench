# Slop Pattern Inventory

Normalized inventory of documented "code slop" patterns for building JEV noul/score questions.
Every entry carries a primary-source URL and license; unconfirmed facts are marked `[UNVERIFIED]`.

**Method.** Started from the local `install-anti-slop` skill (`/Users/nixman/.agents/skills/install-anti-slop`),
identified its upstreams, then broadened to other anti-slop rulebases and catalog posts.
Only rule inventories, READMEs, license files, and original catalog posts were used.

**Tag legend**

- `LINTABLE` — mechanically detectable by a static analyzer/linter over the AST or text.
- `JUDGMENT` — requires semantic/contextual judgment; better suited to score-level grounding than noul questions.
- `MIXED` — a lintable core with a judgment-dependent fringe (e.g. lint can flag, but deciding the fix needs judgment).

**Severity legend** — severity is reported as the *source's own default* where published:
`error` (source enables as error / fails the run), `warn`, `off` (source ships it disabled), `unspecified`.
For vendored rules the skill itself enables everything at `error` (see skill `SKILL.md` rule block).

---

## Named local lead: what the install-anti-slop skill is and where it comes from

The skill (`SKILL.md`, `references/update.md`, `scripts/install.mjs`, `assets/anti-slop/`) vendors an
Oxlint JS plugin and does not name its upstream in its own text; provenance was established externally:

- Upstream repo: **https://github.com/dmmulroy/anti-slop** — "From the anti-slop collection by Dillon Mulroy"
  (RoutineHub listing: https://routinehub.co/skill/install-anti-slop/, pointing at
  `dmmulroy/anti-slop/tree/main/skills/install-anti-slop`). License: **MIT** (Copyright 2026 Dillon Mulroy).
  The local bundle matches the upstream layout (`src/` == `assets/anti-slop/`, canonical per upstream README's
  `pnpm sync:skill-assets`).
- **ESLint Stylistic** — one file is vendored verbatim:
  `vendor/eslint-stylistic/padding-line-between-statements.ts`, source
  https://github.com/eslint-stylistic/eslint-stylistic commit `435c3ea0fd26a5fef9042c4b36b6e165fbbf8d08`,
  license **MIT** (UPSTREAM.md + LICENSE travel with the rule). The rule file cites ESLint core's
  https://github.com/eslint/eslint/blob/main/lib/rules/padding-line-between-statements.js (MIT) as reference.
- **Oxlint native companion**: `oxc/no-accumulating-spread` — enabled alongside the plugin
  (per skill README/config; native Oxlint rule, not part of the vendored source).
- **`@oxlint/plugins`** — the Oxlint plugin host the bundle imports; exact-version-pinned by the skill.

Every upstream named by the skill is covered below. Nothing named by the skill was unfindable.

---

## Rulebases cited (with license)

| # | Rulebase | URL | License | Size |
|---|----------|-----|---------|------|
| 1 | anti-slop (Dillon Mulroy) — Oxlint | https://github.com/dmmulroy/anti-slop | MIT | 18 generic + 5 Effect rules, plus 1 vendored Stylistic rule |
| 2 | ESLint Stylistic (vendored rule only) | https://github.com/eslint-stylistic/eslint-stylistic (commit `435c3ea0fd26a5fef9042c4b36b6e165fbbf8d08`) | MIT | 1 rule used |
| 3 | eslint-plugin-slop (Anthony Fu) | https://github.com/antfu/eslint-plugin-slop | MIT | 8 rules |
| 4 | @coderrob/eslint-plugin-zero-tolerance | https://github.com/Coderrob/eslint-config-zero-tolerance | Apache-2.0 (Copyright Robert Lindley) | 77 rules |
| 5 | sloplint (@dannote/sloplint) — ast-grep | https://github.com/dannote/sloplint | MIT (Copyright Danila Poyarkov) | 10 rules, 8 languages |
| 6 | no-more-slop (hellozheat) — agent skill + scorer | https://github.com/hellozheat/no-more-slop | MIT (Copyright Zheat) | 22 named code patterns + library/structural patterns |
| 7 | aislop (scanaislop) — scanner + pattern catalog | https://github.com/scanaislop/aislop , catalog https://scanaislop.com/patterns/ | MIT (repo description `[UNVERIFIED]` — seen only in search snippet; site does not print a license) | 14 cataloged patterns ("50+ deterministic rules" `[UNVERIFIED]`) |
| 8 | eslint-plugin-no-comment-slop (jantimon) | https://github.com/jantimon/eslint-plugin-no-comment-slop | `[UNVERIFIED]` (not fetched) | at least 3 rules (no-jargon, no-em-dash, no-trailing-period) |
| 9 | Clippy restriction/complexity lints (proposal) | https://github.com/nearai/ironclaw/issues/338 (merged as PR #428) | clippy itself: MIT/Apache-2.0 (rust-lang/rust-clippy); issue license n/a | 4 lint configs proposed |

Distinct upstream rulebases cited with URL + license: **8** (requirement: 3).

**Named slop patterns total: 114 entries** (counted at the end of each theme; overlaps across rulebases are
kept as separate entries because each carries its own source URL, tag, and severity).

Catalog/context posts (non-rulebase, cited per-entry below):

- Builder.io, "How to De-Slop an AI-Generated Codebase" (2026-09-16) — https://www.builder.io/blog/de-slop-ai-generated-codebase (no license; blog)
- scanaislop, "What Is Slop Code?" (2026-08-20) — https://scanaislop.com/blog/what-is-slop-code/ (no license; blog)
- Coderrob, "Announcing ESLint Zero-Tolerance AI Anti-Slop Rules" (2026-02-10) — https://coderrob.com/posts/announcing-eslint-zero-tolerance-ai-anti-slop-rules/ (blog)
- Better Stack, "Anti-Slop: Oxlint Rules for Safer AI-Generated Code" — https://betterstack.com/community/guides/ai/anti-slop-oxlint/ (blog)
- Stork.AI, "This Linter Kills AI Code Slop" (2026-08-20) — https://www.stork.ai/blog/this-linter-kills-ai-code-slop (AI-authored sponsored column; used only for rationale color, not rule facts)
- Evan Schwartz, "Your Clippy Config Should Be Stricter" — https://emschwartz.me/your-clippy-config-should-be-stricter/ (blog)
- maplibre "anti-slop editing pass" PR — https://github.com/maplibre/maplibre-tile-spec/pull/813 (quoted as sloplint's philosophy; repo license MPL-2.0 `[UNVERIFIED]` for the PR text itself)

---

## Theme 1 — Type-evidence laundering (low-evidence typing)

The signature AI pattern: code compiles and looks finished because types were discarded, widened, or
asserted rather than validated. Better Stack calls the chained-assertion form "type laundering"
(https://betterstack.com/community/guides/ai/anti-slop-oxlint/).

1. **Chained type assertions (`as unknown as X`)** — `anti-slop/no-chained-type-assertions`
   (https://github.com/dmmulroy/anti-slop, MIT; enabled `error`).
   Description: nested `as`/angle-bracket assertions fabricate evidence; chains of only `as const` stay legal.
   Before: `const user = input as object as User;` — After: parse at the boundary (`UserSchema.parse(input)`).
   Also flagged by Better Stack with the `fetch → json() → as unknown as Account` example.
   Same rule also exists as `slop/no-chained-type-assertions` in https://github.com/antfu/eslint-plugin-slop (MIT, `error`).
   Overlap also cataloged as **Double type assertion** `ai-slop/double-type-assertion` (https://scanaislop.com/patterns/, MIT-ish `[UNVERIFIED]`, manual fix).
   Tag: **LINTABLE**. Severity: error (anti-slop, eslint-plugin-slop).

2. **Unsafe type assertion (`as any`)** — `ai-slop/unsafe-type-assertion` (https://scanaislop.com/patterns/).
   `as any` bypasses the checker entirely for that value forward. Tag: **LINTABLE**. Severity: unspecified (scanner fails findings).

3. **Unsafe double assertion round-trip / widen-then-assert** — `anti-slop/no-widen-then-assert`
   (dmmulroy/anti-slop, MIT, error).
   Before: `const stored: unknown = loaded; const user = stored as User;` — After: keep the precise type.
   Tag: **LINTABLE**. Builder.io documents the fuller form: validate → widen to `unknown` → cast back three
   files later; its correct example keeps `return accountSchema.parse(input);`
   (https://www.builder.io/blog/de-slop-ai-generated-codebase).

4. **Known-value widening** — `anti-slop/no-known-value-widening` (dmmulroy/anti-slop, MIT, error).
   Known expressions flowing into `unknown`/`object`/open dictionaries, e.g.
   `const handlers: Record<string, Handler> = { start: startHandler };` discards the known `start` key;
   fix: preserve inference or `satisfies Record<...>`. Tag: **LINTABLE**.

5. **Unjustified type assertion (missing SAFETY comment)** — `anti-slop/require-safety-comment-for-type-assertion`
   (dmmulroy/anti-slop, MIT, error; markers configurable, default `SAFETY`).
   Before: `const userId = value as UserId;`
   After: `// SAFETY: parseUserId validated the identifier before branding it.` above the assertion.
   Message: "State the checked invariant immediately before the assertion."
   Tag: **LINTABLE** (presence/format of marker); whether the justification is *true* is JUDGMENT.

6. **`unknown` function parameters** — `anti-slop/no-unknown-parameters` (dmmulroy/anti-slop, MIT, error).
   Before: `function handle(input: unknown) {}` — After: decode at the I/O boundary; `cause` and type-predicate subjects excepted.
   Tag: **LINTABLE**.

7. **`unknown` return contracts** — `anti-slop/no-unknown-returns` (dmmulroy/anti-slop, MIT, error).
   Before: `function loadUser(): unknown` — After: return a parsed domain type.
   Tag: **LINTABLE**.

8. **`unknown` type aliases** — `anti-slop/no-unknown-type-aliases` (dmmulroy/anti-slop, MIT, error).
   Before: `type ExternalValue = unknown;` Tag: **LINTABLE**.

9. **Unsafe dictionary type** — `anti-slop/no-unsafe-dictionary-type` (dmmulroy/anti-slop, MIT, error).
   Before: `type Metadata = Record<string, unknown>;` — After: value-typed record or `T extends Record<string, unknown>`.
   Tag: **LINTABLE**.

10. **Broad `object` parameters** — `anti-slop/no-object-parameters` (dmmulroy/anti-slop, MIT, error).
    Before: `function save(value: object) {}` — After: an owner-provided type parsed at the boundary.
    Tag: **LINTABLE**.

11. **Runtime `typeof` narrowing** — `anti-slop/no-runtime-typeof` (dmmulroy/anti-slop, MIT, error; `allowInTypeGuards` option, default false).
    Before: `if (typeof input === "string") useName(input);` — After: schema/boundary parsing. Existence probes (`typeof x === "undefined")` allowed.
    Tag: **LINTABLE**.

12. **`Reflect.apply`** — `anti-slop/no-reflect-apply` (dmmulroy/anti-slop, MIT, error). Bypasses ordinary typed calls.
    Before: `Reflect.apply(operation, owner, args);` Tag: **LINTABLE**.

13. **`Reflect.get`** — `anti-slop/no-reflect-get` (dmmulroy/anti-slop, MIT, error). Bypasses typed property access.
    Tag: **LINTABLE**.

14. **Conditional empty-object spread** — `anti-slop/no-conditional-empty-object-spread` (dmmulroy/anti-slop, MIT, error, intentionally no autofix).
    Before: `const options = { ...(timeout !== undefined ? { timeout } : {}) };` — omission ≠ assigning undefined.
    Builder.io notes a *correct* conditional spread should be left alone (their "no change needed" case), so the rule is a tripwire, not proof of slop. Tag: **MIXED**.

15. **Unexplained TypeScript directive** — `ai-slop/ts-directive` (https://scanaislop.com/patterns/).
    `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` with no reason comment. Companion rules that ban the carriers outright:
    `zero-tolerance/no-ts-nocheck` and `zero-tolerance/no-eslint-disable` (https://github.com/Coderrob/eslint-config-zero-tolerance, Apache-2.0, strict:error / recommended:warn).
    Tag: **LINTABLE**. Severity: error (strict).

16. **Explicit `any`** — `zero-tolerance/no-explicit-any` (Coderrob, Apache-2.0, strict:error/recommended:warn, type "problem").
    "Model unknown values precisely and narrow them explicitly." Tag: **LINTABLE**.

17. **`as` type assertions (blanket ban)** — `zero-tolerance/no-type-assertion` (Coderrob, Apache-2.0, strict:error).
    Stricter cousin of anti-slop's rules: bans `as` entirely. Tag: **LINTABLE**.

18. **Non-null assertion (`!`)** — `zero-tolerance/no-non-null-assertion` (Coderrob, Apache-2.0, strict:error, "problem").
    Tag: **LINTABLE**.

19. **Untyped `JSON.parse`** — `zero-tolerance/no-unsafe-json-parse` (Coderrob, Apache-2.0, strict:error, "problem").
    Treating `JSON.parse` results as typed data without validation. Tag: **LINTABLE**.

20. **Indexed access types** — `zero-tolerance/no-indexed-access-types` (Coderrob, Apache-2.0, strict:error, "problem").
    Opinionated ban (contested elsewhere; the rule's own rationale is docs page-level). Tag: **LINTABLE**. Severity: error (strict).

21. **Trivial type aliases** — `slop/no-trivial-type-aliases` (antfu/eslint-plugin-slop, MIT, `error`).
    Top-level aliases resolving through same-file chains to `unknown` or a primitive. Tag: **LINTABLE**.

22. **Widened argument passed to `unknown` predicate** — covered inside `anti-slop/no-known-value-widening`
    (the `isUser(user)` where `user` was already `User` case; fix: call predicates at the unparsed boundary).
    Tag: **LINTABLE**.

Theme 1: 22 entries.

---

## Theme 2 — Comments, prose, and narration

23. **Narrative comment** — `ai-slop/narrative-comment` (https://scanaislop.com/patterns/; auto-fixable).
    Multi-line comment walking through what the function does in prose; the signature already says it.
    Tag: **LINTABLE** (with a fringe JUDGMENT: some prose documents non-obvious constraints). Severity: unspecified.

24. **Trivial comment (restates next line)** — `ai-slop/trivial-comment` (scanaislop; auto-fixable).
    Before: `// Increment counter` above `counter++` — After: delete.
    Same pattern: `sloplint` `obvious-comment` (https://github.com/dannote/sloplint, MIT),
    example `// Initialize the counter` above `let counter = 0`.
    Tag: **LINTABLE** (mostly — sloplint explicitly whitelists valuable comments like wire-format/SAFETY/Mutex-ordering notes).

25. **Narrator comment** — `sloplint/narrator-comment` (dannote/sloplint, MIT).
    `// This function handles the request`. Philosophy: "Good comments explain *why*. Slop comments explain *what*."
    Tag: **LINTABLE**.

26. **Step comment / step banner** — `sloplint/step-comment` (dannote/sloplint, MIT), example `// Step 1: Validate input`.
    Same pattern in no-more-slop **#3 Step banners** (`# Step 1: Fetch users` → remove; https://github.com/hellozheat/no-more-slop, MIT).
    Tag: **LINTABLE**.

27. **Section divider** — `sloplint/section-divider` (dannote/sloplint, MIT), example `// ============` or `// --- Helpers ---`.
    Tag: **LINTABLE**.

28. **Placeholder comment** — `sloplint/placeholder-comment` (dannote/sloplint, MIT), example `// ... rest of the code` / `omitted for brevity`.
    Tag: **LINTABLE**.

29. **Apologetic comment** — `sloplint/apologetic-comment` (dannote/sloplint, MIT), example `// quick hack` / `// good enough for now`.
    Tag: **LINTABLE**.

30. **AI-generated comment** — `sloplint/ai-generated-comment` (dannote/sloplint, MIT), example `// Replace this with your actual implementation`.
    Tag: **LINTABLE**.

31. **Em dash in code/docs (U+2014)** — `slop/no-em-dash` (https://github.com/antfu/eslint-plugin-slop, MIT, `error`).
    Fires in *any* parser-compatible language including Markdown; a universal rule. Treated as an AI prose tell.
    Tag: **LINTABLE**. (Also shipped as `no-comment-slop/no-em-dash` in jantimon/eslint-plugin-no-comment-slop `[UNVERIFIED]`.)

32. **Jargon / inflated vocabulary in comments** — `slop/no-jargon` (antfu/eslint-plugin-slop, MIT, `error`;
    options `words`, `extraWords`, `allow`; catches simple inflections like `utilizes`, `delving`; never fires inside backticks/quotes).
    Tag: **LINTABLE**. Also `no-comment-slop/no-jargon` upstream `[UNVERIFIED]`.

33. **Overlong comment blocks** — `slop/max-comment-length` (antfu/eslint-plugin-slop, MIT, `error`;
    `maximumWords` default 50, JSDoc ignored by default; adjacent line comments grouped into logical blocks).
    Tag: **LINTABLE**.

34. **`//` comment on an export/member instead of JSDoc** — `slop/prefer-jsdoc` (antfu/eslint-plugin-slop, MIT, `error`, autofix to `/** */`).
    Tag: **LINTABLE**.

35. **Trailing period in comments** — `no-comment-slop/no-trailing-period` (https://github.com/jantimon/eslint-plugin-no-comment-slop, license `[UNVERIFIED]`; rule name seen in README snippet).
    Tag: **LINTABLE**.

36. **Trivial docstrings** — no-more-slop **#1 Trivial docstrings** (hellozheat/no-more-slop, MIT).
    Before: `"""Adds two numbers and returns the sum."""` — After: remove.
    Related hard rules: `zero-tolerance/require-jsdoc-functions` and `require-jsdoc-anonymous-functions` go the
    *opposite* direction (mandate JSDoc on real functions, except tests) — i.e. zero-tolerance treats *missing*
    docs as slop too; note the tension when writing questions. Tags: #1 **LINTABLE** (heuristic); zero-tolerance requires **MIXED**.

37. **Tutorial voice** — no-more-slop **#4 Tutorial voice** (MIT).
    Before: `# Here we validate the input` — After: `# skip rows from legacy import` (a why-comment).
    Tag: **MIXED** (detectable phrasing; deciding the replacement needs judgment).

38. **Emoji narration** — no-more-slop **#5 Emoji narration** (MIT).
    Before: `console.log("✅ Success!")` — After: remove or use a real logger.
    Tag: **LINTABLE** (emoji detection is trivial). Severity: scoring-based (no linter severity published).

39. **Markdown-in-comments** — no-more-slop **#19** (MIT). Before: `# **Important**` — After: plain text.
    Tag: **LINTABLE**.

40. **Uniform comment density** — no-more-slop **#7** (MIT). Every line commented → few uneven *why* comments.
    Companion **#14 Eerie uniformity**: same comment style on every function → match neighbor variance.
    Tags: **JUDGMENT** (distribution + repo-local calibration; the skill scores it, doesn't lint it).

Theme 2: 18 entries (23–40).

---

## Theme 3 — Error handling slop

41. **Swallowed exception** — `ai-slop/swallowed-exception` (https://scanaislop.com/patterns/).
    try/catch where catch is empty or comment-only: no log, no rethrow, no recovery. Tag: **LINTABLE**.

42. **Empty error handler (multilingual)** — `sloplint/empty-error-handler` (dannote/sloplint, MIT;
    TS/JS/Java/Python/Ruby): `catch (e) {}`, bare `except:`, empty `rescue`. Tag: **LINTABLE**.

43. **Silent exception (Python)** — `sloplint/silent-exception` (dannote/sloplint, MIT): `except Exception: pass`.
    Tag: **LINTABLE**.

44. **Log-instead-of-handle in catch** — `sloplint/log-in-error-handler` (dannote/sloplint, MIT):
    `console.log` inside catch. Tag: **LINTABLE** (as a *flag*; whether logging is the right handling is judgment).

45. **Empty catch block** — `zero-tolerance/no-empty-catch` (Coderrob, Apache-2.0, strict:error, "problem"):
    "Disallow empty catch blocks that silently swallow errors." Tag: **LINTABLE**.

46. **Swallow-all catch returning a fallback** — no-more-slop **#15 Swallow-all catch** (MIT).
    Before: `catch (e) { return null }` — After: throw or catch specific; **must be called out** because it changes the failure path.
    Tag: **MIXED** (shape detectable; safe rewrite requires judgment).

47. **Throwing literals** — `zero-tolerance/no-throw-literal` (Coderrob, Apache-2.0, strict:error, "problem").
    Tag: **LINTABLE**.

Theme 3: 7 entries (41–47).

---

## Theme 4 — Structure, abstraction, wrappers, ceremony

48. **Thin wrapper** — `ai-slop/thin-wrapper` (https://scanaislop.com/patterns/).
    A function that only forwards the same arguments to another function — "no transformation, no added value, just an extra layer."
    Tag: **MIXED** (call-shape is lintable; deciding whether the layer is an intentional seam is judgment).

49. **Static-only class used as namespace** — `slop/no-static-only-class` (antfu/eslint-plugin-slop, MIT, `error`).
    Classes whose members are all `static` (empty boilerplate ctor ignored; superclass/implements/decorators/abstract/static blocks exempt).
    Tag: **LINTABLE**.

50. **Single-use helper** — no-more-slop **#12** (MIT). A 3-line function called once → inline.
    Tag: **MIXED** (call-count lintable; inlining judgment — exported API may warrant it).

51. **Over-engineering (factory for one use case)** — no-more-slop **#11 Over-engineering** (MIT). Factory for one use case → plain function.
    Builder.io's **deletion test** sharpens this: before adding an abstraction, name what existing code it lets you delete
    (https://www.builder.io/blog/de-slop-ai-generated-codebase).
    Tag: **JUDGMENT**.

52. **Response envelope** — no-more-slop **#13** (MIT). Before: `{ status: 'success' }` / `{ ok: true }` — After: return data or throw, if the API allows. Config allows `envelopeAllowlist` for MCP/API surfaces.
    Tag: **MIXED** (shape lintable, acceptability contextual).

53. **Near-duplicate / almost-duplicate helpers** — Builder.io catalog: "two helpers do almost the same thing, except neither quite fits the next task, so someone writes a third"; fixing needs a decision about where a responsibility belongs.
    Tag: **JUDGMENT** (clone detectors flag candidates only).

54. **Defensive checks for impossible inputs** — Builder.io: "the code fills up with defensive checks for inputs the system can't actually receive."
    Tag: **JUDGMENT**.

55. **Premature generalization / abstraction that deletes nothing** — Builder.io deletion test + shared-validator example:
    if every caller keeps its old defensive code *and* must understand a new wrapper, the abstraction earned nothing.
    Tag: **JUDGMENT**.

56. **Redundant null check** — no-more-slop **#16** (MIT). Guard after a typed non-null parameter → remove unreachable guard.
    Tag: **MIXED** (reachability analyzable in simple cases).

57. **Boolean flag argument** — `zero-tolerance/no-flag-argument` (Coderrob, Apache-2.0, strict:error).
    Prefer explicit methods or command objects. (Note: this is the *counter* to config-object ceremony — the source
    argues for command objects over boolean flags.) Tag: **LINTABLE**.

58. **else-after-return (no guard clause)** — `zero-tolerance/prefer-guard-clauses` (Coderrob, Apache-2.0, strict:error).
    Tag: **LINTABLE**.

Theme 4: 11 entries (48–58).

---

## Theme 5 — Naming and magic values

59. **Generic naming** — `ai-slop/generic-naming` (https://scanaislop.com/patterns/).
    Variables/parameters named `data`, `result`, `value`, `temp`, `obj`, `info`, `item` — "this is a noun without saying which noun."
    Same pattern: no-more-slop **#9 Generic names** — `processData(data)` → `parseInvoice(raw)`.
    Tag: **MIXED** (denylist lintable; good replacement needs judgment).

60. **Verbose names** — no-more-slop **#8** (MIT). `totalUserInputCharacterCount` → `charCount`.
    Tag: **JUDGMENT** (length heuristics exist but repo style decides).

61. **Non-idiomatic locals** — no-more-slop **#10** (MIT). `for (let index = 0; …)` → `for (const item of items)`.
    Tag: **MIXED**.

62. **Forbidden term in symbol names (`shape`)** — `anti-slop/no-shape-in-symbol-names` (dmmulroy/anti-slop, MIT, error).
    Before: `interface UserShape { id: string }` — bans case-insensitive `shape` in locally-owned names; static member reads like `schema.shape` allowed.
    Tag: **LINTABLE** (project-specific vocabulary ban; note it is local policy, not a universal rule).

63. **Magic numbers** — `zero-tolerance/no-magic-numbers` (Coderrob, Apache-2.0, strict:error). Tag: **LINTABLE**.

64. **Magic strings** — `zero-tolerance/no-magic-strings` (Coderrob, Apache-2.0, strict:error). Tag: **LINTABLE**.

Theme 5: 6 entries (59–64).

---

## Theme 6 — Test slop

65. **Module mocking (Vitest/Jest `vi.mock` etc.)** — `anti-slop/no-module-mocking` (dmmulroy/anti-slop, MIT, error).
    Before: `vi.mock("./user-store")` — After: replace dependencies through real interfaces/seams.
    Tag: **LINTABLE**. Severity: error.

66. **Persistent mock implementations (test bleed)** — `zero-tolerance/no-mock-implementation` (Coderrob, Apache-2.0, strict:error).
    Prohibits persistent mock impls; use `Once` variants. Announcement post cites "tests that pass while still bleeding state."
    Tag: **LINTABLE**.

67. **Imprecise call matchers** — `zero-tolerance/no-jest-have-been-called` (Coderrob, Apache-2.0, strict:error).
    Bans `toHaveBeenCalledWith` etc. in favor of explicit count + nth-call assertions.
    Tag: **LINTABLE**.

68. **Timers in tests** — `zero-tolerance/no-set-timeout-in-tests`, `no-set-interval-in-tests` (Coderrob, Apache-2.0, strict:error). Tag: **LINTABLE**.

69. **`fetch` in tests** — `zero-tolerance/no-fetch-in-tests` (Coderrob, Apache-2.0; shipped **off** in both presets per README table). Tag: **LINTABLE**. Severity: off by default.

70. **Interfaces declared inside test files** — `zero-tolerance/no-test-interface-declaration` (Coderrob, Apache-2.0, strict:error). Import production types instead. Tag: **LINTABLE**.

71. **Test description style** — `zero-tolerance/require-test-description-style` (Coderrob, Apache-2.0, strict:error): descriptions start with "should". (Local convention, not a universal slop rule.) Tag: **LINTABLE**.

72. **Mocking your own internals / tests that prove nothing** — Builder.io catalog:
    a Clips import test mocked the repo's own security, persistence, and uploads modules — "examine what the test could actually
    prove before deciding which mocks to replace." Also: tests that only exercise valid input can't verify the invalid-input contract.
    Tag: **JUDGMENT**. (anti-slop's `no-module-mocking` is the lintable slice; adequacy itself is not.)

Theme 6: 8 entries (65–72).

---

## Theme 7 — Residue and placeholders (work left behind)

73. **Orphan TODO stub** — `ai-slop/todo-stub` (https://scanaislop.com/patterns/). `// TODO` without owner, ticket, or completion plan.
    no-more-slop **#6 Placeholder TODOs**: `# TODO: your logic here` → remove or `TODO(PROJ-123): …`.
    sloplint explicitly *allows* `// TODO: optimize later` (valuable-comment whitelist) — note the disagreement.
    Tags: with ticket → **LINTABLE**; "orphan" judgment on ownership → **MIXED**.

74. **Unused import / dead imports** — `ai-slop/unused-import` (scanaislop, auto-fixable);
    no-more-slop **#21 Dead imports** (MIT). Tag: **LINTABLE**.

75. **Console leftover** — `ai-slop/console-leftover` (scanaislop): `console.log`/`print` left in production code after debugging. Tag: **LINTABLE**.

76. **Empty function / stubbed body** — `ai-slop/empty-function` (scanaislop): "a placeholder the agent stubbed to make a signature compile and forgot to fill in." Tag: **LINTABLE**.

77. **Placeholder / stub / TODO in production code** — `zero-tolerance/no-placeholder-implementation` (Coderrob, Apache-2.0, strict:error, type "problem"). Tag: **LINTABLE**.

78. **Unreachable code** — `ai-slop/unreachable-code` (scanaislop): code after `return`/`throw`/`break`/`continue`. Tag: **LINTABLE**.

79. **Constant condition** — `ai-slop/constant-condition` (scanaislop): `if (true)`, `while (false)`, `if (1)` — dead branch left in source. Tag: **LINTABLE**.

80. **Throwaway demo main** — no-more-slop **#18** (MIT): appended `if __name__ == '__main__'` demo → remove. Tag: **LINTABLE**.

81. **Hallucinated APIs** — no-more-slop **#22** (MIT): an import that doesn't exist in the repo. Policy: *report; don't invent a fix*. Tag: **LINTABLE** (unresolved-import check).

82. **Leftover helper from a discarded approach** — scanaislop definition post: "residue left after an agent searched for a
    working solution: abandoned branches … unused helpers … TODO stubs that survived into the merge"
    (https://scanaislop.com/blog/what-is-slop-code/). Distinct from a merely unused export: the *provenance* is a reverted approach.
    Tag: **MIXED** (dead-code tools find them; provenance is judgment).

Theme 7: 10 entries (73–82).

---

## Theme 8 — Performance-shaped slop

83. **Adjacent eager `filter().map()`** — `anti-slop/no-array-filter-map` (dmmulroy/anti-slop, MIT, error, no autofix).
    Before: `users.filter(u => u.active).map(u => u.email)` — After: lazy `.values().filter().map().toArray()` where
    iterator helpers exist, or a single `flatMap`/mutating reducer. README warns lazy pipelines "are not guaranteed to be faster."
    Tag: **LINTABLE** (documented limits: untyped receivers not inferred).

84. **Reducer accumulator copying** — `anti-slop/no-reduce-accumulator-copy` (dmmulroy/anti-slop, MIT, error).
    Before: `items.reduce((acc, item) => Object.assign({}, acc, {…}), {})`, `acc.concat([item])`, `acc.slice()` + push —
    quadratic risk. After: mutate a fresh local accumulator. Message: "growing copies can cause quadratic work."
    Tag: **LINTABLE** (named callbacks/nested helpers out of scope).

85. **Accumulating spread in reduce/loops** — native `oxc/no-accumulating-spread` (Oxlint builtin; paired by anti-slop's README, error). Tag: **LINTABLE**.

86. **`await` inside loops** — `zero-tolerance/no-await-in-loop` (Coderrob, Apache-2.0, strict:error, "problem"): use `Promise.all()`. Tag: **LINTABLE**.

Theme 8: 4 entries (83–86).

---

## Theme 9 — Complexity and size (incl. the Clippy story)

Context: nearai/ironclaw issue #338 (https://github.com/nearai/ironclaw/issues/338, closed by PR #428) is a primary
documented case of enabling existing Clippy lints specifically against agent-generated code: "49 functions exceed 80
lines, including `main()` at 554 lines"; "10 structs have 10+ fields, some mixing unrelated concerns."
Evan Schwartz's post (https://emschwartz.me/your-clippy-config-should-be-stricter/) argues the same from a production incident.

87. **Excessive cognitive complexity** — `clippy::cognitive_complexity` with `cognitive-complexity-threshold = 15` (issue #338; default 25 called "too permissive"). Deeply nested `match`/`if let` chains 4–5 deep. Tag: **LINTABLE**. Severity: warn (proposal explicitly starts at `warn`).

88. **Overlong functions** — `clippy::too_many_lines` with `too-many-lines-threshold = 100`; plus `zero-tolerance/max-function-lines` (Coderrob, Apache-2.0, strict:error). Tag: **LINTABLE**. Severity: warn (clippy proposal) / error (zero-tolerance strict).

89. **Too many arguments** — `clippy::too_many_arguments` with threshold 6 (issue #338: "Nudges toward builder patterns or config structs"); plus `zero-tolerance/max-params` (Coderrob, strict:error). Tag: **LINTABLE**.

90. **Deeply nested types** — `clippy::type_complexity` with `type-complexity-threshold = 200`: `Arc<RwLock<HashMap<…>>>` "should get a newtype wrapper." Tag: **LINTABLE**. Severity: warn.

91. **God structs (10+ fields, mixed concerns)** — issue #338 observation, no dedicated lint named (proposed thresholds don't cover field count; zero-tolerance doesn't ship a field-count rule either). Tag: **JUDGMENT** (or metric-gate). Severity: n/a (observation).

Theme 9: 5 entries (87–91).

---

## Theme 10 — Readability, formatting, vocabulary

92. **Missing blank lines between declarations (readability spacing)** — `anti-slop/require-readable-spacing`
    (dmmulroy/anti-slop, MIT, error, autofix; engine vendored from ESLint Stylistic).
    Before: `export const first = 1; /** doc */ export const second = 2;` → autofix inserts blank line before the doc comment.
    Preserves compact local bindings, imports, overload groups; never removes blank lines; whitespace only (no braces/sorting).
    Tag: **LINTABLE**. Severity: error.

93. **Vendored readability engine** — `padding-line-between-statements`
    (ESLint Stylistic @ `435c3ea0fd26a5fef9042c4b36b6e165fbbf8d08`, MIT; ESLint core reference rule MIT).
    Not a slop pattern per se — listed because the skill explicitly vendors and names it as an upstream.
    Tag: **LINTABLE**.

Theme 10: 2 entries (92–93).

---

## Theme 11 — Library-reuse slop (dependency already present)

no-more-slop's "Library slop" section (https://github.com/hellozheat/no-more-slop, MIT): rewriting by hand what the
repo's existing dependency already does. Policy: won't add new npm packages without being told.

94. **Manual `groupBy`** — before: `Object.keys(x).reduce(...)` — after: `groupBy(items, 'key')` when dep exists. Tag: **MIXED**.

95. **JSON round-trip clone** — before: `JSON.parse(JSON.stringify(x))` — after: `structuredClone(x)`/`cloneDeep`.
    Corroborated by `zero-tolerance/prefer-structured-clone` (Coderrob, Apache-2.0, strict:error). Tag: **LINTABLE**.

96. **Manual date formatting** — before: `getFullYear()` string hacks — after: `format(date, 'yyyy-MM-dd')` (existing dep). Tag: **MIXED**.

Theme 11: 3 entries (94–96).

---

## Theme 12 — Effect-TS architecture slop (opt-in group)

All from dmmulroy/anti-slop `effect/` plugin (MIT, error; enabled only for direct `effect` dependents).
The README's Before/After pairs are shown verbatim-in-spirit:

97. **Manual tag comparison** — `anti-slop-effect/no-manual-tag-comparison`.
    Before: `if (result._tag === "Ready") useReady(result);` — After: `Predicate.isTagged("Ready")(result)` or `Match`. Tag: **LINTABLE**.

98. **Manual tagged construction** — `anti-slop-effect/no-manual-tagged-construction`.
    Before: `const result = { _tag: "Ready", value }` — After: `Ready.make({ value })` / `Data.taggedEnum`. Tag: **LINTABLE**.

99. **Manual error-tag branching in broad catches** — `anti-slop-effect/no-manual-effect-error-tag`.
    Before: `Effect.catch(error => error._tag === "NotFound" ? recover : Effect.fail(error))` — After: `Effect.catchTag("NotFound", …)`. Tag: **LINTABLE**.

100. **Service constructor imports leaking across modules** — `anti-slop-effect/no-service-constructor-imports`.
     Before: `import { makeIssueService } from "./issue-service.ts"` outside tests — After: import the owning Layer and yield the service. Tag: **LINTABLE**.

101. **Chained literal ternaries over one value** — `anti-slop-effect/prefer-effect-match`.
     Before: `kind === "a" ? "A" : kind === "b" ? "B" : "Other"` — After: `Match.value(kind).pipe(Match.when…, Match.orElse…)`. Tag: **MIXED** (syntactic; whether `Match` is actually clearer is judgment).

Theme 12: 5 entries (97–101).

---

## Theme 13 — Process / meta slop (suppressing rather than fixing)

102. **`eslint-disable` comments** — `zero-tolerance/no-eslint-disable` (Coderrob, Apache-2.0, strict:error).
     "Fix the root cause, don't silence the symptom." Announcement: "Lock down your ESLint config, because your agent will absolutely try to turn the rules off." Tag: **LINTABLE**.

103. **`@ts-nocheck`** — `zero-tolerance/no-ts-nocheck` (Coderrob, Apache-2.0, strict:error, "problem"). Tag: **LINTABLE**.

104. **Lint-clean-but-wrong rewrites (gaming the check)** — Builder.io documented three trials where an agent removed the
     flagged pattern while preserving the actual defect (unvalidated input still reached dispatch; broad type renamed but
     still unvalidated). Lesson: acceptance condition must state the guarantee, not "the warning is gone."
     Tag: **JUDGMENT** — the canonical JEV score-level pattern.

105. **Re-export / barrel sprawl breeding circular imports** — `zero-tolerance/no-re-export`,
     `no-barrel-parent-imports`, `require-clean-barrel` (Coderrob, Apache-2.0, strict:error).
     Announcement post lists "re-exports breeding circular references" among AI-accelerated debt. Tag: **LINTABLE**.

Theme 13: 4 entries (102–105).

---

## Theme 14 — Misc zero-tolerance quality gates frequently triggered by generated code

106. **Date/Math.random in non-config code (nondeterminism)** — `zero-tolerance/no-date-now`, `no-math-random`
     (Coderrob, Apache-2.0, strict:error): inject clocks/randomness. Tag: **LINTABLE**.

107. **`process.env` reads outside config** — `zero-tolerance/no-process-env-outside-config` (Coderrob, strict:error). Tag: **LINTABLE**.

108. **Query functions with side effects** — `zero-tolerance/no-query-side-effects` (Coderrob, strict:error):
     `get*`/`is*`/`has*`/`can*`/`should*` must not mutate. Tag: **MIXED**.

109. **Redundant boolean comparison** — `zero-tolerance/no-redundant-boolean` (Sonar S1125; Coderrob, strict:error). Tag: **LINTABLE**.

110. **Identical branches / identical expressions** — `zero-tolerance/no-identical-branches`,
     `no-identical-expressions` (Sonar S1764; Coderrob, strict:error). Copy-paste residue. Tag: **LINTABLE**.

111. **Non-exhaustive switch over a union/enum** — `zero-tolerance/require-exhaustive-switch` (Coderrob, strict:error).
     Tag: **LINTABLE**.

112. **I/O without timeout/cancellation** — `zero-tolerance/require-timeout-for-io` (Coderrob, strict:error). Tag: **LINTABLE**.

113. **Hardcoded secrets / raw SQL / shell construction / code generation** — `zero-tolerance/no-hardcoded-secrets`,
     `no-raw-sql-interpolation`, `no-shell-command-construction`, `no-unsafe-code-generation` (Coderrob, strict:error).
     Listed as a group; classic AI-generated vulnerability shapes. Tags: **LINTABLE**.

114. **Parameter reassignment / input mutation** — `zero-tolerance/no-parameter-reassign`,
     `no-object-mutation`, `no-array-mutation`, `no-map-set-mutation`, `prefer-readonly-parameters`
     (Coderrob, strict:error). Tag: **LINTABLE**.

Theme 14: 9 entries (106–114).

---

## Cross-source disagreements worth knowing when writing JEV questions

- **Conditional empty-object spread**: anti-slop bans it outright; Builder.io's field trial found a *correct*
  conditional spread ("Omitting the field was the intended behavior") that should be left alone. → noul question
  candidate: "which anti-slop finding is actually correct code?"
- **TODO comments**: sloplint whitelists `// TODO: optimize later` as valuable; scanaislop flags any TODO without an
  owner/ticket; no-more-slop wants `TODO(PROJ-123)`. Severity of the offense is convention-dependent.
- **JSDoc density**: zero-tolerance *requires* JSDoc on functions; anti-slop/sloplint treat restating docstrings as slop.
  The distinction is substance (why/invariant) vs. restatement.
- **Widening at boundaries**: anti-slop bans broad types even at boundaries in some cases; Builder.io notes
  "A broad type at an external input boundary can be appropriate." → judgment territory.
- **`no-indexed-access-types`, `no-literal-unions` (prefer enums), `require-interface-prefix` ("I" prefix)** in
  zero-tolerance are house style, not community consensus — treat as that rulebase's policy, not slop axioms.

---

## Appendix — searches that yielded nothing (or unresolved)

Per the contract: everything checked that did not produce citable rule-level results.

1. **Ruff rulebase dedicated to AI slop** — searched `ruff "AI slop" OR "anti-slop" plugin python` repeatedly.
   No Ruff-native anti-slop rule pack found. Adjacent, not verified in depth: `TinyFrontier/anti-slop-py`
   (https://github.com/TinyFrontier/anti-slop-py — a *skill* that hands Ruff duplicate rules ANN401, B009, B010,
   PGH003 over to its own checker; details `[UNVERIFIED]`, README not fetched); `sloppylint` (Reddit r/Python post,
   claims 100+ AI-specific Python patterns — repo URL not retrieved, `[UNVERIFIED]`). aislop *wraps* ruff rather
   than extending it.
2. **Biome-native anti-slop rules** — searched `biome "AI slop" / anti-slop rules`. None found; Biome appears only as
   a backend inside aislop/desloppify.
3. **Clippy *new* AI-specific lints** — no dedicated `clippy::ai_*` lints exist; the only documented effort is
   ironclaw#338 enabling *existing* restriction/complexity lints (covered above). A "cargo-crap" tool (untested
   complexity in AI Rust code) appeared in Reddit r/rust but its primary repo/blog was not retrieved — `[UNVERIFIED]`,
   excluded from the inventory.
4. **Dedicated emoji-in-commit-messages / marketing-tone commit linter** — searched gitlint/commitlint/AI commit emoji.
   Found adjacent tools only: `gitfluff` (Conventional Commits + AI-signature cleanup, Reddit r/Python, repo
   `[UNVERIFIED]`); a dev.to post "I wrote a linter for AI-writing tells" (`.slop.json`, rules over docs *and* commit
   messages — repo not retrieved, `[UNVERIFIED]`). No primary rule list obtained → no inventory entries.
   (Gitmoji is the *opposite* convention — it mandates emoji — and is out of scope.)
5. **Cursor `.cursor/rules` collections banning AI anti-patterns** — searched twice; only unrelated results
   (an unrelated "detect AI code slop patterns PHP" post, generic awesome-cursorrules noise). No vetted primary
   collection with named rules retrieved → nothing citable. The closest documented *agent-skill* equivalents that
   WERE verified: `hellozheat/no-more-slop` (covered) and prose-only skills `blader/humanizer`,
   `petergyang/no-ai-slop` (https://github.com/petergyang/no-ai-slop), `hardikpandya/stop-slop`
   (https://github.com/hardikpandya/stop-slop) — the latter two are **prose** slop, out of the code-slop scope here.
6. **blog.compendialabs.org "eslint-plugin-slop: Catching AI-Infected Code in CI"** — fetch failed with a certificate
   verification error on every attempt (direct, `?output=1`, Google cache). Facts used only from search-result
   snippets (v0.1.2, "7 ESLint rules", diff mode) — the live README of antfu/eslint-plugin-slop (fetched directly)
   shows **8** rules, so the post's "7" reflects an earlier version. Snippet-only claims are marked above.
7. **Additional rulebases surfaced but not fully verified** (listed for honesty, excluded from inventory):
   `flamehaven01/AI-SLOP-Detector` (https://github.com/flamehaven01/ai-slop-detector — empty functions, fake
   documentation, inflated comments; README not fetched, license `[UNVERIFIED]`);
   `eslint-plugin-anti-slop` npm 0.4.0 (https://libraries.io/npm/eslint-plugin-anti-slop — "config-driven React/TS",
   only Libraries.io listing seen, `[UNVERIFIED]`); `desloppify` (https://libraries.io/npm/desloppify — multi-language
   advisory scanner, recommendations-only, `[UNVERIFIED]`); PHP `slop-scan` (daily.dev post only, `[UNVERIFIED]`);
   `miqdadbadjuber/anti-slop` (UI/copy filter rules, not code linting, `[UNVERIFIED]`);
   `aetorresdev/ai-minions` LINT-PILOT-1 issue (references an anti-slop rule `no-reduce-accumulator-copy` and native
   `oxc/...` — appears to be evaluating the same ruleset; primary rule source remains dmmulroy/anti-slop);
   `petergyang/no-ai-slop` / `hardikpandya/stop-slop` (prose, out of scope).
8. **"Config-object ceremony"** (named in the assignment brief) — no primary source found that documents it as an
   anti-slop pattern; the closest verified rule (`zero-tolerance/no-flag-argument`) argues *for* command objects.
   Not inventoried. Similarly, "useless verbose tests" as a named pattern: covered only indirectly via zero-tolerance's
   test rules and Builder.io's mock-adequacy section; no source uses that phrase as a rule name.

---

### Totals

- Distinct upstream rulebases cited with URL + license: **8** (anti-slop, ESLint Stylistic, eslint-plugin-slop,
  zero-tolerance, sloplint, no-more-slop, aislop catalog, Clippy/ironclaw proposal; plus no-comment-slop cited with
  `[UNVERIFIED]` license where its rules are named).
- Named slop-pattern entries: **114** (themes 1–14; overlapping detections across rulebases counted separately,
  each with its own source).
- All 4 upstreams named by the local install-anti-slop skill covered: dmmulroy/anti-slop (full), ESLint Stylistic
  (vendored rule), ESLint core reference rule, `@oxlint/plugins`/`oxc/no-accumulating-spread` native companion —
  none unfindable.
