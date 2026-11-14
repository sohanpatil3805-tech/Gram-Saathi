import React, { useState, useRef, useEffect, useMemo } from 'react';
import { DocumentTypeCode, DocumentAttachment, BackendScheme, DiscoveredScheme } from '../../types/api';
import { useLanguage } from '../../context/LanguageContext';
import { api, getCurrentCitizenId, getSavedCitizenProfile } from '../../services/api';
import { 
  Upload, 
  Camera, 
  FileText, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  ShieldCheck, 
  Edit3, 
  FileCheck, 
  Sparkles,
  Clock,
  Loader2,
  FileCheck2,
  Plus,
  Copy,
  Check,
  Eye,
  ChevronDown,
  ChevronUp,
  UserCheck
} from 'lucide-react';

interface DocumentUploadInterfaceProps {
  initialAttachments?: DocumentAttachment[];
  onAttachmentsChange?: (attachments: DocumentAttachment[]) => void;
  requiredDocumentTypes?: Array<any>;
  selectedScheme?: BackendScheme | DiscoveredScheme | null;
  onSelectScheme?: (scheme: BackendScheme | DiscoveredScheme) => void;
  availableSchemes?: Array<BackendScheme | DiscoveredScheme>;
  citizenId?: string;
  applicationId?: string;
  onSelectApplicationId?: (appId: string) => void;
}

const mapItemToDocType = (item: any): DocumentTypeCode => {
  if (!item) return 'OTHER';
  const rawCode = (
    item.document_type_code ||
    item.document_type ||
    item.doc_type ||
    (typeof item === 'string' ? item : '')
  ).toUpperCase();

  if (['AADHAAR', 'LAND_RECORD', 'INCOME_CERT', 'STUDENT_ID', 'BANK_PASSBOOK', 'RATION_CARD', 'CASTE_CERT', 'MARKS_CARD'].includes(rawCode)) {
    return rawCode as DocumentTypeCode;
  }
  if (rawCode === 'CASTE_CERTIFICATE') return 'CASTE_CERT';
  if (rawCode === 'INCOME_CERTIFICATE') return 'INCOME_CERT';
  if (rawCode === 'COLLEGE_ID') return 'STUDENT_ID';
  if (rawCode === 'STUDENT_AADHAAR') return 'AADHAAR';

  const text = `${typeof item === 'string' ? item : ''} ${item.name || ''} ${item.item || ''} ${item.label_en || ''} ${item.instructions || ''}`.toLowerCase();

  // 1. Caste certificate (must come before general checks)
  if (text.includes('caste') || text.includes('community') || text.includes('rd number') || text.includes('ಜಾತಿ') || text.includes('जाति')) {
    if (text.includes('income') && !text.includes('caste') && !text.includes('community') && !text.includes('ಜಾತಿ') && !text.includes('जाति')) {
      return 'INCOME_CERT';
    }
    return 'CASTE_CERT';
  }

  // 2. Marks card / Educational records
  if (text.includes('marks') || text.includes('mark sheet') || text.includes('score') || text.includes('grade') || text.includes('transcript') || text.includes('ಅಂಕಪಟ್ಟಿ') || text.includes('अंकतालिका')) {
    return 'MARKS_CARD';
  }

  // 3. Aadhaar / Identity proof (matches "Student Aadhaar Card" as AADHAAR)
  if (text.includes('aadhaar') || text.includes('aadhar') || text.includes('uid') || text.includes('ಆಧಾರ್') || text.includes('आधार')) {
    return 'AADHAAR';
  }

  // 4. Income certificate
  if (text.includes('income') || text.includes('salary') || text.includes('ಆದಾಯ') || text.includes('आय')) {
    return 'INCOME_CERT';
  }

  // 5. Land record / RTC / Pahani
  if (text.includes('land') || text.includes('rtc') || text.includes('pahani') || text.includes('holding') || text.includes('cultivat') || text.includes('ಭೂ') || text.includes('ಪಹಣಿ')) {
    return 'LAND_RECORD';
  }

  // 6. Bank passbook / Cheque
  if (text.includes('bank') || text.includes('passbook') || text.includes('account') || text.includes('cheque') || text.includes('ಬ್ಯಾಂಕ್') || text.includes('बैंक')) {
    return 'BANK_PASSBOOK';
  }

  // 7. Student ID / College ID / Admission letter
  if (text.includes('student') || text.includes('college') || text.includes('id card') || text.includes('admission') || text.includes('bonafide') || text.includes('ವಿದ್ಯಾರ್ಥಿ')) {
    return 'STUDENT_ID';
  }

  // 8. Ration card / BPL
  if (text.includes('ration') || text.includes('bpl') || text.includes('ಪಡಿತರ') || text.includes('राशन')) {
    return 'RATION_CARD';
  }

  const customSlug = (item.doc_type || item.item || item.name || (typeof item === 'string' ? item : 'OTHER'))
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')
    .slice(0, 30);
  return customSlug || 'OTHER';
};

