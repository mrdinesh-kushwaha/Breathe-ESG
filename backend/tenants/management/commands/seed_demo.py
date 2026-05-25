"""
Management command: python manage.py seed_demo

Creates a demo tenant, two users (analyst + reviewer), three data sources,
and runs sample ingestion so the app has data on first launch.
"""
import json
from django.core.management.base import BaseCommand
from tenants.models import Tenant, User
from ingestion.models import DataSource


SAMPLE_SAP_CSV = """Belegnummer,Werk,Buchungsdatum,Materialbeschreibung,Menge,ME
5001234001,DE01,15.01.2024,Diesel Kraftstoff B7,12450.5,L
5001234002,DE01,20.01.2024,Erdgas (HH-Qualität),3200,M3
5001234003,UK03,22.01.2024,Petrol Premium Unleaded,890.0,L
5001234004,DE02,25.01.2024,Heizöl EL,4560,L
5001234005,DE01,31.01.2024,Diesel Kraftstoff B7,-200,L
5001234006,UK03,31.01.2024,Hydrauliköl HLP 46,3400,ST
5001234007,DE01,05.02.2024,LPG Flüssiggas,780,L
5001234008,DE02,12.02.2024,Diesel Kraftstoff B7,98760,L
"""

SAMPLE_UTILITY_CSV = """Meter ID,Period Start,Period End,Consumption (kWh),Tariff Type,Site
UK-ELEC-001,01/01/2024,31/01/2024,48200,Standard,Manchester HQ
UK-ELEC-001,01/02/2024,29/02/2024,51400,Standard,Manchester HQ
UK-ELEC-002,01/01/2024,31/01/2024,12800,Green Renewable,London Office
UK-ELEC-003,01/01/2024,31/01/2024,890500,Standard,Birmingham Factory
UK-ELEC-004,01/01/2024,31/01/2024,-340,Standard,Leeds Depot
UK-ELEC-005,01/01/2024,31/01/2024,23100,Standard,Glasgow Office
"""

SAMPLE_TRAVEL_JSON = {
    "export_date": "2024-02-01",
    "company_id": "ACME-CORP",
    "bookings": [
        {
            "booking_reference": "TRV-2024-0001",
            "travel_mode": "air",
            "origin": "LHR",
            "destination": "JFK",
            "travel_class": "economy",
            "distance_km": 5541,
            "trip_date": "2024-01-08",
            "traveller": "Sarah Mitchell",
            "department": "Sales"
        },
        {
            "booking_reference": "TRV-2024-0002",
            "travel_mode": "air",
            "origin": "LHR",
            "destination": "CDG",
            "travel_class": "business",
            "distance_km": 344,
            "trip_date": "2024-01-10",
            "traveller": "James Okafor",
            "department": "Finance"
        },
        {
            "booking_reference": "TRV-2024-0003",
            "travel_mode": "hotel",
            "origin": "NYC",
            "destination": "NYC",
            "travel_class": "standard",
            "nights": 3,
            "trip_date": "2024-01-08",
            "traveller": "Sarah Mitchell",
            "department": "Sales"
        },
        {
            "booking_reference": "TRV-2024-0004",
            "travel_mode": "taxi",
            "origin": "LHR",
            "destination": "London City",
            "travel_class": "standard",
            "distance_km": 28,
            "trip_date": "2024-01-15",
            "traveller": "Priya Sharma",
            "department": "Engineering"
        },
        {
            "booking_reference": "TRV-2024-0005",
            "travel_mode": "air",
            "origin": "LHR",
            "destination": "DXB",
            "travel_class": "business",
            "distance_km": None,
            "trip_date": "2024-01-18",
            "traveller": "David Chen",
            "department": "Partnerships"
        },
        {
            "booking_reference": "TRV-2024-0006",
            "travel_mode": "air",
            "origin": "XYZ",
            "destination": "JFK",
            "travel_class": "economy",
            "distance_km": 9000,
            "trip_date": "2024-01-22",
            "traveller": "Unknown Traveller",
            "department": "Unknown"
        },
        {
            "booking_reference": "TRV-2024-0007",
            "travel_mode": "rail",
            "origin": "London Euston",
            "destination": "Manchester Piccadilly",
            "travel_class": "standard",
            "distance_km": 295,
            "trip_date": "2024-01-25",
            "traveller": "Emma Thompson",
            "department": "HR"
        },
        {
            "booking_reference": "TRV-2024-0008",
            "travel_mode": "hotel",
            "origin": "DXB",
            "destination": "DXB",
            "travel_class": "business",
            "nights": 45,
            "trip_date": "2024-01-18",
            "traveller": "David Chen",
            "department": "Partnerships"
        }
    ]
}


