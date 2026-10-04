# SYNTHESIS — DOLA ADVERSARIAL AUDIT
Date: 2026-10-04
Status: DIRECTOR REVIEWED
Purpose: distinguish useful external critique from claims that are not yet supported by our implementation or evidence.

## Director verdict
The audit is directionally useful and reinforces the service-first commercialization path.
It is NOT accepted wholesale.

## ADOPT NOW

1. Sell service-first, not SaaS-first.
2. Lead with decision quality, evidence, next-best-test and learning, not "AI ads".
3. Use a buyer-specific spec to reduce the no-case-study objection.
4. Keep native ad-platform integrations deferred until manual ingestion becomes a measured bottleneck.
5. Preserve decision lineage: evidence -> hypothesis -> test -> result -> next decision.
6. Store why a decision was made, not just the output.
7. Keep human supervision for client communication, compliance and high-risk exceptions.
8. Treat first paid clients as operational measurement events: cash, cost, time, quality, result, repeat.
9. Keep Beco13 as Case Zero only.
10. Stop building non-revenue-critical P2/P3 features unless a buyer, compliance need or measured bottleneck justifies them.

## MODIFY

### Pricing
US$1,000 is a candidate opening price, not a proven optimum.
Every quote must pass Quote Guard and be adjusted for scope, complexity, risk, production cost and expected human time.

### Guarantee
Do not default to "50% refund if not useful."
A guarantee can create adverse selection and subjective disputes.
Use only if contract language, scope, acceptance criteria and economics are explicit.

### Public URL
A public URL is not required to sell the first strategy sprint.
However, a stable public endpoint may become necessary earlier for signed webhooks, secure remote workflows or buyer trust.
Therefore: not a vanity prerequisite, but not P3 by doctrine either.

### PostgreSQL
Do not postpone durable persistence until an arbitrary client count.
Local JSON/file storage is acceptable for local validation.
It is NOT durable production persistence on ephemeral/serverless infrastructure.
Move to durable persistence when remote production use or paid-client risk requires it, not when MRR hits a round number.

### Creative production
The audit is right that production can dominate delivery cost, but "direction is 20%, production 80%" is not evidence.
Measure by job category before setting staffing/pricing assumptions.

## REJECT AS UNPROVEN

1. "2 founders can handle 10 clients with ease."
2. "60–75% margin at US$100k/month."
3. "Equivalent to 3 strategists" as a market claim today.
4. "File-backed works for dozens of clients" as a production architecture claim.
5. "MRR > US$10k" as the trigger for PostgreSQL.
6. "MRR > US$50k" as the trigger for enterprise foundations.
7. Any causal claim inferred from winner genealogy alone.
8. Any promise that AI-native automatically creates a moat.
9. Any assumption that a US$1,000 sprint will close faster without testing message/segment.
10. Any assumption that one audit/report format will fit every vertical.

## WHAT DOLA IDENTIFIED CORRECTLY THAT MATTERS MOST

The commercial product is not "generation".
The product is a defensible decision process with traceable evidence and a closed learning loop.

This aligns with the existing system:
- experiment ledger
- next-best-test
- performance ingestion
- learning brain
- winner genealogy rules
- audit ledger
- unit economics
- commercial cockpit

## TRUE CURRENT TECHNICAL STATE

Already implemented/tested locally:
- Client/product/job flow
- Evidence capture
- Experiment ledger
- Performance ingestion
- Result -> learning -> next job
- Quote/capacity/payment guards
- Paid-pilot lifecycle
- Signed Stripe webhook verification path
- Tenant isolation/auth primitives
- File-backed local asset references
- Beco13 TikTok organic Case Zero preparation
- Vercel adapter and deployment-readiness gate

Still not production-proven:
- public deployed URL
- durable production database
- durable object storage
- complete production RBAC/login
- premium video backend provider
- live ad/ecommerce connectors
- paid client performance
- profitability
- multi-client concurrency at scale

## 30-DAY BUILD POLICY

Allowed work:
1. anything required to close, onboard or deliver to an identified buyer;
2. measurement, auditability and unit economics;
3. data lineage / experiment quality;
4. security or durability required before handling paid client data;
5. blockers discovered in real delivery.

Deferred by default:
- native Meta/TikTok/Google/Amazon/Shopify connectors
- full customer portal
- autonomous publishing
- large agent swarm
- enterprise-only infrastructure
- premium provider integration without paid need
- cosmetic redesign

## NEXT HIGH-ROI GAP

The existing loop records performance and updates the next decision, but causality is still weak.

Next defensible technical improvement:
CAUSAL TEST PROTOCOL.

Each experiment should record:
- test hypothesis
- primary metric
- variable intentionally changed
- variables intentionally held constant
- baseline/control
- test window
- allocation/exposure
- confounders
- stopping rule
- sample threshold
- result confidence
- whether the conclusion is causal, directional or inconclusive

This is more defensible than simply labeling a winner and is directly aligned with the moat thesis.

## COMMERCIAL POSITIONING

Do not say:
"We replace 3–5 creative strategists."

Say:
"We increase creative-strategy capacity by structuring evidence, hypotheses, test prioritization, briefs and learning in one operating loop. We measure throughput and quality before making seat-equivalent claims."

Do not say:
"We guarantee ROAS."

Say:
"We guarantee a traceable decision process, explicit hypotheses and a prioritized test plan. Financial performance remains an observed outcome, not a promised number."

## EXECUTIVE DECISION

Commercial focus increases.
Feature expansion decreases.
Measurement rigor increases.
No false production-readiness claims.
No arbitrary infrastructure thresholds.
No causal claims without causal test design.
