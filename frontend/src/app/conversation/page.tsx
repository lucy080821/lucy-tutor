"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import { logSkillProgress } from "@/lib/skillProgress";

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
  suggestions: string[];
  internalScore?: number; // never rendered — only used to silently feed the dashboard radar chart
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function ConversationPracticePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [hasSpeechAPI, setHasSpeechAPI] = useState(true);
  const [sendingTurn, setSendingTurn] = useState(false);
  const [startingSession, setStartingSession] = useState(false);

  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [finishing, setFinishing] = useState(false);

  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const uid = localStorage.getItem("userId") || sessionStorage.getItem("userId");
    if (!uid) {
      router.push("/");
      return;
    }
    setUserId(uid);
    fetchTopics(uid);

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
      if (typeof data.feedback?.internalScore === "number") {
        logSkillProgress(userId, "SPEAKING", data.feedback.internalScore, "SPEAKING_CONVERSATION");
      }
    } catch {
      Swal.fire("Lỗi", "Không thể tạo nhận xét lúc này. Vui lòng thử lại.", "error");
    } finally {
      setFinishing(false);
    }
  };

  const reset = () => {
    setSelectedTopic(null);
    setSessionId(null);
    setMessages([]);
    setFeedback(null);
    setLiveTranscript("");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-surface border-b border-foreground/10 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-foreground/50 hover:text-foreground transition-colors text-sm font-medium flex items-center gap-1">
          ← Dashboard
        </Link>
        <span className="text-foreground/20">/</span>
        <h1 className="font-bold text-foreground">Luyện Nói Cùng AI</h1>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {!selectedTopic ? (
          <>
            <p className="text-foreground/60 text-sm">
              Chọn một tình huống bên dưới để bắt đầu hội thoại tự do với AI. Cứ nói tự nhiên — AI sẽ phản hồi và trò chuyện lại với bạn.
            </p>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1, 2].map((i) => <div key={i} className="skeleton h-24 rounded-lg" />)}
              </div>
            ) : topics.length === 0 ? (
              <div className="bg-surface border border-foreground/10 p-8 text-center text-foreground/50">
                Giáo viên của bạn chưa giao tình huống hội thoại nào.
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
          </>
        ) : (
          <div className="bg-surface border border-foreground/10 flex flex-col" style={{ minHeight: "60vh" }}>
            <div className="px-5 py-3 border-b border-foreground/10 flex items-center justify-between">
              <div>
                <div className="font-bold text-foreground">{selectedTopic.title}</div>
                {selectedTopic.description && (
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
                <h2 className="text-lg font-bold text-foreground">Nhận Xét Buổi Luyện Tập</h2>
                <div className="bg-primary/5 border border-primary/15 p-4 text-sm text-foreground/80 leading-relaxed">
                  {feedback.overall}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { key: "fluency", label: "Độ trôi chảy" },
                    { key: "vocabulary", label: "Từ vựng" },
                    { key: "grammar", label: "Ngữ pháp" }
                  ].map(({ key, label }) => (feedback as any)[key] && (
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
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
