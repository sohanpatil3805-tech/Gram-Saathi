import { Scheme, DocumentVerificationResult, ApplicationPreview, ApplicationSubmissionResult } from './api';

export type MessageSender = 'user' | 'assistant' | 'system';

export type MessageContentType = 
  | 'text'
  | 'scheme_list'
  | 'scheme_card'
  | 'eligibility_result'
  | 'document_request'
  | 'ocr_result'
  | 'application_summary'
  | 'submission_receipt';

export interface ChatMessage {
  id: string;
  sender: MessageSender;
  content: string;
  contentType: MessageContentType;
  timestamp: string;
  schemes?: Scheme[];
  selectedScheme?: Scheme;
  ocrResult?: DocumentVerificationResult;
  applicationPreview?: ApplicationPreview;
  submissionResult?: ApplicationSubmissionResult;
  actions?: Array<{
    id: string;
    label: string;
    type: 'primary' | 'secondary' | 'danger';
    payload?: any;
  }>;
}

export interface SuggestedQuestion {
  id: string;
  kn: string;
  hi: string;
  query: string;
  category: 'schemes' | 'eligibility' | 'documents' | 'status';
}
