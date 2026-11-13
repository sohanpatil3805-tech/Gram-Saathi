import React from 'react';
import { DocumentVerificationResult } from '../../types/api';
import { 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  ShieldCheck, 
  ExternalLink,
  Eye
} from 'lucide-react';

interface OCRVerificationPanelProps {
  documents: DocumentVerificationResult[];
  claimedValues: {
    applicantName: string;
    landAcres?: number;
    annualIncome: number;
    village: string;
  };
}

export const OCRVerificationPanel: React.FC<OCRVerificationPanelProps> = ({
  documents,
  claimedValues,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div>
          <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>ಸ್ಥಳೀಯ OCR ದಾಖಲೆ ಪರಿಶೀಲನಾ ಪ್ಯಾನೆಲ್ (OCR Verification)</span>
          </h3>
          <p className="text-xs text-slate-500">
            ಸ್ಥಳೀಯ Tesseract ಎಂಜಿನ್‌ನಿಂದ ಹೊರತೆಗೆಯಲಾದ ಡೇಟಾವನ್ನು ನಾಗರಿಕರು ಸಲ್ಲಿಸಿದ ವಿವರಗಳೊಂದಿಗೆ ಹೋಲಿಸಿ.
          </p>
        </div>
        <span className="text-xs bg-emerald-50 text-emerald-800 font-semibold px-2.5 py-1 rounded-full border border-emerald-200">
          {documents.length} ದಾಖಲೆಗಳು ಲಗತ್ತಿಸಲಾಗಿದೆ
        </span>
      </div>

      {/* Comparison Grid */}
      <div className="space-y-3">
        {documents.map((doc) => {
          const isValid = doc.validation_status === 'VALID';
          return (
            <div
              key={doc.document_id}
              className={`rounded-xl border p-3.5 space-y-3 transition-all ${
                isValid
                  ? 'bg-slate-50/60 border-slate-200'
                  : 'bg-amber-50/50 border-amber-300'
              }`}
            >
              {/* Document Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span className="font-bold text-xs text-slate-900">
                    {doc.document_type}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    ({doc.file_name})
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-mono bg-white px-2 py-0.5 rounded border border-slate-200 font-semibold text-slate-700">
                    ವಿಶ್ವಾಸಾರ್ಹತೆ: {doc.confidence_score}%
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-1 ${
                      isValid
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {isValid ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>VALID</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        <span>NEEDS CORRECTION</span>
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Side-by-side Table */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Citizen Claimed Column */}
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <p className="font-bold text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">
                    ಅರ್ಜಿದಾರರು ಹೇಳಿರುವ ವಿವರ (Claimed)
                  </p>
                  <div className="space-y-1">
                    <div className="flex justify-between py-0.5 border-b border-slate-100">
                      <span className="text-slate-500">ಹೆಸರು (Name):</span>
                      <span className="font-semibold text-slate-800">{claimedValues.applicantName}</span>
                    </div>
                    {claimedValues.landAcres !== undefined && (
                      <div className="flex justify-between py-0.5 border-b border-slate-100">
                        <span className="text-slate-500">ಭೂಮಿ (Land):</span>
                        <span className="font-semibold text-slate-800">{claimedValues.landAcres} ಎಕರೆ</span>
                      </div>
                    )}
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-500">ಗ್ರಾಮ (Village):</span>
                      <span className="font-semibold text-slate-800">{claimedValues.village}</span>
                    </div>
                  </div>
                </div>

                {/* OCR Extracted Column */}
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 font-mono">
                  <p className="font-bold text-[11px] text-saathi-700 uppercase tracking-wider mb-1.5 font-sans">
                    OCR ಮೂಲಕ ಪತ್ತೆಯಾದ ವಿವರ (Extracted)
                  </p>
                  <div className="space-y-1">
                    {Object.entries(doc.extracted_fields).map(([k, v]) => (
                      <div key={k} className="flex justify-between py-0.5 border-b border-slate-100 last:border-0 text-[11px]">
                        <span className="text-slate-500 font-sans capitalize">{k.replace(/_/g, ' ')}:</span>
                        <span className="font-bold text-slate-900">{String(v ?? '—')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Validation Notes & Status */}
              {doc.validation_notes && (
                <div className="bg-white/90 p-2 rounded border border-slate-200 text-xs text-slate-700">
                  <strong>ಪರಿಶೀಲನಾ ಟಿಪ್ಪಣಿ:</strong> {doc.validation_notes}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
