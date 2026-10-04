# RECOVERY-001 — Exception Investigation Pack

Status: EXPERIMENTAL / SYNTHETIC ONLY
Date: 2026-10-04

## Hypothesis

A buyer may pay for a bounded investigation pack covering small AP/vendor-credit exceptions that are too time-consuming for internal staff to investigate one by one.

Initial wedge:
RMA approved -> credit expected -> credit memo -> application -> exception.

## What this experiment proves

The current benchmark only proves that the workflow can classify a small, explicitly structured synthetic case set consistently.

It does NOT prove:
- messy PDF/email extraction,
- operator time below the economic threshold,
- actual recovery rate,
- customer willingness to pay,
- legal entitlement,
- supplier cooperation,
- production security for financial documents.

## Benchmark Zero

10 synthetic cases intentionally include:
- missing credit memo,
- partial credit,
- issued but unapplied credit,
- partially applied credit,
- fully resolved false positive,
- missing approval / inconclusive,
- inconsistent values.

The scorer must return:
- classification,
- approved amount,
- memo amount,
- applied amount,
- potential amount,
- confidence,
- evidence found,
- evidence missing,
- next action.

## Economic gate

Candidate test price: US$300 for up to 10 investigations.

This is NOT validated pricing.

At US$30/case, operator time must be comfortably below break-even after accounting for:
- review,
- data cleanup,
- communication,
- payment fees,
- QA,
- rework,
- acquisition time.

Therefore the internal target is stricter than 57 minutes/case:
- GREEN: <= 30 active operator minutes/case
- YELLOW: 31–45 minutes/case
- RED: > 45 minutes/case

The target is an operating hypothesis, not a market fact.

## Data safety gate

DO NOT ingest real client financial documents into the current file-backed preview storage.

Before any real-data pilot:
1. define minimum data fields;
2. remove bank credentials and unnecessary personal data;
3. use a secure transfer path;
4. define retention/deletion;
5. restrict tenant/operator access;
6. ensure durable encrypted storage appropriate for paid-client documents;
7. log access and deletion.

No supplier contact, ERP write, payment action, or bank access without explicit written client authorization.

## Commercial gate

Tomorrow's objective is not to sell "recovery automation".

Offer:
Exception Investigation Pack

Scope:
Up to 10 bounded exceptions.

Deliverable per case:
- classification,
- evidence present,
- evidence missing,
- potential amount if defensible,
- confidence,
- next action,
- draft evidence checklist.

No recovery promise.
No guaranteed savings.
No supplier contact in the initial pack.

## Kill criteria

PERSIST if:
- a buyer pays for the bounded pack;
- data can be processed safely;
- active operator time trends <= 30 min/case;
- buyer says at least one result is actionable.

ADJUST if:
- buyer interest exists but scope/data requirements create friction;
- active time is 31–45 min/case.

PIVOT if:
- active time remains >45 min/case but higher-value cases support success-fee economics.

KILL this wedge if:
- no paid pilot after a meaningful outbound test;
- buyers refuse to share even a minimal redacted dataset;
- exception evidence is too fragmented to investigate reliably;
- economics remain negative after a bounded process test.

## Truth labels

Every output must carry one:
- PROVEN_BY_DOCUMENT
- DIRECTIONAL
- INCONCLUSIVE
- SYNTHETIC_BENCHMARK_ONLY

Never call a synthetic benchmark a recovered dollar.
