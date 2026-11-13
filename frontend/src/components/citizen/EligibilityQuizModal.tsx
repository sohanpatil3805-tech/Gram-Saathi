import React, { useState } from 'react';
import { Scheme, CitizenProfile, EligibilityAssessmentResult } from '../../types/api';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../services/api';
import { 
  X, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Loader2,
  ShieldCheck 
} from 'lucide-react';

interface EligibilityQuizModalProps {
  scheme: Scheme;
  isOpen: boolean;
  onClose: () => void;
  onEligibilityConfirmed: (profile: CitizenProfile, result: EligibilityAssessmentResult) => void;
}

export const EligibilityQuizModal: React.FC<EligibilityQuizModalProps> = ({
  scheme,
  isOpen,
  onClose,
  onEligibilityConfirmed,
}) => {
  const { language, t } = useLanguage();

  const [profile, setProfile] = useState<CitizenProfile>({
    citizen_group: scheme.target_group || 'FARMER',
    annual_income: 80000,
    land_holding_acres: 1.5,
    has_bank_account: true,
    caste_category: 'OBC',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState<EligibilityAssessmentResult | null>(null);

  if (!isOpen) return null;

  const handleEvaluate = async () => {
    setIsLoading(true);
    try {
      const result = await api.assessEligibility(scheme.id, profile);
      setAssessmentResult(result);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceed = () => {
    if (assessmentResult) {
      onEligibilityConfirmed(profile, assessmentResult);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-modal overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-whatsapp-teal text-white px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-amber-300" />
            <div>
              <h2 className="font-bold text-sm leading-tight">
                {t('eligibilityQuizTitle')}
              </h2>
              <p className="text-[11px] text-emerald-100 line-clamp-1">
                {scheme.name[language] || scheme.name.kn}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body content */}
        <div className="p-4 overflow-y-auto space-y-4">
          {!assessmentResult ? (
            <div className="space-y-3.5">
              {/* Citizen Group */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('citizenGroup')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'FARMER', label: t('farmer') },
                    { id: 'STUDENT', label: t('student') },
                    { id: 'WOMAN_ENTREPRENEUR', label: t('womanEntrepreneur') },
                    { id: 'WAGE_WORKER', label: t('wageWorker') },
                  ].map((grp) => (
                    <button
                      key={grp.id}
                      type="button"
                      onClick={() =>
                        setProfile({ ...profile, citizen_group: grp.id as any })
                      }
                      className={`text-xs p-2.5 rounded-lg border font-medium text-left transition-all ${
                        profile.citizen_group === grp.id
                          ? 'bg-saathi-50 border-saathi-600 text-saathi-900 ring-2 ring-saathi-500/20'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {grp.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Annual Income */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('annualIncome')}
                </label>
                <input
                  type="number"
                  value={profile.annual_income}
                  onChange={(e) =>
                    setProfile({ ...profile, annual_income: Number(e.target.value) })
                  }
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-whatsapp-teal/30 focus:border-whatsapp-teal outline-none"
                  placeholder="80000"
                />
                <p className="text-[11px] text-slate-500 mt-0.5">
                  ₹{profile.annual_income.toLocaleString('en-IN')} / ವರ್ಷಕ್ಕೆ
                </p>
              </div>

              {/* Land Holding (if farmer) */}
              {profile.citizen_group === 'FARMER' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('landHolding')}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={profile.land_holding_acres ?? 1.5}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        land_holding_acres: Number(e.target.value),
                      })
                    }
                    className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-whatsapp-teal/30 focus:border-whatsapp-teal outline-none"
                    placeholder="1.5"
                  />
                </div>
              )}

              {/* Bank Account */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('hasBankAccount')}
                </label>
                <div className="flex space-x-3">
                  <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="has_bank"
                      checked={profile.has_bank_account === true}
                      onChange={() => setProfile({ ...profile, has_bank_account: true })}
                      className="text-whatsapp-teal focus:ring-whatsapp-teal"
                    />
                    <span>{t('yes')} (ಆಧಾರ್ ಜೋಡಣೆ ಇದೆ)</span>
                  </label>
                  <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="has_bank"
                      checked={profile.has_bank_account === false}
                      onChange={() => setProfile({ ...profile, has_bank_account: false })}
                      className="text-whatsapp-teal focus:ring-whatsapp-teal"
                    />
                    <span>{t('no')}</span>
                  </label>
                </div>
              </div>

              {/* Security note */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-saathi-700 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-600 leading-tight">
                  ಖಾಸಗಿತನ ನಿಯಮ: ಯಾವುದೇ ಬ್ಯಾಂಕ್ ಖಾತೆ ಸಂಖ್ಯೆ ಅಥವಾ ಸೂಕ್ಷ್ಮ ಗುರುತಿನ ಸಂಖ್ಯೆಗಳನ್ನು ಸಂಗ್ರಹಿಸಲಾಗುವುದಿಲ್ಲ.
                </p>
              </div>
            </div>
          ) : (
            /* Results Screen */
            <div className="space-y-4 animate-fade-in">
              {/* Prototype Indicative Assessment Notice */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="leading-snug">
                  <strong>ಪ್ರೊಟೋಟೈಪ್ ಪ್ರಾಥಮಿಕ ಅಂದಾಜು:</strong> ಇದು ಕೇವಲ ಕಂಪ್ಯೂಟರ್ ಆಧಾರಿತ ನಿಯಮಗಳ ಹೊಂದಾಣಿಕೆ ಅಂದಾಜಾಗಿದ್ದು, ಅಧಿಕೃತ ಅರ್ಹತೆಯ ದೃಢೀಕರಣವಲ್ಲ. ಅಂತಿಮ ನಿರ್ಧಾರವು ಸರ್ಕಾರಿ ಅಧಿಕಾರಿಗಳ ಕ್ಷೇತ್ರ ಪರಿಶೀಲನೆಗೆ ಒಳಪಟ್ಟಿರುತ್ತದೆ.
                </p>
              </div>

              {/* Score banner */}
              <div
                className={`p-4 rounded-xl border text-center ${
                  assessmentResult.eligible
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'bg-amber-50 border-amber-300 text-amber-950'
                }`}
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-2 bg-white shadow-sm">
                  {assessmentResult.eligible ? (
                    <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-7 h-7 text-amber-600" />
                  )}
                </div>
                <h3 className="font-bold text-sm sm:text-base">
                  {assessmentResult.eligible
                    ? 'ಪ್ರಾಥಮಿಕ ಷರತ್ತುಗಳು ಸರಿಹೊಂದಿವೆ (Indicative Rules Satisfied)'
                    : 'ಕೆಲವು ಷರತ್ತುಗಳು ಅಪೂರ್ಣವಾಗಿವೆ (Indicative Gaps Detected)'}
                </h3>
                <p className="text-xs mt-1 text-slate-700">
                  ಹೊಂದಾಣಿಕೆ ಅಂದಾಜು: <strong className="font-bold font-mono">{assessmentResult.score}%</strong> ({assessmentResult.confidence} Confidence - Indicative Only)
                </p>
              </div>

              {/* Matched criteria */}
              <div>
                <p className="text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{t('matchedCriteria')} ({assessmentResult.matched_criteria.length}):</span>
                </p>
                <div className="space-y-1.5">
                  {assessmentResult.matched_criteria.map((c, idx) => (
                    <div
                      key={idx}
                      className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-2 text-xs flex items-center justify-between"
                    >
                      <span className="text-slate-800">{c.criterion_name}</span>
                      <span className="text-emerald-700 font-semibold font-mono text-[11px]">
                        ✓ {String(c.citizen_value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Unmet criteria (if any) */}
              {assessmentResult.unmet_criteria.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-amber-700 mb-1 flex items-center space-x-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span>{t('unmetCriteria')}:</span>
                  </p>
                  <div className="space-y-1.5">
                    {assessmentResult.unmet_criteria.map((u, idx) => (
                      <div
                        key={idx}
                        className="bg-amber-50/60 border border-amber-200 rounded-lg p-2 text-xs text-amber-900"
                      >
                        <p className="font-semibold">{u.criterion_name}</p>
                        <p className="text-[11px] text-amber-800 mt-0.5">{u.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-3 flex items-center justify-between">
          {!assessmentResult ? (
            <>
              <button
                onClick={onClose}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-2"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleEvaluate}
                disabled={isLoading}
                className="bg-whatsapp-teal hover:bg-whatsapp-darkTeal text-white text-xs font-semibold px-4 py-2 rounded-lg shadow flex items-center space-x-1.5 transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t('loading')}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>{t('evaluateEligibility')}</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setAssessmentResult(null)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-2"
              >
                {t('back')}
              </button>
              <button
                onClick={handleProceed}
                className="bg-whatsapp-green text-slate-950 hover:bg-emerald-400 font-bold text-xs px-4 py-2 rounded-lg shadow flex items-center space-x-1.5 transition-all"
              >
                <span>{t('applyNow')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
