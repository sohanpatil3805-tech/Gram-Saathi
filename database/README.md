# Gram Saathi — Scheme Knowledge Base (Starter)

Scope: Karnataka + Central Government schemes; initial beneficiary groups: farmers and students.

## Files
- `schemes.json`: structured starter records and source registry.
- `schema.json`: initial JSON Schema envelope.

## Important safety rule
This is a research starter dataset, not a final eligibility authority. Only records marked fully verified after review of current official scheme rules may drive deterministic eligibility decisions. `partially_verified`, `directory_verified_scheme_details_pending`, and `discovery_only_needs_guideline_review` records may be used for discovery and guided follow-up questions only.

## How to add a scheme
1. Find the current official scheme guideline / government notification.
2. Record its exact URL, publisher, title and date.
3. Extract eligibility, exclusions, benefit, documents, process and deadlines.
4. Add each eligibility condition as a separate rule with a source ID.
5. Mark unknown or state/season-dependent facts as unknown; never guess.
6. Have a second person review the extracted rules.
7. Update `last_checked` and verification status.
8. Add tests for both eligible and ineligible boundary cases.

## Never collect sensitive identifiers in this public dataset
Do not store real Aadhaar numbers, bank account numbers, phone numbers, application IDs or actual citizen documents here.
