import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { OfficerLayout } from '../../components/officer/OfficerLayout';
import { StatusBadge } from '../../components/officer/StatusBadge';
import { useLanguage } from '../../context/LanguageContext';
import { ApplicationRecord } from '../../types/officer';
import { api } from '../../services/api';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  Eye, 
  ArrowRight, 
  Download,
  Building,
  RefreshCw 
} from 'lucide-react';

export const OfficerApplicationsPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [villageFilter, setVillageFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  const fetchApplications = async () => {
    setIsLoading(true);
    try {
      const data = await api.getOfficerApplications({
        status: statusFilter,
        village: villageFilter,
        search: searchTerm,
      });
      setApplications(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [statusFilter, villageFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchApplications();
  };

  return (
    <OfficerLayout>
      <div className="space-y-5">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {t('queueTitle')}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('queueSubtitle')}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchApplications}
              className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-all shadow-xs"
              title="Refresh Queue"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-bold bg-saathi-100 dark:bg-emerald-950 text-saathi-900 dark:text-emerald-300 px-3 py-1.5 rounded-lg border border-saathi-200 dark:border-emerald-800">
              {t('totalApplicationsCard')}: {applications.length}
            </span>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 transition-colors">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="w-full text-xs pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none text-slate-900 dark:text-white focus:ring-2 focus:ring-saathi-600/30 focus:border-saathi-600"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>

            <button
              type="submit"
              className="bg-slate-900 dark:bg-emerald-700 hover:bg-slate-800 dark:hover:bg-emerald-600 text-white font-bold text-xs px-4 py-2 rounded-lg transition-all"
            >
              {t('searchBtn')}
            </button>
          </form>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex items-center space-x-1.5 mr-2 text-slate-500 dark:text-slate-400 font-semibold">
              <Filter className="w-3.5 h-3.5" />
              <span>{t('filterStatus')}</span>
            </div>

            {[
              { id: 'ALL', label: t('allStatuses') },
              { id: 'OFFICER_REVIEW', label: t('underReview') },
              { id: 'APPROVED', label: t('approved') },
              { id: 'NEEDS_CORRECTION', label: t('needsCorrectionCard') },
              { id: 'REJECTED', label: t('rejected') },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1 rounded-full font-medium transition-all ${
                  statusFilter === f.id
                    ? 'bg-saathi-800 dark:bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Applications Data Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3.5">{t('tableAppNo')}</th>
                  <th className="px-4 py-3.5">{t('tableCitizen')}</th>
                  <th className="px-4 py-3.5">{t('tableScheme')}</th>
                  <th className="px-4 py-3.5">{t('categoryLocationHeading')}</th>
                  <th className="px-4 py-3.5">{t('tableSubmittedAt')}</th>
                  <th className="px-4 py-3.5">{t('tableStatus')}</th>
                  <th className="px-4 py-3.5 text-right">{t('tableAction')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {applications.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                      {t('noApplicationsFound')}
                    </td>
                  </tr>
                ) : (
                  applications.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3.5 font-mono font-bold text-slate-900 dark:text-white">
                        {app.application_reference}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-bold text-slate-900 dark:text-slate-100">{app.applicant.full_name}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{app.applicant.village}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{app.scheme_name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{app.scheme_code}</p>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                        <p className="font-medium capitalize">{app.applicant.citizen_group}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {String(app.applicant.citizen_group).toLowerCase().includes('student')
                            ? (app.applicant.education_level || 'Student Scholar')
                            : app.applicant.land_holding_acres ? `${app.applicant.land_holding_acres} Acres` : 'Land: N/A'}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {new Date(app.submitted_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={app.status} size="sm" />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          to={`/officer/applications/${app.id}`}
                          className="bg-saathi-800 hover:bg-saathi-900 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg inline-flex items-center space-x-1 shadow-sm transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{t('reviewBtn')}</span>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </OfficerLayout>
  );
};
