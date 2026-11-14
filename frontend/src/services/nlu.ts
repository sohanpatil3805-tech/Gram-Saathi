import { CitizenGroup, SupportedLanguage, ApplicantProfile } from '../types/api';

export type DetectedIntent = 
  | 'FIND_SCHEMES'
  | 'CHECK_ELIGIBILITY'
  | 'UPLOAD_DOCUMENTS'
  | 'TRACK_APPLICATION'
  | 'ASK_QUESTION';

export interface NLUAnalysis {
  beneficiaryGroup: CitizenGroup | null;
  intent: DetectedIntent;
  extractedFacts: Partial<ApplicantProfile>;
  containsSensitiveData: boolean;
  needsClarification: boolean;
  clarifyingQuestion?: string;
}

// Multilingual keyword sets
const KEYWORDS = {
  farmers: [
    'farmer', 'farmers', 'farming', 'agriculture', 'land', 'crop', 'kisan', 'cultivation', 'rtc', 'pahani', 'pmkisan', 'pmfby',
    'ರೈತ', 'ರೈತರು', 'ಕೃಷಿ', 'ಕೃಷಿಕ', 'ಜಮೀನು', 'ಭೂಮಿ', 'ಬೆಳೆ', 'ಪಹಣಿ', 'ಕಿಸಾನ್', 'ವಿಮೆ',
    'किसान', 'कृषि', 'खेती', 'फसल', 'भूमि', 'खतौनी', 'पीएम-किसान', 'फसल बीमा'
  ],
  students: [
    'student', 'students', 'college', 'school', 'scholarship', 'study', 'education', 'university', 'degree', 'diploma', 'ssp', 'nsp', 'post-matric',
    'ವಿದ್ಯಾರ್ಥಿ', 'ವಿದ್ಯಾರ್ಥಿಗಳು', 'ಕಾಲೇಜು', 'ಶಾಲೆ', 'ವಿದ್ಯಾರ್ಥಿವೇತನ', 'ಶಿಕ್ಷಣ', 'ಪದವಿ', 'ಡಿಪ್ಲೊಮಾ', 'ಓದು', 'ಹಾಸ್ಟೆಲ್',
    'छात्र', 'विद्यार्थी', 'कॉलेज', 'स्कूल', 'छात्रवृत्ति', 'शिक्षा', 'डिग्री', 'पढ़ाई'
  ],
  women_entrepreneurs: [
    'woman', 'women', 'shg', 'self-help', 'self help', 'business', 'entrepreneur', 'gruha', 'lakshmi', 'sanctity', 'female',
    'ಮಹಿಳೆ', 'ಮಹಿಳೆಯರು', 'ಸ್ವಸಹಾಯ', 'ಉದ್ಯಮ', 'ಸಂಘ', 'ಗೃಹ ಲಕ್ಷ್ಮಿ', 'ವ್ಯಾಪಾರ',
    'महिला', 'महिलाएं', 'स्वयं सहायता', 'उद्यमी', 'व्यापार', 'गृह लक्ष्मी'
  ],
  workers: [
    'worker', 'workers', 'labour', 'labor', 'wage', 'daily wage', 'construction', 'coolie',
    'ಕಾರ್ಮಿಕ', 'ಕಾರ್ಮಿಕರು', 'ಕೂಲಿ', 'ಶ್ರಮಿಕ', 'ದಿನಗೂಲಿ', 'ಕೆಲಸಗಾರ',
    'श्रमिक', 'मजदूर', 'दिहाड़ी', 'कामगार', 'श्रम'
  ],
  general: [
    'citizen', 'scheme', 'schemes', 'government', 'help', 'welfare', 'assistance', 'subsidy',
    'ನಾಗರಿಕ', 'ಯೋಜನೆ', 'ಯೋಜನೆಗಳು', 'ಸರ್ಕಾರ', 'ಸಹಾಯ', 'ಸೌಲಭ್ಯ',
    'नागरिक', 'योजना', 'सरकारी', 'मदद', 'सुविधा', 'कल्याण'
  ]
};

