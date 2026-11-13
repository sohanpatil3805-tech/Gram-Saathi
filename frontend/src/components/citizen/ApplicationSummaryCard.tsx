import React, { useState, useEffect } from 'react';
import { ApplicationPreview } from '../../types/api';
import { useLanguage } from '../../context/LanguageContext';
import { 
  Clock, 
  CheckCircle, 
  ShieldAlert, 
  ArrowRight, 
  FileCheck, 
  Lock, 
  AlertCircle 
} from 'lucide-react';

interface ApplicationSummaryCardProps {
  preview: ApplicationPreview;
  onConfirmSubmit: (token: string) => void;
  isSubmitting?: boolean;
}

export const ApplicationSummaryCard: React.FC<ApplicationSummaryCardProps> = ({
  preview,
  onConfirmSubmit,
  isSubmitting = false,
}) => {
  const { t, language } = useLanguage();

  // 5-minute countdown state
  const [secondsRemaining, setSecondsRemaining] = useState<number>(preview.ttl_seconds || 300);
  const [hasConsented, setHasConsented] = useState<boolean>(false);
  const [isExpired, setIsExpired] = useState<boolean>(false);

  useEffect(() => {
    if (secondsRemaining <= 0) {
      setIsExpired(true);
      return;
    }
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          setIsExpired(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsRemaining]);

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const percentRemaining = (secondsRemaining / (preview.ttl_seconds || 300)) * 100;

  return (
    <div className="bg-white rounded-xl border-2 border-saathi-600/40 shadow-card overflow-hidden my-2 max-w-md w-full">
      {/* Top Banner with Countdown */}
      <div className="bg-saathi-950 text-white p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <Lock className="w-4 h-4 text-amber-400" />
            <h4 className="font-bold text-xs">
              {t('tokenNotice')}
            </h4>
          </div>
          <div className="flex items-center space-x-1 font-mono text-xs font-bold text-amber-300 bg-white/10 px-2 py-0.5 rounded">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            <span>{timeFormatted}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ${
              secondsRemaining > 60 ? 'bg-saathi-400' : 'bg-red-400'
            }`}
            style={{ width: `${percentRemaining}%` }}
          ></div>
        </div>

        <p className="text-[10px] text-slate-300 font-mono">
          ಟೋಕನ್ ID: {preview.confirmation_token} • {t('tokenRemaining')} {timeFormatted}
        </p>
      </div>

      {/* Summary Content */}
      <div className="p-3.5 space-y-3">
        <div>
          <span className="text-[10px] font-bold tracking-wider text-saathi-800 bg-saathi-50 px-2 py-0.5 rounded border border-saathi-200 uppercase">
            {preview.scheme_code}
          </span>
          <h3 className="font-bold text-slate-900 text-sm mt-1 leading-snug">
            {preview.scheme_name}
          </h3>
        </div>

        {/* Applicant Key Details */}
        <div className="bg-slate-50 rounded-lg p-2.5 text-xs space-y-1.5 border border-slate-200/80">
          <div className="flex justify-between border-b border-slate-200/60 pb-1">
            <span className="text-slate-500">ಅರ್ಜಿದಾರರು (Applicant):</span>
            <span className="font-bold text-slate-900">
              {preview.preview_summary.applicant_name}
            </span>
          </div>
          <div className="flex justify-between border-b border-slate-200/60 pb-1">
            <span className="text-slate-500">ಗ್ರಾಮ / ತಾಲೂಕು:</span>
            <span className="font-semibold text-slate-800">
              {preview.preview_summary.village}, {preview.preview_summary.district}
            </span>
          </div>
          <div className="flex justify-between border-b border-slate-200/60 pb-1">
            <span className="text-slate-500">ನಿರೀಕ್ಷಿತ ವಾರ್ಷಿಕ ನೆರವು:</span>
            <span className="font-bold text-saathi-700">
              {preview.preview_summary.benefit_amount}
            </span>
          </div>
          <div className="flex justify-between pt-0.5">
            <span className="text-slate-500">ಪರಿಶೀಲಿಸಲಾದ ದಾಖಲೆಗಳು:</span>
            <span className="text-emerald-700 font-semibold flex items-center space-x-1">
              <FileCheck className="w-3.5 h-3.5" />
              <span>ಆಧಾರ್ + ಆರ್‌ಟಿಸಿ (ಸರಿಹೊಂದಿದೆ)</span>
            </span>
          </div>
        </div>

        {/* Consent Declaration Checkbox */}
        <div className="bg-amber-50/60 border border-amber-200/80 rounded-lg p-2.5">
          <label className="flex items-start space-x-2 text-xs text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={hasConsented}
              onChange={(e) => setHasConsented(e.target.checked)}
              disabled={isExpired}
              className="mt-0.5 w-4 h-4 text-saathi-700 rounded border-slate-300 focus:ring-saathi-600"
            />
            <span className="leading-snug">
              {t('consentNotice')} {t('simulatedWarning')}
            </span>
          </label>
        </div>

        {/* Expiration alert if token expired */}
        {isExpired && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-800 flex items-center space-x-1.5">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>5-ನಿಮಿಷದ ದೃಢೀಕರಣ ಟೋಕನ್ ಮುಕ್ತಾಯವಾಗಿದೆ. ದಯವಿಟ್ಟು ಹೊಸ ಟೋಕನ್ ರಚಿಸಿ.</span>
          </div>
        )}

        {/* Submit Consequential Action */}
        <button
          onClick={() => onConfirmSubmit(preview.confirmation_token)}
          disabled={!hasConsented || isExpired || isSubmitting}
          className="w-full bg-whatsapp-teal hover:bg-whatsapp-darkTeal disabled:bg-slate-300 active:scale-95 text-white font-bold text-xs py-2.5 px-3 rounded-lg shadow flex items-center justify-center space-x-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <span>ಸಲ್ಲಿಸಲಾಗುತ್ತಿದೆ...</span>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 text-whatsapp-green" />
              <span>{t('confirmAndSubmit')}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
