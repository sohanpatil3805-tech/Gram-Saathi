import React, { useState } from 'react';
import { ApplicationSubmissionResult } from '../../types/api';
import { useLanguage } from '../../context/LanguageContext';
import { 
  X, 
  CheckCircle2, 
  FileText, 
  Download, 
  ExternalLink, 
  Smartphone, 
  Printer 
} from 'lucide-react';
import { ApplicationPDFViewer } from '../officer/ApplicationPDFViewer';

interface SubmissionSuccessModalProps {
  submissionResult: ApplicationSubmissionResult;
  isOpen: boolean;
  onClose: () => void;
  onOpenTracker: () => void;
}

export const SubmissionSuccessModal: React.FC<SubmissionSuccessModalProps> = ({
  submissionResult,
  isOpen,
  onClose,
  onOpenTracker,
}) => {
  const { t } = useLanguage();
  const [showPdf, setShowPdf] = useState(false);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
        <div className="bg-white rounded-2xl max-w-md w-full shadow-modal overflow-hidden border border-slate-200">
          {/* Header */}
          <div className="bg-whatsapp-teal text-white px-4 py-3.5 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-whatsapp-green" />
              <h2 className="font-bold text-sm">
                {t('submissionSuccessful')}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 space-y-3.5 text-center">
            {/* Reference Badge */}
            <div className="py-2.5 px-3 bg-emerald-50 border border-emerald-300 rounded-xl space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 bg-emerald-200/80 px-2 py-0.5 rounded font-mono">
                ಅಧಿಕೃತ ಇ-ಅರ್ಜಿ ಸಲ್ಲಿಕೆ ದಾಖಲಾಗಿದೆ • APPLICATION RECORDED
              </span>
              <p className="text-xs text-slate-600">
                {t('applicationReferenceNumber')}
              </p>
              <h3 className="text-xl font-extrabold text-slate-900 font-mono tracking-tight text-emerald-950">
                {submissionResult.submission_reference}
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed text-left">
              {t('statusSubmittedNotice')}
            </p>

            {/* Notification alert */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-left flex items-start space-x-2 text-xs text-slate-700">
              <Smartphone className="w-4 h-4 text-saathi-700 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-900">PWA ಆ್ಯಪ್ ಅಧಿಸೂಚನೆ (Notification)</p>
                <p className="text-[11px] text-slate-500">
                  ನಿಮ್ಮ ಅರ್ಜಿಯ ಸ್ಥಿತಿಯ ಪ್ರತಿಯೊಂದು ಹಂತದಲ್ಲೂ PWA ಆ್ಯಪ್ ಮತ್ತು ಮೊಬೈಲ್ ಸಂಖ್ಯೆಗೆ ಅಧಿಸೂಚನೆ ಕಳುಹಿಸಲಾಗುತ್ತದೆ.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 space-y-2">
              <button
                onClick={() => setShowPdf(true)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold py-2.5 px-3 rounded-lg flex items-center justify-center space-x-2 shadow transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>{t('downloadPdf')}</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  onOpenTracker();
                }}
                className="w-full bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold py-2 px-3 rounded-lg flex items-center justify-center space-x-2 transition-all"
              >
                <ExternalLink className="w-4 h-4 text-saathi-700" />
                <span>{t('trackApplication')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {showPdf && (
        <ApplicationPDFViewer
          referenceNumber={submissionResult.submission_reference}
          onClose={() => setShowPdf(false)}
        />
      )}
    </>
  );
};
