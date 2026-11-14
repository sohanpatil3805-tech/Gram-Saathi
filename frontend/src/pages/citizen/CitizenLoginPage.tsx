import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { sendOtp, verifyOtp, setCitizenToken } from '../../services/api';
import { 
  ShieldCheck, 
  Phone, 
  KeyRound, 
  ArrowRight, 
  RotateCcw, 
  ArrowLeft, 
  Languages, 
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const CitizenLoginPage: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [timer, setTimer] = useState<number>(300); // 5 min countdown
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Countdown timer for OTP
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (step === 'OTP' && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length !== 10) {
      setError(t('invalidPhone'));
      return;
    }

    setIsLoading(true);
    try {
      const fullPhone = `+91${cleaned}`;
      const res = await sendOtp(fullPhone);
      if (res.dev_otp) {
        setDevOtp(res.dev_otp);
        // Pre-fill or make it easy for tester
      }
      setStep('OTP');
      setTimer(300);
      setSuccessMsg(t('otpSentMsg'));
    } catch (err: any) {
      setError(err?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanedOtp = otp.trim();
    if (cleanedOtp.length !== 6) {
      setError(t('invalidOtp'));
      return;
    }

    setIsLoading(true);
    try {
      const fullPhone = `+91${phone.replace(/\D/g, '')}`;
      const res = await verifyOtp(fullPhone, cleanedOtp);
      if (res.access_token) {
        setCitizenToken(res.access_token);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('citizen_token', res.access_token);
          if (res.citizen_id) {
            localStorage.setItem('citizen_id', res.citizen_id);
          }
        }
      }
      setSuccessMsg(t('loginSuccess'));
      setTimeout(() => {
        const from = (location.state as any)?.from?.pathname || '/home';
        navigate(from, { replace: true });
      }, 800);
    } catch (err: any) {
      setError(err?.message || 'Invalid or expired OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (timer > 240) return; // Allow resend after 60s
    setError(null);
    setIsLoading(true);
    try {
      const fullPhone = `+91${phone.replace(/\D/g, '')}`;
      const res = await sendOtp(fullPhone);
      if (res.dev_otp) {
        setDevOtp(res.dev_otp);
      }
      setTimer(300);
      setSuccessMsg(t('otpSentMsg'));
    } catch (err: any) {
      setError(err?.message || 'Failed to resend OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Top Header */}
      <header className="bg-whatsapp-teal text-white shadow-md">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-full bg-white/10 p-0.5 border border-white/20 flex items-center justify-center">
              <img src="/logo.svg" alt="Gram Saathi" className="w-7 h-7 rounded-full" />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight">{t('appName')}</h1>
              <p className="text-[10px] text-emerald-100 flex items-center space-x-1">
                <ShieldCheck className="w-3 h-3 text-emerald-300 inline" />
                <span>{t('officialPortal')}</span>
              </p>
            </div>
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

      {/* Main Form Content */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 sm:p-6 flex flex-col justify-center">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6">
          {/* Card Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-emerald-50 text-whatsapp-teal rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
              {step === 'PHONE' ? <Phone className="w-6 h-6" /> : <KeyRound className="w-6 h-6" />}
            </div>
            <h2 className="text-xl font-bold text-slate-800">{t('loginTitle')}</h2>
            <p className="text-xs text-slate-500 mt-1">{t('loginSubtitle')}</p>
          </div>

          {/* Error & Success Messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2 text-xs text-red-700 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && !error && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-2 text-xs text-emerald-800 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Step 1: Phone Form */}
          {step === 'PHONE' && (
            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t('phoneNumberLabel')}
                </label>
                <div className="flex items-center rounded-xl border border-slate-300 focus-within:border-whatsapp-teal focus-within:ring-2 focus-within:ring-whatsapp-teal/20 transition-all bg-white overflow-hidden shadow-inner">
                  <span className="bg-slate-100 text-slate-700 px-3.5 py-3 text-sm font-semibold border-r border-slate-300 select-none">
                    🇮🇳 +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder={t('phoneNumberPlaceholder')}
                    className="flex-1 py-3 px-3 text-base sm:text-sm text-slate-900 outline-none font-medium tracking-wide"
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Enter 10-digit mobile number (e.g. 9876543210)
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading || phone.replace(/\D/g, '').length !== 10}
                className="w-full py-3.5 px-4 bg-whatsapp-teal hover:bg-whatsapp-darkTeal disabled:bg-slate-300 text-white font-bold rounded-xl shadow-md transition-all active:scale-[0.98] disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm sm:text-base"
              >
                {isLoading ? (
                  <span>{t('loading')}</span>
                ) : (
                  <>
                    <span>{t('sendOtpBtn')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Step 2: OTP Form */}
          {step === 'OTP' && (
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="font-semibold">+91 {phone}</span>
                <button
                  type="button"
                  onClick={() => {
                    setStep('PHONE');
                    setOtp('');
                    setError(null);
                  }}
                  className="text-whatsapp-teal hover:underline font-semibold flex items-center space-x-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>{t('edit')}</span>
                </button>
              </div>

              {/* Dev OTP Box if available */}
              {devOtp && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-amber-800 mr-1">{t('demoOtpLabel')}</span>
                    <span className="font-mono text-sm tracking-widest font-bold bg-amber-200/80 px-2 py-0.5 rounded">
                      {devOtp}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOtp(devOtp)}
                    className="text-xs bg-amber-200 hover:bg-amber-300 text-amber-900 font-semibold px-2 py-1 rounded transition-colors"
                  >
                    Auto Fill
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t('otpLabel')}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full text-center text-2xl tracking-[0.5em] font-mono py-3 px-4 border border-slate-300 rounded-xl focus:border-whatsapp-teal focus:ring-2 focus:ring-whatsapp-teal/20 outline-none transition-all shadow-inner"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  {timer > 0 ? (
                    <>
                      {t('resendOtpIn')}{' '}
                      <span className="font-mono font-bold text-slate-700">
                        {formatTimer(timer)}
                      </span>
                    </>
                  ) : (
                    <span className="text-red-500">{t('otpExpired')}</span>
                  )}
                </span>
                <button
                  type="button"
                  disabled={timer > 240 || isLoading}
                  onClick={handleResendOtp}
                  className="text-whatsapp-teal hover:underline font-semibold disabled:text-slate-400 disabled:no-underline flex items-center space-x-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{t('resendOtp')}</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading || otp.trim().length !== 6}
                className="w-full py-3.5 px-4 bg-whatsapp-teal hover:bg-whatsapp-darkTeal disabled:bg-slate-300 text-white font-bold rounded-xl shadow-md transition-all active:scale-[0.98] disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm sm:text-base"
              >
                {isLoading ? (
                  <span>{t('loading')}</span>
                ) : (
                  <>
                    <span>{t('verifyOtpBtn')}</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Privacy Note */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {t('privacyNotice')}
            </p>
          </div>
        </div>
      </main>

      {/* Bottom bar */}
      <footer className="text-center py-4 text-xs text-slate-400">
        <p>{t('appName')} • {t('governmentOfIndia')}</p>
      </footer>
    </div>
  );
};

export default CitizenLoginPage;
