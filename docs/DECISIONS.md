# Architecture Decisions

## Why Django + DRF, not FastAPI?

Django was chosen because:
1. The data model is complex (multi-tenant, audit, content types) and Django ORM handles relational complexity well.
2. Django admin provides a free management interface for ops/support without extra code.
3. DRF's serializers, generics, and filter backends are well-suited to the CRUD-heavy review API.

FastAPI would be a reasonable choice if the ingestion service were CPU-heavy and needed async processing, but synchronous ingestion of CSV files does not require it.

## Why synchronous ingestion?

Asynchronous ingestion (Celery + Redis) adds operational complexity: a broker, workers, task monitoring, retry logic. For a prototype, synchronous ingestion is simpler, debuggable, and still handles files with thousands of rows in under a second.

The code is structured so the ingestion functions (`ingest_sap_csv`, etc.) are pure Python — they can be called from a Celery task with no changes.

## Why CSV for SAP and utility, JSON for travel?

SAP exports via transaction `ME2M` / `MB51` are delivered as CSV or Excel. German headers and mixed formats are a real-world constraint. Supporting CSV with configurable column mapping is the practical approach.

Utility portals (UK National Grid, etc.) also export CSV, typically with meter ID, billing period, and kWh columns. The format is more consistent than SAP.

Travel management systems (Concur, Navan) expose REST APIs returning JSON. Modelling this as a JSON upload (rather than a live API call) is appropriate for a prototype — in production the platform would call the Concur API on a schedule and ingest the response directly.

## Why RawRecord is separate from NormalizedRecord?

Keeping raw data immutable and separate from the derived normalized record is the most important design decision in the system.

Reasons:
1. **Bug recovery**: If a normalization bug is found (wrong emission factor, wrong unit conversion), raw records can be reprocessed without re-uploading files.
2. **Auditability**: Regulators and auditors want to see source data. The raw record is exactly what came in.
3. **Traceability**: `NormalizedRecord.raw_record` is a OneToOne — you can always find the original source row for any approved emissions figure.

## Why model-layer immutability?

Immutability is enforced in `NormalizedRecord.save()` by checking if the existing record is already approved and raising `ValueError`. This means the constraint lives in Python, not the database.

In production, a database trigger or a CHECK constraint would be stronger. For a prototype, model-layer enforcement is visible and testable.

## Why UUID primary keys?

UUIDs prevent ID enumeration attacks (guessing sequential integer IDs). They also make it possible to generate IDs client-side before inserting, which simplifies some bulk workflows. The slight performance cost on index lookups is acceptable.

## Why row-level tenancy (not schema-per-tenant)?

Schema-per-tenant requires middleware to switch the database search path on every request, more complex migrations, and more operational overhead. For a prototype with one demo tenant, row-level tenancy is correct and simple.

## Why no Celery in this version?

Adding Celery requires a broker (Redis or RabbitMQ), worker processes, a beat scheduler if periodic tasks are needed, and monitoring (Flower). This doubles the deployment surface. Synchronous ingestion is the right default until file sizes or concurrency demands require async.

## What PM questions remain open?

1. **Emission factor versioning**: Should factors be locked per reporting period? If DEFRA updates factors mid-year, do previously approved records get recalculated? This needs a product decision.
2. **Market-based vs location-based Scope 2**: The platform currently uses location-based grid factors. Tenants with renewable energy certificates (RECs) may want market-based accounting. Requires a tariff-type field on the emission factor config.
3. **Approval workflow**: Is one approver sufficient, or do we need a two-person sign-off for large emissions values? The `ReviewDecision` model supports it but the UI does not enforce it.
4. **Re-ingestion policy**: What happens if a batch is re-uploaded? Currently each upload creates a new batch. Duplicate detection (by `source_row_id`) is not implemented.
5. **Data retention**: How long should raw records be kept? GDPR and GHG Protocol have different answers.
