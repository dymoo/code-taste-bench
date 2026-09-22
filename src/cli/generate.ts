// Generation entrypoint — disabled by user-mandated spend policy (2026-09-22).
// Contestant models are never called: artifacts are sourced, not generated,
// and JEV (`typesafe/jev-1.13`) is the only paid API the suite may call.
//
// The former harness (OpenRouter chat-completions shot, prompt builder, output
// parser) was removed with the policy — no network path remains, and there is
// no bypass flag. See SPEC.md §3.

if (import.meta.main) {
  console.error(
    [
      "generate: disabled by spend policy — contestant models are never called.",
      "Artifacts must be sourced, not generated; only JEV judging is allowed to call a paid API.",
      "There is no bypass flag. See SPEC.md §3.",
    ].join("\n"),
  );
  process.exit(1);
}
