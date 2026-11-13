import React, { useState } from 'react';
import { OfficerDecisionPayload } from '../../types/officer';
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
  const [decisionType, setDecisionType] = useState<'APPROVE' | 'REJECT' | 'REQUEST_CORRECTION'>('APPROVE');
  const [orderNumber, setOrderNumber] = useState(`KA-MND-AGR-2024-${Math.floor(1000 + Math.random() * 9000)}`);
  const [rejectionReason, setRejectionReason] = useState('Land holding exceeds scheme threshold limit.');
  const [correctionField, setCorrectionField] = useState('LAND_RECORD');
  const [remarks, setRemarks] = useState('Land records verified with Bhoomi portal database. Recommended for approval.');
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
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-modal overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="font-bold text-sm">
                ಅಧಿಕೃತ ಆದೇಶ & ನಿರ್ಧಾರ ದಾಖಲಿಸಿ (Official Decision)
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
          {/* Decision Type Buttons */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              ನಿರ್ಧಾರದ ಪ್ರಕಾರವನ್ನು ಆಯ್ಕೆಮಾಡಿ (Decision Type):
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setDecisionType('APPROVE');
                  setRemarks('Land records verified with Bhoomi portal database. Recommended for approval.');
                }}
                className={`py-2 px-2.5 rounded-lg border text-xs font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                  decisionType === 'APPROVE'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>ಅನುಮೋದನೆ (Approve)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDecisionType('REQUEST_CORRECTION');
                  setRemarks('RTC survey number photo is blurry. Please re-upload clear photo.');
                }}
                className={`py-2 px-2.5 rounded-lg border text-xs font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                  decisionType === 'REQUEST_CORRECTION'
                    ? 'bg-amber-50 border-amber-500 text-amber-800 ring-2 ring-amber-500/20'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>ತಿದ್ದುಪಡಿ ಸೂಚಿಸಿ</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDecisionType('REJECT');
                  setRemarks('Verification failed. Criteria requirements not fulfilled.');
                }}
                className={`py-2 px-2.5 rounded-lg border text-xs font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                  decisionType === 'REJECT'
                    ? 'bg-rose-50 border-rose-500 text-rose-800 ring-2 ring-rose-500/20'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>ತಿರಸ್ಕಾರ (Reject)</span>
              </button>
            </div>
          </div>

          {/* Conditional Input 1: Order Number (For Approval) */}
          {decisionType === 'APPROVE' && (
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 space-y-1.5 animate-fade-in">
              <label className="block text-xs font-bold text-emerald-950">
                ಅಧಿಕೃತ ಆದೇಶ ಸಂಖ್ಯೆ (Official Order Number):
              </label>
              <input
                type="text"
                required
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                className="w-full text-xs font-mono px-3 py-2 border border-emerald-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                placeholder="KA-MND-AGR-2024-XXXX"
              />
              <p className="text-[11px] text-emerald-700">
                ಈ ಆದೇಶ ಸಂಖ್ಯೆಯನ್ನು ನಾಗರಿಕರ ವಾಟ್ಸಾಪ್ ನೋಟಿಫಿಕೇಶನ್‌ಗೆ ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಕಳುಹಿಸಲಾಗುತ್ತದೆ.
              </p>
            </div>
          )}

          {/* Conditional Input 2: Rejection Reason (For Rejection) */}
          {decisionType === 'REJECT' && (
            <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-3 space-y-1.5 animate-fade-in">
              <label className="block text-xs font-bold text-rose-950">
                ತಿರಸ್ಕಾರಕ್ಕೆ ಪ್ರಮುಖ ಕಾರಣ (Rejection Reason):
              </label>
              <select
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-rose-300 rounded-lg outline-none focus:ring-2 focus:ring-rose-500 bg-white"
              >
                <option value="Land holding exceeds scheme threshold limit.">
                  ಭೂಮಿ ವಿಸ್ತೀರ್ಣ ಮಿತಿ ಮೀರಿದೆ (Exceeds land ceiling)
                </option>
                <option value="Crop entry does not match notified crop list.">
                  ಬೆಳೆ ಸಮೀಕ್ಷೆಯಲ್ಲಿ ಹೊಂದಾಣಿಕೆಯಾಗಿಲ್ಲ (Crop mismatch)
                </option>
                <option value="Duplicate application detected in family.">
                  ಕುಟುಂಬದಲ್ಲಿ ನಕಲಿ ಅಥವಾ ಪುನರಾವರ್ತಿತ ಅರ್ಜಿ
                </option>
                <option value="Applicant outside jurisdiction.">
                  ವ್ಯಾಪ್ತಿ ಮೀರಿದ ಅರ್ಜಿ
                </option>
              </select>
            </div>
          )}

          {/* Conditional Input 3: Correction Field (For Correction) */}
          {decisionType === 'REQUEST_CORRECTION' && (
            <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3 space-y-1.5 animate-fade-in">
              <label className="block text-xs font-bold text-amber-950">
                ತಿದ್ದುಪಡಿ ಅಗತ್ಯವಿರುವ ದಾಖಲೆ (Target Document):
              </label>
              <select
                value={correctionField}
                onChange={(e) => setCorrectionField(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-amber-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 bg-white"
              >
                <option value="LAND_RECORD">ಪಹಣಿ / ಆರ್‌ಟಿಸಿ (Land Record - Blurry/Invalid)</option>
                <option value="AADHAAR">ಆಧಾರ್ ಕಾರ್ಡ್ (Aadhaar Card - Unclear)</option>
                <option value="INCOME_CERT">ಆದಾಯ ಪ್ರಮಾಣಪತ್ರ (Income Certificate)</option>
              </select>
            </div>
          )}

          {/* Officer Remarks */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ಅಧಿಕಾರಿಯ ಟಿಪ್ಪಣಿ / ಪರಿಶೀಲನಾ ವರದಿ (Remarks / Field Notes):
            </label>
            <textarea
              required
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-slate-800"
              placeholder="ನಮೂದಿಸಿ..."
            />
          </div>

          {/* Outbound Notification Alert */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[11px] text-slate-600 flex items-start space-x-2">
            <Send className="w-3.5 h-3.5 text-saathi-700 flex-shrink-0 mt-0.5" />
            <p>
              ನಿರ್ಧಾರವನ್ನು ದಾಖಲಿಸಿದ ತಕ್ಷಣ, ಅರ್ಜಿದಾರರ ನೋಂದಾಯಿತ ಮೊಬೈಲ್ ಸಂಖ್ಯೆಗೆ ಅಧಿಕೃತ ವಾಟ್ಸಾಪ್ ಸಂದೇಶ ರವಾನೆಯಾಗುತ್ತದೆ.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-2"
            >
              ರದ್ದುಮಾಡಿ
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
                  <span>ದಾಖಲಿಸಲಾಗುತ್ತಿದೆ...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>ನಿರ್ಧಾರವನ್ನು ದೃಢೀಕರಿಸಿ</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
