"""
Normalization service layer.

Responsibilities:
  1. Convert source units to a canonical unit (kg, kWh, km)
  2. Map activity descriptions to standard activity_type codes
  3. Assign Scope 1/2/3 classification
  4. Apply emission factors (DEFRA 2023 approximations)
  5. Flag suspicious rows with specific reasons

All emission factors are kg CO2e per unit.
In production these would be versioned and tenant-configurable.
Using DEFRA 2023 / IEA 2022 approximations as placeholders.
"""

from dataclasses import dataclass, field
from typing import Optional
import re


# ---------------------------------------------------------------------------
# Emission factors (kg CO2e per unit)
# Source: DEFRA 2023 Greenhouse Gas Reporting, IEA 2022
# ---------------------------------------------------------------------------

EMISSION_FACTORS = {
    # Scope 1 — fuel combustion
    "diesel_combustion": 2.6391,        # per litre
    "petrol_combustion": 2.3122,        # per litre
    "natural_gas_combustion": 2.0431,   # per m³
    "lpg_combustion": 1.5551,           # per litre
    "heating_oil_combustion": 2.5196,   # per litre

    # Scope 2 — electricity (UK grid average 2023)
    "electricity_consumption": 0.20707,  # per kWh

    # Scope 3 — travel
    "flight_economy_short": 0.15530,     # per passenger-km (< 3700 km)
    "flight_economy_long": 0.19085,      # per passenger-km (>= 3700 km)
    "flight_business_short": 0.42867,    # per passenger-km
    "flight_business_long": 0.53382,     # per passenger-km
    "hotel_stay": 31.0,                  # per room-night
    "ground_taxi": 0.14869,              # per km
    "ground_rail": 0.03549,              # per km
    "ground_rental_car": 0.16844,        # per km
}

# Unit conversion: to canonical unit
UNIT_CONVERSIONS = {
    # Volume
    "l": 1.0, "liter": 1.0, "litre": 1.0, "liters": 1.0, "litres": 1.0,
    "ml": 0.001,
    "gal": 3.78541, "gallon": 3.78541, "gallons": 3.78541,
    "m3": 1000.0, "m³": 1000.0, "cbm": 1000.0,  # m³ gas → litres (density-normalised separately)

    # Energy
    "kwh": 1.0, "kWh": 1.0,
    "mwh": 1000.0, "MWh": 1000.0,
    "gwh": 1000000.0,
    "j": 2.77778e-7,
    "mj": 0.000277778,
    "gj": 0.277778,

    # Mass
    "kg": 1.0, "kilogram": 1.0, "kilograms": 1.0,
    "g": 0.001, "gram": 0.001,
    "t": 1000.0, "tonne": 1000.0, "tonnes": 1000.0, "ton": 907.185,

    # Distance
    "km": 1.0, "kilometer": 1.0, "kilometres": 1.0,
    "mi": 1.60934, "mile": 1.60934, "miles": 1.60934,
    "nm": 1.852, "nautical mile": 1.852,
}

# Known German SAP unit labels → normalised English
GERMAN_UNIT_MAP = {
    "L": "l", "Liter": "l", "Ltr": "l",
    "KG": "kg", "T": "t",
    "KWH": "kwh", "KW": "kw",
    "M3": "m3", "CBM": "m3",
    "KM": "km",
    "ST": "unit",  # Stück (piece) — flagged as suspicious
}

# Approximate great-circle distances between major airport pairs (km)
# In production this would be a full dataset or API call
AIRPORT_DISTANCES = {
    frozenset(["LHR", "JFK"]): 5541,
    frozenset(["LHR", "CDG"]): 344,
    frozenset(["LHR", "FRA"]): 636,
    frozenset(["LHR", "DXB"]): 5503,
    frozenset(["JFK", "LAX"]): 3983,
    frozenset(["JFK", "ORD"]): 1190,
    frozenset(["FRA", "SIN"]): 10369,
    frozenset(["LHR", "SIN"]): 10841,
    frozenset(["CDG", "BOM"]): 7019,
    frozenset(["LHR", "BOM"]): 7194,
    frozenset(["ORD", "LHR"]): 6347,
    frozenset(["LAX", "NRT"]): 8759,
}

