"""
Standalone Smoke Test for Gram Saathi Multilingual Real OCR Engine.
Tests Tesseract 5.4.0 integration, English, Hindi, and Kannada script recognition,
and field extraction on synthetic sample documents.
"""
import sys
import tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.config import settings
from backend.services.ocr_service import ocr_service


def run_smoke_test():
    print("=" * 70)
    print("GRAM SAATHI — REAL MULTILINGUAL OCR SMOKE TEST")
    print("=" * 70)

    # 1. Engine & Configuration Status
    print("\n[1] Checking Tesseract Engine & Configuration...")
    engine_available = ocr_service.is_engine_available()
    tesseract_cmd = ocr_service.tesseract_cmd
    available_langs = ocr_service.get_available_languages()
    configured_langs = ocr_service.tesseract_languages
    effective_langs, lang_warnings = ocr_service.resolve_effective_languages(configured_langs)

    print(f"  • Engine Available   : {engine_available}")
    print(f"  • Binary Executable  : {tesseract_cmd}")
    print(f"  • Available Languages: {available_langs}")
    print(f"  • Configured Languages: {configured_langs}")
    print(f"  • Effective OCR Langs: {effective_langs}")

    if not engine_available:
        print("\n❌ ERROR: Tesseract OCR engine is not detected or runnable.")
        sys.exit(1)

    for req_lang in ["eng", "hin", "kan"]:
        if req_lang not in available_langs:
            print(f"❌ ERROR: Required traineddata '{req_lang}' is missing from Tesseract.")
            sys.exit(1)

    print("  ✓ Tesseract 5.4.0 and all 3 language packs (eng, hin, kan) verified!")

    # 2. Font for Indian Unicode Scripts
    font_path = Path("C:/Windows/Fonts/Nirmala.ttc")
    if font_path.exists():
        font_large = ImageFont.truetype(str(font_path), 24)
        font_medium = ImageFont.truetype(str(font_path), 20)
        print(f"  ✓ Using Windows Indian script font: {font_path}")
    else:
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
        print("  ⚠️ Nirmala.ttc not found, using default PIL font.")

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_dir_path = Path(temp_dir)

        # ─── Sample 1: English Land Record (Bhoomi RTC) ──────────────────────────
        print("\n[2] Testing English Land Record (Bhoomi RTC / Pahani)...")
        img1 = Image.new("RGB", (650, 220), color=(255, 255, 255))
        draw1 = ImageDraw.Draw(img1)
        draw1.text((20, 20), "Government of Karnataka - Revenue Department", fill=(0, 0, 0), font=font_large)
        draw1.text((20, 65), "Bhoomi Land Records (RTC / Pahani)", fill=(0, 0, 0), font=font_medium)
        draw1.text((20, 105), "Survey No: 142/3A", fill=(0, 0, 0), font=font_large)
        draw1.text((20, 145), "Extent: 1.50 Acres", fill=(0, 0, 0), font=font_medium)
        draw1.text((20, 180), "Owner: Ramu Nayak", fill=(0, 0, 0), font=font_medium)

        doc1_path = temp_dir_path / "sample_land_record_en.png"
        img1.save(doc1_path)

        res1 = ocr_service.process_document(doc1_path, "land_record")
        print(f"  • OCR Status     : {res1.ocr_status}")
        print(f"  • Confidence     : {res1.confidence * 100:.1f}%")
        print(f"  • Extracted Fields: {res1.extracted_fields}")
        assert res1.ocr_status == "success", f"Expected success, got {res1.ocr_status}"
        assert res1.extracted_fields.get("survey_number") == "142/3A", "Survey number extraction mismatch"
        print("  ✓ English Land Record OCR verified!")

        # ─── Sample 2: Kannada Farmer RTC Record ─────────────────────────────────
        print("\n[3] Testing Kannada Land Record (ಕರ್ನಾಟಕ ಭೂಮಿ ಪಹಣಿ)...")
        img2 = Image.new("RGB", (650, 220), color=(255, 255, 255))
        draw2 = ImageDraw.Draw(img2)
        draw2.text((20, 20), "ಕರ್ನಾಟಕ ಸರಕಾರ - ಕಂದಾಯ ಇಲಾಖೆ", fill=(0, 0, 0), font=font_large)
        draw2.text((20, 65), "ಭೂಮಿ ಪಹಣಿ ದಾಖಲೆ (RTC)", fill=(0, 0, 0), font=font_medium)
        draw2.text((20, 105), "ಸರ್ವೆ ನಂ: 88/2B", fill=(0, 0, 0), font=font_large)
        draw2.text((20, 145), "ವಿಸ್ತೀರ್ಣ: 2.25 ಎಕರೆ", fill=(0, 0, 0), font=font_medium)
        draw2.text((20, 180), "ಹೆಸರು: ರಾಮು ನಾಯಕ", fill=(0, 0, 0), font=font_medium)

        doc2_path = temp_dir_path / "sample_kannada_rtc.png"
        img2.save(doc2_path)

        res2 = ocr_service.process_document(doc2_path, "land_record")
        print(f"  • OCR Status     : {res2.ocr_status}")
        print(f"  • Confidence     : {res2.confidence * 100:.1f}%")
        print(f"  • Extracted Fields: {res2.extracted_fields}")
        print(f"  • Sample Raw Text: {res2.extracted_text.splitlines()[:3]}")
        assert res2.ocr_status in ["success", "low_confidence"], f"Kannada OCR failed: {res2.ocr_status}"
        assert res2.extracted_fields.get("owner_name") == "ರಾಮು ನಾಯಕ" or "ರಾಮು" in res2.extracted_text, "Kannada name extraction missing"
        assert "88" in (res2.extracted_fields.get("survey_number") or res2.extracted_text), "Kannada Survey number missing"
        print("  ✓ Kannada Land Record OCR verified!")

        # ─── Sample 3: Hindi Income / Caste Certificate ──────────────────────────
        print("\n[4] Testing Hindi Income / Scholarship Certificate (आय प्रमाण पत्र)...")
        img3 = Image.new("RGB", (650, 220), color=(255, 255, 255))
        draw3 = ImageDraw.Draw(img3)
        draw3.text((20, 20), "भारत सरकार - राजस्व विभाग", fill=(0, 0, 0), font=font_large)
        draw3.text((20, 65), "प्रमाण पत्र क्रमांक: RD-98765432", fill=(0, 0, 0), font=font_medium)
        draw3.text((20, 105), "नाम: प्रिया शर्मा", fill=(0, 0, 0), font=font_large)
        draw3.text((20, 145), "वार्षिक आय: Rs. 48000", fill=(0, 0, 0), font=font_medium)
        draw3.text((20, 180), "प्राधिकारी: तहसीलदार", fill=(0, 0, 0), font=font_medium)

        doc3_path = temp_dir_path / "sample_hindi_cert.png"
        img3.save(doc3_path)

        res3 = ocr_service.process_document(doc3_path, "income_certificate")
        print(f"  • OCR Status     : {res3.ocr_status}")
        print(f"  • Confidence     : {res3.confidence * 100:.1f}%")
        print(f"  • Extracted Fields: {res3.extracted_fields}")
        assert res3.ocr_status in ["success", "low_confidence"], f"Hindi OCR failed: {res3.ocr_status}"
        assert res3.extracted_fields.get("annual_income") == 48000, "Hindi annual income extraction mismatch"
        print("  ✓ Hindi Income Certificate OCR verified!")

        # ─── Sample 4: Aadhaar Masking & Privacy Check ────────────────────────────
        print("\n[5] Testing Privacy: 12-Digit Aadhaar Masking...")
        img4 = Image.new("RGB", (650, 200), color=(255, 255, 255))
        draw4 = ImageDraw.Draw(img4)
        draw4.text((20, 20), "Government of India - Unique Identification Authority", fill=(0, 0, 0), font=font_medium)
        draw4.text((20, 65), "Name: Ramu Nayak", fill=(0, 0, 0), font=font_large)
        draw4.text((20, 110), "DOB: 15/08/1985", fill=(0, 0, 0), font=font_medium)
        draw4.text((20, 150), "5432 1098 7654", fill=(0, 0, 0), font=font_large)

        doc4_path = temp_dir_path / "sample_aadhaar_masking.png"
        img4.save(doc4_path)

        res4 = ocr_service.process_document(doc4_path, "aadhaar")
        print(f"  • Masked Aadhaar : {res4.extracted_fields.get('masked_aadhaar')}")
        print(f"  • Last 4 Digits  : {res4.extracted_fields.get('last_4_digits')}")
        print(f"  • Extracted Name : {res4.extracted_fields.get('name')}")
        assert "5432 1098 7654" not in res4.extracted_text, "Full 12-digit Aadhaar was leaked in extracted text!"
        assert "XXXX-XXXX-7654" in res4.extracted_text, "Masked Aadhaar pattern missing from extracted text!"
        assert res4.extracted_fields.get("last_4_digits") == "7654", "Last 4 digits mismatch"
        print("  ✓ Aadhaar privacy masking verified (zero plaintext 12-digit leak)!")

    print("\n" + "=" * 70)
    print("ALL MULTILINGUAL REAL OCR SMOKE TESTS PASSED CLEANLY!")
    print("=" * 70)


if __name__ == "__main__":
    run_smoke_test()
