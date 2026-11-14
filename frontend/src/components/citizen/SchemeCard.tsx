import React from 'react';
import { ExternalLink, FileText, ShieldCheck, Tag, Building2, CheckCircle2, Clock } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import type { DiscoveredScheme } from '../../types/api';

interface SchemeCardProps {
  scheme: DiscoveredScheme;
  onCheckEligibility: (scheme: DiscoveredScheme) => void;
  onApply: (scheme: DiscoveredScheme) => void;
}

export const SchemeCard: React.FC<SchemeCardProps> = ({ scheme, onCheckEligibility, onApply }) => {
  const { t, language } = useLanguage();

  const getDocName = (doc: Record<string, unknown>) => {
    if (doc.name && typeof doc.name === 'object') {
      const localized = (doc.name as Record<string, string>)[language] || (doc.name as Record<string, string>).en;
      if (localized) return localized;
    }
    return String(doc.item || doc.name || doc.document_type_code || doc.document_type || t('documentDefault'));
  };

  const getBenefit = (benefit: Record<string, unknown>) => {
    if (benefit.description && typeof benefit.description === 'object') {
      const localized = (benefit.description as Record<string, string>)[language] || (benefit.description as Record<string, string>).en;
      if (localized) return localized;
    }
    return typeof benefit.description === 'string'
      ? benefit.description
      : t('benefitDetailsOfficial');
  };

  const getStatusBadge = () => {
    const status = (scheme.operational_status || 'ACTIVE').toUpperCase();
    if (status === 'APPLICATIONS OPEN') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-2.5 h-2.5" />
          {language === 'kn' ? 'ಅರ್ಜಿಗಳು ಲಭ್ಯ' : language === 'hi' ? 'आवेदन खुले हैं' : 'Applications Open'}
        </span>
      );
    }
    if (status === 'SEASONAL') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
          <Clock className="w-2.5 h-2.5" />
          {language === 'kn' ? 'ಹಂಗಾಮು ಆಧಾರಿತ' : language === 'hi' ? 'मौसमी चक्र' : 'Seasonal Window'}
        </span>
      );
    }
    if (status === 'APPLICATIONS CLOSED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          <Clock className="w-2.5 h-2.5" />
          {language === 'kn' ? 'ಅರ್ಜಿ ಮುಕ್ತಾಯ' : language === 'hi' ? 'आवेदन बंद' : 'Applications Closed'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
        <CheckCircle2 className="w-2.5 h-2.5" />
        {language === 'kn' ? 'ಸಕ್ರಿಯ ಯೋಜನೆ' : language === 'hi' ? 'सक्रिय योजना' : 'Active Scheme'}
      </span>
    );
  };

  const getJurisdictionLabel = () => {
    const jur = (scheme.jurisdiction || '').toLowerCase();
    if (jur === 'district') {
      return language === 'kn' ? 'ಜಿಲ್ಲಾ ಯೋಜನೆ (ಮಂಡ್ಯ)' : language === 'hi' ? 'जिला योजना (मंड्या)' : 'District Scheme (Mandya)';
    }
    if (jur === 'state') {
      return language === 'kn' ? 'ಕರ್ನಾಟಕ ರಾಜ್ಯ ಯೋಜನೆ' : language === 'hi' ? 'कर्नाटक राज्य योजना' : 'Karnataka State Scheme';
    }
    return language === 'kn' ? 'ಕೇಂದ್ರ ಸರ್ಕಾರಿ ಯೋಜನೆ' : language === 'hi' ? 'केंद्र सरकार योजना' : 'Central Scheme';
  };

  const officialUrl = scheme.official_application_url || scheme.official_url || (scheme.official_urls && scheme.official_urls[0]);

  return (
    <article className="bg-white rounded-xl border border-slate-200 shadow-card my-2.5 max-w-md w-full overflow-hidden hover:border-whatsapp-teal/40 transition-all">
      <div className="p-4 space-y-3">
        {/* Header badges and ID */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {getStatusBadge()}
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
              {getJurisdictionLabel()}
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
            {scheme.scheme_id}
          </span>
        </div>

        {/* Title and Category */}
        <div>
          <h3 className="font-bold text-slate-900 text-sm leading-snug">{scheme.name}</h3>
          {scheme.category && (
            <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
              <Tag className="w-3 h-3 text-emerald-600 shrink-0" />
              <span>{scheme.category}</span>
            </div>
          )}
          {scheme.department && (
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5 line-clamp-1">
              <Building2 className="w-2.5 h-2.5 shrink-0" />
              <span>{scheme.department}</span>
            </div>
          )}
        </div>

        {/* Summary */}
        <p className="text-xs text-slate-600 leading-relaxed">{scheme.summary}</p>

        {/* Benefit Box */}
        <div className="bg-emerald-50/80 border border-emerald-100/90 rounded-lg p-2.5 text-xs text-emerald-900">
          <span className="font-semibold">{t('benefit') || 'Benefit'}: </span>
          {getBenefit(scheme.benefit)}
        </div>

        {/* Required Documents */}
        <div>
          <p className="text-[11px] font-semibold text-slate-700 flex items-center gap-1 mb-0.5">
            <FileText className="w-3 h-3 text-slate-500" /> {t('requiredDocuments')}
          </p>
          <p className="text-[11px] text-slate-600 leading-normal">
            {scheme.required_documents.length
              ? scheme.required_documents.map(getDocName).join(', ')
              : t('notListedByBackend')}
          </p>
        </div>

        {/* Official Link */}
        {officialUrl && (
          <div className="pt-0.5">
            <a
              className="text-xs text-blue-700 hover:text-blue-900 font-medium underline inline-flex items-center gap-1"
              href={officialUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="w-3 h-3" />
              {scheme.official_application_url ? (language === 'kn' ? 'ಅಧಿಕೃತ ಅರ್ಜಿ ಪೋರ್ಟಲ್' : language === 'hi' ? 'आधिकारिक आवेदन पोर्टल' : 'Official Application Portal') : t('officialSource')}
            </a>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onCheckEligibility(scheme)}
            className="flex-1 border border-slate-300 text-slate-700 text-xs font-semibold py-2 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {t('checkEligibility')}
          </button>
          <button
            onClick={() => onApply(scheme)}
            className="flex-1 bg-whatsapp-teal text-white text-xs font-semibold py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            {t('prepareNextSteps')}
          </button>
        </div>

        {/* Disclaimer */}
        <p className="text-[10px] text-slate-400 flex items-start gap-1 pt-0.5">
          <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
          <span>{t('candidateDisclaimer')}</span>
        </p>
      </div>
    </article>
  );
};
