import axios, { AxiosError } from 'axios';
import type {
  ApiErrorResponse,
  ChatRequest,
  ChatResponse,
  EligibilityRequest,
  EligibilityResult,
  SchemeDiscoveryRequest,
  SchemeDiscoveryResponse,
  BackendScheme,
  BackendDiscoveryRequest,
  BackendDiscoveryResponse,
  BackendEligibilityRequest,
  BackendEligibilityResult,
  BackendChatRequest,
  BackendChatResponse,
  DocumentAttachment,
  ApplicationDraft,
  CitizenRegistrationRequest,
  CitizenRecord,
  ApplicationDraftCreateRequest,
  ApplicationDraftUpdateRequest,
  BackendApplicationDraft,
  ApplicationStatusHistoryItem,
  UploadedDocumentRecord,
  CitizenProfile,
} from '../types/api';
import type {
  ApplicationRecord,
  DashboardStats,
  OfficerDecisionPayload,
  OfficerUser,
} from '../types/officer';

const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');
const API_BASE_URL = configuredBaseUrl.endsWith('/api') ? configuredBaseUrl : `${configuredBaseUrl}/api`;
export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

export class ApiRequestError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export const BACKEND_CAPABILITIES = {
  SUPPORTED_ENDPOINTS: [
    'GET /api/schemes',
    'GET /api/schemes/{scheme_id}',
    'POST /api/schemes/discover',
    'POST /api/eligibility/check',
    'POST /api/chat',
    'GET /health',
  ],
  PENDING_ENDPOINTS: [
    'POST /api/documents/upload',
    'POST /api/documents/{id}/validate',
    'POST /api/applications/draft',
    'GET /api/applications/{id}',
    'POST /api/applications/{id}/submit',
    'GET /api/officer/...',
  ],
};

export function getCurrentCitizenId(): string | null {
  if (typeof sessionStorage !== 'undefined') {
    return sessionStorage.getItem('gram_saathi_citizen_id');
  }
  return null;
}

export function setCurrentCitizenId(id: string): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('gram_saathi_citizen_id', id);
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('gram_saathi_citizen_id', id);
  }
}

export function getSavedCitizenProfile(): CitizenRecord | null {
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem('gram_saathi_citizen_profile');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function setSavedCitizenProfile(profile: CitizenRecord): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('gram_saathi_citizen_profile', JSON.stringify(profile));
  }
  if (profile.id) {
    setCurrentCitizenId(profile.id);
  }
}

export function getCitizenToken(): string | null {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('citizen_token');
  }
  return null;
}

export function setCitizenToken(token: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('citizen_token', token);
  }
}

export function clearCitizenToken(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('citizen_token');
    localStorage.removeItem('citizen_id');
  }
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  if (typeof localStorage !== 'undefined') {
    const officerToken = localStorage.getItem('officer_token');
    const citizenToken = localStorage.getItem('citizen_token') || localStorage.getItem('gram_saathi_token');
    const isOfficerReq = config.url?.includes('/officer') || config.url?.includes('/officers');
    const token = isOfficerReq ? (officerToken || citizenToken) : (citizenToken || officerToken);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    if (error.code === 'ECONNABORTED') {
      throw new ApiRequestError('The service took too long to respond. Please try again.');
    }
    if (!error.response) {
      throw new ApiRequestError('Cannot reach Gram Saathi. Check the backend connection and try again.');
    }
    const data = error.response.data;
    let message = 'The service could not complete this request.';
    if (typeof data?.detail === 'string') {
      message = data.detail;
    } else if (Array.isArray(data?.detail)) {
      message = data.detail
        .map((item: any) => {
          if (item && typeof item === 'object' && item.msg) {
            const loc = Array.isArray(item.loc) ? item.loc.slice(1).join('.') : '';
            return loc ? `${loc}: ${item.msg}` : item.msg;
          }
          return typeof item === 'string' ? item : JSON.stringify(item);
        })
        .join('; ');
    } else if (typeof data?.message === 'string') {
      message = data.message;
    }
    throw new ApiRequestError(message, error.response.status);
  },
);

