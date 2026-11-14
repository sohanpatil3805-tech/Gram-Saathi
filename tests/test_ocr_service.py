"""
Tests for local OCR service, document upload pipeline integration,
and expanded scheme catalogue with document requirements.
"""
import io
import json
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from PIL import Image, ImageDraw
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.db.base import Base
from backend.db.models import Citizen, UploadedDocument
from backend.main import create_app
from backend.schemes.repository import SchemeRepository
from backend.schemes.discovery import SchemeDiscoveryService
from backend.services.ocr_service import OCRResult, OCRService, ocr_service
from backend.services.storage_service import StorageService


class OCRServiceTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.temp_path = Path(self.temp_dir.name)

    def tearDown(self):
        self.temp_dir.cleanup()

    def _create_test_image(self, filename: str = "test.png") -> Path:
        img_path = self.temp_path / filename
        img = Image.new("RGB", (200, 100), color=(255, 255, 255))
        draw = ImageDraw.Draw(img)
        draw.text((10, 10), "Test Sample", fill=(0, 0, 0))
        img.save(img_path)
        return img_path

    def test_ocr_unavailable_when_pytesseract_missing(self):
        img_path = self._create_test_image("test_unavail.png")
        service = OCRService()
        with patch("backend.services.ocr_service.PYTESSERACT_AVAILABLE", False):
            result = service.process_document(img_path, "aadhaar")
            self.assertEqual(result.ocr_status, "unavailable")
            self.assertEqual(result.confidence, 0.0)
            self.assertTrue(len(result.warnings) > 0)

    def test_ocr_unavailable_when_pytesseract_raises_exception(self):
        img_path = self._create_test_image("test_exc.png")
        service = OCRService()
        with patch("backend.services.ocr_service.pytesseract.image_to_string", side_effect=Exception("Tesseract engine not found")), \
             patch("backend.services.ocr_service.pytesseract.image_to_data", side_effect=Exception("Tesseract engine not found")):
            result = service.process_document(img_path, "aadhaar")
            self.assertEqual(result.ocr_status, "unavailable")
            self.assertEqual(result.confidence, 0.0)
            self.assertIn("Tesseract engine not found", result.warnings[0])

    def test_ocr_nonexistent_file_returns_failed(self):
        service = OCRService()
        result = service.process_document(self.temp_path / "does_not_exist.png", "aadhaar")
        self.assertEqual(result.ocr_status, "failed")
        self.assertEqual(result.confidence, 0.0)

    def test_aadhaar_extraction_never_stores_12_digits(self):
        """Privacy Rule: full 12-digit Aadhaar must NEVER be stored; only last 4 digits."""
        service = OCRService()
        img_path = self._create_test_image("aadhaar_mock.png")
        mock_raw_text = (
            "Government of India\n"
            "Name: Ramu Nayak\n"
            "DOB: 15/08/1985\n"
            "Gender: Male\n"
            "5432 1098 7654\n"
        )
        mock_data = {"conf": ["95", "90", "92", "88", "94"]}

        with patch("backend.services.ocr_service.pytesseract.image_to_string", return_value=mock_raw_text), \
             patch("backend.services.ocr_service.pytesseract.image_to_data", return_value=mock_data):
            result = service.process_document(img_path, "aadhaar")

            self.assertEqual(result.ocr_status, "success")
            self.assertGreaterEqual(result.confidence, 0.6)
            self.assertEqual(result.extracted_fields.get("last_4_digits"), "7654")
            self.assertEqual(result.extracted_fields.get("masked_aadhaar"), "XXXX-XXXX-7654")
            self.assertEqual(result.extracted_fields.get("name"), "Ramu Nayak")
            self.assertEqual(result.extracted_fields.get("dob"), "15/08/1985")

            # Verify that full 12 digits are NOT in extracted_fields
            for val in result.extracted_fields.values():
                self.assertNotIn("5432 1098 7654", str(val))
                self.assertNotIn("543210987654", str(val))

            # Verify that full 12 digits are masked in extracted_text
            self.assertNotIn("5432 1098 7654", result.extracted_text)
            self.assertIn("XXXX-XXXX-7654", result.extracted_text)

    def test_land_record_extraction(self):
        service = OCRService()
        img_path = self._create_test_image("land_mock.png")
        mock_raw_text = (
            "Karnataka Land Records (RTC)\n"
            "Survey No: 142/3A\n"
            "Extent: 2.50 Acres\n"
            "Owner: Ramu Nayak\n"
        )
        mock_data = {"conf": ["85", "88", "90", "82"]}

        with patch("backend.services.ocr_service.pytesseract.image_to_string", return_value=mock_raw_text), \
             patch("backend.services.ocr_service.pytesseract.image_to_data", return_value=mock_data):
            result = service.process_document(img_path, "land_record")

            self.assertEqual(result.ocr_status, "success")
            self.assertEqual(result.extracted_fields.get("survey_number"), "142/3A")
            self.assertEqual(result.extracted_fields.get("area"), "2.50 Acres")
            self.assertEqual(result.extracted_fields.get("owner_name"), "Ramu Nayak")

    def test_income_certificate_extraction(self):
        service = OCRService()
        img_path = self._create_test_image("income_mock.png")
        mock_raw_text = (
            "Revenue Department, Government of Karnataka\n"
            "RD No: RD0038472910\n"
            "Annual Income: Rs. 65,000\n"
            "Issuing Authority: Tahsildar, Belagavi\n"
        )
        mock_data = {"conf": ["80", "85", "78", "82"]}

        with patch("backend.services.ocr_service.pytesseract.image_to_string", return_value=mock_raw_text), \
             patch("backend.services.ocr_service.pytesseract.image_to_data", return_value=mock_data):
            result = service.process_document(img_path, "income_certificate")

            self.assertEqual(result.ocr_status, "success")
            self.assertEqual(result.extracted_fields.get("annual_income"), 65000)
            self.assertEqual(result.extracted_fields.get("issuing_authority"), "Tahsildar")
            self.assertEqual(result.extracted_fields.get("certificate_number"), "RD0038472910")

    def test_low_confidence_sets_warning_and_status(self):
        service = OCRService()
        img_path = self._create_test_image("blurry_mock.png")
        mock_raw_text = "unclear smudged characters"
        mock_data = {"conf": ["30", "25", "35"]}  # average 30% -> normalized 0.30

        with patch("backend.services.ocr_service.pytesseract.image_to_string", return_value=mock_raw_text), \
             patch("backend.services.ocr_service.pytesseract.image_to_data", return_value=mock_data):
            result = service.process_document(img_path, "land_record")

            self.assertEqual(result.ocr_status, "low_confidence")
            self.assertEqual(result.confidence, 0.30)
            self.assertTrue(any("blurry" in w.lower() for w in result.warnings))

    def test_missing_tesseract_executable(self):
        """Verify behavior when Tesseract executable path does not exist."""
        service = OCRService(tesseract_cmd="C:\\NonExistentDirectory\\tesseract.exe")
        self.assertFalse(service.is_engine_available())
        img_path = self._create_test_image("test_missing_cmd.png")
        result = service.process_document(img_path, "aadhaar")
        self.assertEqual(result.ocr_status, "unavailable")
        self.assertEqual(result.confidence, 0.0)
        self.assertTrue(any("not found" in w.lower() or "unavailable" in w.lower() for w in result.warnings))

    def test_missing_languages_resolution(self):
        """Verify language resolution filters out unsupported language codes."""
        service = OCRService()
        with patch.object(service, "get_available_languages", return_value=["eng", "hin", "kan"]):
            effective, _ = service.resolve_effective_languages("eng+fra+deu")
            self.assertEqual(effective, "eng")

            # Non-matching requested language falls back to available installed language
            fallback, _ = service.resolve_effective_languages("fra+ita")
            self.assertEqual(fallback, "eng")

    def test_corrupt_invalid_document_image(self):
        """Ensure corrupted or invalid image files fail gracefully without crashing."""
        corrupt_path = self.temp_path / "corrupt.png"
        corrupt_path.write_bytes(b"\x89PNG\r\n\x1a\nCorruptInvalidImageDataThatCannotBeParsedAsAnImage")
        service = OCRService()
        result = service.process_document(corrupt_path, "land_record")
        self.assertEqual(result.ocr_status, "failed")
        self.assertEqual(result.confidence, 0.0)
        self.assertTrue(len(result.warnings) > 0)

    def test_blank_or_empty_extraction(self):
        """Ensure completely blank/white images return failed status with empty warning."""
        blank_path = self.temp_path / "blank.png"
        blank_img = Image.new("RGB", (300, 200), color=(255, 255, 255))
        blank_img.save(blank_path)

        service = OCRService()
        result = service.process_document(blank_path, "land_record")
        # Empty text yields failed or low_confidence depending on engine
        self.assertIn(result.ocr_status, ["failed", "low_confidence", "unavailable"])
        if result.ocr_status == "failed":
            self.assertEqual(result.confidence, 0.0)

    def test_real_ocr_multilingual_smoke(self):
        """
        Smoke test with real installed Tesseract engine extracting English, Hindi,
        and Kannada text from a synthetic high-contrast image.
        """
        service = OCRService()
        if not service.is_engine_available():
            self.skipTest("Tesseract engine not installed or available on this system.")

        from PIL import ImageFont
        font_path = Path("C:/Windows/Fonts/Nirmala.ttc")
        if not font_path.exists():
            self.skipTest("Nirmala.ttc Indian script font not found on Windows.")

        font = ImageFont.truetype(str(font_path), 24)
        img = Image.new("RGB", (650, 220), color=(255, 255, 255))
        draw = ImageDraw.Draw(img)
        draw.text((20, 20), "Government of Karnataka", fill=(0, 0, 0), font=font)
        draw.text((20, 70), "Survey No: 142/3A", fill=(0, 0, 0), font=font)
        draw.text((20, 120), "ಹೆಸರು: ರಾಮು ನಾಯಕ", fill=(0, 0, 0), font=font)
        draw.text((20, 170), "नाम: रामू नायक", fill=(0, 0, 0), font=font)

        test_img_path = self.temp_path / "real_multilingual_sample.png"
        img.save(test_img_path)

        result = service.process_document(test_img_path, "land_record")
        self.assertEqual(result.ocr_status, "success")
        self.assertGreater(result.confidence, 0.5)
        self.assertIn("142/3A", result.extracted_text)
        self.assertEqual(result.extracted_fields.get("survey_number"), "142/3A")


