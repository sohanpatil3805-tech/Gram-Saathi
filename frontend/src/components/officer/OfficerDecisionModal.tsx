import React, { useState } from 'react';
import { OfficerDecisionPayload } from '../../types/officer';
import { useLanguage } from '../../context/LanguageContext';
import { 
  X, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  FileText, 
  Send, 
  Loader2,
  ShieldCheck 
} from 'lucide-react';

interface OfficerDecisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitDecision: (payload: OfficerDecisionPayload) => Promise<void>;
  applicationReference: string;
  applicantName: string;
}

export const OfficerDecisionModal: React.FC<OfficerDecisionModalProps> = ({
  isOpen,
  onClose,
  onSubmitDecision,
  applicationReference,
  applicantName,
}) => {
  const { t, language } = useLanguage();
  const [decisionType, setDecisionType] = useState<'APPROVE' | 'REJECT' | 'REQUEST_CORRECTION'>('APPROVE');
  const [orderNumber, setOrderNumber] = useState(`KA-RDPR-2025-${Math.floor(100000 + Math.random() * 900000)}`);
  const [rejectionReason, setRejectionReason] = useState('Land holding exceeds scheme threshold limit.');
  const [correctionField, setCorrectionField] = useState('LAND_RECORD');
  const [remarks, setRemarks] = useState('Verified applicant profile facts and uploaded documents. All eligibility criteria are met.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmitDecision({
        decision: decisionType,
        official_order_number: decisionType === 'APPROVE' ? orderNumber : undefined,
        rejection_reason: decisionType === 'REJECT' ? rejectionReason : undefined,
        correction_field: decisionType === 'REQUEST_CORRECTION' ? correctionField : undefined,
        remarks: remarks.trim(),
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-modal overflow-hidden border border-slate-200 dark:border-slate-800 transition-colors">
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="font-bold text-sm flex items-center space-x-1.5">
                <span>{t('decisionModalTitle')}</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded font-mono">
                  OFFICIAL ACTION
                </span>
              </h2>
              <p className="text-[11px] text-slate-300 font-mono">
                {applicationReference} • {applicantName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-4">
          {/* Officer Verification Notice */}
          <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-700 rounded-xl p-3 text-xs text-blue-950 dark:text-blue-200 flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="leading-snug">
              {language === 'kn'
                ? 'ಅಧಿಕೃತ ನಿರ್ಧಾರ ದಾಖಲಾತಿ: ಈ ಕ್ರಿಯೆಯು ಕೇಂದ್ರ ಡೇಟಾಬೇಸ್‌ನಲ್ಲಿ ಅರ್ಜಿಯ ಸ್ಥಿತಿಯನ್ನು ಅಧಿಕೃತವಾಗಿ ನವೀಕರಿಸುತ್ತದೆ ಮತ್ತು ನಾಗರಿಕರಿಗೆ ಅಧಿಸೂಚನೆ ನೀಡುತ್ತದೆ.'
                : language === 'hi'
                ? 'आधिकारिक निर्णय प्रविष्टि: यह कार्रवाई केंद्रीय डेटाबेस में आवेदन की स्थिति को आधिकारिक रूप से अद्यतन करती है और नागरिक को सूचित करती है।'
                : 'Official Decision Recording: This action officially records the status change in the central database and updates citizen tracking.'}
            </p>
          </div>

          {/* Decision Type Buttons */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('tableAction')}:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setDecisionType('APPROVE');
                  setRemarks('Verified applicant criteria and uploaded documents. All eligibility conditions satisfied.');
                }}
                className={`py-2 px-2.5 rounded-lg border text-xs font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                  decisionType === 'APPROVE'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-800 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{t('approved')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDecisionType('REQUEST_CORRECTION');
                  setRemarks('RTC survey number photo is blurry. Please re-upload clear photo.');
                }}
                className={`py-2 px-2.5 rounded-lg border text-xs font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                  decisionType === 'REQUEST_CORRECTION'
                    ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-500 text-amber-800 dark:text-amber-300 ring-2 ring-amber-500/20'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>{t('needsCorrectionCard')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDecisionType('REJECT');
                  setRemarks('Verification failed. Criteria requirements not fulfilled.');
                }}
                className={`py-2 px-2.5 rounded-lg border text-xs font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                  decisionType === 'REJECT'
                    ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-800 dark:text-rose-300 ring-2 ring-rose-500/20'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>{t('rejected')}</span>
              </button>
            </div>
          </div>

          {/* Conditional Input 1: Order Number (For Approval) */}
          {decisionType === 'APPROVE' && (
            <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 space-y-1.5 animate-fade-in">
              <label className="block text-xs font-bold text-emerald-950 dark:text-emerald-200">
                {t('orderNumber')}:
              </label>
              <input
                type="text"
                required
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                className="w-full text-xs font-mono px-3 py-2 border border-emerald-300 dark:border-emerald-700 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                placeholder={t('enterOrderNumber')}
              />
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                {t('orderIssued')}
              </p>
            </div>
          )}

          {/* Conditional Input 2: Rejection Reason (For Rejection) */}
          {decisionType === 'REJECT' && (
            <div className="bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl p-3 space-y-1.5 animate-fade-in">
              <label className="block text-xs font-bold text-rose-950 dark:text-rose-200">
                {t('rejectionReasonPrompt')}
              </label>
              <select
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-rose-300 dark:border-rose-700 rounded-lg outline-none focus:ring-2 focus:ring-rose-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="Land holding exceeds scheme threshold limit.">
                  Exceeds land ceiling limit
                </option>
                <option value="Crop entry does not match notified crop list.">
                  Crop mismatch in survey
                </option>
                <option value="Duplicate application detected in family.">
                  Duplicate application detected
                </option>
                <option value="Applicant outside jurisdiction.">
                  Applicant outside jurisdiction
                </option>
              </select>
            </div>
          )}

          {/* Conditional Input 3: Correction Field (For Correction) */}
          {decisionType === 'REQUEST_CORRECTION' && (
            <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3 space-y-1.5 animate-fade-in">
              <label className="block text-xs font-bold text-amber-950 dark:text-amber-200">
                {t('correctionNotesPrompt')}
              </label>
              <select
                value={correctionField}
                onChange={(e) => setCorrectionField(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-amber-300 dark:border-amber-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="LAND_RECORD">{t('landRecord')}</option>
                <option value="AADHAAR">{t('aadhaarCard')}</option>
                <option value="INCOME_CERT">{t('incomeCert')}</option>
              </select>
            </div>
          )}

          {/* Officer Remarks */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('officerRemarks')}:
            </label>
            <textarea
              required
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-slate-800 dark:focus:ring-emerald-500"
              placeholder="..."
            />
          </div>

          {/* Outbound Notification Alert */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-[11px] text-slate-600 dark:text-slate-300 flex items-start space-x-2">
            <Send className="w-3.5 h-3.5 text-saathi-700 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <p>
              Automated multilingual WhatsApp and SMS status notification is routed to citizen on submission.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-3 py-2"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`text-xs font-bold text-white px-4 py-2 rounded-lg shadow flex items-center space-x-1.5 transition-all ${
                decisionType === 'APPROVE'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : decisionType === 'REJECT'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t('submitDecision')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
