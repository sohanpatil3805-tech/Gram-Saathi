import React, { useState } from 'react';
import { 
  BackendScheme, 
  DiscoveredScheme, 
  ApplicantProfile, 
  BackendEligibilityResult, 
  CitizenGroup 
} from '../../types/api';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../services/api';
import { 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  ShieldCheck, 
  FileText, 
  RotateCcw,
  Building2,
  MapPin,
  Loader2,
  ExternalLink
} from 'lucide-react';

interface EligibilityWizardProps {
  scheme: BackendScheme | DiscoveredScheme;
  initialFacts?: Partial<ApplicantProfile>;
  onClose?: () => void;
  onProceedToPreparation?: (facts: ApplicantProfile, result: BackendEligibilityResult) => void;
}

const KARNATAKA_DISTRICTS = [
  'Mandya', 'Mysuru', 'Bengaluru Urban', 'Bengaluru Rural', 'Ramanagara',
  'Hassan', 'Tumakuru', 'Chikkamagaluru', 'Belagavi', 'Dharwad', 'Kalaburagi',
  'Ballari', 'Shivamogga', 'Udupi', 'Dakshina Kannada', 'Uttara Kannada', 'Kolar'
];

export const EligibilityWizard: React.FC<EligibilityWizardProps> = ({
  scheme,
  initialFacts,
  onClose,
  onProceedToPreparation
}) => {
  const { t, language } = useLanguage();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [facts, setFacts] = useState<ApplicantProfile>({
    beneficiary_group: (initialFacts?.beneficiary_group as CitizenGroup) || 'farmers',
    state: initialFacts?.state || 'Karnataka',
    district: initialFacts?.district || 'Mandya',
    has_cultivable_land_record: initialFacts?.has_cultivable_land_record ?? true,
    land_holding_acres: initialFacts?.land_holding_acres ?? 1.5,
    crop_notified: initialFacts?.crop_notified ?? true,
    crop_type: initialFacts?.crop_type || 'Ragi',
    is_institutional_landholder: initialFacts?.is_institutional_landholder ?? false,
    education_level: initialFacts?.education_level || 'Post-Matric / Undergraduate',
    annual_income_range: initialFacts?.annual_income_range || 'Under ₹1,00,000',
    annual_income_inr: initialFacts?.annual_income_inr || 80000,
    has_bank_account: initialFacts?.has_bank_account ?? true,
    self_help_group_member: initialFacts?.self_help_group_member ?? false,
  });

  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<BackendEligibilityResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const isFarmer = facts.beneficiary_group === 'farmers';
  const isStudent = facts.beneficiary_group === 'students';
  const isWoman = facts.beneficiary_group === 'women_entrepreneurs';

  // Step 3 -> 4: Call Real Deterministic Backend Evaluation Endpoint
  const handleEvaluate = async () => {
    setIsEvaluating(true);
    setApiError(null);
    try {
      // Map frontend facts into the structured dictionary expected by backend rules
      const applicantFacts: Record<string, any> = {
        state: facts.state,
        district: facts.district,
        beneficiary_group: facts.beneficiary_group,
        has_cultivable_land_record: facts.has_cultivable_land_record,
        land_holding_acres: facts.land_holding_acres,
        is_institutional_landholder: facts.is_institutional_landholder,
        annual_income_inr: facts.annual_income_inr,
        crop_notified: facts.crop_notified,
        education_level: facts.education_level,
      };

      const result = await api.checkEligibility({
        scheme_id: scheme.scheme_id,
        applicant_facts: applicantFacts,
      });

      setEvaluationResult(result);
      setCurrentStep(4);
    } catch (err: any) {
      console.error('[EligibilityWizard Error]', err);
      setApiError(
        err?.response?.data?.detail || 
        'Could not complete evaluation against the backend service. Please check network connection.'
      );
    } finally {
      setIsEvaluating(false);
    }
  };

  const schemeNameLocalized = typeof scheme.name === 'object' 
    ? (scheme.name[language] || scheme.name.en) 
    : scheme.name;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden max-w-2xl mx-auto my-4 transition-all">
      {/* Header with Progress Steps */}
      <div className="bg-slate-900 text-white p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-saathi-700 flex items-center justify-center text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold leading-tight">
                {t('wizardTitle')}
              </h2>
              <p className="text-[11px] text-slate-300 font-medium truncate max-w-xs sm:max-w-md">
                {schemeNameLocalized}
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded"
              aria-label={t('close')}
            >
              {t('close')}
            </button>
          )}
        </div>

        {/* 4-Step Progress Bar */}
        <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-800 text-[11px]">
          {[
            { step: 1, label: t('stepCategory') },
            { step: 2, label: t('stepDetails') },
            { step: 3, label: t('stepReview') },
            { step: 4, label: t('stepResult') }
          ].map((s) => (
            <div key={s.step} className="space-y-1">
              <div 
                className={`h-1.5 rounded-full transition-all ${
                  currentStep >= s.step ? 'bg-saathi-400' : 'bg-slate-700'
                }`}
              />
              <span className={`block truncate ${currentStep === s.step ? 'text-saathi-300 font-bold' : 'text-slate-400'}`}>
                {s.step}. {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Wizard Body */}
      <div className="p-4 sm:p-6 space-y-5">
        {/* STEP 1: Category & Geography */}
        {currentStep === 1 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                1. {t('askCategoryTitle')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { id: 'farmers', label: t('farmerCategory'), desc: 'Cultivators, landholders, crop insurance seekers' },
                  { id: 'students', label: t('studentCategory'), desc: 'College, post-matric, technical scholarship seekers' },
                  { id: 'women_entrepreneurs', label: t('womanCategory'), desc: 'SHG members, small rural businesses' },
                  { id: 'workers', label: t('workerCategory'), desc: 'Daily wage laborers, artisan workers' },
                  { id: 'general', label: t('generalCategory'), desc: 'All other rural citizen welfare services' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setFacts({ ...facts, beneficiary_group: cat.id as CitizenGroup })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      facts.beneficiary_group === cat.id
                        ? 'bg-saathi-50 border-saathi-600 ring-2 ring-saathi-500/20 text-slate-900'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <p className="font-bold text-xs">{cat.label}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{cat.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('stateLabel')}
                </label>
                <input
                  type="text"
                  disabled
                  value={facts.state}
                  className="w-full text-xs px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('districtLabel')}
                </label>
                <select
                  value={facts.district}
                  onChange={(e) => setFacts({ ...facts, district: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium outline-none focus:ring-2 focus:ring-saathi-500/30"
                >
                  {KARNATAKA_DISTRICTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Relevant Criteria Based on Category */}
        {currentStep === 2 && (
          <div className="space-y-4 animate-fade-in">
            {isFarmer && (
              <div className="space-y-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {t('landholdingQuestion')}
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2">
                    PM-KISAN and state farmer programmes require verifiable entries in Bhoomi land records.
                  </p>
                  <div className="flex gap-4">
                    <label className="flex items-center space-x-2 text-xs font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="land_record"
                        checked={facts.has_cultivable_land_record === true}
                        onChange={() => setFacts({ ...facts, has_cultivable_land_record: true })}
                        className="text-saathi-700 focus:ring-saathi-600"
                      />
                      <span>Yes (ಹೌದು / हाँ)</span>
                    </label>
                    <label className="flex items-center space-x-2 text-xs font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="land_record"
                        checked={facts.has_cultivable_land_record === false}
                        onChange={() => setFacts({ ...facts, has_cultivable_land_record: false })}
                        className="text-saathi-700 focus:ring-saathi-600"
                      />
                      <span>No (ಇಲ್ಲ / नहीं)</span>
                    </label>
                  </div>
                </div>

                {facts.has_cultivable_land_record && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t('landAcresLabel')}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="100"
                      value={facts.land_holding_acres}
                      onChange={(e) => setFacts({ ...facts, land_holding_acres: parseFloat(e.target.value) || 0 })}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-saathi-500/30"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Small and marginal farmers hold up to 5 acres (2 hectares).
                    </p>
                  </div>
                )}

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {t('institutionalExclusionQuestion')}
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Institutional landholders (trusts, registered companies) are excluded under PM-KISAN guidelines.
                  </p>
                  <div className="flex gap-4">
                    <label className="flex items-center space-x-2 text-xs font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="inst_holder"
                        checked={facts.is_institutional_landholder === false}
                        onChange={() => setFacts({ ...facts, is_institutional_landholder: false })}
                        className="text-saathi-700"
                      />
                      <span>No, individual/family farmer (ಅಲ್ಲ / नहीं)</span>
                    </label>
                    <label className="flex items-center space-x-2 text-xs font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="inst_holder"
                        checked={facts.is_institutional_landholder === true}
                        onChange={() => setFacts({ ...facts, is_institutional_landholder: true })}
                        className="text-saathi-700"
                      />
                      <span>Yes, institutional entity (ಹೌದು / हाँ)</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {isStudent && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('educationLevelLabel')}
                  </label>
                  <select
                    value={facts.education_level}
                    onChange={(e) => setFacts({ ...facts, education_level: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white"
                  >
                    <option value="Post-Matric / Undergraduate">Post-Matric (PUC / ITI / Diploma / Degree)</option>
                    <option value="Higher Secondary (10th)">Pre-Matric / High School (9th-10th)</option>
                    <option value="Postgraduate / Professional">Postgraduate (MA, M.Sc, Professional)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('incomeRangeLabel')} (₹ / ವರ್ಷಕ್ಕೆ)
                  </label>
                  <select
                    value={facts.annual_income_inr}
                    onChange={(e) => setFacts({ ...facts, annual_income_inr: parseInt(e.target.value) })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white"
                  >
                    <option value="80000">Below ₹1,00,000 (ಅತ್ಯಂತ ಕಡಿಮೆ ಆದಾಯ)</option>
                    <option value="180000">₹1,00,000 – ₹2,50,000 (ಮಧ್ಯಮ ಆದಾಯ ಮಿತಿ)</option>
                    <option value="350000">Above ₹2,50,000 (ಉನ್ನತ ಆದಾಯ)</option>
                  </select>
                </div>
              </div>
            )}

            {!isFarmer && !isStudent && (
              <div className="space-y-4">
                {isWoman && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      {t('shgMembershipQuestion')}
                    </label>
                    <div className="flex gap-4 mt-2">
                      <label className="flex items-center space-x-2 text-xs font-medium cursor-pointer">
                        <input
                          type="radio"
                          name="shg_member"
                          checked={facts.self_help_group_member === true}
                          onChange={() => setFacts({ ...facts, self_help_group_member: true })}
                        />
                        <span>Yes (ಹೌದು / हाँ)</span>
                      </label>
                      <label className="flex items-center space-x-2 text-xs font-medium cursor-pointer">
                        <input
                          type="radio"
                          name="shg_member"
                          checked={facts.self_help_group_member === false}
                          onChange={() => setFacts({ ...facts, self_help_group_member: false })}
                        />
                        <span>No (ಇಲ್ಲ / नहीं)</span>
                      </label>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('incomeRangeLabel')}
                  </label>
                  <select
                    value={facts.annual_income_inr}
                    onChange={(e) => setFacts({ ...facts, annual_income_inr: parseInt(e.target.value) })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white"
                  >
                    <option value="60000">Below ₹1,00,000 / year</option>
                    <option value="150000">₹1,00,000 – ₹2,50,000 / year</option>
                    <option value="300000">Above ₹2,50,000 / year</option>
                  </select>
                </div>
              </div>
            )}

            {/* Privacy Guarantee Note */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start space-x-2 text-[11px] text-emerald-900">
              <ShieldCheck className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
              <span>
                Privacy Guarantee: We only record necessary eligibility parameters. No sensitive identifiers (Aadhaar number or bank passwords) are requested.
              </span>
            </div>
          </div>
        )}

        {/* STEP 3: Review Answers Before Evaluation */}
        {currentStep === 3 && (
          <div className="space-y-4 animate-fade-in">
            <div className="border-b border-slate-200 pb-2">
              <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                {t('reviewAnswersTitle')}
              </h3>
              <p className="text-[11px] text-slate-500">
                {t('reviewAnswersSubtitle')}
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 divide-y divide-slate-200/80 text-xs">
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Beneficiary Category:</span>
                <span className="font-bold text-slate-800 capitalize">{facts.beneficiary_group}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">State & District:</span>
                <span className="font-semibold text-slate-800">{facts.district}, {facts.state}</span>
              </div>

              {isFarmer && (
                <>
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-500">Cultivable Land Record:</span>
                    <span className="font-semibold text-slate-800">
                      {facts.has_cultivable_land_record ? `Yes (${facts.land_holding_acres} Acres)` : 'No Land Record'}
                    </span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-500">Institutional Landholder:</span>
                    <span className="font-semibold text-slate-800">
                      {facts.is_institutional_landholder ? 'Yes (Exclusion applies)' : 'No (Individual Farmer)'}
                    </span>
                  </div>
                </>
              )}

              {isStudent && (
                <>
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-500">Education Level:</span>
                    <span className="font-semibold text-slate-800">{facts.education_level}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-500">Household Income:</span>
                    <span className="font-semibold text-slate-800">Approx. ₹{facts.annual_income_inr?.toLocaleString('en-IN')}</span>
                  </div>
                </>
              )}
            </div>

            {apiError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Backend Service Error</p>
                  <p className="text-[11px] mt-0.5">{apiError}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: Honest Deterministic Results from Real Backend */}
        {currentStep === 4 && evaluationResult && (
          <div className="space-y-4 animate-fade-in">
            {/* Outcome Banner */}
            <div
              className={`p-4 rounded-xl border text-center ${
                evaluationResult.outcome === 'potentially_eligible'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : evaluationResult.outcome === 'not_eligible'
                  ? 'bg-rose-50 border-rose-300 text-rose-950'
                  : evaluationResult.outcome === 'needs_information'
                  ? 'bg-amber-50 border-amber-300 text-amber-950'
                  : 'bg-blue-50 border-blue-300 text-blue-950'
              }`}
            >
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full mb-2 bg-white shadow-sm">
                {evaluationResult.outcome === 'potentially_eligible' && (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                )}
                {evaluationResult.outcome === 'not_eligible' && (
                  <AlertCircle className="w-6 h-6 text-rose-600" />
                )}
                {evaluationResult.outcome === 'needs_information' && (
                  <HelpCircle className="w-6 h-6 text-amber-600" />
                )}
                {evaluationResult.outcome === 'manual_review' && (
                  <Building2 className="w-6 h-6 text-blue-600" />
                )}
              </div>

              <h3 className="font-bold text-sm sm:text-base">
                {evaluationResult.outcome === 'potentially_eligible' && t('outcomePotentiallyEligible')}
                {evaluationResult.outcome === 'not_eligible' && t('outcomeNotEligible')}
                {evaluationResult.outcome === 'needs_information' && t('outcomeNeedsInfo')}
                {evaluationResult.outcome === 'manual_review' && t('outcomeManualReview')}
              </h3>

              <p className="text-xs mt-1 text-slate-700 max-w-md mx-auto leading-relaxed">
                {evaluationResult.outcome === 'potentially_eligible' && t('outcomePotentiallyEligibleDesc')}
                {evaluationResult.outcome === 'not_eligible' && t('outcomeNotEligibleDesc')}
                {evaluationResult.outcome === 'needs_information' && t('outcomeNeedsInfoDesc')}
                {evaluationResult.outcome === 'manual_review' && t('outcomeManualReviewDesc')}
              </p>
            </div>

            {/* Individual Rule Results */}
            {evaluationResult.rule_results && evaluationResult.rule_results.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Rule-by-Rule Evaluation:
                </p>
                <div className="space-y-1.5 text-xs">
                  {evaluationResult.rule_results.map((r) => (
                    <div 
                      key={r.rule_id}
                      className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-start space-x-2"
                    >
                      <span className="font-mono text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700 font-bold flex-shrink-0 mt-0.5">
                        {r.rule_id}
                      </span>
                      <div className="flex-1">
                        <p className="text-slate-800 font-medium">{r.message}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">Outcome: {r.outcome}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing fields notice if any */}
            {evaluationResult.missing_fields && evaluationResult.missing_fields.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                <p className="font-bold">{t('missingFieldsNotice')}</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  {evaluationResult.missing_fields.map((f) => (
                    <li key={f} className="font-mono">{f}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Official Disclaimer */}
            <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-[11px] text-slate-600 leading-snug">
              <strong>{t('officialDisclaimerLabel')}</strong>
              <p className="mt-0.5">{evaluationResult.disclaimer}</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="bg-slate-50 border-t border-slate-200 p-3 sm:p-4 flex items-center justify-between">
        {currentStep > 1 && currentStep < 4 && (
          <button
            type="button"
            onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
            className="text-xs font-bold text-slate-700 hover:text-slate-900 px-3 py-2 flex items-center space-x-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t('back')}</span>
          </button>
        )}

        {currentStep === 1 && (
          <div />
        )}

        {currentStep < 3 && (
          <button
            type="button"
            onClick={() => setCurrentStep((prev) => (prev + 1) as any)}
            className="bg-saathi-800 hover:bg-saathi-900 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center space-x-1.5 transition-all shadow-sm"
          >
            <span>{t('next')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}

        {currentStep === 3 && (
          <button
            type="button"
            onClick={handleEvaluate}
            disabled={isEvaluating}
            className="bg-saathi-800 hover:bg-saathi-900 disabled:bg-slate-400 text-white font-bold text-xs px-5 py-2.5 rounded-lg flex items-center space-x-1.5 transition-all shadow-md"
          >
            {isEvaluating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{t('evaluatingEligibility')}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>{t('runCheckButton')}</span>
              </>
            )}
          </button>
        )}

        {currentStep === 4 && (
          <div className="w-full flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center space-x-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('edit')} Answers</span>
            </button>

            {onProceedToPreparation && evaluationResult && (
              <button
                type="button"
                onClick={() => onProceedToPreparation(facts, evaluationResult)}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center space-x-1.5 shadow"
              >
                <span>{t('prepareApplicationBtn')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