VALID_IATA_CODES = {
    "LHR", "LGW", "MAN", "EDI", "BHX",
    "JFK", "LAX", "ORD", "SFO", "BOS", "SEA", "MIA", "DFW", "ATL",
    "CDG", "AMS", "FRA", "MUC", "MAD", "FCO", "ZRH", "VIE", "CPH",
    "DXB", "SIN", "HKG", "NRT", "ICN", "BOM", "DEL", "PEK",
    "SYD", "MEL", "GRU", "EZE", "YYZ", "YVR",
}


@dataclass
class NormalizationResult:
    activity_type: str
    scope_category: str
    original_unit: str
    original_value: float
    normalized_unit: str
    normalized_value: float
    emission_factor: float
    estimated_emissions: float
    suspicious_flag: bool = False
    suspicious_reason: str = ""
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    source_row_id: str = ""
    parse_warnings: list = field(default_factory=list)


class NormalizationError(Exception):
    pass


def normalize_unit_label(raw_unit: str) -> str:
    """Resolve German/non-standard unit labels to lowercase English."""
    cleaned = raw_unit.strip()
    if cleaned in GERMAN_UNIT_MAP:
        return GERMAN_UNIT_MAP[cleaned]
    return cleaned.lower()


def convert_to_canonical(value: float, raw_unit: str) -> tuple[float, str]:
    """
    Convert value+unit to canonical unit.
    Returns (converted_value, canonical_unit_label).
    Raises NormalizationError if unit is unknown.
    """
    unit = normalize_unit_label(raw_unit)
    factor = UNIT_CONVERSIONS.get(unit)
    if factor is None:
        raise NormalizationError(f"Unknown unit: '{raw_unit}'")
    return value * factor, unit


def _flag(reason: str) -> tuple[bool, str]:
    return True, reason


# ---------------------------------------------------------------------------
# SAP fuel/procurement normalization
# ---------------------------------------------------------------------------

SAP_MATERIAL_MAP = {
    # Material code patterns → activity type
    r"diesel|dies|go|gasoil": "diesel_combustion",
    r"petrol|benzin|gasolin": "petrol_combustion",
    r"erdgas|nat.*gas|natural.?gas": "natural_gas_combustion",
    r"lpg|fluessiggas|liquid.?propan": "lpg_combustion",
    r"heizöl|heizoel|heating.?oil|fuel.?oil": "heating_oil_combustion",
}

CANONICAL_UNIT_FOR_ACTIVITY = {
    "diesel_combustion": "l",
    "petrol_combustion": "l",
    "natural_gas_combustion": "m3",
    "lpg_combustion": "l",
    "heating_oil_combustion": "l",
    "electricity_consumption": "kwh",
}


