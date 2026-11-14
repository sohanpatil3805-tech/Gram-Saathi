import React, { useState } from 'react';
import { DocumentTypeCode, DocumentVerificationResult } from '../../types/api';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../services/api';
import { 
  X, 
  Upload, 
  Camera, 
  FileText, 
  ShieldCheck, 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles,
  RefreshCw
} from 'lucide-react';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDocumentProcessed: (result: DocumentVerificationResult) => void;
  defaultDocType?: DocumentTypeCode;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  onDocumentProcessed,
  defaultDocType = 'AADHAAR',
}) => {
  const { t } = useLanguage();
  const [docType, setDocType] = useState<DocumentTypeCode>(defaultDocType);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [previewResult, setPreviewResult] = useState<DocumentVerificationResult | null>(null);

  if (!isOpen) return null;

  const runOCRSimulation = async (sampleKey: 'valid_aadhaar' | 'valid_land_record' | 'blurry_document' | 'valid_student_id') => {
    setIsProcessing(true);
    setPreviewResult(null);

    // Step 1: Secure upload
    setProcessingStep('ಖಾಸಗಿ UUID ಸಂಗ್ರಹಣೆಯಲ್ಲಿ ಫೈಲ್ ಸಂಗ್ರಹಿಸಲಾಗುತ್ತಿದೆ...');
    await new Promise((r) => setTimeout(r, 400));

    // Step 2: Local OCR Pre-processing
    setProcessingStep('Pillow ಇಮೇಜ್ ಫಿಲ್ಟರಿಂಗ್ & ಕಾಂಟ್ರಾಸ್ಟ್ ಹೊಂದಾಣಿಕೆ...');
    await new Promise((r) => setTimeout(r, 400));

    // Step 3: Tesseract engine
    setProcessingStep('ಸ್ಥಳೀಯ Tesseract OCR ಎಂಜಿನ್ ಮೂಲಕ ಪಠ್ಯ ಹೊರತೆಗೆಯಲಾಗುತ್ತಿದೆ...');
    await new Promise((r) => setTimeout(r, 600));

    try {
      const res = await api.uploadDocument('simulated_file', docType, sampleKey);
      setPreviewResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  const handleFinish = () => {
    if (previewResult) {
      onDocumentProcessed(previewResult);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-modal overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-whatsapp-teal text-white px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Upload className="w-5 h-5 text-emerald-300" />
            <div>
              <h2 className="font-bold text-sm leading-tight">
                {t('uploadDocumentTitle')}
              </h2>
              <p className="text-[11px] text-emerald-100">
                ಸ್ಥಳೀಯ Tesseract OCR ಎಂಜಿನ್ • ಖಾಸಗಿ ಭದ್ರತೆ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-4">
          {/* Document Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t('selectDocType')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'AADHAAR', label: t('studentAadhaar') || t('aadhaarCard') },
                { id: 'CASTE_CERT', label: t('casteCert') },
                { id: 'INCOME_CERT', label: t('incomeCert') },
                { id: 'MARKS_CARD', label: t('marksCard') },
                { id: 'BANK_PASSBOOK', label: t('bankPassbook') },
                { id: 'LAND_RECORD', label: t('landRecord') },
                { id: 'STUDENT_ID', label: t('studentId') },
              ].map((dt) => (
                <button
                  key={dt.id}
                  type="button"
                  onClick={() => setDocType(dt.id as any)}
                  className={`text-xs p-2 rounded-lg border font-medium text-left transition-all ${
                    docType === dt.id
                      ? 'bg-saathi-50 border-saathi-600 text-saathi-900 ring-2 ring-saathi-500/20'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {dt.label}
                </button>
              ))}
            </div>
          </div>

          {!previewResult && !isProcessing && (
            <>
              {/* Quick Sample Document Picker for Hackathon Demo */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>{t('chooseSampleDoc')}</span>
                </p>
                <div className="space-y-1.5">
                  <button
                    onClick={() => runOCRSimulation('valid_aadhaar')}
                    className="w-full text-left text-xs bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 p-2.5 rounded-lg flex items-center justify-between transition-all"
                  >
                    <div>
                      <p className="font-semibold text-slate-800">
                        {t('sampleAadhaar')}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        ಆಧಾರ್ ಸಂಖ್ಯೆ ಮರೆಮಾಚಲಾಗಿದೆ (XXXX-XXXX-8912)
                      </p>
                    </div>
                    <span className="text-[11px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                      ಸರಿಯಾದ ಮಾದರಿ
                    </span>
                  </button>

                  <button
                    onClick={() => runOCRSimulation('valid_land_record')}
                    className="w-full text-left text-xs bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 p-2.5 rounded-lg flex items-center justify-between transition-all"
                  >
                    <div>
                      <p className="font-semibold text-slate-800">
                        {t('sampleLandRecord')}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        ಸರ್ವೆ ನಂ: 142/3A, ಮದ್ದೂರು ತಾಲೂಕು
                      </p>
                    </div>
                    <span className="text-[11px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                      RTC ಮಾದರಿ
                    </span>
                  </button>

                  <button
                    onClick={() => runOCRSimulation('blurry_document')}
                    className="w-full text-left text-xs bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 p-2.5 rounded-lg flex items-center justify-between transition-all"
                  >
                    <div>
                      <p className="font-semibold text-slate-800">
                        {t('sampleBlurryDoc')}
                      </p>
                      <p className="text-[11px] text-amber-700">
                        ಮಸುಕಾದ ಫೋಟೋ (ಸ್ವಯಂಚಾಲಿತ ತಿದ್ದುಪಡಿ ಪ್ರಾಂಪ್ಟ್ ಪರೀಕ್ಷೆ)
                      </p>
                    </div>
                    <span className="text-[11px] text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded">
                      ದೋಷ ಪರೀಕ್ಷೆ
                    </span>
                  </button>
                </div>
              </div>

              {/* Real Camera & File options */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={() => runOCRSimulation('valid_aadhaar')}
                  className="p-3 border-2 border-dashed border-slate-300 hover:border-whatsapp-teal rounded-xl flex flex-col items-center justify-center space-y-1.5 text-slate-700 hover:text-whatsapp-teal transition-all"
                >
                  <Camera className="w-6 h-6 text-slate-500" />
                  <span className="text-xs font-semibold">{t('takePhoto')}</span>
                </button>
                <button
                  onClick={() => runOCRSimulation('valid_land_record')}
                  className="p-3 border-2 border-dashed border-slate-300 hover:border-whatsapp-teal rounded-xl flex flex-col items-center justify-center space-y-1.5 text-slate-700 hover:text-whatsapp-teal transition-all"
                >
                  <Upload className="w-6 h-6 text-slate-500" />
                  <span className="text-xs font-semibold">{t('uploadFile')}</span>
                </button>
              </div>

              {/* Privacy Directive Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex items-start space-x-2 text-[11px] text-slate-600">
                <ShieldCheck className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
                <p>
                  <strong>ಖಾಸಗಿತನ ಭದ್ರತೆ:</strong> ಕಚ್ಚಾ ದಾಖಲೆಗಳನ್ನು ಬಾಹ್ಯ AI API ಗಳಿಗೆ ಕಳುಹಿಸಲಾಗುವುದಿಲ್ಲ. ಸ್ಥಳೀಯ Tesseract ಎಂಜಿನ್ ಮೂಲಕ ಮಾತ್ರ ಪರಿಶೀಲಿಸಲಾಗುತ್ತದೆ.
                </p>
              </div>
            </>
          )}

          {/* Processing Animation */}
          {isProcessing && (
            <div className="py-8 text-center space-y-3">
              <div className="inline-flex p-3 rounded-full bg-saathi-100 text-saathi-700 animate-pulse">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <h3 className="font-bold text-sm text-slate-800">
                {t('analyzingOCR')}
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto animate-fade-in font-mono">
                {processingStep}
              </p>
            </div>
          )}

          {/* Result Preview Screen */}
          {previewResult && !isProcessing && (
            <div className="space-y-3 animate-fade-in">
              <div
                className={`p-3.5 rounded-xl border ${
                  previewResult.validation_status === 'VALID'
                    ? 'bg-emerald-50 border-emerald-300'
                    : 'bg-amber-50 border-amber-300'
                }`}
              >
                <div className="flex items-center space-x-2 mb-2">
                  {previewResult.validation_status === 'VALID' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  )}
                  <h4 className="font-bold text-xs">
                    {previewResult.validation_status === 'VALID'
                      ? t('ocrSuccess')
                      : t('ocrWarningBlurry')}
                  </h4>
                </div>

                <div className="text-xs space-y-1 bg-white/80 p-2.5 rounded-lg border border-slate-200/60 font-mono">
                  <p className="text-[11px] text-slate-500 font-sans font-bold">
                    {t('extractedInfo')}
                  </p>
                  {Object.entries(previewResult.extracted_fields).map(([k, v]) => (
                    <div key={k} className="flex justify-between py-0.5 border-b border-slate-100 last:border-0">
                      <span className="text-slate-500 capitalize">{k.replace(/_/g, ' ')}:</span>
                      <span className="font-semibold text-slate-900">{String(v ?? 'N/A')}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-1 font-sans text-emerald-800 font-bold">
                    <span>Tesseract ವಿಶ್ವಾಸಾರ್ಹತೆ:</span>
                    <span>{previewResult.confidence_score}%</span>
                  </div>
                </div>

                {previewResult.validation_status === 'NEEDS_CORRECTION' && (
                  <button
                    onClick={() => setPreviewResult(null)}
                    className="mt-2.5 w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2 rounded-lg flex items-center justify-center space-x-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{t('reuploadBtn')}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-3 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-2"
          >
            {t('cancel')}
          </button>
          {previewResult && previewResult.validation_status === 'VALID' && (
            <button
              onClick={handleFinish}
              className="bg-whatsapp-teal hover:bg-whatsapp-darkTeal text-white text-xs font-semibold px-4 py-2 rounded-lg shadow flex items-center space-x-1.5 transition-all"
            >
              <span>{t('confirm')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
