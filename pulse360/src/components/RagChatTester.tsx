"use client";

import { useState, useRef, useEffect } from "react";
import { RAG_CATEGORIES } from "@/lib/rag-api";

interface RetrievedChunk {
  chunk_id: string;
  text: string;
  score?: number;
  document_id?: string;
  document_title?: string;
  page?: number;
  category?: string;
}

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  status?: string;
  timing_ms?: number;
  sources?: Array<string | { title?: string; document_id?: string; document_title?: string }>;
  retrieved_chunks?: RetrievedChunk[];
  requestId?: string;
  category?: string;
  error?: boolean;
}

const SAMPLE_QUESTIONS = [
  "What are the 8 phases in a 360 review cycle?",
  "How is the annual billing discount calculated?",
  "What is the file upload limit for FAQ documents?",
  "Who has permission to delete FAQ documents?",
  "How are confidential peer ratings anonymized?",
];

function formatTime(ms?: number) {
  if (ms === undefined || ms === null) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function SourceBadge({ source }: { source: string | { title?: string; document_id?: string; document_title?: string } }) {
  const label = typeof source === "string" ? source : source.title || source.document_title || source.document_id || "Document";
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
      📄 {label}
    </span>
  );
}

export default function RagChatTester() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [activeInspectorId, setActiveInspectorId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  async function handleSubmit(questionText?: string) {
    const question = (questionText ?? input).trim();
    if (!question || loading) return;

    const userMessageId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMessageId,
      sender: "user",
      text: question,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      category: selectedCategory !== "all" ? selectedCategory : undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/system-admin/rag/test-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          category: selectedCategory !== "all" ? selectedCategory : undefined,
        }),
      });

      const data = await response.json();
      const assistantMessageId = `assistant-${Date.now()}`;

      if (!response.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMessageId,
            sender: "assistant",
            text: data.error || data.detail?.message || "Failed to get an answer from the assistant.",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            timing_ms: data.timing_ms,
            error: true,
          },
        ]);
        return;
      }

      const assistantMsg: ChatMessage = {
        id: assistantMessageId,
        sender: "assistant",
        text: data.answer || "No answer generated.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: data.status,
        timing_ms: data.timing_ms,
        sources: Array.isArray(data.sources) ? data.sources : [],
        retrieved_chunks: Array.isArray(data.retrieved_chunks) ? data.retrieved_chunks : [],
        requestId: data.request_id,
        category: data.category,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      // Auto-open inspector if chunks are available
      if (assistantMsg.retrieved_chunks && assistantMsg.retrieved_chunks.length > 0) {
        setActiveInspectorId(assistantMessageId);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          sender: "assistant",
          text: err instanceof Error ? err.message : "An unexpected network error occurred.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const selectedMsg = messages.find((m) => m.id === activeInspectorId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Main Chat Panel */}
      <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col h-[700px]">
        {/* Header & Category Filter */}
        <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 rounded-t-2xl">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              FAQ Assistant Sandbox
            </h3>
            <p className="text-xs text-gray-500">Test queries and inspect raw retrieval context</p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="category-select" className="text-xs text-gray-500 font-medium">Filter:</label>
            <select
              id="category-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              {RAG_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => { setMessages([]); setActiveInspectorId(null); }}
                className="text-xs text-gray-500 hover:text-red-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                title="Clear conversation"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl font-bold mb-3">
                💬
              </div>
              <h4 className="text-sm font-semibold text-gray-800">Ask the FAQ Assistant</h4>
              <p className="text-xs text-gray-500 max-w-sm mt-1">
                Test company questions and observe which chunks are retrieved from Supabase pgvector.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-md">
                {SAMPLE_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleSubmit(q)}
                    className="text-xs bg-gray-50 hover:bg-blue-50 text-gray-700 hover:text-blue-700 border border-gray-200 hover:border-blue-200 rounded-full px-3 py-1.5 transition text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-blue-600 text-white rounded-br-xs"
                      : msg.error
                      ? "bg-red-50 text-red-800 border border-red-200 rounded-bl-xs"
                      : "bg-slate-100 text-gray-900 border border-slate-200/80 rounded-bl-xs"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.text}</div>

                  {/* Sources Pill List */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-slate-200/60 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mr-1">
                        Sources:
                      </span>
                      {msg.sources.map((s, idx) => (
                        <SourceBadge key={idx} source={s} />
                      ))}
                    </div>
                  )}

                  {/* Meta Bar */}
                  <div className="mt-2 flex items-center justify-between gap-3 text-[11px] opacity-75">
                    <span>{msg.timestamp}</span>
                    <div className="flex items-center gap-2">
                      {msg.timing_ms !== undefined && (
                        <span className="font-mono">⚡ {formatTime(msg.timing_ms)}</span>
                      )}
                      {msg.sender === "assistant" && !msg.error && (
                        <button
                          type="button"
                          onClick={() => setActiveInspectorId(msg.id)}
                          className={`font-semibold underline transition ${
                            activeInspectorId === msg.id ? "text-blue-600" : "hover:text-blue-600"
                          }`}
                        >
                          {activeInspectorId === msg.id ? "Viewing Chunks" : "Inspect Chunks"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl p-3 w-fit animate-pulse">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
              Searching vector store and generating grounded answer…
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}
          className="p-3 border-t border-gray-100 bg-white rounded-b-2xl flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a policy or FAQ question (e.g., 'How do peer nominations work?')..."
            disabled={loading}
            className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition shadow-xs"
          >
            {loading ? "Asking…" : "Send"}
          </button>
        </form>
      </div>

      {/* Retrieval Inspector Drawer */}
      <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200 shadow-sm p-5 h-[700px] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              🔍 Chunk & Retrieval Inspector
            </h3>
            <p className="text-xs text-gray-500">Examine vector matches & similarity ranks</p>
          </div>
          {selectedMsg && (
            <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
              {formatTime(selectedMsg.timing_ms)}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto pt-4 space-y-4">
          {!selectedMsg ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
              <p className="text-xs">
                Select <span className="font-medium text-gray-600">&ldquo;Inspect Chunks&rdquo;</span> on any assistant response to view retrieved context chunks and score diagnostics.
              </p>
            </div>
          ) : selectedMsg.retrieved_chunks && selectedMsg.retrieved_chunks.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                <span>Retrieved Chunks ({selectedMsg.retrieved_chunks.length})</span>
                {selectedMsg.category && (
                  <span className="capitalize bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[11px]">
                    Category: {selectedMsg.category}
                  </span>
                )}
              </div>

              {selectedMsg.retrieved_chunks.map((chunk, idx) => {
                const scorePercent = chunk.score !== undefined ? Math.round(chunk.score * 100) : null;
                return (
                  <div
                    key={chunk.chunk_id || idx}
                    className="p-3.5 rounded-xl border border-gray-200/90 bg-slate-50/50 hover:bg-slate-50 transition space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-800 text-[10px] flex items-center justify-center font-bold">
                          {idx + 1}
                        </span>
                        {chunk.document_title || chunk.document_id || "Source Document"}
                      </span>
                      {scorePercent !== null && (
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded ${
                            scorePercent >= 75
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : scorePercent >= 50
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          Score: {scorePercent}%
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-700 font-mono bg-white p-2.5 rounded-lg border border-gray-200/70 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                      {chunk.text}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono">
                      <span>Chunk ID: {chunk.chunk_id ? chunk.chunk_id.slice(0, 8) + "…" : "n/a"}</span>
                      {chunk.page !== undefined && chunk.page !== null && <span>Page {chunk.page}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              <strong>No discrete chunks returned.</strong> The RAG response may have used general knowledge or the dedicated chunk extractor endpoint is in fallback mode.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
