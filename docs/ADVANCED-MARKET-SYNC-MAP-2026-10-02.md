# ADVANCED MARKET SYNC MAP — Creative Ops Autopilot
Date: 2026-10-02
Status: ACTIVE PRODUCT DIRECTION
Goal: build one layer beyond what current buyers ask for, without becoming a generic AI-video tool.

## Market conclusion

Fresh buyer signals consistently ask for:
research → hypotheses → hooks/scripts → production briefs → creators/editors → launch → performance analysis → winner iteration → documented learning.

The market is also expanding sideways:
- Meta + TikTok are no longer enough; buyers increasingly mention YouTube, CTV, Amazon, TikTok Shop, Google Shopping/Discover, Reddit and marketplace creative.
- Regulated/multi-market brands need localization + claim/compliance controls.
- High-volume teams need creator operations, not only scripts.
- Marketplace operators choose hero SKUs based on margin, demoability, inventory, affiliate economics and compliance, not creative taste alone.
- Agencies need multi-brand orchestration and reporting.

## Table stakes we must support

### 1. Signal Ingestion Hub
Inputs:
- ad-account performance
- Shopify / ecommerce conversion data
- Amazon / marketplace data
- TikTok Shop data
- customer reviews / voice of customer
- competitor ads + landing pages
- organic social trends
- brand approved claims / forbidden claims
- inventory, margin, AOV and offer
Output:
normalized evidence objects with source, date, confidence and tenant.

Reason:
buyers and competitors already expect research + performance data in one workflow.

### 2. Creative Taxonomy Engine
Tag every creative by:
- audience/persona
- awareness level
- angle
- mechanism
- hook tactic
- visual format
- creator/talent
- proof type
- offer
- CTA
- channel/placement
- duration/aspect
- market/language

Reason:
performance metrics without content taxonomy do not explain why an ad won.

### 3. Signal-to-Brief Brain
Turn evidence into:
signal → diagnosis → hypothesis → brief → test variable → success metric → next action.

This is the core orchestration layer.

### 4. Winner Genealogy / Experiment Ledger
For every concept:
parent creative → children → variables changed → spend/confidence → outcome → next recommendation.

Rules:
- never call cosmetic copies "new concepts"
- distinguish hook failure from angle/body failure
- preserve winning components until evidence justifies changing them
- recommend meaningful pivots when a platform clusters near-duplicates

### 5. Funnel Sync
Do not judge the ad in isolation.
Map:
creative promise → click → landing page / advertorial / PDP → offer → checkout/call → conversion.

Detect:
- promise mismatch
- missing proof
- creative-to-page message discontinuity
- winning ad with weak destination
- strong page with weak traffic creative

### 6. Product / Offer Economics Brain
Before prioritizing creative, score:
- gross margin
- inventory depth
- AOV
- repeat/LTV if known
- refund risk
- fulfillment constraint
- demoability
- affiliate commission capacity
- compliance risk
- cross-channel demand

Output:
Hero Product Score + recommended channel + max creative cost + max CAC / lead-cost target when data exists.

### 7. Creator Ops
Future workflow:
discover creator → fit score → brief → usage-rights status → product/sample status → raw footage → QA → ad live → performance → next brief/retainer.

Store:
- creator persona
- demographics represented
- category fit
- language/market
- usage rights / expiration
- rate
- turnaround
- historical creative outcomes

### 8. Channel Adaptation Engine
Same hypothesis, channel-native execution:
- Meta Feed/Reels/Stories
- TikTok
- YouTube Shorts
- YouTube in-stream
- CTV
- Amazon SBV / PDP / A+
- TikTok Shop
- Google/Discover
- Reddit
- organic/creator

Do not resize one master asset and call it adaptation.

### 9. Marketplace Brain
Amazon/TikTok Shop modules:
- search intent
- rating/review mining
- price/value comparison
- listing image/A+ analysis
- hero SKU scoring
- affiliate/creator economics
- inventory/variation/bundle checks
- PDP ↔ ad consistency

### 10. Localization + Policy Matrix
Version by:
tenant → country → language → channel → category → claim class.

