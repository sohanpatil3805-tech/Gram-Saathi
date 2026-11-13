import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { OfficerLayout } from '../../components/officer/OfficerLayout';
import { StatCard } from '../../components/officer/StatCard';
import { StatusBadge } from '../../components/officer/StatusBadge';
import { useOfficerAuth } from '../../context/OfficerAuthContext';
import { DashboardStats, ApplicationRecord } from '../../types/officer';
import { mockService } from '../../services/mockService';
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  TrendingUp, 
  ArrowRight, 
  Building, 
  ShieldCheck,
  Calendar,
  Layers
} from 'lucide-react';

export const OfficerDashboardPage: React.FC = () => {
  const { officer } = useOfficerAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentApplications, setRecentApplications] = useState<ApplicationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [statsData, appsData] = await Promise.all([
          mockService.getDashboardStats(),
          mockService.getOfficerApplications(),
        ]);
        setStats(statsData);
        setRecentApplications(appsData.slice(0, 5));
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [officer?.role]);

  return (
    <OfficerLayout>
      <div className="space-y-6">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-md border border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-500/30 font-mono">
                {officer?.role}
              </span>
              <span className="text-xs text-slate-300">
                {officer?.jurisdiction_village ? `${officer.jurisdiction_village}, ` : ''}{officer?.jurisdiction_district}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              ಸ್ವಾಗತ, {officer?.full_name}
            </h1>
            <p className="text-xs text-slate-400">
              ಗ್ರಾಮ ಸಾಥಿ ಆಡಳಿತ ಪೋರ್ಟಲ್ • ಇಂದಿನ ಅರ್ಜಿಗಳ ಸಾರಾಂಶ ಮತ್ತು ಪರಿಶೀಲನಾ ಸ್ಥಿತಿ
            </p>
          </div>

          <Link
            to="/officer/applications"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-lg flex items-center space-x-2 transition-all flex-shrink-0"
          >
            <span>ಅರ್ಜಿಗಳ ಪಟ್ಟಿ ವೀಕ್ಷಿಸಿ</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Stats KPI Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
          <StatCard
            title="ಒಟ್ಟು ಅರ್ಜಿಗಳು"
            value={stats?.total_applications ?? 5}
            subtitle="ನಾಗರಿಕರಿಂದ ಸ್ವೀಕೃತ"
            icon={FileText}
            colorScheme="slate"
            trend={{ value: '+2 ಇಂದು', isPositive: true }}
          />

          <StatCard
            title="ಪರಿಶೀಲನೆಯಲ್ಲಿವೆ"
            value={stats?.pending_review ?? 2}
            subtitle="ಕ್ರಮ ಕೈಗೊಳ್ಳಲು ಬಾಕಿ"
            icon={Clock}
            colorScheme="blue"
          />

          <StatCard
            title="ಅನುಮೋದಿತ"
            value={stats?.approved_applications ?? 2}
            subtitle="ಆದೇಶ ಹೊರಡಿಸಲಾಗಿದೆ"
            icon={CheckCircle2}
            colorScheme="emerald"
            trend={{ value: '40% ದರ', isPositive: true }}
          />

          <StatCard
            title="ತಿರಸ್ಕೃತ"
            value={stats?.rejected_applications ?? 1}
            subtitle="ಅರ್ಹತೆ ಹೊಂದಿಲ್ಲದ"
            icon={XCircle}
            colorScheme="rose"
          />

          <StatCard
            title="ತಿದ್ದುಪಡಿ ಬಾಕಿ"
            value={stats?.needs_correction ?? 1}
            subtitle="ಮಸುಕಾದ ದಾಖಲೆಗಳು"
            icon={AlertTriangle}
            colorScheme="amber"
          />
        </div>

        {/* Charts & Breakdown Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Scheme-wise intake distribution chart */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                <Layers className="w-4 h-4 text-saathi-700" />
                <span>ಯೋಜನೆವಾರು ಅರ್ಜಿಗಳ ಹಂಚಿಕೆ</span>
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">2026-Q4</span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between font-semibold text-slate-700 mb-1">
                  <span>PM-KISAN (ಕಿಸಾನ್ ಸಮ್ಮಾನ್)</span>
                  <span className="font-mono">50% (2)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-emerald-600 h-2 rounded-full" style={{ width: '50%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between font-semibold text-slate-700 mb-1">
                  <span>NSP Scholarship (ವಿದ್ಯಾರ್ಥಿವೇತನ)</span>
                  <span className="font-mono">25% (1)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '25%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between font-semibold text-slate-700 mb-1">
                  <span>Gruha Lakshmi (ಗೃಹ ಲಕ್ಷ್ಮಿ)</span>
                  <span className="font-mono">25% (1)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-purple-600 h-2 rounded-full" style={{ width: '25%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between font-semibold text-slate-700 mb-1">
                  <span>Raitha Siri (ರೈತ ಸಿರಿ)</span>
                  <span className="font-mono">15% (1)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-amber-500 h-2 rounded-full" style={{ width: '15%' }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Village load breakdown */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                <Building className="w-4 h-4 text-saathi-700" />
                <span>ಗ್ರಾಮವಾರು ವ್ಯಾಪ್ತಿ (Jurisdiction Load)</span>
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">ಮಂಡ್ಯ ಜಿಲ್ಲೆ</span>
            </div>

            <div className="space-y-2.5 text-xs">
              {[
                { village: 'ಮದ್ದೂರು ಗ್ರಾಮ (Maddur)', count: 2, pct: 40, color: 'bg-emerald-500' },
                { village: 'ಕೊಪ್ಪ ಗ್ರಾಮ (Koppa)', count: 1, pct: 20, color: 'bg-teal-500' },
                { village: 'ಬೆಸಗರಹಳ್ಳಿ (Besagarahalli)', count: 1, pct: 20, color: 'bg-amber-500' },
                { village: 'ಆತಗೂರು (Athagur)', count: 1, pct: 20, color: 'bg-rose-500' },
              ].map((item) => (
                <div key={item.village} className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center justify-between">
                  <span className="font-medium text-slate-800">{item.village}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-mono font-bold text-slate-700">{item.count} ಅರ್ಜಿಗಳು</span>
                    <span className={`w-2 h-2 rounded-full ${item.color}`}></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Verification turnaround metrics */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                <TrendingUp className="w-4 h-4 text-saathi-700" />
                <span>ದಕ್ಷತೆ ಮತ್ತು ಎಸ್‌ಎಲ್‌ಎ (SLA Metrics)</span>
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-[11px] text-emerald-800 font-semibold">ಸರಾಸರಿ ವಿಲೇವಾರಿ ಸಮಯ</p>
                <p className="text-xl font-extrabold text-emerald-950 font-mono mt-0.5">18.5 ಗಂಟೆಗಳು</p>
                <p className="text-[10px] text-emerald-700 mt-0.5">ಸರ್ಕಾರದ ನಿಗದಿತ 72 ಗಂಟೆಗಳ ಒಳಗಿದೆ (ಉತ್ತಮ)</p>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-[11px] text-blue-800 font-semibold">ಸ್ಥಳೀಯ OCR ಸ್ವಯಂಚಾಲಿತ ತಾಳೆ ದರ</p>
                <p className="text-xl font-extrabold text-blue-950 font-mono mt-0.5">94.2%</p>
                <p className="text-[10px] text-blue-700 mt-0.5">Tesseract & Bhoomi Schema Verification</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Applications Activity Queue */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-sm text-slate-900">
                ಇತ್ತೀಚಿನ ಅರ್ಜಿಗಳ ಪರಿಶೀಲನಾ ಪಟ್ಟಿ (Recent Applications Queue)
              </h2>
              <p className="text-xs text-slate-500">
                ನಾಗರಿಕರಿಂದ ನೇರವಾಗಿ ವಾಟ್ಸಾಪ್ ಮತ್ತು PWA ಮೂಲಕ ಸಲ್ಲಿಕೆಯಾಗಿರುವ ಅರ್ಜಿಗಳು
              </p>
            </div>
            <Link
              to="/officer/applications"
              className="text-xs font-bold text-saathi-700 hover:text-saathi-800 flex items-center space-x-1"
            >
              <span>ಎಲ್ಲವನ್ನೂ ವೀಕ್ಷಿಸಿ</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">ಉಲ್ಲೇಖ ಸಂಖ್ಯೆ (Ref)</th>
                  <th className="px-4 py-3">ಅರ್ಜಿದಾರರ ಹೆಸರು</th>
                  <th className="px-4 py-3">ಯೋಜನೆ (Scheme)</th>
                  <th className="px-4 py-3">ಗ್ರಾಮ / ವ್ಯಾಪ್ತಿ</th>
                  <th className="px-4 py-3">ಸ್ಥಿತಿ (Status)</th>
                  <th className="px-4 py-3 text-right">ಕ್ರಮ (Action)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentApplications.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      {app.application_reference}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{app.applicant.full_name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{app.applicant.phone_masked}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-800">{app.scheme_name}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {app.applicant.village}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={app.status} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/officer/applications/${app.id}`}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold px-2.5 py-1.5 rounded-lg transition-all inline-flex items-center space-x-1"
                      >
                        <span>ಪರಿಶೀಲಿಸಿ</span>
                        <ArrowRight className="w-3 h-3 text-slate-500" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </OfficerLayout>
  );
};
