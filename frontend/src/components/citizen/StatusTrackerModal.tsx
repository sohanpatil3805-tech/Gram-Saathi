import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { 
  X, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileText, 
  ArrowRight,
  ShieldCheck 
} from 'lucide-react';
import { api } from '../../services/api';
import { ApplicationRecord } from '../../types/officer';

interface StatusTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialReference?: string;
}

export const StatusTrackerModal: React.FC<StatusTrackerModalProps> = ({
  isOpen,
  onClose,
  initialReference = 'SIM-2024-00042',
}) => {
  const { t } = useLanguage();
  const [refInput, setRefInput] = useState(initialReference);
  const [currentApp, setCurrentApp] = useState<ApplicationRecord | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async () => {
    if (!refInput.trim()) return;
    setIsSearching(true);
    setHasSearched(true);
    try {
      const app = await api.getOfficerApplicationById(refInput.trim());
      setCurrentApp(app || null);
    } catch {
      setCurrentApp(null);
    } finally {
      setIsSearching(false);
    }
  };

  const steps = [
    {
      title: 'ಅರ್ಜಿ ಸಲ್ಲಿಕೆ (Citizen Submitted)',
      desc: 'ವಾಟ್ಸಾಪ್ ಚಾಟ್‌ಬಾಟ್ ಮೂಲಕ 5-ನಿಮಿಷದ ಟೋಕನ್ ಬಳಸಿ ದೃಢೀಕರಿಸಲಾಗಿದೆ.',
      isDone: true,
      time: currentApp?.submitted_at ? new Date(currentApp.submitted_at).toLocaleDateString() : 'Today',
    },
    {
      title: 'ಸ್ಥಳೀಯ OCR ದಾಖಲೆ ಪರಿಶೀಲನೆ',
      desc: 'ಆಧಾರ್ & ಭೂಮಿ ಪಹಣಿ ನಿಯಮಗಳಿಗೆ ಹೊಂದಿಕೆಯಾಗಿದೆ.',
      isDone: currentApp?.documents?.some((d) => d.validation_status === 'VALID') ?? true,
      time: 'Completed',
    },
    {
      title: 'ಗ್ರಾಮ ಪಂಚಾಯತಿ ಅಧಿಕಾರಿ ಪರಿಶೀಲನೆ',
      desc: 'ಮದ್ದೂರು ಗ್ರಾಮ ಪಂಚಾಯತಿ ಕಾರ್ಯದರ್ಶಿ ಪರಿಶೀಲಿಸುತ್ತಿದ್ದಾರೆ.',
      isDone: currentApp?.status === 'APPROVED' || currentApp?.status === 'OFFICER_REVIEW',
      isCurrent: currentApp?.status === 'OFFICER_REVIEW',
      time: 'In Progress',
    },
    {
      title: 'ತಹಶೀಲ್ದಾರ್ ಅಂತಿಮ ಆದೇಶ (Final Order)',
      desc: currentApp?.official_order_number 
        ? `ಆದೇಶ ಸಂಖ್ಯೆ: ${currentApp.official_order_number}`
        : 'ಅಂತಿಮ ಆದೇಶಕ್ಕಾಗಿ ಕಾಯಲಾಗುತ್ತಿದೆ.',
      isDone: currentApp?.status === 'APPROVED',
      time: currentApp?.status === 'APPROVED' ? 'Approved' : 'Pending',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] flex flex-col shadow-modal overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-whatsapp-teal text-white px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-emerald-300" />
            <h2 className="font-bold text-sm">
              {t('trackApplication')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            {t('enterReference')}
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={refInput}
              onChange={(e) => setRefInput(e.target.value)}
              placeholder="SIM-2024-00042"
              className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-whatsapp-teal/30 focus:border-whatsapp-teal font-mono uppercase"
            />
            <button
              onClick={handleSearch}
              className="bg-whatsapp-teal hover:bg-whatsapp-darkTeal text-white text-xs font-semibold px-4 py-2 rounded-lg shadow transition-all"
            >
              {t('checkStatus')}
            </button>
          </div>
        </div>

        {/* Timeline View */}
        <div className="p-4 overflow-y-auto space-y-4">
          {hasSearched && !currentApp ? (
            <div className="p-4 text-center text-xs text-slate-500">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              ಯಾವುದೇ ಅರ್ಜಿ ಕಂಡುಬಂದಿಲ್ಲ. ದಯವಿಟ್ಟು ಸರಿಯಾದ ಉಲ್ಲೇಖ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ (ಉದಾ: SIM-2024-00042).
            </div>
          ) : (
            <div className="space-y-4">
              {currentApp && (
                <div className="bg-saathi-50 border border-saathi-200 rounded-xl p-3 text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-saathi-950">
                      {currentApp.scheme_name}
                    </span>
                    <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-saathi-300 font-bold text-saathi-800">
                      {currentApp.status}
                    </span>
                  </div>
                  <p className="text-slate-600">
                    ಅರ್ಜಿದಾರರು: <strong>{currentApp.applicant.full_name}</strong> • {currentApp.applicant.village}
                  </p>
                </div>
              )}

              <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200">
                {steps.map((st, i) => (
                  <div key={i} className="flex items-start space-x-3 relative z-10">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                        st.isDone
                          ? 'bg-emerald-600 text-white shadow'
                          : st.isCurrent
                          ? 'bg-amber-500 text-white animate-pulse'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {st.isDone ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Clock className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="flex-1 bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm text-xs">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-slate-900">{st.title}</h4>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {st.time}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        {st.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
