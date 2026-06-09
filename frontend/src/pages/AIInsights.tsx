import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ChatMessage from '../components/ChatMessage';
import ChatInput from '../components/ChatInput';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  timestamp?: string;
}

interface UsageStats {
  questionsAsked: number;
  questionLimit: number | string;
  remaining: number | string;
  isPremium: boolean;
  resetDate: string;
}

const AIInsights: React.FC = () => {
  const { userId, token, currentUser, loading: authLoading } = useAuth();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (userId) {
      loadChatHistory();
      loadUsageStats();
    }
  }, [userId]);

  const loadUsageStats = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/ai/usage/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success) {
        setUsageStats(data.usage);
      }
    } catch (error) {
      console.error('Failed to load usage stats:', error);
    }
  };

  const loadChatHistory = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/ai/history/${userId}?limit=20`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();

      if (data.success && data.conversations.length > 0) {
        const historyMessages: Message[] = [];
        data.conversations.reverse().forEach((conv: any) => {
          historyMessages.push({
            role: 'user',
            content: conv.question,
            timestamp: conv.timestamp
          });
          historyMessages.push({
            role: 'assistant',
            content: conv.answer,
            sources: conv.sources,
            timestamp: conv.timestamp
          });
        });
        setMessages(historyMessages);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const handleSendMessage = async (question: string) => {
    if (!userId) {
      setError('Please log in to use AI advisor');
      return;
    }

    const userMessage: Message = {
      role: 'user',
      content: question,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: userId,
          question: question
        })
      });

      const data = await response.json();

      if (data.success) {
        const aiMessage: Message = {
          role: 'assistant',
          content: data.answer,
          sources: data.sources,
          timestamp: data.timestamp
        };
        setMessages(prev => [...prev, aiMessage]);
        
        // ✅ Update usage stats
        if (data.usage) {
          setUsageStats({
            questionsAsked: data.usage.current,
            questionLimit: data.usage.limit,
            remaining: data.usage.remaining,
            isPremium: false,
            resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()
          });
        }
      } else if (data.limitReached) {
        // ✅ Handle limit reached
        setError(`${data.message} Upgrade to Premium for unlimited questions!`);
      } else {
        setError(data.message || 'Failed to get response');
      }
    } catch (error) {
      console.error('Chat error:', error);
      setError('Failed to connect to AI service. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewConversation = () => {
    if (window.confirm('Start a new conversation? Current chat will be saved.')) {
      setMessages([]);
      setError(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🔄</div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Login Required
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Please log in to use the AI Portfolio Advisor
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              🤖 AI Portfolio Advisor
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Get insights about your portfolio • {currentUser?.email}
            </p>
          </div>
          
          {/* ✅ USAGE STATS DISPLAY */}
          {usageStats && (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Questions This Month
                </div>
                <div className={`text-lg font-bold ${
                  usageStats.remaining === 0 
                    ? 'text-red-600 dark:text-red-400'
                    : typeof usageStats.remaining === 'number' && usageStats.remaining <= 3
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-green-600 dark:text-green-400'
                }`}>
                  {usageStats.isPremium ? '∞' : `${usageStats.remaining}/${usageStats.questionLimit}`}
                </div>
                {!usageStats.isPremium && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Resets {new Date(usageStats.resetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                )}
              </div>
              
              <button
                onClick={handleNewConversation}
                className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 
                         hover:bg-gray-200 dark:hover:bg-gray-600
                         text-gray-700 dark:text-gray-300 rounded-lg
                         transition-colors"
              >
                New Chat
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-4xl mx-auto">
          {messages.length === 0 && !loading && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">💬</div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Ask me anything about your portfolio!
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                I can help you understand your investments, risk, and performance.
              </p>
              
              {/* Suggested Questions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
                {[
                  "What's my best performing stock?",
                  "Why am I underperforming NIFTY?",
                  "Is my portfolio too risky?",
                  "Should I diversify more?"
                ].map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSendMessage(suggestion)}
                    disabled={usageStats?.remaining === 0}
                    className="text-left px-4 py-3 bg-white dark:bg-gray-800 
                             border border-gray-200 dark:border-gray-700
                             rounded-lg hover:border-blue-500 dark:hover:border-blue-500
                             transition-colors text-sm text-gray-700 dark:text-gray-300
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    💡 {suggestion}
                  </button>
                ))}
              </div>
              
              {/* ✅ LIMIT WARNING */}
              {usageStats && usageStats.remaining === 0 && (
                <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg max-w-md mx-auto">
                  <p className="text-sm text-red-700 dark:text-red-400 font-semibold">
                    ⚠️ Monthly limit reached
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                    You've used all {usageStats.questionLimit} questions this month. 
                    Resets on {new Date(usageStats.resetDate).toLocaleDateString()}.
                  </p>
                </div>
              )}
            </div>
          )}

          {messages.map((message, index) => (
            <ChatMessage
              key={index}
              role={message.role}
              content={message.content}
              sources={message.sources}
              timestamp={message.timestamp}
            />
          ))}

          {loading && (
            <div className="flex justify-start mb-4">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🤖</span>
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 
                          rounded-lg px-4 py-3 mb-4">
              <p className="text-sm text-red-700 dark:text-red-400">
                ⚠️ {error}
              </p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <ChatInput
        onSend={handleSendMessage}
        disabled={loading || usageStats?.remaining === 0}
        placeholder={
          usageStats?.remaining === 0 
            ? 'Monthly limit reached. Resets next month...'
            : loading 
            ? 'AI is thinking...' 
            : 'Ask about your portfolio...'
        }
      />
    </div>
  );
};

export default AIInsights;