class DocumentUploadAPITests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.temp_path = Path(self.temp_dir.name)
        self.storage_dir = self.temp_path / "documents"
        self.storage_dir.mkdir(parents=True, exist_ok=True)

        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
            echo=False,
        )
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        self.storage_patcher = patch(
            "backend.services.storage_service.settings.storage_path",
            new=self.temp_path,
        )
        self.storage_patcher.start()

        self.citizen = Citizen(phone_number="+919876543210", name="Test Citizen")
        self.db.add(self.citizen)
        self.db.commit()

        # FastAPI app with DB override
        app = create_app()
        from backend.db.session import get_db

        def override_get_db():
            db = self.Session()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self):
        self.storage_patcher.stop()
        self.db.close()
        self.engine.dispose()
        self.temp_dir.cleanup()

    def test_upload_returns_ocr_fields_in_response(self):
        # Create a valid PNG bytes in memory
        png_bytes = io.BytesIO()
        img = Image.new("RGB", (100, 50), color=(255, 255, 255))
        img.save(png_bytes, format="PNG")
        png_content = png_bytes.getvalue()

        # Mock OCR service to return simulated extraction
        mock_ocr = OCRResult(
            extracted_fields={"masked_aadhaar": "XXXX-XXXX-9999", "last_4_digits": "9999"},
            confidence=0.92,
            ocr_status="success",
            warnings=[],
            extracted_text="Aadhaar XXXX-XXXX-9999",
        )

        with patch("backend.services.ocr_service.ocr_service.process_document", return_value=mock_ocr):
            response = self.client.post(
                "/api/documents/upload",
                data={
                    "citizen_id": str(self.citizen.id),
                    "document_type": "aadhaar",
                },
                files={
                    "file": ("aadhaar.png", png_content, "image/png"),
                },
            )

        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["ocr_status"], "success")
        self.assertEqual(data["confidence_score"], 0.92)
        self.assertEqual(data["extracted_fields"]["masked_aadhaar"], "XXXX-XXXX-9999")
        self.assertEqual(data["extracted_fields"]["last_4_digits"], "9999")
        self.assertEqual(data["validation_status"], "VALID")

    def test_upload_still_succeeds_if_ocr_fails(self):
        """Non-blocking rule: upload must succeed even if OCR engine fails completely."""
        png_bytes = io.BytesIO()
        img = Image.new("RGB", (100, 50), color=(255, 255, 255))
        img.save(png_bytes, format="PNG")
        png_content = png_bytes.getvalue()

        with patch("backend.services.ocr_service.ocr_service.process_document", side_effect=Exception("OCR crash")):
            response = self.client.post(
                "/api/documents/upload",
                data={
                    "citizen_id": str(self.citizen.id),
                    "document_type": "land_record",
                },
                files={
                    "file": ("rtc.png", png_content, "image/png"),
                },
            )

        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["ocr_status"], "failed")
        self.assertIsNotNone(data["id"])

    def test_get_ocr_status_endpoint(self):
        """Verify GET /api/documents/ocr-status returns engine availability and languages."""
        response = self.client.get("/api/documents/ocr-status")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("engine_available", data)
        self.assertIn("available_languages", data)
        self.assertIn("configured_languages", data)
        self.assertIn("effective_languages", data)

    def test_citizen_correction_workflow_endpoint(self):
        """
        Verify citizen can confirm and correct extracted OCR fields via
        POST /api/documents/{document_id}/confirm
        """
        png_bytes = io.BytesIO()
        img = Image.new("RGB", (100, 50), color=(255, 255, 255))
        img.save(png_bytes, format="PNG")

        mock_ocr = OCRResult(
            extracted_fields={"survey_number": "142/3A", "owner_name": "Ramu"},
            confidence=0.75,
            ocr_status="success",
            warnings=[],
            extracted_text="Survey No: 142/3A Owner: Ramu",
        )

        with patch("backend.services.ocr_service.ocr_service.process_document", return_value=mock_ocr):
            up_resp = self.client.post(
                "/api/documents/upload",
                data={
                    "citizen_id": str(self.citizen.id),
                    "document_type": "land_record",
                },
                files={
                    "file": ("rtc.png", png_bytes.getvalue(), "image/png"),
                },
            )
        self.assertEqual(up_resp.status_code, 201)
        doc_id = up_resp.json()["id"]

        # Confirm and correct fields
        confirm_payload = {
            "citizen_id": str(self.citizen.id),
            "confirmed_fields": {
                "survey_number": "142/3A",
                "owner_name": "Ramu Nayak",
                "area": "1.5 Acres",
            },
            "notes": "Corrected owner full name and specified land area",
        }
        confirm_resp = self.client.post(f"/api/documents/{doc_id}/confirm", json=confirm_payload)
        self.assertEqual(confirm_resp.status_code, 200)
        conf_data = confirm_resp.json()
        self.assertTrue(conf_data["is_confirmed_by_user"])
        self.assertEqual(conf_data["validation_status"], "CONFIRMED")
        self.assertEqual(conf_data["confirmed_fields"]["owner_name"], "Ramu Nayak")
        self.assertEqual(conf_data["confirmation_notes"], "Corrected owner full name and specified land area")

        # Verify unauthorized citizen cannot confirm another citizen's document
        diff_citizen_id = str(uuid.uuid4())
        bad_confirm_resp = self.client.post(
            f"/api/documents/{doc_id}/confirm",
            json={"citizen_id": diff_citizen_id, "confirmed_fields": {"name": "Hacker"}},
        )
        self.assertEqual(bad_confirm_resp.status_code, 403)

        # Verify non-existent document returns 404
        missing_id = str(uuid.uuid4())
        not_found_resp = self.client.post(
            f"/api/documents/{missing_id}/confirm",
            json={"citizen_id": str(self.citizen.id), "confirmed_fields": {}},
        )
        self.assertEqual(not_found_resp.status_code, 404)


