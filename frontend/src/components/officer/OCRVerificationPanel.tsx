import React, { useState } from 'react';
import { DocumentVerificationResult } from '../../types/api';
import { useLanguage } from '../../context/LanguageContext';
import { 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  ShieldCheck, 
  Eye,
  Edit3,
  UserCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface OCRVerificationPanelProps {
  documents: DocumentVerificationResult[];
  claimedValues: {
    applicantName: string;
    landAcres?: number;
    annualIncome: number;
    village: string;
    educationLevel?: string;
    casteCategory?: string;
    citizenGroup?: string;
  };
}

export const OCRVerificationPanel: React.FC<OCRVerificationPanelProps> = ({
  documents,
  claimedValues,
}) => {
  const { t } = useLanguage();
  const [expandedOcrTextDocId, setExpandedOcrTextDocId] = useState<string | null>(null);

  const toggleOcrText = (docId: string) => {
    setExpandedOcrTextDocId(prev => (prev === docId ? null : docId));
  };

  const handlePreviewDocument = async (docId: string) => {
    const token = localStorage.getItem('officer_token');
    const url = `/api/documents/${docId}/preview`;
    try {
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        alert('Could not open document preview. Verify officer authorization.');
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-4 transition-colors">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
        <div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{t('tabOCR')}</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Compare local Tesseract OCR extracted fields and citizen-confirmed values directly against claims.
          </p>
        </div>
        <span className="text-xs bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-semibold px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
          {documents.length} {t('uploadedDocumentsTitle')}
        </span>
      </div>

      {/* Comparison Grid */}
      {documents.length === 0 ? (
        <div className="p-6 text-center bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
          <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
          <p className="font-bold text-xs text-slate-700 dark:text-slate-300">0 Documents Stored in Backend Storage</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            The applicant has not uploaded any verified documents for this application yet. Consult the Required Documents Checklist above to review pending submissions.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {documents.map((doc) => {
            const isValid = doc.validation_status === 'VALID' || doc.validation_status === 'CONFIRMED';
            const hasConfirmedFields = Boolean(
              doc.citizen_confirmed_fields && Object.keys(doc.citizen_confirmed_fields).length > 0
            );
            const isUserConfirmed = Boolean(doc.is_confirmed_by_user || hasConfirmedFields);
            const isTextExpanded = expandedOcrTextDocId === doc.document_id;

            return (
              <div
                key={doc.document_id}
                className={`rounded-xl border p-3.5 space-y-3 transition-all ${
                  isValid
                    ? 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                    : 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                }`}
              >
                {/* Document Header */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      {doc.document_type}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      ({doc.file_name})
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handlePreviewDocument(doc.document_id)}
                      className="text-[11px] font-semibold text-saathi-800 dark:text-emerald-400 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 flex items-center space-x-1"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Preview File</span>
                    </button>
                    <span className="text-[11px] font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300">
                      Accuracy: {doc.confidence_score}%
                    </span>
                    {isUserConfirmed && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 flex items-center space-x-1 border border-blue-200 dark:border-blue-800">
                        <UserCheck className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                        <span>Citizen Verified</span>
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-1 ${
                        isValid
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                          : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                      }`}
                    >
                      {isValid ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>{doc.validation_status || 'VALID'}</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          <span>NEEDS CORRECTION</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Side-by-side Comparison Grid (Claimed vs Raw OCR vs Citizen-Confirmed) */}
                <div className={`grid grid-cols-1 ${hasConfirmedFields ? 'md:grid-cols-3' : 'sm:grid-cols-2'} gap-3 text-xs`}>
                  {/* 1. Citizen Claimed Column */}
                  <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <p className="font-bold text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                      <span>Citizen Claimed</span>
                    </p>
                    <div className="space-y-1">
                      <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-700">
                        <span className="text-slate-500 dark:text-slate-400">{t('citizenNameLabel')}:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{claimedValues.applicantName}</span>
                      </div>
                      {claimedValues.educationLevel && (
                        <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-700">
                          <span className="text-slate-500 dark:text-slate-400">Education:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{claimedValues.educationLevel}</span>
                        </div>
                      )}
                      {claimedValues.casteCategory && (
                        <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-700">
                          <span className="text-slate-500 dark:text-slate-400">Category:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{claimedValues.casteCategory}</span>
                        </div>
                      )}
                      {claimedValues.landAcres !== undefined && (
                        <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-700">
                          <span className="text-slate-500 dark:text-slate-400">Land:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{claimedValues.landAcres} Acres</span>
                        </div>
                      )}
                      <div className="flex justify-between py-0.5">
                        <span className="text-slate-500 dark:text-slate-400">Village:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{claimedValues.village}</span>
                      </div>
                    </div>
                  </div>

                  {/* 2. Raw OCR Extracted Column */}
                  <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 font-mono">
                    <p className="font-bold text-[11px] text-saathi-700 dark:text-emerald-400 uppercase tracking-wider mb-1.5 font-sans flex items-center justify-between">
                      <span>OCR Extracted</span>
                      <span className="text-[9px] font-normal text-slate-400 font-mono">Tesseract 5.4</span>
                    </p>
                    <div className="space-y-1">
                      {Object.keys(doc.extracted_fields || {}).length > 0 ? (
                        Object.entries(doc.extracted_fields).map(([k, v]) => (
                          <div key={k} className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-700 last:border-0 text-[11px]">
                            <span className="text-slate-500 dark:text-slate-400 font-sans capitalize">{k.replace(/_/g, ' ')}:</span>
                            <span className="font-bold text-slate-900 dark:text-white truncate max-w-[130px]">{String(v ?? '—')}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] text-slate-400 italic py-1 font-sans">No text extracted</p>
                      )}
                    </div>
                  </div>

                  {/* 3. Citizen Confirmed / Corrected Column (if available) */}
                  {hasConfirmedFields && (
                    <div className="bg-blue-50/50 dark:bg-slate-800/80 p-2.5 rounded-lg border border-blue-200 dark:border-blue-900/60">
                      <p className="font-bold text-[11px] text-blue-900 dark:text-blue-300 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                        <Edit3 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                        <span>Citizen Confirmed</span>
                      </p>
                      <div className="space-y-1">
                        {Object.entries(doc.citizen_confirmed_fields || {}).map(([k, v]) => {
                          const rawOcrVal = doc.extracted_fields?.[k] ?? doc.extracted_fields?.[k.toLowerCase().replace(/[\s/]/g, '_')];
                          const wasEdited = rawOcrVal !== undefined && String(rawOcrVal) !== String(v);
                          return (
                            <div key={k} className="flex justify-between items-center py-0.5 border-b border-blue-100 dark:border-slate-700 last:border-0 text-[11px]">
                              <span className="text-slate-600 dark:text-slate-400 font-medium capitalize">{k.replace(/_/g, ' ')}:</span>
                              <span className="font-bold text-blue-950 dark:text-blue-200 flex items-center space-x-1">
                                <span>{String(v ?? '—')}</span>
                                {wasEdited && (
                                  <span className="text-[9px] bg-amber-200 text-amber-900 dark:bg-amber-950 dark:text-amber-200 px-1 rounded font-semibold">
                                    Edited
                                  </span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* View Raw OCR Output Toggle */}
                {doc.ocr_text && (
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-2">
                    <button
                      type="button"
                      onClick={() => toggleOcrText(doc.document_id)}
                      className="text-[11px] font-semibold text-saathi-700 dark:text-emerald-400 hover:underline flex items-center space-x-1"
                    >
                      <Eye className="w-3 h-3" />
                      <span>{isTextExpanded ? 'Hide Raw OCR Text' : 'View Raw OCR Extracted Text'}</span>
                      {isTextExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    {isTextExpanded && (
                      <div className="mt-2 p-2.5 bg-slate-900 text-emerald-400 rounded-lg text-[10px] font-mono whitespace-pre-wrap max-h-36 overflow-y-auto border border-slate-800">
                        {doc.ocr_text}
                      </div>
                    )}
                  </div>
                )}

                {/* Validation Notes & Status */}
                {doc.validation_notes && (
                  <div className="bg-white/90 dark:bg-slate-800/90 p-2 rounded border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
                    <strong>Verification Notes:</strong> {doc.validation_notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
    </div>
  );
};
