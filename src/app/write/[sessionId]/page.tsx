"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Skeleton } from "@/components/ui/Skeleton";

/* ── Types ── */
interface WritingSession {
  id: string;
  collection_id: string;
  persona: string | null;
  direction: Record<string, string> | null;
  model_provider: string;
  model_name: string;
  status: string;
  created_at: string;
}

interface Scrap {
  id: string;
  exact_quote: string;
  user_note: string | null;
}

interface CollectionItem {
  id: string;
  scrap_id: string | null;
  article_id: string | null;
  scrap: Scrap | null;
}

type Step = "materials" | "direction" | "analyze" | "suggest" | "draft" | "publish";

const STEPS: { key: Step; label: string }[] = [
  { key: "materials", label: "01 소재 확인" },
  { key: "direction", label: "02 방향 설정" },
  { key: "analyze", label: "03 소재 분석" },
  { key: "suggest", label: "04 구조 제안" },
  { key: "draft", label: "05 초안 작성" },
  { key: "publish", label: "06 발행" },
];

/**
 * Read a streaming text response from AI SDK's streamText
 */
async function readStream(
  res: Response,
  onChunk: (text: string) => void
): Promise<string> {
  // AI SDK streamText returns either DataStream or TextStream
  // TextStream: plain text chunks
  // DataStream: SSE format with data prefixes
  const contentType = res.headers.get("content-type") || "";
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });

    if (contentType.includes("text/plain")) {
      // TextStream: raw text
      full += chunk;
      onChunk(full);
    } else {
      // DataStream (SSE): parse "0:text\n" format
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("0:")) {
          try {
            const text = JSON.parse(line.slice(2));
            full += text;
            onChunk(full);
          } catch {
            // non-JSON line, skip
          }
        }
      }
    }
  }

  return full;
}

/**
 * Format scraps into a materials string for the API
 */
function formatMaterials(scraps: Scrap[]): string {
  return scraps
    .map(
      (s, i) =>
        `[소재 ${i + 1}] "${s.exact_quote}"${s.user_note ? `\n  메모: ${s.user_note}` : ""}`
    )
    .join("\n\n");
}

/* ── Main ── */
interface WritePageProps {
  params: Promise<{ sessionId: string }>;
}

