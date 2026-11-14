import { 
  DiscoveredScheme, 
  DocumentVerificationResult, 
  ApplicationPreview, 
  ApplicationSubmissionResult,
  BackendEligibilityResult,
  ApplicantProfile,
  CitizenGroup
} from './api';

export type MessageSender = 'user' | 'assistant' | 'system';

export type MessageContentType = 
  | 'text'
  | 'scheme_list'
  | 'scheme_card'
  | 'clarification_prompt'
  | 'eligibility_result'
  | 'document_request'
  | 'draft_handoff'
  | 'ocr_result'
  | 'application_summary'
  | 'submission_receipt';

export interface ChatMessage {
  id: string;
  sender: MessageSender;
  content: string;
  contentType: MessageContentType;
  timestamp: string;
  schemes?: any[];
  selectedScheme?: any;
  eligibilityResult?: BackendEligibilityResult;
  ocrResult?: DocumentVerificationResult;
  applicationPreview?: ApplicationPreview;
  submissionResult?: ApplicationSubmissionResult;
  extractedFacts?: Partial<ApplicantProfile>;
  suggestedCategories?: Array<{ id: CitizenGroup; label: string }>;
  notice?: string;
  isSimulatedAI?: boolean;
  aiProvider?: string;
  actions?: Array<{
    id: string;
    label: string;
    type: 'primary' | 'secondary' | 'danger';
    payload?: any;
  }>;
}

export interface SuggestedQuestion {
  id: string;
  en?: string;
  kn: string;
  hi: string;
  query: string;
  category: 'schemes' | 'eligibility' | 'documents' | 'status';
}
