// Standard API types matching docs/API_CONTRACTS.md and backend models

export type SupportedLanguage = 'kn' | 'hi' | 'en';

/** Exact contracts exposed by the current FastAPI service under /api. */
export type EligibilityOutcome =
  | 'potentially_eligible'
  | 'not_eligible'
  | 'needs_information'
  | 'manual_review';

export interface ApiErrorResponse {
  detail?: string | Array<{ msg?: string; loc?: (string | number)[]; type?: string }> | Record<string, unknown>;
  status?: number;
  message?: string;
}

export interface SchemeDiscoveryRequest {
  beneficiary_group: string;
  state?: string;
  language?: SupportedLanguage;
  applicant_facts?: Record<string, unknown>;
  category?: string;
  jurisdiction?: string;
  status?: string;
  search_query?: string;
  page?: number;
  page_size?: number;
}

export interface EligibilityRuleResult {
  rule_id: string;
  outcome: EligibilityOutcome;
  message: string;
  field?: string | null;
}

export interface EligibilityResult {
  scheme_id: string;
  outcome: EligibilityOutcome;
  rule_results: EligibilityRuleResult[];
  missing_fields: string[];
  disclaimer: string;
}

export interface DiscoveredScheme {
  scheme_id: string;
  name: string;
  summary: string;
  description?: string;
  category?: string;
  department?: string;
  operational_status?: string;
  application_status?: string;
  application_window?: string;
  official_url?: string | null;
  official_application_url?: string | null;
  alternative_names?: string[];
  geographic_applicability?: string;
  benefit: {
    description?: string;
    amount_inr?: number | null;
    frequency?: string;
    [key: string]: unknown;
  };
  jurisdiction: string;
  verification_status: string;
  eligibility_status: EligibilityOutcome | 'not_configured';
  eligibility: EligibilityResult | null;
  required_documents: Array<Record<string, unknown>>;
  document_requirements?: Array<Record<string, unknown>>;
  mandatory_documents?: string[];
  important_dates?: Record<string, string>;
  important_current_notes: string[];
  official_urls: string[];
  sources: Array<{ source_id?: string; title?: string; publisher?: string; url?: string }>;
  last_checked: string | null;
}

export interface SchemeDiscoveryResponse {
  beneficiary_group: string;
  state: string;
  language: SupportedLanguage;
  candidate_count: number;
  total_candidates?: number;
  page?: number | null;
  page_size?: number | null;
  schemes: DiscoveredScheme[];
  notice: string;
}

export interface EligibilityRequest {
  scheme_id: string;
  applicant_facts: Record<string, unknown>;
}

export interface ChatRequest {
  message: string;
  beneficiary_group?: string;
  state: string;
  language: SupportedLanguage;
}

export interface ChatResponse {
  reply: string;
  language: SupportedLanguage;
  provider: string;
  model: string;
  is_simulated: boolean;
  scheme_ids: string[];
  needs_clarification: boolean;
  notice?: string;
  intent?: 'SCHEME_DISCOVERY' | 'SCHEME_INFORMATION' | 'ELIGIBILITY' | 'DOCUMENT_CHECKLIST' | 'APPLICATION_GUIDANCE' | 'GENERAL_CHAT';
  schemes?: DiscoveredScheme[];
}

// ─── Citizen & Beneficiary Group Types ───────────────────────────────────────
export type UppercaseCitizenGroup = 'FARMER' | 'STUDENT' | 'WOMAN_ENTREPRENEUR' | 'WAGE_WORKER' | 'OTHER';
export type LowercaseBeneficiaryGroup = 'farmers' | 'students' | 'women_entrepreneurs' | 'workers' | 'general';
export type CitizenGroup = UppercaseCitizenGroup | LowercaseBeneficiaryGroup;