// Multilingual Karnataka District Names Map
const DISTRICT_MAP: Record<string, string> = {
  'mandya': 'Mandya',
  'ಮಂಡ್ಯ': 'Mandya',
  'मंड्या': 'Mandya',
  'mysuru': 'Mysuru',
  'mysore': 'Mysuru',
  'ಮೈಸೂರು': 'Mysuru',
  'मैसूर': 'Mysuru',
  'belagavi': 'Belagavi',
  'belgaum': 'Belagavi',
  'ಬೆಳಗಾವಿ': 'Belagavi',
  'बेलगावी': 'Belagavi',
  'bengaluru': 'Bengaluru Urban',
  'bangalore': 'Bengaluru Urban',
  'ಬೆಂಗಳೂರು': 'Bengaluru Urban',
  'बेंगलुरु': 'Bengaluru Urban',
  'hassan': 'Hassan',
  'ಹಾಸನ': 'Hassan',
  'हासन': 'Hassan',
  'tumakuru': 'Tumakuru',
  'tumkur': 'Tumakuru',
  'ತುಮಕೂರು': 'Tumakuru',
  'shivamogga': 'Shivamogga',
  'shimoga': 'Shivamogga',
  'ಶಿವಮೊಗ್ಗ': 'Shivamogga',
  'kalaburagi': 'Kalaburagi',
  'gulbarga': 'Kalaburagi',
  'ಕಲಬುರಗಿ': 'Kalaburagi',
  'ballari': 'Ballari',
  'bellary': 'Ballari',
  'ಬಳ್ಳಾರಿ': 'Ballari',
  'dharwad': 'Dharwad',
  'ಧಾರವಾಡ': 'Dharwad',
  'udupi': 'Udupi',
  'ಉಡುಪಿ': 'Udupi',
  'dakshina kannada': 'Dakshina Kannada',
  'ದಕ್ಷಿಣ ಕನ್ನಡ': 'Dakshina Kannada',
  'uttara kannada': 'Uttara Kannada',
  'ಉತ್ತರ ಕನ್ನಡ': 'Uttara Kannada',
  'kolar': 'Kolar',
  'ಕೋಲಾರ': 'Kolar',
  'ramanagara': 'Ramanagara',
  'ರಾಮನಗರ': 'Ramanagara'
};

export function detectBeneficiaryCategory(text: string): CitizenGroup | null {
  const lower = text.toLowerCase();

  for (const kw of KEYWORDS.farmers) {
    if (lower.includes(kw.toLowerCase())) return 'farmers';
  }
  for (const kw of KEYWORDS.students) {
    if (lower.includes(kw.toLowerCase())) return 'students';
  }
  for (const kw of KEYWORDS.women_entrepreneurs) {
    if (lower.includes(kw.toLowerCase())) return 'women_entrepreneurs';
  }
  for (const kw of KEYWORDS.workers) {
    if (lower.includes(kw.toLowerCase())) return 'workers';
  }
  for (const kw of KEYWORDS.general) {
    if (lower.includes(kw.toLowerCase())) return 'general';
  }

  return null;
}

export function detectIntent(text: string): DetectedIntent {
  const lower = text.toLowerCase();

  if (
    lower.includes('track') || lower.includes('status') || lower.includes('ಸ್ಥಿತಿ') || 
    lower.includes('ಪ್ರಗತಿ') || lower.includes('स्थिति') || lower.includes('ट्रैक') ||
    lower.includes('reference') || lower.includes('ಉಲ್ಲೇಖ')
  ) {
    return 'TRACK_APPLICATION';
  }

  if (
    lower.includes('upload') || lower.includes('document') || lower.includes('file') || 
    lower.includes('photo') || lower.includes('ದಾಖಲೆ') || lower.includes('ಅಪ್‌ಲೋಡ್') || 
    lower.includes('दस्तावेज़') || lower.includes('अपलोड')
  ) {
    return 'UPLOAD_DOCUMENTS';
  }

  if (
    lower.includes('eligible') || lower.includes('eligibility') || lower.includes('check') || 
    lower.includes('ಅರ್ಹತೆ') || lower.includes('ಪರಿಶೀಲಿಸಿ') || lower.includes('पात्रता') || 
    lower.includes('पात्र')
  ) {
    return 'CHECK_ELIGIBILITY';
  }

  if (
    lower.includes('find') || lower.includes('search') || lower.includes('which scheme') || 
    lower.includes('ಯಾವ ಯೋಜನೆ') || lower.includes('ಹುಡುಕಿ') || lower.includes('खोजें') || 
    lower.includes('बताएं') || lower.includes('योजनाएं')
  ) {
    return 'FIND_SCHEMES';
  }

  return 'ASK_QUESTION';
}