export const DocumentUploadInterface: React.FC<DocumentUploadInterfaceProps> = ({
  initialAttachments = [],
  onAttachmentsChange,
  requiredDocumentTypes,
  selectedScheme,
  onSelectScheme,
  availableSchemes = [],
  citizenId,
  applicationId,
  onSelectApplicationId,
}) => {
  const { t, language } = useLanguage();
  const [attachments, setAttachments] = useState<DocumentAttachment[]>(initialAttachments);

  // Active scheme state (allows citizen to change scheme directly in upload view)
  const [activeScheme, setActiveScheme] = useState<(BackendScheme | DiscoveredScheme) | null>(
    selectedScheme || (availableSchemes.length > 0 ? availableSchemes[0] : null)
  );

  useEffect(() => {
    if (selectedScheme) {
      setActiveScheme(selectedScheme);
    }
  }, [selectedScheme]);

  // Citizen & Application identifiers
  const [currentCitizenId, setCurrentCitizenIdState] = useState<string>(() => {
    return citizenId || getCurrentCitizenId() || getSavedCitizenProfile()?.id || '';
  });

  const [currentApplicationId, setCurrentApplicationId] = useState<string>(applicationId || '');
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const [copiedAppId, setCopiedAppId] = useState(false);

  useEffect(() => {
    if (citizenId) {
      setCurrentCitizenIdState(citizenId);
    } else {
      const cid = getCurrentCitizenId() || getSavedCitizenProfile()?.id;
      if (cid) setCurrentCitizenIdState(cid);
    }
  }, [citizenId]);

  useEffect(() => {
    if (applicationId) {
      setCurrentApplicationId(applicationId);
    }
  }, [applicationId]);

  // Compute scheme-specific document types
  const rawRequirements = useMemo(() => {
    return (
      (activeScheme as any)?.required_documents ||
      (activeScheme as any)?.document_requirements ||
      requiredDocumentTypes ||
      []
    );
  }, [activeScheme, requiredDocumentTypes]);

  const availableDocTypes = useMemo<DocumentTypeCode[]>(() => {
    if (!rawRequirements || rawRequirements.length === 0) {
      return ['LAND_RECORD', 'AADHAAR', 'CASTE_CERT', 'INCOME_CERT', 'MARKS_CARD', 'STUDENT_ID', 'BANK_PASSBOOK', 'RATION_CARD'];
    }

    const matched: DocumentTypeCode[] = [];
    for (const item of rawRequirements) {
      const type = mapItemToDocType(item);
      if (type && !matched.includes(type)) {
        matched.push(type);
      }
    }

    if (matched.length === 0) {
      return ['LAND_RECORD', 'AADHAAR'];
    }
    return matched;
  }, [rawRequirements]);

  const [selectedDocType, setSelectedDocType] = useState<DocumentTypeCode>(() => availableDocTypes[0] || 'LAND_RECORD');
  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uploadSuccessBanner, setUploadSuccessBanner] = useState<string | null>(null);
  const [activeEditingId, setActiveEditingId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingDocType, setUploadingDocType] = useState<DocumentTypeCode | null>(null);
  const [expandedOcrTextAttId, setExpandedOcrTextAttId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (availableDocTypes.length > 0 && !availableDocTypes.includes(selectedDocType)) {
      setSelectedDocType(availableDocTypes[0]);
    }
  }, [availableDocTypes, selectedDocType]);

  useEffect(() => {
    if (onAttachmentsChange) {
      onAttachmentsChange(attachments);
    }
  }, [attachments]);

  const docTypeLabels: Record<string, string> = {
    AADHAAR: t('studentAadhaar') || t('aadhaarCard') || 'Aadhaar Card',
    CASTE_CERT: t('casteCert') || 'Caste Certificate (RD Number)',
    INCOME_CERT: t('incomeCert') || 'Income Certificate (RD Number)',
    MARKS_CARD: t('marksCard') || 'Previous Year Marks Card',
    BANK_PASSBOOK: t('bankPassbook') || 'Bank Passbook / Cancelled Cheque',
    LAND_RECORD: t('landRecord') || 'Land Record / RTC (Pahani)',
    STUDENT_ID: t('studentId') || 'Student ID / Admission Certificate',
    RATION_CARD: t('rationCard') || 'Ration Card (BPL / APL)',
  };

  // Helper to create an official application draft for linking
  const handleCreateDraft = async () => {
    if (!activeScheme) return;
    setIsCreatingDraft(true);
    setValidationError(null);
    try {
      let cid = currentCitizenId;
      if (!cid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cid)) {
        cid = await api.ensureValidCitizenId();
        setCurrentCitizenIdState(cid);
      }
      const isStudent = (activeScheme as any).target_group === 'students' ||
        (Array.isArray((activeScheme as any).beneficiary_groups) && (activeScheme as any).beneficiary_groups.includes('students')) ||
        ((activeScheme as any).category && (activeScheme as any).category.toLowerCase().includes('scholarship'));

      const draftRes = await api.createApplicationDraft({
        citizen_id: cid,
        scheme_id: (activeScheme as any).scheme_id || (activeScheme as any).id || 'PM_KISAN',
        applicant_data: {
          state: 'Karnataka',
          beneficiary_group: isStudent ? 'students' : ((activeScheme as any).target_group || 'farmers'),
          citizen_group: isStudent ? 'STUDENT' : 'FARMER',
          has_bank_account: true,
          ...(isStudent ? { education_level: 'Undergraduate Degree', caste_category: 'Category 2A' } : { land_holding_acres: 1.5, has_cultivable_land_record: true }),
        },
      });
      if (draftRes && draftRes.id) {
        setCurrentApplicationId(draftRes.id);
        if (onSelectApplicationId) {
          onSelectApplicationId(draftRes.id);
        }
      }
    } catch (err: any) {
      setValidationError(err?.message || 'Could not create application draft.');
    } finally {
      setIsCreatingDraft(false);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setValidationError(null);
    setUploadSuccessBanner(null);

    const file = files[0];

    // File validation: Size (max 5 MB)
    if (file.size > 5 * 1024 * 1024) {
      setValidationError(t('fileTooLargeError'));
      return;
    }

    // Format validation
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setValidationError(t('invalidFormatError'));
      return;
    }

    // Safe client preview URL
    const fileUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;

    // Begin upload progress
    setIsUploading(true);
    setUploadingDocType(selectedDocType);

    const tempId = `doc-${Date.now()}`;
    const initialAtt: DocumentAttachment = {
      id: tempId,
      documentType: selectedDocType,
      file,
      fileName: file.name,
      fileSize: file.size,
      fileUrl,
      uploadedAt: new Date().toISOString(),
      status: 'UPLOADING',
      citizenId: currentCitizenId || undefined,
      applicationId: currentApplicationId || undefined,
      extractedData: {
        'Full Name': '',
        'Document ID / Number': '',
        'Survey No. / Reference': '',
      },
      confirmedData: {
        'Full Name': '',
        'Document ID / Number': '',
        'Survey No. / Reference': '',
      },
      isConfirmedByUser: false,
      notes: t('uploadingDoc'),
    };

    // Add in UPLOADING state
    setAttachments((prev) => [initialAtt, ...prev.filter((a) => a.documentType !== selectedDocType)]);

    try {
      // Ensure valid citizen ID exists
      let cid = currentCitizenId;
      if (!cid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cid)) {
        cid = await api.ensureValidCitizenId();
        setCurrentCitizenIdState(cid);
      }

      // Execute genuine backend upload
      const uploadRes = await api.uploadDocumentToBackend(
        file,
        selectedDocType,
        cid,
        currentApplicationId || undefined
      );

      // SHOW "UPLOADED" ONLY AFTER VERIFIED BACKEND CONFIRMATION
      if (uploadRes.isBackendSupported && uploadRes.documentId) {
        const rawExtracted: Record<string, string> = {};
        if (uploadRes.extractedData && typeof uploadRes.extractedData === 'object') {
          for (const [k, v] of Object.entries(uploadRes.extractedData)) {
            if (v !== null && v !== undefined && v !== '') {
              rawExtracted[k] = String(v);
            }
          }
        }
        if (rawExtracted.name || rawExtracted.applicant_name || rawExtracted.owner_name || rawExtracted.student_name || rawExtracted.account_holder_name) {
          rawExtracted['Full Name'] = rawExtracted.name || rawExtracted.applicant_name || rawExtracted.owner_name || rawExtracted.student_name || rawExtracted.account_holder_name;
        }
        if (rawExtracted.aadhaar_number || rawExtracted.certificate_number || rawExtracted.student_id || rawExtracted.registration_number || rawExtracted.roll_number) {
          rawExtracted['Document ID / Number'] = rawExtracted.aadhaar_number || rawExtracted.certificate_number || rawExtracted.student_id || rawExtracted.registration_number || rawExtracted.roll_number;
        }
        if (rawExtracted.survey_number || rawExtracted.extent_acres) {
          rawExtracted['Survey No. / Reference'] = [
            rawExtracted.survey_number ? `Survey ${rawExtracted.survey_number}` : '',
            rawExtracted.extent_acres ? `${rawExtracted.extent_acres} Acres` : '',
          ].filter(Boolean).join(', ');
        } else if (rawExtracted.caste_category) {
          rawExtracted['Survey No. / Reference'] = `Category: ${rawExtracted.caste_category}`;
        } else if (rawExtracted.percentage || rawExtracted.marks_obtained) {
          rawExtracted['Survey No. / Reference'] = `Marks: ${rawExtracted.percentage || rawExtracted.marks_obtained}`;
        } else if (rawExtracted.bank_name) {
          rawExtracted['Survey No. / Reference'] = `Bank: ${rawExtracted.bank_name}${rawExtracted.branch_name ? ` (${rawExtracted.branch_name})` : ''}`;
        } else if (rawExtracted.annual_income) {
          rawExtracted['Survey No. / Reference'] = `Income: ₹${rawExtracted.annual_income}`;
        }
        if (!rawExtracted['Full Name']) rawExtracted['Full Name'] = '';
        if (!rawExtracted['Document ID / Number']) rawExtracted['Document ID / Number'] = '';
        if (!rawExtracted['Survey No. / Reference']) rawExtracted['Survey No. / Reference'] = '';

        const confirmedInit = uploadRes.confirmedFields && Object.keys(uploadRes.confirmedFields).length > 0
          ? { ...uploadRes.confirmedFields }
          : { ...rawExtracted };

        const lowConf: string[] = [];
        if (uploadRes.confidence !== undefined && uploadRes.confidence < 0.6) {
          lowConf.push('General Quality');
        }
        for (const [k, v] of Object.entries(rawExtracted)) {
          if (!v || v.trim() === '') {
            lowConf.push(k);
          }
        }

        setAttachments((prev) =>
          prev.map((a) =>
            a.id === tempId
              ? {
                  ...a,
                  id: uploadRes.documentId || a.id,
                  status: 'UPLOADED',
                  backendDocId: uploadRes.documentId,
                  citizenId: uploadRes.citizenId || cid,
                  applicationId: uploadRes.applicationId || currentApplicationId || undefined,
                  extractedData: rawExtracted,
                  confirmedData: confirmedInit,
                  confidence: uploadRes.confidence,
                  lowConfidenceFields: lowConf,
                  isConfirmedByUser: Boolean(uploadRes.isConfirmed),
                  ocrStatus: uploadRes.ocrStatus,
                  ocrText: uploadRes.ocrText,
                  notes: 'Verified via secure backend upload endpoint.',
                }
              : a
          )
        );
        setUploadSuccessBanner(`${docTypeLabels[selectedDocType]}: ${t('uploadSuccessNotice')}`);
        setActiveEditingId(tempId);
      } else {
        // Backend confirmation failed — DO NOT MARK AS UPLOADED
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === tempId
              ? {
                  ...a,
                  status: 'FAILED_TO_UPLOAD',
                  notes: uploadRes.error || 'Backend confirmation failed.',
                }
              : a
          )
        );
        setValidationError(`${docTypeLabels[selectedDocType]}: ${t('uploadFailed')}`);
      }
    } catch (err: any) {
      setAttachments((prev) =>
        prev.map((a) =>
          a.id === tempId
            ? {
                ...a,
                status: 'FAILED_TO_UPLOAD',
                notes: err?.message || 'Upload failed.',
              }
            : a
        )
      );
      setValidationError(`${docTypeLabels[selectedDocType]}: ${t('uploadFailed')}`);
    } finally {
      setIsUploading(false);
      setUploadingDocType(null);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    if (activeEditingId === id) {
      setActiveEditingId(null);
    }
  };

  const updateConfirmedData = (id: string, key: string, value: string) => {
    setAttachments((prev) =>
      prev.map((att) => {
        if (att.id === id) {
          const updated = { ...att.confirmedData, [key]: value };
          return { ...att, confirmedData: updated };
        }
        return att;
      })
    );
  };

  const confirmAttachmentData = async (id: string) => {
    const targetAtt = attachments.find((a) => a.id === id);
    setAttachments((prev) =>
      prev.map((att) => {
        if (att.id === id) {
          return { ...att, isConfirmedByUser: true };
        }
        return att;
      })
    );
    setActiveEditingId(null);

    if (targetAtt && targetAtt.backendDocId && (targetAtt.citizenId || currentCitizenId)) {
      try {
        await api.confirmDocumentFields(
          targetAtt.backendDocId,
          targetAtt.citizenId || currentCitizenId,
          targetAtt.confirmedData || {},
          'Citizen verified through DocumentUploadInterface'
        );
      } catch (err) {
        console.warn('Could not persist confirmed fields to backend:', err);
      }
    }
  };

  // Compute checklist verified progress
  const checklistItems = useMemo(() => {
    return rawRequirements.map((d: any) => {
      const itemType = mapItemToDocType(d);
      const targetAtt = attachments.find((a) => {
        if (!itemType) return false;
        if (a.documentType === itemType) return true;
        if (a.documentType.toLowerCase() === itemType.toLowerCase()) return true;
        if (itemType === 'CASTE_CERT' && (a.documentType.toLowerCase() === 'caste_certificate' || a.documentType === 'CASTE_CERTIFICATE')) return true;
        if (itemType === 'INCOME_CERT' && (a.documentType.toLowerCase() === 'income_certificate' || a.documentType === 'INCOME_CERTIFICATE')) return true;
        if (itemType === 'MARKS_CARD' && a.documentType.toLowerCase() === 'marks_card') return true;
        if (itemType === 'BANK_PASSBOOK' && a.documentType.toLowerCase() === 'bank_passbook') return true;
        if (itemType === 'AADHAAR' && (a.documentType.toLowerCase() === 'student_aadhaar' || a.documentType.toLowerCase() === 'aadhaar')) return true;
        return false;
      });
      const isConfirmed = Boolean(targetAtt && targetAtt.status === 'UPLOADED' && targetAtt.backendDocId);
      const isCurrentlyUploading = (itemType === uploadingDocType) || Boolean(targetAtt && targetAtt.status === 'UPLOADING');
      const isFailed = Boolean(targetAtt && targetAtt.status === 'FAILED_TO_UPLOAD');

      const rawName = typeof d === 'string' ? d : d.label_en || d.item || d.name || t('documentDefault');
      const itemName = typeof rawName === 'object' ? (rawName[language] || rawName.en) : rawName;
      const isMandatory = d.is_mandatory !== false && d.mandatory !== false;
      return {
        raw: d,
        itemType,
        itemName,
        targetAtt,
        isConfirmed,
        isCurrentlyUploading,
        isFailed,
        isMandatory,
        note: d.note || d.instructions?.[language] || d.instructions?.en,
      };
    });
  }, [rawRequirements, attachments, uploadingDocType, language, t]);

  const dynamicLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of checklistItems) {
      if (item.itemType) {
        map[item.itemType] = item.itemName;
      }
    }
    return map;
  }, [checklistItems]);

  const totalRequired = checklistItems.filter((i: any) => i.isMandatory).length;
  const totalUploaded = checklistItems.filter((i: any) => i.isMandatory && i.isConfirmed).length;

  return (
    <div className="space-y-5">
      {/* 1. Header Title & Subtitle */}
      <div>
        <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
          <FileCheck className="w-5 h-5 text-saathi-700" />
          <span>{t('tabUploadSubmitDocuments')}</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {t('docUploadSubtitle')}
        </p>
      </div>

      {/* 2. Scheme & Application Selection Controls Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        {/* Scheme Selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-saathi-700" />
              <span>{t('selectScheme')}:</span>
            </label>
            {activeScheme && (
              <span className="text-[10px] font-mono font-bold bg-saathi-100 text-saathi-900 px-2 py-0.5 rounded-md uppercase">
                {(activeScheme as any).scheme_id || (activeScheme as any).id}
              </span>
            )}
          </div>

          {availableSchemes.length > 1 ? (
            <select
              value={(activeScheme as any)?.scheme_id || (activeScheme as any)?.id || ''}
              onChange={(e) => {
                const found = availableSchemes.find(
                  (s: any) => (s.scheme_id || s.id) === e.target.value
                );
                if (found) {
                  setActiveScheme(found);
                  if (onSelectScheme) onSelectScheme(found);
                }
              }}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-semibold text-slate-900 outline-none focus:border-saathi-700 focus:ring-2 focus:ring-saathi-500/20"
            >
              {availableSchemes.map((s: any) => {
                const id = s.scheme_id || s.id;
                const name = typeof s.name === 'object' ? (s.name[language] || s.name.en) : s.name;
                return (
                  <option key={id} value={id}>
                    {name} ({id})
                  </option>
                );
              })}
            </select>
          ) : activeScheme ? (
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-950">
                  {typeof activeScheme.name === 'object'
                    ? ((activeScheme.name as any)[language] || (activeScheme.name as any).en)
                    : activeScheme.name}
                </p>
                <p className="text-[11px] text-emerald-800">
                  {t('schemeSpecificDocsNotice')}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Application & Citizen Identifiers Linking */}
        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Citizen ID Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">
              {t('citizenIdLabel')}:
            </span>
            <span className="font-mono text-xs font-bold text-slate-800 break-all select-all">
              {currentCitizenId || 'Auto-linked'}
            </span>
          </div>

          {/* Application ID Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex flex-col justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                {t('applicationIdLabel')}:
              </span>
              {currentApplicationId ? (
                <div className="flex items-center justify-between gap-1 mt-0.5">
                  <span className="font-mono text-xs font-bold text-emerald-900 truncate">
                    {currentApplicationId}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(currentApplicationId);
                      setCopiedAppId(true);
                      setTimeout(() => setCopiedAppId(false), 2000);
                    }}
                    className="text-slate-400 hover:text-slate-700 p-1"
                    title="Copy ID"
                  >
                    {copiedAppId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ) : (
                <span className="text-[11px] text-slate-500 italic block mt-0.5">
                  {t('noApplicationLinked')}
                </span>
              )}
            </div>

            {!currentApplicationId && (
              <button
                type="button"
                onClick={handleCreateDraft}
                disabled={isCreatingDraft}
                className="mt-2 inline-flex items-center justify-center space-x-1.5 px-2.5 py-1 bg-white border border-slate-300 hover:border-saathi-600 text-saathi-800 rounded-lg font-semibold text-[11px] transition-all"
              >
                {isCreatingDraft ? (
                  <Loader2 className="w-3 h-3 animate-spin text-saathi-700" />
                ) : (
                  <Plus className="w-3 h-3" />
                )}
                <span>{t('newApplicationDraft')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Verified Required Documents Checklist Card */}
      {checklistItems.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-100 pb-2.5">
            <div>
              <h3 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center space-x-1.5">
                <FileCheck2 className="w-4 h-4 text-saathi-700" />
                <span>{t('relevantChecklistTitle')}</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                {t('schemeSpecificDocsNotice')}
              </p>
            </div>
            {totalRequired > 0 && (
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center space-x-1 ${
                totalUploaded >= totalRequired
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-900 border border-amber-300'
              }`}>
                <span>{totalUploaded} / {totalRequired} {t('checklistProgress')}</span>
              </span>
            )}
          </div>

          {/* Checklist Items */}
          <div className="space-y-2">
            {checklistItems.map((item: any, idx: number) => {
              return (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-all ${
                    item.isConfirmed
                      ? 'bg-emerald-50/60 border-emerald-200'
                      : item.isCurrentlyUploading
                      ? 'bg-blue-50/60 border-blue-200'
                      : 'bg-slate-50/80 border-slate-200'
                  }`}
                >
                  <div className="flex items-start space-x-2.5">
                    {item.isConfirmed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    ) : item.isCurrentlyUploading ? (
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0 mt-0.5" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className={`font-bold ${item.isConfirmed ? 'text-emerald-950 font-semibold' : 'text-slate-900'}`}>
                          {item.itemName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          ({item.isMandatory ? t('mandatoryDoc') : t('optionalDoc')})
                        </span>
                      </div>
                      {item.note && (
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {item.note}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 self-end sm:self-center">
                    {/* SHOW "UPLOADED" ONLY AFTER VERIFIED BACKEND CONFIRMATION */}
                    {item.isConfirmed ? (
                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] font-bold bg-emerald-600 text-white px-2.5 py-0.5 rounded-full inline-flex items-center space-x-1 shadow-2xs">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{t('uploadConfirmed')}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (item.itemType) {
                              setSelectedDocType(item.itemType);
                              fileInputRef.current?.click();
                            }
                          }}
                          className="text-[10px] text-slate-500 hover:text-saathi-800 underline font-medium"
                        >
                          Replace
                        </button>
                      </div>
                    ) : item.isCurrentlyUploading ? (
                      <span className="text-[11px] font-bold bg-blue-600 text-white px-2.5 py-0.5 rounded-full inline-flex items-center space-x-1 shadow-2xs">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>{t('uploadingDoc')}</span>
                      </span>
                    ) : item.isFailed ? (
                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] font-bold bg-rose-600 text-white px-2.5 py-0.5 rounded-full inline-flex items-center space-x-1 shadow-2xs">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Upload Failed</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (item.itemType) {
                              setSelectedDocType(item.itemType);
                              fileInputRef.current?.click();
                            }
                          }}
                          className="text-[11px] font-bold bg-rose-800 hover:bg-rose-900 text-white px-2.5 py-1 rounded-lg inline-flex items-center space-x-1 shadow-2xs transition-all active:scale-95"
                        >
                          <Upload className="w-3 h-3" />
                          <span>Retry</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                          Pending
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (item.itemType) {
                              setSelectedDocType(item.itemType);
                              fileInputRef.current?.click();
                            }
                          }}
                          className="text-[11px] font-bold bg-saathi-800 hover:bg-saathi-900 text-white px-3 py-1 rounded-lg inline-flex items-center space-x-1 shadow-2xs transition-all active:scale-95"
                        >
                          <Upload className="w-3 h-3" />
                          <span>{t('uploadFile')}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Active Upload Box */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        {/* Document Type Selector Buttons */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
            1. {t('chooseDocumentType')}:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {availableDocTypes.map((type) => {
              const isConfirmed = attachments.some(
                (a) =>
                  (a.documentType === type ||
                    a.documentType.toLowerCase() === type.toLowerCase() ||
                    (type === 'CASTE_CERT' && (a.documentType.toLowerCase() === 'caste_certificate' || a.documentType === 'CASTE_CERTIFICATE')) ||
                    (type === 'INCOME_CERT' && (a.documentType.toLowerCase() === 'income_certificate' || a.documentType === 'INCOME_CERTIFICATE')) ||
                    (type === 'MARKS_CARD' && a.documentType.toLowerCase() === 'marks_card') ||
                    (type === 'BANK_PASSBOOK' && a.documentType.toLowerCase() === 'bank_passbook') ||
                    (type === 'AADHAAR' && (a.documentType.toLowerCase() === 'student_aadhaar' || a.documentType.toLowerCase() === 'aadhaar'))) &&
                  a.status === 'UPLOADED' &&
                  Boolean(a.backendDocId)
              );
              const label = dynamicLabels[type] || docTypeLabels[type] || type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedDocType(type)}
                  className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-all flex items-center justify-between ${
                    selectedDocType === type
                      ? 'bg-saathi-50 border-saathi-600 text-saathi-900 ring-2 ring-saathi-500/20'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{label}</span>
                  {isConfirmed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 ml-1" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Drag & Drop / Mobile File Selector Zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all ${
            dragActive
              ? 'border-saathi-600 bg-saathi-50'
              : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
          }`}
        >
          <div className="w-12 h-12 mx-auto rounded-full bg-saathi-100 text-saathi-700 flex items-center justify-center mb-3">
            {isUploading ? (
              <Loader2 className="w-6 h-6 animate-spin text-saathi-700" />
            ) : (
              <Upload className="w-6 h-6" />
            )}
          </div>

          {(() => {
            const activeAtt = attachments.find(
              (a) =>
                a.documentType === selectedDocType ||
                a.documentType.toLowerCase() === selectedDocType.toLowerCase() ||
                (selectedDocType === 'CASTE_CERT' && (a.documentType.toLowerCase() === 'caste_certificate' || a.documentType === 'CASTE_CERTIFICATE')) ||
                (selectedDocType === 'INCOME_CERT' && (a.documentType.toLowerCase() === 'income_certificate' || a.documentType === 'INCOME_CERTIFICATE'))
            );
            const activeLabel = dynamicLabels[selectedDocType] || docTypeLabels[selectedDocType] || selectedDocType;
            return (
              <div className="mb-2">
                <span className="text-xs font-semibold text-saathi-800 bg-saathi-100/70 px-2.5 py-1 rounded-full inline-block">
                  Document: <strong>{activeLabel}</strong>
                </span>
                {activeAtt && (
                  <div className="mt-1.5 text-xs text-slate-700 flex items-center justify-center space-x-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-mono text-[11px] truncate max-w-xs">{activeAtt.fileName}</span>
                    {activeAtt.status === 'UPLOADED' && Boolean(activeAtt.backendDocId) ? (
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        Uploaded
                      </span>
                    ) : activeAtt.status === 'UPLOADING' ? (
                      <span className="text-[10px] text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                        Uploading...
                      </span>
                    ) : (
                      <span className="text-[10px] text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                        Failed
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          <p className="text-xs sm:text-sm font-bold text-slate-800">
            {isUploading ? t('uploadingDoc') : t('dragDropPrompt')}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
              id="file-upload-input"
              disabled={isUploading}
            />
            <label
              htmlFor="file-upload-input"
              className={`cursor-pointer bg-saathi-800 hover:bg-saathi-900 text-white font-bold text-xs py-2 px-4 rounded-lg shadow-sm transition-all inline-flex items-center space-x-1.5 active:scale-95 ${
                isUploading ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{t('browseFiles')}</span>
            </label>

            {/* Mobile Camera capture trigger */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
              id="camera-capture-input"
              disabled={isUploading}
            />
            <label
              htmlFor="camera-capture-input"
              className={`cursor-pointer bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold text-xs py-2 px-3 rounded-lg shadow-sm transition-all inline-flex items-center space-x-1.5 active:scale-95 ${
                isUploading ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-slate-600" />
              <span>{t('cameraCapture')}</span>
            </label>
          </div>

          <p className="text-[11px] text-slate-500 mt-3">
            {t('fileSizeLimitNotice')}
          </p>
        </div>

        {/* Success Banner */}
        {uploadSuccessBanner && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 flex items-center space-x-2 animate-fade-in shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">{uploadSuccessBanner}</span>
          </div>
        )}

        {/* Validation Error Banner */}
        {validationError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center space-x-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Security & Private Storage Privacy Pill */}
        <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 flex items-start space-x-2">
          <ShieldCheck className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
          <p className="leading-snug">
            {language === 'kn'
              ? 'ನಿಮ್ಮ ದಾಖಲೆಗಳನ್ನು ಸುರಕ್ಷಿತ ಖಾಸಗಿ ಸಂಗ್ರಹಣೆಯಲ್ಲಿ UUID ಮೂಲಕ ಗೌಪ್ಯವಾಗಿ ರಕ್ಷಿಸಲಾಗಿದೆ. ಶೂನ್ಯ ಸಾರ್ವಜನಿಕ ಪ್ರವೇಶ.'
              : language === 'hi'
              ? 'आपके दस्तावेज़ सुरक्षित निजी स्टोरेज में UUID द्वारा सुरक्षित हैं। शून्य सार्वजनिक पहुँच।'
              : 'Your documents are safely stored in private UUID storage with zero public exposure.'}
          </p>
        </div>
      </div>

      {/* 5. Attached Documents List with Confirmed Badges and Extracted Data Review */}
      {attachments.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
            {t('uploadedDocumentsTitle')} ({attachments.length}):
          </h3>

          <div className="space-y-3">
            {attachments.map((att) => {
              const isEditing = activeEditingId === att.id;
              const isBackendConfirmed = att.status === 'UPLOADED' && Boolean(att.backendDocId);

              return (
                <div
                  key={att.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3 transition-all"
                >
                  {/* File Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-xs text-slate-900">
                          {docTypeLabels[att.documentType] || att.documentType}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {att.fileName} ({(att.fileSize / 1024).toFixed(1)} KB)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* SHOW "UPLOADED" ONLY AFTER VERIFIED BACKEND CONFIRMATION */}
                      {isBackendConfirmed ? (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>{t('uploadConfirmed')}</span>
                        </span>
                      ) : att.status === 'UPLOADING' ? (
                        <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full flex items-center space-x-1">
                          <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                          <span>{t('uploadingDoc')}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full flex items-center space-x-1">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          <span>{t('uploadFailed')}</span>
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => removeAttachment(att.id)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-100"
                        title={t('remove')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Backend Document Details & Identifiers */}
                  {(att.citizenId || att.applicationId || att.backendDocId) && (
                    <div className="bg-slate-50 px-3 py-2 rounded-xl text-[10px] font-mono text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                      {att.backendDocId && (
                        <span>Doc ID: <strong>{att.backendDocId}</strong></span>
                      )}
                      {att.citizenId && (
                        <span>Citizen ID: <strong>{att.citizenId}</strong></span>
                      )}
                      {att.applicationId && (
                        <span>App ID: <strong>{att.applicationId}</strong></span>
                      )}
                    </div>
                  )}

                  {/* Thumbnail Preview if Image */}
                  {att.fileUrl && (
                    <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 flex items-center space-x-3">
                      <img
                        src={att.fileUrl}
                        alt="Preview"
                        className="w-16 h-16 object-cover rounded-lg border border-slate-200 shadow-sm"
                      />
                      <div className="text-xs text-slate-600 space-y-0.5">
                        <p className="font-semibold text-slate-800">Local Safe Preview</p>
                        <p className="text-[11px] text-slate-500">Rendered safely in-browser. Zero external telemetry.</p>
                      </div>
                    </div>
                  )}

                  {/* OCR Review & Citizen Correction Controls */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <p className="font-bold text-slate-800 flex items-center space-x-1.5">
                        <Edit3 className="w-3.5 h-3.5 text-saathi-700" />
                        <span>{t('ocrReviewTitle')}</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveEditingId(isEditing ? null : att.id)}
                        className="text-saathi-700 hover:text-saathi-900 font-bold text-xs"
                      >
                        {isEditing ? 'Hide Fields' : 'Edit / Confirm Details'}
                      </button>
                    </div>

                    {att.lowConfidenceFields && att.lowConfidenceFields.length > 0 && (
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px] flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <span>{t('lowConfidenceWarning')}</span>
                      </div>
                    )}

                    {/* View Raw OCR Output Toggle if available */}
                    {att.ocrText && (
                      <div className="border border-slate-200 bg-white rounded-lg p-2">
                        <button
                          type="button"
                          onClick={() => setExpandedOcrTextAttId(expandedOcrTextAttId === att.id ? null : att.id)}
                          className="text-[11px] font-semibold text-saathi-700 hover:underline flex items-center space-x-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{expandedOcrTextAttId === att.id ? 'Hide Raw OCR Text' : 'View Extracted OCR Text'}</span>
                          {expandedOcrTextAttId === att.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        {expandedOcrTextAttId === att.id && (
                          <div className="mt-2 p-2 bg-slate-900 text-emerald-400 rounded text-[10px] font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                            {att.ocrText}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Editable fields for citizen verification */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {Object.entries(att.confirmedData || {}).map(([key, val]) => {
                        const rawVal = att.extractedData?.[key];
                        const wasEdited = rawVal !== undefined && String(rawVal) !== String(val);
                        const isEmptyOrUncertain = !val || val.trim() === '' || att.lowConfidenceFields?.includes(key);

                        return (
                          <div key={key} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="block text-[11px] font-bold text-slate-700 capitalize">
                                {key.replace(/_/g, ' ')}:
                              </label>
                              {isEmptyOrUncertain ? (
                                <span className="text-[9px] bg-amber-100 text-amber-900 px-1 rounded font-semibold">
                                  Uncertain
                                </span>
                              ) : wasEdited ? (
                                <span className="text-[9px] bg-blue-100 text-blue-900 px-1 rounded font-semibold">
                                  Edited
                                </span>
                              ) : null}
                            </div>
                            <input
                              type="text"
                              value={val}
                              onChange={(e) => updateConfirmedData(att.id, key, e.target.value)}
                              placeholder={`Enter ${key.replace(/_/g, ' ')}`}
                              className={`w-full text-xs px-2.5 py-1.5 bg-white border rounded-lg outline-none transition-all ${
                                isEmptyOrUncertain
                                  ? 'border-amber-300 focus:ring-1 focus:ring-amber-500 bg-amber-50/20'
                                  : 'border-slate-300 focus:ring-1 focus:ring-saathi-600'
                              }`}
                            />
                            {wasEdited && rawVal && (
                              <p className="text-[10px] text-slate-400 truncate">
                                OCR: <span className="font-mono">{rawVal}</span>
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-1 flex items-center justify-between">
                      <p className="text-[10px] text-slate-400 italic">
                        {att.isConfirmedByUser
                          ? 'Changes saved. You can re-edit anytime before final application handoff.'
                          : 'Please verify the extracted details and click save.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => confirmAttachmentData(att.id)}
                        className={`font-bold text-xs py-1.5 px-3 rounded-lg flex items-center space-x-1 shadow-sm transition-all active:scale-95 ${
                          att.isConfirmedByUser
                            ? 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                            : 'bg-saathi-800 hover:bg-saathi-900 text-white'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{att.isConfirmedByUser ? 'Update Confirmed Details' : t('saveConfirmedData')}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