export function toCitizenGroup(val: string): UppercaseCitizenGroup {
  const lower = val.toLowerCase().trim();
  if (lower.includes('farm') || lower.includes('ಕೃಷಿ') || lower.includes('ರೈತ') || lower.includes('किसान')) return 'FARMER';
  if (lower.includes('student') || lower.includes('ವಿದ್ಯಾರ್ಥಿ') || lower.includes('छात्र')) return 'STUDENT';
  if (lower.includes('women') || lower.includes('shg') || lower.includes('ಮಹಿಳೆ') || lower.includes('महिला')) return 'WOMAN_ENTREPRENEUR';
  if (lower.includes('work') || lower.includes('labour') || lower.includes('ಕಾರ್ಮಿಕ') || lower.includes('मजदूर')) return 'WAGE_WORKER';
  return 'OTHER';
}

export function toBeneficiaryKey(val: string): LowercaseBeneficiaryGroup {
  const lower = val.toLowerCase().trim();
  if (lower.includes('farm') || lower === 'farmer') return 'farmers';
  if (lower.includes('student')) return 'students';
  if (lower.includes('women') || lower.includes('shg')) return 'women_entrepreneurs';
  if (lower.includes('work') || lower.includes('wage')) return 'workers';
  return 'general';
}

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

export interface BackendScheme {
  scheme_id: string;
  record_type?: string;
  name: {
    en: string;
    kn: string;
    hi: string;
  };
  summary: string | {
    en: string;
    kn?: string;
    hi?: string;
  };
  beneficiary_groups: string[];
  jurisdiction: 'central' | 'state' | 'district' | 'unknown' | string;
  category?: string;
  department?: string;
  operational_status?: string;
  application_status?: string;
  application_window?: string;
  official_application_url?: string;
  official_url?: string;
  applicable_states: string[];
  benefit: {
    description?: string;
    amount_inr?: number | null;
    frequency?: string;
  };
  eligibility_rules?: Array<{
    rule_id: string;
    description?: string;
    field?: string;
    operator?: string;
    value?: any;
    effect?: 'require' | 'exclude';
    verification_status?: string;
    rule_type?: string;
    source_ids?: string[];
  }>;
  exclusions?: Array<{
    description: string;
    verification_status?: string;
    source_ids?: string[];
  }>;
  required_documents?: Array<{
    item: string;
    note?: string;
    verification_status?: string;
  }>;
  process?: string[];
  important_current_notes?: string[];
  official_urls?: string[];
  source_ids?: string[];
  verification_status?: string;
  last_checked?: string;
  review_notes?: string;
}

export type BackendDiscoveryRequest = SchemeDiscoveryRequest;
export type BackendDiscoveryResponse = SchemeDiscoveryResponse;
export type BackendEligibilityRequest = EligibilityRequest;
export type BackendEligibilityResult = EligibilityResult;
export type BackendRuleResult = EligibilityRuleResult;
export type BackendChatRequest = ChatRequest;
export type BackendChatResponse = ChatResponse;

