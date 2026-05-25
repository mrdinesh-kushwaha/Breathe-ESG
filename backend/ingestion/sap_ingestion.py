"""
SAP Export Ingestion Service

Handles realistic SAP CSV exports which commonly include:
  - German column headers (Menge, Einheit, Buchungsdatum, Werk, Materialbeschreibung)
  - Mixed date formats (DD.MM.YYYY, YYYYMMDD)
  - German decimal commas (1.234,56)
  - Plant codes (e.g. DE01, UK03)
  - Material codes alongside descriptions

Column mapping: the DataSource.column_mapping JSON field allows tenants to
configure header aliases, so "Menge" -> "quantity" without code changes.
"""
import csv
import io
from datetime import datetime, timezone

from ingestion.models import DataSource, UploadBatch, RawRecord
from emissions.models import NormalizedRecord
from .normalization import normalize_sap_record, NormalizationError
from audit.models import log_event, AuditLog


# Default column mapping for SAP exports.
# Keys are possible SAP header variants; values are canonical field names.
DEFAULT_SAP_COLUMN_MAP = {
    # Quantity / volume
    "Menge": "quantity",
    "Menge (ME)": "quantity",
    "Quantity": "quantity",
    "quantity": "quantity",

    # Unit of measure
    "ME": "unit",
    "Einheit": "unit",
    "UoM": "unit",
    "Unit": "unit",
    "unit": "unit",

    # Material
    "Materialbeschreibung": "material_description",
    "Material Description": "material_description",
    "Bezeichnung": "material_description",
    "material_description": "material_description",

    # Plant
    "Werk": "plant_code",
    "Plant": "plant_code",
    "Anlage": "plant_code",
    "plant_code": "plant_code",

    # Posting date
    "Buchungsdatum": "posting_date",
    "Posting Date": "posting_date",
    "Belegdatum": "posting_date",
    "posting_date": "posting_date",
    "Date": "posting_date",

    # Document reference
    "Belegnummer": "document_number",
    "Document Number": "document_number",
    "Beleg": "document_number",
    "document_number": "document_number",
    "Doc No": "document_number",
}


def _map_headers(raw_headers: list[str], custom_map: dict) -> dict:
    """
    Returns {raw_header: canonical_field} for headers we recognise.
    custom_map from DataSource.column_mapping takes precedence.
    """
    combined = {**DEFAULT_SAP_COLUMN_MAP, **custom_map}
    mapping = {}
    for h in raw_headers:
        canonical = combined.get(h) or combined.get(h.strip())
        if canonical:
            mapping[h] = canonical
    return mapping


def _remap_row(row: dict, mapping: dict) -> dict:
    """Apply column mapping to a CSV row dict."""
    result = {}
    for raw_key, value in row.items():
        canonical = mapping.get(raw_key, raw_key)
        result[canonical] = value
    return result


def ingest_sap_csv(
    csv_file,
    batch: UploadBatch,
    actor,
) -> dict:
    """
    Parse and normalize a SAP export CSV file.

    Returns summary dict with counts.
    csv_file: file-like object (binary or text).
    """
    # Decode bytes if needed
    if hasattr(csv_file, "read"):
        raw = csv_file.read()
        if isinstance(raw, bytes):
            # Try UTF-8 first, fall back to latin-1 (common in German SAP exports)
            try:
                text = raw.decode("utf-8-sig")  # strip BOM
            except UnicodeDecodeError:
                text = raw.decode("latin-1")
    else:
        text = csv_file

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise ValueError("CSV file appears empty or has no headers")

    custom_map = batch.data_source.column_mapping or {}
    header_mapping = _map_headers(list(reader.fieldnames), custom_map)

    unmapped = [h for h in reader.fieldnames if h not in header_mapping]
    if unmapped:
        # Non-fatal: log and continue
        batch.error_log += f"Unmapped columns (ignored): {unmapped}\n"

    raw_records = []
    normalized_records = []
    flagged = 0
    errors = []

    for idx, row in enumerate(reader, start=1):
        canonical_row = _remap_row(dict(row), header_mapping)

        # Store raw record unconditionally
        rr = RawRecord(
            batch=batch,
            row_index=idx,
            raw_data=dict(row),
        )
        raw_records.append(rr)

        # Attempt normalization
        try:
            result = normalize_sap_record(canonical_row)
        except NormalizationError as e:
            rr.parse_error = str(e)
            errors.append(f"Row {idx}: {e}")
            continue

        nr = NormalizedRecord(
            tenant=batch.tenant,
            batch=batch,
            raw_record=rr,
            source_type="sap_export",
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

    # Bulk-save raw records first (need PKs for FKs)
    RawRecord.objects.bulk_create(raw_records)

    # Assign raw_record FK and bulk-save normalized
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
            f"SAP CSV ingestion complete. "
            f"{batch.processed_rows}/{batch.total_rows} rows normalised, "
            f"{flagged} flagged."
        ),
    )

    return {
        "total_rows": batch.total_rows,
        "processed_rows": batch.processed_rows,
        "flagged_rows": flagged,
        "error_count": len(errors),
        "errors": errors[:10],  # Return first 10 for display
    }
