import { ApplicationStatus, CitizenGroup, DocumentVerificationResult, Scheme } from './api';

export type OfficerRole = 'PANCHAYAT_STAFF' | 'TEHSIL_STAFF' | 'ADMIN';

export interface OfficerUser {
  id: string;
  username: string;
  full_name: string;
  role: OfficerRole;
  role_display_name: string;
  jurisdiction_district: string;
  jurisdiction_taluk?: string;
  jurisdiction_village?: string;
  avatar_url?: string;
}

export interface ApplicationRecord {
  id: string;
  application_reference: string;
  scheme_id: string;
  scheme_name: string;
  scheme_code: string;
  applicant: {
    id: string;
    full_name: string;
    phone_masked: string;
    citizen_group: CitizenGroup;
    village: string;
    taluk: string;
    district: string;
    annual_income: number;
    land_holding_acres?: number;
    has_bank_account: boolean;
  };
  submitted_at: string;
  updated_at: string;
  status: ApplicationStatus;
  submission_mode: 'DIRECT_CITIZEN' | 'ASSISTED_OFFICER';
  documents: DocumentVerificationResult[];
  eligibility_score: number;
  assigned_office: string;
  official_order_number?: string;
  remarks?: string;
  audit_history: Array<{
    timestamp: string;
    action: string;
    actor_name: string;
    actor_role: string;
    notes: string;
  }>;
}

export interface DashboardStats {
  total_applications: number;
  pending_review: number;
  approved_applications: number;
  rejected_applications: number;
  needs_correction: number;
  today_received: number;
  average_turnaround_hours: number;
}

export interface ApplicationFilter {
  search?: string;
  status?: ApplicationStatus | 'ALL';
  category?: string | 'ALL';
  village?: string | 'ALL';
  page: number;
  pageSize: number;
}

export interface OfficerDecisionPayload {
  decision: 'APPROVE' | 'REJECT' | 'REQUEST_CORRECTION';
  official_order_number?: string;
  rejection_reason?: string;
  correction_field?: string;
  remarks: string;
}
