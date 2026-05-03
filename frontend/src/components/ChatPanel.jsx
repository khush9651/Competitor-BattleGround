import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { normalizeStructuredSources } from '../utils/sources.js';

const SUGGESTIONS = [
  'What makes them different from competitors?',
  'What are their pricing plans?',
  'Who is their target customer?',
  'What are their biggest weaknesses?',
];

function ConfidenceBanner({ confidence }) {
  if (!confidence?.label || confidence.label === 'High') return null;
  const isLow = confidence.label === 'Low';
  return (
    <div
      className={`mt-2 rounded-lg px-3 py-2 text-xs leading-relaxed transition-colors duration-300 ${
        isLow
          ? 'border border-red-200 bg-red-50 text-red-900 dark:border-red-500/35 dark:bg-red-950/35 dark:text-red-200'
          : 'border border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200'
      }`}
    >
      {isLow ? '⚠️' : 'ℹ️'}{' '}
      <strong>{confidence.label}</strong> confidence
      {typeof confidence.value === 'number' && ` (${confidence.value.toFixed(2)})`}.
      {isLow ? ' Treat this reply as unreliable unless snippets match.' : ''}
    </div>
  );
}

export default function ChatPanel({ sessionId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [highDemandHint, setHighDemandHint] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!loading) {
      setHighDemandHint(false);
      return undefined;
    }
    const t = setTimeout(() => setHighDemandHint(true), 2700);
    return () => clearTimeout(t);
  }, [loading]);

  const sendMessage = async (text) => {
    const q = (text || input).trim();
    if (!q || loading) return;

    setMessages((prev) => [...prev, { role: 'user', content: q }]);
    setInput('');
    setLoading(true);

    try {
      const res = await axios.post('/api/ask', { sessionId, question: q });
      const rawSources = res.data.sources || [];
      const prov = res.data.llm?.provider;
      const fallbackNote =
        prov && prov !== 'groq'
          ? `\n\n_Using backup model (${prov}) — still strictly grounded on scraped context._`
          : '';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `${res.data.answer}${fallbackNote}`,
          sources: normalizeStructuredSources(rawSources),
          confidence: res.data.confidence,
        },
      ]);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to get an answer. Please try again.';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: msg, sources: [], confidence: null },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-auto min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-xl backdrop-blur-md transition-colors duration-300 dark:border-white/10 dark:bg-slate-900/70 md:h-full">
      <header className="shrink-0 border-b border-slate-200 bg-indigo-50/80 px-4 py-3 transition-colors duration-300 dark:border-white/10 dark:bg-indigo-500/5">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 transition-colors duration-300 dark:text-white">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75 dark:bg-emerald-400" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
          </span>
          Ask follow-ups
        </div>
        <p className="mt-1 text-[11px] text-slate-600 transition-colors duration-300 dark:text-slate-500">
          Hybrid RAG • same corpus as dashboard
        </p>
      </header>

      <div className="min-h-0 flex-initial space-y-3 overflow-y-auto p-4 md:flex-1">
        {messages.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/40">
            <div className="mb-3 text-2xl">💬</div>
            <h4 className="text-sm font-semibold text-slate-800 transition-colors duration-300 dark:text-slate-300">
              Anything about this competitor
            </h4>
            <p className="mx-auto mt-2 max-w-xs text-xs text-slate-600 transition-colors duration-300 dark:text-slate-500">
              Grounded answers — pick a starter or type your question.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-700 transition duration-300 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10 dark:hover:text-white"
                  onClick={() => sendMessage(s)}
                  disabled={loading}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={`m-${String(i)}`}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[95%] rounded-2xl px-4 py-2.5 text-sm shadow-sm transition-colors duration-300 ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-indigo-200/60 dark:shadow-lg'
                  : 'border border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm max-w-none text-slate-800 prose-headings:text-slate-900 prose-strong:text-indigo-800 transition-colors duration-300 dark:prose-invert dark:text-slate-100 [&_p]:mb-2 [&_p:last-child]:mb-0">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
            </div>
            {msg.role === 'assistant' && <ConfidenceBanner confidence={msg.confidence} />}
            {msg.role === 'assistant' && msg.sources?.length > 0 && (
              <div className="mt-2 w-full space-y-2">
                {msg.sources.map((src, j) => (
                  <article
                    key={`${src.url}-${String(j)}`}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/50"
                  >
                    <p className="border-l-2 border-cyan-600/60 pl-2 text-[11px] leading-relaxed text-slate-700 transition-colors duration-300 dark:border-cyan-500/60 dark:text-slate-400">
                      {src.text || src.url}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-[10px] font-medium text-cyan-700 transition-colors hover:text-cyan-900 dark:text-cyan-400 dark:hover:text-cyan-300"
                      >
                        {src.url}
                      </a>
                      {typeof src.score === 'number' && src.score > 0 && (
                        <span className="rounded bg-indigo-100 px-1.5 font-mono text-[10px] text-indigo-800 transition-colors duration-300 dark:bg-indigo-500/20 dark:text-indigo-300">
                          {src.score.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex flex-col justify-start gap-2">
            <div className="flex gap-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/60">
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="h-2 w-2 animate-bounce rounded-full bg-indigo-500 dark:bg-indigo-400"
                  style={{ animationDelay: `${d * 120}ms` }}
                />
              ))}
            </div>
            {highDemandHint && (
              <p
                role="status"
                className="max-w-xs text-[11px] font-medium text-amber-800 dark:text-amber-200/90"
              >
                High demand — switching to backup model if needed…
              </p>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-slate-50/90 p-3 transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/60">
        <div className="flex gap-2">
          <textarea
            id="chat-input"
            rows={1}
            placeholder="Ask about pricing, positioning…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition duration-300 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-600 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
          />
          <button
            type="button"
            id="chat-send-btn"
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-lg transition duration-300 hover:scale-105 hover:shadow-glow disabled:opacity-40 disabled:hover:scale-100"
            title="Send"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