States:
ALLOWED / REVIEW / BLOCKED / EXPIRED_POLICY.

Require:
- source URL
- policy version / last checked
- approved claims
- prohibited claims
- disclaimer requirements
- human approval when uncertainty exists

No system should promise "legal everywhere". The product should prove what rule set it used and escalate uncertainty.

### 11. Profit-Aware Test Prioritizer
Rank tests by expected business value, not creative novelty.

Inputs:
- expected learning value
- production cost
- time to produce
- inventory/margin
- current fatigue
- buyer urgency
- confidence in evidence
- estimated downside

Output:
NEXT BEST TEST with explanation.

### 12. Creative Fatigue / Refresh Engine
Detect:
- spend concentration
- falling CTR/hook/hold
- rising CPA
- repeated format/persona
- creative age
- audience saturation proxy

Recommend:
refresh hook / creator / format / proof / offer / concept, based on what is actually fatigued.

### 13. Pre-Sale Spec Engine
Before sales contact:
public evidence → buyer diagnosis → 1 high-confidence opportunity → 1 production-ready brief → optional proof asset → transparent "what we still need from private data".

This remains a commercial differentiator.

### 14. Agency / White-Label Mode
Hierarchy:
AGENCY → CLIENT TENANT → MARKET → BRAND → PRODUCT → JOB → CREATOR → CAMPAIGN → LEARNING.

Needs:
- cross-client template library without leaking private client data
- per-client policy/brand/claims isolation
- capacity/queue
- client-facing reports
- white-label exports
- billing / usage quotas

### 15. Commercial Readiness + Rights Gate
Before READY:
- product fidelity passed
- claim support passed
- usage rights valid
- music/creator/license status known
- channel policy passed
- CTA/offer present
- landing destination consistent
- cost within guardrail
- source/provenance recorded

## Competitive whitespace

Current platforms already cover pieces:
- Foreplay: inspiration, competitor ad tracking, hooks, competitor tests and landing pages.
- Motion: creative analytics, benchmarks, taxonomy/analysis and performance-to-brief workflows.
- Creatify: AI generation, avatars, competitor tracker, performance agent, launch, multilingual, white-label enterprise.
- Omneky: generation, analytics, connected ad-account data, launch and next actions.

Therefore we should not compete feature-for-feature as another "all-in-one ad generator".

Our wedge:
**DECISION + ECONOMICS + POLICY + ORCHESTRATION + LEARNING across providers.**

Provider-neutral architecture:
Creative Ops decides the capability needed.
Router chooses execution source:
- local/free
- image model
- video model
- human creator/editor
- client's own production team
- external tool/API

This lets us integrate Motion/Foreplay/Creatify/Omneky-like tools as sources/providers instead of rebuilding every commodity feature.

## Priority implementation order

P0 NOW
- evidence/source model
- creative taxonomy
- hypothesis/experiment ledger
- buyer/prospect pipeline
- unit economics
- policy source/version fields
- capability registry/provider router contract

P1 FIRST PAID CLIENTS
- signal-to-brief
- funnel sync
- winner genealogy
- fatigue flags
- brand/claims knowledge base
- client report

P2 10–100 CLIENTS
- ad account connectors
- Shopify
- Amazon/TikTok Shop
- creator ops
- agency hierarchy
- usage/billing
- automated QA

P3 100–1,000+
- localization matrix
- provider failover
- queue/capacity orchestration
- white-label
- self-service onboarding
- audit-grade provenance

P4 1,000–10,000+
- multi-region infrastructure
- formal security/compliance program
- data retention controls
- SRE/observability
- enterprise SLAs

## North-star loop

EVIDENCE
→ COMMERCIAL CONTEXT
→ HYPOTHESIS
→ NEXT BEST TEST
→ PRODUCTION ROUTER
→ QA / POLICY / RIGHTS
→ LAUNCH
→ PERFORMANCE + FUNNEL OUTCOME
→ ATTRIBUTED LEARNING
→ WINNER GENEALOGY
→ NEXT BEST TEST

The machine should know not only "what ad to make", but:
**what business problem it is solving, why this test deserves to run next, what it costs, what rule set applies, and what we learned afterward.**
