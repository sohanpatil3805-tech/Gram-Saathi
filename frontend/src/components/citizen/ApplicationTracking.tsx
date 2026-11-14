import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../services/api';
import { ApplicationRecord } from '../../types/officer';
import { StatusBadge } from '../officer/StatusBadge';
import { 
  Search, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  FileText, 
  Building2, 
  ShieldCheck, 
  Calendar, 
  Layers, 
  ArrowRight,
  User,
  Check,
  XCircle,
  AlertTriangle
} from 'lucide-react';

interface ApplicationTrackingProps {
  initialReference?: string;
}

export const ApplicationTracking: React.FC<ApplicationTrackingProps> = ({ initialReference = '' }) => {
  const { t, language } = useLanguage();
  const [referenceQuery, setReferenceQuery] = useState(initialReference);
  const [isSearching, setIsSearching] = useState(false);
  const [trackedApp, setTrackedApp] = useState<ApplicationRecord | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [submittedApps, setSubmittedApps] = useState<any[]>([]);

  useEffect(() => {
    // Load citizen's live submitted applications from backend
    api.getCitizenApplications()
      .then((apps) => {
        if (Array.isArray(apps)) {
          setSubmittedApps(apps);
        }
      })
      .catch(() => {});
  }, []);

  const lookupApplication = async (ref: string) => {
    if (!ref.trim()) return;
    setIsSearching(true);
    setSearchError(null);
    setTrackedApp(null);

    const trimmed = ref.trim();
    try {
      // 1. Try direct lookup by ID
      const app = await api.getOfficerApplicationById(trimmed);
      if (app) {
        setTrackedApp(app);
        setIsSearching(false);
        return;
      }
    } catch {
      // Continue to list search
    }

    try {
      // 2. Try lookup across citizen applications
      const apps = await api.getCitizenApplications();
      const match = apps.find(
        (a: any) =>
          String(a.id) === trimmed ||
          (a.submission_reference && a.submission_reference.toLowerCase() === trimmed.toLowerCase())
      );
      if (match) {
        const full = await api.getOfficerApplicationById(String(match.id));
        setTrackedApp(full);
        setIsSearching(false);
        return;
      }
    } catch {
      // Continue
    }

    setSearchError(`ಯಾವುದೇ ಅರ್ಜಿ ಕಂಡುಬಂದಿಲ್ಲ / No application found for reference: "${trimmed}"`);
    setIsSearching(false);
  };

  useEffect(() => {
    if (initialReference) {
      setReferenceQuery(initialReference);
      lookupApplication(initialReference);
    }
  }, [initialReference]);

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    lookupApplication(referenceQuery);
  };

  const officialTrackingLinks = [
    {
      scheme: 'PM-KISAN Samman Nidhi',
      url: 'https://pmkisan.gov.in/BeneficiaryStatus_New.aspx',
      desc: 'Know your PM-KISAN status, e-KYC status and instalment details directly from the Department of Agriculture.',
    },
    {
      scheme: 'Karnataka State Scholarship Portal (SSP)',
      url: 'https://ssp.postmatric.karnataka.gov.in/',
      desc: 'Track SSP Student Application and scholarship sanction status using your SSP Student ID.',
    },
    {
      scheme: 'National Scholarship Portal (NSP)',
      url: 'https://scholarships.gov.in/All-Scholarships',
      desc: 'Track Central Sector and State scholarship application status with One-Time Registration (OTR).',
    },
    {
      scheme: 'Pradhan Mantri Fasal Bima Yojana (PMFBY)',
      url: 'https://pmfby.gov.in/',
      desc: 'Check crop insurance application and claim status with your Application / Policy number.',
    },
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Title */}
      <div className="border-b border-slate-200 pb-3">
        <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
          <Clock className="w-5 h-5 text-saathi-700" />
          <span>{t('trackingTitle')}</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {t('trackingSubtitle')}
        </p>
      </div>

      {/* Reference Lookup Form */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <form onSubmit={handleTrackSubmit} className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={referenceQuery}
              onChange={(e) => setReferenceQuery(e.target.value)}
              placeholder={t('enterRefPlaceholder')}
              className="w-full text-xs sm:text-sm pl-9 pr-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-saathi-500/30 font-mono"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>
          <button
            type="submit"
            disabled={isSearching || !referenceQuery.trim()}
            className="bg-saathi-800 hover:bg-saathi-900 disabled:bg-slate-300 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition-all"
          >
            {isSearching ? t('loading') : t('trackButton')}
          </button>
        </form>

        {searchError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-start space-x-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">{searchError}</p>
          </div>
        )}
      </div>

      {/* Tracked Application Card (Live Result) */}
      {trackedApp && (
        <div className="bg-white border-2 border-slate-900 rounded-2xl p-5 shadow-md space-y-4 animate-fade-in">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono font-bold text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  {trackedApp.application_reference}
                </span>
                <StatusBadge status={trackedApp.status} size="sm" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 mt-1">
                {trackedApp.scheme_name}
              </h3>
            </div>

            {trackedApp.official_order_number && (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-950 px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5 shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>ಆದೇಶ ಸಂಖ್ಯೆ: {trackedApp.official_order_number}</span>
              </div>
            )}
          </div>

          {/* Citizen & Location Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <p className="text-slate-500 font-semibold text-[11px] uppercase">ಅರ್ಜಿದಾರರು / Applicant:</p>
              <p className="font-bold text-slate-900 text-sm mt-0.5">{trackedApp.applicant.full_name}</p>
              <p className="text-slate-600 font-mono text-[11px]">{trackedApp.applicant.phone_masked}</p>
            </div>
            <div>
              <p className="text-slate-500 font-semibold text-[11px] uppercase">ಸ್ಥಳ / Jurisdiction:</p>
              <p className="font-bold text-slate-900 mt-0.5">{trackedApp.applicant.village}, {trackedApp.applicant.district}</p>
              <p className="text-slate-500 text-[11px]">ಸಲ್ಲಿಸಿದ ದಿನಾಂಕ: {new Date(trackedApp.submitted_at).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Remarks Banner if Returned for Correction or Rejected */}
          {trackedApp.remarks && (
            <div className={`p-3.5 rounded-xl text-xs border flex items-start space-x-2 ${
              String(trackedApp.status).includes('REJECT')
                ? 'bg-red-50 border-red-300 text-red-950'
                : 'bg-amber-50 border-amber-300 text-amber-950'
            }`}>
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">ಅಧಿಕಾರಿಯ ಟಿಪ್ಪಣಿ / Officer Decision Remarks:</p>
                <p className="mt-0.5 leading-relaxed">{trackedApp.remarks}</p>
              </div>
            </div>
          )}

          {/* Verification Timeline */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>ಅರ್ಜಿ ಪರಿಶೀಲನಾ ಹಂತಗಳು / Verification Timeline</span>
            </h4>
            <div className="space-y-2">
              {(trackedApp.audit_history || []).map((step, idx) => (
                <div key={idx} className="flex items-start space-x-3 text-xs p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
                    ✓
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900">{step.action}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px] mt-0.5">{step.notes}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Citizen's Recent Applications Queue */}
      {submittedApps.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
          <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-100 pb-2">
            <FileText className="w-4 h-4 text-saathi-700" />
            <span>ನನ್ನ ಸಲ್ಲಿಸಲಾದ ಅರ್ಜಿಗಳು / My Applications ({submittedApps.length})</span>
          </h3>

          <div className="space-y-2.5">
            {submittedApps.map((app) => (
              <div
                key={app.id}
                className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:border-saathi-400 transition-all"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-slate-900">
                      {app.submission_reference || app.id?.slice(0, 8)}
                    </span>
                    <StatusBadge status={app.current_status || app.status} size="sm" />
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                    {app.scheme_id} • {new Date(app.created_at || Date.now()).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReferenceQuery(app.submission_reference || String(app.id));
                    lookupApplication(app.submission_reference || String(app.id));
                  }}
                  className="bg-saathi-700 hover:bg-saathi-800 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center justify-center space-x-1 shadow-xs transition-all"
                >
                  <span>{t('trackButton')}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Official Government Tracking Portals */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-100 pb-2">
          <Building2 className="w-4 h-4 text-saathi-700" />
          <span>{t('officialTrackingLinksTitle')}</span>
        </h3>

        <div className="grid grid-cols-1 gap-2.5">
          {officialTrackingLinks.map((link) => (
            <a
              key={link.scheme}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-xl border border-slate-200 hover:border-saathi-600 hover:bg-slate-50 transition-all flex items-start justify-between group"
            >
              <div className="space-y-0.5">
                <p className="font-bold text-xs text-slate-900 group-hover:text-saathi-800 flex items-center space-x-1">
                  <span>{link.scheme}</span>
                  <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-saathi-700" />
                </p>
                <p className="text-[11px] text-slate-500 leading-snug">
                  {link.desc}
                </p>
              </div>
              <span className="text-[10px] font-bold text-saathi-700 bg-saathi-50 px-2 py-1 rounded ml-2 flex-shrink-0">
                Open Official Portal
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};
