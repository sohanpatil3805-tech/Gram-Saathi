import {
  Scheme,
  CitizenProfile,
  EligibilityAssessmentResult,
  DocumentVerificationResult,
  ApplicationPreview,
  ApplicationSubmissionResult,
  DocumentTypeCode,
} from '../types/api';
import {
  ApplicationRecord,
  DashboardStats,
  OfficerDecisionPayload,
  OfficerUser,
} from '../types/officer';
import {
  MOCK_SCHEMES,
  SAMPLE_OCR_SAMPLES,
  INITIAL_OFFICER_APPLICATIONS,
} from './mockData';

// In-memory state for client-side demo persistence
let applicationsState: ApplicationRecord[] = [...INITIAL_OFFICER_APPLICATIONS];

// Helper delay to simulate network latency realistically
const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));

export const mockService = {
  // 1. Schemes
  async getSchemes(params?: {
    category?: string;
    target_group?: string;
    search?: string;
  }): Promise<Scheme[]> {
    await delay(250);
    let list = [...MOCK_SCHEMES];

    if (params?.category && params.category !== 'ALL') {
      list = list.filter((s) => s.category === params.category);
    }
    if (params?.target_group && params.target_group !== 'ALL') {
      list = list.filter((s) => s.target_group === params.target_group);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.kn.toLowerCase().includes(q) ||
          s.name.hi.toLowerCase().includes(q) ||
          s.name.en.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q)
      );
    }
    return list;
  },

  async getSchemeById(schemeId: string): Promise<Scheme | undefined> {
    await delay(150);
    return MOCK_SCHEMES.find((s) => s.id === schemeId);
  },

  // 2. Deterministic Eligibility Assessment
  async assessEligibility(
    schemeId: string,
    profile: CitizenProfile
  ): Promise<EligibilityAssessmentResult> {
    await delay(400);
    const scheme = MOCK_SCHEMES.find((s) => s.id === schemeId);
    if (!scheme) {
      throw new Error('Scheme not found');
    }

    const matched: EligibilityAssessmentResult['matched_criteria'] = [];
    const unmet: EligibilityAssessmentResult['unmet_criteria'] = [];

    // Evaluate rules deterministically against criteria
    for (const rule of scheme.eligibility_rules) {
      const citizenVal = (profile as any)[rule.field];

      let isMatch = false;
      if (rule.operator === '==') {
        isMatch = citizenVal === rule.value;
      } else if (rule.operator === '<=') {
        isMatch = citizenVal !== undefined && Number(citizenVal) <= Number(rule.value);
      } else if (rule.operator === '>=') {
        isMatch = citizenVal !== undefined && Number(citizenVal) >= Number(rule.value);
      }

      if (isMatch) {
        matched.push({
          criterion_key: rule.field,
          criterion_name: rule.description.kn,
          citizen_value: citizenVal,
          expected_value: rule.value,
        });
      } else {
        unmet.push({
          criterion_key: rule.field,
          criterion_name: rule.description.kn,
          citizen_value: citizenVal,
          expected_value: rule.value,
          reason: `Required: ${rule.value}, provided: ${citizenVal ?? 'Not specified'}`,
        });
      }
    }

    const totalRules = scheme.eligibility_rules.length;
    const score = totalRules > 0 ? Math.round((matched.length / totalRules) * 100) : 100;
    const eligible = unmet.length === 0;

    return {
      eligible,
      score,
      confidence: score >= 80 ? 'HIGH' : score >= 50 ? 'MEDIUM' : 'LOW',
      matched_criteria: matched,
      unmet_criteria: unmet,
      missing_data_fields: [],
    };
  },

  // 3. Document Upload & OCR Processing Simulation
  async uploadAndProcessDocument(
    sampleKey: 'valid_aadhaar' | 'valid_land_record' | 'blurry_document' | 'valid_student_id' = 'valid_aadhaar',
    customDocType?: DocumentTypeCode
  ): Promise<DocumentVerificationResult> {
    await delay(800); // realistic OCR processing delay
    const baseSample = SAMPLE_OCR_SAMPLES[sampleKey] || SAMPLE_OCR_SAMPLES.valid_aadhaar;

    return {
      ...baseSample,
      document_id: `doc-${Date.now()}`,
      document_type: customDocType || baseSample.document_type,
      uploaded_at: new Date().toISOString(),
    };
  },

  // 4. Consequential Confirmation Token & Preview
  async generateApplicationPreview(
    schemeId: string,
    profile: CitizenProfile,
    applicantName = 'Ramu Nayak (ರಾಮು ನಾಯಕ್)'
  ): Promise<ApplicationPreview> {
    await delay(300);
    const scheme = MOCK_SCHEMES.find((s) => s.id === schemeId) || MOCK_SCHEMES[0];
    const appId = `app-draft-${Date.now()}`;
    const token = `tok_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    return {
      application_id: appId,
      scheme_name: scheme.name.kn,
      scheme_code: scheme.code,
      preview_summary: {
        applicant_name: applicantName,
        phone_number: '+91 98765-XXXX0',
        village: profile.village || 'Maddur (ಮದ್ದೂರು)',
        district: profile.district || 'Mandya (ಮಂಡ್ಯ)',
        key_details: {
          'Citizen Group': profile.citizen_group,
          'Land Holding': profile.land_holding_acres ? `${profile.land_holding_acres} Acres` : 'N/A',
          'Annual Income': `₹${profile.annual_income?.toLocaleString('en-IN') || '80,000'}`,
          'Bank Account Status': profile.has_bank_account ? 'Aadhaar-Linked Active' : 'Not linked',
        },
        benefit_amount: scheme.benefit_amount || '₹6,000 / Year',
      },
      confirmation_token: token,
      token_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      ttl_seconds: 300,
    };
  },

  // 5. Submit Application (Consuming Single-Use Token)
  async submitApplication(
    applicationId: string,
    token: string,
    preview: ApplicationPreview,
    documents: DocumentVerificationResult[] = []
  ): Promise<ApplicationSubmissionResult> {
    await delay(600);
    const simRef = `SIM-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const now = new Date().toISOString();

    const newRecord: ApplicationRecord = {
      id: applicationId,
      application_reference: simRef,
      scheme_id: preview.scheme_code,
      scheme_name: preview.scheme_name,
      scheme_code: preview.scheme_code,
      applicant: {
        id: `cit-${Date.now()}`,
        full_name: preview.preview_summary.applicant_name,
        phone_masked: preview.preview_summary.phone_number,
        citizen_group: 'FARMER',
        village: preview.preview_summary.village,
        taluk: 'Maddur',
        district: preview.preview_summary.district,
        annual_income: 80000,
        land_holding_acres: 1.5,
        has_bank_account: true,
      },
      submitted_at: now,
      updated_at: now,
      status: 'OFFICER_REVIEW',
      submission_mode: 'DIRECT_CITIZEN',
      documents: documents.length > 0 ? documents : [SAMPLE_OCR_SAMPLES.valid_aadhaar],
      eligibility_score: 95,
      assigned_office: 'Maddur Gram Panchayat (ಮದ್ದೂರು ಗ್ರಾಮ ಪಂಚಾಯತ್)',
      remarks: 'Submitted via citizen chatbot. 5-minute single-use token verified.',
      audit_history: [
        {
          timestamp: now,
          action: 'CITIZEN_SUBMITTED',
          actor_name: preview.preview_summary.applicant_name,
          actor_role: 'CITIZEN',
          notes: `Token ${token} verified and consumed. Reference ${simRef} assigned.`,
        },
      ],
    };

    // Prepend to mock database state
    applicationsState = [newRecord, ...applicationsState];

    return {
      application_id: applicationId,
      status: 'SUBMITTED',
      submission_reference: simRef,
      submitted_at: now,
      is_simulated: true,
      message: `ಅರ್ಜಿ ಯಶಸ್ವಿಯಾಗಿ ಸಲ್ಲಿಕೆಯಾಗಿದೆ! ಉಲ್ಲೇಖ ಸಂಖ್ಯೆ: ${simRef}`,
    };
  },

  // 6. Officer Application Management
  async getOfficerApplications(filters?: {
    status?: string;
    search?: string;
    village?: string;
  }): Promise<ApplicationRecord[]> {
    await delay(200);
    let list = [...applicationsState];

    if (filters?.status && filters.status !== 'ALL') {
      list = list.filter((a) => a.status === filters.status);
    }
    if (filters?.village && filters.village !== 'ALL') {
      list = list.filter((a) =>
        a.applicant.village.toLowerCase().includes(filters.village!.toLowerCase())
      );
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (a) =>
          a.application_reference.toLowerCase().includes(q) ||
          a.applicant.full_name.toLowerCase().includes(q) ||
          a.scheme_name.toLowerCase().includes(q)
      );
    }
    return list;
  },

  async getOfficerApplicationById(id: string): Promise<ApplicationRecord | undefined> {
    await delay(150);
    return applicationsState.find((a) => a.id === id || a.application_reference === id);
  },

  async recordOfficerDecision(
    applicationId: string,
    payload: OfficerDecisionPayload,
    officer: OfficerUser
  ): Promise<ApplicationRecord> {
    await delay(500);
    const index = applicationsState.findIndex((a) => a.id === applicationId);
    if (index === -1) {
      throw new Error('Application not found');
    }

    const current = applicationsState[index];
    const now = new Date().toISOString();

    let newStatus = current.status;
    let actionName = 'OFFICER_REVIEW';

    if (payload.decision === 'APPROVE') {
      newStatus = 'APPROVED';
      actionName = 'OFFICER_APPROVED';
    } else if (payload.decision === 'REJECT') {
      newStatus = 'REJECTED';
      actionName = 'OFFICER_REJECTED';
    } else if (payload.decision === 'REQUEST_CORRECTION') {
      newStatus = 'NEEDS_CORRECTION';
      actionName = 'CORRECTION_REQUESTED';
    }

    const updated: ApplicationRecord = {
      ...current,
      status: newStatus,
      official_order_number: payload.official_order_number || current.official_order_number,
      remarks: payload.remarks || current.remarks,
      updated_at: now,
      audit_history: [
        ...current.audit_history,
        {
          timestamp: now,
          action: actionName,
          actor_name: officer.full_name,
          actor_role: officer.role,
          notes: payload.remarks || `Decision recorded: ${payload.decision}`,
        },
      ],
    };

    applicationsState[index] = updated;
    return updated;
  },

  async getDashboardStats(): Promise<DashboardStats> {
    await delay(200);
    const total = applicationsState.length;
    const pending = applicationsState.filter(
      (a) => a.status === 'OFFICER_REVIEW' || a.status === 'SUBMITTED' || a.status === 'UNDER_VERIFICATION'
    ).length;
    const approved = applicationsState.filter((a) => a.status === 'APPROVED').length;
    const rejected = applicationsState.filter((a) => a.status === 'REJECTED').length;
    const needsCorrection = applicationsState.filter(
      (a) => a.status === 'NEEDS_CORRECTION'
    ).length;

    return {
      total_applications: total,
      pending_review: pending,
      approved_applications: approved,
      rejected_applications: rejected,
      needs_correction: needsCorrection,
      today_received: 4,
      average_turnaround_hours: 18.5,
    };
  },
};
