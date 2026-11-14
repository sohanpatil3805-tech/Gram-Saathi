import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { 
  getCitizenToken, 
  clearCitizenToken, 
  getCitizenProfile, 
  updateCitizenProfile, 
  getCitizenApplications 
} from '../../services/api';
import { CitizenProfile, SupportedLanguage } from '../../types/api';
import { 
  User, 
  Phone, 
  MapPin, 
  Languages, 
  LogOut, 
  Edit3, 
  Save, 
  X, 
  FileText, 
  ChevronRight, 
  Clock, 
  ArrowLeft,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const CitizenProfilePage: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<CitizenProfile | null>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('Karnataka');
  const [prefLang, setPrefLang] = useState<SupportedLanguage>('en');

  // Karnataka districts list for easy dropdown
  const karnatakaDistricts = [
    'Bagalkote', 'Ballari', 'Belagavi', 'Bengaluru Rural', 'Bengaluru Urban',
    'Bidar', 'Chamarajanagara', 'Chikkaballapura', 'Chikkamagaluru', 'Chitradurga',
    'Dakshina Kannada', 'Davanagere', 'Dharwad', 'Gadag', 'Hassan',
    'Haveri', 'Kalaburagi', 'Kodagu', 'Kolar', 'Koppal',
    'Mandya', 'Mysuru', 'Raichur', 'Ramanagara', 'Shivamogga',
    'Tumakuru', 'Udupi', 'Uttara Kannada', 'Vijayanagara', 'Vijayapura', 'Yadgir'
  ];

  useEffect(() => {
    const token = getCitizenToken();
    if (!token) {
      navigate('/login', { replace: true, state: { from: { pathname: '/profile' } } });
      return;
    }

    setLoading(true);
    Promise.all([
      getCitizenProfile().catch(() => null),
      getCitizenApplications().catch(() => []),
    ])
      .then(([profData, appsData]) => {
        if (profData) {
          setProfile(profData);
          setName(profData.name || '');
          setDistrict(profData.district || 'Mandya');
          setState(profData.state || 'Karnataka');
          setPrefLang((profData.preferred_language as SupportedLanguage) || language);
        }
        if (Array.isArray(appsData)) {
          setApplications(appsData);
        }
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const maskPhone = (num?: string) => {
    if (!num) return '+91 XXXXX X1234';
    const cleaned = num.replace(/\D/g, '');
    if (cleaned.length >= 10) {
      const last4 = cleaned.slice(-4);
      return `+91 XXXXX X${last4}`;
    }
    return num;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const updated = await updateCitizenProfile({
        name,
        district,
        state,
        preferred_language: prefLang,
      });
      setProfile(updated);
      setIsEditing(false);
      setMessage({ type: 'success', text: t('profileUpdateSuccess') });
      if (prefLang !== language) {
        setLanguage(prefLang);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm(t('profileLogoutConfirm'))) {
      clearCitizenToken();
      navigate('/login', { replace: true });
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'APPROVED') {
      return <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800">Approved</span>;
    }
    if (s === 'REJECTED') {
      return <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-red-100 text-red-800">Rejected</span>;
    }
    if (s === 'NEEDS_CORRECTION') {
      return <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-amber-100 text-amber-800">Needs Correction</span>;
    }
    if (s === 'SUBMITTED' || s === 'UNDER_VERIFICATION' || s === 'OFFICER_REVIEW') {
      return <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-blue-100 text-blue-800">In Review</span>;
    }
    return <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-slate-100 text-slate-700">Draft</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-3 border-whatsapp-teal border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-500">{t('loading')}</p>
        </div>
      </div>
    );
  }

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
            <h1 className="font-bold text-base sm:text-lg">{t('profileTitle')}</h1>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center space-x-1.5 bg-red-500/20 hover:bg-red-500/30 text-white px-2.5 py-1.5 rounded-lg border border-red-300/30 text-xs font-semibold transition-all"
            title={t('profileLogoutBtn')}
          >
            <LogOut className="w-3.5 h-3.5 text-red-200" />
            <span className="hidden sm:inline">{t('profileLogoutBtn')}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Message Banner */}
        {message && (
          <div
            className={`p-3.5 rounded-xl flex items-start space-x-2 text-xs animate-fade-in ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Profile Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-whatsapp-teal flex items-center justify-center font-bold text-lg shadow-inner">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-bold text-base text-slate-800">
                  {profile?.name || 'Gram Saathi Citizen'}
                </h2>
                <p className="text-xs text-slate-500 font-mono">
                  {maskPhone(profile?.phone_number)}
                </p>
              </div>
            </div>

            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{t('profileEditBtn')}</span>
              </button>
            )}
          </div>

          {/* View Mode */}
          {!isEditing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-slate-400 font-medium mb-1">{t('profileName')}</p>
                <p className="font-semibold text-slate-800 text-sm">{profile?.name || '—'}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-slate-400 font-medium mb-1">{t('profilePhone')}</p>
                <p className="font-semibold text-slate-800 text-sm font-mono">{maskPhone(profile?.phone_number)}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-slate-400 font-medium mb-1">{t('profileDistrict')}</p>
                <p className="font-semibold text-slate-800 text-sm">{profile?.district || '—'}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-slate-400 font-medium mb-1">{t('profileState')}</p>
                <p className="font-semibold text-slate-800 text-sm">{profile?.state || 'Karnataka'}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 sm:col-span-2">
                <p className="text-slate-400 font-medium mb-1">{t('profileLanguage')}</p>
                <p className="font-semibold text-slate-800 text-sm">
                  {profile?.preferred_language === 'kn' ? 'ಕನ್ನಡ (Kannada)' : profile?.preferred_language === 'hi' ? 'हिंदी (Hindi)' : 'English'}
                </p>
              </div>
            </div>
          ) : (
            /* Edit Mode Form */
            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {t('profileName')}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter full name"
                  className="w-full py-2.5 px-3 border border-slate-300 rounded-xl outline-none focus:border-whatsapp-teal focus:ring-1 focus:ring-whatsapp-teal text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {t('profileDistrict')}
                  </label>
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full py-2.5 px-3 border border-slate-300 rounded-xl outline-none focus:border-whatsapp-teal focus:ring-1 focus:ring-whatsapp-teal text-sm bg-white"
                  >
                    {karnatakaDistricts.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {t('profileState')}
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full py-2.5 px-3 border border-slate-300 rounded-xl outline-none focus:border-whatsapp-teal focus:ring-1 focus:ring-whatsapp-teal text-sm bg-slate-50 text-slate-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {t('profileLanguage')}
                </label>
                <select
                  value={prefLang}
                  onChange={(e) => setPrefLang(e.target.value as SupportedLanguage)}
                  className="w-full py-2.5 px-3 border border-slate-300 rounded-xl outline-none focus:border-whatsapp-teal focus:ring-1 focus:ring-whatsapp-teal text-sm bg-white"
                >
                  <option value="en">English</option>
                  <option value="kn">ಕನ್ನಡ (Kannada)</option>
                  <option value="hi">हिंदी (Hindi)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center space-x-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 px-4 bg-whatsapp-teal hover:bg-whatsapp-darkTeal disabled:bg-slate-300 text-white font-bold rounded-xl shadow-sm transition-all flex items-center justify-center space-x-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? t('loading') : t('profileSaveBtn')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all"
                >
                  {t('profileCancelBtn')}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Application History Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800 flex items-center space-x-2">
              <FileText className="w-4 h-4 text-whatsapp-teal" />
              <span>{t('profileApplicationHistory')}</span>
            </h3>
            <span className="text-xs bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-full font-mono font-semibold">
              {applications.length}
            </span>
          </div>

          {applications.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-3">
              <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {t('profileNoApplications')}
              </p>
              <Link
                to="/home"
                className="inline-flex items-center space-x-1.5 bg-whatsapp-teal text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm hover:bg-whatsapp-darkTeal transition-all"
              >
                <span>{t('homeActionSchemes')}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {applications.map((app) => (
                <div
                  key={app.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:shadow-md transition-all flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-xs text-slate-800">
                        {app.submission_reference || app.id?.slice(0, 8)}
                      </span>
                      {getStatusBadge(app.current_status || app.status)}
                    </div>
                    <p className="text-xs text-slate-600 font-medium">
                      {app.scheme_id || 'Welfare Scheme Application'}
                    </p>
                    <p className="text-[10px] text-slate-400 flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(app.created_at || Date.now()).toLocaleDateString()}</span>
                    </p>
                  </div>

                  <Link
                    to="/"
                    state={{ activeTab: 'track', refNumber: app.submission_reference || app.id }}
                    className="p-2 text-slate-400 hover:text-whatsapp-teal hover:bg-slate-50 rounded-xl transition-all"
                    title={t('trackApplication')}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-slate-400">
        <p>{t('appName')} • {t('governmentOfIndia')}</p>
      </footer>
    </div>
  );
};

export default CitizenProfilePage;
