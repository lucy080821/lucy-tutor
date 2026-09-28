"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { getSessionUserId } from "@/lib/session";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import { logSkillProgress } from "@/lib/skillProgress";
import { CEFR_LEVELS, PRACTICE_PURPOSES, CefrLevel, PracticePurpose, formatPracticedAt } from "@/lib/skillPractice";
import { SkillReportPDF, SkillReportRubricItem } from "@/components/reports/SkillReportPDF";
import { exportNodeToPDF } from "@/lib/pdfExport";
import { usePagination } from "@/lib/usePagination";
import Pagination from "@/components/Pagination";

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
  const historyPagination = usePagination(history, 10);
  const [viewingHistoryItem, setViewingHistoryItem] = useState<any | null>(null);

  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);
  const historyPdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const uid = getSessionUserId();
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
    let resolveEnd: (() => void) | null = null;
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
    // `stop()` doesn't synchronously flush trailing speech — the final `onresult` (and then
    // `onend`) arrive asynchronously shortly after. Reading the transcript right after calling
    // stop() (the old behavior) could drop the last word(s) spoken just before the button was
    // clicked. stopRecording awaits this instead of reading the transcript immediately.
    recognition.onend = () => resolveEnd?.();
    recognition.start();
    recognitionRef.current = {
      recognition,
      getFinal: () => finalTranscript,
      waitForEnd: () => new Promise<void>((res) => {
        resolveEnd = res;
        setTimeout(res, 1200); // fallback in case onend never fires
      })
    };
  }, []);

  const stopRecording = async () => {
    const ref = recognitionRef.current;
    if (!ref) return;
    const waitForEnd = ref.waitForEnd();
    ref.recognition.stop();
    await waitForEnd;
    setIsRecording(false);

    const transcript = ref.getFinal().trim();
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
      {/* Page banner */}
      <div className="bg-primary-soft border-b border-line">
        <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 flex items-center gap-6">
          <div className="flex-1 min-w-0">
            <nav aria-label="Breadcrumb" className="text-xs text-muted mb-2 flex flex-wrap items-center gap-1.5">
              <Link href="/dashboard" className="hover:text-primary">Trang chủ</Link>
              <span aria-hidden>/</span>
              <span className="text-foreground font-semibold">Luyện Nói</span>
            </nav>
            <h1 className="ui-page-title">Luyện Nói Cùng AI</h1>
            <p className="ui-page-subtitle max-w-2xl leading-relaxed">
              Hội thoại tiếng Anh với AI theo ngữ cảnh bạn tự chọn hoặc tình huống giáo viên giao, nhận xét chi tiết sau mỗi buổi luyện tập.
            </p>
            <Link href="/dashboard" className="btn-ghost px-3 py-2 text-sm mt-3 -ml-3">
              ← Dashboard
            </Link>
          </div>
          <img
            src="/images/thumbs/conversation.svg"
            alt="Minh hoạ luyện nói tiếng Anh cùng AI"
            width={640}
            height={360}
            loading="eager"
            className="hidden md:block w-60 lg:w-72 h-auto rounded-2xl shrink-0"
          />
        </div>
      </div>

      {!selectedTopic && !sessionId && (
        <div className="max-w-4xl mx-auto px-4 pt-6 flex flex-wrap gap-2">
          {[
            { key: "PRACTICE", label: "Luyện Tập" },
            { key: "HISTORY", label: `Lịch Sử (${history.length})` }
          ].map(v => (
            <button
              key={v.key}
              onClick={() => { setViewMode(v.key as any); setViewingHistoryItem(null); }}
              className={`ui-chip ${viewMode === v.key ? "ui-chip-active" : ""}`}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 pt-5 pb-12 space-y-6">
        {viewMode === "PRACTICE" && !selectedTopic && !sessionId && (
          <>
            <div className="ui-card p-5 sm:p-6 space-y-5">
              <h2 className="ui-section-title">Tự Chọn Ngữ Cảnh Hội Thoại</h2>
              <div>
                <label className="ui-label">Ngữ cảnh bạn muốn luyện</label>
                <input
                  type="text"
                  value={contextText}
                  onChange={(e) => setContextText(e.target.value)}
                  placeholder="VD: Đặt phòng khách sạn khi đi du lịch..."
                  className="ui-input"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {CONTEXT_SUGGESTIONS.map((t) => (
                    <button
                      key={t}
                      onClick={() => setContextText(t)}
                      className="ui-chip px-3 py-1.5 text-xs font-medium"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="min-w-[150px]">
                  <label className="ui-label">Cấp độ (CEFR)</label>
                  <select value={level} onChange={(e) => setLevel(e.target.value as CefrLevel)} className="ui-input font-semibold">
                    {CEFR_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
                <div className="min-w-[190px]">
                  <label className="ui-label">Mục đích luyện tập</label>
                  <select value={purpose} onChange={(e) => setPurpose(e.target.value as PracticePurpose)} className="ui-input font-semibold">
                    {PRACTICE_PURPOSES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              <button
                onClick={startSelfSession}
                disabled={startingSession}
                className="btn-primary w-full py-3"
              >
                {startingSession ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang bắt đầu...</>
                ) : (
                  <>Bắt Đầu Hội Thoại</>
                )}
              </button>
            </div>

            {topics.length > 0 && (
              <div className="space-y-3">
                <h2 className="ui-section-title">Hoặc chọn tình huống giáo viên đã giao:</h2>
                {loading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[1, 2].map((i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {topics.map((topic) => (
                      <button
                        key={topic.id}
                        onClick={() => startSession(topic)}
                        disabled={startingSession}
                        className="ui-card ui-card-hover overflow-hidden text-left disabled:opacity-50 flex flex-col"
                      >
                        <img src="/images/thumbs/conversation.svg" alt="" aria-hidden width={640} height={360} loading="lazy" className="w-full aspect-video object-cover rounded-t-2xl" />
                        <span className="p-5 block">
                          <span className="block font-bold text-primary">{topic.title}</span>
                          {topic.description && (
                            <span className="block text-xs text-muted mt-1 line-clamp-2">{topic.description}</span>
                          )}
                        </span>
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
            <h2 className="ui-section-title mb-2">Lịch Sử Luyện Nói</h2>
            {history.length === 0 ? (
              <div className="ui-card p-8 text-center">
                <img src="/images/illustrations/empty-state.svg" alt="Chưa có lịch sử luyện nói" width={800} height={600} loading="lazy" className="w-full h-auto max-w-[220px] mx-auto mb-4" />
                <p className="text-muted text-sm">Bạn chưa hoàn thành buổi luyện nói nào. Buổi luyện tập sau khi kết thúc sẽ tự động lưu tại đây.</p>
              </div>
            ) : (
              <>
                {historyPagination.pageItems.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => setViewingHistoryItem(h)}
                    className="ui-card ui-card-hover w-full text-left p-3 sm:p-4 flex items-center gap-4"
                  >
                    <img src="/images/thumbs/conversation.svg" alt="" aria-hidden width={640} height={360} loading="lazy" className="hidden sm:block w-28 h-auto rounded-xl shrink-0" />
                    <span className="min-w-0 flex-1 block">
                      <span className="block text-sm font-bold text-primary line-clamp-1">{h.topic?.title || h.contextText}</span>
                      <span className="block text-xs text-muted mt-1">{formatPracticedAt(h.practicedAt)} {h.level ? `· ${h.level}` : ""} {h.purpose ? `· ${h.purpose === "IELTS" ? "IELTS" : "Giao tiếp"}` : ""}</span>
                    </span>
                  </button>
                ))}
                <Pagination page={historyPagination.page} totalPages={historyPagination.totalPages} totalItems={historyPagination.totalItems} pageSize={10} onPageChange={historyPagination.setPage} />
              </>
            )}
          </div>
        )}

        {viewMode === "HISTORY" && viewingHistoryItem && historyFeedback && (
          <div className="space-y-4">
            <button onClick={() => setViewingHistoryItem(null)} className="btn-ghost px-3 py-2 text-sm">
              ← Quay lại danh sách
            </button>
            <h2 className="ui-section-title">{historyContextLabel}</h2>
            <div className="ui-card p-4 sm:p-5 space-y-3 max-h-64 overflow-y-auto">
              {historyMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm leading-relaxed ${m.role === "user" ? "bg-primary text-white rounded-br-md" : "bg-[#f7f9fc] border border-line text-foreground rounded-bl-md"}`}>{m.content}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted">Thực hành lúc: {formatPracticedAt(viewingHistoryItem.practicedAt)}</p>
              <button
                onClick={() => downloadPdf(historyPdfRef.current)}
                disabled={exportingPdf}
                className="btn-outline px-4 py-2 text-xs"
              >
                {exportingPdf ? "Đang xuất..." : "Xuất PDF"}
              </button>
            </div>
            <div className="bg-primary-soft border border-line p-4 text-sm text-foreground leading-relaxed rounded-xl">
              {historyFeedback.overall}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FEEDBACK_FIELDS.map(({ key, label }) => (historyFeedback as any)[key] && (
                <div key={key} className="bg-surface border border-line p-4 rounded-xl">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted mb-1">{label}</p>
                  <p className="text-sm text-foreground leading-relaxed">{(historyFeedback as any)[key]}</p>
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
          <div className="ui-card overflow-hidden flex flex-col" style={{ minHeight: "60vh" }}>
            <div className="px-5 py-4 border-b border-line flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="font-bold text-primary">{contextLabel}</div>
                {selectedTopic?.description && (
                  <div className="text-xs text-muted">{selectedTopic.description}</div>
                )}
              </div>
              <button onClick={reset} className="btn-outline px-4 py-2 text-xs">
                Đổi tình huống
              </button>
            </div>

            {!feedback ? (
              <>
                <div className="flex-1 px-5 py-5 space-y-3 overflow-y-auto bg-[#fafbfd]" style={{ maxHeight: "50vh" }}>
                  {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] px-4 py-2.5 text-sm leading-relaxed rounded-2xl ${
                          m.role === "user"
                            ? "bg-primary text-white rounded-br-md shadow-sm"
                            : "bg-surface border border-line text-foreground rounded-bl-md shadow-sm"
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {isRecording && liveTranscript && (
                    <div className="flex justify-end">
                      <div className="max-w-[80%] px-4 py-2.5 text-sm leading-relaxed bg-primary/50 text-white italic rounded-2xl rounded-br-md">
                        {liveTranscript}
                      </div>
                    </div>
                  )}
                  {sendingTurn && (
                    <div className="flex justify-start">
                      <div className="px-4 py-2.5 text-sm bg-surface border border-line text-muted rounded-2xl rounded-bl-md flex items-center gap-2">
                        <span className="w-3 h-3 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                        AI đang trả lời...
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="px-5 py-4 border-t border-line space-y-3">
                  {!hasSpeechAPI && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
                      Trình duyệt của bạn không hỗ trợ nhận diện giọng nói. Hãy thử Chrome trên máy tính.
                    </p>
                  )}
                  <div className="flex items-center flex-wrap gap-3">
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={sendingTurn || !hasSpeechAPI}
                      className={`flex-1 min-w-[180px] py-3 rounded-full font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                        isRecording ? "bg-red-500 hover:bg-red-600 text-white" : "bg-primary hover:bg-[#172e6e] text-white"
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
                      className="btn-outline px-5 py-3 text-sm"
                    >
                      {finishing ? "Đang tạo nhận xét..." : "Kết Thúc Hội Thoại"}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="ui-section-title">Nhận Xét Buổi Luyện Tập</h2>
                  <button
                    onClick={() => downloadPdf(pdfRef.current)}
                    disabled={exportingPdf}
                    className="btn-outline px-4 py-2 text-xs"
                  >
                    {exportingPdf ? "Đang xuất..." : "Xuất PDF"}
                  </button>
                </div>
                {practicedAt && <p className="text-xs text-muted">Thực hành lúc: {formatPracticedAt(practicedAt)}</p>}
                <div className="bg-primary-soft border border-line rounded-xl p-4 text-sm text-foreground leading-relaxed">
                  {feedback.overall}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {FEEDBACK_FIELDS.map(({ key, label }) => (feedback as any)[key] && (
                    <div key={key} className="bg-surface border border-line rounded-xl p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted mb-1">{label}</p>
                      <p className="text-sm text-foreground leading-relaxed">{(feedback as any)[key]}</p>
                    </div>
                  ))}
                </div>
                {feedback.suggestions?.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-2">Gợi ý cải thiện</p>
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
                  className="btn-outline w-full py-3"
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
