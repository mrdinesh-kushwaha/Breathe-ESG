"""
Utility Electricity and Travel Ingestion Services.
"""
import csv
import io
import json
from datetime import datetime, timezone

from ingestion.models import UploadBatch, RawRecord
from emissions.models import NormalizedRecord
from .normalization import normalize_utility_record, normalize_travel_record, NormalizationError
from audit.models import log_event, AuditLog


# ---------------------------------------------------------------------------
# Utility electricity CSV ingestion
# ---------------------------------------------------------------------------

UTILITY_COLUMN_MAP = {
    "Meter ID": "meter_id",
    "meter_id": "meter_id",
    "MeterID": "meter_id",
    "Meter": "meter_id",
    "Period Start": "billing_start",
    "billing_start": "billing_start",
    "From": "billing_start",
    "Period End": "billing_end",
    "billing_end": "billing_end",
    "To": "billing_end",
    "Consumption (kWh)": "consumption_kwh",
    "Consumption": "consumption_kwh",
    "consumption_kwh": "consumption_kwh",
    "kWh": "consumption_kwh",
    "Units": "consumption_kwh",
    "Unit": "unit",
    "Tariff Type": "tariff_type",
    "tariff_type": "tariff_type",
    "Tariff": "tariff_type",
    "Site": "site_name",
    "Location": "site_name",
}


def _map_utility_row(row: dict) -> dict:
    return {UTILITY_COLUMN_MAP.get(k, k): v for k, v in row.items()}


def ingest_utility_csv(csv_file, batch: UploadBatch, actor) -> dict:
    if hasattr(csv_file, "read"):
        raw = csv_file.read()
        text = raw.decode("utf-8-sig") if isinstance(raw, bytes) else raw
    else:
        text = csv_file

    reader = csv.DictReader(io.StringIO(text))
    raw_records = []
    normalized_records = []
    flagged = 0
    errors = []

    for idx, row in enumerate(reader, start=1):
        canonical_row = _map_utility_row(dict(row))
        rr = RawRecord(batch=batch, row_index=idx, raw_data=dict(row))
        raw_records.append(rr)

        try:
            result = normalize_utility_record(canonical_row)
        except NormalizationError as e:
            rr.parse_error = str(e)
            errors.append(f"Row {idx}: {e}")
            continue

        nr = NormalizedRecord(
            tenant=batch.tenant,
            batch=batch,
            raw_record=rr,
            source_type="utility_portal",
            source_row_id=result.source_row_id,
            activity_type=result.activity_type,
            scope_category=result.scope_category,
            original_unit=result.original_unit,
            original_value=result.original_value,
            normalized_unit=result.normalized_unit,
            normalized_value=result.normalized_value,
            emission_factor=result.emission_factor,
            estimated_emissions=result.estimated_emissions,
            suspicious_flag=result.suspicious_flag,
            suspicious_reason=result.suspicious_reason,
            review_status="pending",
            period_start=result.period_start,
            period_end=result.period_end,
        )
        if result.suspicious_flag:
            flagged += 1
        normalized_records.append((rr, nr))

    RawRecord.objects.bulk_create(raw_records)
    for rr_obj, nr_obj in normalized_records:
        nr_obj.raw_record = rr_obj
    NormalizedRecord.objects.bulk_create([nr for _, nr in normalized_records])

    batch.total_rows = len(raw_records)
    batch.processed_rows = len(normalized_records)
    batch.flagged_rows = flagged
    batch.status = UploadBatch.STATUS_COMPLETE
    batch.completed_at = datetime.now(tz=timezone.utc)
    if errors:
        batch.error_log += "\n".join(errors)
    batch.save()

    log_event(
        actor=actor,
        action=AuditLog.ACTION_INGEST,
        obj=batch,
        note=(
            f"Utility CSV ingestion complete. "
            f"{batch.processed_rows}/{batch.total_rows} rows, {flagged} flagged."
        ),
    )

    return {
        "total_rows": batch.total_rows,
        "processed_rows": batch.processed_rows,
        "flagged_rows": flagged,
        "error_count": len(errors),
        "errors": errors[:10],
    }


# ---------------------------------------------------------------------------
# Travel JSON ingestion (Concur/Navan API-style)
# ---------------------------------------------------------------------------

def ingest_travel_json(json_data, batch: UploadBatch, actor) -> dict:
    """
    Parse Concur/Navan-style travel export JSON.

    Expected shape:
    {
      "export_date": "2024-01-15",
      "company_id": "ACME-001",
      "bookings": [
        {
          "booking_reference": "TRV-001",
          "travel_mode": "air",
          "origin": "LHR",
          "destination": "JFK",
          "travel_class": "economy",
          "distance_km": 5541,
          "trip_date": "2024-01-10",
          ...
        }
      ]
    }
    """
    if isinstance(json_data, (str, bytes)):
        try:
            payload = json.loads(json_data)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON payload: {e}")
    else:
        payload = json_data

    # Accept either top-level list or {"bookings": [...]}
    if isinstance(payload, list):
        bookings = payload
    elif isinstance(payload, dict):
        bookings = payload.get("bookings", payload.get("trips", payload.get("records", [])))
    else:
        raise ValueError("Travel JSON must be a list or object with a 'bookings' key")

    raw_records = []
    normalized_records = []
    flagged = 0
    errors = []

    for idx, booking in enumerate(bookings, start=1):
        rr = RawRecord(batch=batch, row_index=idx, raw_data=booking)
        raw_records.append(rr)

        try:
            result = normalize_travel_record(booking)
        except NormalizationError as e:
            rr.parse_error = str(e)
            errors.append(f"Record {idx}: {e}")
            continue

        nr = NormalizedRecord(
            tenant=batch.tenant,
            batch=batch,
            raw_record=rr,
            source_type="travel_api",
            source_row_id=result.source_row_id,
            activity_type=result.activity_type,
            scope_category=result.scope_category,
            original_unit=result.original_unit,
            original_value=result.original_value,
            normalized_unit=result.normalized_unit,
            normalized_value=result.normalized_value,
            emission_factor=result.emission_factor,
            estimated_emissions=result.estimated_emissions,
            suspicious_flag=result.suspicious_flag,
            suspicious_reason=result.suspicious_reason,
            review_status="pending",
            period_start=result.period_start,
        )
        if result.suspicious_flag:
            flagged += 1
        normalized_records.append((rr, nr))

    RawRecord.objects.bulk_create(raw_records)
    for rr_obj, nr_obj in normalized_records:
        nr_obj.raw_record = rr_obj
    NormalizedRecord.objects.bulk_create([nr for _, nr in normalized_records])

    batch.total_rows = len(raw_records)
    batch.processed_rows = len(normalized_records)
    batch.flagged_rows = flagged
    batch.status = UploadBatch.STATUS_COMPLETE
    batch.completed_at = datetime.now(tz=timezone.utc)
    if errors:
        batch.error_log += "\n".join(errors)
    batch.save()

    log_event(
        actor=actor,
        action=AuditLog.ACTION_INGEST,
        obj=batch,
        note=(
            f"Travel JSON ingestion complete. "
            f"{batch.processed_rows}/{batch.total_rows} bookings, {flagged} flagged."
        ),
    )

    return {
        "total_rows": batch.total_rows,
        "processed_rows": batch.processed_rows,
        "flagged_rows": flagged,
        "error_count": len(errors),
        "errors": errors[:10],
    }
