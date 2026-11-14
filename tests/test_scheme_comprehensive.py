import json
import pytest
from pathlib import Path
from fastapi.testclient import TestClient

from backend.main import app
from backend.schemes.repository import SchemeRepository
from backend.services.scheme_update_service import SchemeUpdateService


@pytest.fixture
def repo():
    db_path = Path(__file__).resolve().parent.parent / "database" / "schemes.json"
    return SchemeRepository(db_path)


def test_database_loads_all_comprehensive_schemes(repo):
    schemes = repo.all_schemes()
    # Must have comprehensive collection >= 70
    assert len(schemes) >= 70

    farmer_schemes = [s for s in schemes if "farmers" in s.get("beneficiary_groups", [])]
    student_schemes = [s for s in schemes if "students" in s.get("beneficiary_groups", [])]

    assert len(farmer_schemes) >= 34
    assert len(student_schemes) >= 34


def test_mandatory_fields_present_in_all_schemes(repo):
    schemes = repo.all_schemes()
    required_keys = [
        "scheme_id",
        "name",
        "category",
        "department",
        "beneficiary_groups",
        "summary",
        "description",
        "benefit",
        "eligibility_criteria",
        "required_documents",
        "official_application_url",
        "application_window",
        "operational_status",
        "jurisdiction",
        "applicable_states",
        "official_urls",
        "last_updated_date",
        "source_ids"
    ]

    for s in schemes:
        for key in required_keys:
            assert key in s, f"Scheme {s.get('scheme_id')} missing mandatory field '{key}'"
        assert s["name"].get("en"), f"Scheme {s.get('scheme_id')} missing English name"
        assert s["name"].get("kn"), f"Scheme {s.get('scheme_id')} missing Kannada name"
        assert s["name"].get("hi"), f"Scheme {s.get('scheme_id')} missing Hindi name"
        assert s["summary"].get("en"), f"Scheme {s.get('scheme_id')} missing English summary"
        assert s["summary"].get("kn"), f"Scheme {s.get('scheme_id')} missing Kannada summary"
        assert s["summary"].get("hi"), f"Scheme {s.get('scheme_id')} missing Hindi summary"


def test_operational_status_filtering(repo):
    active_schemes = repo.search_schemes(operational_status="ACTIVE")
    assert len(active_schemes) > 0
    for s in active_schemes:
        assert s["operational_status"] == "ACTIVE"

    seasonal_schemes = repo.search_schemes(operational_status="SEASONAL")
    assert len(seasonal_schemes) >= 3

    open_schemes = repo.search_schemes(operational_status="APPLICATIONS OPEN")
    assert len(open_schemes) >= 10

    # Discontinued schemes should not appear in default search
    default_search = repo.search_schemes(include_discontinued=False)
    for s in default_search:
        assert s["operational_status"] != "DISCONTINUED"

    all_including_disc = repo.search_schemes(include_discontinued=True)
    has_disc = any(s["operational_status"] == "DISCONTINUED" for s in all_including_disc)
    assert has_disc is True


def test_category_and_jurisdiction_filtering(repo):
    income_schemes = repo.search_schemes(category="Direct Income Support")
    assert len(income_schemes) >= 1

    scholarship_schemes = repo.search_schemes(category="Scholarship")
    assert len(scholarship_schemes) >= 10

    central_schemes = repo.search_schemes(jurisdiction="central")
    assert len(central_schemes) >= 20

    state_schemes = repo.search_schemes(jurisdiction="state")
    assert len(state_schemes) >= 20

    district_schemes = repo.search_schemes(jurisdiction="district")
    assert len(district_schemes) >= 2


def test_search_by_query_and_pagination(repo):
    # Search by keyword
    kisan_results = repo.search_schemes(query="kisan")
    assert len(kisan_results) >= 2

    kannada_results = repo.search_schemes(query="ಕಿಸಾನ್")
    assert len(kannada_results) >= 2

    # Pagination test
    page_1 = repo.search_schemes(page=1, page_size=10)
    assert len(page_1) == 10

    page_2 = repo.search_schemes(page=2, page_size=10)
    assert len(page_2) == 10
    assert page_1[0]["scheme_id"] != page_2[0]["scheme_id"]