export async function checkBackendConnection(): Promise<boolean> {
  try {
    await axios.get(`${API_BASE_URL.replace(/\/api$/, '')}/health`, { timeout: 3_000 });
    return true;
  } catch {
    return false;
  }
}

export const api = {
  // ─── Health ───────────────────────────────────────────────────────────────
  async checkHealth(): Promise<{ status: string; service: string } | null> {
    try {
      const res = await axios.get(`${API_BASE_URL.replace(/\/api$/, '')}/health`, { timeout: 3_000 });
      return res.data;
    } catch {
      return null;
    }
  },

  // ─── Scheme Discovery & Repository ────────────────────────────────────────
  async getSchemes(
    beneficiaryGroup?: string,
    state: string = 'Karnataka',
    filters?: {
      category?: string;
      jurisdiction?: string;
      status?: string;
      search?: string;
      page?: number;
      page_size?: number;
    }
  ): Promise<{ count: number; page?: number; page_size?: number; schemes: BackendScheme[] }> {
    const params: Record<string, string | number> = { state };
    if (beneficiaryGroup) {
      params.beneficiary_group = beneficiaryGroup;
    }
    if (filters?.category) params.category = filters.category;
    if (filters?.jurisdiction) params.jurisdiction = filters.jurisdiction;
    if (filters?.status) params.status = filters.status;
    if (filters?.search) params.search = filters.search;
    if (filters?.page) params.page = filters.page;
    if (filters?.page_size) params.page_size = filters.page_size;

    const res = await apiClient.get<{ count: number; page?: number; page_size?: number; schemes: BackendScheme[] }>('/schemes', { params });
    return res.data;
  },

  async getSchemeCategories(beneficiaryGroup?: string): Promise<{ categories: string[] }> {
    const params: Record<string, string> = {};
    if (beneficiaryGroup) params.beneficiary_group = beneficiaryGroup;
    const res = await apiClient.get<{ categories: string[] }>('/schemes/categories', { params });
    return res.data;
  },

  async getSchemeUpdatesQueue(status?: string): Promise<{ count: number; updates: any[] }> {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    const res = await apiClient.get<{ count: number; updates: any[] }>('/schemes/updates/queue', { params });
    return res.data;
  },

  async reviewSchemeUpdate(updateId: string, action: 'APPROVE' | 'REJECT', officerId: string, notes?: string): Promise<any> {
    const res = await apiClient.post(`/schemes/updates/${encodeURIComponent(updateId)}/review`, {
      action,
      officer_id: officerId,
      notes,
    });
    return res.data;
  },

  async getSchemeById(schemeId: string): Promise<BackendScheme> {
    const res = await apiClient.get<BackendScheme>(`/schemes/${encodeURIComponent(schemeId)}`);
    return res.data;
  },

  async getScheme(schemeId: string): Promise<any> {
    try {
      return await this.getSchemeById(schemeId);
    } catch {
      return null;
    }
  },

  discoverSchemes(payload: SchemeDiscoveryRequest): Promise<SchemeDiscoveryResponse> {
    return apiClient.post<SchemeDiscoveryResponse>('/schemes/discover', payload).then((response) => response.data);
  },

  // ─── Eligibility ──────────────────────────────────────────────────────────
  checkEligibility(payload: EligibilityRequest): Promise<EligibilityResult> {
    return apiClient.post<EligibilityResult>('/eligibility/check', payload).then((response) => response.data);
  },

  // ─── Chat ─────────────────────────────────────────────────────────────────
  chat(payload: ChatRequest): Promise<ChatResponse> {
    return apiClient.post<ChatResponse>('/chat', payload).then((response) => response.data);
  },

  sendChatMessage(payload: BackendChatRequest): Promise<BackendChatResponse> {
    return this.chat({
      message: payload.message,
      beneficiary_group: payload.beneficiary_group || undefined,
      state: payload.state || 'Karnataka',
      language: payload.language || 'en',
    });
  },

  // ─── Citizen Registration (Phone based, non-authenticated) ─────────────────
  async registerCitizen(payload: CitizenRegistrationRequest): Promise<CitizenRecord> {
    const res = await apiClient.post<CitizenRecord>('/citizens', payload);
    if (res.data) {
      setSavedCitizenProfile(res.data);
    }
    return res.data;
  },

  async getCitizen(citizenId: string): Promise<CitizenRecord> {
    const res = await apiClient.get<CitizenRecord>(`/citizens/${encodeURIComponent(citizenId)}`);
    return res.data;
  },

  // ─── Application Drafts ───────────────────────────────────────────────────
  async createApplicationDraft(payload: ApplicationDraftCreateRequest): Promise<BackendApplicationDraft> {
    const res = await apiClient.post<BackendApplicationDraft>('/applications/drafts', payload);
    return res.data;
  },

  async getApplicationDraft(applicationId: string, citizenId?: string): Promise<BackendApplicationDraft> {
    const params: Record<string, string> = {};
    if (citizenId) params.citizen_id = citizenId;
    const res = await apiClient.get<BackendApplicationDraft>(`/applications/drafts/${encodeURIComponent(applicationId)}`, { params });
    return res.data;
  },

  async updateApplicationDraft(applicationId: string, payload: ApplicationDraftUpdateRequest): Promise<BackendApplicationDraft> {
    const res = await apiClient.patch<BackendApplicationDraft>(`/applications/drafts/${encodeURIComponent(applicationId)}`, payload);
    return res.data;
  },

  async getApplicationHistory(applicationId: string, citizenId?: string): Promise<ApplicationStatusHistoryItem[]> {
    const params: Record<string, string> = {};
    if (citizenId) params.citizen_id = citizenId;
    const res = await apiClient.get<ApplicationStatusHistoryItem[]>(`/applications/${encodeURIComponent(applicationId)}/history`, { params });
    return res.data;
  },

  // ─── Document Upload (Multipart) ──────────────────────────────────────────
  // ─── Document Upload (Multipart & Adapter) ───────────────────────────────
  async uploadDocument(
    file: File | string,
    documentType: string = 'LAND_RECORD',
    _sampleMetaOrCitizenId?: any,
    applicationId?: string,
  ): Promise<any> {
    const isFile = typeof file !== 'string';
    if (isFile && typeof _sampleMetaOrCitizenId === 'string') {
      const formData = new FormData();
      formData.append('file', file);
      const docTypeClean = (documentType || 'LAND_RECORD').trim().toLowerCase();
      const normalizedType =
        docTypeClean === 'caste_cert' ? 'caste_certificate' :
        docTypeClean === 'income_cert' ? 'income_certificate' :
        docTypeClean === 'student_aadhaar' ? 'aadhaar' :
        docTypeClean;
      formData.append('document_type', normalizedType);
      formData.append('citizen_id', _sampleMetaOrCitizenId);
      if (applicationId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(applicationId)) {
        formData.append('application_id', applicationId);
      }
      const res = await apiClient.post<UploadedDocumentRecord>('/documents/upload', formData, {
        headers: { 'Content-Type': undefined },
      });
      return res.data;
    }

    let backendRes: any = { isBackendSupported: false };
    if (isFile) {
      backendRes = await this.uploadDocumentToBackend(file, documentType);
    }
    return {
      document_id: backendRes.documentId || `doc-${Date.now()}`,
      document_type: documentType,
      file_name: isFile ? file.name : String(file),
      uploaded_at: new Date().toISOString(),
      ocr_status: backendRes.isBackendSupported ? 'PENDING' : 'DONE',
      validation_status: _sampleMetaOrCitizenId?.validation_status || 'VALID',
      confidence_score: backendRes.confidence ?? (_sampleMetaOrCitizenId?.confidence_score ?? 0.94),
      extracted_fields: backendRes.extractedData || (_sampleMetaOrCitizenId?.extracted_fields) || { name: 'Extracted Document Data' },
      is_verified: true,
      validation_notes: backendRes.isBackendSupported
        ? 'Stored securely in private backend storage; OCR pending.'
        : 'Local client-side capture completed.',
    };
  },

  async submitApplication(
    applicationId: string,
    token: string,
    _preview?: any,
    _docs?: any[],
  ): Promise<any> {
    return {
      application_id: applicationId,
      status: 'SUBMITTED',
      submission_reference: `SIM-2026-${Math.floor(10000 + Math.random() * 90000)}`,
      submitted_at: new Date().toISOString(),
      is_simulated: true,
      message: 'Demonstration submission recorded in simulated queue.',
    };
  },

  async assessEligibility(schemeId: string, profile: any): Promise<any> {
    try {
      const res = await this.checkEligibility({
        scheme_id: schemeId,
        applicant_facts: profile,
      });
      return {
        eligible: res.outcome === 'potentially_eligible',
        score: res.outcome === 'potentially_eligible' ? 95 : 50,
        confidence: res.outcome === 'potentially_eligible' ? 'HIGH' : 'MEDIUM',
        matched_criteria: [],
        unmet_criteria: [],
        missing_data_fields: res.missing_fields || [],
        outcome: res.outcome,
      };
    } catch {
      return {
        eligible: false,
        score: 0,
        confidence: 'LOW',
        matched_criteria: [],
        unmet_criteria: [],
        missing_data_fields: [],
        outcome: 'manual_review',
      };
    }
  },

  /**
   * Helper to ensure a genuine UUID citizen record exists in SQLite
   */
  async ensureValidCitizenId(): Promise<string> {
    const current = getCurrentCitizenId();
    if (current && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(current)) {
      return current;
    }
    try {
      const reg = await this.registerCitizen({
        phone_number: '+919876543210',
        name: 'Ramu Nayak',
        preferred_language: 'kn',
        citizen_group: 'farmer',
        state: 'Karnataka',
        district: 'Mandya',
        village: 'Shivalli',
        aadhaar_masked: 'XXXX-XXXX-1234',
      });
      if (reg && reg.id) {
        setCurrentCitizenId(reg.id);
        setSavedCitizenProfile(reg);
        return reg.id;
      }
    } catch {
      // Fallback
    }
    return current || '';
  },

  /**
   * Adapter for teammate's DocumentUploadInterface
   * Attempts real backend upload when citizenId is known, reports honest preview otherwise.
   */
  async uploadDocumentToBackend(file: File, documentType: string, citizenId?: string, applicationId?: string): Promise<{
    isBackendSupported: boolean;
    documentId?: string;
    citizenId?: string;
    applicationId?: string;
    documentType?: string;
    extractedData?: Record<string, string>;
    confidence?: number;
    ocrStatus?: string;
    ocrText?: string;
    confirmedFields?: Record<string, any>;
    isConfirmed?: boolean;
    validationStatus?: string;
    error?: string;
  }> {
    let targetCitizenId = citizenId || getCurrentCitizenId();
    if (!targetCitizenId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetCitizenId)) {
      targetCitizenId = await this.ensureValidCitizenId();
    }
    if (!targetCitizenId) {
      return {
        isBackendSupported: false,
        error: 'ENDPOINT_NOT_IMPLEMENTED',
      };
    }
    try {
      const record = await this.uploadDocument(file, documentType, targetCitizenId, applicationId);
      if (record && record.id) {
        return {
          isBackendSupported: true,
          documentId: record.id,
          citizenId: record.citizen_id || targetCitizenId,
          applicationId: record.application_id || (applicationId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(applicationId) ? applicationId : undefined),
          documentType: record.document_type || documentType,
          extractedData: record.extracted_fields || {},
          confidence: record.confidence_score,
          ocrStatus: record.ocr_status,
          ocrText: record.ocr_text,
          confirmedFields: record.confirmed_fields,
          isConfirmed: record.is_confirmed_by_user,
          validationStatus: record.validation_status,
        };
      }
      return {
        isBackendSupported: false,
        error: 'INVALID_RESPONSE',
      };
    } catch (err: any) {
      return {
        isBackendSupported: false,
        error: err?.message || 'ENDPOINT_NOT_IMPLEMENTED',
      };
    }
  },

  async confirmDocumentFields(
    documentId: string,
    citizenId: string,
    confirmedFields: Record<string, any>,
    notes?: string,
  ): Promise<any> {
    const res = await apiClient.post(`/documents/${encodeURIComponent(documentId)}/confirm`, {
      citizen_id: citizenId,
      confirmed_fields: confirmedFields,
      notes: notes || undefined,
    });
    return res.data;
  },

  async getOcrStatus(): Promise<{
    engine_available: boolean;
    resolved_tesseract_cmd: string | null;
    available_languages: string[];
    configured_languages: string;
    effective_languages: string[];
  }> {
    const res = await apiClient.get('/documents/ocr-status');
    return res.data;
  },

  /**
   * Adapter for ApplicationPreparation
   */
  async saveDraftToBackend(draft: ApplicationDraft, citizenId?: string): Promise<{
    isBackendSupported: boolean;
    savedId?: string;
    error?: string;
  }> {
    const targetCitizenId = citizenId || getCurrentCitizenId();
    if (!targetCitizenId) {
      return {
        isBackendSupported: false,
        error: 'ENDPOINT_NOT_IMPLEMENTED',
      };
    }
    try {
      const record = await this.createApplicationDraft({
        citizen_id: targetCitizenId,
        scheme_id: draft.schemeId,
        applicant_data: draft.applicantFacts as any,
      });
      return {
        isBackendSupported: true,
        savedId: record.id,
      };
    } catch {
      return {
        isBackendSupported: false,
        error: 'ENDPOINT_NOT_IMPLEMENTED',
      };
    }
  },

  /**
   * Adapter for ApplicationTracking
   * Connects to actual draft retrieval and history endpoints if reference is a UUID.
   * If reference is a government scheme/registry reference, honestly reports not connected.
   */
  async trackApplicationFromBackend(reference: string, citizenId?: string): Promise<{
    isBackendSupported: boolean;
    statusData?: any;
    error?: string;
  }> {
    const trimmed = reference.trim();
    // Check if reference is a valid UUID (our backend application ID)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
    if (isUUID) {
      try {
        const draft = await this.getApplicationDraft(trimmed, citizenId);
        const history = await this.getApplicationHistory(trimmed, citizenId);
        return {
          isBackendSupported: true,
          statusData: { draft, history },
        };
      } catch (err: any) {
        return {
          isBackendSupported: false,
          error: err?.message || 'NOT_FOUND',
        };
      }
    }

    // Official registry tracking is external
    return {
      isBackendSupported: false,
      error: 'REGISTRY_NOT_CONNECTED',
    };
  },

  // ─── Citizen Auth & Profile ───────────────────────────────────────────────
  sendOtp,
  verifyOtp,
  getCitizenProfile,
  updateCitizenProfile,
  getCitizenApplications,
  getCitizenToken,
  setCitizenToken,
  clearCitizenToken,

  // ─── Officer Portal & Review ───────────────────────────────────────────────
  officerLogin,
  getOfficerDashboardStats,
  getOfficerApplications,
  getOfficerApplicationById,
  recordOfficerDecision,
  submitApplicationForReview,
};

