# R10 mini-life — Sonnet 5 through the real agent on http://127.0.0.1:4170

Run 2026-09-14 02:23 UTC. Every verdict below is computed by code from what the kernel returned.

## 1 — first-person preference (G-05)

**teach**  
steps: `memory.remember`  
answer: Remembered: your harvest drink is a matcha latte. 🍵

> PASS — G-05 first-person → preference store: tools ['memory.remember']; preference rows matching harvest/matcha latte: 1

**ask**  
steps: `memory.lookup`  
answer: Your harvest drink is a matcha latte.

> PASS — G-05 recall: strict (1, 'hit')

## 2 — facts carry their subject; write receipts (G-18, G-01)

**teach**  
steps: `memory.recall` → `memory.rememberFacts`  
answer: Both stored about the **gantry hoist** (as read back):  1. The gantry hoist's status colour is teal. 2. The gantry hoist's assigned number is 42.  Note: these were recorded on "gantry hoist" itself — a new entity, kept separate from "gantry hoist seven", which is a different thing in my memory.

> PASS — G-18 subject in every stored statement: stored: ["the gantry hoist's assigned number is 42", "the gantry hoist's status colour is teal"]

> PASS — G-01 receipt (read back / re-read) in the tool summary: summaries: no memory of 'gantry hoist' remembered 2/2 facts about 'gantry hoist' (each re-read)

## 3 — twin family: no alias merge, exact recall, twin miss (G-17, G-02)

**teach twin two**  
steps: `memory.rememberFacts`  
answer: Both stored for **gantry hoist two**:  1. Its status colour is **ochre**. 2. Its assigned number is **7**.

**teach twin north**  
steps: `memory.rememberFact`  
answer: Remembered — stored as read back: **gantry hoist north's status colour is slate**.

> PASS — G-17 twins are three distinct entities, no twin alias: aliases base=[] two=[] north=[]

**ask base**  
steps: `memory.lookup`  
answer: Teal — the gantry hoist's status colour is teal (distinct from gantry hoist two's ochre and gantry hoist north's slate).

> PASS — G-02 exact recall of the short twin: strict (1, 'hit')

**ask north's number (never taught)**  
steps: `memory.lookup`  
answer: Not found — gantry hoist north has no assigned number on record (its only known fact is that its status colour is slate). Look-alikes "gantry hoist" (42) and "gantry hoist two" are different things and don't answer for it.

> PASS — G-02 twin miss is honest (opens with not-found; no look-alike value led): answer: not found — gantry hoist north has no assigned number on record (its only known fact is that its status colour is slate). look-alikes "gantry hoist" (42) and "gantry hoist two" are different things an

## 4 — two homes for one attribute → one clean answer (G-03)

**teach home**  
steps: `memory.rememberFact` → `memory.relate`  
answer: Remembered: the gantry hoist's home city is Lisbon — stored as a fact ("gantry hoist's home city is Lisbon") and linked as gantry hoist → located_in → Lisbon, so it'll come up either way you ask.

**update**  
steps: `memory.recall` → `memory.correct` → `memory.relate`  
answer: Memory updated: the gantry hoist's home city is now **Osaka** (was Lisbon). Both the fact and the located_in relation were corrected, with the old Lisbon value kept as history.

> PASS — G-03 one active home-city fact after the update: tools ['memory.recall', 'memory.correct', 'memory.relate']; active home-city facts: ["gantry hoist's home city is Osaka"]

**ask**  
steps: `memory.lookup`  
answer: Osaka.

> PASS — G-03 clean answer (no conflict hedge): strict (1, 'hit')

## 5 — relation handover and move → supersession with history (G-07)

**connect**  
steps: `memory.relate` → `memory.relate` → `memory.relate`  
answer: All three connections are stored:  - **Signe Halvorsen** → maintains → **gantry hoist** - **Gantry hoist** → located in → **coal wharf** (this replaced an older "located in Osaka" record, which is kept in history) - **Hoist Works** → supplies → **gantry hoist**