class Command(BaseCommand):
    help = "Seed demo tenant, users, and sample data"

    def handle(self, *args, **options):
        self.stdout.write("Creating demo tenant...")

        tenant, _ = Tenant.objects.get_or_create(
            slug="acme-corp",
            defaults={"name": "ACME Corporation", "industry": "Manufacturing"},
        )

        analyst, created = User.objects.get_or_create(
            email="analyst@acme.com",
            defaults={
                "first_name": "Alex",
                "last_name": "Analyst",
                "role": User.ROLE_ANALYST,
                "tenant": tenant,
            },
        )
        if created:
            analyst.set_password("demo1234")
            analyst.save()

        reviewer, created = User.objects.get_or_create(
            email="reviewer@acme.com",
            defaults={
                "first_name": "Rachel",
                "last_name": "Reviewer",
                "role": User.ROLE_REVIEWER,
                "tenant": tenant,
            },
        )
        if created:
            reviewer.set_password("demo1234")
            reviewer.save()

        sap_source, _ = DataSource.objects.get_or_create(
            tenant=tenant,
            source_type=DataSource.SOURCE_SAP,
            defaults={"name": "SAP ECC — DE/UK Plants", "description": "Monthly fuel procurement exports"},
        )
        utility_source, _ = DataSource.objects.get_or_create(
            tenant=tenant,
            source_type=DataSource.SOURCE_UTILITY,
            defaults={"name": "UK National Grid Portal", "description": "Monthly electricity billing data"},
        )
        travel_source, _ = DataSource.objects.get_or_create(
            tenant=tenant,
            source_type=DataSource.SOURCE_TRAVEL,
            defaults={"name": "Concur Travel Export", "description": "Q1 2024 business travel bookings"},
        )

        # Run ingestion
        from ingestion.models import UploadBatch
        from ingestion.sap_ingestion import ingest_sap_csv
        from ingestion.other_ingestion import ingest_utility_csv, ingest_travel_json

        sap_batch = UploadBatch.objects.create(
            tenant=tenant, data_source=sap_source, uploaded_by=analyst,
            original_filename="sap_export_jan2024.csv",
            status=UploadBatch.STATUS_PROCESSING,
        )
        ingest_sap_csv(SAMPLE_SAP_CSV, sap_batch, actor=analyst)
        self.stdout.write(f"  SAP: {sap_batch.processed_rows}/{sap_batch.total_rows} rows")

        util_batch = UploadBatch.objects.create(
            tenant=tenant, data_source=utility_source, uploaded_by=analyst,
            original_filename="utility_jan2024.csv",
            status=UploadBatch.STATUS_PROCESSING,
        )
        ingest_utility_csv(SAMPLE_UTILITY_CSV, util_batch, actor=analyst)
        self.stdout.write(f"  Utility: {util_batch.processed_rows}/{util_batch.total_rows} rows")

        travel_batch = UploadBatch.objects.create(
            tenant=tenant, data_source=travel_source, uploaded_by=analyst,
            original_filename="concur_jan2024.json",
            status=UploadBatch.STATUS_PROCESSING,
        )
        ingest_travel_json(json.dumps(SAMPLE_TRAVEL_JSON), travel_batch, actor=analyst)
        self.stdout.write(f"  Travel: {travel_batch.processed_rows}/{travel_batch.total_rows} rows")

        self.stdout.write(self.style.SUCCESS("\nDemo seed complete."))
        self.stdout.write("  Tenant:   ACME Corporation")
        self.stdout.write("  Analyst:  analyst@acme.com / demo1234")
        self.stdout.write("  Reviewer: reviewer@acme.com / demo1234")
