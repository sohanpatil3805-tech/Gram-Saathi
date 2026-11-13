import axios, { AxiosError } from 'axios';
import {
  Scheme,
  CitizenProfile,
  EligibilityAssessmentResult,
  DocumentVerificationResult,
  ApplicationPreview,
  ApplicationSubmissionResult,
} from '../types/api';
import {
  ApplicationRecord,
  DashboardStats,
  OfficerDecisionPayload,
  OfficerUser,
} from '../types/officer';
import { mockService } from './mockService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach token if officer or citizen is logged in
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('gram_saathi_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isBackendAvailable: boolean | null = null;

// Healthcheck helper
export async function checkBackendConnection(): Promise<boolean> {
  try {
    const res = await axios.get(`${API_BASE_URL.replace('/api/v1', '')}/docs`, {
      timeout: 1500,
    });
    isBackendAvailable = res.status < 400;
    return true;
  } catch {
    isBackendAvailable = false;
    return false;
  }
}

export const api = {
  // 1. Schemes
  async getSchemes(params?: {
    category?: string;
    target_group?: string;
    search?: string;
    lang?: string;
  }): Promise<Scheme[]> {
    try {
      const res = await apiClient.get<Scheme[]>('/schemes', { params });
      return res.data;
    } catch {
      // Fallback to client-side mock
      return mockService.getSchemes(params);
    }
  },

  async getSchemeById(id: string): Promise<Scheme | undefined> {
    try {
      const res = await apiClient.get<Scheme>(`/schemes/${id}`);
      return res.data;
    } catch {
      return mockService.getSchemeById(id);
    }
  },

  // 2. Eligibility
  async assessEligibility(
    schemeId: string,
    profile: CitizenProfile
  ): Promise<EligibilityAssessmentResult> {
    try {
      const res = await apiClient.post<EligibilityAssessmentResult>(
        '/schemes/assess-eligibility',
        {
          scheme_id: schemeId,
          citizen_profile: profile,
        }
      );
      return res.data;
    } catch {
      return mockService.assessEligibility(schemeId, profile);
    }
  },

  // 3. Document Upload & OCR
  async uploadDocument(
    file: File | string,
    docType: string,
    sampleKey?: 'valid_aadhaar' | 'valid_land_record' | 'blurry_document' | 'valid_student_id'
  ): Promise<DocumentVerificationResult> {
    try {
      if (typeof file !== 'string') {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('document_type_code', docType);

        const res = await apiClient.post('/documents/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        // Trigger validation endpoint
        const validRes = await apiClient.post(`/documents/${res.data.document_id}/validate`);
        return validRes.data;
      }
      throw new Error('Using mock fallback');
    } catch {
      return mockService.uploadAndProcessDocument(sampleKey || 'valid_aadhaar');
    }
  },

  // 4. Application Preview & Submission
  async getApplicationPreview(
    schemeId: string,
    profile: CitizenProfile,
    applicantName?: string
  ): Promise<ApplicationPreview> {
    try {
      const draftRes = await apiClient.post('/applications/draft', {
        scheme_id: schemeId,
        submission_mode: 'DIRECT_CITIZEN',
      });
      const previewRes = await apiClient.post(
        `/applications/${draftRes.data.application_id}/preview`
      );
      return previewRes.data;
    } catch {
      return mockService.generateApplicationPreview(schemeId, profile, applicantName);
    }
  },

  async submitApplication(
    applicationId: string,
    confirmationToken: string,
    preview: ApplicationPreview,
    documents: DocumentVerificationResult[] = []
  ): Promise<ApplicationSubmissionResult> {
    try {
      const res = await apiClient.post<ApplicationSubmissionResult>(
        `/applications/${applicationId}/submit`,
        { confirmation_token: confirmationToken }
      );
      return res.data;
    } catch {
      return mockService.submitApplication(
        applicationId,
        confirmationToken,
        preview,
        documents
      );
    }
  },

  // 5. Officer Endpoints
  async getOfficerApplications(filters?: {
    status?: string;
    search?: string;
    village?: string;
  }): Promise<ApplicationRecord[]> {
    try {
      const res = await apiClient.get<ApplicationRecord[]>('/officer/applications', {
        params: filters,
      });
      return res.data;
    } catch {
      return mockService.getOfficerApplications(filters);
    }
  },

  async getOfficerApplicationById(id: string): Promise<ApplicationRecord | undefined> {
    try {
      const res = await apiClient.get<ApplicationRecord>(`/officer/applications/${id}`);
      return res.data;
    } catch {
      return mockService.getOfficerApplicationById(id);
    }
  },

  async recordOfficerDecision(
    applicationId: string,
    payload: OfficerDecisionPayload,
    officer: OfficerUser
  ): Promise<ApplicationRecord> {
    try {
      const res = await apiClient.post<ApplicationRecord>(
        `/officer/applications/${applicationId}/decision`,
        payload
      );
      return res.data;
    } catch {
      return mockService.recordOfficerDecision(applicationId, payload, officer);
    }
  },

  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const res = await apiClient.get<DashboardStats>('/officer/stats');
      return res.data;
    } catch {
      return mockService.getDashboardStats();
    }
  },
};