export default function WritePage({ params }: WritePageProps) {
  const { sessionId } = use(params);
  const router = useRouter();

  const [session, setSession] = useState<WritingSession | null>(null);
  const [scraps, setScraps] = useState<Scrap[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState<Step>("materials");

  // Direction inputs
  const [topic, setTopic] = useState("");
  const [angle, setAngle] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("");

  // AI outputs
  const [analysis, setAnalysis] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [draft, setDraft] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  // Publish
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [publishing, setPublishing] = useState(false);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/writing/sessions/${sessionId}`);
      if (!res.ok) {
        router.push("/collections");
        return;
      }
      const data = await res.json();
      setSession(data.session);

      const [collectionRes, allScrapsRes] = await Promise.all([
        fetch(`/api/collections/${data.session.collection_id}`),
        fetch("/api/scraps"),
      ]);

      const seen = new Set<string>();
      const merged: Scrap[] = [];
      if (collectionRes.ok) {
        const collectionData = await collectionRes.json();
        for (const item of (collectionData.items ?? []) as CollectionItem[]) {
          if (item.scrap) {
            seen.add(item.scrap.id);
            merged.push(item.scrap);
          }
        }
      }

      if (allScrapsRes.ok) {
        const allScrapsData = await allScrapsRes.json();
        for (const scrap of (allScrapsData.scraps ?? []) as Scrap[]) {
          if (!seen.has(scrap.id)) {
            merged.push(scrap);
          }
        }
      }

      setScraps(merged);
    } finally {
      setLoading(false);
    }
  }, [sessionId, router]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const handleAnalyze = async () => {
    if (scraps.length === 0) {
      setAiError("소재가 없습니다. 먼저 콜렉션에 소재를 추가하세요.");
      return;
    }
    setAiLoading(true);
    setAiError("");
    setAnalysis("");

    try {
      const materials = formatMaterials(scraps);
      const directionText = [
        topic && `주제: ${topic}`,
        angle && `관점: ${angle}`,
        audience && `대상 독자: ${audience}`,
        tone && `톤: ${tone}`,
      ]
        .filter(Boolean)
        .join("\n");

      const fullMaterials = directionText
        ? `${materials}\n\n[글 방향]\n${directionText}`
        : materials;

      const res = await fetch("/api/writing/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materials: fullMaterials }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "서버 오류" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      await readStream(res, (text) => setAnalysis(text));
      setCurrentStep("analyze");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "분석 중 오류가 발생했습니다.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSuggest = async () => {
    if (!analysis) return;
    setAiLoading(true);
    setAiError("");
    setSuggestion("");

    try {
      const res = await fetch("/api/writing/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "서버 오류" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      await readStream(res, (text) => setSuggestion(text));
      setCurrentStep("suggest");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "구조 제안 중 오류가 발생했습니다.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleDraft = async () => {
    if (!suggestion) return;
    setAiLoading(true);
    setAiError("");
    setDraft("");

    try {
      const persona = session?.persona || "저널리스트";
      const materials = formatMaterials(scraps);

      const res = await fetch("/api/writing/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona,
          materials,
          analysis,
          topic: topic || suggestion.split("\n")[0] || "자동 생성 주제",
          coreMessage: angle || "소재 기반 분석",
          length: "1500자",
          emphasizedScraps: "",
          additionalInstructions: [
            audience && `대상 독자: ${audience}`,
            tone && `톤: ${tone}`,
          ]
            .filter(Boolean)
            .join(". "),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "서버 오류" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      await readStream(res, (text) => setDraft(text));
      setCurrentStep("draft");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "초안 작성 중 오류가 발생했습니다.");
    } finally {
      setAiLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!title.trim() || !slug.trim() || !draft) return;
    setPublishing(true);

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          title: title.trim(),
          slug: slug.trim(),
          markdown: draft,
          status: "published",
          published_at: new Date().toISOString(),
          sources: scraps.map((s) => ({
            scrap_id: s.id,
            usage: "quotation" as const,
          })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/my-press/${data.post.slug}`);
      }
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <TopNav />
        <PageContainer maxWidth="article">
          <Skeleton className="h-8 w-48 mb-8" />
          <Skeleton className="h-64 w-full" />
        </PageContainer>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />

      <PageContainer maxWidth="article">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[length:var(--text-h1)] font-serif font-semibold italic mb-2">
            글 쓰기
          </h1>
          <p className="text-[length:var(--text-small)] text-text-secondary">
            모은 소재를 기반으로 AI와 협업하여 글을 작성합니다.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-8 pb-6 border-b border-border overflow-x-auto">
          {STEPS.map((step, i) => (
            <button
              key={step.key}
              onClick={() => setCurrentStep(step.key)}
              className={`shrink-0 px-3 py-1.5 text-[length:var(--text-button)] font-medium transition-colors rounded-[var(--radius-button)] ${
                currentStep === step.key
                  ? "bg-accent text-text-inverted"
                  : i <= STEPS.findIndex((s) => s.key === currentStep)
                    ? "text-text-primary"
                    : "text-text-tertiary"
              }`}
            >
              {step.label}
            </button>
          ))}
        </div>

        {/* Error display */}
        {aiError && (
          <div className="mb-6 p-4 border border-red-300 bg-red-50 text-red-700 text-[length:var(--text-small)] rounded-[var(--radius-card)]">
            {aiError}
          </div>
        )}

        {/* Step content */}
        <div className="min-h-[400px]">
          {/* Step 1: Materials */}
          {currentStep === "materials" && (
            <div className="space-y-4">
              <h2 className="text-[length:var(--text-h2)] font-serif font-semibold italic mb-4">
                소재 확인
              </h2>
              {scraps.length > 0 ? (
                <div className="space-y-3">
                  {scraps.map((scrap, i) => (
                    <div key={scrap.id} className="border border-border p-4 rounded-[var(--radius-card)]">
                      <div className="flex items-start gap-3">
                        <span className="text-[length:var(--text-caption)] text-text-tertiary font-mono shrink-0 pt-0.5">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <p className="text-[length:var(--text-small)] italic leading-relaxed">
                            &ldquo;{scrap.exact_quote}&rdquo;
                          </p>
                          {scrap.user_note && (
                            <p className="text-[length:var(--text-caption)] text-text-secondary mt-2">
                              📝 {scrap.user_note}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-text-secondary">
                  소재가 없습니다. 아티클에서 텍스트를 선택하여 소재를 추가하세요.
                </p>
              )}
              <div className="pt-4">
                <Button onClick={() => setCurrentStep("direction")}>
                  다음: 방향 설정 →
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Direction */}
          {currentStep === "direction" && (
            <div className="space-y-6">
              <h2 className="text-[length:var(--text-h2)] font-serif font-semibold italic mb-4">
                글의 방향 설정
              </h2>
              <div>
                <label className="block text-[length:var(--text-small)] font-medium mb-2">
                  주제 (Topic)
                </label>
                <Textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="어떤 주제로 글을 쓰고 싶으신가요?"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-[length:var(--text-small)] font-medium mb-2">
                  관점/각도 (Angle)
                </label>
                <Textarea
                  value={angle}
                  onChange={(e) => setAngle(e.target.value)}
                  placeholder="어떤 시각으로 이야기를 풀어나갈까요?"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-[length:var(--text-small)] font-medium mb-2">
                  대상 독자 (Audience)
                </label>
                <input
                  type="text"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="누구를 위한 글인가요?"
                  className="w-full px-4 py-2 border border-border rounded-[var(--radius-input)] text-[length:var(--text-body)] placeholder:text-placeholder bg-background text-text-primary focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              <div>
                <label className="block text-[length:var(--text-small)] font-medium mb-2">
                  톤/스타일 (Tone)
                </label>
                <input
                  type="text"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  placeholder="예: 에세이풍, 분석적, 친근한, 학술적..."
                  className="w-full px-4 py-2 border border-border rounded-[var(--radius-input)] text-[length:var(--text-body)] placeholder:text-placeholder bg-background text-text-primary focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              <div className="flex items-center gap-3 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => setCurrentStep("materials")}
                >
                  ← 이전
                </Button>
                <Button onClick={handleAnalyze} isLoading={aiLoading}>
                  소재 분석 시작 →
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Analyze */}
          {currentStep === "analyze" && (
            <div className="space-y-6">
              <h2 className="text-[length:var(--text-h2)] font-serif font-semibold italic mb-4">
                소재 분석 결과
              </h2>
              {analysis ? (
                <div className="border border-border p-6 rounded-[var(--radius-card)] bg-surface">
                  <div className="prose whitespace-pre-wrap text-[length:var(--text-small)] leading-relaxed">
                    {analysis}
                  </div>
                </div>
              ) : aiLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : (
                <p className="text-text-secondary">분석 결과가 여기에 표시됩니다.</p>
              )}
              <div className="flex items-center gap-3 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => setCurrentStep("direction")}
                >
                  ← 이전
                </Button>
                <Button onClick={handleSuggest} isLoading={aiLoading} disabled={!analysis}>
                  구조 제안 받기 →
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Suggest */}
          {currentStep === "suggest" && (
            <div className="space-y-6">
              <h2 className="text-[length:var(--text-h2)] font-serif font-semibold italic mb-4">
                글 구조 제안
              </h2>
              {suggestion ? (
                <div className="border border-border p-6 rounded-[var(--radius-card)] bg-surface">
                  <div className="prose whitespace-pre-wrap text-[length:var(--text-small)] leading-relaxed">
                    {suggestion}
                  </div>
                </div>
              ) : aiLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : (
                <p className="text-text-secondary">구조 제안이 여기에 표시됩니다.</p>
              )}
              <div className="flex items-center gap-3 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => setCurrentStep("analyze")}
                >
                  ← 이전
                </Button>
                <Button onClick={handleDraft} isLoading={aiLoading} disabled={!suggestion}>
                  초안 작성 →
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Draft */}
          {currentStep === "draft" && (
            <div className="space-y-6">
              <h2 className="text-[length:var(--text-h2)] font-serif font-semibold italic mb-4">
                초안
              </h2>
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={20}
                className="font-mono text-[length:var(--text-small)]"
                placeholder="AI가 작성한 초안이 여기에 표시됩니다..."
              />
              <div className="flex items-center gap-3 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => setCurrentStep("suggest")}
                >
                  ← 이전
                </Button>
                <Button onClick={() => setCurrentStep("publish")}>
                  발행 준비 →
                </Button>
              </div>
            </div>
          )}

          {/* Step 6: Publish */}
          {currentStep === "publish" && (
            <div className="space-y-6">
              <h2 className="text-[length:var(--text-h2)] font-serif font-semibold italic mb-4">
                발행
              </h2>
              <div>
                <label className="block text-[length:var(--text-small)] font-medium mb-2">
                  글 제목
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="글 제목을 입력하세요"
                  className="w-full px-4 py-2 border border-border rounded-[var(--radius-input)] text-[length:var(--text-body)] placeholder:text-placeholder bg-background text-text-primary focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              <div>
                <label className="block text-[length:var(--text-small)] font-medium mb-2">
                  URL 슬러그
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) =>
                    setSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, "-")
                        .replace(/-+/g, "-")
                    )
                  }
                  placeholder="my-post-title"
                  className="w-full px-4 py-2 border border-border rounded-[var(--radius-input)] text-[length:var(--text-body)] font-mono placeholder:text-placeholder bg-background text-text-primary focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              {/* Preview */}
              <div>
                <h3 className="text-[length:var(--text-h3)] font-medium mb-3">
                  미리보기
                </h3>
                <div className="border border-border p-6 rounded-[var(--radius-card)] bg-surface">
                  <div className="prose whitespace-pre-wrap text-[length:var(--text-small)] leading-relaxed max-h-[300px] overflow-y-auto">
                    {draft || "초안이 없습니다."}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => setCurrentStep("draft")}
                >
                  ← 이전
                </Button>
                <Button
                  onClick={handlePublish}
                  isLoading={publishing}
                  disabled={!title.trim() || !slug.trim() || !draft}
                >
                  발행하기
                </Button>
              </div>
            </div>
          )}
        </div>
      </PageContainer>

      <Footer />
    </div>
  );
}