export interface CitizenProfile {
  id?: string;
  phone_number?: string;
  name?: string;
  preferred_language?: string;
  citizen_group?: CitizenGroup | string;
  annual_income?: number;
  land_holding_acres?: number;
  has_bank_account?: boolean;
  caste_category?: 'GENERAL' | 'OBC' | 'SC' | 'ST';
  age?: number;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  village?: string;
  district?: string;
  state?: string;
  aadhaar_masked?: string;
  created_at?: string;
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

export interface ApplicantProfile {
  beneficiary_group: CitizenGroup;
  state: string;
  district: string;
  age_range?: string;
  education_level?: string;
  occupation?: string;
  has_cultivable_land_record?: boolean;
  land_holding_acres?: number;
  crop_notified?: boolean;
  crop_type?: string;
  is_institutional_landholder?: boolean;
  annual_income_range?: string;
  annual_income_inr?: number;
  has_bank_account?: boolean;
  self_help_group_member?: boolean;
  full_name?: string;
  village?: string;
  annual_income?: number;
}

export type DocumentTypeCode = 
  | 'AADHAAR' 
  | 'LAND_RECORD' 
  | 'INCOME_CERT' 
  | 'STUDENT_ID' 
  | 'BANK_PASSBOOK' 
  | 'RATION_CARD'
  | 'CASTE_CERT'
  | 'MARKS_CARD'
  | string;

export type OCRStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
export type ValidationStatus = 'PENDING' | 'VALID' | 'NEEDS_CORRECTION' | 'REJECTED';

export interface DocumentVerificationResult {
  document_id: string;
  document_type: DocumentTypeCode | string;
  file_name: string;
  uploaded_at: string;
  ocr_status: OCRStatus | string;
  validation_status: ValidationStatus | string;
  confidence_score: number;
  extracted_fields: Record<string, any>;
  is_verified: boolean;
  validation_notes?: string;
  thumbnail_url?: string;
  ocr_text?: string;
  citizen_confirmed_fields?: Record<string, any>;
  is_confirmed_by_user?: boolean;
  confirmation_notes?: string;
  confirmed_at?: string;
}

export interface DocumentAttachment {
  id: string;
  documentType: DocumentTypeCode;
  file: File | null;
  fileName: string;
  fileSize: number;
  fileUrl?: string;
  uploadedAt: string;
  status: 'LOCAL_ATTACHED' | 'UPLOADED' | 'FAILED_TO_UPLOAD' | 'NOT_IMPLEMENTED' | 'UPLOADING';
  extractedData?: Record<string, string>;
  confirmedData?: Record<string, string>;
  confidence?: number;
  lowConfidenceFields?: string[];
  isConfirmedByUser: boolean;
  notes?: string;
  citizenId?: string;
  applicationId?: string;
  backendDocId?: string;
  ocrText?: string;
  ocrStatus?: string;
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

export interface ApplicationDraft {
  draftId: string;
  schemeId: string;
  schemeName: string;
  applicantFacts: ApplicantProfile;
  eligibilityResult?: BackendEligibilityResult;
  attachments: DocumentAttachment[];
  preparedAt: string;
  lastEditedAt: string;
  isHandoffReady: boolean;
  officialUrls: string[];
}

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

// ─── Real Backend Service Schemas ───────────────────────────────────────────
export interface CitizenRegistrationRequest {
  phone_number: string;
  name?: string;
  preferred_language?: SupportedLanguage;
  citizen_group?: string;
  state?: string;
  district?: string;
  village?: string;
  aadhaar_masked?: string;
}

export interface CitizenRecord {
  id: string;
  phone_number: string;
  name?: string;
  preferred_language: SupportedLanguage;
  citizen_group?: string;
  state?: string;
  district?: string;
  village?: string;
  aadhaar_ref?: string;
  created_at: string;
}

export interface ApplicationDraftCreateRequest {
  citizen_id: string;
  scheme_id: string;
  applicant_data?: Record<string, any>;
}

export interface ApplicationDraftUpdateRequest {
  citizen_id: string;
  applicant_data: Record<string, any>;
}

export interface BackendApplicationDraft {
  id: string;
  citizen_id: string;
  scheme_id: string;
  current_status: string;
  submission_mode: string;
  progress_percentage: number;
  applicant_data: Record<string, any>;
  submission_reference?: string;
  submitted_at?: string;
  rejection_reason?: string;
  official_order_number?: string;
  is_simulated: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApplicationStatusHistoryItem {
  id: string;
  from_status?: string;
  to_status: string;
  remarks?: string;
  changed_by: string;
  created_at: string;
}

export interface UploadedDocumentRecord {
  id: string;
  citizen_id: string;
  application_id?: string;
  document_type: string;
  original_filename: string;
  stored_filename: string;
  file_size_bytes: number;
  mime_type: string;
  sha256_hash: string;
  ocr_status: string;
  validation_status: string;
  created_at: string;
}
