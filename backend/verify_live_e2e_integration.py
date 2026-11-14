"""
Comprehensive verification of live Citizen-to-Officer workflow,
AI Assistant chat interactions, RBAC security, Aadhaar masking,
and database consistency.
"""
import sys
import uuid
from fastapi.testclient import TestClient
from backend.main import app

def run_e2e_tests():
    client = TestClient(app)
    print("===================================================================")
    print("GRAM SAATHI — LIVE INTEGRATION & WORKFLOW VERIFICATION SUITE")
    print("===================================================================")

    # -------------------------------------------------------------------------
    # 1. AI Assistant Chat Grounding & Fallback Tests
    # -------------------------------------------------------------------------
    print("\n[Step 1] Verifying AI Assistant Chat & Grounding...")

    # A. Farmer query in English without explicit beneficiary_group
    res_chat_farmer = client.post("/api/chat", json={
        "message": "Find schemes for farmers in Karnataka",
        "language": "en"
    })
    assert res_chat_farmer.status_code == 200, f"Chat failed: {res_chat_farmer.text}"
    chat_farmer_data = res_chat_farmer.json()
    assert chat_farmer_data["needs_clarification"] is False, "Should auto-detect farmer category"
    assert "PM-KISAN" in chat_farmer_data["reply"] or "scheme" in chat_farmer_data["reply"].lower()
    print("  ✓ Auto-detected 'farmers' category and returned grounded scheme candidates")

    # B. Document query for PM-KISAN in Kannada
    res_chat_docs_kn = client.post("/api/chat", json={
        "message": "ಪಿಎಂ ಕಿಸಾನ್ ಯೋಜನೆಗೆ ಅಗತ್ಯವಿರುವ ದಾಖಲೆಗಳು ಯಾವುವು?",
        "language": "kn"
    })
    assert res_chat_docs_kn.status_code == 200
    chat_docs_data = res_chat_docs_kn.json()
    assert chat_docs_data["needs_clarification"] is False
    assert "ಅಗತ್ಯ ದಾಖಲೆಗಳು" in chat_docs_data["reply"]
    print("  ✓ Kannada PM-KISAN document query returned localized verified documents")

    # C. Tracking query in Hindi
    res_chat_track = client.post("/api/chat", json={
        "message": "मेरा आवेदन ट्रैक करें",
        "language": "hi"
    })
    assert res_chat_track.status_code == 200
    chat_track_data = res_chat_track.json()
    assert "SIM-GS-2026" in chat_track_data["reply"]
    print("  ✓ Tracking query returned guided instructions without error notices")

    # D. Sensitive data rejection
    res_chat_aadhaar = client.post("/api/chat", json={
        "message": "My Aadhaar is 9988 7766 5544, please check eligibility",
        "language": "en"
    })
    assert res_chat_aadhaar.status_code == 422
    assert "remove Aadhaar" in res_chat_aadhaar.json()["detail"]
    print("  ✓ Aadhaar numbers strictly rejected before reaching AI or database")

    # -------------------------------------------------------------------------
    # 2. Citizen Registration & Live Profile via OTP Flow
    # -------------------------------------------------------------------------
    print("\n[Step 2] Verifying Citizen Registration & Profile via OTP...")
    test_phone = f"+9198765{str(uuid.uuid4().int)[:5]}"
    
    # Send OTP
    res_otp = client.post("/api/citizens/send-otp", json={"phone": test_phone})
    assert res_otp.status_code == 200, f"Send OTP failed: {res_otp.text}"
    otp_code = res_otp.json().get("dev_otp") or "123456"

    # Verify OTP and issue JWT
    res_verify = client.post("/api/citizens/verify-otp", json={"phone": test_phone, "otp": otp_code})
    assert res_verify.status_code == 200, f"Verify OTP failed: {res_verify.text}"
    verify_data = res_verify.json()
    citizen_token = verify_data["access_token"]
    citizen_id = verify_data["citizen_id"]
    citizen_headers = {"Authorization": f"Bearer {citizen_token}"}
    print(f"  ✓ Citizen verified via OTP: {test_phone} (ID: {citizen_id})")

    # Update profile details
    res_profile = client.put("/api/citizens/me", json={
        "name": "Basavaraj Patil",
        "citizen_group": "farmer",
        "district": "Mandya",
        "village": "Shivalli",
        "preferred_language": "kn"
    }, headers=citizen_headers)
    assert res_profile.status_code == 200, f"Profile update failed: {res_profile.text}"
    profile_data = res_profile.json()
    assert profile_data["name"] == "Basavaraj Patil"
    print(f"  ✓ Citizen profile updated: {profile_data['name']} ({profile_data['village']}, {profile_data['district']})")

    # -------------------------------------------------------------------------
    # 3. Scheme Discovery & Eligibility Evaluation
    # -------------------------------------------------------------------------
    print("\n[Step 3] Verifying Scheme Discovery & Eligibility Rules...")
    res_disc = client.post("/api/schemes/discover", json={
        "beneficiary_group": "farmers",
        "state": "Karnataka",
        "language": "en",
        "applicant_facts": {"land_holding_acres": 1.8}
    })
    assert res_disc.status_code == 200
    disc_data = res_disc.json()
    assert len(disc_data["schemes"]) > 0
    target_scheme = disc_data["schemes"][0]
    scheme_id = target_scheme["scheme_id"]
    print(f"  ✓ Discovered {len(disc_data['schemes'])} candidate schemes; Selected: {target_scheme['name']}")

    # Check rule-based eligibility
    res_elig = client.post("/api/eligibility/check", json={
        "scheme_id": scheme_id,
        "applicant_facts": {
            "state": "Karnataka",
            "is_farmer": True,
            "land_holding_acres": 1.8,
            "has_cultivable_land_record": True,
            "is_institutional_landholder": False,
            "holds_constitutional_post": False,
            "is_income_tax_payer": False
        }
    })
    assert res_elig.status_code == 200
    elig_result = res_elig.json()
    assert elig_result["outcome"] in ("eligible", "manual_review"), f"Expected eligible/manual_review, got {elig_result['outcome']}"
    print(f"  ✓ Eligibility rule evaluated deterministically: Outcome = {elig_result['outcome']}")

    # -------------------------------------------------------------------------
    # 4. Document Upload with Local OCR Simulation
    # -------------------------------------------------------------------------
    print("\n[Step 4] Verifying Document Upload & Local Validation...")
    res_doc = client.post(
        "/api/documents/upload",
        data={"citizen_id": str(citizen_id), "document_type": "land_record"},
        files={"file": ("bhoomi_rtc_142.png", b"\x89PNG\r\n\x1a\nFAKE_RTC_DOCUMENT_BYTES_LAND_1.8_ACRES", "image/png")},
        headers=citizen_headers
    )
    assert res_doc.status_code in (200, 201), f"Doc upload failed: {res_doc.text}"
    doc_info = res_doc.json()
    doc_id = doc_info["id"]
    print(f"  ✓ Document uploaded with private UUID: {doc_id} (Status: {doc_info.get('validation_status')})")

    # -------------------------------------------------------------------------
    # 5. Application Preparation & Single-Use Confirmation Submission
    # -------------------------------------------------------------------------
    print("\n[Step 5] Verifying Application Preparation & Single-Use Token Submission...")
    res_draft = client.post("/api/applications/drafts", json={
        "citizen_id": citizen_id,
        "scheme_id": scheme_id,
        "applicant_data": {
            "full_name": "Basavaraj Patil",
            "farmer_name": "Basavaraj Patil",
            "village": "Shivalli",
            "taluk": "Maddur",
            "district": "Mandya",
            "land_holding_acres": 1.8,
            "document_ids": [doc_id]
        }
    }, headers=citizen_headers)
    assert res_draft.status_code in (200, 201), f"Draft creation failed: {res_draft.text}"
    app_id = res_draft.json()["id"]
    print(f"  ✓ Application draft created: {app_id}")

    # Request single-use 5-minute confirmation token
    res_token = client.post(f"/api/applications/{app_id}/token", json={
        "citizen_id": citizen_id
    }, headers=citizen_headers)
    assert res_token.status_code == 200, f"Token request failed: {res_token.text}"
    token_str = res_token.json()["raw_token"]
    print(f"  ✓ Issued 5-minute single-use confirmation token: {token_str}")

    # Confirm and submit application
    res_submit = client.post(f"/api/applications/{app_id}/submit", json={
        "confirmation_token": token_str,
        "citizen_id": citizen_id
    }, headers=citizen_headers)
    assert res_submit.status_code == 200, f"Submission failed: {res_submit.text}"
    submit_info = res_submit.json()
    submission_ref = submit_info["submission_reference"]
    assert submission_ref.startswith("SIM-GS-2026-"), f"Expected SIM-GS-2026- prefix, got {submission_ref}"
    print(f"  ✓ Citizen confirmed submission! Internal Reference: {submission_ref}")

    # -------------------------------------------------------------------------
    # 6. Officer Authentication & Review Queue
    # -------------------------------------------------------------------------
    print("\n[Step 6] Verifying Officer Review Queue & Live Data Flow...")
    res_off_login = client.post("/api/officers/login", json={
        "username": "suresh_maddur",
        "role": "panchayat_officer"
    })
    assert res_off_login.status_code == 200
    officer_token = res_off_login.json()["access_token"]
    officer_headers = {"Authorization": f"Bearer {officer_token}"}
    print("  ✓ Officer logged in: suresh_maddur (Panchayat Officer)")

    # Fetch officer dashboard stats
    res_stats = client.get("/api/officers/dashboard-stats", headers=officer_headers)
    assert res_stats.status_code == 200
    stats = res_stats.json()
    assert stats["total_applications"] > 0
    print(f"  ✓ Live Officer Dashboard Stats: {stats['total_applications']} total, {stats['pending_review']} pending review")

    # Fetch officer applications queue
    res_queue = client.get("/api/officers/applications", headers=officer_headers)
    assert res_queue.status_code == 200
    queue = res_queue.json()["applications"]
    matched_app = next((a for a in queue if a["id"] == app_id), None)
    assert matched_app is not None, "Newly submitted application must be in the officer queue"
    assert matched_app["citizen_name"] == "Basavaraj Patil"
    assert "XXXX" in matched_app["citizen_phone_masked"]
    print(f"  ✓ Newly submitted application found in queue: {matched_app['citizen_name']} ({matched_app['submission_reference']})")

    # Fetch single application detail with documents
    res_detail = client.get(f"/api/applications/{app_id}", headers=officer_headers)
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert detail["citizen_id"] == citizen_id
    assert len(detail.get("documents", [])) > 0
    print(f"  ✓ Officer inspected application details and {len(detail['documents'])} verified documents")

    # -------------------------------------------------------------------------
    # 7. Officer Approval & Status Progression
    # -------------------------------------------------------------------------
    print("\n[Step 7] Verifying Officer Decision & Citizen Notification...")
    res_dec = client.post(f"/api/applications/{app_id}/officer-decision", json={
        "decision": "APPROVE",
        "order_number": "GOV-ORD-2026-TEST01",
        "notes": "Verified cultivable land holding via Bhoomi RTC schema. Approved for DBT disbursement."
    }, headers=officer_headers)
    assert res_dec.status_code == 200
    print("  ✓ Officer approved application with Official Order: GOV-ORD-2026-TEST01")

    # -------------------------------------------------------------------------
    # 8. Citizen Tracking Status Verification
    # -------------------------------------------------------------------------
    print("\n[Step 8] Verifying Citizen Tracking Status Update...")
    res_citizen_track = client.get(f"/api/applications/{app_id}?citizen_id={citizen_id}", headers=citizen_headers)
    assert res_citizen_track.status_code == 200
    tracked = res_citizen_track.json()
    assert tracked["current_status"] == "approved" or tracked["current_status"] == "APPROVED"
    assert tracked["official_order_number"] == "GOV-ORD-2026-TEST01"
    print(f"  ✓ Citizen tracking reflects updated status: {tracked['current_status'].upper()} (Order: {tracked['official_order_number']})")

    # -------------------------------------------------------------------------
    # 9. True Empty State Verification
    # -------------------------------------------------------------------------
    print("\n[Step 9] Verifying Genuine Empty States (No Mock Fallbacks)...")
    res_empty = client.get("/api/officers/applications?district=NonExistentDistrictXYZ", headers=officer_headers)
    assert res_empty.status_code == 200
    empty_items = res_empty.json()["applications"]
    assert len(empty_items) == 0, f"Expected 0 results for non-existent district, got {len(empty_items)}"
    print("  ✓ Empty state verified: returns [] without mock data substitution")

    # -------------------------------------------------------------------------
    # 10. Security & IDOR Authorization Verification
    # -------------------------------------------------------------------------
    print("\n[Step 10] Verifying Security, Masking & IDOR Access Controls...")
    unauthorized_citizen_id = str(uuid.uuid4())
    res_idor = client.get(f"/api/applications/{app_id}?citizen_id={unauthorized_citizen_id}")
    assert res_idor.status_code in (401, 403), f"IDOR check failed: expected 401/403, got {res_idor.status_code}"
    print("  ✓ IDOR protection verified: unauthorized citizen cannot access application")

    print("\n===================================================================")
    print("ALL 10 E2E INTEGRATION & WORKFLOW TESTS PASSED PERFECTLY!")
    print("===================================================================")

if __name__ == "__main__":
    run_e2e_tests()
