import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { 
  ArrowLeft, 
  HelpCircle, 
  PhoneCall, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Languages, 
  MessageSquare,
  ShieldCheck,
  FileQuestion,
  ExternalLink
} from 'lucide-react';

export const HelpSupportPage: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  const [openFaq, setOpenFaq] = useState<number | null>(0); // First open by default

  const faqs = [
    {
      q: t('helpFaq1Q'),
      a: t('helpFaq1A'),
    },
    {
      q: t('helpFaq2Q'),
      a: t('helpFaq2A'),
    },
    {
      q: t('helpFaq3Q'),
      a: t('helpFaq3A'),
    },
    {
      q: t('helpFaq4Q'),
      a: t('helpFaq4A'),
    },
  ];

  const toggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Header */}
      <header className="bg-whatsapp-teal text-white shadow-md">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link
              to="/home"
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              title={t('back')}
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </Link>
            <h1 className="font-bold text-base sm:text-lg">{t('helpTitle')}</h1>
          </div>

          {/* Language Switcher */}
          <div className="flex items-center bg-white/15 p-0.5 rounded-lg border border-white/20 text-xs">
            <Languages className="w-3.5 h-3.5 text-amber-300 ml-1.5 mr-1" />
            {(['en', 'kn', 'hi'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`px-2 py-0.5 rounded font-semibold text-xs transition-all ${
                  language === lang
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-white hover:bg-white/20'
                }`}
              >
                {lang === 'en' ? 'EN' : lang === 'kn' ? 'ಕನ್ನಡ' : 'हिंदी'}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Hackathon Disclaimer Banner */}
        <div className="bg-amber-50 border border-amber-300/80 rounded-2xl p-4 flex items-start space-x-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 space-y-1">
            <p className="font-bold text-amber-950">
              {t('demoModeBadge')}
            </p>
            <p className="leading-relaxed">
              {t('helpDemoNotice')}
            </p>
          </div>
        </div>

        {/* FAQs */}
        <section className="space-y-3">
          <div className="flex items-center space-x-2">
            <FileQuestion className="w-5 h-5 text-whatsapp-teal" />
            <h2 className="text-base font-bold text-slate-800">{t('helpSubtitle')}</h2>
          </div>

          <div className="space-y-2.5">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs transition-all"
                >
                  <button
                    onClick={() => toggleFaq(idx)}
                    className="w-full p-4 text-left flex items-center justify-between space-x-3 hover:bg-slate-50 transition-colors"
                  >
                    <span className="font-bold text-xs sm:text-sm text-slate-800 leading-snug">
                      {faq.q}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/50 animate-fade-in">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Contact & Support Section */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2">
            <PhoneCall className="w-5 h-5 text-whatsapp-teal" />
            <h2 className="text-base font-bold text-slate-800">{t('helpContactTitle')}</h2>
          </div>

          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs text-emerald-800 font-semibold">{t('helpHelplineLabel')}</p>
              <p className="font-mono text-base font-bold text-emerald-950">{t('helpHelpline')}</p>
            </div>
            <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded font-bold uppercase">
              Demo
            </span>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <Link
              to="/"
              className="flex-1 py-2.5 px-4 bg-whatsapp-teal hover:bg-whatsapp-darkTeal text-white font-bold text-xs rounded-xl shadow-sm text-center flex items-center justify-center space-x-2 transition-all active:scale-95"
            >
              <MessageSquare className="w-4 h-4" />
              <span>{t('homeActionChat')}</span>
            </Link>

            <Link
              to="/home"
              className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl text-center transition-all"
            >
              {t('helpBackBtn')}
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-slate-400">
        <p>{t('appName')} • {t('governmentOfIndia')}</p>
      </footer>
    </div>
  );
};

export default HelpSupportPage;
