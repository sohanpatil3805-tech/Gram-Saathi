import React, { useState, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { 
  Send, 
  Paperclip, 
  Mic, 
  Camera, 
  Smile, 
  Sparkles,
  Volume2
} from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  onOpenAttachment: () => void;
  isLoading?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onOpenAttachment,
  isLoading = false,
}) => {
  const { t, language } = useLanguage();
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleVoiceClick = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      // Demo voice transcription simulation
      setTimeout(() => {
        const sampleVoiceText =
          language === 'kn'
            ? 'ನನಗೆ ರೈತ ಯೋಜನೆಗಳ ಮಾಹಿತಿ ಬೇಕು'
            : 'मुझे किसान योजनाओं की जानकारी चाहिए';
        setInputText(sampleVoiceText);
        setIsRecording(false);
      }, 1500);
    }
  };

  return (
    <div className="sticky bottom-0 z-20 bg-slate-100/90 backdrop-blur-md border-t border-slate-200/80 p-2 sm:p-3">
      <div className="max-w-4xl mx-auto">
        {/* Voice recording indicator if active */}
        {isRecording && (
          <div className="mb-2 bg-emerald-50 border border-emerald-300 rounded-xl px-3 py-1.5 flex items-center justify-between text-xs text-emerald-900 animate-pulse">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
              <span className="font-semibold">
                {language === 'kn' ? 'ಭಾಷಿಣಿ ವಾಯ್ಸ್ ರೆಕಾರ್ಡಿಂಗ್ (ಕನ್ನಡ)...' : 'भाषिणी वॉइस रिकॉर्डिंग (हिंदी)...'}
              </span>
            </div>
            <span className="text-[10px] text-emerald-700 font-mono">Bhashini Speech API</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-center space-x-1.5 sm:space-x-2">
          {/* Attachment button */}
          <button
            type="button"
            onClick={onOpenAttachment}
            className="p-2 sm:p-2.5 text-slate-500 hover:text-whatsapp-teal hover:bg-white rounded-full transition-all active:scale-95 shadow-sm bg-white/80 border border-slate-200"
            title={t('attachDocument')}
          >
            <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Quick Camera button */}
          <button
            type="button"
            onClick={onOpenAttachment}
            className="p-2 sm:p-2.5 text-slate-500 hover:text-whatsapp-teal hover:bg-white rounded-full transition-all active:scale-95 shadow-sm bg-white/80 border border-slate-200"
            title={t('takePhoto')}
          >
            <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Main Text Input */}
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={t('inputPlaceholder')}
              className="w-full text-xs sm:text-sm bg-white border border-slate-300 rounded-full py-2.5 px-4 pr-10 focus:ring-2 focus:ring-whatsapp-teal/30 focus:border-whatsapp-teal outline-none transition-all shadow-inner"
            />
          </div>

          {/* Voice Microphone (BHASHINI stub) */}
          <button
            type="button"
            onClick={handleVoiceClick}
            className={`p-2.5 rounded-full transition-all shadow-sm active:scale-95 ${
              isRecording
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-white text-slate-600 hover:text-whatsapp-teal hover:bg-slate-50 border border-slate-200'
            }`}
            title={t('voiceInputTitle')}
          >
            <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="p-2.5 bg-whatsapp-teal hover:bg-whatsapp-darkTeal disabled:bg-slate-300 text-white rounded-full shadow-md transition-all active:scale-95 disabled:cursor-not-allowed flex-shrink-0"
            title={t('send')}
          >
            <Send className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};
