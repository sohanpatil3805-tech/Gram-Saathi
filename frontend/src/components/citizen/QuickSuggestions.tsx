import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { 
  Sparkles, 
  Sprout, 
  GraduationCap, 
  FileCheck2, 
  Upload, 
  Search 
} from 'lucide-react';

interface QuickSuggestionsProps {
  onSelectSuggestion: (query: string) => void;
}

export const QuickSuggestions: React.FC<QuickSuggestionsProps> = ({ onSelectSuggestion }) => {
  const { t, language } = useLanguage();

  const suggestions = [
    {
      id: 'q1',
      text: t('q1'),
      icon: Search,
      bg: 'hover:bg-emerald-50 hover:border-emerald-300 text-emerald-900',
    },
    {
      id: 'q3',
      text: t('q3'),
      icon: Sprout,
      bg: 'hover:bg-lime-50 hover:border-lime-300 text-lime-900',
    },
    {
      id: 'q4',
      text: t('q4'),
      icon: GraduationCap,
      bg: 'hover:bg-blue-50 hover:border-blue-300 text-blue-900',
    },
    {
      id: 'q2',
      text: t('q2'),
      icon: Sparkles,
      bg: 'hover:bg-amber-50 hover:border-amber-300 text-amber-900',
    },
    {
      id: 'q5',
      text: t('q5'),
      icon: Upload,
      bg: 'hover:bg-indigo-50 hover:border-indigo-300 text-indigo-900',
    },
    {
      id: 'q6',
      text: t('q6'),
      icon: FileCheck2,
      bg: 'hover:bg-teal-50 hover:border-teal-300 text-teal-900',
    },
  ];

  return (
    <div className="py-2 px-3 border-b border-slate-200/80 bg-white/70 backdrop-blur-sm">
      <div className="max-w-4xl mx-auto">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>{t('suggestedQuestionsTitle')}</span>
        </p>
        <div className="flex overflow-x-auto gap-1.5 pb-1 no-scrollbar scroll-smooth">
          {suggestions.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onSelectSuggestion(item.text)}
                className={`flex-shrink-0 flex items-center space-x-1.5 text-xs font-medium bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm transition-all active:scale-95 ${item.bg}`}
              >
                <Icon className="w-3.5 h-3.5 opacity-80" />
                <span className="whitespace-nowrap">{item.text}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
