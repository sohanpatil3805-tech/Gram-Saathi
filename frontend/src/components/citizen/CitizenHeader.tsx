import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { 
  Languages, 
  Download, 
  ShieldCheck, 
  RotateCcw,
  ExternalLink,
  UserCheck,
  UploadCloud,
  Home,
  HelpCircle,
  LogIn,
  User
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCitizenToken } from '../../services/api';

interface CitizenHeaderProps {
  onResetChat: () => void;
  citizenName?: string;
  onOpenDocuments?: () => void;
}

export const CitizenHeader: React.FC<CitizenHeaderProps> = ({
  onResetChat,
  citizenName = 'Ramu Nayak',
  onOpenDocuments,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(Boolean(getCitizenToken()));
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-whatsapp-teal text-white shadow-md border-b border-whatsapp-darkTeal">
      {/* Top Government Strip */}
      <div className="bg-slate-900/60 text-slate-200 px-3 py-1 text-[11px] flex items-center justify-between">
        <div className="flex items-center space-x-1.5 font-medium tracking-wide">
          <span className="w-2 h-2 rounded-full bg-gov-saffron inline-block"></span>
          <span>{t('governmentOfIndia')}</span>
        </div>
        <div className="flex items-center space-x-3">
          <Link
            to="/home"
            className="hover:text-emerald-300 transition-colors flex items-center space-x-1"
          >
            <Home className="w-3 h-3" />
            <span className="hidden xs:inline">{t('navHome')}</span>
          </Link>
          <span className="text-slate-600">|</span>
          <Link
            to="/help"
            className="hover:text-emerald-300 transition-colors flex items-center space-x-1"
          >
            <HelpCircle className="w-3 h-3" />
            <span className="hidden xs:inline">{t('navHelp')}</span>
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

      {/* Main Header Bar */}
      <div className="px-3 py-2.5 flex items-center justify-between max-w-4xl mx-auto">
        {/* Brand & Emblem */}
        <div className="flex items-center space-x-2.5">
          <Link to="/home" className="flex items-center space-x-2.5 group">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-white/10 p-0.5 border border-white/20 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
                <img src="/logo.svg" alt="Gram Saathi Logo" className="w-8 h-8 rounded-full" />
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-whatsapp-green rounded-full border-2 border-whatsapp-teal"></span>
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h1 className="font-bold text-base leading-tight tracking-tight">
                  {t('appName')}
                </h1>
                <span className="text-[10px] bg-white/20 text-white font-medium px-1.5 py-0.5 rounded-full">
                  PWA
                </span>
              </div>
              <p className="text-[11px] text-emerald-100 flex items-center space-x-1">
                <ShieldCheck className="w-3 h-3 text-emerald-300 inline" />
                <span>{t('online')} • {t('officialPortal')}</span>
              </p>
            </div>
          </Link>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {/* Clearly visible "Upload / Submit Documents" Navigation Button */}
          {onOpenDocuments && (
            <button
              type="button"
              onClick={onOpenDocuments}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs px-2.5 py-1.5 rounded-lg shadow-sm flex items-center space-x-1.5 transition-all active:scale-95 border border-amber-500/40 whitespace-nowrap"
              title={t('tabUploadSubmitDocuments')}
              aria-label={t('tabUploadSubmitDocuments')}
            >
              <UploadCloud className="w-3.5 h-3.5 text-slate-900" />
              <span className="hidden sm:inline">{t('uploadSubmitDocsBtn')}</span>
            </button>
          )}

          {/* Citizen Profile Link / Login Button */}
          {isLoggedIn ? (
            <Link
              to="/profile"
              className="flex items-center space-x-1.5 bg-white/15 hover:bg-white/25 px-2.5 py-1.5 rounded-lg border border-white/20 text-xs text-white shadow-xs transition-colors"
              title={`${t('citizenProfileName')}: ${citizenName}`}
            >
              <UserCheck className="w-3.5 h-3.5 text-amber-300" />
              <span className="font-semibold truncate max-w-[100px] hidden sm:inline">{citizenName}</span>
              <span className="font-semibold sm:hidden">{t('navProfile')}</span>
            </Link>
          ) : (
            <Link
              to="/login"
              className="flex items-center space-x-1.5 bg-white/15 hover:bg-white/25 px-2.5 py-1.5 rounded-lg border border-white/20 text-xs text-white shadow-xs transition-colors"
              title={t('navLogin')}
            >
              <LogIn className="w-3.5 h-3.5 text-amber-300" />
              <span className="font-semibold">{t('navLogin')}</span>
            </Link>
          )}

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

          {/* PWA Install Button (conditional) */}
          {isInstallable && (
            <button
              onClick={handleInstallClick}
              className="bg-gov-saffron text-slate-900 font-bold px-2 py-1 rounded text-xs flex items-center space-x-1 shadow animate-bounce"
              title="Install App (PWA)"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Install PWA</span>
            </button>
          )}

          {/* Reset Conversation */}
          <button
            onClick={onResetChat}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Reset Chat"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
