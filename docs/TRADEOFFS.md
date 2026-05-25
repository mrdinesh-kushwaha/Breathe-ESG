# Deliberate Tradeoffs and Omissions

## 1. No task queue (Celery/Redis)

**Omitted**: Asynchronous ingestion via Celery workers and a Redis broker.

**Why**: Adds two new infrastructure components (broker + worker) and significant operational complexity for a prototype. Synchronous ingestion handles files up to ~50 MB and thousands of rows without issue.

**What breaks at scale**: If a tenant uploads a 500 MB SAP export with 500,000 rows, the HTTP request will time out (~30s). The fix is straightforward — wrap the ingestion call in a Celery task, return a `202 Accepted` with the batch ID immediately, and poll for completion. The ingestion functions are already decoupled from the view layer for this reason.

## 2. No role-based permission enforcement

**Omitted**: Enforcing `analyst` vs `reviewer` role distinctions in API permissions.

**Why**: Both roles exist in the data model and UI, but DRF permission classes do not currently gate reviewer-only actions (approve/reject). This is prototype scaffolding — adding `IsReviewer` permission classes is a one-hour task.

**Impact**: Any authenticated user can approve records. Acceptable for a demo; unacceptable for production.

## 3. No duplicate detection on re-upload

**Omitted**: Detecting that a batch file has been uploaded before, or that individual rows have already been ingested.

**Why**: Duplicate detection requires a stable, unique identifier per source row. SAP document numbers (`Belegnummer`) could serve this purpose, but utility meters have billing periods as identifiers and travel bookings have booking references. Implementing cross-source dedup consistently adds complexity without changing the core architecture.

**Impact**: Re-uploading the same file creates duplicate `NormalizedRecord` rows. A `source_row_id` uniqueness constraint per tenant and source type would prevent this.

## 4. No live Concur/Navan API integration

**Omitted**: Calling the actual Concur or Navan REST API on a schedule.

**Why**: Requires OAuth credentials, a polling schedule (Celery beat), and API-specific response parsing. For a prototype demonstrating the ingestion architecture, accepting a JSON file upload is equivalent in terms of the data flow.

**What the real version looks like**: A `DataSource` configuration would store OAuth client credentials. A scheduled Celery task would call `GET /api/v4/receipts/` (Concur) or `GET /v2/bookings` (Navan), page through results, and call `ingest_travel_json()` with the response payload.

## 5. Emission factors are hardcoded approximations

**Omitted**: A versioned, tenant-configurable emission factor database.

**Why**: The GHG Protocol requires factors to be locked to the reporting year. Building a full factor management system (with CRUD, versioning, and audit trail) is a significant feature in itself.

**Impact**: All calculations use DEFRA 2023 UK grid average factors. Non-UK tenants, renewable tariffs, and custom industry factors are not handled. The `emission_factor` field on `NormalizedRecord` stores the factor used at calculation time, so the calculation is traceable even if factors change.

## 6. No test suite

**Omitted**: Unit and integration tests.

**Why**: Time constraint for a prototype. The normalization layer (`ingestion/normalization.py`) is deliberately pure Python with no Django dependencies, making it trivially testable. A test suite would cover: unit conversion, suspicion rules, column mapping, API authentication, and tenant isolation.
