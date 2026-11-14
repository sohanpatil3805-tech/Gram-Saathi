import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { 
  BackendScheme, 
  DiscoveredScheme, 
  ApplicantProfile, 
  DocumentAttachment, 
  CitizenGroup,
  SupportedLanguage,
  CitizenRecord
} from '../../types/api';
import { ChatMessage as ChatMessageType } from '../../types/citizen';
import { 
  api, 
  isDemoMode,
  getSavedCitizenProfile,
  setSavedCitizenProfile,
  getCurrentCitizenId
} from '../../services/api';
import { 
  analyzeCitizenMessage, 
  checkSensitiveData, 
  detectBeneficiaryCategory 
} from '../../services/nlu';
import { MOCK_SCHEMES } from '../../services/mockData';
import { CitizenHeader } from '../../components/citizen/CitizenHeader';
import { QuickSuggestions } from '../../components/citizen/QuickSuggestions';
import { ChatMessage } from '../../components/citizen/ChatMessage';
import { ChatInput } from '../../components/citizen/ChatInput';
import { EligibilityWizard } from '../../components/citizen/EligibilityWizard';
import { DocumentUploadInterface } from '../../components/citizen/DocumentUploadInterface';
import { ApplicationPreparation } from '../../components/citizen/ApplicationPreparation';
import { ApplicationTracking } from '../../components/citizen/ApplicationTracking';
import { 
  MessageSquare, 
  Sparkles, 
  UploadCloud, 
  FileCheck2, 
  Search, 
  Bot, 
  ShieldCheck, 
  AlertTriangle, 
  RotateCcw,
  Sprout,
  GraduationCap,
  Briefcase,
  Users,
  HardHat,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

type CitizenTab = 'chat' | 'eligibility' | 'documents' | 'prepare' | 'track';

export const CitizenChatbotPage: React.FC = () => {
  const { t, language } = useLanguage();
  const location = useLocation();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<CitizenTab>(() => {
    const passed = (location.state as any)?.activeTab;
    if (passed && ['chat', 'eligibility', 'documents', 'prepare', 'track'].includes(passed)) {
      return passed as CitizenTab;
    }
    return 'chat';
  });

  useEffect(() => {
    const passed = (location.state as any)?.activeTab;
    const passedRef = (location.state as any)?.refNumber;
    if (passed && ['chat', 'eligibility', 'documents', 'prepare', 'track'].includes(passed)) {
      setActiveTab(passed as CitizenTab);
    }
    if (passedRef) {
      setSavedDraftReference(passedRef);
    }
  }, [location.state]);

  // Saved Citizen Profile State
  const [citizenProfile, setCitizenProfile] = useState<CitizenRecord | null>(() => {
    const saved = getSavedCitizenProfile();
    if (saved) return saved;
    const defaultProfile: CitizenRecord = {
      id: 'citizen-ramu-001',
      name: 'Ramu Nayak',
      phone_number: '+919876543210',
      preferred_language: 'kn',
      citizen_group: 'farmer',
      state: 'Karnataka',
      district: 'Mandya',
      village: 'Shivalli',
      aadhaar_ref: 'XXXX-XXXX-1234',
      created_at: new Date().toISOString(),
    };
    setSavedCitizenProfile(defaultProfile);
    return defaultProfile;
  });

  // Hydrate profile from backend if available
  useEffect(() => {
    api.ensureValidCitizenId().then((cid) => {
      if (cid) {
        api.getCitizen(cid).then((record) => {
          if (record && record.name) {
            setCitizenProfile(record);
            setSavedCitizenProfile(record);
          }
        }).catch(() => {
          // Fallback to local profile
        });
      }
    }).catch(() => {
      // Fallback to local profile
    });
  }, []);

  // Shared Citizen State
  const [availableSchemes, setAvailableSchemes] = useState<Array<BackendScheme | DiscoveredScheme>>([]);
  const [selectedScheme, setSelectedScheme] = useState<(BackendScheme | DiscoveredScheme) | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CitizenGroup | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<DocumentAttachment[]>([]);
  const [savedDraftReference, setSavedDraftReference] = useState<string>('');

  const [applicantFacts, setApplicantFacts] = useState<ApplicantProfile>({
    beneficiary_group: 'farmers',
    state: citizenProfile?.state || 'Karnataka',
    district: citizenProfile?.district || 'Mandya',
    land_holding_acres: 1.5,
    has_cultivable_land_record: true,
    annual_income_range: 'below_1_5lakh',
    has_bank_account: true,
  });

  // Chat State
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<string>('');
  const [pendingClarification, setPendingClarification] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeTab === 'chat') {
      scrollToBottom();
    }
  }, [messages, isLoading, activeTab]);

  // Load available schemes on initial mount
  useEffect(() => {
    const fetchCatalogue = async () => {
      try {
        const res = await api.getSchemes(selectedCategory || undefined, applicantFacts.state);
        if (res.schemes && res.schemes.length > 0) {
          setAvailableSchemes(res.schemes);
          if (!selectedScheme) {
            setSelectedScheme(res.schemes[0]);
          }
        } else {
          setAvailableSchemes(MOCK_SCHEMES as any);
          if (!selectedScheme) {
            setSelectedScheme(MOCK_SCHEMES[0] as any);
          }
        }
      } catch {
        setAvailableSchemes(MOCK_SCHEMES as any);
        if (!selectedScheme) {
          setSelectedScheme(MOCK_SCHEMES[0] as any);
        }
      }
    };
    fetchCatalogue();
  }, [selectedCategory, applicantFacts.state]);

  // Initialize greeting message according to language without wiping chat history on language switch
  const initGreeting = (forceReset = false) => {
    let greetingText = '';
    if (language === 'kn') {
      greetingText = `ನಮಸ್ಕಾರ! 🙏 ನಾನು ನಿಮ್ಮ ಗ್ರಾಮ ಸಾಥಿ.\n\nನಿಮಗೆ ಅಗತ್ಯವಿರುವ ಸರ್ಕಾರಿ ಯೋಜನೆಗಳು, ಸೌಲಭ್ಯಗಳು ಮತ್ತು ವಿದ್ಯಾರ್ಥಿವೇತನಗಳನ್ನು ಕಂಡುಹಿಡಿಯಲು, ಪ್ರಾಥಮಿಕ ಅರ್ಹತಾ ನಿಯಮಗಳನ್ನು ತಿಳಿಯಲು ಮತ್ತು ಅರ್ಜಿ ದಾಖಲೆಗಳನ್ನು ಸಿದ್ಧಪಡಿಸಲು ನಾನು ಇಲ್ಲಿದ್ದೇನೆ.\n\nನಿಮ್ಮ ಅಗತ್ಯವನ್ನು ಕೆಳಗೆ ಸಹಜವಾಗಿ ಬರೆಯಿರಿ ಅಥವಾ ಕೆಳಗಿನ ತ್ವರಿತ ಪ್ರಶ್ನೆಗಳನ್ನು ಆಯ್ಕೆಮಾಡಿ:`;
    } else if (language === 'hi') {
      greetingText = `नमस्ते! 🙏 मैं आपका ग्राम साथी हूँ।\n\nसरकारी कल्याणकारी योजनाओं और छात्रवृत्तियों की खोज करने, पात्रता नियमों को समझने और आवेदन प्रपत्र तैयार करने में आपकी सहायता के लिए उपस्थित हूँ।\n\nअपनी आवश्यकता नीचे सहजता से लिखें या नीचे दिए गए त्वरित विकल्पों पर क्लिक करें:`;
    } else {
      greetingText = `Namaskara! 🙏 I am Gram Saathi, your rural public services assistant.\n\nI can help you discover verified government schemes, assess preliminary eligibility rules, and prepare documentation for official submission.\n\nDescribe your need naturally below or tap one of the suggested prompts:`;
    }

    setMessages((prev) => {
      // Preserve existing conversation history when language switches mid-workflow
      if (!forceReset && prev.length > 1) {
        return prev;
      }
      return [
        {
          id: 'msg-init-1',
          sender: 'assistant',
          content: greetingText,
          contentType: 'text',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ];
    });
    setPendingClarification(false);
    setChatError(null);
  };

  useEffect(() => {
    initGreeting(false);
  }, [language]);

  // Handle category selection button click in chat
  const handleSelectCategory = async (category: CitizenGroup) => {
    setSelectedCategory(category);
    setPendingClarification(false);

    const categoryNames: Record<string, Record<SupportedLanguage, string>> = {
      farmers: { en: 'Farmers & Cultivators', kn: 'ರೈತರು ಮತ್ತು ಕೃಷಿಕರು', hi: 'किसान और कृषक' },
      students: { en: 'Students & Youth', kn: 'ವಿದ್ಯಾರ್ಥಿಗಳು ಮತ್ತು ಯುವಕರು', hi: 'विद्यार्थी और युवा' },
      women_entrepreneurs: { en: 'Women Entrepreneurs / SHGs', kn: 'ಮಹಿಳಾ ಉದ್ಯಮಿಗಳು / ಸ್ವಸಹಾಯ ಸಂಘಗಳು', hi: 'महिला उद्यमी / स्वयं सहायता' },
      workers: { en: 'Daily Wage & Rural Workers', kn: 'ದಿನಗೂಲಿ ಮತ್ತು ಗ್ರಾಮೀಣ ಕಾರ್ಮಿಕರು', hi: 'श्रमिक और कामगार' },
      general: { en: 'General Citizens', kn: 'ಸಾಮಾನ್ಯ ನಾಗರಿಕರು', hi: 'सामान्य नागरिक' },
    };

    const chosenName = categoryNames[category][language];
    const userPrompt = `${chosenName}`;

    await executeSendMessage(userPrompt, category);
  };

  // Main message sender with sensitive data protection & real API integration
  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    // 1. Check for sensitive data (Aadhaar 12-digit or OTP)
    if (checkSensitiveData(text)) {
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Add user message with masked display
      const userMsg: ChatMessageType = {
        id: `user-${Date.now()}`,
        sender: 'user',
        content: text.replace(/\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, 'XXXX-XXXX-XXXX'),
        contentType: 'text',
        timestamp: now,
      };

      // Add assistant safety warning
      const warningMsg: ChatMessageType = {
        id: `bot-warn-${Date.now()}`,
        sender: 'assistant',
        content: `⚠️ **${t('sensitiveDataWarning')}**\n\n${
          language === 'kn'
            ? 'ನಿಮ್ಮ ಭದ್ರತೆಗಾಗಿ, ಗ್ರಾಮ ಸಾಥಿ ಚಾಟ್‌ನಲ್ಲಿ ಆಧಾರ್ ಸಂಖ್ಯೆ ಅಥವಾ OTP ಗಳನ್ನು ಸ್ವೀಕರಿಸುವುದಿಲ್ಲ. ಯೋಜನಾ ಮಾರ್ಗದರ್ಶನಕ್ಕಾಗಿ ಕೇವಲ ಅರ್ಹತಾ ವಿವರಗಳನ್ನು (ಉದಾ: ಜಮೀನಿನ ವಿಸ್ತೀರ್ಣ, ಜಿಲ್ಲೆ, ಶಿಕ್ಷಣ) ಹಂಚಿಕೊಳ್ಳಿ.'
            : language === 'hi'
            ? 'आपकी सुरक्षा के लिए, ग्राम साथी चैट में आधार संख्या या OTP स्वीकार नहीं करता है। योजना मार्गदर्शन हेतु केवल गैर-संवेदनशील विवरण साझा करें।'
            : 'For your security, Gram Saathi never collects Aadhaar numbers or OTPs in chat. You only need to share non-sensitive details like land size, district, and education.'
        }`,
        contentType: 'text',
        timestamp: now,
      };

      setMessages((prev) => [...prev, userMsg, warningMsg]);
      return;
    }

    // 2. Analyze message using NLU module
    const nlu = analyzeCitizenMessage(text, language);
    let resolvedGroup: CitizenGroup | null = nlu.beneficiaryGroup || selectedCategory;
    if (!resolvedGroup && citizenProfile?.citizen_group) {
      const cg = citizenProfile.citizen_group.toLowerCase();
      if (cg.includes('farm')) resolvedGroup = 'farmers';
      else if (cg.includes('stud')) resolvedGroup = 'students';
      else if (cg.includes('wom')) resolvedGroup = 'women_entrepreneurs';
      else if (cg.includes('work')) resolvedGroup = 'workers';
    }
    const categoryToUse = resolvedGroup;
    if (nlu.beneficiaryGroup) {
      setSelectedCategory(nlu.beneficiaryGroup);
    }

    // Merge extracted non-sensitive facts
    if (Object.keys(nlu.extractedFacts).length > 0) {
      setApplicantFacts((prev) => ({
        ...prev,
        ...nlu.extractedFacts,
      }));
    }

    // Intent routing shortcut if citizen explicitly asked to upload or track
    if (nlu.intent === 'UPLOAD_DOCUMENTS') {
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          sender: 'user',
          content: text,
          contentType: 'text',
          timestamp: now,
        },
        {
          id: `bot-${Date.now()}`,
          sender: 'assistant',
          content:
            language === 'kn'
              ? `ದಾಖಲೆಗಳ ಸಲ್ಲಿಕೆ ವಿಭಾಗಕ್ಕೆ ತೆರಳುತ್ತಿದ್ದೇವೆ. ಅಲ್ಲಿ ನೀವು ಕ್ಯಾಮೆರಾ ಅಥವಾ ಫೈಲ್ ಮೂಲಕ ಆಧಾರ್, ಪಹಣಿ ಮತ್ತು ಆದಾಯ ಪ್ರಮಾಣಪತ್ರಗಳನ್ನು ಸುರಕ್ಷಿತವಾಗಿ ಲಗತ್ತಿಸಬಹುದು.`
              : language === 'hi'
              ? `दस्तावेज़ अपलोड अनुभाग खोला जा रहा है। वहां आप सुरक्षित रूप से फ़ाइल या कैमरे द्वारा दस्तावेज़ जोड़ सकते हैं।`
              : `Navigating to the Document Upload section where you can attach required documents safely.`,
          contentType: 'text',
          timestamp: now,
        },
      ]);
      setTimeout(() => setActiveTab('documents'), 600);
      return;
    }

    if (nlu.intent === 'TRACK_APPLICATION') {
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          sender: 'user',
          content: text,
          contentType: 'text',
          timestamp: now,
        },
        {
          id: `bot-${Date.now()}`,
          sender: 'assistant',
          content:
            language === 'kn'
              ? `ಅರ್ಜಿ ಸ್ಥಿತಿ ಟ್ರ್ಯಾಕಿಂಗ್ ವಿಭಾಗಕ್ಕೆ ತೆರಳುತ್ತಿದ್ದೇವೆ. ನಿಮ್ಮ ಡ್ರಾಫ್ಟ್ ಅಥವಾ ಅಧಿಕೃತ ಇಲಾಖಾ ಪೋರ್ಟಲ್ ಉಲ್ಲೇಖವನ್ನು ಅಲ್ಲಿ ಪರಿಶೀಲಿಸಬಹುದು.`
              : language === 'hi'
              ? `आवेदन स्थिति ट्रैकिंग अनुभाग खोला जा रहा है। वहां आप संदर्भ संख्या जांच सकते हैं।`
              : `Opening Application Tracking section where you can check your application draft reference or official status.`,
          contentType: 'text',
          timestamp: now,
        },
      ]);
      setTimeout(() => setActiveTab('track'), 600);
      return;
    }

    await executeSendMessage(text, categoryToUse);
  };

  // Executes the network call to POST /api/chat with fallback
  const executeSendMessage = async (text: string, category: CitizenGroup | null) => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setLastUserMessage(text);
    setChatError(null);

    const userMsg: ChatMessageType = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: text,
      contentType: 'text',
      timestamp: now,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // 1. Call real FastAPI /api/chat endpoint
      const chatResponse = await api.sendChatMessage({
        message: text,
        beneficiary_group: category || undefined,
        state: applicantFacts.state,
        language: language,
      });

      // If backend asks for clarification
      if (chatResponse.needs_clarification) {
        setPendingClarification(true);
        const botMsg: ChatMessageType = {
          id: `bot-${Date.now()}`,
          sender: 'assistant',
          content: chatResponse.reply || t('selectCategoryToContinue'),
          contentType: 'text',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, botMsg]);
        setIsLoading(false);
        return;
      }

      setPendingClarification(false);

      // 2. Discover relevant candidate schemes
      let schemesToShow: any[] = [];
      if (chatResponse.schemes && chatResponse.schemes.length > 0) {
        schemesToShow = chatResponse.schemes;
      } else if (category) {
        try {
          const discRes = await api.discoverSchemes({
            beneficiary_group: category || 'general',
            state: applicantFacts.state,
            language: language,
            applicant_facts: applicantFacts as any,
          });
          if (discRes.schemes && discRes.schemes.length > 0) {
            schemesToShow = discRes.schemes;
          }
        } catch {
          // Fallback to local schemes filtered by category
          schemesToShow = availableSchemes.filter((s: any) => {
            if (s.beneficiary_groups && Array.isArray(s.beneficiary_groups)) {
              return s.beneficiary_groups.includes(category);
            }
            if (category === 'farmers') return s.category === 'AGRICULTURE' || s.target_group === 'FARMER';
            if (category === 'students') return s.category === 'EDUCATION' || s.target_group === 'STUDENT';
            return true;
          });
        }
      }

      const botMsg: ChatMessageType = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        content: chatResponse.reply,
        contentType: schemesToShow.length > 0 ? 'scheme_list' : 'text',
        schemes: schemesToShow.length > 0 ? schemesToShow : undefined,
        aiProvider: chatResponse.provider,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.warn('[Gram Saathi] Assistant request error:', err);
      setChatError(
        language === 'kn'
          ? 'ಸಹಾಯಕ ಸರ್ವರ್ ಸಂಪರ್ಕಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮರುಪ್ರಯತ್ನಿಸಿ.'
          : language === 'hi'
          ? 'सहायक सर्वर से संपर्क नहीं हो सका। कृपया पुनः प्रयास करें।'
          : 'Unable to connect to assistant service. Please retry.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // When a citizen clicks "Check Eligibility" on any scheme card
  const handleCheckEligibilityFromCard = (scheme: any) => {
    setSelectedScheme(scheme);
    setActiveTab('eligibility');
  };

  // When a citizen clicks "Prepare Next Steps" on any scheme card
  const handleApplyFromCard = (scheme: any) => {
    setSelectedScheme(scheme);
    setActiveTab('documents');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* 1. Mobile-First PWA Header with Dedicated "Upload Documents" Button */}
      <CitizenHeader 
        onResetChat={() => initGreeting(true)} 
        citizenName={citizenProfile?.name || 'Ramu Nayak'} 
        onOpenDocuments={() => setActiveTab('documents')}
      />

      {/* 2. Top Citizen Sub-Navigation Bar */}
      <nav aria-label="Citizen Navigation" className="bg-white border-b border-slate-200 sticky top-[73px] z-20 shadow-xs">
        <div className="max-w-4xl mx-auto px-2 sm:px-4 flex items-center justify-between overflow-x-auto no-scrollbar py-1.5 gap-1 text-xs sm:text-sm font-medium">
          {/* Chat Tab */}
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'chat'
                ? 'bg-whatsapp-teal text-white shadow-sm font-semibold'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>{t('tabChat')}</span>
          </button>

          {/* Eligibility Wizard Tab */}
          <button
            onClick={() => setActiveTab('eligibility')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'eligibility'
                ? 'bg-whatsapp-teal text-white shadow-sm font-semibold'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>{t('tabEligibility')}</span>
          </button>

          {/* Upload / Submit Documents Tab (Clearly Visible) */}
          <button
            onClick={() => setActiveTab('documents')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all relative ${
              activeTab === 'documents'
                ? 'bg-whatsapp-teal text-white shadow-sm font-bold ring-2 ring-emerald-400/50'
                : 'text-saathi-800 bg-saathi-50/80 hover:bg-saathi-100 hover:text-saathi-950 font-semibold border border-saathi-200'
            }`}
            title={t('tabUploadSubmitDocuments')}
          >
            <UploadCloud className="w-4 h-4 text-saathi-700" />
            <span>{t('tabUploadSubmitDocuments')}</span>
            {uploadedDocs.length > 0 && (
              <span className="ml-1 bg-amber-400 text-slate-950 font-bold text-[10px] px-1.5 py-0.2 rounded-full">
                {uploadedDocs.length}
              </span>
            )}
          </button>

          {/* Prepare Application Tab */}
          <button
            onClick={() => setActiveTab('prepare')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'prepare'
                ? 'bg-whatsapp-teal text-white shadow-sm font-semibold'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <FileCheck2 className="w-4 h-4" />
            <span>{t('tabPrepare')}</span>
          </button>

          {/* Tracking Tab */}
          <button
            onClick={() => setActiveTab('track')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'track'
                ? 'bg-whatsapp-teal text-white shadow-sm font-semibold'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>{t('tabTrack')}</span>
          </button>
        </div>
      </nav>

      {/* 3. TAB 1: CONVERSATIONAL CHATBOT VIEW */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col justify-between">
          {/* Quick Suggestions Ribbon */}
          <QuickSuggestions onSelectSuggestion={handleSendMessage} />

          {/* Main Chat Conversation Container */}
          <main className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 max-w-4xl mx-auto w-full space-y-2">
            {/* Synthetic Data & Guidance Notice Pill */}
            <div className="flex justify-center mb-1">
              <div className="bg-amber-100/90 text-amber-900 border border-amber-300 text-[11px] px-3 py-1 rounded-full flex items-center space-x-1.5 shadow-xs">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
                <span>
                  <strong>{language === 'kn' ? 'ಮಾರ್ಗದರ್ಶನ ಮೋಡ್:' : 'सूचना:'}</strong>{' '}
                  {t('disclaimerNote')}
                </span>
              </div>
            </div>

            {/* Clearly Visible Mobile-Friendly Document Upload Quick Action Button */}
            <div className="flex justify-center my-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('documents')}
                className="bg-saathi-50 hover:bg-saathi-100 text-saathi-900 border border-saathi-300 text-xs px-3.5 py-1.5 rounded-full flex items-center space-x-2 shadow-xs transition-all active:scale-95 font-semibold"
              >
                <UploadCloud className="w-4 h-4 text-saathi-700" />
                <span>{t('uploadSubmitDocsQuickAction')}</span>
                <ChevronRight className="w-3.5 h-3.5 text-saathi-600" />
              </button>
            </div>

            {/* Message Bubbles */}
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onCheckEligibility={handleCheckEligibilityFromCard}
                onApplyScheme={handleApplyFromCard}
              />
            ))}

            {/* Interactive Category Clarification Chips (if pending) */}
            {pendingClarification && (
              <div className="bg-white rounded-xl p-3.5 border border-emerald-200 shadow-sm space-y-2 animate-fade-in my-2 max-w-lg">
                <p className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>{t('askCategoryTitle')}</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => handleSelectCategory('farmers')}
                    className="flex items-center space-x-2 p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-left transition-all active:scale-95"
                  >
                    <Sprout className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span className="text-xs font-semibold text-emerald-950">{t('farmerCategory')}</span>
                  </button>

                  <button
                    onClick={() => handleSelectCategory('students')}
                    className="flex items-center space-x-2 p-2 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-left transition-all active:scale-95"
                  >
                    <GraduationCap className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span className="text-xs font-semibold text-blue-950">{t('studentCategory')}</span>
                  </button>

                  <button
                    onClick={() => handleSelectCategory('women_entrepreneurs')}
                    className="flex items-center space-x-2 p-2 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 text-left transition-all active:scale-95"
                  >
                    <Briefcase className="w-4 h-4 text-purple-600 flex-shrink-0" />
                    <span className="text-xs font-semibold text-purple-950">{t('womanCategory')}</span>
                  </button>

                  <button
                    onClick={() => handleSelectCategory('workers')}
                    className="flex items-center space-x-2 p-2 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-left transition-all active:scale-95"
                  >
                    <HardHat className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span className="text-xs font-semibold text-amber-950">{t('workerCategory')}</span>
                  </button>

                  <button
                    onClick={() => handleSelectCategory('general')}
                    className="flex items-center space-x-2 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-all active:scale-95 sm:col-span-2"
                  >
                    <Users className="w-4 h-4 text-slate-600 flex-shrink-0" />
                    <span className="text-xs font-semibold text-slate-900">{t('generalCategory')}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Error & Retry Banner */}
            {chatError && (
              <div className="bg-red-50 border border-red-300 rounded-xl p-3 flex items-center justify-between text-xs text-red-900 my-2 shadow-xs">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>{chatError}</span>
                </div>
                {lastUserMessage && (
                  <button
                    onClick={() => executeSendMessage(lastUserMessage, selectedCategory)}
                    className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md flex items-center space-x-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>{t('retry')}</span>
                  </button>
                )}
              </div>
            )}

            {/* Typing / Loading indicator */}
            {isLoading && (
              <div className="flex items-center space-x-2 text-slate-500 text-xs py-2 px-3 bg-white/80 backdrop-blur-xs rounded-xl max-w-[200px] shadow-xs animate-pulse">
                <Bot className="w-4 h-4 text-whatsapp-teal animate-spin" />
                <span>
                  {language === 'kn'
                    ? 'ಗ್ರಾಮ ಸಾಥಿ ಯೋಚಿಸುತ್ತಿದೆ...'
                    : language === 'hi'
                    ? 'ग्राम साथी विचार कर रहा है...'
                    : 'Gram Saathi is thinking...'}
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </main>

          {/* Privacy Note & Chat Input Bar */}
          <div className="bg-slate-100 border-t border-slate-200">
            <div className="max-w-4xl mx-auto px-3 pt-1.5 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t('sensitiveDataWarning')}</span>
              </span>
            </div>
            <ChatInput
              onSendMessage={handleSendMessage}
              onOpenAttachment={() => setActiveTab('documents')}
              isLoading={isLoading}
            />
          </div>
        </div>
      )}

      {/* 4. TAB 2: MULTI-STEP ELIGIBILITY WIZARD */}
      {activeTab === 'eligibility' && (
        <div className="flex-1 max-w-4xl mx-auto w-full px-3 sm:px-4 py-4">
          {/* Scheme selector if user wants to switch scheme */}
          {availableSchemes.length > 1 && (
            <div className="mb-4 bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">
                {language === 'kn' ? 'ಆಯ್ಕೆಮಾಡಿದ ಯೋಜನೆ:' : 'Selected Scheme:'}
              </span>
              <select
                value={selectedScheme?.scheme_id || (selectedScheme as any)?.id || ''}
                onChange={(e) => {
                  const found = availableSchemes.find(
                    (s: any) => (s.scheme_id || s.id) === e.target.value
                  );
                  if (found) setSelectedScheme(found);
                }}
                className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 outline-none focus:border-whatsapp-teal"
              >
                {availableSchemes.map((s: any) => {
                  const id = s.scheme_id || s.id;
                  const name = typeof s.name === 'object' ? (s.name[language] || s.name.en) : s.name;
                  return (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {selectedScheme ? (
            <EligibilityWizard
              scheme={selectedScheme}
              initialFacts={applicantFacts}
              onClose={() => setActiveTab('chat')}
              onProceedToPreparation={(facts) => {
                setApplicantFacts(facts);
                setActiveTab('prepare');
              }}
            />
          ) : (
            <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
              <p className="text-sm text-slate-600 mb-3">No scheme selected to assess.</p>
              <button
                onClick={() => setActiveTab('chat')}
                className="px-4 py-2 bg-whatsapp-teal text-white text-xs font-semibold rounded-lg"
              >
                Return to Chat & Choose a Scheme
              </button>
            </div>
          )}
        </div>
      )}

      {/* 5. TAB 3: REAL DOCUMENT UPLOAD & OCR REVIEW */}
      {activeTab === 'documents' && (
        <div className="flex-1 max-w-4xl mx-auto w-full px-3 sm:px-4 py-4 space-y-4">
          <DocumentUploadInterface
            initialAttachments={uploadedDocs}
            onAttachmentsChange={(docs) => setUploadedDocs(docs)}
            selectedScheme={selectedScheme}
            onSelectScheme={(scheme) => setSelectedScheme(scheme)}
            availableSchemes={availableSchemes}
            citizenId={citizenProfile?.id}
            applicationId={savedDraftReference}
            onSelectApplicationId={(appId) => setSavedDraftReference(appId)}
            requiredDocumentTypes={
              selectedScheme && (selectedScheme as any).required_documents
                ? (selectedScheme as any).required_documents
                : undefined
            }
          />

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setActiveTab('prepare')}
              className="bg-whatsapp-teal hover:bg-whatsapp-darkTeal text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow-sm flex items-center space-x-1.5 transition-all"
            >
              <span>{t('tabPrepare')}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 6. TAB 4: APPLICATION PREPARATION SCREEN */}
      {activeTab === 'prepare' && (
        <div className="flex-1 max-w-4xl mx-auto w-full px-3 sm:px-4 py-4">
          {selectedScheme ? (
            <ApplicationPreparation
              scheme={selectedScheme}
              applicantFacts={applicantFacts}
              attachments={uploadedDocs}
              citizenName={citizenProfile?.name || 'Ramu Nayak'}
              onEditFacts={() => setActiveTab('eligibility')}
              onEditDocuments={() => setActiveTab('documents')}
              onSubmitted={(ref) => {
                setSavedDraftReference(ref);
                setTimeout(() => setActiveTab('track'), 1200);
              }}
            />
          ) : (
            <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
              <p className="text-sm text-slate-600 mb-3">Please select a scheme to prepare application.</p>
              <button
                onClick={() => setActiveTab('chat')}
                className="px-4 py-2 bg-whatsapp-teal text-white text-xs font-semibold rounded-lg"
              >
                Go to Schemes
              </button>
            </div>
          )}
        </div>
      )}

      {/* 7. TAB 5: APPLICATION TRACKING VIEW */}
      {activeTab === 'track' && (
        <div className="flex-1 max-w-4xl mx-auto w-full px-3 sm:px-4 py-4">
          <ApplicationTracking initialReference={savedDraftReference} />
        </div>
      )}
    </div>
  );
};