def normalize_sap_record(row: dict) -> NormalizationResult:
    """
    Normalize a single parsed SAP row.

    Expected canonical fields after column mapping:
      material_description, quantity, unit, plant_code, posting_date, document_number
    """
    warnings = []

    material = str(row.get("material_description", "")).lower().strip()
    quantity_raw = row.get("quantity", "")
    unit_raw = str(row.get("unit", "")).strip()
    doc_number = str(row.get("document_number", ""))
    plant_code = str(row.get("plant_code", ""))
    posting_date = row.get("posting_date", "")

    # Resolve activity type from material description
    activity_type = None
    for pattern, act in SAP_MATERIAL_MAP.items():
        if re.search(pattern, material, re.IGNORECASE):
            activity_type = act
            break

    if not activity_type:
        # Can't classify — flag and use best-effort
        activity_type = "unknown_fuel"
        suspicious = True
        suspicious_reason = f"Unrecognized material description: '{material}'"
        return NormalizationResult(
            activity_type=activity_type,
            scope_category="scope_1",
            original_unit=unit_raw,
            original_value=0.0,
            normalized_unit=unit_raw,
            normalized_value=0.0,
            emission_factor=0.0,
            estimated_emissions=0.0,
            suspicious_flag=True,
            suspicious_reason=suspicious_reason,
            source_row_id=doc_number,
        )

    # Parse quantity
    try:
        quantity = float(str(quantity_raw).replace(",", ".").strip())
    except (ValueError, TypeError):
        raise NormalizationError(f"Cannot parse quantity: '{quantity_raw}'")

    # Convert unit
    try:
        normalized_value, canonical_unit = convert_to_canonical(quantity, unit_raw)
    except NormalizationError as e:
        warnings.append(str(e))
        normalized_value = quantity
        canonical_unit = unit_raw

    ef = EMISSION_FACTORS.get(activity_type, 0.0)
    estimated_emissions = normalized_value * ef

    # Suspicion checks
    suspicious_flag = False
    suspicious_reason = ""

    if quantity <= 0:
        suspicious_flag, suspicious_reason = _flag(f"Non-positive quantity: {quantity}")
    elif normalized_value > 50000:
        suspicious_flag, suspicious_reason = _flag(
            f"Unusually high consumption: {normalized_value:.0f} {canonical_unit}"
        )
    elif not unit_raw or unit_raw.upper() == "ST":
        suspicious_flag, suspicious_reason = _flag("Missing or ambiguous unit (Stück/piece)")

    period_start = period_end = None
    if posting_date:
        period_start = _parse_date(posting_date)

    return NormalizationResult(
        activity_type=activity_type,
        scope_category="scope_1",
        original_unit=unit_raw,
        original_value=quantity,
        normalized_unit=canonical_unit,
        normalized_value=normalized_value,
        emission_factor=ef,
        estimated_emissions=estimated_emissions,
        suspicious_flag=suspicious_flag,
        suspicious_reason=suspicious_reason,
        period_start=period_start,
        source_row_id=doc_number,
        parse_warnings=warnings,
    )


# ---------------------------------------------------------------------------
# Utility electricity normalization
# ---------------------------------------------------------------------------

def normalize_utility_record(row: dict) -> NormalizationResult:
    """
    Normalize a utility electricity row.

    Expected fields: meter_id, billing_start, billing_end, consumption_kwh, tariff_type
    """
    warnings = []

    meter_id = str(row.get("meter_id", ""))
    consumption_raw = row.get("consumption_kwh", row.get("consumption", ""))
    unit_raw = str(row.get("unit", "kwh")).strip()
    billing_start = row.get("billing_start", row.get("period_start", ""))
    billing_end = row.get("billing_end", row.get("period_end", ""))
    tariff = str(row.get("tariff_type", "")).lower()

    try:
        consumption = float(str(consumption_raw).replace(",", ".").strip())
    except (ValueError, TypeError):
        raise NormalizationError(f"Cannot parse consumption: '{consumption_raw}'")

    try:
        normalized_value, canonical_unit = convert_to_canonical(consumption, unit_raw)
    except NormalizationError as e:
        warnings.append(str(e))
        normalized_value = consumption
        canonical_unit = "kwh"

    ef = EMISSION_FACTORS["electricity_consumption"]
    estimated_emissions = normalized_value * ef

    suspicious_flag = False
    suspicious_reason = ""

    if consumption <= 0:
        suspicious_flag, suspicious_reason = _flag(f"Non-positive consumption: {consumption}")
    elif normalized_value > 500000:
        suspicious_flag, suspicious_reason = _flag(
            f"Extremely high consumption: {normalized_value:,.0f} kWh — verify meter"
        )
    elif "renewable" in tariff or "green" in tariff:
        # Not suspicious but worth noting — market-based vs location-based accounting
        warnings.append("Renewable/green tariff: market-based factor may differ from grid average")

    period_start = _parse_date(billing_start) if billing_start else None
    period_end = _parse_date(billing_end) if billing_end else None

    return NormalizationResult(
        activity_type="electricity_consumption",
        scope_category="scope_2",
        original_unit=unit_raw,
        original_value=consumption,
        normalized_unit="kwh",
        normalized_value=normalized_value,
        emission_factor=ef,
        estimated_emissions=estimated_emissions,
        suspicious_flag=suspicious_flag,
        suspicious_reason=suspicious_reason,
        period_start=period_start,
        period_end=period_end,
        source_row_id=meter_id,
        parse_warnings=warnings,
    )


