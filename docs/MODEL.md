# Data Model

## Entities and Relationships

### Tenant
The top-level isolation boundary. Every record in the system carries a `tenant` foreign key. Queries always filter by `request.user.tenant`, enforced at the view layer via `TenantQuerysetMixin`.

```
Tenant
  ├── users (User[])
  ├── data_sources (DataSource[])
  └── upload_batches (UploadBatch[])
```

### User
Extends Django's `AbstractBaseUser`. Role field (`analyst`, `reviewer`, `admin`) is present but not yet enforced at the permission layer in this prototype — all authenticated users can review. In production, DRF permission classes would gate reviewer actions.

### DataSource
A named configuration for a repeatable data feed — e.g. "SAP ECC Production — DE Plants". The `column_mapping` JSON field allows tenants to configure SAP header aliases without code changes. One DataSource can have many UploadBatches.

### UploadBatch
Represents a single upload event. Tracks lifecycle (pending → processing → complete/failed), row counts, and the error log. Exists so analysts can see a history of what was ingested and when.

### RawRecord
An immutable copy of exactly one source row. Never modified after creation. The `raw_data` JSON field holds the exact key-value pairs from the parsed CSV or JSON. `parse_error` notes non-fatal issues (e.g. unmapped columns).

This table is the source of truth — if a normalization logic bug is found, we can re-process raw records without re-uploading the original file.

### NormalizedRecord
The canonical emissions record derived from a RawRecord (OneToOne). This is what analysts review.

Key design decisions:

**Immutability after approval**: The `save()` method raises `ValueError` if you attempt to update an already-approved record. Views use `QuerySet.update()` to bypass this during the status transition itself (the record is pending at that point), then immutability kicks in on any subsequent save attempt.

**Source-of-truth tracking**: `source_type`, `source_row_id`, and `raw_record` together let you trace any approved emissions figure back to its origin document/row.

**Unit normalization**: `original_unit` and `original_value` preserve what came in. `normalized_unit` and `normalized_value` are the canonical representation used for emissions calculations. This lets auditors see the conversion.

### ReviewDecision
Append-only log of every analyst action (approve/reject/flag) on a NormalizedRecord. Multiple decisions can exist per record (e.g. reject → resubmit → approve), providing a full decisioning history separate from the main AuditLog.

### AuditLog
A generic, append-only event log using Django's ContentType framework. One table covers changes to any model. Tracks actor, action, object, field changed, old value, new value, and timestamp.

---

## Audit Design

The audit system is intentionally simple: field-level diffs stored as text. This is appropriate for a prototype and for human-readable audit trails. It is not full event sourcing.

Every mutating operation calls `log_event()` from `audit.models`. This is a plain function call — not a signal — so it is explicit and easy to follow in code review.

The `AuditLog` table is append-only by convention. No code path calls `.delete()` on it. In production, database-level insert-only roles would enforce this.

---

## Normalization Strategy

Normalization happens in `ingestion/normalization.py` via three entry-point functions:
- `normalize_sap_record(row)` — Scope 1, fuel combustion
- `normalize_utility_record(row)` — Scope 2, electricity
- `normalize_travel_record(row)` — Scope 3, business travel

Each function:
1. Resolves unit labels (including German SAP variants) to lowercase English
2. Converts to canonical unit (litres, kWh, km, room-nights)
3. Looks up an emission factor (DEFRA 2023 approximation)
4. Calculates `estimated_emissions = normalized_value × emission_factor`
5. Runs suspicion checks and sets `suspicious_flag` + `suspicious_reason`

All normalization is stateless and returns a `NormalizationResult` dataclass, making it trivially testable without a database.

---

## Multi-Tenancy

Row-level tenancy: every significant table has a `tenant` FK. The `TenantQuerysetMixin` on list/detail views filters all queries to `request.user.tenant`. Upload views check `DataSource.tenant == request.user.tenant` before accepting uploads.

This approach is simple and correct for a prototype. At enterprise scale with hundreds of tenants, schema-per-tenant (using `django-tenants`) would provide stronger data isolation and simpler backup/restore per customer.
