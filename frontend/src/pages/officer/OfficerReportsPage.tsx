import React, { useState } from 'react';
import { OfficerLayout } from '../../components/officer/OfficerLayout';
import { 
  BarChart3, 
  Download, 
  FileSpreadsheet, 
  Filter, 
  Calendar, 
  CheckCircle2, 
  Landmark, 
  Users, 
  PieChart 
} from 'lucide-react';

export const OfficerReportsPage: React.FC = () => {
  const [selectedScheme, setSelectedScheme] = useState('ALL');
  const [dateRange, setDateRange] = useState('MONTH');
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const handleExport = (format: 'CSV' | 'PDF') => {
    setExportNotice(`${format} ವರದಿಯನ್ನು ಯಶಸ್ವಿಯಾಗಿ ರಚಿಸಲಾಗಿದೆ. ಡೌನ್‌ಲೋಡ್ ಪ್ರಾರಂಭವಾಗಿದೆ...`);
    setTimeout(() => {
      setExportNotice(null);
    }, 4000);
  };

  return (
    <OfficerLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              ಸರ್ಕಾರಿ ಸೇವೆಗಳ ಪ್ರಗತಿ ವರದಿಗಳು (Analytics & Reports)
            </h1>
            <p className="text-xs text-slate-500">
              ಮಂಡ್ಯ ಜಿಲ್ಲಾ ಮಟ್ಟದ ಮತ್ತು ತಾಲೂಕು ಮಟ್ಟದ ಯೋಜನೆಗಳ ಅನುಷ್ಠಾನ ದತ್ತಾಂಶ
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleExport('CSV')}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs py-2 px-3 rounded-lg flex items-center space-x-1.5 shadow-sm transition-all"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>CSV ರಫ್ತು (Export)</span>
            </button>

            <button
              onClick={() => handleExport('PDF')}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center space-x-1.5 shadow-sm transition-all"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>PDF ವರದಿ</span>
            </button>
          </div>
        </div>

        {/* Export Toast Banner */}
        {exportNotice && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-xs text-emerald-950 flex items-center space-x-2 animate-fade-in shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">{exportNotice}</span>
          </div>
        )}

        {/* Filter Bar */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-xs">
            <span className="font-bold text-slate-700 flex items-center space-x-1">
              <Filter className="w-3.5 h-3.5" />
              <span>ಯೋಜನೆ ಆಯ್ಕೆ:</span>
            </span>
            <select
              value={selectedScheme}
              onChange={(e) => setSelectedScheme(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none bg-slate-50 font-medium"
            >
              <option value="ALL">ಎಲ್ಲಾ ಯೋಜನೆಗಳು (All Schemes)</option>
              <option value="PM_KISAN">PM Kisan Samman Nidhi</option>
              <option value="NSP">NSP Post-Matric Scholarship</option>
              <option value="RAITHA_SIRI">Raitha Siri Millet Incentive</option>
              <option value="GRUHA_LAKSHMI">Gruha Lakshmi Direct DBT</option>
            </select>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="font-bold text-slate-700 flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>ಅವಧಿ (Period):</span>
            </span>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none bg-slate-50 font-medium"
            >
              <option value="WEEK">ಈ ವಾರ (Last 7 Days)</option>
              <option value="MONTH">ಈ ತಿಂಗಳು (Current Month)</option>
              <option value="QUARTER">ಪ್ರಸ್ತುತ ತ್ರೈಮಾಸಿಕ (Q4)</option>
              <option value="YEAR">ವಾರ್ಷಿಕ (Financial Year 2026)</option>
            </select>
          </div>
        </div>

        {/* High-Level Overview Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
              <span>ಒಟ್ಟು ನೇರ ನಗದು ವರ್ಗಾವಣೆ (DBT)</span>
              <Landmark className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 font-mono">₹24,80,000</p>
            <p className="text-xs text-emerald-700 font-semibold">
              ಅರ್ಹ ಫಲಾನುಭವಿಗಳ ಖಾತೆಗೆ ನೇರ ಪಾವತಿ
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
              <span>ಒಟ್ಟು ನೋಂದಾಯಿತ ಗ್ರಾಮೀಣ ಕುಟುಂಬಗಳು</span>
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 font-mono">1,420</p>
            <p className="text-xs text-blue-700 font-semibold">
              ಮದ್ದೂರು ಮತ್ತು ಸುತ್ತಮುತ್ತಲಿನ 18 ಗ್ರಾಮಗಳು
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
              <span>ಸ್ಥಳೀಯ AI & OCR ನಿಖರತೆ</span>
              <PieChart className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 font-mono">96.8%</p>
            <p className="text-xs text-purple-700 font-semibold">
              ಖಾಸಗಿ Tesseract ಎಂಜಿನ್ (ಶೂನ್ಯ ಡೇಟಾ ಸೋರಿಕೆ)
            </p>
          </div>
        </div>

        {/* Detailed Scheme Disbursement Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h2 className="font-bold text-sm text-slate-900">
              ಯೋಜನೆವಾರು ವಿಲೇವಾರಿ ವರದಿ (Scheme Performance Breakdown)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">ಯೋಜನೆ</th>
                  <th className="px-4 py-3">ಸ್ವೀಕೃತ ಅರ್ಜಿಗಳು</th>
                  <th className="px-4 py-3">ಅನುಮೋದಿತ</th>
                  <th className="px-4 py-3">ತಿರಸ್ಕೃತ</th>
                  <th className="px-4 py-3">ಅನುಮೋದನೆ ದರ</th>
                  <th className="px-4 py-3 text-right">ವಿತರಿಸಲಾದ ಮೊತ್ತ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  {
                    name: 'PM Kisan Samman Nidhi',
                    received: 840,
                    approved: 790,
                    rejected: 50,
                    rate: '94%',
                    disbursed: '₹15,80,000',
                  },
                  {
                    name: 'NSP Post-Matric Scholarship',
                    received: 310,
                    approved: 285,
                    rejected: 25,
                    rate: '92%',
                    disbursed: '₹5,70,000',
                  },
                  {
                    name: 'Gruha Lakshmi Direct Transfer',
                    received: 190,
                    approved: 180,
                    rejected: 10,
                    rate: '95%',
                    disbursed: '₹3,60,000',
                  },
                  {
                    name: 'Raitha Siri Millet Scheme',
                    received: 80,
                    approved: 65,
                    rejected: 15,
                    rate: '81%',
                    disbursed: '₹6,50,000',
                  },
                ].map((row) => (
                  <tr key={row.name} className="hover:bg-slate-50">
                    <td className="px-4 py-3.5 font-bold text-slate-900">{row.name}</td>
                    <td className="px-4 py-3.5 font-mono">{row.received}</td>
                    <td className="px-4 py-3.5 font-mono text-emerald-700 font-bold">{row.approved}</td>
                    <td className="px-4 py-3.5 font-mono text-rose-700">{row.rejected}</td>
                    <td className="px-4 py-3.5 font-bold">{row.rate}</td>
                    <td className="px-4 py-3.5 font-mono text-right font-extrabold text-slate-900">
                      {row.disbursed}
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