# ---------------------------------------------------------------------------
# Travel normalization
# ---------------------------------------------------------------------------

TRAVEL_MODE_MAP = {
    "air": "flight",
    "flight": "flight",
    "plane": "flight",
    "hotel": "hotel_stay",
    "accommodation": "hotel_stay",
    "taxi": "ground_taxi",
    "cab": "ground_taxi",
    "uber": "ground_taxi",
    "rail": "ground_rail",
    "train": "ground_rail",
    "rental": "ground_rental_car",
    "car rental": "ground_rental_car",
    "rental car": "ground_rental_car",
}


def normalize_travel_record(row: dict) -> NormalizationResult:
    """
    Normalize a single travel booking row from Concur/Navan-style JSON.

    Expected fields: booking_reference, travel_mode, origin, destination,
                     travel_class, distance_km, nights, trip_date
    """
    warnings = []

    booking_ref = str(row.get("booking_reference", ""))
    mode_raw = str(row.get("travel_mode", "")).lower().strip()
    origin = str(row.get("origin", "")).upper().strip()
    destination = str(row.get("destination", "")).upper().strip()
    travel_class = str(row.get("travel_class", "economy")).lower()
    distance_km = row.get("distance_km")
    nights = row.get("nights", 1)
    trip_date = row.get("trip_date", row.get("date", ""))

    mode_key = TRAVEL_MODE_MAP.get(mode_raw)
    if not mode_key:
        return NormalizationResult(
            activity_type="unknown_travel",
            scope_category="scope_3",
            original_unit="n/a",
            original_value=0.0,
            normalized_unit="n/a",
            normalized_value=0.0,
            emission_factor=0.0,
            estimated_emissions=0.0,
            suspicious_flag=True,
            suspicious_reason=f"Unrecognized travel mode: '{mode_raw}'",
            source_row_id=booking_ref,
        )

    suspicious_flag = False
    suspicious_reason = ""

    # --- FLIGHT ---
    if mode_key == "flight":
        # Validate IATA codes
        if origin not in VALID_IATA_CODES:
            suspicious_flag, suspicious_reason = _flag(f"Unknown origin IATA code: '{origin}'")
        elif destination not in VALID_IATA_CODES:
            suspicious_flag, suspicious_reason = _flag(f"Unknown destination IATA code: '{destination}'")

        # Resolve distance
        if distance_km is None or float(distance_km) <= 0:
            pair = frozenset([origin, destination])
            distance_km = AIRPORT_DISTANCES.get(pair)
            if distance_km is None:
                suspicious_flag = True
                suspicious_reason = (
                    f"No distance data for {origin}→{destination}; used fallback 0 km"
                )
                distance_km = 0.0
            else:
                warnings.append(f"Distance imputed from lookup table: {distance_km} km")

        distance_km = float(distance_km)
        is_long_haul = distance_km >= 3700

        if "business" in travel_class or "first" in travel_class:
            ef_key = "flight_business_long" if is_long_haul else "flight_business_short"
        else:
            ef_key = "flight_economy_long" if is_long_haul else "flight_economy_short"

        ef = EMISSION_FACTORS[ef_key]
        estimated_emissions = distance_km * ef

        activity_type = f"flight_{'long' if is_long_haul else 'short'}_{travel_class.split()[0]}"

        return NormalizationResult(
            activity_type=activity_type,
            scope_category="scope_3",
            original_unit="km",
            original_value=distance_km,
            normalized_unit="passenger-km",
            normalized_value=distance_km,
            emission_factor=ef,
            estimated_emissions=estimated_emissions,
            suspicious_flag=suspicious_flag,
            suspicious_reason=suspicious_reason,
            period_start=_parse_date(trip_date),
            source_row_id=booking_ref,
            parse_warnings=warnings,
        )

    # --- HOTEL ---
    if mode_key == "hotel_stay":
        try:
            nights = float(nights)
        except (ValueError, TypeError):
            nights = 1.0
            warnings.append("Could not parse nights; defaulted to 1")

        ef = EMISSION_FACTORS["hotel_stay"]
        estimated_emissions = nights * ef

        if nights <= 0:
            suspicious_flag, suspicious_reason = _flag(f"Non-positive nights: {nights}")
        elif nights > 30:
            suspicious_flag, suspicious_reason = _flag(f"Unusually long hotel stay: {nights} nights")

        return NormalizationResult(
            activity_type="hotel_stay",
            scope_category="scope_3",
            original_unit="nights",
            original_value=nights,
            normalized_unit="room-nights",
            normalized_value=nights,
            emission_factor=ef,
            estimated_emissions=estimated_emissions,
            suspicious_flag=suspicious_flag,
            suspicious_reason=suspicious_reason,
            period_start=_parse_date(trip_date),
            source_row_id=booking_ref,
            parse_warnings=warnings,
        )

    # --- GROUND TRANSPORT ---
    if distance_km is None or float(distance_km) <= 0:
        suspicious_flag, suspicious_reason = _flag("Missing distance for ground transport")
        distance_km = 0.0

    distance_km = float(distance_km)
    ef = EMISSION_FACTORS.get(mode_key, EMISSION_FACTORS["ground_taxi"])
    estimated_emissions = distance_km * ef

    if distance_km > 1000:
        suspicious_flag, suspicious_reason = _flag(
            f"Unusually long ground journey: {distance_km:.0f} km — check travel mode"
        )

    return NormalizationResult(
        activity_type=mode_key,
        scope_category="scope_3",
        original_unit="km",
        original_value=distance_km,
        normalized_unit="km",
        normalized_value=distance_km,
        emission_factor=ef,
        estimated_emissions=estimated_emissions,
        suspicious_flag=suspicious_flag,
        suspicious_reason=suspicious_reason,
        period_start=_parse_date(trip_date),
        source_row_id=booking_ref,
        parse_warnings=warnings,
    )


# ---------------------------------------------------------------------------
# Date parsing helpers
# ---------------------------------------------------------------------------

import re
from datetime import date

DATE_PATTERNS = [
    (r"(\d{4})-(\d{2})-(\d{2})", "%Y-%m-%d"),
    (r"(\d{2})\.(\d{2})\.(\d{4})", "%d.%m.%Y"),
    (r"(\d{2})/(\d{2})/(\d{4})", "%d/%m/%Y"),
    (r"(\d{2})-(\d{2})-(\d{4})", "%d-%m-%Y"),
    (r"(\d{4})(\d{2})(\d{2})", "%Y%m%d"),
]


def _parse_date(value: str) -> Optional[str]:
    """
    Try to parse a date string in multiple common formats.
    Returns ISO format YYYY-MM-DD string or None.
    """
    if not value:
        return None
    value = str(value).strip()
    from datetime import datetime
    for pattern, fmt in DATE_PATTERNS:
        if re.fullmatch(pattern, value):
            try:
                return datetime.strptime(value, fmt).date().isoformat()
            except ValueError:
                continue
    return None