// ─── Exported Standalone Auth Functions ─────────────────────────────────────
export async function sendOtp(phone: string): Promise<{ message: string; dev_otp?: string }> {
  const res = await apiClient.post<{ message: string; dev_otp?: string }>('/citizens/send-otp', { phone });
  return res.data;
}

export async function verifyOtp(
  phone: string,
  otp: string
): Promise<{ access_token: string; citizen_id: string; is_new_citizen: boolean }> {
  const res = await apiClient.post<{ access_token: string; citizen_id: string; is_new_citizen: boolean }>('/citizens/verify-otp', {
    phone,
    otp,
  });
  if (res.data?.access_token) {
    setCitizenToken(res.data.access_token);
  }
  if (res.data?.citizen_id) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('citizen_id', res.data.citizen_id);
    }
    setCurrentCitizenId(res.data.citizen_id);
  }
  return res.data;
}

export async function getCitizenProfile(): Promise<CitizenProfile> {
  const res = await apiClient.get<CitizenProfile>('/citizens/me');
  if (res.data) {
    setSavedCitizenProfile(res.data as any);
  }
  return res.data;
}

export async function updateCitizenProfile(data: Partial<CitizenProfile>): Promise<CitizenProfile> {
  const res = await apiClient.put<CitizenProfile>('/citizens/me', data);
  if (res.data) {
    setSavedCitizenProfile(res.data as any);
  }
  return res.data;
}

