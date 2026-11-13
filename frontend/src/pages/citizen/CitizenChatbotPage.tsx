import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { ChatMessage as ChatMessageType } from '../../types/citizen';
import { 
  Scheme, 
  CitizenProfile, 
  EligibilityAssessmentResult, 
  DocumentVerificationResult, 
  ApplicationSubmissionResult 
} from '../../types/api';
import { api } from '../../services/api';
import { mockService } from '../../services/mockService';
import { MOCK_SCHEMES, SAMPLE_OCR_SAMPLES } from '../../services/mockData';
import { CitizenHeader } from '../../components/citizen/CitizenHeader';
import { QuickSuggestions } from '../../components/citizen/QuickSuggestions';
import { ChatMessage } from '../../components/citizen/ChatMessage';
import { ChatInput } from '../../components/citizen/ChatInput';
import { EligibilityQuizModal } from '../../components/citizen/EligibilityQuizModal';
import { DocumentUploadModal } from '../../components/citizen/DocumentUploadModal';
import { SubmissionSuccessModal } from '../../components/citizen/SubmissionSuccessModal';
import { StatusTrackerModal } from '../../components/citizen/StatusTrackerModal';
import { Sparkles, Bot, ShieldCheck, Smartphone } from 'lucide-react';

export const CitizenChatbotPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [viewMode, setViewMode] = useState<'chat' | 'whatsapp'>('chat');
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modals state
  const [selectedSchemeForQuiz, setSelectedSchemeForQuiz] = useState<Scheme | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<ApplicationSubmissionResult | null>(null);
  const [isTrackerOpen, setIsTrackerOpen] = useState(false);
  const [trackingReference, setTrackingReference] = useState('SIM-2024-00042');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Initial greeting
  const initGreeting = () => {
    const greetingText =
      language === 'kn'
        ? `ನಮಸ್ಕಾರ! 🙏 ನಾನು ನಿಮ್ಮ ಗ್ರಾಮ ಸಾಥಿ.\n\nನಿಮಗೆ ಅಗತ್ಯವಿರುವ ಸರ್ಕಾರಿ ಯೋಜನೆಗಳು, ವಿದ್ಯಾರ್ಥಿವೇತನಗಳು ಮತ್ತು ಸೌಲಭ್ಯಗಳನ್ನು ಕಂಡುಹಿಡಿಯಲು, ಅರ್ಹತೆ ಪರೀಕ್ಷಿಸಲು ಮತ್ತು ದಾಖಲೆಗಳನ್ನು ಪರಿಶೀಲಿಸಲು ನಾನು ಇಲ್ಲಿದ್ದೇನೆ.\n\nಕೆಳಗಿನ ಆಯ್ಕೆಗಳನ್ನು ಕ್ಲಿಕ್ ಮಾಡಿ ಅಥವಾ ನಿಮ್ಮ ಪ್ರಶ್ನೆಯನ್ನು ಬರೆಯಿರಿ:`
        : `नमस्ते! 🙏 मैं आपका ग्राम साथी हूँ।\n\nसरकारी योजनाओं, छात्रवृत्तियों की जानकारी प्राप्त करने, पात्रता जांचने और दस्तावेज़ सत्यापन में आपकी सहायता करने के लिए उपस्थित हूँ।\n\nनीचे दिए गए सुझावों पर क्लिक करें या अपना प्रश्न लिखें:`;

    setMessages([
      {
        id: 'msg-init-1',
        sender: 'assistant',
        content: greetingText,
        contentType: 'text',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  useEffect(() => {
    initGreeting();
  }, [language]);

  // Handles citizen message sending
  const handleSendMessage = async (text: string) => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessageType = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: text,
      contentType: 'text',
      timestamp: now,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    const lower = text.toLowerCase();

    // Simulate intelligent orchestrator response
    setTimeout(async () => {
      let botMsg: ChatMessageType;

      // 1. Schemes query (Farmer / Agriculture)
      if (lower.includes('farmer') || lower.includes('ರೈತ') || lower.includes('ಕೃಷಿ') || lower.includes('किसान')) {
        const schemes = MOCK_SCHEMES.filter((s) => s.target_group === 'FARMER');
        botMsg = {
          id: `bot-${Date.now()}`,
          sender: 'assistant',
          content:
            language === 'kn'
              ? `ರೈತರಿಗಾಗಿ ಪ್ರಮುಖ ಸರ್ಕಾರಿ ಯೋಜನೆಗಳು ಲಭ್ಯವಿವೆ:\n1. PM-KISAN (ವರ್ಷಕ್ಕೆ ₹6,000)\n2. ರೈತ ಸಿರಿ (ಸಿರಿಧಾನ್ಯ ಪ್ರೋತ್ಸಾಹಧನ ₹10,000/ಹೆಕ್ಟೇರ್)\n\nಯೋಜನೆಯ ವಿವರಗಳನ್ನು ಕೆಳಗೆ ನೋಡಿ ಮತ್ತು ನಿಮ್ಮ ಅರ್ಹತೆ ಪರಿಶೀಲಿಸಿ:`
              : `किसानों के लिए प्रमुख सरकारी योजनाएं उपलब्ध हैं:\n1. PM-KISAN (₹6,000 प्रति वर्ष)\n2. रैता सिरी मिलेट प्रोत्साहन (₹10,000/हेक्टेयर)\n\nविवरण देखें और पात्रता जांचें:`,
          contentType: 'scheme_list',
          schemes,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
      }
      // 2. Student / Scholarship query
      else if (lower.includes('student') || lower.includes('ವಿದ್ಯಾರ್ಥಿ') || lower.includes('scholarship') || lower.includes('छात्र')) {
        const schemes = MOCK_SCHEMES.filter((s) => s.target_group === 'STUDENT');
        botMsg = {
          id: `bot-${Date.now()}`,
          sender: 'assistant',
          content:
            language === 'kn'
              ? `ವಿದ್ಯಾರ್ಥಿಗಳ ಉನ್ನತ ಶಿಕ್ಷಣಕ್ಕಾಗಿ ಪೋಸ್ಟ್-ಮೆಟ್ರಿಕ್ ವಿದ್ಯಾರ್ಥಿವೇತನ (NSP) ಲಭ್ಯವಿದೆ. ಕಾಲೇಜು ಶುಲ್ಕ ಮರುಪಾವತಿ ಮತ್ತು ₹15,000 ವರೆಗೆ ನಿರ್ವಹಣಾ ಭತ್ಯೆ ಪಡೆಯಬಹುದು:`
              : `विद्यार्थियों के लिए पोस्ट-मैट्रिक छात्रवृत्ति (NSP) उपलब्ध है। शुल्क प्रतिपूर्ति और ₹15,000 तक सहायता प्राप्त करें:`,
          contentType: 'scheme_list',
          schemes,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
      }
      // 3. Document upload query
      else if (lower.includes('document') || lower.includes('ದಾಖಲೆ') || lower.includes('upload') || lower.includes('दस्तावेज़')) {
        botMsg = {
          id: `bot-${Date.now()}`,
          sender: 'assistant',
          content:
            language === 'kn'
              ? `ಖಂಡಿತ! ನಿಮ್ಮ ಆಧಾರ್ ಕಾರ್ಡ್, ಜಮೀನಿನ ಪಹಣಿ (RTC) ಅಥವಾ ಆದಾಯ ಪ್ರಮಾಣಪತ್ರವನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ. ಸ್ಥಳೀಯ OCR ತಂತ್ರಜ್ಞಾನದ ಮೂಲಕ ತಕ್ಷಣ ಪರಿಶೀಲಿಸಲಾಗುತ್ತದೆ.\n\nದಾಖಲೆ ಅಪ್‌ಲೋಡ್ ಮಾಡಲು ಕೆಳಗಿನ ಬಟನ್ ಕ್ಲಿಕ್ ಮಾಡಿ:`
              : `अवश्य! अपना आधार कार्ड, खतौनी (RTC) या आय प्रमाण पत्र अपलोड करें। स्थानीय OCR तकनीक द्वारा तुरंत सत्यापन किया जाएगा:`,
          contentType: 'text',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setIsUploadModalOpen(true);
      }
      // 4. Status inquiry query
      else if (lower.includes('status') || lower.includes('ಸ್ಥಿತಿ') || lower.includes('ಅರ್ಜಿ ಸಂಖ್ಯೆ') || lower.includes('स्थिति')) {
        botMsg = {
          id: `bot-${Date.now()}`,
          sender: 'assistant',
          content:
            language === 'kn'
              ? `ನಿಮ್ಮ ಅರ್ಜಿಯ ಸ್ಥಿತಿಯನ್ನು ಪರಿಶೀಲಿಸಲು ಅರ್ಜಿ ಉಲ್ಲೇಖ ಸಂಖ್ಯೆಯನ್ನು (ಉದಾ: SIM-2024-00042) ಬಳಸಬಹುದು.`
              : `आवेदन की स्थिति जांचने के लिए संदर्भ संख्या (उदा. SIM-2024-00042) का उपयोग करें।`,
          contentType: 'text',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setIsTrackerOpen(true);
      }
      // 5. Default discovery
      else {
        botMsg = {
          id: `bot-${Date.now()}`,
          sender: 'assistant',
          content:
            language === 'kn'
              ? `ನಾನು ಕೇಂದ್ರ ಮತ್ತು ಕರ್ನಾಟಕ ಸರ್ಕಾರದ ಎಲ್ಲಾ ಸಕ್ರಿಯ ಯೋಜನೆಗಳನ್ನು ಹುಡುಕಬಲ್ಲೆ. ನೀವು ರೈತರೋ, ವಿದ್ಯಾರ್ಥಿಯೋ, ಅಥವಾ ಮಹಿಳಾ ಉದ್ಯಮಿಯೋ ತಿಳಿಸಿ.`
              : `मैं केंद्र और राज्य सरकार की योजनाओं की जानकारी दे सकता हूँ। कृपया बताएं कि आप किसान, छात्र या महिला उद्यमी हैं।`,
          contentType: 'scheme_list',
          schemes: MOCK_SCHEMES.slice(0, 2),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
      }

      setMessages((prev) => [...prev, botMsg]);
      setIsLoading(false);
    }, 600);
  };

  // Eligibility questionnaire callback
  const handleEligibilityConfirmed = async (
    profile: CitizenProfile,
    result: EligibilityAssessmentResult
  ) => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Bot response about assessment
    const assessMsg: ChatMessageType = {
      id: `bot-assess-${Date.now()}`,
      sender: 'assistant',
      content:
        language === 'kn'
          ? `ಅರ್ಹತಾ ಪರಿಶೀಲನೆ ಪೂರ್ಣಗೊಂಡಿದೆ! ನಿಮ್ಮ ಅರ್ಹತಾ ಸ್ಕೋರ್: ${result.score}%\n\nಈಗ ನಿಮ್ಮ ಆಧಾರ್ ಮತ್ತು ಪಹಣಿ (RTC) ದಾಖಲೆಗಳನ್ನು ಲಗತ್ತಿಸಿ.`
          : `पात्रता जांच पूर्ण हुई! पात्रता स्कोर: ${result.score}%\n\nअब अपने आधार एवं भूमि अभिलेख अपलोड करें।`,
      contentType: 'text',
      timestamp: now,
    };

    setMessages((prev) => [...prev, assessMsg]);

    // Open upload modal automatically for seamless citizen UX
    setTimeout(() => {
      setIsUploadModalOpen(true);
    }, 500);
  };

  // Document OCR processed callback
  const handleDocumentProcessed = async (result: DocumentVerificationResult) => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Append OCR verification card
    const ocrMsg: ChatMessageType = {
      id: `bot-ocr-${Date.now()}`,
      sender: 'assistant',
      content:
        result.validation_status === 'VALID'
          ? language === 'kn'
            ? `ದಾಖಲೆ ಯಶಸ್ವಿಯಾಗಿ ಪರಿಶೀಲನೆಗೊಂಡಿದೆ! ✅\nಸ್ಥಳೀಯ Tesseract OCR ಎಂಜಿನ್ ಮೂಲಕ ಹೆಸರು ಮತ್ತು ಸಂಖ್ಯೆ ತಾಳೆಯಾಗಿದೆ.`
            : `दस्तावेज़ सफलतापूर्वक सत्यापित हुआ! ✅\nस्थानीय OCR द्वारा विवरण मेल खा गया है।`
          : language === 'kn'
            ? `⚠️ ಗಮನಿಸಿ: ದಾಖಲೆ ಮಸುಕಾಗಿದೆ. ಸ್ಪಷ್ಟವಾದ ಫೋಟೋ ಮರು-ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.`
            : `⚠️ ध्यान दें: दस्तावेज़ धुंधला है। कृपया साफ़ फ़ोटो पुनः अपलोड करें।`,
      contentType: 'ocr_result',
      ocrResult: result,
      timestamp: now,
    };

    setMessages((prev) => [...prev, ocrMsg]);

    // If valid, generate consequential 5-minute single-use token summary
    if (result.validation_status === 'VALID') {
      setIsLoading(true);
      try {
        const preview = await mockService.generateApplicationPreview(
          'sch-pm-kisan-01',
          {
            citizen_group: 'FARMER',
            annual_income: 80000,
            land_holding_acres: 1.5,
            has_bank_account: true,
            village: 'Maddur (ಮದ್ದೂರು)',
            district: 'Mandya (ಮಂಡ್ಯ)',
          },
          'Ramu Nayak (ರಾಮು ನಾಯಕ್)'
        );

        const summaryMsg: ChatMessageType = {
          id: `bot-summary-${Date.now()}`,
          sender: 'assistant',
          content:
            language === 'kn'
              ? `ಅರ್ಜಿ ಸಿದ್ಧವಾಗಿದೆ. ದಯವಿಟ್ಟು ವಿವರಗಳನ್ನು ಪರಿಶೀಲಿಸಿ 5 ನಿಮಿಷಗಳ ಒಳಗೆ ದೃಢೀಕರಿಸಿ ಸಲ್ಲಿಸಿ:`
              : `आवेदन तैयार है। कृपया समीक्षा करें और 5 मिनट के भीतर पुष्टि कर जमा करें:`,
          contentType: 'application_summary',
          applicationPreview: preview,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages((prev) => [...prev, summaryMsg]);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Consequential Single-Use Token Submission
  const handleConfirmSubmit = async (token: string) => {
    setIsSubmitting(true);
    try {
      const activeSummaryMsg = messages
        .slice()
        .reverse()
        .find((m) => m.applicationPreview);

      const preview = activeSummaryMsg?.applicationPreview;
      if (!preview) return;

      const result = await api.submitApplication(
        preview.application_id,
        token,
        preview,
        [SAMPLE_OCR_SAMPLES.valid_aadhaar, SAMPLE_OCR_SAMPLES.valid_land_record]
      );

      setSubmissionResult(result);
      setTrackingReference(result.submission_reference);

      // Add receipt message in chat
      const receiptMsg: ChatMessageType = {
        id: `bot-receipt-${Date.now()}`,
        sender: 'assistant',
        content:
          language === 'kn'
            ? `ಅರ್ಜಿ ಯಶಸ್ವಿಯಾಗಿ ಸಲ್ಲಿಕೆಯಾಗಿದೆ! 🎉\n\nಅರ್ಜಿ ಉಲ್ಲೇಖ ಸಂಖ್ಯೆ: ${result.submission_reference}\nಸ್ಥಿತಿ: ಗ್ರಾಮ ಪಂಚಾಯತಿ ಅಧಿಕಾರಿ ಪರಿಶೀಲನೆಗೆ ರವಾನಿಸಲಾಗಿದೆ.`
            : `आवेदन सफलतापूर्वक जमा हो गया! 🎉\n\nसंदर्भ संख्या: ${result.submission_reference}\nस्थिति: ग्राम पंचायत अधिकारी समीक्षा हेतु भेजा गया।`,
        contentType: 'submission_receipt',
        submissionResult: result,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, receiptMsg]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col ${
        viewMode === 'whatsapp' ? 'bg-[#ECE5DD]' : 'bg-slate-50'
      }`}
    >
      {/* Sticky Header with Brand, Lang Switcher & Modes */}
      <CitizenHeader
        viewMode={viewMode}
        onToggleViewMode={() =>
          setViewMode(viewMode === 'chat' ? 'whatsapp' : 'chat')
        }
        onResetChat={initGreeting}
      />

      {/* Suggested Questions Ribbon */}
      <QuickSuggestions onSelectSuggestion={handleSendMessage} />

      {/* Main Chat Messages Container */}
      <main className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 max-w-4xl mx-auto w-full space-y-1">
        {/* Synthetic Data Demo Notice Pill */}
        <div className="flex justify-center mb-3">
          <div className="bg-amber-100/90 text-amber-900 border border-amber-300 text-[11px] px-3 py-1 rounded-full flex items-center space-x-1.5 shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
            <span>
              <strong>ಡೆಮೊ ಮೋಡ್:</strong> ಸಂಶ್ಲೇಷಿತ ಡೇಟಾ (Synthetic Demo - Ramu Nayak). ಅಧಿಕೃತ ಸಲ್ಲಿಕೆಯಲ್ಲ.
            </span>
          </div>
        </div>

        {/* Message bubbles */}
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            onCheckEligibility={(scheme) => setSelectedSchemeForQuiz(scheme)}
            onApplyScheme={(scheme) => setSelectedSchemeForQuiz(scheme)}
            onConfirmSubmit={handleConfirmSubmit}
            onReuploadDoc={() => setIsUploadModalOpen(true)}
            isSubmitting={isSubmitting}
          />
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex items-center space-x-2 text-slate-500 text-xs py-2 px-3 bg-white/70 backdrop-blur-sm rounded-xl max-w-[160px] shadow-soft animate-pulse">
            <Bot className="w-4 h-4 text-whatsapp-teal" />
            <span>ಗ್ರಾಮ ಸಾಥಿ ಯೋಚಿಸುತ್ತಿದೆ...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Input bar */}
      <ChatInput
        onSendMessage={handleSendMessage}
        onOpenAttachment={() => setIsUploadModalOpen(true)}
        isLoading={isLoading || isSubmitting}
      />

      {/* Modals */}
      {selectedSchemeForQuiz && (
        <EligibilityQuizModal
          scheme={selectedSchemeForQuiz}
          isOpen={!!selectedSchemeForQuiz}
          onClose={() => setSelectedSchemeForQuiz(null)}
          onEligibilityConfirmed={handleEligibilityConfirmed}
        />
      )}

      {isUploadModalOpen && (
        <DocumentUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onDocumentProcessed={handleDocumentProcessed}
          defaultDocType="AADHAAR"
        />
      )}

      {submissionResult && (
        <SubmissionSuccessModal
          submissionResult={submissionResult}
          isOpen={!!submissionResult}
          onClose={() => setSubmissionResult(null)}
          onOpenTracker={() => setIsTrackerOpen(true)}
        />
      )}

      {isTrackerOpen && (
        <StatusTrackerModal
          isOpen={isTrackerOpen}
          onClose={() => setIsTrackerOpen(false)}
          initialReference={trackingReference}
        />
      )}
    </div>
  );
};
