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

const AIInsights: React.FC = () => {
  const { userId, token, currentUser, loading: authLoading } = useAuth();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    }
  }, [userId]);

  const loadChatHistory = async () => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/ai/history/${userId}?limit=20`
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
      const response = await fetch('http://localhost:5000/api/ai/chat', {
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
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              🤖 AI Portfolio Advisor
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Get insights about your portfolio • {currentUser?.email}
            </p>
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
      </div>

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
                    className="text-left px-4 py-3 bg-white dark:bg-gray-800 
                             border border-gray-200 dark:border-gray-700
                             rounded-lg hover:border-blue-500 dark:hover:border-blue-500
                             transition-colors text-sm text-gray-700 dark:text-gray-300"
                  >
                    💡 {suggestion}
                  </button>
                ))}
              </div>
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

      <ChatInput
        onSend={handleSendMessage}
        disabled={loading}
        placeholder={loading ? 'AI is thinking...' : 'Ask about your portfolio...'}
      />
    </div>
  );
};

export default AIInsights;