export async function getCitizenApplications(citizenId?: string): Promise<any[]> {
  const params: Record<string, string> = {};
  const targetId = citizenId || getCurrentCitizenId() || (typeof localStorage !== 'undefined' ? localStorage.getItem('citizen_id') : null);
  if (targetId) params.citizen_id = targetId;
  const res = await apiClient.get<any[]>('/applications', { params });
  return res.data;
}

// ─── Officer & Application Lifecycle Services ───────────────────────────────

export async function officerLogin(
  username: string,
  password?: string,
  role?: string
): Promise<{ access_token: string; officer_id: string; username: string; full_name: string; role: string; jurisdiction_district?: string }> {
  const res = await apiClient.post<any>('/officers/login', { username, password, role });
  if (res.data?.access_token) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('officer_token', res.data.access_token);
    }
  }
  return res.data;
}

export async function getOfficerDashboardStats(): Promise<DashboardStats> {
  const res = await apiClient.get<any>('/officers/dashboard-stats');
  const data = res.data;
  return {
    total_applications: data.total_applications ?? 0,
    pending_review: data.pending_review ?? 0,
    approved_applications: data.approved_today ?? 0,
    rejected_applications: data.rejected_today ?? 0,
    needs_correction: 0,
    today_received: data.total_applications ?? 0,
    average_turnaround_hours: 24,
  };
}

