import React from 'react';
import { X, Printer, Download, Landmark, ShieldCheck } from 'lucide-react';

interface ApplicationPDFViewerProps {
  referenceNumber: string;
  onClose: () => void;
  applicantName?: string;
  schemeName?: string;
}

export const ApplicationPDFViewer: React.FC<ApplicationPDFViewerProps> = ({
  referenceNumber,
  onClose,
  applicantName = 'Ramu Nayak (ರಾಮು ನಾಯಕ್)',
  schemeName = 'PM Kisan Samman Nidhi (ಪ್ರಧಾನ ಮಂತ್ರಿ ಕಿಸಾನ್)',
}) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-300 overflow-hidden">
        {/* Top Control Bar */}
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between print:hidden">
          <div className="flex items-center space-x-2">
            <Printer className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-xs">
              ಅಧಿಕೃತ ಅರ್ಜಿ ಸಾರಾಂಶ PDF (Official Application Document)
            </h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded flex items-center space-x-1 shadow transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>ಮುದ್ರಿಸಿ (Print)</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* The Printable Official PDF Sheet */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-slate-900 font-sans bg-white print:p-0 print:m-0">
          {/* Header */}
          <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
            <div className="w-12 h-12 mx-auto rounded-full border-2 border-slate-900 flex items-center justify-center mb-1">
              <Landmark className="w-7 h-7 text-slate-800" />
            </div>
            <p className="text-[11px] font-bold tracking-widest text-slate-600 uppercase">
              GOVERNMENT OF KARNATAKA • ಪಂಚಾಯತ್ ರಾಜ್ & ಕೃಷಿ ಇಲಾಖೆ
            </p>
            <h1 className="text-base sm:text-lg font-extrabold tracking-tight">
              ಗ್ರಾಮೀಣ ನಾಗರಿಕ ಕಲ್ಯಾಣ ಯೋಜನೆ ಅಧಿಕೃತ ಅರ್ಜಿ ಸಾರಾಂಶ
            </h1>
            <p className="text-xs text-slate-500 font-serif">
              Form GS-A1 (Generated under Gram Saathi Platform)
            </p>
          </div>

          {/* Reference & Barcode Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-50 border border-slate-300 p-3 rounded">
            <div>
              <p className="text-[11px] text-slate-500 font-semibold uppercase">
                ಅರ್ಜಿ ಉಲ್ಲೇಖ ಸಂಖ್ಯೆ (Application Reference):
              </p>
              <p className="text-base font-extrabold font-mono text-slate-950">
                {referenceNumber}
              </p>
            </div>
            <div className="text-center sm:text-right mt-2 sm:mt-0">
              <div className="font-mono text-xs tracking-widest bg-white px-2 py-1 border border-slate-300 inline-block font-bold">
                ||| | |||| | ||||| || |||
              </div>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                SUBMISSION: {new Date().toISOString().split('T')[0]}
              </p>
            </div>
          </div>

          {/* Scheme Details Table */}
          <div className="space-y-1.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-2 py-1 border-l-4 border-slate-800">
              1. ಯೋಜನೆಯ ವಿವರಗಳು (Scheme Information)
            </h2>
            <table className="w-full text-xs border border-slate-300 border-collapse">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="p-2 bg-slate-50 font-semibold w-1/3">ಯೋಜನೆಯ ಹೆಸರು:</td>
                  <td className="p-2 font-bold">{schemeName}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="p-2 bg-slate-50 font-semibold">ಇಲಾಖೆ:</td>
                  <td className="p-2">ಕೃಷಿ ಮತ್ತು ರೈತರ ಕಲ್ಯಾಣ ಇಲಾಖೆ (Dept of Agriculture)</td>
                </tr>
                <tr>
                  <td className="p-2 bg-slate-50 font-semibold">ಮಂಜೂರಾಗುವ ಆರ್ಥಿಕ ನೆರವು:</td>
                  <td className="p-2 text-emerald-800 font-bold">₹6,000 / ವರ್ಷಕ್ಕೆ (DBT ಮೂಲಕ)</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Applicant Profile */}
          <div className="space-y-1.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-2 py-1 border-l-4 border-slate-800">
              2. ಅರ್ಜಿದಾರರ ಮಾಹಿತಿ (Applicant Details)
            </h2>
            <table className="w-full text-xs border border-slate-300 border-collapse">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="p-2 bg-slate-50 font-semibold w-1/3">ಅರ್ಜಿದಾರರ ಪೂರ್ಣ ಹೆಸರು:</td>
                  <td className="p-2 font-bold">{applicantName}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="p-2 bg-slate-50 font-semibold">ಆಧಾರ್ ಸಂಖ್ಯೆ (ಮರೆಮಾಚಲಾಗಿದೆ):</td>
                  <td className="p-2 font-mono">XXXX-XXXX-8912</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="p-2 bg-slate-50 font-semibold">ಗ್ರಾಮ ಮತ್ತು ತಾಲೂಕು:</td>
                  <td className="p-2">ಮದ್ದೂರು (Maddur), ಮಂಡ್ಯ ಜಿಲ್ಲೆ</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="p-2 bg-slate-50 font-semibold">ಕೃಷಿ ಭೂಮಿ ವಿಸ್ತೀರ್ಣ:</td>
                  <td className="p-2">1.5 ಎಕರೆ (ಸರ್ವೆ ಸಂಖ್ಯೆ: 142/3A)</td>
                </tr>
                <tr>
                  <td className="p-2 bg-slate-50 font-semibold">ಆಧಾರ್ ಸಕ್ರಿಯ ಬ್ಯಾಂಕ್ ಖಾತೆ:</td>
                  <td className="p-2 text-emerald-800 font-semibold">ದೃಢೀಕರಿಸಲಾಗಿದೆ (Active)</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Local OCR & Verification Checklist */}
          <div className="space-y-1.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-2 py-1 border-l-4 border-slate-800">
              3. ಪರಿಶೀಲಿಸಲಾದ ದಾಖಲೆಗಳು (Verified Documents)
            </h2>
            <div className="border border-slate-300 rounded p-2.5 text-xs space-y-1 bg-slate-50 font-mono">
              <div className="flex justify-between">
                <span>[✓] Aadhaar Card Front (Tesseract Match: 96%)</span>
                <span className="text-emerald-700 font-bold">VERIFIED</span>
              </div>
              <div className="flex justify-between">
                <span>[✓] RTC Pahani Land Record (1.5 Acres, Maddur)</span>
                <span className="text-emerald-700 font-bold">VERIFIED</span>
              </div>
            </div>
          </div>

          {/* Signatures & Seal */}
          <div className="pt-6 border-t border-slate-300 grid grid-cols-2 gap-8 text-xs text-center">
            <div className="space-y-8">
              <p className="font-semibold text-slate-600">ಅರ್ಜಿದಾರರ ಡಿಜಿಟಲ್ ದೃಢೀಕರಣ</p>
              <div>
                <p className="font-bold border-t border-slate-400 pt-1 inline-block px-4">
                  {applicantName}
                </p>
                <p className="text-[10px] text-slate-500">
                  Single-Use Token Verified
                </p>
              </div>
            </div>
            <div className="space-y-8">
              <p className="font-semibold text-slate-600">ಅಧಿಕಾರಿಗಳ ಪರಿಶೀಲನಾ ಮುದ್ರೆ</p>
              <div>
                <div className="w-14 h-14 border border-dashed border-slate-400 rounded-full mx-auto flex items-center justify-center text-[9px] text-slate-400 uppercase">
                  OFFICIAL SEAL
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Panchayat Development Office
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
