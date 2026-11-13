import React from 'react';
import { Scheme } from '../../types/api';
import { useLanguage } from '../../context/LanguageContext';
import { 
  CheckCircle2, 
  FileText, 
  ArrowRight, 
  Sparkles, 
  Landmark, 
  IndianRupee 
} from 'lucide-react';

interface SchemeCardProps {
  scheme: Scheme;
  onCheckEligibility: (scheme: Scheme) => void;
  onApply: (scheme: Scheme) => void;
}

export const SchemeCard: React.FC<SchemeCardProps> = ({
  scheme,
  onCheckEligibility,
  onApply,
}) => {
  const { language, t } = useLanguage();

  const name = scheme.name[language] || scheme.name.kn;
  const dept = scheme.department[language] || scheme.department.kn;
  const benefit = scheme.benefit_summary[language] || scheme.benefit_summary.kn;
  const desc = scheme.description[language] || scheme.description.kn;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-card hover:shadow-md transition-shadow overflow-hidden my-2 max-w-md w-full">
      {/* Category header */}
      <div className="bg-slate-50 border-b border-slate-100 px-3.5 py-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wider text-saathi-800 bg-saathi-100/80 px-2 py-0.5 rounded-full uppercase">
          {scheme.category}
        </span>
        <span className="text-[11px] text-slate-500 font-mono">
          {scheme.code}
        </span>
      </div>

      <div className="p-3.5 space-y-2.5">
        {/* Title & Department */}
        <div>
          <h3 className="font-bold text-slate-900 text-sm leading-snug">
            {name}
          </h3>
          <p className="text-[11px] text-slate-500 flex items-center space-x-1 mt-0.5">
            <Landmark className="w-3 h-3 text-slate-400" />
            <span>{dept}</span>
          </p>
        </div>

        {/* Benefit Highlight Box */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-lg p-2.5 flex items-start space-x-2">
          <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
            <IndianRupee className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
              {t('benefit')}:
            </p>
            <p className="text-xs font-semibold text-emerald-800">
              {scheme.benefit_amount || benefit}
            </p>
          </div>
        </div>

        {/* Short description */}
        <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
          {desc}
        </p>

        {/* Required Documents Pill List */}
        <div>
          <p className="text-[11px] font-semibold text-slate-500 mb-1 flex items-center space-x-1">
            <FileText className="w-3 h-3 text-slate-400" />
            <span>{t('requiredDocs')}:</span>
          </p>
          <div className="flex flex-wrap gap-1">
            {scheme.required_documents.map((doc) => (
              <span
                key={doc.requirement_id}
                className="text-[10px] bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded border border-slate-200/60"
              >
                {doc.name}
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="pt-1.5 flex items-center space-x-2">
          <button
            onClick={() => onCheckEligibility(scheme)}
            className="flex-1 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 text-xs font-semibold py-2 px-2.5 rounded-lg border border-slate-300 shadow-sm flex items-center justify-center space-x-1 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>{t('checkEligibility')}</span>
          </button>

          <button
            onClick={() => onApply(scheme)}
            className="flex-1 bg-whatsapp-teal hover:bg-whatsapp-darkTeal active:scale-95 text-white text-xs font-semibold py-2 px-2.5 rounded-lg shadow flex items-center justify-center space-x-1 transition-all"
          >
            <span>{t('applyNow')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
