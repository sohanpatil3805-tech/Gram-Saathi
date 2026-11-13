import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useOfficerAuth, DEMO_OFFICERS } from '../../context/OfficerAuthContext';
import { OfficerRole } from '../../types/officer';
import { 
  Building2, 
  Lock, 
  User, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles, 
  Smartphone 
} from 'lucide-react';

export const OfficerLoginPage: React.FC = () => {
  const { login } = useOfficerAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('suresh_maddur');
  const [password, setPassword] = useState('GovSecure#2026');
  const [selectedRole, setSelectedRole] = useState<OfficerRole>('PANCHAYAT_STAFF');

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    login(selectedRole, { username });
    navigate('/officer/dashboard');
  };

  const handleQuickDemoLogin = (role: OfficerRole) => {
    login(role);
    navigate('/officer/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
      {/* Background Subtle Emblem Accent */}
      <div className="max-w-md w-full space-y-6">
        {/* Portal Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 mx-auto p-1 shadow-xl flex items-center justify-center">
            <img src="/logo.svg" alt="Gram Saathi Logo" className="w-12 h-12 rounded-full" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            ಗ್ರಾಮ ಸಾಥಿ • ಅಧಿಕಾರಿ ಪೋರ್ಟಲ್
          </h1>
          <p className="text-xs text-slate-400">
            ಗ್ರಾಮೀಣ ಕಲ್ಯಾಣ ಸೇವೆಗಳ ಆಡಳಿತಾತ್ಮಕ ಮತ್ತು ಪರಿಶೀಲನಾ ವ್ಯವಸ್ಥೆ
          </p>
        </div>

        {/* Login Box */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-5 text-slate-200 backdrop-blur-md">
          {/* Quick Demo Access Bar */}
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center space-x-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>ಡೆಮೊ ತ್ವರಿತ ಲಾಗಿನ್ (Quick One-Click Role Access):</span>
            </p>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('PANCHAYAT_STAFF')}
                className="text-left p-2.5 rounded-xl border border-slate-700 hover:border-emerald-500 bg-slate-900/50 hover:bg-emerald-950/40 transition-all flex items-center justify-between"
              >
                <div>
                  <p className="font-bold text-xs text-white">ಸುರೇಶ್ ಗೌಡ (PDO)</p>
                  <p className="text-[11px] text-slate-400">ಮದ್ದೂರು ಗ್ರಾಮ ಪಂಚಾಯತ್ ಸಿಬ್ಬಂದಿ</p>
                </div>
                <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-bold">
                  PANCHAYAT
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('TEHSIL_STAFF')}
                className="text-left p-2.5 rounded-xl border border-slate-700 hover:border-emerald-500 bg-slate-900/50 hover:bg-emerald-950/40 transition-all flex items-center justify-between"
              >
                <div>
                  <p className="font-bold text-xs text-white">ರಮೇಶ್ ಪಾಟೀಲ್ (ತಹಶೀಲ್ದಾರ್)</p>
                  <p className="text-[11px] text-slate-400">ಮದ್ದೂರು ತಾಲೂಕು ಕಚೇರಿ (ಆದೇಶ ಹೊರಡಿಸುವ ಅಧಿಕಾರ)</p>
                </div>
                <span className="text-[10px] font-mono bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-bold">
                  TEHSIL
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('ADMIN')}
                className="text-left p-2.5 rounded-xl border border-slate-700 hover:border-emerald-500 bg-slate-900/50 hover:bg-emerald-950/40 transition-all flex items-center justify-between"
              >
                <div>
                  <p className="font-bold text-xs text-white">ಡಾ. ಅನಿತಾ ರಾವ್, IAS (ಜಿಲ್ಲಾಡಳಿತ)</p>
                  <p className="text-[11px] text-slate-400">ಜಿಲ್ಲಾ ಮಟ್ಟದ ಸಮಗ್ರ ನಿಗಾ ಮತ್ತು ವರದಿಗಳು</p>
                </div>
                <span className="text-[10px] font-mono bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-bold">
                  ADMIN
                </span>
              </button>
            </div>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-700"></div>
            <span className="flex-shrink mx-3 text-[11px] text-slate-500 font-mono">ಅಥವಾ ಸಾಮಾನ್ಯ ಲಾಗಿನ್</span>
            <div className="flex-grow border-t border-slate-700"></div>
          </div>

          {/* Credentials Form */}
          <form onSubmit={handleManualLogin} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                ಬಳಕೆದಾರ ಹೆಸರು (Username)
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-9 pr-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="suresh_maddur"
                />
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                ಪಾಸ್‌ವರ್ಡ್ (Password)
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-9 pr-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="••••••••"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 px-4 rounded-lg shadow-lg flex items-center justify-center space-x-2 transition-all active:scale-95"
            >
              <span>ಪೋರ್ಟಲ್‌ಗೆ ಲಾಗಿನ್ ಮಾಡಿ</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Back to Citizen Interface link */}
        <div className="text-center">
          <Link
            to="/"
            className="text-xs text-emerald-400 hover:text-emerald-300 inline-flex items-center space-x-1.5 underline"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>ನಾಗರಿಕ ವಾಟ್ಸಾಪ್ PWA ಇಂಟರ್‌ಫೇಸ್‌ಗೆ ಹಿಂತಿರುಗಿ</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
