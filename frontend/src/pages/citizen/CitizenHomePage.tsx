import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { api, getCitizenToken, getCitizenProfile } from '../../services/api';
import { CitizenProfile, BackendScheme } from '../../types/api';
import { 
  MessageSquare, 
  Search, 
  CheckCircle, 
  UploadCloud, 
  Clock, 
  Languages, 
  User, 
  ExternalLink, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  HelpCircle,
  LogIn,
  ChevronRight
} from 'lucide-react';

export const CitizenHomePage: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();

  const [citizen, setCitizen] = useState<CitizenProfile | null>(null);
  const [featuredSchemes, setFeaturedSchemes] = useState<BackendScheme[]>([]);
  const [loadingSchemes, setLoadingSchemes] = useState<boolean>(true);

  // Check login & load profile
  useEffect(() => {
    const token = getCitizenToken();
    if (token) {
      getCitizenProfile()
        .then((profile) => setCitizen(profile))
        .catch(() => {
          // Token may be invalid/expired
        });
    }
  }, []);

  // Fetch featured schemes
  useEffect(() => {
    api.getSchemes(undefined, 'Karnataka')
      .then((res) => {
        if (res && res.schemes) {
          setFeaturedSchemes(res.schemes.slice(0, 6));
        }
      })
      .catch(() => {
        // Fallback demo schemes
        setFeaturedSchemes([
          {
            scheme_id: 'PM-KISAN',
            name: {
              en: 'PM-KISAN Samman Nidhi',
              kn: 'ಪಿಎಂ-ಕಿಸಾನ್ ಸಮ್ಮಾನ್ ನಿಧಿ',
              hi: 'पीएम-किसान सम्मान निधि',
            },
            summary: {
              en: '₹6,000 per year direct income support in three equal installments',
              kn: 'ವರ್ಷಕ್ಕೆ ₹6,000 ನೇರ ಆದಾಯ ಬೆಂಬಲ',
              hi: 'वार्षिक ₹6,000 प्रत्यक्ष आय सहायता',
            },
            beneficiary_groups: ['farmers'],
            jurisdiction: 'central',
            applicable_states: ['Karnataka'],
            benefit: {
              description: '₹6,000 per year direct income support in three equal installments',
              amount_inr: 6000,
              frequency: 'annual',
            },
          },
          {
            scheme_id: 'PMFBY',
            name: {
              en: 'Pradhan Mantri Fasal Bima Yojana',
              kn: 'ಪ್ರಧಾನಮಂತ್ರಿ ಫಸಲ್ ಬಿಮಾ ಯೋಜನೆ',
              hi: 'प्रधानमंत्री फसल बीमा योजना',
            },
            summary: {
              en: 'Comprehensive crop insurance against natural calamities',
              kn: 'ಬೆಳೆ ನಷ್ಟಕ್ಕೆ ಸಮಗ್ರ ವಿಮಾ ರಕ್ಷಣೆ',
              hi: 'प्राकृतिक आपदाओं के खिलाफ व्यापक फसल बीमा',
            },
            beneficiary_groups: ['farmers'],
            jurisdiction: 'central',
            applicable_states: ['Karnataka'],
            benefit: {
              description: 'Comprehensive crop insurance against natural calamities',
            },
          },
          {
            scheme_id: 'NSP-POST-MATRIC',
            name: {
              en: 'Post-Matric Scholarship Scheme',
              kn: 'ಮೆಟ್ರಿಕ್ ನಂತರದ ವಿದ್ಯಾರ್ಥಿವೇತನ ಯೋಜನೆ',
              hi: 'पोस्ट-मैट्रिक छात्रवृत्ति योजना',
            },
            summary: {
              en: 'Financial assistance for tuition and maintenance fees',
              kn: 'ಬೋಧನಾ ಶುಲ್ಕ ಮತ್ತು ನಿರ್ವಹಣಾ ವೆಚ್ಚದ ನೆರವು',
              hi: 'ट्यूशन और रखरखाव शुल्क के लिए वित्तीय सहायता',
            },
            beneficiary_groups: ['students'],
            jurisdiction: 'central',
            applicable_states: ['Karnataka'],
            benefit: {
              description: 'Financial assistance for tuition and maintenance fees',
            },
          },
        ]);
      })
      .finally(() => setLoadingSchemes(false));
  }, []);

  const handleQuickAction = (tab: string) => {
    // Navigate to citizen chatbot page with active tab in state
    navigate('/chat', { state: { activeTab: tab } });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Top Government Strip */}
      <div className="bg-slate-900 text-slate-200 px-3 py-1.5 text-xs flex items-center justify-between">
        <div className="flex items-center space-x-1.5 font-medium tracking-wide">
          <span className="w-2 h-2 rounded-full bg-gov-saffron inline-block"></span>
          <span>{t('governmentOfIndia')}</span>
        </div>
        <div className="flex items-center space-x-3 text-[11px]">
          <Link 
            to="/help" 
            className="hover:text-emerald-300 transition-colors flex items-center space-x-1"
          >
            <HelpCircle className="w-3 h-3" />
            <span>{t('helpTitle')}</span>
          </Link>
          <span className="text-slate-600">|</span>
          <Link 
            to="/officer/dashboard" 
            className="text-amber-300 hover:text-amber-200 underline font-medium flex items-center space-x-1"
          >
            <span>{t('officerPortalLink')}</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Main Header */}
      <header className="sticky top-0 z-30 bg-whatsapp-teal text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-full bg-white/10 p-0.5 border border-white/20 flex items-center justify-center shadow-inner">
              <img src="/logo.svg" alt="Gram Saathi Logo" className="w-8 h-8 rounded-full" />
            </div>
            <div>
              <h1 className="font-bold text-base sm:text-lg leading-tight tracking-tight">
                {t('appName')}
              </h1>
              <p className="text-[11px] text-emerald-100 flex items-center space-x-1">
                <ShieldCheck className="w-3 h-3 text-emerald-300 inline" />
                <span>{t('officialPortal')}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Language Switcher */}
            <div className="flex items-center bg-white/15 p-0.5 rounded-lg border border-white/20 text-xs">
              <Languages className="w-3.5 h-3.5 text-amber-300 ml-1.5 mr-1" />
              {(['en', 'kn', 'hi'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`px-2 py-1 rounded-md font-semibold text-xs transition-all ${
                    language === lang
                      ? 'bg-white text-emerald-800 shadow-sm'
                      : 'text-white hover:bg-white/20'
                  }`}
                  title={`Switch to ${lang === 'en' ? 'English' : lang === 'kn' ? 'ಕನ್ನಡ' : 'हिंदी'}`}
                >
                  {lang === 'en' ? 'EN' : lang === 'kn' ? 'ಕನ್ನಡ' : 'हिंदी'}
                </button>
              ))}
            </div>

            {/* Login / Profile button */}
            {citizen ? (
              <Link
                to="/profile"
                className="flex items-center space-x-1.5 bg-white/15 hover:bg-white/25 px-2.5 py-1.5 rounded-lg border border-white/20 text-xs text-white transition-all shadow-sm"
              >
                <User className="w-3.5 h-3.5 text-amber-300" />
                <span className="font-semibold hidden sm:inline truncate max-w-[100px]">
                  {citizen.name || citizen.phone_number}
                </span>
                <span className="font-semibold sm:hidden">{t('navProfile')}</span>
              </Link>
            ) : (
              <Link
                to="/login"
                className="flex items-center space-x-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg shadow-sm transition-all active:scale-95"
              >
                <LogIn className="w-3.5 h-3.5 text-slate-900" />
                <span>{t('navLogin')}</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 space-y-6">
        {/* Hero Section */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-800 via-whatsapp-teal to-teal-900 text-white rounded-3xl p-6 sm:p-8 shadow-md">
          {/* Decorative shapes */}
          <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -mb-6 -ml-6 w-40 h-40 rounded-full bg-emerald-400/10 blur-2xl pointer-events-none"></div>

          <div className="relative z-10 max-w-2xl space-y-3">
            {citizen && (
              <div className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-emerald-100 border border-white/20">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>{t('homeWelcomeBack')}, {citizen.name || citizen.phone_number}!</span>
              </div>
            )}

            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              {t('homeHeroTitle')}
            </h2>
            <p className="text-sm sm:text-base font-medium text-emerald-100">
              {t('homeHeroSubtitle')}
            </p>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-w-xl">
              {t('homeHeroTagline')}
            </p>

            <div className="pt-2 flex flex-wrap gap-2.5">
              <button
                onClick={() => handleQuickAction('chat')}
                className="bg-gov-saffron hover:bg-amber-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-md text-xs sm:text-sm flex items-center space-x-2 transition-all active:scale-95"
              >
                <MessageSquare className="w-4 h-4" />
                <span>{t('homeActionChat')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => handleQuickAction('eligibility')}
                className="bg-white/15 hover:bg-white/25 text-white font-semibold px-4 py-2.5 rounded-xl border border-white/20 text-xs sm:text-sm flex items-center space-x-2 transition-all"
              >
                <CheckCircle className="w-4 h-4 text-emerald-300" />
                <span>{t('homeActionEligibility')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
              <span>{t('homeQuickActions')}</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Action 1: AI Chat */}
            <button
              onClick={() => handleQuickAction('chat')}
              className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-whatsapp-teal hover:shadow-md transition-all text-left flex items-start space-x-3 group"
            >
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-whatsapp-teal flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm text-slate-900 group-hover:text-whatsapp-teal transition-colors">
                  {t('homeActionChat')}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                  {t('homeActionChatDesc')}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-whatsapp-teal transition-colors flex-shrink-0 mt-1" />
            </button>

            {/* Action 2: Find Schemes */}
            <button
              onClick={() => handleQuickAction('chat')}
              className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-whatsapp-teal hover:shadow-md transition-all text-left flex items-start space-x-3 group"
            >
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <Search className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors">
                  {t('homeActionSchemes')}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                  {t('homeActionSchemesDesc')}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors flex-shrink-0 mt-1" />
            </button>

            {/* Action 3: Check Eligibility */}
            <button
              onClick={() => handleQuickAction('eligibility')}
              className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-whatsapp-teal hover:shadow-md transition-all text-left flex items-start space-x-3 group"
            >
              <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm text-slate-900 group-hover:text-purple-600 transition-colors">
                  {t('homeActionEligibility')}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                  {t('homeActionEligibilityDesc')}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-colors flex-shrink-0 mt-1" />
            </button>

            {/* Action 4: Upload Documents */}
            <button
              onClick={() => handleQuickAction('documents')}
              className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-whatsapp-teal hover:shadow-md transition-all text-left flex items-start space-x-3 group"
            >
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm text-slate-900 group-hover:text-amber-600 transition-colors">
                  {t('homeActionDocuments')}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                  {t('homeActionDocumentsDesc')}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors flex-shrink-0 mt-1" />
            </button>

            {/* Action 5: Track Application */}
            <button
              onClick={() => handleQuickAction('track')}
              className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-whatsapp-teal hover:shadow-md transition-all text-left flex items-start space-x-3 group sm:col-span-2 lg:col-span-2"
            >
              <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <Clock className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm text-slate-900 group-hover:text-teal-600 transition-colors">
                  {t('homeActionTrack')}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                  {t('homeActionTrackDesc')}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 transition-colors flex-shrink-0 mt-1" />
            </button>
          </div>
        </section>

        {/* Featured Schemes */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>{t('homeFeaturedSchemes')}</span>
            </h3>
            <button
              onClick={() => handleQuickAction('chat')}
              className="text-xs font-semibold text-whatsapp-teal hover:underline flex items-center space-x-1"
            >
              <span>{t('homeViewAllSchemes')}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {loadingSchemes ? (
            <div className="p-8 text-center text-xs text-slate-400">
              {t('loading')}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {featuredSchemes.map((scheme) => {
                const name = scheme.name?.[language] || scheme.name?.en || scheme.scheme_id;
                const summary = typeof scheme.summary === 'string'
                  ? scheme.summary
                  : scheme.summary?.[language] || scheme.summary?.en || '';
                const benefit = scheme.benefit?.description || summary;
                const group = scheme.beneficiary_groups?.[0] || 'Welfare';

                return (
                  <div
                    key={scheme.scheme_id}
                    className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {group}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {scheme.scheme_id}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 leading-snug line-clamp-2">
                        {name}
                      </h4>
                      {summary && (
                        <p className="text-[11px] text-slate-500 line-clamp-2">
                          {summary}
                        </p>
                      )}
                      {benefit && (
                        <div className="mt-2 p-2 bg-emerald-50 rounded-lg border border-emerald-100 text-[11px] text-emerald-900 leading-relaxed">
                          <span className="font-semibold">{t('benefitLabel')}:</span> {benefit}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <button
                        onClick={() => handleQuickAction('eligibility')}
                        className="text-xs font-bold text-whatsapp-teal hover:text-whatsapp-darkTeal flex items-center space-x-1"
                      >
                        <span>{t('checkEligibility')}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-8">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-2">
          <div className="flex items-center justify-center space-x-4 text-xs text-slate-500">
            <Link to="/home" className="hover:text-whatsapp-teal font-medium">{t('navHome')}</Link>
            <span>•</span>
            <Link to="/help" className="hover:text-whatsapp-teal font-medium">{t('helpTitle')}</Link>
            <span>•</span>
            <Link to="/officer/dashboard" className="hover:text-whatsapp-teal font-medium">{t('officerPortalLink')}</Link>
          </div>
          <p className="text-[11px] text-slate-400">
            {t('appName')} • {t('governmentOfIndia')}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default CitizenHomePage;
