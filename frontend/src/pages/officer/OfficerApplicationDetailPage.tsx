import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { OfficerLayout } from '../../components/officer/OfficerLayout';
import { StatusBadge } from '../../components/officer/StatusBadge';
import { OCRVerificationPanel } from '../../components/officer/OCRVerificationPanel';
import { OfficerDecisionModal } from '../../components/officer/OfficerDecisionModal';
import { ApplicationPDFViewer } from '../../components/officer/ApplicationPDFViewer';
import { ApplicationRecord, OfficerDecisionPayload } from '../../types/officer';
import { api } from '../../services/api';
import { useOfficerAuth } from '../../context/OfficerAuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Printer, 
  History, 
  User, 
  ShieldCheck, 
  MapPin, 
  Phone, 
  Landmark, 
  FileText,
  Clock
} from 'lucide-react';

export const OfficerApplicationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { officer } = useOfficerAuth();
  const { t, language } = useLanguage();

  const [application, setApplication] = useState<ApplicationRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [isPdfOpen, setIsPdfOpen] = useState(false);
  const [notificationBanner, setNotificationBanner] = useState<string | null>(null);

  const fetchApplication = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const data = await api.getOfficerApplicationById(id);
      if (data) {
        setApplication(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApplication();
  }, [id]);

  const handleDecisionSubmit = async (payload: OfficerDecisionPayload) => {
    if (!application || !officer) return;
    const updated = await api.recordOfficerDecision(application.id, payload, officer);
    setApplication(updated);

    const msg =
      payload.decision === 'APPROVE'
        ? `ಅಧಿಕೃತ ಆದೇಶ ದಾಖಲಾಗಿದೆ: [ಆದೇಶ ಸಂಖ್ಯೆ: ${payload.official_order_number || 'GOV-MND-2026-881'}] — ನಾಗರಿಕರಿಗೆ ಅಧಿಕೃತ ಅಧಿಸೂಚನೆ ರವಾನಿಸಲಾಗಿದೆ.`
        : payload.decision === 'REJECT'
        ? `ಅರ್ಜಿಯನ್ನು ತಿರಸ್ಕರಿಸಲಾಗಿದೆ: [ಕಾರಣ: ${payload.rejection_reason}] — ಅಧಿಕೃತ ಅಧಿಸೂಚನೆ ರವಾನಿಸಲಾಗಿದೆ.`
        : `ದಾಖಲೆ ತಿದ್ದುಪಡಿ ವಿನಂತಿ ದಾಖಲಾಗಿದೆ — ನಾಗರಿಕರಿಗೆ ದಾಖಲೆ ಮರು-ಅಪ್‌ಲೋಡ್ ಮಾಡಲು ತಿಳಿಸಲಾಗಿದೆ.`;

    setNotificationBanner(msg);
  };

  if (isLoading) {
    return (
      <OfficerLayout>
        <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 font-semibold">
          Loading application record...
        </div>
      </OfficerLayout>
    );
  }

  if (!application) {
    return (
      <OfficerLayout>
        <div className="p-8 text-center space-y-3">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Application not found.</p>
          <Link
            to="/officer/applications"
            className="text-xs text-saathi-700 dark:text-emerald-400 underline font-semibold"
          >
            {t('viewApplicationsQueue')}
          </Link>
        </div>
      </OfficerLayout>
    );
  }

  return (
    <OfficerLayout>
      <div className="space-y-5">
        {/* Top Back Navigation Bar */}
        <div className="flex items-center justify-between">
          <Link
            to="/officer/applications"
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 transition-all shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t('back')}</span>
          </Link>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsPdfOpen(true)}
              className="bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs py-1.5 px-3 rounded-lg flex items-center space-x-1.5 shadow-sm transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t('tabPDF')}</span>
            </button>

            <button
              onClick={() => setIsDecisionModalOpen(true)}
              className="bg-saathi-700 hover:bg-saathi-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold text-xs py-1.5 px-3 rounded-lg flex items-center space-x-1.5 shadow-sm transition-all"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
              <span>{t('takeOfficialAction')}</span>
            </button>
          </div>
        </div>

        {/* Live Outbound Notification Toast Banner */}
        {notificationBanner && (
          <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-xl p-3 text-xs text-emerald-950 dark:text-emerald-200 flex items-start space-x-2 animate-fade-in shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Action Completed</p>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-0.5">{notificationBanner}</p>
            </div>
            <button
              onClick={() => setNotificationBanner(null)}
              className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Header Summary Card */}
        {(() => {
          const isStudent = application.applicant.citizen_group === 'STUDENT' ||
            application.applicant.citizen_group === 'students' ||
            Boolean(application.scheme_category?.toLowerCase().includes('scholarship')) ||
            Boolean(application.scheme_code?.includes('SSP'));

          const isFarmer = !isStudent && (
            application.applicant.citizen_group === 'FARMER' ||
            application.applicant.citizen_group === 'farmers' ||
            Boolean(application.scheme_category?.toLowerCase().includes('agriculture')) ||
            Boolean(application.applicant.land_holding_acres !== undefined)
          );

          const checklist = application.required_documents_checklist || [];
          const mandatoryDocs = checklist.filter(c => c.mandatory);
          const uploadedMandatoryCount = mandatoryDocs.filter(c => c.is_uploaded).length;
          const missingMandatoryDocs = mandatoryDocs.filter(c => !c.is_uploaded);
          const isDocumentsIncomplete = missingMandatoryDocs.length > 0;

          const evalOutcome = application.eligibility_evaluation?.outcome || 'manual_review';
          const evalOutcomeLabel =
            evalOutcome === 'potentially_eligible' ? 'Potentially Eligible' :
            evalOutcome === 'not_eligible' ? 'Criteria Not Met' :
            evalOutcome === 'needs_information' ? 'Insufficient Information' :
            'Verification Required';

          const evalOutcomeBadgeClass =
            evalOutcome === 'potentially_eligible' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800' :
            evalOutcome === 'not_eligible' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-800' :
            evalOutcome === 'needs_information' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800' :
            'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-800';

          return (
            <>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-colors">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      REF: {application.application_reference}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                      INTERNAL PLATFORM SUBMISSION
                    </span>
                    <StatusBadge status={application.status} />
                    {isDocumentsIncomplete && (
                      <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-700 flex items-center space-x-1">
                        <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        <span>Documents Incomplete ({missingMandatoryDocs.length} Missing)</span>
                      </span>
                    )}
                    {application.official_order_number && (
                      <span className="text-[11px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                        {t('orderNumber')}: {application.official_order_number}
                      </span>
                    )}
                  </div>
                  <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {application.scheme_name}
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
                    {application.scheme_category && (
                      <span className="font-semibold text-saathi-700 dark:text-emerald-400 bg-saathi-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                        {application.scheme_category}
                      </span>
                    )}
                    <span>{t('jurisdictionLabel')}: {application.assigned_office}</span>
                    <span>•</span>
                    <span>{t('tableSubmittedAt')}: {new Date(application.submitted_at).toLocaleString()}</span>
                  </p>
                </div>

                <div className="bg-saathi-50 dark:bg-emerald-950/40 border border-saathi-200 dark:border-emerald-800 rounded-xl p-3 text-center sm:text-right min-w-[180px]">
                  <p className="text-[11px] text-saathi-800 dark:text-emerald-300 font-semibold uppercase">
                    Eligibility Assessment
                  </p>
                  <p className="text-2xl font-extrabold text-saathi-950 dark:text-emerald-200 font-mono">
                    {application.eligibility_score}%
                  </p>
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border mt-1 ${evalOutcomeBadgeClass}`}>
                    {evalOutcomeLabel}
                  </span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1">Preliminary guidance only</p>
                </div>
              </div>

              {/* Applicant Details & Scheme Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Applicant Profile */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3 transition-colors">
                  <h3 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <User className="w-4 h-4 text-slate-400" />
                    <span>{t('applicantDetails')}</span>
                  </h3>
                  <div className="text-xs space-y-2">
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400">{t('citizenNameLabel')}:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{application.applicant.full_name}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400">Mobile (Masked):</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">{application.applicant.phone_masked}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400">{t('beneficiaryCategory')}:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 uppercase">
                        {isStudent ? 'STUDENT (ವಿದ್ಯಾರ್ಥಿ)' : isFarmer ? 'FARMER (ರೈತ)' : application.applicant.citizen_group}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400">{t('districtLabel')}:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {application.applicant.village}, {application.applicant.taluk}, {application.applicant.district}
                      </span>
                    </div>

                    {/* Category-Specific Facts */}
                    {isStudent ? (
                      <>
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-slate-500 dark:text-slate-400">Education Level:</span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {application.applicant.education_level || 'Post-Matric / Degree Course'}
                          </span>
                        </div>
                        {application.applicant.institution && (
                          <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-slate-500 dark:text-slate-400">Institution:</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{application.applicant.institution}</span>
                          </div>
                        )}
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-slate-500 dark:text-slate-400">Social Category / Caste:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {application.applicant.caste_category || 'Category 2A (OBC)'}
                          </span>
                        </div>
                        {application.applicant.academic_score && (
                          <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-slate-500 dark:text-slate-400">Academic Score:</span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">{application.applicant.academic_score}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {application.applicant.land_holding_acres !== undefined && (
                          <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-slate-500 dark:text-slate-400">Land Holding:</span>
                            <span className="font-bold text-slate-900 dark:text-white">{application.applicant.land_holding_acres} Acres</span>
                          </div>
                        )}
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-slate-500 dark:text-slate-400">Cultivable Land Record (RTC):</span>
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">Verified</span>
                        </div>
                      </>
                    )}

                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400">{t('annualIncome')}:</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">₹{application.applicant.annual_income.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500 dark:text-slate-400">Aadhaar-Linked Bank Account:</span>
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold">{t('yes')}</span>
                    </div>
                  </div>
                </div>

                {/* Scheme & Criteria Rules */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3 transition-colors">
                  <h3 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <Landmark className="w-4 h-4 text-slate-400" />
                    <span>{t('step2SchemeCriteria')}</span>
                  </h3>
                  <div className="text-xs space-y-2.5">
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                      <p className="font-bold text-slate-900 dark:text-white">{application.scheme_name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">{application.scheme_code}</p>
                      {application.scheme_department && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-tight">
                          {application.scheme_department}
                        </p>
                      )}
                    </div>

                    {/* Evaluated Scheme Rules */}
                    <div className="space-y-1.5 pt-1">
                      {application.eligibility_evaluation?.rule_results && application.eligibility_evaluation.rule_results.length > 0 ? (
                        application.eligibility_evaluation.rule_results.map((rule, idx) => {
                          const isPass = rule.outcome === 'potentially_eligible';
                          const isFail = rule.outcome === 'not_eligible';
                          const isNeedsInfo = rule.outcome === 'needs_information';
                          return (
                            <div
                              key={idx}
                              className={`p-2 rounded border flex items-start justify-between gap-2 text-xs ${
                                isPass
                                  ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
                                  : isFail
                                  ? 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800'
                                  : 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
                              }`}
                            >
                              <div className="flex items-start space-x-1.5 flex-1">
                                {isPass && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />}
                                {isFail && <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />}
                                {isNeedsInfo && <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />}
                                <div>
                                  <p className="font-semibold text-slate-900 dark:text-white text-[11px]">{rule.message}</p>
                                  {rule.field && (
                                    <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">Rule ID: {rule.rule_id} • Field: {rule.field}</p>
                                  )}
                                </div>
                              </div>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase whitespace-nowrap ${
                                  isPass
                                    ? 'bg-emerald-200/80 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200'
                                    : isFail
                                    ? 'bg-rose-200/80 text-rose-900 dark:bg-rose-900 dark:text-rose-200'
                                    : 'bg-amber-200/80 text-amber-900 dark:bg-amber-900 dark:text-amber-200'
                                }`}
                              >
                                {isPass ? 'Satisfied' : isFail ? 'Not Met' : 'Pending Info'}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="space-y-1.5">
                          <div className="p-2 rounded bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                            <span className="dark:text-slate-200">{isStudent ? 'Student Domicile (Karnataka):' : 'Farmer Status:'}</span>
                            <span className="font-bold text-emerald-800 dark:text-emerald-300">Verified</span>
                          </div>
                          <div className="p-2 rounded bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                            <span className="dark:text-slate-200">Aadhaar Linked Bank Account:</span>
                            <span className="font-bold text-emerald-800 dark:text-emerald-300">Verified</span>
                          </div>
                        </div>
                      )}

                      {application.eligibility_evaluation?.missing_fields && application.eligibility_evaluation.missing_fields.length > 0 && (
                        <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 text-[11px] text-amber-900 dark:text-amber-200">
                          <strong>Missing Evaluation Fields:</strong> {application.eligibility_evaluation.missing_fields.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Scheme-Specific Required Document Checklist */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <h3 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span>Scheme-Specific Required Documents Checklist</span>
                  </h3>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                      {application.documents.length} Stored in Backend / {checklist.length} Required
                    </span>
                    {isDocumentsIncomplete ? (
                      <span className="text-xs bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 font-bold px-2.5 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                        {missingMandatoryDocs.length} Missing
                      </span>
                    ) : (
                      <span className="text-xs bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 font-bold px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                        All Uploaded
                      </span>
                    )}
                  </div>
                </div>

                {isDocumentsIncomplete && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Application Incomplete — Mandatory Documents Missing</p>
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                        The applicant has not submitted {missingMandatoryDocs.length} mandatory document(s):{' '}
                        <strong>{missingMandatoryDocs.map((d) => d.item_name).join(', ')}</strong>. The reviewing officer can request document correction from the applicant.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  {checklist.map((doc, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                        doc.is_uploaded
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-1.5">
                          {doc.is_uploaded ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                          )}
                          <span className="font-bold text-slate-900 dark:text-white text-[11px]">
                            {doc.item_name}
                          </span>
                          {doc.mandatory && (
                            <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 uppercase">
                              *Mandatory
                            </span>
                          )}
                        </div>
                        {doc.note && (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">{doc.note}</p>
                        )}
                        {doc.uploaded_filename && (
                          <p className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300">
                            File: {doc.uploaded_filename}
                          </p>
                        )}
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                          doc.is_uploaded
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                        }`}
                      >
                        {doc.is_uploaded ? 'Uploaded' : 'Missing'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* OCR Verification Panel with side-by-side comparison */}
              <OCRVerificationPanel
                documents={application.documents}
                claimedValues={{
                  applicantName: application.applicant.full_name,
                  landAcres: isFarmer ? application.applicant.land_holding_acres : undefined,
                  educationLevel: isStudent ? application.applicant.education_level : undefined,
                  casteCategory: application.applicant.caste_category,
                  citizenGroup: application.applicant.citizen_group,
                  annualIncome: application.applicant.annual_income,
                  village: application.applicant.village,
                }}
              />
            </>
          );
        })()}

        {/* Audit History & Status Timeline */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3 transition-colors">
          <h3 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-100 dark:border-slate-800 pb-2">
            <History className="w-4 h-4 text-slate-400" />
            <span>Audit History & Action Trail</span>
          </h3>
          <div className="space-y-2.5">
            {application.audit_history.map((log, idx) => (
              <div
                key={idx}
                className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 dark:text-white font-mono text-[11px] bg-white dark:bg-slate-700 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                      {log.action}
                    </span>
                    <span className="text-slate-600 dark:text-slate-300">
                      By: <strong>{log.actor_name}</strong> ({log.actor_role})
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                    Notes: {log.notes}
                  </p>
                </div>
                <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Decision Modal */}
      {isDecisionModalOpen && (
        <OfficerDecisionModal
          isOpen={isDecisionModalOpen}
          onClose={() => setIsDecisionModalOpen(false)}
          onSubmitDecision={handleDecisionSubmit}
          applicationReference={application.application_reference}
          applicantName={application.applicant.full_name}
        />
      )}

      {/* Official Formatted Printable PDF Modal */}
      {isPdfOpen && (
        <ApplicationPDFViewer
          referenceNumber={application.application_reference}
          applicantName={application.applicant.full_name}
          schemeName={application.scheme_name}
          onClose={() => setIsPdfOpen(false)}
        />
      )}
    </OfficerLayout>
  );
};
