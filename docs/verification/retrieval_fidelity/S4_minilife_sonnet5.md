# D-0080 S4 — flip mini-life on Sonnet 5 (2026-09-01)

Spec §5.3 integration check. Kernel: fidelity kernel `:4170` on `jarvis_fidelity` (day-500
snapshot copy), all roles Sonnet 5, real local embedder. Every teach / flip / quiz went
through `POST /agent/run` (`autoApprove: allow-for-session`, `maxSteps 8`) — the same path
Longitude-XL used, so the agent chooses the tools and the routes exactly as it did in the
500-day run. Scripts: `s4_minilife.py` (round A), `s4_minilife_b.py` (B), `s4_minilife_c.py` (C).

## Round A — 20 facts, 10 flips on entity-fact attributes · PASS 20/20
10 fresh entities × {assigned number, service day}. The agent routed as XL did:
`memory.rememberFact` ×11, `memory.remember` (preference) ×9 — every "assigned number"
became an entity fact, 9 of 10 "service day" values became preferences
(e.g. `kestrel_hangar_service_day = Friday`; two keys with spaces, `dune array four service day`).

Flips (10, all on assigned numbers — an alternation slip in the script put none on the
preference-routed values): `memory.recall` → `memory.correct` on every one, 10/10 superseded
with history. Quiz in fresh runs: **20/20** current values (10/10 flipped, 10/10 unflipped),
217 s. This exercised the fact route only.

## Round B — 10 flips on the PREFERENCE-routed service days · **defect found**
The Longitude-XL Defect B shape. Every flip ran `memory.recall` → (`memory.recallPreferences`)
→ `memory.correct`, and every one went wrong the same way:

| entity | preference after | entity facts after |
|---|---|---|
| kestrel hangar | `Friday` (stale) | assigned-number fact **superseded**; new fact "kestrel hangar's service day is Saturday" |
| harbor kiln two, orin tal, cobalt press, nadia iqbal, lantern relay, saffron ledger | stale | same pattern |
| marisol vega, dune array four, west quarry | (were facts / space-keyed prefs) | second home created |

Corrections landed in the preference **0/10**; no second home **0/10**. The quiz still scored
10/10 only because the agent read both stores and *reported the conflict* ("entity memory says
Saturday, but stored preference says Friday") — which is precisely the two-homes failure the
spec describes, now with a lost assigned-number fact on top.

**Root cause (in the tool, not the model):** with the entity's only fact about a different
attribute, `memory.correct` had two ways to pick it — the model passing that fact's `factId`
(the description says "PREFERRED"), or passing neither `factId` nor `replaces`, where the
pre-D-0080 default superseded the *most recent* fact. The unit tests had passed because they
always supplied `replaces`. The audit does not carry arguments, so round C captures them.

**Fix (same slice, "fix anything found, repeat"):**
1. `factId` guard — an id whose statement shares no content word with the new statement
   (entity name excluded) is **refused** with guidance, nothing written; `replaces` quoting the
   old text is the explicit override.
2. No target named → the **new statement's own attribute words** select the fact
   (`sharedContent`, entity name excluded); nothing shared → no fact target, so the preference
   route runs. "Most recent fact" default removed.
3. Preference hint falls back to the new statement when `replaces` is absent.
4. `contentWords` drops 1-character tokens (the possessive `'s` was a shared "word").
+3 tests (`retrieval_fidelity.test.ts`): unrelated single fact not superseded → preference route;
wrong factId refused / `replaces` override; reworded update without `replaces` still supersedes.

## Round C — 10 fresh entities on the guarded build, tool ARGUMENTS captured · **second defect found**
Teach: 10/10 assigned numbers → `memory.rememberFact`, 10/10 service days → `memory.remember`
(keys such as `pine_shed_service_day`, `liesel brandt service day`, `service_day_east_paddock`).
The first two flips, with the exact `memory.correct` arguments the agent sent:

| entity | arguments | outcome |
|---|---|---|
| pine shed | `{"replaces": "pine_shed_service_day", "newStatement": "pine shed's service day is Thursday", "value": "Thursday"}` | **wrong** — fact route, assigned-number fact superseded, preference still `Friday` |
| ravi kapoor | `{"replaces": "service day", "newStatement": "Ravi Kapoor's service day is Saturday", "value": "Saturday"}` | **right** — `corrected preference 'ravi_kapoor_service_day': 'Monday' → 'Saturday'` |

So the model does name the attribute — sometimes as the preference KEY. The `replaces`
content-word fallback counted the entity's own name words (`pine`, `shed`) as overlap with
"pine shed's assigned number is 24" and picked that fact. The round was stopped after the
evidence was in (remaining flips would only have lost more facts).

**Fix 3:** the `replaces` fallback uses `sharedContent` too — the entity's name never counts,
only attribute words say "same thing". +1 test with the exact arguments above (preference
route, fact intact; an attribute-naming `replaces` still targets the right fact).

## Round D — 10 fresh entities, fixed matcher
_filled in below_
