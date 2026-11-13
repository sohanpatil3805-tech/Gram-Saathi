import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { ChatMessage as ChatMessageType } from '../../types/citizen';
import { Scheme } from '../../types/api';
import { CheckCheck, Bot, User, Sparkles } from 'lucide-react';
import { SchemeCard } from './SchemeCard';
import { OCRResultCard } from './OCRResultCard';
import { ApplicationSummaryCard } from './ApplicationSummaryCard';

interface ChatMessageProps {
  message: ChatMessageType;
  onCheckEligibility?: (scheme: Scheme) => void;
  onApplyScheme?: (scheme: Scheme) => void;
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
  const { t } = useLanguage();
  const isUser = message.sender === 'user';

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
          {/* Main Text Content */}
          {message.content && (
            <p className="whitespace-pre-line leading-relaxed select-text">
              {message.content}
            </p>
          )}

          {/* Scheme recommendation cards (if any) */}
          {message.schemes && message.schemes.length > 0 && onCheckEligibility && onApplyScheme && (
            <div className="mt-2 space-y-2">
              <p className="text-[11px] font-bold text-saathi-800 uppercase tracking-wider flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{t('schemesFound')}</span>
              </p>
              {message.schemes.map((scheme: Scheme) => (
                <SchemeCard
                  key={scheme.id}
                  scheme={scheme}
                  onCheckEligibility={onCheckEligibility}
                  onApply={onApplyScheme}
                />
              ))}
            </div>
          )}

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

          {/* Timestamp and Double Checkmarks */}
          <div
            className={`flex items-center justify-end space-x-1 text-[10px] text-slate-400 mt-1 select-none font-mono ${
              isUser ? 'text-emerald-800/60' : 'text-slate-400'
            }`}
          >
            <span>{message.timestamp}</span>
            {isUser && <CheckCheck className="w-3.5 h-3.5 text-blue-500 inline" />}
          </div>
        </div>
      </div>
    </div>
  );
};
