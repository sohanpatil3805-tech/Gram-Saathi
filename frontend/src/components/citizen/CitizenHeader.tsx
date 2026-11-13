import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { 
  Languages, 
  Download, 
  Smartphone, 
  MessageSquare, 
  ShieldCheck, 
  RotateCcw,
  ExternalLink
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface CitizenHeaderProps {
  viewMode: 'chat' | 'whatsapp';
  onToggleViewMode: () => void;
  onResetChat: () => void;
}

export const CitizenHeader: React.FC<CitizenHeaderProps> = ({
  viewMode,
  onToggleViewMode,
  onResetChat,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

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
            to="/officer/dashboard" 
            className="text-amber-300 hover:text-amber-200 underline font-medium flex items-center space-x-1"
          >
            <span>{language === 'kn' ? 'ಅಧಿಕಾರಿ ಪೋರ್ಟಲ್' : 'अधिकारी पोर्टल'}</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Main Header Bar */}
      <div className="px-3 py-2.5 flex items-center justify-between max-w-4xl mx-auto">
        {/* Brand & Emblem */}
        <div className="flex items-center space-x-2.5">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-white/10 p-0.5 border border-white/20 flex items-center justify-center shadow-inner">
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
                AI 2.0
              </span>
            </div>
            <p className="text-[11px] text-emerald-100 flex items-center space-x-1">
              <ShieldCheck className="w-3 h-3 text-emerald-300 inline" />
              <span>{t('online')} • {t('officialPortal')}</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {/* Language Switcher */}
          <button
            onClick={() => setLanguage(language === 'kn' ? 'hi' : 'kn')}
            className="flex items-center space-x-1 bg-white/15 hover:bg-white/25 active:scale-95 transition-all text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-white/20"
            title="Switch Language / ಭಾಷೆ ಬದಲಿಸಿ"
          >
            <Languages className="w-3.5 h-3.5 text-amber-300" />
            <span>{language === 'kn' ? 'हिंदी' : 'ಕನ್ನಡ'}</span>
          </button>

          {/* Simulator Mode Toggle */}
          <button
            onClick={onToggleViewMode}
            className={`p-1.5 rounded-lg border transition-all ${
              viewMode === 'whatsapp'
                ? 'bg-whatsapp-green text-slate-900 border-white font-bold shadow'
                : 'bg-white/15 hover:bg-white/25 text-white border-white/20'
            }`}
            title={viewMode === 'whatsapp' ? 'Switch to App UI' : 'Switch to WhatsApp Simulator'}
          >
            {viewMode === 'whatsapp' ? (
              <Smartphone className="w-4 h-4" />
            ) : (
              <MessageSquare className="w-4 h-4" />
            )}
          </button>

          {/* PWA Install Button (conditional) */}
          {isInstallable && (
            <button
              onClick={handleInstallClick}
              className="bg-gov-saffron text-slate-900 font-bold px-2 py-1 rounded text-xs flex items-center space-x-1 shadow animate-bounce"
              title="Install App (PWA)"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Install</span>
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