export function checkSensitiveData(text: string): boolean {
  // Regex for 12 digit Aadhaar-like number
  const aadhaarRegex = /\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/;
  if (aadhaarRegex.test(text)) return true;

  // Sensitive keywords followed or preceded by numbers (OTP, PIN, Password)
  const sensitiveKeywords = ['otp', 'password', 'pin', 'ಪಾಸ್‌ವರ್ಡ್', 'ಪಾಸವರ್ಡ', 'ओटीपी', 'पासवर्ड'];
  const lower = text.toLowerCase();
  for (const kw of sensitiveKeywords) {
    if (lower.includes(kw) && /\d{3,8}/.test(text)) {
      return true;
    }
  }

  return false;
}

export function extractNonSensitiveFacts(text: string): Partial<ApplicantProfile> {
  const lower = text.toLowerCase();
  const facts: Partial<ApplicantProfile> = {
    state: 'Karnataka'
  };

  // 1. Detect category
  const category = detectBeneficiaryCategory(text);
  if (category) {
    facts.beneficiary_group = category;
  }

  // 2. Multilingual District detection
  for (const [kw, dist] of Object.entries(DISTRICT_MAP)) {
    if (lower.includes(kw.toLowerCase())) {
      facts.district = dist;
      break;
    }
  }

  // 3. Land holding size (e.g. "1.5 acres", "2 acre", "2 ಎಕರೆ", "2 एकड़")
  const landMatch = text.match(/(\d+(\.\d+)?)\s*(acres?|acre|hectares?|ಎಕರೆ|एकड़)/i);
  if (landMatch && landMatch[1]) {
    const acres = parseFloat(landMatch[1]);
    facts.land_holding_acres = acres;
    facts.has_cultivable_land_record = true;
  }

  // 4. Student education level
  if (lower.includes('post-matric') || lower.includes('degree') || lower.includes('college') || lower.includes('ಪದವಿ') || lower.includes('ಕಾಲೇಜು')) {
    facts.education_level = 'Post-Matric / Undergraduate';
  } else if (lower.includes('school') || lower.includes('10th') || lower.includes('ಶಾಲೆ') || lower.includes('೧೦')) {
    facts.education_level = 'Pre-Matric / Secondary';
  }

  // 5. Cultivable land boolean
  if (lower.includes('land') || lower.includes('ಭೂಮಿ') || lower.includes('ಜಮೀನು') || lower.includes('rtc') || lower.includes('ಪಹಣಿ')) {
    facts.has_cultivable_land_record = true;
  }

  return facts;
}

export function analyzeCitizenMessage(message: string, currentLanguage: SupportedLanguage): NLUAnalysis {
  const containsSensitiveData = checkSensitiveData(message);
  const category = detectBeneficiaryCategory(message);
  const intent = detectIntent(message);
  const extractedFacts = extractNonSensitiveFacts(message);

  const needsClarification = !category && (intent === 'FIND_SCHEMES' || intent === 'CHECK_ELIGIBILITY');

  let clarifyingQuestion: string | undefined;
  if (needsClarification) {
    const questions: Record<SupportedLanguage, string> = {
      en: 'To help find the right government schemes, could you tell me: Are you inquiring as a farmer, student, woman entrepreneur, worker, or general citizen?',
      kn: 'ನಿಮಗೆ ಸೂಕ್ತವಾದ ಸರ್ಕಾರಿ ಯೋಜನೆಗಳನ್ನು ಹುಡುಕಲು ದಯವಿಟ್ಟು ತಿಳಿಸಿ: ನೀವು ರೈತರೇ, ವಿದ್ಯಾರ್ಥಿಯೇ, ಮಹಿಳಾ ಉದ್ಯಮಿಯೇ, ಕಾರ್ಮಿಕರೇ, ಅಥವಾ ಸಾಮಾನ್ಯ ನಾಗರಿಕರೇ?',
      hi: 'सही सरकारी योजना खोजने के लिए कृपया बताएं: क्या आप किसान, विद्यार्थी, महिला उद्यमी, श्रमिक या सामान्य नागरिक हैं?'
    };
    clarifyingQuestion = questions[currentLanguage];
  }

  return {
    beneficiaryGroup: category,
    intent,
    extractedFacts,
    containsSensitiveData,
    needsClarification,
    clarifyingQuestion
  };
}