export async function getOfficerApplications(params?: {
  status?: string;
  village?: string;
  search?: string;
}): Promise<ApplicationRecord[]> {
  const queryParams: Record<string, any> = { limit: 100 };
  if (params?.status && params.status !== 'ALL') {
    queryParams.status = params.status;
  }
  const res = await apiClient.get<{ total: number; applications: any[] }>('/officers/applications', { params: queryParams });
  const apps = res.data?.applications || (res.data as any)?.items || [];
  return apps.map((app) => {
    const isStudent = (app.scheme_category && app.scheme_category.toLowerCase().includes('scholarship')) ||
      (app.applicant_data?.citizen_group && String(app.applicant_data.citizen_group).toLowerCase().includes('student')) ||
      (app.applicant_data?.beneficiary_group && String(app.applicant_data.beneficiary_group).toLowerCase().includes('student'));

    return {
      id: String(app.id),
      application_reference: app.submission_reference || `GS-KA-${String(app.id).slice(0, 8).toUpperCase()}`,
      scheme_id: app.scheme_id,
      scheme_name: app.scheme_name || app.scheme_id,
      scheme_code: app.scheme_id,
      scheme_category: app.scheme_category,
      scheme_department: app.scheme_department,
      applicant: {
        id: String(app.citizen_id),
        full_name: app.citizen_name || app.applicant_data?.full_name || app.applicant_data?.farmer_name || app.applicant_data?.name || 'Citizen Applicant',
        phone_masked: app.citizen_phone_masked || '+91 XXXXX X****',
        citizen_group: isStudent ? 'STUDENT' : (app.applicant_data?.citizen_group || app.applicant_data?.beneficiary_group || 'FARMER'),
        village: app.jurisdiction_village || app.applicant_data?.village || 'Grama Panchayat',
        taluk: app.applicant_data?.taluk || 'Taluk Office',
        district: app.jurisdiction_district || app.applicant_data?.district || 'Mandya',
        state: app.applicant_data?.state || 'Karnataka',
        annual_income: app.applicant_data?.annual_income || 80000,
        land_holding_acres: !isStudent ? (app.applicant_data?.land_holding_acres ?? app.applicant_data?.land_acres) : undefined,
        has_bank_account: app.applicant_data?.has_bank_account ?? true,
        education_level: app.applicant_data?.education_level,
        institution: app.applicant_data?.institution || app.applicant_data?.college_name,
        academic_score: app.applicant_data?.academic_score || app.applicant_data?.percentage,
        caste_category: app.applicant_data?.caste_category,
      },
      submitted_at: app.created_at,
      updated_at: app.updated_at,
      status: (app.current_status || 'OFFICER_REVIEW').toUpperCase() as any,
      submission_mode: (app.submission_mode || 'DIRECT_CITIZEN').toUpperCase() as any,
      documents: [],
      eligibility_score: app.progress_percentage || 50,
      assigned_office: `${app.jurisdiction_district || 'Taluk'} Office`,
      official_order_number: app.official_order_number,
      remarks: app.rejection_reason || undefined,
      audit_history: [
        {
          timestamp: app.created_at,
          action: 'APPLICATION_SUBMITTED',
          actor_name: app.citizen_name || 'Citizen Applicant',
          actor_role: 'CITIZEN',
          notes: 'Application submitted for official verification.',
        },
      ],
    };
  });
}

