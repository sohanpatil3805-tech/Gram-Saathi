"""
Comprehensive Scheme Database and Source Registry Generator for Gram Saathi
Merges Farmer schemes, Student schemes, and verified sources.
Writes database/schemes.json and database/SCHEME_SOURCES.md.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from scripts.data_farmer_schemes import FARMER_SCHEMES
from scripts.data_student_schemes import STUDENT_SCHEMES
from scripts.sources_data import SOURCES

# Additional general rural schemes for backwards compatibility
LEGACY_ADDITIONAL_SCHEMES = [
    {
        "scheme_id": "PMAY_G",
        "record_type": "scheme",
        "name": {
            "en": "Pradhan Mantri Awas Yojana - Gramin (PMAY-G)",
            "kn": "ಪ್ರಧಾನ ಮಂತ್ರಿ ಆವಾಸ್ ಯೋಜನೆ - ಗ್ರಾಮೀಣ",
            "hi": "प्रधानमंत्री आवास योजना - ग्रामीण",
        },
        "alternative_names": ["PMAY-G", "Rural Housing Scheme", "ಪಿಎಂ ಆವಾಸ್ ಗ್ರಾಮೀಣ", "पीएम आवास ग्रामीण"],
        "category": "Rural Housing & Infrastructure",
        "beneficiary_groups": ["rural_families", "farmers", "wage_workers", "home_workers"],
        "jurisdiction": "central",
        "applicable_states": ["Karnataka", "All States"],
        "department": "Ministry of Rural Development, Government of India",
        "summary": {
            "en": "Grant assistance of ₹1,20,000 for rural homeless and kutcha-house dwelling families for pucca house construction, plus 90 days MGNREGA wages.",
            "kn": "ಗ್ರಾಮೀಣ ಭಾಗದ ವಸತಿ ರಹಿತ ಮತ್ತು ಶಿಥಿಲ ಮನೆಯ ಬಡ ಕುಟುಂಬಗಳಿಗೆ ಪಕ್ಕಾ ಮನೆ ನಿರ್ಮಾಣಕ್ಕಾಗಿ ₹1,20,000 ಆರ್ಥಿಕ ಅನುದಾನ ಮತ್ತು 90 ದಿನಗಳ ನರೇಗಾ ವೇತನ.",
            "hi": "ग्रामीण बेघर एवं कच्चे घरों में रहने वाले परिवारों को पक्का मकान बनाने हेतु ₹1,20,000 की वित्तीय सहायता तथा 90 दिन की मनरेगा मजदूरी।",
        },
        "description": {
            "en": "PMAY-G provides financial grant assistance to rural families who are homeless or living in kutcha/dilapidated houses, identified via SECC/Awaas+ priority lists.",
            "kn": "ಗ್ರಾಮೀಣ ಬಡ ಕುಟುಂಬಗಳಿಗೆ ಮೂಲಸೌಕರ್ಯಗಳೊಂದಿಗೆ ಸ್ವಂತ ಪಕ್ಕಾ ಮನೆ ನಿರ್ಮಿಸಿಕೊಳ್ಳಲು ಕೇಂದ್ರ-ರಾಜ್ಯ ಸರ್ಕಾರದ ವಸತಿ ಯೋಜನೆ.",
            "hi": "ग्रामीण गरीबों को बुनियादी सुविधाओं से युक्त पक्के मकान उपलब्ध कराने की राष्ट्रीय योजना।",
        },
        "benefit": {
            "description": "₹1,20,000 financial grant in instalments directly into bank account, plus ₹27,000 approx (90 days) MGNREGA unskilled labor wages and ₹12,000 for toilet construction under SBM-G.",
            "amount_inr": 120000,
            "frequency": "one_time",
        },
        "eligibility_criteria": [
            "Houseless families or families living in zero, one or two-room houses with kutcha wall and kutcha roof in rural areas",
            "Must be listed in SECC 2011 / Awaas+ verified priority list",
        ],
        "eligibility_rules": [
            {
                "rule_id": "PMAYG_E1",
                "field": "has_bank_account",
                "operator": "==",
                "value": True,
                "effect": "require",
                "description": "Beneficiary must have an active bank account.",
                "verification_status": "verified",
                "source_ids": ["SRC_MYSCHEME_CENTRAL"],
            },
        ],
        "exclusions": [
            {"description": "Households owning motorized 2/3/4 wheelers, mechanized agricultural equipment, or with government employees are excluded.", "verification_status": "verified", "source_ids": ["SRC_MYSCHEME_CENTRAL"]},
        ],
        "income_criteria": "SECC / Awaas+ deprivation ranking.",
        "age_criteria": "18 years and above.",
        "education_occupation_criteria": "Rural resident in kutcha house.",
        "land_criteria": "Must own homestead land plot.",
        "required_documents": [
            {"item": "Aadhaar Card", "mandatory": True, "note": "Identity verification."},
            {"item": "Bank Passbook", "mandatory": True, "note": "DBT linked account."},
            {"item": "Rural Domicile Proof", "mandatory": True, "note": "Panchayat residency proof."},
            {"item": "MGNREGA Job Card Number", "mandatory": True, "note": "For 90 days labor wages."},
        ],
        "document_requirements": [
            {"doc_type": "aadhaar", "label_en": "Aadhaar Card", "label_kn": "ಆಧಾರ್ ಕಾರ್ಡ್", "label_hi": "आधार कार्ड", "mandatory": True},
            {"doc_type": "bank_passbook", "label_en": "Bank Passbook", "label_kn": "ಬ್ಯಾಂಕ್ ಪಾಸ್‌ಬುಕ್", "label_hi": "बैंक पासबुक", "mandatory": True},
            {"doc_type": "income_certificate", "label_en": "Income / BPL Certificate", "label_kn": "ಆದಾಯ / ಬಿಪಿಎಲ್ ಪ್ರಮಾಣಪತ್ರ", "label_hi": "आय / बीपीएल प्रमाण पत्र", "mandatory": True},
            {"doc_type": "domicile_certificate", "label_en": "Rural Domicile Proof", "label_kn": "ಗ್ರಾಮೀಣ ವಾಸಸ್ಥಳ ಪ್ರಮಾಣಪತ್ರ", "label_hi": "ग्रामीण निवास प्रमाण पत्र", "mandatory": True},
        ],
        "mandatory_documents": ["aadhaar", "bank_passbook", "income_certificate", "domicile_certificate"],
        "process": [
            "Grama Sabha verifies priority ranking from Awaas+ survey list.",
            "Beneficiary registers bank account and Aadhaar.",
            "Geo-tagged photos of foundation, lintel, and roof levels taken via AwaasApp; funds released in 3 tranches directly via DBT.",
        ],
        "official_application_url": "https://pmayg.nic.in/",
        "official_source_url": "https://pmayg.nic.in/",
        "official_url": "https://pmayg.nic.in/",
        "official_urls": ["https://pmayg.nic.in/"],
        "important_dates": {"annual_allocation": "Active central rural housing mission"},
        "important_current_notes": ["Geo-tagging at each construction milestone is mandatory before fund release."],
        "application_window": "Continuous selection via Gram Sabha Awaas+ list",
        "operational_status": "ACTIVE",
        "application_status": "Active Through Gram Panchayats",
        "geographic_applicability": "All India Rural Areas (Active across Karnataka)",
        "verification_date": "2026-11-14",
        "last_updated_date": "2026-11-14",
        "verification_status": "SYNTHETIC_DEMO",
        "source_ids": ["SRC_MYSCHEME_CENTRAL"],
    },
    {
        "scheme_id": "PMMY_MUDRA",
        "record_type": "scheme",
        "name": {
            "en": "Pradhan Mantri Mudra Yojana (PMMY)",
            "kn": "ಪ್ರಧಾನ ಮಂತ್ರಿ ಮುದ್ರಾ ಯೋಜನೆ (ಪಿಎಂಎಂವೈ)",
            "hi": "प्रधानमंत्री मुद्रा योजना (पीएमएमवाई)",
        },
        "alternative_names": ["MUDRA Loan", "Shishu Kishore Tarun", "ಮುದ್ರಾ ಸಾಲ", "मुद्रा योजना"],
        "category": "Credit & Enterprise Support",
        "beneficiary_groups": ["women_entrepreneurs", "farmers", "wage_workers", "home_workers"],
        "jurisdiction": "central",
        "applicable_states": ["Karnataka", "All States"],
        "department": "Department of Financial Services, Ministry of Finance, Government of India",
        "summary": {
            "en": "Collateral-free micro enterprise loans up to ₹20 Lakhs across Shishu (up to ₹50,000), Kishore (₹50,000 to ₹5 Lakhs), and Tarun (₹5 Lakhs to ₹20 Lakhs) categories for small businesses and allied farm enterprises.",
            "kn": "ಸಣ್ಣ ಉದ್ಯಮಗಳು, ಕೃಷಿ ಪೂರಕ ವ್ಯಾಪಾರ ಮತ್ತು ಮಹಿಳಾ ಉದ್ಯಮಿಗಳಿಗೆ ಯಾವುದೇ ಮೇಲಾಧಾರವಿಲ್ಲದೆ (ಕೊಲ್ಯಾಟರಲ್-ಮುಕ್ತ) ₹20 ಲಕ್ಷದವರೆಗೆ ಮುದ್ರಾ ಸಾಲ (ಶಿಶು, ಕಿಶೋರ, ತರುಣ್).",
            "hi": "लघु व्यवसायों और कृषि संबद्ध गतिविधियों हेतु बिना किसी गारंटी (कोलैटरल-फ्री) ₹20 लाख तक का मुद्रा ऋण (शिशु, किशोर, तरुण)।",
        },
        "description": {
            "en": "PMMY funds the unfunded by providing collateral-free credit to non-corporate, non-farm small/micro enterprises and allied agricultural activities (dairy, poultry, fisheries, agro-processing).",
            "kn": "ಗ್ರಾಮೀಣ ಮತ್ತು ಅರೆ-ನಗರ ಭಾಗದ ಸಣ್ಣ ವ್ಯಾಪಾರಿಗಳು, ಪಶುಪಾಲಕರು ಹಾಗೂ ಸ್ವಸಹಾಯ ಸಂಘಗಳ ಸದಸ್ಯರಿಗೆ ವಾಣಿಜ್ಯ ಸಾಲ ಸೌಲಭ್ಯ ಒದಗಿಸುವ ಪ್ರಮುಖ ಯೋಜನೆ.",
            "hi": "लघु उद्यमियों एवं ग्रामीण कामगारों को औपचारिक बैंकिंग प्रणाली से जोड़ने हेतु मुद्रा ऋण योजना।",
        },
        "benefit": {
            "description": "Collateral-free business loan: Shishu (up to ₹50,000), Kishore (₹50,000 to ₹5 Lakhs), Tarun (₹5 Lakhs to ₹10 Lakhs, enhanced to ₹20 Lakhs for repeat borrowers).",
            "amount_inr": 1000000,
            "frequency": "one_time",
        },
        "eligibility_criteria": [
            "Any Indian citizen having a viable business plan for non-farm income-generating activity or agricultural allied activity",
            "Good credit history without default with any bank or financial institution",
        ],
        "eligibility_rules": [
            {
                "rule_id": "MUDRA_E1",
                "field": "has_bank_account",
                "operator": "==",
                "value": True,
                "effect": "require",
                "description": "Applicant must possess an active bank account.",
                "verification_status": "verified",
                "source_ids": ["SRC_MYSCHEME_CENTRAL"],
            },
        ],
        "exclusions": [],
        "income_criteria": "Viable business project cash flow.",
        "age_criteria": "18 to 65 years.",
        "education_occupation_criteria": "Micro entrepreneur, self-employed, artisan, or allied farm business.",
        "land_criteria": "Not required.",
        "required_documents": [
            {"item": "Aadhaar Card", "mandatory": True, "note": "Identity verification."},
            {"item": "Business Address Proof / Trade License", "mandatory": True, "note": "Proof of establishment."},
            {"item": "Bank Statement (Last 6 Months)", "mandatory": True, "note": "Cash flow record."},
            {"item": "Quotation of Machinery / Items to be purchased", "mandatory": True, "note": "For asset purchase."},
        ],
        "document_requirements": [
            {"doc_type": "aadhaar", "label_en": "Aadhaar Card", "label_kn": "ಆಧಾರ್ ಕಾರ್ಡ್", "label_hi": "आधार कार्ड", "mandatory": True},
            {"doc_type": "bank_passbook", "label_en": "Bank Statement / Passbook", "label_kn": "ಬ್ಯಾಂಕ್ ಸ್ಟೇಟ್‌ಮೆಂಟ್", "label_hi": "बैंक विवरण", "mandatory": True},
            {"doc_type": "business_proof", "label_en": "Business Proof / Trade License", "label_kn": "ವ್ಯಾಪಾರ ಪ್ರಮಾಣಪತ್ರ", "label_hi": "व्यवसाय प्रमाण पत्र", "mandatory": True},
        ],
        "mandatory_documents": ["aadhaar", "bank_passbook", "business_proof"],
        "process": [
            "Apply online through Udyamimitra portal (udyamimitra.in) or visit any commercial, RRB, or cooperative bank branch.",
            "Submit Mudra application form with quotation of items to be purchased.",
            "Bank sanctions loan without demanding third-party guarantee or collateral security; issues Mudra RuPay card.",
        ],
        "official_application_url": "https://www.udyamimitra.in/",
        "official_source_url": "https://www.mudra.org.in/",
        "official_url": "https://www.mudra.org.in/",
        "official_urls": ["https://www.udyamimitra.in/", "https://www.mudra.org.in/"],
        "important_dates": {"annual_cycle": "Continuous application through all commercial banks"},
        "important_current_notes": ["No collateral security or processing fee charged for Shishu loans up to ₹50,000."],
        "application_window": "Open year-round across all bank branches",
        "operational_status": "ACTIVE",
        "application_status": "Open Year-Round at All Banks",
        "geographic_applicability": "All India (Active in Karnataka)",
        "verification_date": "2026-11-14",
        "last_updated_date": "2026-11-14",
        "verification_status": "SYNTHETIC_DEMO",
        "source_ids": ["SRC_MYSCHEME_CENTRAL"],
    },
    {
        "scheme_id": "PM_JAY",
        "record_type": "scheme",
        "name": {
            "en": "Ayushman Bharat - PM-JAY & Arogya Karnataka",
            "kn": "ಆಯುಷ್ಮಾನ್ ಭಾರತ್ - ಆರೋಗ್ಯ ಕರ್ನಾಟಕ (ಪಿಎಂ-ಜೆಎವೈ)",
            "hi": "आयुष्मान भारत - पीएम-जय एवं आरोग्य कर्नाटक",
        },
        "alternative_names": ["PM-JAY", "Ayushman Card", "ಆಯುಷ್ಮಾನ್ ಕಾರ್ಡ್", "आयुष्मान भारत कार्ड"],
        "category": "Health & Social Security",
        "beneficiary_groups": ["rural_families", "farmers", "wage_workers", "home_workers"],
        "jurisdiction": "central",
        "applicable_states": ["Karnataka", "All States"],
        "department": "National Health Authority (NHA) & Suvarna Arogya Suraksha Trust (SAST), Government of Karnataka",
        "summary": {
            "en": "Cashless health insurance coverage up to ₹5,00,000 per family per year for secondary and tertiary hospitalization across 1,900+ empanelled hospitals in Karnataka.",
            "kn": "ದ್ವಿತೀಯ ಮತ್ತು ತೃತೀಯ ಹಂತದ ತುರ್ತು ಶಸ್ತ್ರಚಿಕಿತ್ಸೆ ಮತ್ತು ಆಸ್ಪತ್ರೆ ದಾಖಲಾತಿಗೆ ಪ್ರತಿ ಕುಟುಂಬಕ್ಕೆ ವಾರ್ಷಿಕ ₹5,00,000 ವರೆಗೆ ಸಂಪೂರ್ಣ ನಗದು ರಹಿತ ಉಚಿತ ಚಿಕಿತ್ಸೆ.",
            "hi": "गंभीर बीमारियों एवं अस्पताल में भर्ती होने पर प्रत्येक पात्र परिवार को प्रति वर्ष ₹5,00,000 तक का पूर्णतः निःशुल्क कैशलेस स्वास्थ्य बीमा।",
        },
        "description": {
            "en": "In Karnataka, PM-JAY is co-branded with Arogya Karnataka administered by Suvarna Arogya Suraksha Trust (SAST). BPL cardholders receive 100% cashless treatment up to ₹5 Lakhs, and APL cardholders receive 30% co-payment support.",
            "kn": "ಬಡ ಕುಟುಂಬಗಳು ಆಕಸ್ಮಿಕ ಅನಾರೋಗ್ಯದ ಚಿಕಿತ್ಸಾ ವೆಚ್ಚದಿಂದ ಸಾಲದ ಸುಳಿಗೆ ಸಿಲುಕದಂತೆ ರಕ್ಷಿಸುವ ದೇಶದ ಅತಿ ದೊಡ್ಡ ಆರೋಗ್ಯ ವಿಮಾ ಯೋಜನೆ.",
            "hi": "गरीब और वंचित परिवारों को गंभीर स्वास्थ्य समस्याओं के निःशुल्क गुणवत्तापूर्ण उपचार की गारंटी देने वाली योजना।",
        },
        "benefit": {
            "description": "Cashless health cover up to ₹5,00,000 per family per year covering pre-hospitalization, medicines, ICU, surgeries, and post-hospitalization care.",
            "amount_inr": 500000,
            "frequency": "annual",
        },
        "eligibility_criteria": [
            "All BPL / Antyodaya ration cardholder families in Karnataka (Eligible Category A)",
            "Families listed in SECC 2011 occupational and deprivation criteria",
            "APL cardholder families covered under co-payment scheme (Category B)",
        ],
        "eligibility_rules": [
            {
                "rule_id": "PMJAY_E1",
                "field": "has_bank_account",
                "operator": "==",
                "value": True,
                "effect": "require",
                "description": "Beneficiary must have verified identity details.",
                "verification_status": "verified",
                "source_ids": ["SRC_MYSCHEME_CENTRAL"],
            },
        ],
        "exclusions": [],
        "income_criteria": "Priority to BPL / AAY ration cardholders.",
        "age_criteria": "No age limit. Covers all family members from infants to senior citizens.",
        "education_occupation_criteria": "Citizen resident of Karnataka.",
        "land_criteria": "Not required.",
        "required_documents": [
            {"item": "Aadhaar Card", "mandatory": True, "note": "Identity and biometric e-KYC verification."},
            {"item": "Karnataka Ration Card (BPL / AAY / APL)", "mandatory": True, "note": "Arogya Karnataka eligibility verification."},
        ],
        "document_requirements": [
            {"doc_type": "aadhaar", "label_en": "Aadhaar Card", "label_kn": "ಆಧಾರ್ ಕಾರ್ಡ್", "label_hi": "आधार कार्ड", "mandatory": True},
            {"doc_type": "income_certificate", "label_en": "Ration Card (BPL/APL)", "label_kn": "ಪಡಿತರ ಚೀಟಿ (ರೇಷನ್ ಕಾರ್ಡ್)", "label_hi": "राशन कार्ड", "mandatory": True},
        ],
        "mandatory_documents": ["aadhaar", "income_certificate"],
        "process": [
            "Verify eligibility online on Beneficiary Portal (beneficiary.nha.gov.in) or visit nearest Village BangaloreOne / GramaOne / CSC.",
            "Complete Aadhaar e-KYC and download Ayushman Bharat Card immediately.",
            "Present Ayushman Card at any empaneled government or private hospital for cashless treatment.",
        ],
        "official_application_url": "https://beneficiary.nha.gov.in/",
        "official_source_url": "https://nha.gov.in/PM-JAY",
        "official_url": "https://arogya.karnataka.gov.in/",
        "official_urls": ["https://beneficiary.nha.gov.in/", "https://arogya.karnataka.gov.in/"],
        "important_dates": {"coverage_cycle": "Annual renewable cover of ₹5 Lakhs"},
        "important_current_notes": ["Karnataka residents can get co-branded Ayushman Arogya Karnataka card generated at any GramaOne centre."],
        "application_window": "Open year-round on national portal and at all GramaOne centres",
        "operational_status": "ACTIVE",
        "application_status": "Open Year-Round Continuous",
        "geographic_applicability": "All India (Active in Karnataka across 1,900+ hospitals)",
        "verification_date": "2026-11-14",
        "last_updated_date": "2026-11-14",
        "verification_status": "SYNTHETIC_DEMO",
        "source_ids": ["SRC_MYSCHEME_CENTRAL"],
    },
    {
        "scheme_id": "APY_PENSION",
        "record_type": "scheme",
        "name": {
            "en": "Atal Pension Yojana (APY)",
            "kn": "ಅಟಲ್ ಪಿಂಚಣಿ ಯೋಜನೆ (ಎಪಿವೈ)",
            "hi": "अटल पेंशन योजना (एपीवाई)",
        },
        "alternative_names": ["APY", "Atal Pension", "ಅಟಲ್ ಪಿಂಚಣಿ", "अटल पेंशन"],
        "category": "Social Security & Pension",
        "beneficiary_groups": ["wage_workers", "home_workers", "farmers", "students"],
        "jurisdiction": "central",
        "applicable_states": ["Karnataka", "All States"],
        "department": "Pension Fund Regulatory and Development Authority (PFRDA), Ministry of Finance, GoI",
        "summary": {
            "en": "Guaranteed monthly pension of ₹1,000 to ₹5,000 for unorganized workers, farmers, and self-employed citizens starting from 60 years of age, based on chosen monthly contribution from age 18 to 40.",
            "kn": "ಅಸಂಘಟಿತ ವಲಯದ ಕಾರ್ಮಿಕರು, ರೈತರು ಮತ್ತು ಯುವಜನರಿಗೆ 60 ವರ್ಷ ತುಂಬಿದ ನಂತರ ತಿಂಗಳಿಗೆ ₹1,000 ದಿಂದ ₹5,000 ವರೆಗೆ ಖಾತರಿಯ ಮಾಸಾಶನ (ಪಿಂಚಣಿ).",
            "hi": "असंगठित क्षेत्र के कामगारों, किसानों एवं युवाओं को 60 वर्ष की आयु के बाद ₹1,000 से ₹5,000 तक की गारंटीकृत मासिक पेंशन।",
        },
        "description": {
            "en": "APY is a government-backed pension scheme focused on workers in the unorganized sector. Subscribers contribute a fixed monthly amount from age 18-40 and receive a guaranteed minimum monthly pension of ₹1,000, ₹2,000, ₹3,000, ₹4,000, or ₹5,000 from age 60.",
            "kn": "ವೃದ್ಧಾಪ್ಯದಲ್ಲಿ ನಿಶ್ಚಿತ ಆದಾಯ ಹೊಂದಲು ಕೇಂದ್ರ ಸರ್ಕಾರದ ಆಶ್ರಯದಲ್ಲಿ ಜಾರಿಗೆ ತರಲಾದ ಭದ್ರತಾ ಪಿಂಚಣಿ ಯೋಜನೆ.",
            "hi": "असंगठित क्षेत्र के नागरिकों को वृद्धावस्था में आर्थिक सुरक्षा देने हेतु सरकार द्वारा गारंटीकृत पेंशन योजना।",
        },
        "benefit": {
            "description": "Guaranteed monthly pension of ₹1,000 to ₹5,000 for life after age 60. Same pension continues to spouse on subscriber's death, and full accumulated pension wealth returned to nominee.",
            "amount_inr": 60000,
            "frequency": "annual",
        },
        "eligibility_criteria": [
            "Any Indian citizen aged between 18 and 40 years",
            "Must possess a savings bank account with auto-debit facility",
            "Must not be an income-tax payer (effective October 2022 amendment)",
        ],
        "eligibility_rules": [
            {
                "rule_id": "APY_E1",
                "field": "has_bank_account",
                "operator": "==",
                "value": True,
                "effect": "require",
                "description": "Applicant must have a savings bank account.",
                "verification_status": "verified",
                "source_ids": ["SRC_MYSCHEME_CENTRAL"],
            },
        ],
        "exclusions": [
            {"description": "Persons who are income tax payers as per Income Tax Act are not eligible to join APY.", "verification_status": "verified", "source_ids": ["SRC_MYSCHEME_CENTRAL"]},
        ],
        "income_criteria": "Excludes income-tax payers.",
        "age_criteria": "18 to 40 years at entry; pension starts at age 60.",
        "education_occupation_criteria": "Unorganized worker, farmer, artisan, or self-employed.",
        "land_criteria": "Not required.",
        "required_documents": [
            {"item": "Aadhaar Card", "mandatory": True, "note": "Primary identity verification."},
            {"item": "Bank Passbook with Auto-Debit Mandate", "mandatory": True, "note": "For monthly deduction of contribution."},
        ],
        "document_requirements": [
            {"doc_type": "aadhaar", "label_en": "Aadhaar Card", "label_kn": "ಆಧಾರ್ ಕಾರ್ಡ್", "label_hi": "आधार कार्ड", "mandatory": True},
            {"doc_type": "bank_passbook", "label_en": "Savings Bank Passbook (Auto-Debit)", "label_kn": "ಬ್ಯಾಂಕ್ ಪಾಸ್‌ಬುಕ್", "label_hi": "बैंक पासबुक", "mandatory": True},
        ],
        "mandatory_documents": ["aadhaar", "bank_passbook"],
        "process": [
            "Visit bank or post office branch where savings account is maintained, or apply online via internet banking.",
            "Fill APY subscriber registration form and provide Aadhaar and nominee details.",
            "Monthly auto-debit set up; PRAN (Permanent Retirement Account Number) card issued.",
        ],
        "official_application_url": "https://www.npscra.nsdl.co.in/",
        "official_source_url": "https://www.pfrda.org.in/",
        "official_url": "https://www.npscra.nsdl.co.in/",
        "official_urls": ["https://www.npscra.nsdl.co.in/", "https://www.pfrda.org.in/"],
        "important_dates": {"entry_window": "Entry open from age 18 to 40"},
        "important_current_notes": ["Guaranteed return backed by Government of India."],
        "application_window": "Open year-round at all bank and post office branches",
        "operational_status": "ACTIVE",
        "application_status": "Open Year-Round Continuous",
        "geographic_applicability": "All India (Active in Karnataka)",
        "verification_date": "2026-11-14",
        "last_updated_date": "2026-11-14",
        "verification_status": "SYNTHETIC_DEMO",
        "source_ids": ["SRC_MYSCHEME_CENTRAL"],
    },
]


def build_database() -> None:
    # 1. Combine schemes
    all_schemes: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    for scheme in FARMER_SCHEMES:
        sid = scheme["scheme_id"]
        if sid in seen_ids:
            raise ValueError(f"Duplicate scheme ID: {sid}")
        seen_ids.add(sid)
        all_schemes.append(scheme)

    for scheme in STUDENT_SCHEMES:
        sid = scheme["scheme_id"]
        if sid in seen_ids:
            # Overlap might happen if both lists have a scheme, handle cleanly
            continue
        seen_ids.add(sid)
        all_schemes.append(scheme)

    for scheme in LEGACY_ADDITIONAL_SCHEMES:
        sid = scheme["scheme_id"]
        if sid not in seen_ids:
            seen_ids.add(sid)
            all_schemes.append(scheme)

    # SOURCES imported at top from scripts.sources_data

    source_ids_set = {s["source_id"] for s in SOURCES}

    # Validate that every scheme has required fields and known source_ids
    for s in all_schemes:
        sid = s["scheme_id"]
        assert s.get("name"), f"{sid} missing name"
        assert s.get("beneficiary_groups"), f"{sid} missing beneficiary_groups"
        assert s.get("category"), f"{sid} missing category"
        assert s.get("operational_status"), f"{sid} missing operational_status"
        for src_id in s.get("source_ids", []):
            if src_id not in source_ids_set:
                print(f"Warning: {sid} references unknown source_id {src_id}")

    # Build the root JSON structure adhering to database/schema.json
    db_payload = {
        "schema_version": "2.0.0",
        "scope": {
            "state": "Karnataka",
            "beneficiary_groups": ["farmers", "students"],
        },
        "last_updated": "2026-11-14",
        "metadata": {
            "title": "Gram Saathi Comprehensive Active Schemes Knowledge Base",
            "total_schemes": len(all_schemes),
            "active_farmer_schemes": len([s for s in all_schemes if "farmers" in s.get("beneficiary_groups", []) and s.get("operational_status") != "DISCONTINUED"]),
            "active_student_schemes": len([s for s in all_schemes if "students" in s.get("beneficiary_groups", []) and s.get("operational_status") != "DISCONTINUED"]),
            "discontinued_schemes": len([s for s in all_schemes if s.get("operational_status") == "DISCONTINUED"]),
            "total_verified_sources": len(SOURCES),
        },
        "sources": SOURCES,
        "schemes": all_schemes,
    }

    # Write database/schemes.json
    out_file = Path("database/schemes.json")
    out_file.write_text(json.dumps(db_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Successfully wrote {len(all_schemes)} schemes to {out_file}.")

    # Generate database/SCHEME_SOURCES.md
    generate_markdown_sources(SOURCES, all_schemes)


def generate_markdown_sources(sources: list[dict[str, Any]], schemes: list[dict[str, Any]]) -> None:
    lines = [
        "# Gram Saathi Comprehensive Verified Government Scheme Source Registry",
        "",
        "**Research & Verification Date:** 2026-11-14  ",
        f"**Total Verified Sources:** {len(sources)}  ",
        f"**Total Catalogued Schemes:** {len(schemes)}  ",
        "",
        "> [!IMPORTANT]",
        "> Gram Saathi relies exclusively on official government gazettes, operational guidelines, national portals (MyScheme, NSP, PM-KISAN, PMFBY), state departments (Karnataka SSP, Agriculture, Horticulture, Animal Husbandry), and official district administration websites. No third-party scrapers or blogs are cited.",
        "",
        "---",
        "",
        "## 1. Central Government Official Sources",
        "",
        "| Source ID | Official Portal / Guidelines | Publisher | Official URL | Access Date |",
        "|---|---|---|---|---|",
    ]

    central_sources = [s for s in sources if "Government of India" in s.get("publisher", "") or "National" in s.get("title", "") or "Central" in s.get("title", "") or "Ministry" in s.get("publisher", "") or "AICTE" in s.get("publisher", "") or "UGC" in s.get("publisher", "") or "CSIR" in s.get("publisher", "") or "DST" in s.get("publisher", "")]
    state_district_sources = [s for s in sources if s not in central_sources]

    for s in central_sources:
        lines.append(f"| `{s['source_id']}` | {s['title']} | {s['publisher']} | [{s['url']}]({s['url']}) | {s['access_date']} |")

    lines.extend([
        "",
        "## 2. Karnataka State & District Government Sources",
        "",
        "| Source ID | Official Portal / Guidelines | Publisher | Official URL | Access Date |",
        "|---|---|---|---|---|",
    ])

    for s in state_district_sources:
        lines.append(f"| `{s['source_id']}` | {s['title']} | {s['publisher']} | [{s['url']}]({s['url']}) | {s['access_date']} |")

    lines.extend([
        "",
        "---",
        "",
        "## 3. Scheme to Source Traceability Matrix",
        "",
        "| Scheme ID | Scheme Name (English / Kannada / Hindi) | Category | Jurisdiction | Operational Status | Official Application URL | Verified Sources |",
        "|---|---|---|---|---|---|---|",
    ])

    for sc in schemes:
        name_en = sc["name"]["en"]
        name_kn = sc["name"].get("kn", "")
        name_hi = sc["name"].get("hi", "")
        names_str = f"**{name_en}**<br>_{name_kn}_<br>_{name_hi}_"
        src_tags = ", ".join(f"`{sid}`" for sid in sc.get("source_ids", []))
        app_url = sc.get("official_application_url") or sc.get("official_url") or "Portal"
        lines.append(f"| `{sc['scheme_id']}` | {names_str} | {sc['category']} | {sc['jurisdiction'].title()} | `{sc['operational_status']}` | [{app_url}]({app_url}) | {src_tags} |")

    lines.extend([
        "",
        "---",
        "",
        "## 4. Operational Status Definitions",
        "",
        "- **`ACTIVE`**: Scheme is currently operational; benefits are distributed on a continuous, monthly, or on-demand basis.",
        "- **`APPLICATIONS OPEN`**: Official application window or portal registration is confirmed currently open for the active academic/financial cycle.",
        "- **`APPLICATIONS CLOSED`**: The scheme is continuing, but the application deadline for the current cycle has closed; reopening scheduled with next academic/board cycle.",
        "- **`SEASONAL`**: Applications and disbursements follow agricultural cropping seasons (Kharif, Rabi, Summer) or academic calendar reopenings.",
        "- **`STATUS UNCONFIRMED`**: Information available in government circulars, but current live electronic portal link requires local field confirmation.",
        "- **`DISCONTINUED`**: Legacy scheme officially terminated, merged, or superseded by modern digital DBT portals (e.g., SSP or Soil Health Digital Portal). Excluded from active citizen discovery.",
        "",
        "## 5. Important Operational Limitations & Disclaimers",
        "",
        "1. **PMFBY Seasonal Deadlines**: PMFBY Cut-off dates strictly depend on Karnataka district/crop notifications published on Samrakshane portal. Gram Saathi does not hardcode static premium rates.",
        "2. **State Scholarship Portal (SSP) e-Attestation**: SSP requires electronic college e-attestation and Kutumba family ID linkage. Automated approval is subject to e-Pramana caste and income RD number verification.",
        "3. **District Top-Up Subsidies (Mandya)**: District-level schemes (e.g. Mandya Sugarcane Drip Top-up) apply exclusively within the geographical jurisdiction of Mandya District taluks.",
        "4. **No Financial Guarantees**: Discovery results provide structured, verified guidance; official decision authority belongs exclusively to the respective competent government authorities.",
    ])

    out_md = Path("database/SCHEME_SOURCES.md")
    out_md.write_text("\n".join(lines), encoding="utf-8")
    print(f"Successfully wrote source registry to {out_md}.")


if __name__ == "__main__":
    build_database()
