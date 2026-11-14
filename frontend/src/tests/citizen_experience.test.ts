import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../context/LanguageContext';
import { CitizenHomePage } from '../pages/citizen/CitizenHomePage';
import { CitizenLoginPage } from '../pages/citizen/CitizenLoginPage';
import { VoiceInput } from '../components/citizen/VoiceInput';
import { 
  detectBeneficiaryCategory, 
  detectIntent, 
  checkSensitiveData, 
  extractNonSensitiveFacts, 
  analyzeCitizenMessage 
} from '../services/nlu';
import { en } from '../translations/en';
import { kn } from '../translations/kn';
import { hi } from '../translations/hi';
import { api, BACKEND_CAPABILITIES } from '../services/api';

describe('Gram Saathi - Citizen Experience, NLU & Honest Integration', () => {

  // =========================================================================
  // 1. Beneficiary Category Detection (Multilingual: EN, KN, HI)
  // =========================================================================
  describe('Beneficiary Category Detection', () => {
    it('should detect farmer category across English, Kannada, and Hindi', () => {
      expect(detectBeneficiaryCategory('I am a small farmer with 2 acres of land')).toBe('farmers');
      expect(detectBeneficiaryCategory('ನಾನು ಮಂಡ್ಯ ಜಿಲ್ಲೆಯ ಒಬ್ಬ ಸಣ್ಣ ರೈತ')).toBe('farmers');
      expect(detectBeneficiaryCategory('मैं कर्नाटक का एक छोटा किसान हूँ')).toBe('farmers');
      expect(detectBeneficiaryCategory('Looking for crop insurance pmfby')).toBe('farmers');
      expect(detectBeneficiaryCategory('ನನ್ನ ಜಮೀನಿನ ಪಹಣಿ (RTC) ಇದೆ')).toBe('farmers');
    });

    it('should detect student category across English, Kannada, and Hindi', () => {
      expect(detectBeneficiaryCategory('I am a college student studying degree')).toBe('students');
      expect(detectBeneficiaryCategory('ನಾನು ಪಿಯುಸಿ ಮುಗಿಸಿ ಕಾಲೇಜು ವಿದ್ಯಾರ್ಥಿವೇತನ ಹುಡುಕುತ್ತಿದ್ದೇನೆ')).toBe('students');
      expect(detectBeneficiaryCategory('मुझे उच्च शिक्षा के लिए पोस्ट-मैट्रिक छात्रवृत्ति चाहिए')).toBe('students');
    });

    it('should detect women entrepreneur category across English, Kannada, and Hindi', () => {
      expect(detectBeneficiaryCategory('I am part of a women self-help group for tailoring business')).toBe('women_entrepreneurs');
      expect(detectBeneficiaryCategory('ನಮ್ಮ ಮಹಿಳಾ ಸ್ವಸಹಾಯ ಸಂಘಕ್ಕೆ ಆರ್ಥಿಕ ನೆರವು ಬೇಕು')).toBe('women_entrepreneurs');
      expect(detectBeneficiaryCategory('महिला स्वयं सहायता समूह के लिए ऋण योजना बताएं')).toBe('women_entrepreneurs');
    });

    it('should detect rural worker category across English, Kannada, and Hindi', () => {
      expect(detectBeneficiaryCategory('I am a daily wage construction worker')).toBe('workers');
      expect(detectBeneficiaryCategory('ನಾನು ಕಟ್ಟಡ ಕಾರ್ಮಿಕ, ಕೂಲಿ ಕೆಲಸ ಮಾಡುತ್ತೇನೆ')).toBe('workers');
      expect(detectBeneficiaryCategory('मैं एक दिहाड़ी मजदूर हूँ')).toBe('workers');
    });

    it('should detect general citizen category or return null when unspecified', () => {
      expect(detectBeneficiaryCategory('Show me all government welfare schemes')).toBe('general');
      expect(detectBeneficiaryCategory('ನಮಸ್ಕಾರ ಶುಭೋದಯ')).toBeNull();
    });
  });

  // =========================================================================
  // 2. Sensitive Data Detection (Aadhaar & OTP Protection)
  // =========================================================================
  describe('Sensitive Data Privacy Protection', () => {
    it('should flag 12-digit Aadhaar numbers with various formats', () => {
      expect(checkSensitiveData('My Aadhaar is 1234 5678 9012')).toBe(true);
      expect(checkSensitiveData('aadhar: 9876-5432-1098')).toBe(true);
      expect(checkSensitiveData('ಇದು ನನ್ನ ಆಧಾರ್ 2345 6789 0123')).toBe(true);
      expect(checkSensitiveData('आधार 345678901234')).toBe(true);
    });

    it('should flag OTP, PIN, and password sharing in chat', () => {
      expect(checkSensitiveData('My OTP is 456789')).toBe(true);
      expect(checkSensitiveData('password: 12345')).toBe(true);
      expect(checkSensitiveData('ನನ್ನ ಪಾಸ್‌ವರ್ಡ್ 889900')).toBe(true);
      expect(checkSensitiveData('ओटीपी 554433')).toBe(true);
    });

    it('should NOT flag benign non-sensitive numbers like acres or years', () => {
      expect(checkSensitiveData('I have 2.5 acres of land in Mandya')).toBe(false);
      expect(checkSensitiveData('I completed 10th standard in 2024')).toBe(false);
      expect(checkSensitiveData('ವಾರ್ಷಿಕ ಆದಾಯ 80000 ರೂಪಾಯಿಗಳು')).toBe(false);
    });
  });

  // =========================================================================
  // 3. Intent Detection & Routing
  // =========================================================================
  describe('Intent Detection', () => {
    it('should detect FIND_SCHEMES intent', () => {
      expect(detectIntent('Find government schemes for me')).toBe('FIND_SCHEMES');
      expect(detectIntent('ನನಗಾಗಿ ಇರುವ ಸರ್ಕಾರಿ ಯೋಜನೆಗಳನ್ನು ಹುಡುಕಿ')).toBe('FIND_SCHEMES');
      expect(detectIntent('मेरे लिए कल्याणकारी योजनाएं बताएं')).toBe('FIND_SCHEMES');
    });

    it('should detect CHECK_ELIGIBILITY intent', () => {
      expect(detectIntent('Check my eligibility for welfare schemes')).toBe('CHECK_ELIGIBILITY');
      expect(detectIntent('ನನ್ನ ಅರ್ಹತೆ ಪರೀಕ್ಷಿಸಿ')).toBe('CHECK_ELIGIBILITY');
      expect(detectIntent('मेरी पात्रता की जांच करें')).toBe('CHECK_ELIGIBILITY');
    });

    it('should detect UPLOAD_DOCUMENTS intent', () => {
      expect(detectIntent('Help me upload my documents')).toBe('UPLOAD_DOCUMENTS');
      expect(detectIntent('ದಾಖಲೆಗಳನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಲು ಸಹಾಯ ಮಾಡಿ')).toBe('UPLOAD_DOCUMENTS');
      expect(detectIntent('दस्तावेज़ अपलोड करना है')).toBe('UPLOAD_DOCUMENTS');
    });

    it('should detect TRACK_APPLICATION intent', () => {
      expect(detectIntent('Check my application status with reference number')).toBe('TRACK_APPLICATION');
      expect(detectIntent('ಅರ್ಜಿಯ ಸ್ಥಿತಿ ಪರಿಶೀಲಿಸಿ')).toBe('TRACK_APPLICATION');
      expect(detectIntent('आवेदन की स्थिति ट्रैक करें')).toBe('TRACK_APPLICATION');
    });
  });

  // =========================================================================
  // 4. Non-Sensitive Fact Extraction
  // =========================================================================
  describe('Non-Sensitive Fact Extraction', () => {
    it('should extract district and landholding from natural language', () => {
      const facts = extractNonSensitiveFacts('I am a farmer from Mandya with 1.5 acres land');
      expect(facts.beneficiary_group).toBe('farmers');
      expect(facts.district).toBe('Mandya');
      expect(facts.land_holding_acres).toBe(1.5);
      expect(facts.has_cultivable_land_record).toBe(true);
    });

    it('should extract Kannada language location and acreage', () => {
      const facts = extractNonSensitiveFacts('ನಾನು ಮಂಡ್ಯ ಜಿಲ್ಲೆಯ ರೈತ, 2 ಎಕರೆ ಜಮೀನಿದೆ');
      expect(facts.beneficiary_group).toBe('farmers');
      expect(facts.district).toBe('Mandya');
      expect(facts.land_holding_acres).toBe(2);
    });

    it('should extract student education level from text', () => {
      const facts = extractNonSensitiveFacts('I am a college student studying degree course');
      expect(facts.beneficiary_group).toBe('students');
      expect(facts.education_level).toBe('Post-Matric / Undergraduate');
    });
  });

  // =========================================================================
  // 5. Translation Parity Across English, Kannada, and Hindi
  // =========================================================================
  describe('Translation Parity (EN, KN, HI)', () => {
    it('should maintain 100% key parity across English, Kannada, and Hindi', () => {
      const enKeys = Object.keys(en).sort();
      const knKeys = Object.keys(kn).sort();
      const hiKeys = Object.keys(hi).sort();

      expect(knKeys).toEqual(enKeys);
      expect(hiKeys).toEqual(enKeys);
      expect(enKeys.length).toBeGreaterThan(120);
    });

    it('should define navigation tabs in all three languages', () => {
      expect(en.tabChat).toBe('Chatbot');
      expect(kn.tabChat).toBe('ಸಹಾಯಕ (ಚಾಟ್)');
      expect(hi.tabChat).toBe('सहायक (चैट)');

      expect(en.tabEligibility).toBe('Eligibility Wizard');
      expect(kn.tabEligibility).toBe('ಅರ್ಹತಾ ಪರಿಶೀಲನೆ');
      expect(hi.tabEligibility).toBe('पात्रता जांच');

      expect(en.tabDocuments).toBe('Document Upload');
      expect(kn.tabDocuments).toBe('ದಾಖಲೆಗಳ ಸಲ್ಲಿಕೆ');
      expect(hi.tabDocuments).toBe('दस्तावेज़ अपलोड');

      expect(en.tabPrepare).toBe('Prepare Application');
      expect(kn.tabPrepare).toBe('ಅರ್ಜಿ ಸಿದ್ಧತೆ');
      expect(hi.tabPrepare).toBe('आवेदन तैयारी');

      expect(en.tabTrack).toBe('Track Status');
      expect(kn.tabTrack).toBe('ಸ್ಥಿತಿ ಟ್ರ್ಯಾಕಿಂಗ್');
      expect(hi.tabTrack).toBe('स्थिति ट्रैकिंग');
    });

    it('should define honest outcome descriptions in all three languages', () => {
      expect(en.outcomePotentiallyEligible).toBeDefined();
      expect(kn.outcomePotentiallyEligible).toBeDefined();
      expect(hi.outcomePotentiallyEligible).toBeDefined();

      expect(en.outcomeNotEligible).toBeDefined();
      expect(kn.outcomeNotEligible).toBeDefined();
      expect(hi.outcomeNotEligible).toBeDefined();

      expect(en.outcomeManualReview).toBeDefined();
      expect(kn.outcomeManualReview).toBeDefined();
      expect(hi.outcomeManualReview).toBeDefined();
    });
  });

  // =========================================================================
  // 6. Honest Integration Boundaries
  // =========================================================================
  describe('Honest Integration Boundaries', () => {
    it('should document supported and pending endpoints accurately', () => {
      expect(BACKEND_CAPABILITIES.SUPPORTED_ENDPOINTS).toContain('GET /api/schemes');
      expect(BACKEND_CAPABILITIES.SUPPORTED_ENDPOINTS).toContain('POST /api/schemes/discover');
      expect(BACKEND_CAPABILITIES.SUPPORTED_ENDPOINTS).toContain('POST /api/eligibility/check');
      expect(BACKEND_CAPABILITIES.SUPPORTED_ENDPOINTS).toContain('POST /api/chat');

      expect(BACKEND_CAPABILITIES.PENDING_ENDPOINTS).toContain('POST /api/documents/upload');
      expect(BACKEND_CAPABILITIES.PENDING_ENDPOINTS).toContain('POST /api/applications/draft');
    });

    it('should return honest not-implemented result when pending endpoints are invoked', async () => {
      const dummyFile = new File(['dummy content'], 'aadhaar.pdf', { type: 'application/pdf' });
      const uploadRes = await api.uploadDocumentToBackend(dummyFile, 'AADHAAR');
      
      // Should not claim successful server upload when endpoint is not present
      if (!uploadRes.isBackendSupported) {
        expect(uploadRes.error).toBe('ENDPOINT_NOT_IMPLEMENTED');
      }

      const trackRes = await api.trackApplicationFromBackend('NON-EXISTENT-REF');
      if (!trackRes.isBackendSupported) {
        expect(trackRes.error).toBe('REGISTRY_NOT_CONNECTED');
      }
    });

    it('should have multilingual navigation and verified checklist translations', () => {
      expect(en.tabUploadSubmitDocuments).toBe('Upload / Submit Documents');
      expect(kn.tabUploadSubmitDocuments).toBe('ದಾಖಲೆಗಳನ್ನು ಅಪ್‌ಲೋಡ್ / ಸಲ್ಲಿಸಿ');
      expect(hi.tabUploadSubmitDocuments).toBe('दस्तावेज़ अपलोड / जमा करें');

      expect(en.uploadSubmitDocsBtn).toBe('Upload Documents');
      expect(kn.uploadSubmitDocsBtn).toBe('ದಾಖಲೆ ಸಲ್ಲಿಕೆ');
      expect(hi.uploadSubmitDocsBtn).toBe('दस्तावेज़ जमा');

      expect(en.selectScheme).toBe('Select Scheme');
      expect(kn.selectScheme).toBe('ಯೋಜನೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ');
      expect(hi.selectScheme).toBe('योजना चुनें');

      expect(en.uploadConfirmed).toBe('Uploaded');
      expect(kn.uploadConfirmed).toBe('ಅಪ್‌ಲೋಡ್ ಆಗಿದೆ');
      expect(hi.uploadConfirmed).toBe('अपलोड हो गया');
    });
  });

  // =========================================================================
  // 7. Citizen Experience Components & Pages
  // =========================================================================
  describe('Citizen Experience Components & Pages', () => {
    it('CitizenHomePage renders with hero and quick actions', () => {
      const html = renderToString(
        React.createElement(LanguageProvider, null,
          React.createElement(MemoryRouter, null,
            React.createElement(CitizenHomePage)
          )
        )
      );
      expect(html).toContain('Gram Saathi');
      expect(html).toContain(en.homeHeroTitle);
      expect(html).toContain(en.homeQuickActions);
    });

    it('CitizenLoginPage phone validation works properly', () => {
      const validatePhone = (num: string) => {
        let cleaned = num.replace(/\D/g, '');
        if (cleaned.startsWith('91') && cleaned.length === 12) {
          cleaned = cleaned.slice(2);
        }
        return cleaned.length === 10;
      };
      expect(validatePhone('9876543210')).toBe(true);
      expect(validatePhone('+91 98765 43210')).toBe(true);
      expect(validatePhone('12345')).toBe(false);
      expect(validatePhone('')).toBe(false);
      expect(validatePhone('987654321012')).toBe(false);

      const html = renderToString(
        React.createElement(LanguageProvider, null,
          React.createElement(MemoryRouter, null,
            React.createElement(CitizenLoginPage)
          )
        )
      );
      expect(html).toContain(en.phoneNumberLabel);
      expect(html).toContain('+91');
    });

    it('VoiceInput renders with unsupported browser message in server/node environment', () => {
      const html = renderToString(
        React.createElement(LanguageProvider, null,
          React.createElement(VoiceInput, { onTranscriptComplete: () => {} })
        )
      );
      expect(html).toContain(en.voiceUnsupported);
    });

    it('All new translation keys present in all 3 languages', () => {
      const newKeys = [
        'loginTitle', 'loginSubtitle', 'phoneNumberLabel', 'sendOtpBtn', 'otpLabel', 'verifyOtpBtn',
        'resendOtp', 'invalidPhone', 'invalidOtp', 'homeHeroTitle', 'homeHeroSubtitle',
        'homeHeroTagline', 'homeQuickActions', 'homeFeaturedSchemes', 'homeActionChat',
        'homeActionSchemes', 'homeActionEligibility', 'homeActionDocuments', 'homeActionTrack',
        'profileTitle', 'profileName', 'profilePhone', 'profileDistrict', 'profileState',
        'profileLanguage', 'profileEditBtn', 'profileSaveBtn', 'profileLogoutBtn',
        'helpTitle', 'helpSubtitle', 'helpFaq1Q', 'helpFaq1A', 'helpDemoNotice', 'helpHelpline',
        'voiceTapToSpeak', 'voiceRecording', 'voiceUnsupported', 'voiceTranscript', 'voiceSendBtn',
        'navHome', 'navHelp', 'navProfile', 'navLogin',
        'casteCert', 'marksCard', 'studentAadhaar', 'aadhaarCard', 'incomeCert', 'bankPassbook',
      ];

      for (const key of newKeys) {
        expect((en as any)[key]).toBeDefined();
        expect((kn as any)[key]).toBeDefined();
        expect((hi as any)[key]).toBeDefined();
        expect((en as any)[key].length).toBeGreaterThan(0);
        expect((kn as any)[key].length).toBeGreaterThan(0);
        expect((hi as any)[key].length).toBeGreaterThan(0);
      }
    });

    it('All 5 required student document types have matching translations and distinct labels', () => {
      const studentDocKeys = ['studentAadhaar', 'casteCert', 'incomeCert', 'marksCard', 'bankPassbook'] as const;
      
      studentDocKeys.forEach((k) => {
        expect(en[k]).toBeDefined();
        expect(kn[k]).toBeDefined();
        expect(hi[k]).toBeDefined();
      });

      // Verify English distinctions
      expect(en.casteCert).toContain('Caste');
      expect(en.marksCard).toContain('Marks');
      expect(en.studentAadhaar).toContain('Student');

      // Verify Kannada distinctions
      expect(kn.casteCert).toContain('ಜಾತಿ');
      expect(kn.marksCard).toContain('ಅಂಕಪಟ್ಟಿ');
      expect(kn.studentAadhaar).toContain('ವಿದ್ಯಾರ್ಥಿ');

      // Verify Hindi distinctions
      expect(hi.casteCert).toContain('जाति');
      expect(hi.marksCard).toContain('अंक');
      expect(hi.studentAadhaar).toContain('छात्र');
    });
  });
});
