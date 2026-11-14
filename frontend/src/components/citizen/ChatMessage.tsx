import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { ChatMessage as ChatMessageType } from '../../types/citizen';
import { DiscoveredScheme } from '../../types/api';
import { CheckCheck, Bot, User, Sparkles, Volume2, VolumeX, Square, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { SchemeCard } from './SchemeCard';
import { OCRResultCard } from './OCRResultCard';
import { ApplicationSummaryCard } from './ApplicationSummaryCard';

interface ChatMessageProps {
  message: ChatMessageType;
  onCheckEligibility?: (scheme: DiscoveredScheme) => void;
  onApplyScheme?: (scheme: DiscoveredScheme) => void;
  onConfirmSubmit?: (token: string) => void;
  onReuploadDoc?: () => void;
  isSubmitting?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onCheckEligibility,
  onApplyScheme,
  onConfirmSubmit,
  onReuploadDoc,
  isSubmitting,
}) => {
  const { t, language } = useLanguage();
  const isUser = message.sender === 'user';
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasSpeechSynthesis, setHasSpeechSynthesis] = useState(false);
  const [schemePage, setSchemePage] = useState(1);
  const SCHEMES_PER_PAGE = 4;
  const [showAllSchemes, setShowAllSchemes] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setHasSpeechSynthesis(true);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (isSpeaking && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSpeaking]);

  const handleToggleSpeak = () => {
    if (!hasSpeechSynthesis || !message.content) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(message.content);
      utterance.lang = language === 'kn' ? 'kn-IN' : language === 'hi' ? 'hi-IN' : 'en-IN';
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    } catch {
      setIsSpeaking(false);
    }
  };

  return (
    <div
      className={`flex w-full mb-3 animate-fade-in ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      <div className={`flex max-w-[92%] sm:max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end gap-1.5`}>
        {/* Avatar */}
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs shadow-sm ${
            isUser
              ? 'bg-emerald-600 text-white'
              : 'bg-whatsapp-teal text-white'
          }`}
        >
          {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
        </div>

        {/* Message Bubble Container */}
        <div
          className={`rounded-2xl px-3.5 py-2.5 shadow-soft text-xs sm:text-sm ${
            isUser
              ? 'bg-whatsapp-outgoing text-slate-900 rounded-br-xs border border-emerald-200/60'
              : 'bg-white text-slate-800 rounded-bl-xs border border-slate-200/80'
          }`}
        >
          {/* Official Provider Badge */}
          {!isUser && message.aiProvider && (
            <div className="flex items-center space-x-1 mb-1.5 text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md w-fit border border-emerald-200/60">
              <ShieldCheck className="w-3 h-3 text-emerald-600 flex-shrink-0" />
              <span>
                {message.aiProvider === 'local_scheme_repository'
                  ? (language === 'kn' ? 'ಅಧಿಕೃತ ಸ್ಥಳೀಯ ಯೋಜನಾ ದಾಖಲೆಗಳಿಂದ ಪರಿಶೀಲಿಸಲಾಗಿದೆ' : language === 'hi' ? 'सत्यापित स्थानीय सरकारी रिकॉर्ड' : 'Verified Local Government Record')
                  : (language === 'kn' ? 'AI ನೆರವಿನ ಸಾರ್ವಜನಿಕ ಮಾರ್ಗದರ್ಶನ' : language === 'hi' ? 'AI सहायित सार्वजनिक मार्गदर्शन' : 'AI-Assisted Public Guidance')}
              </span>
            </div>
          )}

          {/* Main Text Content */}
          {message.content && (
            <p className="whitespace-pre-line leading-relaxed select-text">
              {message.content}
            </p>
          )}

          {/* Scheme recommendation cards (if any) */}
          {message.schemes && message.schemes.length > 0 && onCheckEligibility && onApplyScheme && (() => {
            const totalSchemes = message.schemes.length;
            const totalPages = Math.ceil(totalSchemes / SCHEMES_PER_PAGE);
            const displayed = showAllSchemes
              ? message.schemes
              : message.schemes.slice((schemePage - 1) * SCHEMES_PER_PAGE, schemePage * SCHEMES_PER_PAGE);

            return (
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-saathi-800 uppercase tracking-wider">
                  <span className="flex items-center space-x-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>
                      {t('schemesFound')} ({totalSchemes})
                    </span>
                  </span>
                  {totalSchemes > SCHEMES_PER_PAGE && (
                    <button
                      type="button"
                      onClick={() => setShowAllSchemes(!showAllSchemes)}
                      className="text-[10px] text-emerald-700 hover:text-emerald-900 underline font-semibold normal-case"
                    >
                      {showAllSchemes
                        ? (language === 'kn' ? 'ಪುಟ ವಿಭಾಗ ತೋರಿಸಿ' : language === 'hi' ? 'पृष्ठ दृश्य' : 'Show pages')
                        : (language === 'kn' ? `ಎಲ್ಲಾ ${totalSchemes} ವೀಕ್ಷಿಸಿ` : language === 'hi' ? `सभी ${totalSchemes} देखें` : `View all ${totalSchemes}`)}
                    </button>
                  )}
                </div>

                {displayed.map((scheme) => (
                  <SchemeCard
                    key={scheme.scheme_id}
                    scheme={scheme}
                    onCheckEligibility={onCheckEligibility}
                    onApply={onApplyScheme}
                  />
                ))}

                {!showAllSchemes && totalPages > 1 && (
                  <div className="flex items-center justify-between pt-1 text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      disabled={schemePage <= 1}
                      onClick={() => setSchemePage((p) => Math.max(1, p - 1))}
                      className="flex items-center space-x-1 px-2 py-0.5 rounded text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-[11px]"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>{language === 'kn' ? 'ಹಿಂದಿನ' : language === 'hi' ? 'पिछला' : 'Previous'}</span>
                    </button>
                    <span className="text-[11px] font-semibold text-slate-700">
                      {language === 'kn'
                        ? `ಪುಟ ${schemePage} / ${totalPages}`
                        : language === 'hi'
                        ? `पृष्ठ ${schemePage} / ${totalPages}`
                        : `Page ${schemePage} of ${totalPages}`}
                    </span>
                    <button
                      type="button"
                      disabled={schemePage >= totalPages}
                      onClick={() => setSchemePage((p) => Math.min(totalPages, p + 1))}
                      className="flex items-center space-x-1 px-2 py-0.5 rounded text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-[11px]"
                    >
                      <span>{language === 'kn' ? 'ಮುಂದಿನ' : language === 'hi' ? 'अगला' : 'Next'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* OCR Result card (if any) */}
          {message.ocrResult && (
            <OCRResultCard
              ocrResult={message.ocrResult}
              onReupload={onReuploadDoc}
            />
          )}

          {/* Consequential Application Confirmation Card (if any) */}
          {message.applicationPreview && onConfirmSubmit && (
            <ApplicationSummaryCard
              preview={message.applicationPreview}
              onConfirmSubmit={onConfirmSubmit}
              isSubmitting={isSubmitting}
            />
          )}

          {/* Bottom Bar: Timestamp, Speak button, Double Checkmarks */}
          <div
            className={`flex items-center justify-between text-[10px] text-slate-400 mt-1 select-none font-mono ${
              isUser ? 'text-emerald-800/60' : 'text-slate-400'
            }`}
          >
            {/* Text-to-speech speaker button for bot messages */}
            {!isUser && hasSpeechSynthesis && message.content && (
              <button
                type="button"
                onClick={handleToggleSpeak}
                className={`p-1 rounded-md transition-colors flex items-center space-x-1 ${
                  isSpeaking
                    ? 'text-red-600 bg-red-50 hover:bg-red-100'
                    : 'text-slate-400 hover:text-whatsapp-teal hover:bg-slate-100'
                }`}
                title={isSpeaking ? 'Stop reading' : 'Read aloud'}
              >
                {isSpeaking ? (
                  <>
                    <VolumeX className="w-3 h-3 animate-pulse text-red-500" />
                    <span className="text-[9px] font-sans font-semibold">Stop</span>
                  </>
                ) : (
                  <Volume2 className="w-3 h-3" />
                )}
              </button>
            )}

            {isUser && <div></div>}

            <div className="flex items-center space-x-1">
              <span>{message.timestamp}</span>
              {isUser && <CheckCheck className="w-3.5 h-3.5 text-blue-500 inline" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
