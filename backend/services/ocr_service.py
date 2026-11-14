"""
Local OCR and document field extraction service for Gram Saathi.
Processes citizen documents locally using pytesseract and Pillow.

Strict Privacy & Security Enforcement:
- Aadhaar: Only the last 4 digits are extracted/stored. Never store or log full 12 digits.
- Never send document bytes, raw scans, or raw OCR text to Gemini.
- Runs locally and deterministically.
- Supports English (eng), Hindi (hin), and Kannada (kan).
"""
from __future__ import annotations

import logging
import os
import re
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from backend.config import settings

logger = logging.getLogger(__name__)

try:
    from PIL import Image, ImageOps, ImageEnhance
    PILLOW_AVAILABLE = True
except ImportError:
    Image = None  # type: ignore
    ImageOps = None  # type: ignore
    ImageEnhance = None  # type: ignore
    PILLOW_AVAILABLE = False

try:
    import pytesseract
    PYTESSERACT_AVAILABLE = True
except ImportError:
    pytesseract = None  # type: ignore
    PYTESSERACT_AVAILABLE = False


@dataclass
class OCRResult:
    extracted_fields: Dict[str, Any] = field(default_factory=dict)
    confidence: float = 0.0
    ocr_status: str = "unavailable"  # "success" | "low_confidence" | "failed" | "unavailable"
    warnings: List[str] = field(default_factory=list)
    extracted_text: Optional[str] = None
    language_used: Optional[str] = None


