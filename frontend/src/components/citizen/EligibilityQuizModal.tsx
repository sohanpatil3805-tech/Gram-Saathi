import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { api, ApiRequestError } from '../../services/api';
import type { DiscoveredScheme, EligibilityResult } from '../../types/api';

interface Props {
  scheme: DiscoveredScheme;
  isOpen: boolean;
  onClose: () => void;
  onEligibilityConfirmed: (result: EligibilityResult) => void;
}

export const EligibilityQuizModal: React.FC<Props> = ({
  scheme,
  isOpen,
  onClose,
  onEligibilityConfirmed,
}) => {
  const { t } = useLanguage();
  const [facts, setFacts] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<EligibilityResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const evaluate = async () => {
    setLoading(true);
    setError('');
    try {
      setResult(await api.checkEligibility({ scheme_id: scheme.scheme_id, applicant_facts: facts }));
    } catch (cause) {
      setError(cause instanceof ApiRequestError ? cause.message : t('eligibilityCheckFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60">
      <section className="bg-white rounded-2xl max-w-lg w-full shadow-modal p-4 space-y-4">
        <div className="flex justify-between">
          <div>
            <h2 className="font-bold text-slate-900">{t('preliminaryCheckTitle')}</h2>
            <p className="text-xs text-slate-500">{scheme.name}</p>
          </div>
          <button onClick={onClose} aria-label={t('close')}>
            <X className="w-5 h-5 text-slate-500 hover:text-slate-800" />
          </button>
        </div>
        {!result ? (
          <>
            <p className="text-xs text-slate-600">{t('factsWarning')}</p>
            <label className="block text-xs font-semibold text-slate-700">
              {t('applicantFactsLabel')}
              <textarea
                value={JSON.stringify(facts, null, 2)}
                onChange={(event) => {
                  try {
                    setFacts(JSON.parse(event.target.value || '{}'));
                    setError('');
                  } catch {
                    setError(t('invalidJsonError'));
                  }
                }}
                className="mt-1 w-full min-h-28 p-2 border rounded font-mono text-xs focus:ring-1 focus:ring-whatsapp-teal"
              />
            </label>
            {error && <p className="text-xs text-red-700">{error}</p>}
            <button
              disabled={loading || Boolean(error)}
              onClick={evaluate}
              className="w-full bg-whatsapp-teal text-white py-2 rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t('checkWithVerifiedRules')}
            </button>
          </>
        ) : (
          <>
            <div className="border rounded-lg p-3 bg-slate-50">
              <div className="flex gap-2 font-semibold text-slate-800">
                {result.outcome === 'potentially_eligible' ? (
                  <CheckCircle2 className="text-emerald-600" />
                ) : (
                  <AlertCircle className="text-amber-600" />
                )}
                <span>{result.outcome.replace(/_/g, ' ')}</span>
              </div>
              <p className="text-xs mt-2 text-slate-600">{result.disclaimer}</p>
            </div>
            {result.missing_fields.length > 0 && (
              <p className="text-xs text-amber-800">
                {t('moreInfoNeeded')}: {result.missing_fields.join(', ')}
              </p>
            )}
            <ul className="text-xs space-y-1 text-slate-700">
              {result.rule_results.map((rule) => (
                <li key={rule.rule_id} className="border-b border-slate-100 py-1">
                  {rule.message}
                </li>
              ))}
            </ul>
            <button
              onClick={() => {
                onEligibilityConfirmed(result);
                onClose();
              }}
              className="w-full bg-whatsapp-teal text-white py-2 rounded text-sm font-semibold hover:opacity-90"
            >
              {t('done')}
            </button>
          </>
        )}
      </section>
    </div>
  );
};
