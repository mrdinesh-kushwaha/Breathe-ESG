# Sources and Research Notes

## SAP Export Format Research

SAP fuel/procurement exports are typically extracted via transactions:
- **MB51** (Material Document List) — goods movement history, includes fuel receipts
- **ME2M** (Purchase Orders by Material) — procurement data

Real SAP exports commonly have:
- German column headers: `Belegnummer` (document number), `Werk` (plant), `Menge` (quantity), `ME` (unit of measure), `Buchungsdatum` (posting date), `Materialbeschreibung` (material description)
- German decimal formatting: `1.234,56` (period as thousands separator, comma as decimal)
- Unit codes: `L` (litres), `M3` (cubic metres), `KG` (kilograms), `ST` (Stück/piece — a common miscoding for fuel)
- Plant codes: typically `{country_code}{number}` (e.g. `DE01`, `UK03`)
- Date formats: `DD.MM.YYYY` for German locale, `YYYYMMDD` for some interfaces
- BOM (byte order mark) on UTF-8 exports from SAP GUI

**What would fail at scale**: SAP exports can include hundreds of material codes, many of which are lubricants, raw materials, or packaging — not fuel. A production system would maintain a material master mapping table, not regex matching on descriptions.

## Utility Portal Research

UK electricity billing exports from portals (EDF, British Gas Business, Octopus Energy for Business) typically include:
- Meter ID (MPAN — Meter Point Administration Number, a 13-digit UK identifier)
- Billing period start/end (often not aligned to calendar months — billing cycles vary)
- kWh consumption
- Tariff type (standard, Economy 7, green/renewable)
- Site name and account reference

Key complexity: billing periods can span month boundaries (e.g. 15 Jan → 14 Feb), making monthly allocation non-trivial. This prototype stores `period_start` and `period_end` but does not pro-rate across months.

German utility exports (Vattenfall, E.ON) use MWh rather than kWh and ISO dates rather than UK-format dates — handled by the unit conversion table.

**What would fail at scale**: Large industrial sites have interval data (half-hourly meter readings) rather than monthly billing summaries. Processing interval data requires aggregation logic not present in this prototype.

## Concur / Navan API Research

Concur (SAP Concur) Travel API:
- Endpoint: `GET /api/v3.0/travel/trip` — returns trip summaries
- Booking details: `GET /api/v3.0/expense/receiptimages` for hotel receipts
- Authentication: OAuth 2.0 with company-level access token
- Rate limit: 1000 requests/hour

Navan (formerly TripActions) API:
- REST API with booking, traveller, and reporting endpoints
- Supports webhook notifications on booking creation/modification
- Returns booking reference, segment type (air/hotel/car/rail), origin, destination, and traveller metadata

Both platforms expose distance for flights as an optional field — it is frequently null and must be imputed from airport pair lookup tables or a distance API (e.g. Aviation Stack, Great Circle Mapper).

Hotel data often lacks location coordinates — city-level emission factors are the practical fallback.

**What the real integration looks like**: OAuth credentials stored encrypted in `DataSource.column_mapping` (or a dedicated secrets table). A Celery beat task runs nightly, calls the API, pages through results since the last sync timestamp, and calls `ingest_travel_json()`.

**What would fail at scale**: Booking modifications and cancellations are not handled. If a flight is cancelled after ingestion, the emissions record remains. A webhook listener for `booking.cancelled` events would be needed.

## Emission Factor Sources

- **DEFRA 2023 Greenhouse Gas Reporting Conversion Factors**: Primary source for UK-based factors (fuel combustion, electricity grid, business travel)
  - URL: https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2023
- **IEA 2022 CO2 Emissions from Fuel Combustion**: Used for cross-referencing fuel combustion factors
- **IPCC AR6 (2021)**: GWP100 values for CO2, CH4, N2O used in CO2e conversion (not directly referenced in this prototype but relevant for Scope 3 supply chain)

All factors in this prototype are approximations suitable for demonstration. Production use requires annual factor updates and version locking per reporting period.
