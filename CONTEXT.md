# Code Taste Bench

Benchmark suite that ranks code-generating models on **taste** — how good their code looks, reads, and is tested — beyond functional correctness.

## Language

**Taste**:
The judged quality of an item's code, communication, and test writing — beyond whether it works.
_Avoid_: aesthetics, style, quality

**Item**:
One unit of the test set: a model-attributed artifact with its task context and provenance.
_Avoid_: test question, sample, prompt

**Suite**:
The open-source benchmark code: harness, rubric definitions, JEV questions, scoring, and the public site.
_Avoid_: framework

**Rubric**:
The ordered taste dimensions and score levels the judge applies to each item.
_Avoid_: criteria, checklist

**Slop pattern**:
A documented, nameable anti-pattern of AI-generated code from anti-slop rulebases, used as rubric grounding and diagnostics.
_Avoid_: smell, lint violation

## Judging

**JEV question**:
One typed judgment (noul/choice/score) sent to the judge about a state. Always spelled "JEV question", never bare "question" — that word is reserved here to keep clear of the items.
_Avoid_: question, query

**Duel**:
A pairwise taste comparison of two items on the same task, scored as a JEV choice question over both candidates.
_Avoid_: battle, match, A/B test

**Calibration sample**:
The held-out item sample humans rate to measure judge-vs-human agreement.
_Avoid_: gold set, ground truth

## Test set

**Demo item**:
A public item released with the methodology so anyone can spot-check the judging.
_Avoid_: dev set, open set

**Sealed item**:
An item kept private while active, documented only in aggregate.
_Avoid_: hidden set, test question

**Harness provenance**:
The tooling stack that produced an artifact, recorded as metadata on every item; the model stays the ranked entity.
_Avoid_: environment, setup