def test_scheme_update_service_lifecycle(tmp_path):
    # Setup test schemes.json and versions dir
    test_db = tmp_path / "schemes.json"
    sample_data = {
        "schema_version": "2.0",
        "scope": {"state": "Karnataka"},
        "sources": [{"source_id": "SRC_TEST", "title": "Test", "url": "https://gov.in"}],
        "schemes": [
            {
                "scheme_id": "PM_KISAN",
                "name": {"en": "PM Kisan"},
                "operational_status": "ACTIVE",
                "version": "1.0",
                "last_verified_date": "2026-11-01",
                "summary": {"en": "Old summary"}
            }
        ]
    }
    test_db.write_text(json.dumps(sample_data), encoding="utf-8")

    queue_file = tmp_path / "queue.json"
    versions_dir = tmp_path / "versions"

    service = SchemeUpdateService(
        db_path=test_db,
        queue_path=queue_file,
        versions_dir=versions_dir
    )

    # 1. Propose update
    update_item = service.propose_update(
        scheme_id="PM_KISAN",
        proposed_data={"summary": {"en": "Updated 2026 guidelines summary"}, "operational_status": "APPLICATIONS OPEN"},
        source_evidence="https://pmkisan.gov.in/circulars/2026.pdf",
        notes="Annual operational guideline refresh",
        proposed_by="Officer_Reviewer_1"
    )

    assert update_item["update_id"].startswith("UPD-")
    assert update_item["status"] == "PENDING_VERIFICATION"
    assert update_item["diff"]["has_changes"] is True

    # 2. Check pending queue
    pending = service.get_verification_queue("PENDING_VERIFICATION")
    assert len(pending) == 1
    assert pending[0]["update_id"] == update_item["update_id"]

    # 3. Approve update
    approved = service.approve_update(
        update_id=update_item["update_id"],
        officer_id="Officer_Lead",
        officer_notes="Verified against official circular"
    )
    assert approved["status"] == "APPROVED"

    # Verify db was updated
    with open(test_db, "r", encoding="utf-8") as f:
        updated_db = json.load(f)
    pm_kisan = next(s for s in updated_db["schemes"] if s["scheme_id"] == "PM_KISAN")
    assert pm_kisan["summary"]["en"] == "Updated 2026 guidelines summary"
    assert pm_kisan["operational_status"] == "APPLICATIONS OPEN"

    # Verify version snapshot was archived
    snapshots = list(versions_dir.glob("*.json"))
    assert len(snapshots) == 1

    # History verification
    history = service.get_version_history("PM_KISAN")
    assert len(history) == 1
    assert history[0]["data"]["summary"]["en"] == "Old summary"


def test_api_schemes_and_categories_endpoints():
    client = TestClient(app)

    # Categories
    cat_res = client.get("/api/schemes/categories")
    assert cat_res.status_code == 200
    cat_data = cat_res.json()
    assert "categories" in cat_data
    assert "Direct Income Support" in cat_data["categories"]

    # Also test /api/v1 alias
    cat_res_v1 = client.get("/api/v1/schemes/categories")
    assert cat_res_v1.status_code == 200

    # List schemes
    list_res = client.get("/api/schemes?page_size=5")
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert len(list_data["schemes"]) == 5

    # Scheme details with alt-name lookup
    alt_res = client.get("/api/schemes/Millet Incentive Scheme")
    assert alt_res.status_code == 200
    assert alt_res.json()["scheme_id"] == "RAITHA_SIRI"

    # Direct ID lookup
    direct_res = client.get("/api/schemes/PM_KISAN")
    assert direct_res.status_code == 200
    assert direct_res.json()["scheme_id"] == "PM_KISAN"