class OCRService:
    def __init__(
        self,
        tesseract_cmd: Optional[str] = None,
        default_languages: Optional[str] = None,
    ) -> None:
        self.tesseract_cmd = tesseract_cmd or settings.resolved_tesseract_cmd or os.environ.get("TESSERACT_CMD")
        self.default_languages = default_languages or settings.tesseract_languages or os.environ.get("TESSERACT_LANGUAGES", "eng+hin+kan")
        self._configure_pytesseract()

    def _configure_pytesseract(self) -> None:
        """Point pytesseract to the configured binary path if available."""
        if self.tesseract_cmd and PYTESSERACT_AVAILABLE:
            pytesseract.pytesseract.tesseract_cmd = self.tesseract_cmd

    @property
    def tesseract_languages(self) -> str:
        return self.default_languages

    def is_engine_available(self) -> bool:
        """Check whether the Tesseract OCR engine executable is installed and runnable."""
        if not PYTESSERACT_AVAILABLE:
            return False
        self._configure_pytesseract()
        try:
            ver = pytesseract.get_tesseract_version()
            return bool(ver)
        except Exception:
            return False

    def get_available_languages(self) -> List[str]:
        """Query Tesseract for installed traineddata languages."""
        if not self.is_engine_available():
            return []
        try:
            return pytesseract.get_languages(config="")
        except Exception as e:
            logger.warning("Failed to query Tesseract languages: %s", e)
            return []

    def resolve_effective_languages(self, requested_langs: Optional[str] = None) -> Tuple[Optional[str], List[str]]:
        """
        Match requested languages against installed language models.
        Returns: (effective_lang_string, warnings_list)
        """
        req_str = requested_langs or self.default_languages
        if not req_str:
            return "eng", []

        available = self.get_available_languages()
        if not available:
            # If language check is unavailable, return requested string directly
            return req_str, []

        requested_list = [l.strip() for l in req_str.split("+") if l.strip()]
        matched = [l for l in requested_list if l in available]
        missing = [l for l in requested_list if l not in available]

        warnings: List[str] = []
        if missing:
            warnings.append(f"Requested OCR language data missing: {', '.join(missing)}. Available: {', '.join(available)}")

        if not matched:
            # Fall back to first available or 'eng'
            fallback = "eng" if "eng" in available else available[0]
            warnings.append(f"None of requested languages ({req_str}) installed. Falling back to '{fallback}'.")
            return fallback, warnings

        return "+".join(matched), warnings

    @staticmethod
    def _mask_aadhaar_text(text: str) -> str:
        """Replace any potential 12-digit number sequence with masked format XXXX-XXXX-1234."""
        # Match spaced 12-digit on a single line: 1234 5678 9012
        text = re.sub(r"\b\d{4}[ \t]+\d{4}[ \t]+(\d{4})\b", r"XXXX-XXXX-\1", text)
        # Match contiguous 12-digit: 123456789012
        text = re.sub(r"\b\d{8}(\d{4})\b", r"XXXX-XXXX-\1", text)
        return text

    def _extract_aadhaar_fields(self, raw_text: str) -> Dict[str, Any]:
        """
        Extract last 4 digits, name, and DOB from Aadhaar card in English, Kannada, and Hindi.
        Privacy Rule: Never store full 12 digits.
        """
        fields: Dict[str, Any] = {}

        # 1. Last 4 digits ONLY (never 12 digits)
        last4_match = re.search(r"(?:[Xx]{4}[- \t]?[Xx]{4}[- \t]?|\b\d{4}[- \t]\d{4}[- \t]|\b\d{8})(\d{4})\b", raw_text)
        if last4_match:
            last4 = last4_match.group(1)
            fields["last_4_digits"] = last4
            fields["masked_aadhaar"] = f"XXXX-XXXX-{last4}"
        else:
            # Look for generic 4-digit cluster at end of Aadhaar pattern
            generic_cluster = re.findall(r"\b\d{4}\b", raw_text)
            if generic_cluster:
                last_cluster = generic_cluster[-1]
                fields["last_4_digits"] = last_cluster
                fields["masked_aadhaar"] = f"XXXX-XXXX-{last_cluster}"

        # 2. DOB / Year of Birth (Multilingual: English, Kannada, Hindi)
        dob_match = re.search(
            r"(?:DOB|Date\s*of\s*Birth|Year\s*of\s*Birth|ಜನ್ಮ\s*ದಿನಾಂಕ|ಹುಟ್ಟಿದ\s*ದಿನಾಂಕ|ತಾರೀಖು|जन्म\s*तिथि|जन्म\s*वर्ष)[:\s]*([0-3]?[0-9][/-][0-1]?[0-9][/-][12][90]\d{2}|\b[12][90]\d{2}\b)",
            raw_text,
            re.IGNORECASE,
        )
        if dob_match:
            fields["dob"] = dob_match.group(1).strip()

        # 3. Name (Multilingual Unicode support: English, Kannada, Hindi)
        name_match = re.search(
            r"(?:Name|ಹೆಸರು|नाम)[:\s]+([A-Za-z\u0C80-\u0CFF\u0900-\u097F .]{2,50})",
            raw_text,
            re.IGNORECASE,
        )
        if name_match:
            candidate_name = name_match.group(1).splitlines()[0].strip()
            # Clean unwanted header matches
            lower_cand = candidate_name.lower()
            if not any(hdr in lower_cand for hdr in ("government", "india", "authority", "ಸರ್ಕಾರ", "ಭಾರತ", "सरकार", "पहचान")):
                fields["name"] = candidate_name.strip()
        else:
            # Fallback: scan lines for potential personal name in Latin, Kannada, or Devanagari script
            lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
            for line in lines:
                lower_line = line.lower()
                if any(hdr in lower_line for hdr in ("government", "india", "unique", "identification", "enrollment", "male", "female", "year", "dob", "ಸರ್ಕಾರ", "ಭಾರತ", "ಸರ್ಕಾರದ", "ಆಧಾರ್", "ಆಧಾರ", "ಆರಂಭ", "ಆಧಾರ್‌", "सरकार", "भारत")):
                    continue
                # Line of 2 to 4 words with typical name length
                words = line.split()
                if 1 <= len(words) <= 4 and 3 <= len(line) <= 40:
                    if re.match(r"^[A-Za-z\u0C80-\u0CFF\u0900-\u097F\s.]+$", line):
                        fields["name"] = line
                        break

        # 4. Gender (Multilingual)
        gender_match = re.search(
            r"(?:Gender|ಲಿಂಗ|लिंग)[:\s]*(Male|Female|Transgender|ಪುರುಷ|ಮಹಿಳೆ|ಗಂಡು|ಹೆಣ್ಣು|पुरुष|महिला)",
            raw_text,
            re.IGNORECASE,
        )
        if gender_match:
            g_raw = gender_match.group(1).strip()
            if g_raw in ("Male", "ಪುರುಷ", "ಗಂಡು", "पुरुष"):
                fields["gender"] = "Male"
            elif g_raw in ("Female", "ಮಹಿಳೆ", "ಹೆಣ್ಣು", "महिला"):
                fields["gender"] = "Female"
            else:
                fields["gender"] = g_raw

        return fields

    def _extract_land_record_fields(self, raw_text: str) -> Dict[str, Any]:
        """
        Extract survey number, area/extent, and owner from Land Record (RTC / Bhoomi / Pahani)
        supporting English, Kannada (ಭೂಮಿ ಪಹಣಿ), and Hindi (खतौनी).
        """
        fields: Dict[str, Any] = {}

        # Survey number
        survey_match = re.search(
            r"(?:Survey\s*(?:No|Number|\.)?|Sy\.?\s*No\.?|ಸರ್ವೆ\s*ನಂ|ಸರೆವೆ\s*ನಂ|ಸರ್ವೆ\s*ಸಂಖ್ಯೆ|ಹಿಸ್ಸಾ\s*ನಂ|ಸರ್ವೆ|ಸರೆವೆ|सर्वे\s*नं|खसरा\s*नं|गाटा\s*संख्या)[:\s]*([0-9]+(?:[/-][0-9A-Za-z*]+)?)",
            raw_text,
            re.IGNORECASE,
        )
        if survey_match:
            fields["survey_number"] = survey_match.group(1).strip()

        # Area / Extent
        area_match = re.search(
            r"(?:Area|Extent|Acres?|Guntha|Hectares?|ವಿಸ್ತೀರ್ಣ|ವೆಸತತೀರಣ|ವಿಸ್ತಾರ|ಎಕರೆ|ಗುಂಟೆ|क्षेत्रफल|एकड़|हेक्टेयर)[:\s]*([0-9]+(?:\.[0-9]+)?(?:\s*(?:Acres?|Guntas?|Ha|cents?|ಎಕರೆ|ಗುಂಟೆ|एकड़|हेक्टेयर))?)",
            raw_text,
            re.IGNORECASE,
        )
        if area_match:
            fields["area"] = area_match.group(1).strip()

        # Owner / Pattadar / Khatadar name
        owner_match = re.search(
            r"(?:Owner|Pattadar|Khatadar|Farmer|Name|ಖಾತೆದಾರ|ಮಾಲೀಕ|ಹಿಡುವಳಿದಾರ|ಹೆಸರು|ಕಬ್ದೇದಾರ|खातेदार|भूस्वामी|नाम)[:\s]+([A-Za-z\u0C80-\u0CFF\u0900-\u097F .]{2,50})",
            raw_text,
            re.IGNORECASE,
        )
        if owner_match:
            cand = owner_match.group(1).splitlines()[0].strip()
            if not any(hdr in cand.lower() for hdr in ("department", "revenue", "karnataka", "bhoomi", "ಕಂದಾಯ", "ಇಲಾಖೆ")):
                fields["owner_name"] = cand

        return fields

    def _extract_income_certificate_fields(self, raw_text: str) -> Dict[str, Any]:
        """
        Extract annual income, authority, and certificate number in English, Kannada, and Hindi.
        """
        fields: Dict[str, Any] = {}

        # Income amount
        income_match = re.search(
            r"(?:Annual\s*Income|Income|Rs\.?|INR|ಆದಾಯ|ವಾರ್ಷಿಕ\s*ಆದಾಯ|आय|वार्षिक\s*आय)[:\s]*(?:Rs\.?|INR|₹)?\s*([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]{2})?|\b[0-9]{4,8}\b|[0-9]{1,6}(?:\.[0-9]{2})?)",
            raw_text,
            re.IGNORECASE,
        )
        if income_match:
            val_clean = income_match.group(1).replace(",", "").strip()
            try:
                fields["annual_income"] = int(float(val_clean))
            except ValueError:
                fields["annual_income"] = val_clean

        # Issuing authority
        auth_prefix = re.search(
            r"(?:Issuing\s*Authority|Designation|Authority|ಅಧಿಕಾರಿ|ಪ್ರಾಧಿಕಾರ|प्राधिकारी)[:\s]*([A-Za-z\u0C80-\u0CFF\u0900-\u097F\s]{3,40})",
            raw_text,
            re.IGNORECASE,
        )
        if auth_prefix:
            fields["issuing_authority"] = auth_prefix.group(1).split(",")[0].strip()
        else:
            auth_match = re.search(
                r"\b(Tahsildar|Revenue\s*Inspector|Assistant\s*Commissioner|ತಹಶೀಲ್ದಾರ್|ಕಂದಾಯ\s*ನಿರೀಕ್ಷಕರು|तहसीलदार|राजस्व\s*निरीक्षक)\b",
                raw_text,
                re.IGNORECASE,
            )
            if auth_match:
                fields["issuing_authority"] = auth_match.group(0).strip()

        # Certificate / RD number
        cert_match = re.search(
            r"(?:Certificate\s*No|RD\s*No|Bar\s*Code|ಪ್ರಮಾಣಪತ್ರ\s*ಸಂಖ್ಯೆ|ಆರ್‌ಡಿ\s*ಸಂಖ್ಯೆ|प्रमाण\s*पत्र\s*क्रमांक)[:\s]*([A-Za-z0-9/-]{6,30})",
            raw_text,
            re.IGNORECASE,
        )
        if cert_match:
            fields["certificate_number"] = cert_match.group(1).strip()

        # Name
        name_match = re.search(
            r"(?:Name|Applicant\s*Name|ಹೆಸರು|ಅರ್ಜಿದಾರರ\s*ಹೆಸರು|नाम|आवेदक\s*का\s*नाम)[:\s]*([A-Za-z\u0C80-\u0CFF\u0900-\u097F\s]{3,40})",
            raw_text,
            re.IGNORECASE,
        )
        if name_match:
            fields["applicant_name"] = name_match.group(1).split("\n")[0].strip()

        return fields

    def _extract_caste_certificate_fields(self, raw_text: str) -> Dict[str, Any]:
        """
        Extract caste category, RD certificate number, authority, and applicant name.
        """
        fields: Dict[str, Any] = {}

        # RD / Certificate number
        cert_match = re.search(
            r"(?:RD\s*No|Certificate\s*No|RD|Bar\s*Code|ಆರ್‌ಡಿ\s*ಸಂಖ್ಯೆ|ಪ್ರಮಾಣಪತ್ರ\s*ಸಂಖ್ಯೆ|प्रमाण\s*पत्र\s*क्रमांक)[:\s]*([A-Za-z0-9/-]{6,30})",
            raw_text,
            re.IGNORECASE,
        )
        if cert_match:
            fields["certificate_number"] = cert_match.group(1).strip()

        # Caste / Social Category
        category_match = re.search(
            r"(?:Category|Caste|Sub-Caste|ಪ್ರವರ್ಗ|ಜಾತಿ|ವರ್ಗ|जाति|श्रेणी)[:\s]*([A-Za-z0-9\u0C80-\u0CFF\u0900-\u097F\s-]{2,30})",
            raw_text,
            re.IGNORECASE,
        )
        if category_match:
            fields["caste_category"] = category_match.group(1).split("\n")[0].strip()
        else:
            cat_direct = re.search(
                r"\b(Category\s*[123][AB]?|Cat-?[123][AB]?|SC|ST|OBC|2A|2B|3A|3B|ಪ್ರವರ್ಗ-?[123][AB]?|ಪರಿಶಿಷ್ಟ\s*ಜಾತಿ|ಪರಿಶಿಷ್ಟ\s*ಪಂಗಡ|अनुसूचित\s*जाति|अनुसूचित\s*जनजाति)\b",
                raw_text,
                re.IGNORECASE,
            )
            if cat_direct:
                fields["caste_category"] = cat_direct.group(0).strip()

        # Name
        name_match = re.search(
            r"(?:Name|Applicant\s*Name|Student\s*Name|ಹೆಸರು|ಅರ್ಜಿದಾರರ\s*ಹೆಸರು|नाम|आवेदक\s*का\s*नाम)[:\s]*([A-Za-z\u0C80-\u0CFF\u0900-\u097F\s]{3,40})",
            raw_text,
            re.IGNORECASE,
        )
        if name_match:
            fields["applicant_name"] = name_match.group(1).split("\n")[0].strip()

        # Authority
        auth_match = re.search(
            r"\b(Tahsildar|Revenue\s*Inspector|Assistant\s*Commissioner|ತಹಶೀಲ್ದಾರ್|ಕಂದಾಯ\s*ನಿರೀಕ್ಷಕರು|तहसीलदार|राजस्व\s*निरीक्षक)\b",
            raw_text,
            re.IGNORECASE,
        )
        if auth_match:
            fields["issuing_authority"] = auth_match.group(0).strip()

        return fields

    def _extract_marks_card_fields(self, raw_text: str) -> Dict[str, Any]:
        """
        Extract student name, roll/registration number, marks/percentage, passing year, and board.
        """
        fields: Dict[str, Any] = {}

        # Student Name
        name_match = re.search(
            r"(?:Candidate\s*Name|Student\s*Name|Name|ವಿದ್ಯಾರ್ಥಿ\s*ಹೆಸರು|ಹೆಸರು|छात्र\s*का\s*नाम|नाम)[:\s]*([A-Za-z\u0C80-\u0CFF\u0900-\u097F\s]{3,40})",
            raw_text,
            re.IGNORECASE,
        )
        if name_match:
            fields["student_name"] = name_match.group(1).split("\n")[0].strip()

        # Registration / Roll Number
        reg_match = re.search(
            r"(?:Reg(?:istration)?\.?\s*No|Roll\s*No|Register\s*Number|ನೋಂದಣಿ\s*ಸಂಖ್ಯೆ|ಕ್ರಮ\s*ಸಂಖ್ಯೆ|अनुक्रमांक|पंजीकरण\s*संख्या)[:\s]*([A-Za-z0-9/-]{5,25})",
            raw_text,
            re.IGNORECASE,
        )
        if reg_match:
            fields["registration_number"] = reg_match.group(1).strip()

        # Percentage or Marks
        pct_match = re.search(
            r"(?:Percentage|Percent|Marks|Aggregate|Total|ಅಂಕಗಳು|ಶೇಕಡಾ|प्रतिशत|कुल\s*अंक)[:\s]*([0-9]{1,3}(?:\.[0-9]{1,2})?%?|[0-9]{2,4}\s*/\s*[0-9]{2,4})",
            raw_text,
            re.IGNORECASE,
        )
        if pct_match:
            fields["percentage"] = pct_match.group(1).strip()

        # Passing Year
        year_match = re.search(
            r"(?:Year|Passing\s*Year|Month\s*&\s*Year|ವರ್ಷ|ಉತ್ತೀರ್ಣ\s*ವರ್ಷ|वर्ष)[:\s]*(20[12][0-9])",
            raw_text,
            re.IGNORECASE,
        )
        if year_match:
            fields["passing_year"] = year_match.group(1).strip()

        # Board or University
        board_match = re.search(
            r"\b(KSEEB|KSEAB|DPUE|CBSE|ICSE|VTU|Bangalore\s*University|ಮಂಡಳಿ|ವಿಶ್ವವಿದ್ಯಾಲಯ|बोर्ड)\b",
            raw_text,
            re.IGNORECASE,
        )
        if board_match:
            fields["board_or_university"] = board_match.group(0).strip()

        return fields

    def _extract_bank_passbook_fields(self, raw_text: str) -> Dict[str, Any]:
        """
        Extract bank name, branch, and account holder name. Never store raw bank account number.
        """
        fields: Dict[str, Any] = {"has_bank_account": True}

        # Account holder name
        holder_match = re.search(
            r"(?:Account\s*Holder(?:\s*Name)?|Name|ಖಾತೆದಾರರ\s*ಹೆಸರು|ಹೆಸರು|खाताधारक\s*का\s*नाम|नाम)[:\s]*([A-Za-z\u0C80-\u0CFF\u0900-\u097F\s]{3,40})",
            raw_text,
            re.IGNORECASE,
        )
        if holder_match:
            fields["account_holder_name"] = holder_match.group(1).split("\n")[0].strip()

        # Bank Name
        bank_match = re.search(
            r"\b(State\s*Bank\s*of\s*India|SBI|Canara\s*Bank|Bank\s*of\s*Baroda|Union\s*Bank|Karnataka\s*Bank|HDFC|ICICI|Punjab\s*National\s*Bank|Apex\s*Bank|DCCB|Gramin\s*Bank|ಕೆನರಾ\s*ಬ್ಯಾಂಕ್|ಸ್ಟೇಟ್\s*ಬ್ಯಾಂಕ್|केनरा\s*बैंक|भारतीय\s*स्टेट\s*बैंक)\b",
            raw_text,
            re.IGNORECASE,
        )
        if bank_match:
            fields["bank_name"] = bank_match.group(0).strip()

        # Branch
        branch_match = re.search(
            r"(?:Branch|ಶಾಖೆ|शाखा)[:\s]*([A-Za-z\u0C80-\u0CFF\u0900-\u097F\s]{3,30})",
            raw_text,
            re.IGNORECASE,
        )
        if branch_match:
            fields["branch_name"] = branch_match.group(1).split("\n")[0].strip()

        return fields

    def process_document(
        self,
        file_path: str | Path,
        document_type: str = "other",
        languages: Optional[str] = None,
    ) -> OCRResult:
        """
        Process a saved document image locally using Tesseract OCR.
        Applies multilingual model selection, EXIF rotation handling, quality pre-processing,
        calculates word confidence, and extracts structured fields.
        Returns structured OCRResult.
        """
        path = Path(file_path).resolve()
        if not path.exists():
            return OCRResult(
                ocr_status="failed",
                confidence=0.0,
                warnings=[f"Document file not found: {path.name}"],
            )

        if not PYTESSERACT_AVAILABLE or not PILLOW_AVAILABLE:
            return OCRResult(
                ocr_status="unavailable",
                confidence=0.0,
                warnings=["pytesseract or Pillow is not installed on this system."],
            )

        self._configure_pytesseract()

        # Check binary availability
        if not self.is_engine_available():
            return OCRResult(
                ocr_status="unavailable",
                confidence=0.0,
                warnings=[
                    f"Tesseract OCR executable not found or not executable. "
                    f"Configured path: '{self.tesseract_cmd or 'none'}'. "
                    f"Please verify TESSERACT_CMD or system PATH."
                ],
            )

        # Resolve effective language string
        effective_langs, lang_warnings = self.resolve_effective_languages(languages)

        doc_type_clean = document_type.strip().lower()
        suffix = path.suffix.lower()

        # PDF handling note
        if suffix == ".pdf":
            return OCRResult(
                ocr_status="unavailable",
                confidence=0.0,
                warnings=["PDF rasterizer not configured for local Tesseract. Image formats (PNG/JPEG) recommended."],
            )

        try:
            with Image.open(path) as img:
                # 1. Correct mobile photo rotation via EXIF tags
                try:
                    img = ImageOps.exif_transpose(img)
                except Exception:
                    pass

                # 2. Convert to RGB or Grayscale
                if img.mode not in ("RGB", "L"):
                    img = img.convert("RGB")

                # 3. Upscale low-resolution images for higher OCR character clarity
                w, h = img.size
                if w < 800 or h < 800:
                    scale_factor = max(1.5, 1200 / max(w, h, 1))
                    if scale_factor > 1.0 and scale_factor <= 4.0:
                        new_w = int(w * scale_factor)
                        new_h = int(h * scale_factor)
                        resample_filter = getattr(Image, "Resampling", Image).LANCZOS
                        img = img.resize((new_w, new_h), resample=resample_filter)

                # 4. Extract word confidences
                try:
                    data = pytesseract.image_to_data(
                        img,
                        lang=effective_langs,
                        output_type=pytesseract.Output.DICT,
                    )
                    confidences: List[float] = []
                    for conf in data.get("conf", []):
                        try:
                            c_val = float(conf)
                            if c_val >= 0:
                                confidences.append(c_val)
                        except (ValueError, TypeError):
                            continue
                    avg_conf_pct = sum(confidences) / len(confidences) if confidences else 0.0
                    normalized_confidence = round(avg_conf_pct / 100.0, 2)
                except Exception as exc_data:
                    logger.debug("image_to_data failed: %s; setting fallback confidence", exc_data)
                    normalized_confidence = 0.50

                # 5. Extract text
                extracted_text = pytesseract.image_to_string(img, lang=effective_langs)

        except Exception as e:
            logger.warning("Local Tesseract OCR processing failed for file: %s", type(e).__name__)
            is_eng_err = "tesseract" in str(e).lower() or not self.is_engine_available()
            return OCRResult(
                ocr_status="unavailable" if is_eng_err else "failed",
                confidence=0.0,
                warnings=[f"OCR engine failed or file corrupt: {e}"],
            )

        # Sanitize text: mask any 12-digit Aadhaar number sequence
        masked_text = self._mask_aadhaar_text(extracted_text or "")
        clean_stripped = masked_text.strip()

        # Check for completely blank or empty image extraction
        if not clean_stripped:
            return OCRResult(
                extracted_fields={},
                confidence=0.0,
                ocr_status="failed",
                warnings=["No legible text could be extracted from the uploaded document image."] + lang_warnings,
                extracted_text="",
                language_used=effective_langs,
            )

        # Extract structured fields depending on document type
        extracted_fields: Dict[str, Any] = {}
        if "aadhaar" in doc_type_clean or "identity" in doc_type_clean:
            extracted_fields = self._extract_aadhaar_fields(clean_stripped)
        elif any(k in doc_type_clean for k in ("land", "rtc", "pahani", "bhoomi")):
            extracted_fields = self._extract_land_record_fields(clean_stripped)
        elif "caste" in doc_type_clean:
            extracted_fields = self._extract_caste_certificate_fields(clean_stripped)
        elif "income" in doc_type_clean:
            extracted_fields = self._extract_income_certificate_fields(clean_stripped)
        elif any(k in doc_type_clean for k in ("mark", "score", "grade", "sheet", "result")):
            extracted_fields = self._extract_marks_card_fields(clean_stripped)
        elif any(k in doc_type_clean for k in ("bank", "passbook", "cheque")):
            extracted_fields = self._extract_bank_passbook_fields(clean_stripped)
        else:
            # Generic field extraction: look for common attributes
            for extractor in (
                self._extract_aadhaar_fields,
                self._extract_land_record_fields,
                self._extract_caste_certificate_fields,
                self._extract_income_certificate_fields,
                self._extract_marks_card_fields,
                self._extract_bank_passbook_fields,
            ):
                part = extractor(clean_stripped)
                if part:
                    extracted_fields.update(part)

        warnings: List[str] = list(lang_warnings)
        if normalized_confidence >= 0.60:
            status = "success"
        elif normalized_confidence >= 0.10:
            status = "low_confidence"
            warnings.append("Document image has low OCR confidence. Text may be blurry, rotated, or indistinct.")
        else:
            status = "failed"
            warnings.append("Unable to extract legible text from the uploaded document.")

        # Privacy Safe Logging: never print extracted personal info, only metadata
        logger.info(
            "Local OCR processed document: status=%s, confidence=%.2f, lang=%s",
            status,
            normalized_confidence,
            effective_langs,
        )

        return OCRResult(
            extracted_fields=extracted_fields,
            confidence=normalized_confidence,
            ocr_status=status,
            warnings=warnings,
            extracted_text=masked_text,
            language_used=effective_langs,
        )


ocr_service = OCRService()
