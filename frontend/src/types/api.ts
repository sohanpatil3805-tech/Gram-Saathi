// Standard API types matching docs/API_CONTRACTS.md

export type SupportedLanguage = 'kn' | 'hi';

export type CitizenGroup = 'FARMER' | 'STUDENT' | 'WOMAN_ENTREPRENEUR' | 'WAGE_WORKER' | 'OTHER';

export type SchemeCategory = 
  | 'AGRICULTURE' 
  | 'EDUCATION' 
  | 'WOMEN_WELFARE' 
  | 'HEALTHCARE' 
  | 'FINANCIAL_INCLUSION' 
  | 'SOCIAL_SECURITY';

export interface SchemeDocumentRequirement {
  requirement_id: string;
  document_type_code: string;
  name: string;
  is_mandatory: boolean;
  order_index: number;
  instructions: {
    kn: string;
    hi: string;
    en?: string;
  };
}

export interface Scheme {
  id: string;
  code: string;
  name: {
    kn: string;
    hi: string;
    en: string;
  };
  department: {
    kn: string;
    hi: string;
    en: string;
  };
  category: SchemeCategory;
  target_group: CitizenGroup;
  benefit_summary: {
    kn: string;
    hi: string;
    en: string;
  };
  benefit_amount?: string;
  description: {
    kn: string;
    hi: string;
    en: string;
  };
  is_active: boolean;
  eligibility_rules: Array<{
    field: string;
    operator: string;
    value: string | number | boolean;
    description: {
      kn: string;
      hi: string;
      en: string;
    };
  }>;
  required_documents: SchemeDocumentRequirement[];
}

export interface CitizenProfile {
  citizen_group: CitizenGroup;
  annual_income: number;
  land_holding_acres?: number;
  has_bank_account: boolean;
  caste_category?: 'GENERAL' | 'OBC' | 'SC' | 'ST';
  age?: number;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  village?: string;
  district?: string;
}

export interface EligibilityAssessmentResult {
  eligible: boolean;
  score: number; // 0-100
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  matched_criteria: Array<{
    criterion_key: string;
    criterion_name: string;
    citizen_value: any;
    expected_value: any;
  }>;
  unmet_criteria: Array<{
    criterion_key: string;
    criterion_name: string;
    citizen_value: any;
    expected_value: any;
    reason: string;
  }>;
  missing_data_fields: string[];
}

export type DocumentTypeCode = 
  | 'AADHAAR' 
  | 'LAND_RECORD' 
  | 'INCOME_CERT' 
  | 'STUDENT_ID' 
  | 'BANK_PASSBOOK' 
  | 'RATION_CARD';

export type OCRStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
export type ValidationStatus = 'PENDING' | 'VALID' | 'NEEDS_CORRECTION' | 'REJECTED';

export interface DocumentVerificationResult {
  document_id: string;
  document_type: DocumentTypeCode;
  file_name: string;
  uploaded_at: string;
  ocr_status: OCRStatus;
  validation_status: ValidationStatus;
  confidence_score: number;
  extracted_fields: Record<string, any>;
  is_verified: boolean;
  validation_notes?: string;
  thumbnail_url?: string;
}

export type ApplicationStatus = 
  | 'DRAFT'
  | 'DOC_COLLECTION'
  | 'CONFIRMATION_PENDING'
  | 'SUBMITTED'
  | 'UNDER_VERIFICATION'
  | 'OFFICER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'NEEDS_CORRECTION';

export interface ApplicationPreview {
  application_id: string;
  scheme_name: string;
  scheme_code: string;
  preview_summary: {
    applicant_name: string;
    phone_number: string;
    village: string;
    district: string;
    key_details: Record<string, string>;
    benefit_amount: string;
  };
  confirmation_token: string;
  token_expires_at: string;
  ttl_seconds: number;
}

export interface ApplicationSubmissionResult {
  application_id: string;
  status: ApplicationStatus;
  submission_reference: string;
  submitted_at: string;
  is_simulated: boolean;
  message: string;
}
