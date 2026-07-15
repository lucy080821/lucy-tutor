"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import { logSkillProgress } from "@/lib/skillProgress";
import { CEFR_LEVELS, PRACTICE_PURPOSES, CefrLevel, PracticePurpose, formatPracticedAt } from "@/lib/skillPractice";
import { SkillReportPDF, SkillReportRubricItem } from "@/components/reports/SkillReportPDF";
import { exportNodeToPDF } from "@/lib/pdfExport";

interface Topic {
  id: string;
  title: string;
  description: string | null;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Feedback {
  overall: string;
  fluency: string;
  vocabulary: string;
  grammar: string;
  clarity?: string;
  suggestions: string[];
  internalScore?: number; // never rendered — only used to silently feed the dashboard radar chart
}

const CONTEXT_SUGGESTIONS = [
  "Đặt phòng khách sạn khi đi du lịch",
  "Phỏng vấn xin việc bằng tiếng Anh",
  "Gọi món tại nhà hàng",
  "Hỏi đường ở một thành phố lạ",
  "Trò chuyện làm quen bạn mới"
];

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const FEEDBACK_FIELDS = [
  { key: "fluency", label: "Độ trôi chảy" },
  { key: "vocabulary", label: "Từ vựng" },
  { key: "grammar", label: "Ngữ pháp" },
  { key: "clarity", label: "Độ dễ nghe" }
];

export default function ConversationPracticePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("Học viên");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"PRACTICE" | "HISTORY">("PRACTICE");

  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [contextText, setContextText] = useState("");
  const [level, setLevel] = useState<CefrLevel>("B1");
  const [purpose, setPurpose] = useState<PracticePurpose>("GENERAL");
  const [contextLabel, setContextLabel] = useState<string>("");

  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [hasSpeechAPI, setHasSpeechAPI] = useState(true);
  const [sendingTurn, setSendingTurn] = useState(false);
  const [startingSession, setStartingSession] = useState(false);

  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [practicedAt, setPracticedAt] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const [history, setHistory] = useState<any[]>([]);
  const [viewingHistoryItem, setViewingHistoryItem] = useState<any | null>(null);

  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);
  const historyPdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const uid = localStorage.getItem("userId") || sessionStorage.getItem("userId");
    if (!uid) {
      router.push("/");
      return;
    }
    setUserId(uid);
    fetchTopics(uid);
    fetchHistory(uid);
    fetch(`${API}/api/auth/me?userId=${uid}`).then(r => r.json()).then(u => setUserName(u.name || "Học viên")).catch(() => {});

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setHasSpeechAPI(!!SpeechRecognition);
  }, [router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchTopics = async (uid: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/speaking-conversation/topics/available/${uid}`);
      const data = await res.json();
      setTopics(Array.isArray(data) ? data : []);
    } catch {
      setTopics([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (uid: string) => {
    try {
      const res = await fetch(`${API}/api/speaking-conversation/sessions/user/${uid}`);
      const data = await res.json();
      setHistory(Array.isArray(data) ? data.filter((s: any) => s.status === "COMPLETED") : []);
    } catch {
      setHistory([]);
    }
  };

  const startSession = async (topic: Topic) => {
    if (!userId) return;
    setStartingSession(true);
    try {
      const res = await fetch(`${API}/api/speaking-conversation/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, topicId: topic.id })
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSelectedTopic(topic);
      setContextLabel(topic.title);
      setSessionId(data.session.id);
      setMessages([{ role: "assistant", content: data.firstMessage }]);
      setFeedback(null);
    } catch {
      Swal.fire("Lỗi", "Không thể bắt đầu hội thoại. Vui lòng thử lại.", "error");
    } finally {
      setStartingSession(false);
    }
  };

  const startSelfSession = async () => {
    if (!userId || !contextText.trim()) {
      Swal.fire("Thiếu ngữ cảnh", "Vui lòng nhập ngữ cảnh hội thoại bạn muốn luyện.", "warning");
      return;
    }
    setStartingSession(true);
    try {
      const res = await fetch(`${API}/api/speaking-conversation/sessions/self`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, contextText: contextText.trim(), level, purpose })
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSelectedTopic(null);
      setContextLabel(contextText.trim());
      setSessionId(data.session.id);
      setMessages([{ role: "assistant", content: data.firstMessage }]);
      setFeedback(null);
    } catch {
      Swal.fire("Lỗi", "Không thể bắt đầu hội thoại. Vui lòng thử lại.", "error");
    } finally {
      setStartingSession(false);
    }
  };

  const startRecording = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      Swal.fire("Không hỗ trợ", "Trình duyệt của bạn không hỗ trợ nhận diện giọng nói. Hãy thử Chrome trên máy tính.", "warning");
      return;
    }

    setLiveTranscript("");
    setIsRecording(true);

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = "";
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " ";
        } else {
          interim = event.results[i][0].transcript;
        }
      }
      setLiveTranscript(finalTranscript + interim);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.start();
    recognitionRef.current = { recognition, getFinal: () => finalTranscript };
  }, []);

  const stopRecording = async () => {
    const ref = recognitionRef.current;
    if (!ref) return;
    ref.recognition.stop();
    setIsRecording(false);

    const transcript = (liveTranscript || ref.getFinal()).trim();
    setLiveTranscript("");
    if (!transcript || !sessionId) return;

    const userMessage: ChatMessage = { role: "user", content: transcript };
    setMessages((prev) => [...prev, userMessage]);
    setSendingTurn(true);
    try {
      const res = await fetch(`${API}/api/speaking-conversation/sessions/${sessionId}/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript })
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      Swal.fire("Lỗi", "AI không thể phản hồi lúc này. Vui lòng thử lại.", "error");
    } finally {
      setSendingTurn(false);
    }
  };

  const finishSession = async () => {
    if (!sessionId) return;
    const confirm = await Swal.fire({
      title: "Kết thúc hội thoại?",
      text: "Bạn sẽ nhận nhận xét tổng kết cho buổi luyện tập này.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Kết thúc",
      cancelButtonText: "Tiếp tục nói"
    });
    if (!confirm.isConfirmed) return;

    setFinishing(true);
    try {
      const res = await fetch(`${API}/api/speaking-conversation/sessions/${sessionId}/finish`, {
        method: "POST"
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFeedback(data.feedback);
      setPracticedAt(data.session?.practicedAt || new Date().toISOString());
      if (typeof data.feedback?.internalScore === "number") {
        logSkillProgress(userId, "SPEAKING", data.feedback.internalScore, "SPEAKING_CONVERSATION");
      }
      if (userId) fetchHistory(userId);
    } catch {
      Swal.fire("Lỗi", "Không thể tạo nhận xét lúc này. Vui lòng thử lại.", "error");
    } finally {
      setFinishing(false);
    }
  };

  const downloadPdf = async (node: HTMLDivElement | null) => {
    if (!node) return;
    setExportingPdf(true);
    try {
      await exportNodeToPDF(node, `bao-cao-luyen-noi-${Date.now()}.pdf`);
    } catch {
      Swal.fire("Lỗi", "Không thể xuất PDF lúc này.", "error");
    } finally {
      setExportingPdf(false);
    }
  };

  const reset = () => {
    setSelectedTopic(null);
    setSessionId(null);
    setMessages([]);
    setFeedback(null);
    setPracticedAt(null);
    setLiveTranscript("");
    setContextText("");
    setContextLabel("");
  };

  const buildRubric = (fb: Feedback): SkillReportRubricItem[] =>
    FEEDBACK_FIELDS.filter(f => (fb as any)[f.key]).map(f => ({ label: f.label, note: (fb as any)[f.key] }));

  const transcriptText = (msgs: ChatMessage[]) =>
    msgs.map(m => `${m.role === "user" ? "Học viên" : "AI"}: ${m.content}`).join("\n\n");

  const historyFeedback: Feedback | null = viewingHistoryItem?.feedback ? JSON.parse(viewingHistoryItem.feedback) : null;
  const historyMessages: ChatMessage[] = viewingHistoryItem?.messages ? JSON.parse(viewingHistoryItem.messages) : [];
  const historyContextLabel = viewingHistoryItem ? (viewingHistoryItem.topic?.title || viewingHistoryItem.contextText || "") : "";

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-surface border-b border-foreground/10 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-foreground/50 hover:text-foreground transition-colors text-sm font-medium flex items-center gap-1">
            ← Dashboard
          </Link>
          <span className="text-foreground/20">/</span>
          <h1 className="font-bold text-foreground">Luyện Nói Cùng AI</h1>
        </div>
        {!selectedTopic && !sessionId && (
          <div className="flex bg-foreground/5 p-1 rounded-xl">
            {[
              { key: "PRACTICE", label: "🎤 Luyện Tập" },
              { key: "HISTORY", label: `📜 Lịch Sử (${history.length})` }
            ].map(v => (
              <button
                key={v.key}
                onClick={() => { setViewMode(v.key as any); setViewingHistoryItem(null); }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${viewMode === v.key ? "bg-primary text-white shadow-sm" : "text-foreground/50 hover:text-foreground"}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {viewMode === "PRACTICE" && !selectedTopic && !sessionId && (
          <>
            <div className="bg-surface border border-foreground/10 rounded-2xl p-6 space-y-4 shadow-sm">
              <h2 className="font-bold text-foreground flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-base">🗨️</span>
                Tự Chọn Ngữ Cảnh Hội Thoại
              </h2>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-foreground/50 mb-2">Ngữ cảnh bạn muốn luyện</label>
                <input
                  type="text"
                  value={contextText}
                  onChange={(e) => setContextText(e.target.value)}
                  placeholder="VD: Đặt phòng khách sạn khi đi du lịch..."
                  className="w-full p-3 border border-foreground/15 bg-background rounded-xl focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-colors"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {CONTEXT_SUGGESTIONS.map((t) => (
                    <button
                      key={t}
                      onClick={() => setContextText(t)}
                      className="px-2.5 py-1 text-xs font-medium bg-foreground/5 hover:bg-primary/10 hover:text-primary text-foreground/60 rounded-full transition-colors"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="min-w-[150px]">
                  <label className="block text-xs font-bold uppercase tracking-wide text-foreground/50 mb-2">Cấp độ (CEFR)</label>
                  <select value={level} onChange={(e) => setLevel(e.target.value as CefrLevel)} className="w-full p-3 border border-foreground/15 bg-background rounded-xl font-semibold">
                    {CEFR_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
                <div className="min-w-[190px]">
                  <label className="block text-xs font-bold uppercase tracking-wide text-foreground/50 mb-2">Mục đích luyện tập</label>
                  <select value={purpose} onChange={(e) => setPurpose(e.target.value as PracticePurpose)} className="w-full p-3 border border-foreground/15 bg-background rounded-xl font-semibold">
                    {PRACTICE_PURPOSES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              <button
                onClick={startSelfSession}
                disabled={startingSession}
                className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
              >
                {startingSession ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang bắt đầu...</>
                ) : (
                  <>🎤 Bắt Đầu Hội Thoại</>
                )}
              </button>
            </div>

            {topics.length > 0 && (
              <div className="space-y-3">
                <p className="text-foreground/60 text-sm">Hoặc chọn tình huống giáo viên đã giao:</p>
                {loading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[1, 2].map((i) => <div key={i} className="skeleton h-24 rounded-lg" />)}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {topics.map((topic) => (
                      <button
                        key={topic.id}
                        onClick={() => startSession(topic)}
                        disabled={startingSession}
                        className="p-4 text-left bg-surface border border-foreground/15 hover:border-primary/40 hover:bg-primary/5 transition-all disabled:opacity-50"
                      >
                        <div className="font-bold text-foreground">{topic.title}</div>
                        {topic.description && (
                          <div className="text-xs text-foreground/50 mt-1 line-clamp-2">{topic.description}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {viewMode === "HISTORY" && !viewingHistoryItem && (
          <div className="space-y-3">
            <h1 className="text-2xl font-black">📜 Lịch Sử Luyện Nói</h1>
            {history.length === 0 ? (
              <p className="text-foreground/50 text-sm">Bạn chưa hoàn thành buổi luyện nói nào. Buổi luyện tập sau khi kết thúc sẽ tự động lưu tại đây.</p>
            ) : (
              history.map((h) => (
                <button
                  key={h.id}
                  onClick={() => setViewingHistoryItem(h)}
                  className="w-full text-left bg-surface border border-foreground/10 rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition-all"
                >
                  <p className="text-sm font-bold text-foreground/80 line-clamp-1">{h.topic?.title || h.contextText}</p>
                  <p className="text-xs text-foreground/50 mt-1">🕓 {formatPracticedAt(h.practicedAt)} {h.level ? `· ${h.level}` : ""} {h.purpose ? `· ${h.purpose === "IELTS" ? "IELTS" : "Giao tiếp"}` : ""}</p>
                </button>
              ))
            )}
          </div>
        )}

        {viewMode === "HISTORY" && viewingHistoryItem && historyFeedback && (
          <div className="space-y-4">
            <button onClick={() => setViewingHistoryItem(null)} className="text-xs font-bold text-foreground/40 hover:text-primary transition-colors inline-flex items-center gap-1">
              ← Quay lại danh sách
            </button>
            <h2 className="text-lg font-bold text-foreground">{historyContextLabel}</h2>
            <div className="bg-foreground/5 border border-foreground/10 rounded-xl p-4 space-y-2 max-h-64 overflow-y-auto">
              {historyMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] px-3 py-1.5 rounded-lg text-sm ${m.role === "user" ? "bg-primary text-white" : "bg-foreground/10 text-foreground/80"}`}>{m.content}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-foreground/40">🕓 Thực hành lúc: {formatPracticedAt(viewingHistoryItem.practicedAt)}</p>
              <button
                onClick={() => downloadPdf(historyPdfRef.current)}
                disabled={exportingPdf}
                className="text-xs font-bold px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-full transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                🖨️ {exportingPdf ? "Đang xuất..." : "Xuất PDF"}
              </button>
            </div>
            <div className="bg-primary/5 border border-primary/15 p-4 text-sm text-foreground/80 leading-relaxed rounded-xl">
              {historyFeedback.overall}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FEEDBACK_FIELDS.map(({ key, label }) => (historyFeedback as any)[key] && (
                <div key={key} className="bg-foreground/5 border border-foreground/10 p-3 rounded-xl">
                  <p className="text-xs font-bold uppercase tracking-wide text-foreground/50 mb-1">{label}</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{(historyFeedback as any)[key]}</p>
                </div>
              ))}
            </div>

            <div style={{ position: "fixed", top: 0, left: "-9999px", zIndex: -1 }}>
              <SkillReportPDF
                ref={historyPdfRef}
                skillLabel="Luyện Nói (Speaking)"
                skillIcon="🎤"
                studentName={userName}
                practicedAt={viewingHistoryItem.practicedAt}
                level={viewingHistoryItem.level}
                purpose={viewingHistoryItem.purpose}
                contextTitle={historyContextLabel}
                overallComment={historyFeedback.overall}
                rubric={buildRubric(historyFeedback)}
                suggestions={historyFeedback.suggestions || []}
                transcriptTitle="Nội Dung Hội Thoại"
                transcriptBody={transcriptText(historyMessages)}
              />
            </div>
          </div>
        )}

        {(selectedTopic || sessionId) && (
          <div className="bg-surface border border-foreground/10 flex flex-col" style={{ minHeight: "60vh" }}>
            <div className="px-5 py-3 border-b border-foreground/10 flex items-center justify-between">
              <div>
                <div className="font-bold text-foreground">{contextLabel}</div>
                {selectedTopic?.description && (
                  <div className="text-xs text-foreground/50">{selectedTopic.description}</div>
                )}
              </div>
              <button onClick={reset} className="text-xs text-foreground/40 hover:text-foreground transition-colors underline">
                Đổi tình huống
              </button>
            </div>

            {!feedback ? (
              <>
                <div className="flex-1 px-5 py-4 space-y-3 overflow-y-auto" style={{ maxHeight: "50vh" }}>
                  {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] px-4 py-2 text-sm leading-relaxed ${
                          m.role === "user"
                            ? "bg-primary text-white"
                            : "bg-foreground/5 text-foreground/80"
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {isRecording && liveTranscript && (
                    <div className="flex justify-end">
                      <div className="max-w-[80%] px-4 py-2 text-sm leading-relaxed bg-primary/40 text-white italic">
                        {liveTranscript}
                      </div>
                    </div>
                  )}
                  {sendingTurn && (
                    <div className="flex justify-start">
                      <div className="px-4 py-2 text-sm bg-foreground/5 text-foreground/50 flex items-center gap-2">
                        <span className="w-3 h-3 border-2 border-foreground/20 border-t-foreground/50 rounded-full animate-spin" />
                        AI đang trả lời...
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="px-5 py-4 border-t border-foreground/10 space-y-3">
                  {!hasSpeechAPI && (
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 text-center">
                      Trình duyệt của bạn không hỗ trợ nhận diện giọng nói. Hãy thử Chrome trên máy tính.
                    </p>
                  )}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={sendingTurn || !hasSpeechAPI}
                      className={`flex-1 py-3 font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                        isRecording ? "bg-red-500 hover:bg-red-600 text-white" : "bg-primary hover:opacity-90 text-white"
                      }`}
                    >
                      {isRecording ? (
                        <>
                          <span className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" /> Dừng & Gửi
                        </>
                      ) : (
                        <>🎤 Nhấn để nói</>
                      )}
                    </button>
                    <button
                      onClick={finishSession}
                      disabled={isRecording || sendingTurn || finishing || messages.length < 2}
                      className="px-4 py-3 border border-foreground/15 text-foreground/60 text-sm font-bold hover:bg-foreground/5 transition-colors disabled:opacity-40"
                    >
                      {finishing ? "Đang tạo nhận xét..." : "Kết Thúc Hội Thoại"}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="text-lg font-bold text-foreground">Nhận Xét Buổi Luyện Tập</h2>
                  <button
                    onClick={() => downloadPdf(pdfRef.current)}
                    disabled={exportingPdf}
                    className="text-xs font-bold px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-full transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    🖨️ {exportingPdf ? "Đang xuất..." : "Xuất PDF"}
                  </button>
                </div>
                {practicedAt && <p className="text-xs text-foreground/40">🕓 Thực hành lúc: {formatPracticedAt(practicedAt)}</p>}
                <div className="bg-primary/5 border border-primary/15 p-4 text-sm text-foreground/80 leading-relaxed">
                  {feedback.overall}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {FEEDBACK_FIELDS.map(({ key, label }) => (feedback as any)[key] && (
                    <div key={key} className="bg-foreground/5 border border-foreground/10 p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-foreground/50 mb-1">{label}</p>
                      <p className="text-sm text-foreground/80 leading-relaxed">{(feedback as any)[key]}</p>
                    </div>
                  ))}
                </div>
                {feedback.suggestions?.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-2">💡 Gợi ý cải thiện</p>
                    <ul className="space-y-1">
                      {feedback.suggestions.map((s, i) => (
                        <li key={i} className="text-sm text-amber-800 flex gap-2">
                          <span className="text-amber-500 font-bold shrink-0">{i + 1}.</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <button
                  onClick={reset}
                  className="w-full py-3 bg-primary/10 text-primary font-bold hover:bg-primary/15 transition-colors"
                >
                  Luyện Tình Huống Khác
                </button>

                <div style={{ position: "fixed", top: 0, left: "-9999px", zIndex: -1 }}>
                  <SkillReportPDF
                    ref={pdfRef}
                    skillLabel="Luyện Nói (Speaking)"
                    skillIcon="🎤"
                    studentName={userName}
                    practicedAt={practicedAt || new Date()}
                    level={selectedTopic ? undefined : level}
                    purpose={selectedTopic ? undefined : purpose}
                    contextTitle={contextLabel}
                    overallComment={feedback.overall}
                    rubric={buildRubric(feedback)}
                    suggestions={feedback.suggestions || []}
                    transcriptTitle="Nội Dung Hội Thoại"
                    transcriptBody={transcriptText(messages)}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