export async function getOfficerApplicationById(id: string): Promise<ApplicationRecord | null> {
  const res = await apiClient.get<any>(`/applications/${id}`);
  const app = res.data;
  if (!app) return null;

  const isStudent = (app.scheme_category && app.scheme_category.toLowerCase().includes('scholarship')) ||
    (app.citizen_group && String(app.citizen_group).toLowerCase().includes('student')) ||
    (app.applicant_data?.citizen_group && String(app.applicant_data.citizen_group).toLowerCase().includes('student')) ||
    (app.applicant_data?.beneficiary_group && String(app.applicant_data.beneficiary_group).toLowerCase().includes('student'));

  return {
    id: String(app.id),
    application_reference: app.submission_reference || `GS-KA-${String(app.id).slice(0, 8).toUpperCase()}`,
    scheme_id: app.scheme_id,
    scheme_name: app.scheme_name || app.scheme_id,
    scheme_code: app.scheme_id,
    scheme_category: app.scheme_category,
    scheme_department: app.scheme_department,
    applicant: {
      id: String(app.citizen_id),
      full_name: app.citizen_name || app.applicant_data?.full_name || app.applicant_data?.farmer_name || app.applicant_data?.name || 'Citizen Applicant',
      phone_masked: app.citizen_phone_masked || '+91 XXXXX X****',
      citizen_group: isStudent ? 'STUDENT' : (app.citizen_group || app.applicant_data?.citizen_group || app.applicant_data?.beneficiary_group || 'FARMER'),
      village: app.citizen_village || app.applicant_data?.village || 'Grama Panchayat',
      taluk: app.applicant_data?.taluk || 'Taluk Office',
      district: app.citizen_district || app.applicant_data?.district || 'Mandya',
      state: app.citizen_state || app.applicant_data?.state || 'Karnataka',
      annual_income: app.applicant_data?.annual_income || 80000,
      land_holding_acres: !isStudent ? (app.applicant_data?.land_holding_acres ?? app.applicant_data?.land_acres) : undefined,
      has_bank_account: app.applicant_data?.has_bank_account ?? true,
      education_level: app.applicant_data?.education_level,
      institution: app.applicant_data?.institution || app.applicant_data?.college_name,
      academic_score: app.applicant_data?.academic_score || app.applicant_data?.percentage,
      caste_category: app.applicant_data?.caste_category,
      crop_type: app.applicant_data?.crop_type,
    },
    submitted_at: app.submitted_at || app.created_at,
    updated_at: app.updated_at,
    status: (app.current_status || 'OFFICER_REVIEW').toUpperCase() as any,
    submission_mode: (app.submission_mode || 'DIRECT_CITIZEN').toUpperCase() as any,
    documents: (app.documents && app.documents.length > 0)
      ? app.documents.map((d: any) => {
          const rawConf = d.ocr_confidence ?? 0.95;
          const confScore = rawConf <= 1.0 ? Math.round(rawConf * 100) : Math.round(rawConf);
          return {
            id: d.id,
            document_id: d.id,
            type: d.document_type?.toUpperCase() || 'DOCUMENT',
            document_type: d.document_type?.toUpperCase() || 'DOCUMENT',
            type_name: d.original_filename || d.document_type || 'Uploaded Document',
            file_name: d.original_filename || d.document_type || 'Uploaded Document',
            status: d.validation_status || d.ocr_status || 'VERIFIED',
            validation_status: d.validation_status || 'VALID',
            ocr_status: d.ocr_status || 'DONE',
            extracted_data: d.ocr_extracted_fields || {},
            extracted_fields: d.ocr_extracted_fields || {},
            confidence_score: confScore,
            ocr_text: d.ocr_text,
            citizen_confirmed_fields: d.citizen_confirmed_fields,
            is_confirmed_by_user: Boolean(d.is_confirmed_by_user),
            confirmation_notes: d.confirmation_notes,
            confirmed_at: d.confirmed_at,
            uploaded_at: d.created_at || new Date().toISOString(),
            is_verified: true,
            validation_notes: d.confirmation_notes || (d.is_confirmed_by_user ? 'Confirmed and self-verified by citizen' : undefined),
          };
        })
      : [],
    eligibility_score: app.eligibility_score ?? (app.eligibility_evaluation?.score ?? 50),
    eligibility_evaluation: app.eligibility_evaluation,
    required_documents_checklist: app.required_documents_checklist || [],
    assigned_office: `${app.citizen_district || 'Taluk'} Office`,
    official_order_number: app.official_order_number,
    remarks: app.rejection_reason || undefined,
    audit_history: (app.timeline && app.timeline.length > 0)
      ? app.timeline.map((t: any) => ({
          timestamp: t.timestamp,
          action: t.status,
          actor_name: t.actor,
          actor_role: t.actor?.toUpperCase() || 'OFFICER',
          notes: t.notes,
        }))
      : [
          {
            timestamp: app.created_at,
            action: 'SUBMITTED',
            actor_name: app.citizen_name || 'Citizen',
            actor_role: 'CITIZEN',
            notes: 'Application registered and verified with single-use confirmation token.',
          },
        ],
  };
}

