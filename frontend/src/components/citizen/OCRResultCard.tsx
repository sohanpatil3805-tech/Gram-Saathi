import React from 'react';
import { DocumentVerificationResult } from '../../types/api';
import { useLanguage } from '../../context/LanguageContext';
import { 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  RotateCcw, 
  ShieldCheck 
} from 'lucide-react';

interface OCRResultCardProps {
  ocrResult: DocumentVerificationResult;
  onReupload?: () => void;
}

export const OCRResultCard: React.FC<OCRResultCardProps> = ({
  ocrResult,
  onReupload,
}) => {
  const { t } = useLanguage();
  const isValid = ocrResult.validation_status === 'VALID';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden my-2 max-w-sm w-full">
      {/* Header status bar */}
      <div
        className={`px-3 py-2 flex items-center justify-between text-xs font-semibold ${
          isValid
            ? 'bg-emerald-50 text-emerald-900 border-b border-emerald-200'
            : 'bg-amber-50 text-amber-900 border-b border-amber-200'
        }`}
      >
        <div className="flex items-center space-x-1.5">
          {isValid ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          )}
          <span>{isValid ? t('ocrSuccess') : t('ocrWarningBlurry')}</span>
        </div>
        <span className="text-[10px] bg-white/80 px-2 py-0.5 rounded-full border border-slate-200/80 font-mono">
          {ocrResult.confidence_score}% Match
        </span>
      </div>

      <div className="p-3 space-y-2">
        {/* Document type info */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pb-1 border-b border-slate-100">
          <span className="flex items-center space-x-1 font-medium">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>{ocrResult.document_type}</span>
          </span>
          <span className="font-mono text-[10px] truncate max-w-[150px]">
            {ocrResult.file_name}
          </span>
        </div>

        {/* Extracted fields */}
        <div className="bg-slate-50 rounded-lg p-2 text-xs space-y-1 font-mono">
          <p className="text-[10px] font-sans font-bold text-slate-500 uppercase tracking-wider mb-1">
            {t('extractedInfo')}
          </p>
          {Object.entries(ocrResult.extracted_fields).map(([k, v]) => (
            <div key={k} className="flex justify-between text-[11px]">
              <span className="text-slate-500 capitalize">{k.replace(/_/g, ' ')}:</span>
              <span className="font-semibold text-slate-800">{String(v ?? '—')}</span>
            </div>
          ))}
        </div>

        {/* Validation note */}
        {ocrResult.validation_notes && (
          <p className="text-[11px] text-slate-600 italic leading-snug">
            "{ocrResult.validation_notes}"
          </p>
        )}

        {/* Action if needs correction */}
        {!isValid && onReupload && (
          <button
            onClick={onReupload}
            className="w-full mt-1 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition-all shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('reuploadBtn')}</span>
          </button>
        )}

        {isValid && (
          <div className="flex items-center space-x-1 text-[10px] text-emerald-700 font-semibold pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t('documentVerified')} (Panchayat Schema Matched)</span>
          </div>
        )}
      </div>
    </div>
  );
};
