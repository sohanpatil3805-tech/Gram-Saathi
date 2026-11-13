import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { OfficerLayout } from '../../components/officer/OfficerLayout';
import { StatusBadge } from '../../components/officer/StatusBadge';
import { OCRVerificationPanel } from '../../components/officer/OCRVerificationPanel';
import { OfficerDecisionModal } from '../../components/officer/OfficerDecisionModal';
import { ApplicationPDFViewer } from '../../components/officer/ApplicationPDFViewer';
import { ApplicationRecord, OfficerDecisionPayload } from '../../types/officer';
import { mockService } from '../../services/mockService';
import { useOfficerAuth } from '../../context/OfficerAuthContext';
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

  const [application, setApplication] = useState<ApplicationRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [isPdfOpen, setIsPdfOpen] = useState(false);
  const [notificationBanner, setNotificationBanner] = useState<string | null>(null);

  const fetchApplication = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const data = await mockService.getOfficerApplicationById(id);
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
    const updated = await mockService.recordOfficerDecision(application.id, payload, officer);
    setApplication(updated);

    const msg =
      payload.decision === 'APPROVE'
        ? `ಅರ್ಜಿ ಅನುಮೋದಿಸಲಾಗಿದೆ! ಅಧಿಕೃತ ಆದೇಶ ಸಂಖ್ಯೆ ${payload.official_order_number} ರಚಿಸಲಾಗಿದೆ ಮತ್ತು ವಾಟ್ಸಾಪ್ ಮೂಲಕ ಅರ್ಜಿದಾರರಿಗೆ ರವಾನಿಸಲಾಗಿದೆ.`
        : payload.decision === 'REJECT'
        ? `ಅರ್ಜಿ ತಿರಸ್ಕರಿಸಲಾಗಿದೆ. ಕಾರಣ: "${payload.rejection_reason}". ನಾಗರಿಕರಿಗೆ ವಾಟ್ಸಾಪ್ ಅಧಿಸೂಚನೆ ಕಳುಹಿಸಲಾಗಿದೆ.`
        : `ತಿದ್ದುಪಡಿ ವಿನಂತಿ ಕಳುಹಿಸಲಾಗಿದೆ. ದಾಖಲೆ ಮರು-ಅಪ್‌ಲೋಡ್ ಲಿಂಕ್ ನಾಗರಿಕರ ವಾಟ್ಸಾಪ್‌ಗೆ ತಲುಪಿದೆ.`;

    setNotificationBanner(msg);
  };

  if (isLoading) {
    return (
      <OfficerLayout>
        <div className="p-8 text-center text-xs text-slate-500 font-semibold">
          ಅರ್ಜಿ ವಿವರಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...
        </div>
      </OfficerLayout>
    );
  }

  if (!application) {
    return (
      <OfficerLayout>
        <div className="p-8 text-center space-y-3">
          <p className="text-sm font-bold text-slate-700">ಅರ್ಜಿ ಕಂಡುಬಂದಿಲ್ಲ (Application not found).</p>
          <Link
            to="/officer/applications"
            className="text-xs text-saathi-700 underline font-semibold"
          >
            ಅರ್ಜಿಗಳ ಪಟ್ಟಿಗೆ ಹಿಂತಿರುಗಿ
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
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-lg border border-slate-200 transition-all shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>ಅರ್ಜಿಗಳ ಪಟ್ಟಿಗೆ ಹಿಂತಿರುಗಿ</span>
          </Link>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsPdfOpen(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-1.5 px-3 rounded-lg flex items-center space-x-1.5 shadow-sm transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>ಅಧಿಕೃತ PDF ವೀಕ್ಷಿಸಿ</span>
            </button>

            <button
              onClick={() => setIsDecisionModalOpen(true)}
              className="bg-saathi-700 hover:bg-saathi-800 text-white font-bold text-xs py-1.5 px-3 rounded-lg flex items-center space-x-1.5 shadow-sm transition-all"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
              <span>ನಿರ್ಧಾರ ದಾಖಲಿಸಿ (Take Decision)</span>
            </button>
          </div>
        </div>

        {/* Live Outbound Notification Toast Banner */}
        {notificationBanner && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-xs text-emerald-950 flex items-start space-x-2 animate-fade-in shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">ಅಧಿಕೃತ ಕ್ರಮ ಯಶಸ್ವಿ!</p>
              <p className="text-[11px] text-emerald-800 mt-0.5">{notificationBanner}</p>
            </div>
            <button
              onClick={() => setNotificationBanner(null)}
              className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Header Summary Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                REF: {application.application_reference}
              </span>
              <StatusBadge status={application.status} />
              {application.official_order_number && (
                <span className="text-[11px] font-mono font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded">
                  ಆದೇಶ: {application.official_order_number}
                </span>
              )}
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              {application.scheme_name}
            </h1>
            <p className="text-xs text-slate-500 flex items-center space-x-2">
              <span>ನಿಯೋಜಿತ ಕಚೇರಿ: {application.assigned_office}</span>
              <span>•</span>
              <span>ಸಲ್ಲಿಕೆ: {new Date(application.submitted_at).toLocaleString()}</span>
            </p>
          </div>

          <div className="bg-saathi-50 border border-saathi-200 rounded-xl p-3 text-center sm:text-right">
            <p className="text-[11px] text-saathi-800 font-semibold uppercase">ಅರ್ಹತಾ ತಾಳೆ ಸ್ಕೋರ್</p>
            <p className="text-2xl font-extrabold text-saathi-950 font-mono">
              {application.eligibility_score}%
            </p>
            <p className="text-[10px] text-emerald-700 font-medium">ಅರ್ಹತಾ ನಿಯಮಗಳು ಹೊಂದಿಕೆಯಾಗಿವೆ</p>
          </div>
        </div>

        {/* Applicant Details & Scheme Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Applicant Profile */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
            <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-100 pb-2">
              <User className="w-4 h-4 text-slate-400" />
              <span>ಅರ್ಜಿದಾರರ ವಿವರಗಳು (Applicant Profile)</span>
            </h3>
            <div className="text-xs space-y-2">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">ಪೂರ್ಣ ಹೆಸರು:</span>
                <span className="font-bold text-slate-900">{application.applicant.full_name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">ಮೊಬೈಲ್ ಸಂಖ್ಯೆ (ಮರೆಮಾಚಲಾಗಿದೆ):</span>
                <span className="font-mono text-slate-800">{application.applicant.phone_masked}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">ವರ್ಗ (Category):</span>
                <span className="font-semibold text-slate-800">{application.applicant.citizen_group}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">ಸ್ಥಳ / ಗ್ರಾಮ:</span>
                <span className="font-semibold text-slate-800">
                  {application.applicant.village}, {application.applicant.taluk}, {application.applicant.district}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">ವಾರ್ಷಿಕ ಆದಾಯ:</span>
                <span className="font-mono text-slate-800">₹{application.applicant.annual_income.toLocaleString('en-IN')}</span>
              </div>
              {application.applicant.land_holding_acres !== undefined && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">ಕೃಷಿ ಭೂಮಿ:</span>
                  <span className="font-bold text-slate-900">{application.applicant.land_holding_acres} ಎಕರೆ</span>
                </div>
              )}
              <div className="flex justify-between py-1">
                <span className="text-slate-500">ಆಧಾರ್ ಸಕ್ರಿಯ ಬ್ಯಾಂಕ್ ಖಾತೆ:</span>
                <span className="text-emerald-700 font-bold">ಹೌದು (ಸಕ್ರಿಯ)</span>
              </div>
            </div>
          </div>

          {/* Scheme & Criteria Rules */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
            <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-100 pb-2">
              <Landmark className="w-4 h-4 text-slate-400" />
              <span>ಯೋಜನೆಯ ಮಾನದಂಡ & ನಿಯಮಗಳು (Eligibility Audit)</span>
            </h3>
            <div className="text-xs space-y-2">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <p className="font-bold text-slate-900">{application.scheme_name}</p>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">{application.scheme_code}</p>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="p-2 rounded bg-emerald-50/60 border border-emerald-200 flex items-center justify-between">
                  <span>ಕೃಷಿಕರ ವರ್ಗ ಪರಿಶೀಲನೆ:</span>
                  <span className="font-bold text-emerald-800">ಅರ್ಹ (FARMER)</span>
                </div>
                <div className="p-2 rounded bg-emerald-50/60 border border-emerald-200 flex items-center justify-between">
                  <span>ಭೂಮಿ ಮಿತಿ (&lt; 5 ಎಕರೆ):</span>
                  <span className="font-bold text-emerald-800">1.5 ಎಕರೆ (ಅರ್ಹ)</span>
                </div>
                <div className="p-2 rounded bg-emerald-50/60 border border-emerald-200 flex items-center justify-between">
                  <span>ಬ್ಯಾಂಕ್ ಖಾತೆ ಜೋಡಣೆ:</span>
                  <span className="font-bold text-emerald-800">ಆಧಾರ್ ಲಿಂಕ್ ದೃಢೀಕೃತ</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* OCR Verification Panel with side-by-side comparison */}
        <OCRVerificationPanel
          documents={application.documents}
          claimedValues={{
            applicantName: application.applicant.full_name,
            landAcres: application.applicant.land_holding_acres,
            annualIncome: application.applicant.annual_income,
            village: application.applicant.village,
          }}
        />

        {/* Audit History & Status Timeline */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
          <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-100 pb-2">
            <History className="w-4 h-4 text-slate-400" />
            <span>ಅರ್ಜಿಯ ಆಡಿಟ್ ಇತಿಹಾಸ (Audit & Action Trail)</span>
          </h3>
          <div className="space-y-2.5">
            {application.audit_history.map((log, idx) => (
              <div
                key={idx}
                className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-slate-200">
                      {log.action}
                    </span>
                    <span className="text-slate-600">
                      ನಡೆಸಿದವರು: <strong>{log.actor_name}</strong> ({log.actor_role})
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    ಟಿಪ್ಪಣಿ: {log.notes}
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
