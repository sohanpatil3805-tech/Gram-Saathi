import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { OfficerLayout } from '../../components/officer/OfficerLayout';
import { StatusBadge } from '../../components/officer/StatusBadge';
import { ApplicationRecord } from '../../types/officer';
import { mockService } from '../../services/mockService';
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
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [villageFilter, setVillageFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  const fetchApplications = async () => {
    setIsLoading(true);
    try {
      const data = await mockService.getOfficerApplications({
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
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              ಅರ್ಜಿಗಳ ಪರಿಶೀಲನಾ ಕ್ಯೂ (Applications Management Queue)
            </h1>
            <p className="text-xs text-slate-500">
              ಗ್ರಾಮೀಣ ನಾಗರಿಕರಿಂದ ಬಂದಿರುವ ಎಲ್ಲಾ ಯೋಜನೆಗಳ ಅರ್ಜಿಗಳು ಮತ್ತು ದಾಖಲೆಗಳು
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchApplications}
              className="p-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-slate-600 transition-all"
              title="Refresh Queue"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-bold bg-saathi-100 text-saathi-900 px-3 py-1.5 rounded-lg border border-saathi-200">
              ಒಟ್ಟು: {applications.length} ಅರ್ಜಿಗಳು
            </span>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ಅರ್ಜಿ ಸಂಖ್ಯೆ (SIM-2024-00042) ಅಥವಾ ಅರ್ಜಿದಾರರ ಹೆಸರು ಹುಡುಕಿ..."
                className="w-full text-xs pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-saathi-600/30 focus:border-saathi-600"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>

            <button
              type="submit"
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-lg transition-all"
            >
              ಹುಡುಕಿ (Search)
            </button>
          </form>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100 text-xs">
            <div className="flex items-center space-x-1.5 mr-2 text-slate-500 font-semibold">
              <Filter className="w-3.5 h-3.5" />
              <span>ಸ್ಥಿತಿ ಫಿಲ್ಟರ್:</span>
            </div>

            {[
              { id: 'ALL', label: 'ಎಲ್ಲವೂ (All)' },
              { id: 'OFFICER_REVIEW', label: 'ಪರಿಶೀಲನೆಯಲ್ಲಿವೆ (Review)' },
              { id: 'APPROVED', label: 'ಅನುಮೋದಿತ (Approved)' },
              { id: 'NEEDS_CORRECTION', label: 'ತಿದ್ದುಪಡಿ (Correction)' },
              { id: 'REJECTED', label: 'ತಿರಸ್ಕೃತ (Rejected)' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1 rounded-full font-medium transition-all ${
                  statusFilter === f.id
                    ? 'bg-saathi-800 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Applications Data Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5">ಉಲ್ಲೇಖ ಸಂಖ್ಯೆ</th>
                  <th className="px-4 py-3.5">ಅರ್ಜಿದಾರರು</th>
                  <th className="px-4 py-3.5">ಯೋಜನೆ</th>
                  <th className="px-4 py-3.5">ವರ್ಗ & ಜಮೀನು</th>
                  <th className="px-4 py-3.5">ಸಲ್ಲಿಕೆ ದಿನಾಂಕ</th>
                  <th className="px-4 py-3.5">ಸ್ಥಿತಿ</th>
                  <th className="px-4 py-3.5 text-right">ವಿವರಣೆ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      ಯಾವುದೇ ಅರ್ಜಿಗಳು ಕಂಡುಬಂದಿಲ್ಲ. ಫಿಲ್ಟರ್ ಬದಲಿಸಿ ಪ್ರಯತ್ನಿಸಿ.
                    </td>
                  </tr>
                ) : (
                  applications.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                        {app.application_reference}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-bold text-slate-900">{app.applicant.full_name}</p>
                        <p className="text-[11px] text-slate-500">{app.applicant.village}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-800">{app.scheme_name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{app.scheme_code}</p>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        <p className="font-medium">{app.applicant.citizen_group}</p>
                        <p className="text-[11px] text-slate-500">
                          {app.applicant.land_holding_acres ? `${app.applicant.land_holding_acres} ಎಕರೆ` : 'N/A'}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 font-mono text-[11px]">
                        {new Date(app.submitted_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={app.status} size="sm" />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          to={`/officer/applications/${app.id}`}
                          className="bg-saathi-800 hover:bg-saathi-900 text-white font-bold px-3 py-1.5 rounded-lg inline-flex items-center space-x-1 shadow-sm transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>ಪರಿಶೀಲಿಸಿ</span>
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
