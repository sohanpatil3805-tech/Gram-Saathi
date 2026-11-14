import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { Mic, MicOff, Send, X, AlertCircle, RotateCcw } from 'lucide-react';

interface VoiceInputProps {
  onTranscriptComplete: (text: string) => void;
  onClose?: () => void;
}

export const VoiceInput: React.FC<VoiceInputProps> = ({
  onTranscriptComplete,
  onClose,
}) => {
  const { t, language } = useLanguage();

  const [isSupported, setIsSupported] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  });
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  const getLanguageCode = () => {
    switch (language) {
      case 'kn':
        return 'kn-IN';
      case 'hi':
        return 'hi-IN';
      case 'en':
      default:
        return 'en-IN';
    }
  };

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = getLanguageCode();

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setError(t('voicePermissionDenied'));
        } else if (event.error === 'no-speech') {
          setError(t('voiceNoSpeech'));
        } else {
          setError(`Error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch {
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, [language, t]);

  const startListening = () => {
    if (!recognitionRef.current) return;
    setError(null);
    setTranscript('');
    try {
      recognitionRef.current.lang = getLanguageCode();
      recognitionRef.current.start();
    } catch {
      // In case already started
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
  };

  const handleSend = () => {
    if (!transcript.trim()) return;
    onTranscriptComplete(transcript.trim());
    if (onClose) onClose();
  };

  if (!isSupported) {
    return (
      <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-xs text-amber-900 flex items-start justify-between space-x-2 animate-fade-in">
        <div className="flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <span>{t('voiceUnsupported')}</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-lg space-y-3 animate-fade-in">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isListening ? 'bg-red-500 animate-ping' : 'bg-slate-300'
            }`}
          ></span>
          <span className="font-bold text-xs text-slate-800">
            {isListening ? t('voiceRecording') : t('voiceTapToSpeak')}
          </span>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
            {getLanguageCode()}
          </span>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Big Mic Button & Waveform */}
      <div className="flex flex-col items-center justify-center py-2 space-y-2">
        <button
          type="button"
          onClick={isListening ? stopListening : startListening}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 ${
            isListening
              ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-200'
              : 'bg-whatsapp-teal hover:bg-whatsapp-darkTeal text-white'
          }`}
          title={isListening ? 'Stop recording' : 'Start recording'}
        >
          {isListening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
        </button>

        <p className="text-[11px] text-slate-400">
          {isListening ? 'Tap mic when finished' : 'Tap mic to start speaking'}
        </p>
      </div>

      {/* Editable Transcript */}
      <div className="space-y-2">
        <label className="block text-[11px] font-semibold text-slate-500">
          {t('voiceTranscript')}:
        </label>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder={isListening ? 'Listening...' : 'Your spoken words will appear here...'}
          rows={2}
          className="w-full text-xs p-2.5 border border-slate-300 rounded-xl outline-none focus:border-whatsapp-teal focus:ring-1 focus:ring-whatsapp-teal bg-slate-50"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => setTranscript('')}
          disabled={!transcript}
          className="text-xs text-slate-500 hover:text-slate-700 disabled:text-slate-300 flex items-center space-x-1"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{t('voiceClearBtn')}</span>
        </button>

        <button
          type="button"
          onClick={handleSend}
          disabled={!transcript.trim()}
          className="bg-whatsapp-teal hover:bg-whatsapp-darkTeal disabled:bg-slate-300 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm flex items-center space-x-1.5 transition-all active:scale-95 disabled:cursor-not-allowed"
        >
          <span>{t('voiceSendBtn')}</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default VoiceInput;