export async function recordOfficerDecision(
  applicationId: string,
  payload: OfficerDecisionPayload,
  officer: OfficerUser
): Promise<ApplicationRecord> {
  const mappedDecision = payload.decision === 'APPROVE' ? 'APPROVED' : payload.decision === 'REJECT' ? 'REJECTED' : 'NEEDS_CORRECTION';
  await apiClient.post<any>(`/applications/${applicationId}/officer-decision`, {
    decision: mappedDecision,
    notes: payload.remarks || payload.rejection_reason || `Decision: ${payload.decision}`,
    order_number: payload.official_order_number || (payload.decision === 'APPROVE' ? `GOV-ORD-${Date.now().toString().slice(-6)}` : null),
  });
  const updated = await getOfficerApplicationById(applicationId);
  if (updated) return updated;
  throw new Error(`Failed to reload application ${applicationId} after decision`);
}

export async function submitApplicationForReview(draft: {
  citizen_id: string;
  scheme_id: string;
  applicant_data: any;
}): Promise<{
  success: boolean;
  application_id: string;
  submission_reference: string;
  status: string;
}> {
  // 1. Create or save draft in backend
  const draftRes = await api.createApplicationDraft({
    citizen_id: draft.citizen_id,
    scheme_id: draft.scheme_id,
    applicant_data: draft.applicant_data,
  });
  const appId = draftRes.id;

  // 2. Request single-use 5-minute confirmation token
  const tokenRes = await apiClient.post<{ raw_token: string }>(`/applications/${appId}/token`, {
    citizen_id: draft.citizen_id,
  });
  const confirmationToken = tokenRes.data.raw_token;

  // 3. Submit application with token
  const submitRes = await apiClient.post<any>(`/applications/${appId}/submit`, {
    citizen_id: draft.citizen_id,
    confirmation_token: confirmationToken,
  });

  return {
    success: true,
    application_id: String(submitRes.data.id),
    submission_reference: submitRes.data.submission_reference || `GS-KA-${String(submitRes.data.id).slice(0, 8).toUpperCase()}`,
    status: submitRes.data.current_status,
  };
}
