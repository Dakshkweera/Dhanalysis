import React from 'react';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  timestamp?: string;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ 
  role, 
  content, 
  sources, 
  timestamp 
}) => {
  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-3xl ${
        role === 'user' 
          ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm' 
          : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl rounded-tl-sm border border-gray-200 dark:border-gray-700'
      } px-4 py-3 shadow-sm`}>
        
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">
            {role === 'user' ? '👤' : '🤖'}
          </span>
          <span className={`text-sm font-semibold ${
            role === 'user' 
              ? 'text-blue-100' 
              : 'text-blue-600 dark:text-blue-400'
          }`}>
            {role === 'user' ? 'You' : 'AI Advisor'}
          </span>
        </div>

        {/* Content */}
        <div className="whitespace-pre-wrap leading-relaxed text-sm">
          {content}
        </div>

        {/* Sources */}
        {sources && sources.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                📚 Sources:
              </span>
            </div>
            <div className="space-y-1">
              {sources.map((source, idx) => (
                <a
                  key={idx}
                  href={source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs text-blue-600 dark:text-blue-400 
                           hover:text-blue-800 dark:hover:text-blue-300 
                           hover:underline truncate"
                >
                  • {source}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer for AI messages */}
        {role === 'assistant' && (
          <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
            <p className="text-xs text-yellow-600 dark:text-yellow-500 flex items-center gap-1">
              <span>⚠️</span>
              <em>
                Disclaimer: This is not financial advice. Always consult a SEBI-registered 
                investment advisor before making investment decisions.
              </em>
            </p>
          </div>
        )}

        {/* Timestamp */}
        {timestamp && (
          <div className={`text-xs mt-2 ${
            role === 'user' 
              ? 'text-blue-100' 
              : 'text-gray-500 dark:text-gray-400'
          }`}>
            {formatTime(timestamp)}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
