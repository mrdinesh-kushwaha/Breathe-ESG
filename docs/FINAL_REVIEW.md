# Final Review

## Why This Architecture Is Defensible in an Interview

### The data model tells a clear story

Every design decision traces back to a real requirement:
- `RawRecord` exists because re-processability and auditability are not the same thing as normalization
- `NormalizedRecord.save()` raises on mutation of approved records because immutability is a business requirement, not a nice-to-have
- `AuditLog` uses Django's ContentType framework because it genuinely needs to cover multiple models without a bespoke audit table per model
- `DataSource.column_mapping` is a JSON field because SAP column names vary by client without requiring code changes

None of these are over-engineering. Each can be explained in one sentence.

### The normalization layer is testable in isolation

`ingestion/normalization.py` has zero Django imports. It is pure Python: inputs are dicts, outputs are dataclasses. This means:
- It can be unit tested with `pytest` and no test database
- Emission factor changes can be validated with a table of known inputs and outputs
- The same functions could power a CLI tool, a Jupyter notebook, or a different web framework

This is the most important engineering decision in the codebase.

### The ingestion services are boring

`ingest_sap_csv()`, `ingest_utility_csv()`, and `ingest_travel_json()` do not try to be clever. They:
1. Parse the input
2. Map columns
3. Call the normalization function
4. Bulk-insert raw records
5. Bulk-insert normalized records
6. Update the batch status
7. Write an audit log entry

The control flow is linear and easy to follow. There are no unexpected side effects.

### Multi-tenancy is consistently enforced

Every list view inherits `TenantQuerysetMixin`. Every upload endpoint checks `DataSource.tenant == request.user.tenant`. The `NormalizedRecord` carries its own `tenant` FK for direct filtering. There is no code path that returns cross-tenant data — this was verified by reading every view.

---

## Intentional Tradeoffs

| Decision | What was traded away | Why it was right |
|---|---|---|
| Synchronous ingestion | Scalability beyond ~50 MB | Eliminates broker, workers, and retry logic from the prototype |
| Hardcoded emission factors | Tenant factor customization | Factor versioning is a feature, not architecture |
| Row-level tenancy | Strongest data isolation | Schema-per-tenant adds migration complexity for one demo tenant |
| No Celery | Background processing | The ingestion interface is already decoupled; adding Celery is mechanical |
| No test suite | Confidence in refactoring | Pure normalization layer makes the critical path testable when needed |

---

## How This Avoids "AI Slop"

**No TODOs or placeholder functions**: Every function in the codebase does something real. The normalization logic handles German headers, mixed date formats, German decimal commas, and unit conversion with actual lookup tables.

**Decisions are explained**: The codebase has inline comments where the *why* is not obvious (e.g. the `QuerySet.update()` bypass in the review view, the German decimal handling in SAP parsing). Generic code gets no comments because it doesn't need them.

**Realistic sample data**: The SAP sample CSV includes a negative quantity (returns), a `ST` unit (Stück — a real SAP miscoding for fuel), an implausibly large diesel volume, and a hydraulic oil material that cannot be classified. The travel JSON includes a 45-night hotel stay, an unknown IATA code, and a null distance field. These are the actual edge cases that cause real ingestion pipelines to break.

**The suspicious flag actually does something**: Flagged rows appear in the review queue with their reason. The reason strings are specific ("Unusually high consumption: 98760 l", "Unknown origin IATA code: 'XYZ'") not generic. Analysts can make an informed decision.

**The audit log is not decorative**: Every review action writes to `AuditLog` with `field_name`, `old_value`, and `new_value`. The record detail page renders a timeline with field-level diffs in monospace. This is the kind of feature that separates a portfolio project from production software.
