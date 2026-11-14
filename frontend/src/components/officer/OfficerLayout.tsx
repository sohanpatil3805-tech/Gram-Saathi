import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useOfficerAuth, DEMO_OFFICERS } from '../../context/OfficerAuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { SupportedLanguage } from '../../types/api';
import { OfficerRole } from '../../types/officer';
import { 
  LayoutDashboard, 
  FileCheck2, 
  BarChart3, 
  LogOut, 
  ShieldCheck, 
  UserCheck, 
  ChevronDown, 
  Building2, 
  Smartphone,
  Menu,
  X,
  Languages,
  Sun,
  Moon
} from 'lucide-react';

interface OfficerLayoutProps {
  children: React.ReactNode;
}

export const OfficerLayout: React.FC<OfficerLayoutProps> = ({ children }) => {
  const { officer, logout, switchRole } = useOfficerAuth();
  const { t, language, setLanguage } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Dark Mode State for Officer Portal
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('gram_saathi_officer_theme');
      if (saved) return saved === 'dark';
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('gram_saathi_officer_theme', 'dark');
      }
    } else {
      document.documentElement.classList.remove('dark');
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('gram_saathi_officer_theme', 'light');
      }
    }

    return () => {
      // Ensure dark mode from officer portal does not leak to citizen portal when navigating away
      document.documentElement.classList.remove('dark');
    };
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  const navItems = [
    {
      name: t('navOverview'),
      path: '/officer/dashboard',
      icon: LayoutDashboard,
    },
    {
      name: t('navApplications'),
      path: '/officer/applications',
      icon: FileCheck2,
    },
    {
      name: t('navReports'),
      path: '/officer/reports',
      icon: BarChart3,
    },
  ];

  const handleRoleChange = (role: OfficerRole) => {
    switchRole(role);
    setIsRoleDropdownOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/officer/login');
  };

  return (
    <div className={`min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row transition-colors ${isDarkMode ? 'dark' : ''}`}>
      {/* Mobile Top Header */}
      <div className="md:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-40 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <img src="/logo.svg" alt="Gram Saathi" className="w-7 h-7 rounded-full" />
          <span className="font-bold text-sm">{t('appName')} • {t('officerPortalTitle')}</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-1 rounded text-slate-300 hover:text-white"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar for Desktop / Tablet */}
      <aside
        className={`fixed md:sticky top-0 z-30 h-screen w-64 bg-slate-900 text-slate-200 flex flex-col border-r border-slate-800 transition-all ${
          isMobileMenuOpen ? 'left-0' : '-left-64 md:left-0'
        }`}
      >
        {/* Logo and Emblem */}
        <div className="p-4 border-b border-slate-800/80 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center p-1 shadow-inner">
            <img src="/logo.svg" alt="Emblem" className="w-8 h-8 rounded-full" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm text-white tracking-tight leading-tight">
              {t('appName')}
            </h1>
            <p className="text-[10px] text-emerald-400 font-medium">
              {t('officerPortalTitle')}
            </p>
          </div>
        </div>

        {/* Current Officer Badge */}
        {officer && (
          <div className="p-3.5 bg-slate-800/60 mx-3 my-3 rounded-xl border border-slate-700/60 text-xs space-y-1">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
              <p className="font-bold text-white truncate">{officer.full_name}</p>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              {officer.role_display_name}
            </p>
            <p className="text-[10px] text-emerald-300/80 font-mono">
              {t('jurisdictionLabel')} {officer.jurisdiction_village || officer.jurisdiction_taluk || officer.jurisdiction_district}
            </p>
          </div>
        )}

        {/* Navigation links */}
        <nav className="flex-1 px-3 space-y-1 pt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path !== '/officer/dashboard' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-whatsapp-teal text-white shadow-md'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-300' : 'text-slate-400'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Switch to Citizen PWA shortcut */}
        <div className="p-3 border-t border-slate-800">
          <Link
            to="/"
            className="flex items-center justify-between text-xs font-semibold bg-emerald-950/60 hover:bg-emerald-900 text-emerald-200 border border-emerald-700/50 p-2.5 rounded-lg transition-all"
          >
            <div className="flex items-center space-x-2">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span>{t('switchToCitizenPwa')}</span>
            </div>
            <span className="text-[10px] bg-emerald-700 text-white px-1.5 py-0.5 rounded">
              {t('viewDetails')}
            </span>
          </Link>
        </div>

        {/* Logout */}
        <div className="p-3 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 text-xs font-semibold text-rose-300 hover:text-rose-200 hover:bg-rose-950/50 py-2 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 sticky top-0 z-20 shadow-sm flex items-center justify-between transition-colors">
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
              <Building2 className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              <span>{t('governmentOfIndia')}</span>
            </div>
          </div>

          {/* Role Switcher Toolbar & Theme Toggle */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Dark / Light Mode Toggle Button */}
            <button
              type="button"
              onClick={toggleDarkMode}
              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-amber-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center space-x-1.5 shadow-xs"
              title={isDarkMode ? t('lightMode') : t('darkMode')}
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
              <span className="hidden lg:inline text-xs font-semibold">
                {isDarkMode ? t('lightMode') : t('darkMode')}
              </span>
            </button>

            {/* Language Switcher */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              <Languages className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 ml-1.5 mr-1" />
              {(['en', 'kn', 'hi'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`px-2 py-1 rounded-md font-semibold text-xs transition-all ${
                    language === lang
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title={`Switch to ${lang === 'en' ? 'English' : lang === 'kn' ? 'ಕನ್ನಡ' : 'हिंदी'}`}
                >
                  {lang === 'en' ? 'EN' : lang === 'kn' ? 'ಕನ್ನಡ' : 'हिंदी'}
                </button>
              ))}
            </div>

            <div className="relative">
              <button
                onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 transition-all"
              >
                <UserCheck className="w-3.5 h-3.5 text-saathi-700 dark:text-emerald-400" />
                <span className="font-mono text-[11px] bg-saathi-100 dark:bg-emerald-950 text-saathi-900 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                  {officer?.role}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              </button>

              {isRoleDropdownOpen && (
                <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-modal border border-slate-200 dark:border-slate-800 py-1.5 z-50 text-xs">
                  <p className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {t('switchRoleTitle')}
                  </p>
                  {(['PANCHAYAT_STAFF', 'TEHSIL_STAFF', 'ADMIN'] as OfficerRole[]).map((r) => {
                    const u = DEMO_OFFICERS[r];
                    const isSelected = officer?.role === r;
                    return (
                      <button
                        key={r}
                        onClick={() => handleRoleChange(r)}
                        className={`w-full text-left px-3 py-2 flex flex-col hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                          isSelected ? 'bg-saathi-50 dark:bg-emerald-950/60 text-saathi-900 dark:text-emerald-300 font-bold' : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="font-semibold">{u.full_name}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">{u.role_display_name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Live mode indicator */}
            <span className="hidden sm:inline-flex items-center space-x-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              <span>{t('liveSyncActive')}</span>
            </span>
          </div>
        </header>

        {/* Content View */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