class SchemeRepositoryExpandedTests(unittest.TestCase):
    def setUp(self):
        self.repo = SchemeRepository("database/schemes.json")
        self.repo.load()

    def test_expanded_schemes_all_present(self):
        """Verify the 6 verified Indian government schemes exist in the repository."""
        required_scheme_ids = [
            "PM_KISAN",
            "NSP_PRE_MATRIC",
            "NSP_POST_MATRIC",
            "PMAY_G",
            "PMMY_MUDRA",
            "PM_JAY",
            "APY_PENSION",
        ]
        all_ids = {s["scheme_id"] for s in self.repo.all_schemes()}
        for req_id in required_scheme_ids:
            self.assertIn(req_id, all_ids, f"Scheme {req_id} missing from catalogue.")

    def test_schemes_have_synthetic_demo_status(self):
        """Verification rule: Valid official or synthetic demo status."""
        for scheme in self.repo.all_schemes():
            self.assertIn(
                scheme.get("verification_status"),
                ["SYNTHETIC_DEMO", "VERIFIED_OFFICIAL"],
                f"Scheme {scheme['scheme_id']} does not have valid verification status.",
            )

    def test_schemes_have_required_metadata(self):
        """Ensure official_url, important_dates, mandatory_documents, document_requirements exist."""
        for scheme in self.repo.all_schemes():
            scheme_id = scheme["scheme_id"]
            self.assertTrue(
                scheme.get("official_url") or scheme.get("official_urls"),
                f"Scheme {scheme_id} missing official_url.",
            )
            self.assertIn("important_dates", scheme, f"Scheme {scheme_id} missing important_dates.")
            self.assertIn("mandatory_documents", scheme, f"Scheme {scheme_id} missing mandatory_documents.")
            self.assertIn("document_requirements", scheme, f"Scheme {scheme_id} missing document_requirements.")

            if scheme.get("operational_status") != "DISCONTINUED":
                doc_reqs = scheme["document_requirements"]
                self.assertIsInstance(doc_reqs, list)
                self.assertGreater(len(doc_reqs), 0)
            for req in doc_reqs:
                self.assertIn("doc_type", req)
                self.assertIn("label_en", req)
                self.assertIn("label_kn", req)
                self.assertIn("label_hi", req)
                self.assertIn("mandatory", req)

    def test_repository_helper_methods(self):
        pm_kisan_reqs = self.repo.get_document_requirements("PM_KISAN")
        self.assertTrue(len(pm_kisan_reqs) >= 3)
        mandatory_docs = self.repo.get_mandatory_documents("PM_KISAN")
        self.assertIn("aadhaar", mandatory_docs)
        self.assertIn("land_record", mandatory_docs)
        self.assertIn("bank_passbook", mandatory_docs)

    def test_scheme_discovery_includes_document_requirements(self):
        service = SchemeDiscoveryService(self.repo)
        result = service.discover("farmers")
        self.assertGreaterEqual(result["candidate_count"], 1)

        pm_kisan = next(s for s in result["schemes"] if s["scheme_id"] == "PM_KISAN")
        self.assertIn("document_requirements", pm_kisan)
        self.assertIn("mandatory_documents", pm_kisan)
        self.assertIn("official_url", pm_kisan)
        self.assertIn("important_dates", pm_kisan)
        self.assertEqual(pm_kisan["verification_status"], "SYNTHETIC_DEMO")


if __name__ == "__main__":
    unittest.main()
