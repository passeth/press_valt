"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Skeleton } from "@/components/ui/Skeleton";
import type { GraphData } from "@/types/graph";

const KnowledgeGraph = dynamic(() => import("@/components/writing/KnowledgeGraph"), { ssr: false });

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

interface CognitiveResult {
  diversityScore: string;
  cognitiveState: string;
  description: string;
  suggestion: string;
  topConcepts: string[];
  gapConcepts: string[];
}

type Step = "materials" | "direction" | "analyze" | "infra_cognitive" | "infra_writing" | "infra_critical" | "infra_seo" | "suggest" | "draft" | "thumbnail" | "publish";

const STEPS: { key: Step; label: string }[] = [
  { key: "materials", label: "01 소재 확인" },
  { key: "direction", label: "02 방향 설정" },
  { key: "analyze", label: "03 소재 분석" },
  { key: "infra_cognitive", label: "04 인지 다양성" },
  { key: "infra_writing", label: "05 글쓰기 어시스턴트" },
  { key: "infra_critical", label: "06 비판적 관점" },
  { key: "infra_seo", label: "07 SEO 분석" },
  { key: "suggest", label: "08 구조 제안" },
  { key: "draft", label: "09 초안 작성" },
  { key: "thumbnail", label: "10 썸네일" },
  { key: "publish", label: "11 발행" },
];

const IMAGE_STYLES = [
  { id: "cinematic", label: "시네마틱", description: "영화적 구도와 조명" },
  { id: "abstract", label: "앱스트랙트", description: "추상적 형태와 색감" },
  { id: "illustration", label: "일러스트", description: "손그림 느낌의 일러스트" },
  { id: "sketch", label: "스케치", description: "연필 스케치 스타일" },
  { id: "colorful", label: "컬러풀", description: "생생한 색감과 패턴" },
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
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  // InfraNodus results
  const [infraCognitive, setInfraCognitive] = useState<CognitiveResult | null>(null);
  const [infraWriting, setInfraWriting] = useState("");
  const [infraCritical, setInfraCritical] = useState("");
  const [infraSeo, setInfraSeo] = useState("");
  const [seoKeyword, setSeoKeyword] = useState("");
  const [infraGraphs, setInfraGraphs] = useState<Record<string, GraphData>>({});

  const [imageStyle, setImageStyle] = useState("");
  const [imagePrompts, setImagePrompts] = useState<string[]>([]);
  const [selectedPromptIndex, setSelectedPromptIndex] = useState<number | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState("");
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState("");

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

      if (data.scraps && data.scraps.length > 0) {
        setScraps(data.scraps);
        return;
      }

      try {
        const collectionRes = await fetch(`/api/collections/${data.session.collection_id}`);
        const collectionScraps: Scrap[] = [];
        if (collectionRes.ok) {
          const collectionData = await collectionRes.json();
          for (const item of (collectionData.items ?? []) as CollectionItem[]) {
            if (item.scrap) {
              collectionScraps.push(item.scrap);
            }
          }
        } else {
          console.error("Collection fetch failed:", collectionRes.status);
        }
        setScraps(collectionScraps);
      } catch (err) {
        console.error("Failed to fetch collection scraps:", err);
        setScraps([]);
      }
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

  const handleInfraCognitive = async () => {
    if (!analysis) return;
    setAiLoading(true);
    setAiError("");
    setInfraCognitive(null);

    try {
      const res = await fetch("/api/writing/infranodus/cognitive-variability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: analysis }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "서버 오류" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setInfraCognitive(data);
      if (data.graph) {
        setInfraGraphs(prev => ({ ...prev, cognitive: data.graph }));
      }
      setCurrentStep("infra_cognitive");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "인지 다양성 분석 중 오류가 발생했습니다.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleInfraWriting = async () => {
    if (!analysis) return;
    setAiLoading(true);
    setAiError("");
    setInfraWriting("");

    try {
      const res = await fetch("/api/writing/infranodus/writing-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: analysis }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "서버 오류" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setInfraWriting(data.advice);
      if (data.graph) {
        setInfraGraphs(prev => ({ ...prev, writing: data.graph }));
      }
      setCurrentStep("infra_writing");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "글쓰기 어시스턴트 분석 중 오류가 발생했습니다.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleInfraCritical = async () => {
    if (!analysis) return;
    setAiLoading(true);
    setAiError("");
    setInfraCritical("");

    try {
      const res = await fetch("/api/writing/infranodus/critical-perspective", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: analysis }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "서버 오류" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setInfraCritical(data.questions);
      if (data.graph) {
        setInfraGraphs(prev => ({ ...prev, critical: data.graph }));
      }
      setCurrentStep("infra_critical");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "비판적 관점 분석 중 오류가 발생했습니다.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleInfraSeo = async () => {
    const query = seoKeyword.trim() || topic.trim();
    if (!query) {
      setAiError("SEO 분석을 위한 키워드를 입력하세요.");
      return;
    }
    setAiLoading(true);
    setAiError("");
    setInfraSeo("");

    try {
      const res = await fetch("/api/writing/infranodus/seo-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchQuery: query }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "서버 오류" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setInfraSeo(data.seoInsights);
      if (data.graph) {
        setInfraGraphs(prev => ({ ...prev, seo: data.graph }));
      }
      setCurrentStep("infra_seo");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "SEO 분석 중 오류가 발생했습니다.");
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
      const enrichedAnalysis = [
        analysis,
        infraCognitive && `\n\n[인지 다양성 분석]\n상태: ${infraCognitive.cognitiveState}\n${infraCognitive.description}\n제안: ${infraCognitive.suggestion}`,
        infraWriting && `\n\n[글쓰기 어시스턴트]\n${infraWriting}`,
        infraCritical && `\n\n[비판적 관점 - 탐구 질문]\n${infraCritical}`,
        infraSeo && `\n\n[SEO 분석]\n${infraSeo}`,
      ].filter(Boolean).join("");

      const res = await fetch("/api/writing/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis: enrichedAnalysis }),
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
          topic: topic || (selectedSuggestionIndex !== null ? (suggestion.split(/(?=\d+\.)/).filter(Boolean)[selectedSuggestionIndex]?.split("\n")[0]?.replace(/^\d+\.\s*주제:\s*/, "").trim() || "자동 생성 주제") : suggestion.split("\n")[0]) || "자동 생성 주제",
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

  const handleGeneratePrompts = async () => {
    if (!draft || !imageStyle) return;
    setImageLoading(true);
    setImageError("");
    setImagePrompts([]);
    setSelectedPromptIndex(null);
    setGeneratedImageUrl("");

    try {
      const res = await fetch("/api/writing/image-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft, style: imageStyle }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "서버 오류" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setImagePrompts(data.prompts);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "프롬프트 생성 중 오류가 발생했습니다.");
    } finally {
      setImageLoading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (selectedPromptIndex === null || !imagePrompts[selectedPromptIndex]) return;
    setImageLoading(true);
    setImageError("");
    setGeneratedImageUrl("");

    try {
      const res = await fetch("/api/writing/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: imagePrompts[selectedPromptIndex] }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "서버 오류" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setGeneratedImageUrl(data.imageUrl);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "이미지 생성 중 오류가 발생했습니다.");
    } finally {
      setImageLoading(false);
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
          thumbnail_url: generatedImageUrl || undefined,
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
        <div className="flex flex-wrap gap-1 mb-8 pb-6 border-b border-border">
          {STEPS.map((step, i) => (
            <button
              key={step.key}
              onClick={() => setCurrentStep(step.key)}
              className={`px-3 py-1.5 text-[length:var(--text-caption)] font-medium transition-colors ${
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
                <Button onClick={handleInfraCognitive} isLoading={aiLoading} disabled={!analysis}>
                  인지 다양성 분석 →
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: InfraNodus — Cognitive Variability */}
          {currentStep === "infra_cognitive" && (
            <div className="space-y-6">
              <h2 className="text-[length:var(--text-h2)] font-serif font-semibold italic mb-4">
                인지 다양성 분석
              </h2>
              <p className="text-[length:var(--text-small)] text-text-secondary">
                InfraNodus가 텍스트의 인지적 다양성을 분석합니다. 글의 관점이 편향되었는지, 다양한지 파악합니다.
              </p>
              {infraCognitive ? (
                <div className="space-y-4">
                  <div className="border border-border p-6 rounded-[var(--radius-card)] bg-surface">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="px-3 py-1 bg-accent text-text-inverted text-[length:var(--text-caption)] font-medium">
                        {infraCognitive.cognitiveState}
                      </span>
                    </div>
                    <p className="text-[length:var(--text-small)] leading-relaxed mb-4">
                      {infraCognitive.description}
                    </p>
                    <div className="border-t border-border pt-4">
                      <p className="text-[length:var(--text-small)] font-medium mb-1">제안</p>
                      <p className="text-[length:var(--text-small)] text-text-secondary leading-relaxed">
                        {infraCognitive.suggestion}
                      </p>
                    </div>
                  </div>

                  {infraCognitive.topConcepts.length > 0 && (
                    <div className="border border-border p-4 rounded-[var(--radius-card)]">
                      <p className="text-[length:var(--text-small)] font-medium mb-2">핵심 개념</p>
                      <div className="flex flex-wrap gap-2">
                        {infraCognitive.topConcepts.map((concept, i) => (
                          <span key={i} className="px-2 py-1 border border-border text-[length:var(--text-caption)]">
                            {typeof concept === "string" ? concept : JSON.stringify(concept)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {infraCognitive.gapConcepts.length > 0 && (
                    <div className="border border-border p-4 rounded-[var(--radius-card)]">
                      <p className="text-[length:var(--text-small)] font-medium mb-2">빈틈 개념 (Gap)</p>
                      <div className="flex flex-wrap gap-2">
                        {infraCognitive.gapConcepts.map((concept, i) => (
                          <span key={i} className="px-2 py-1 border border-dashed border-border text-[length:var(--text-caption)] text-text-secondary">
                            {typeof concept === "string" ? concept : JSON.stringify(concept)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : aiLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : (
                <p className="text-text-secondary">인지 다양성 분석 결과가 여기에 표시됩니다.</p>
              )}
              {infraGraphs.cognitive && (
                <div className="border border-border overflow-hidden">
                  <div className="px-4 py-2 border-b border-border bg-surface">
                    <p className="text-[length:var(--text-caption)] text-text-secondary font-medium tracking-wide uppercase">
                      Knowledge Graph
                    </p>
                  </div>
                  <KnowledgeGraph graphData={infraGraphs.cognitive} />
                </div>
              )}
              <div className="flex items-center gap-3 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => setCurrentStep("analyze")}
                >
                  ← 이전
                </Button>
                <Button onClick={handleInfraWriting} isLoading={aiLoading} disabled={!analysis}>
                  글쓰기 어시스턴트 →
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: InfraNodus — Writing Assistant */}
          {currentStep === "infra_writing" && (
            <div className="space-y-6">
              <h2 className="text-[length:var(--text-h2)] font-serif font-semibold italic mb-4">
                글쓰기 어시스턴트
              </h2>
              <p className="text-[length:var(--text-small)] text-text-secondary">
                InfraNodus가 지식 그래프 구조를 기반으로 글 발전 방향을 제안합니다.
              </p>
              {infraWriting ? (
                <div className="border border-border p-6 rounded-[var(--radius-card)] bg-surface">
                  <div className="prose whitespace-pre-wrap text-[length:var(--text-small)] leading-relaxed">
                    {infraWriting}
                  </div>
                </div>
              ) : aiLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : (
                <p className="text-text-secondary">글쓰기 어시스턴트 결과가 여기에 표시됩니다.</p>
              )}
              {infraGraphs.writing && (
                <div className="border border-border overflow-hidden">
                  <div className="px-4 py-2 border-b border-border bg-surface">
                    <p className="text-[length:var(--text-caption)] text-text-secondary font-medium tracking-wide uppercase">
                      Knowledge Graph
                    </p>
                  </div>
                  <KnowledgeGraph graphData={infraGraphs.writing} />
                </div>
              )}
              <div className="flex items-center gap-3 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => setCurrentStep("infra_cognitive")}
                >
                  ← 이전
                </Button>
                <Button onClick={handleInfraCritical} isLoading={aiLoading} disabled={!analysis}>
                  비판적 관점 분석 →
                </Button>
              </div>
            </div>
          )}

          {/* Step 6: InfraNodus — Critical Perspective */}
          {currentStep === "infra_critical" && (
            <div className="space-y-6">
              <h2 className="text-[length:var(--text-h2)] font-serif font-semibold italic mb-4">
                비판적 관점
              </h2>
              <p className="text-[length:var(--text-small)] text-text-secondary">
                콘텐츠의 빈틈을 메우는 탐구 질문을 생성합니다. 가정을 의심하고 대안적 시각을 제시합니다.
              </p>
              {infraCritical ? (
                <div className="border border-border p-6 rounded-[var(--radius-card)] bg-surface">
                  <div className="prose whitespace-pre-wrap text-[length:var(--text-small)] leading-relaxed">
                    {infraCritical}
                  </div>
                </div>
              ) : aiLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : (
                <p className="text-text-secondary">비판적 관점 분석 결과가 여기에 표시됩니다.</p>
              )}
              {infraGraphs.critical && (
                <div className="border border-border overflow-hidden">
                  <div className="px-4 py-2 border-b border-border bg-surface">
                    <p className="text-[length:var(--text-caption)] text-text-secondary font-medium tracking-wide uppercase">
                      Knowledge Graph
                    </p>
                  </div>
                  <KnowledgeGraph graphData={infraGraphs.critical} />
                </div>
              )}
              <div className="flex items-center gap-3 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => setCurrentStep("infra_writing")}
                >
                  ← 이전
                </Button>
                <Button onClick={() => setCurrentStep("infra_seo")} disabled={!analysis}>
                  SEO 분석 →
                </Button>
              </div>
            </div>
          )}

          {/* Step 7: InfraNodus — SEO Analysis */}
          {currentStep === "infra_seo" && (
            <div className="space-y-6">
              <h2 className="text-[length:var(--text-h2)] font-serif font-semibold italic mb-4">
                SEO 분석
              </h2>
              <p className="text-[length:var(--text-small)] text-text-secondary">
                사람들이 검색하지만 찾지 못하는 콘텐츠 갭을 분석합니다.
              </p>
              <div>
                <label className="block text-[length:var(--text-small)] font-medium mb-2">
                  SEO 키워드
                </label>
                <input
                  type="text"
                  value={seoKeyword}
                  onChange={(e) => setSeoKeyword(e.target.value)}
                  placeholder={topic || "검색 키워드를 입력하세요"}
                  className="w-full px-4 py-2 border border-border rounded-[var(--radius-input)] text-[length:var(--text-body)] placeholder:text-placeholder bg-background text-text-primary focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              {!infraSeo && (
                <Button onClick={handleInfraSeo} isLoading={aiLoading}>
                  SEO 분석 시작
                </Button>
              )}
              {infraSeo ? (
                <div className="border border-border p-6 rounded-[var(--radius-card)] bg-surface">
                  <div className="prose whitespace-pre-wrap text-[length:var(--text-small)] leading-relaxed">
                    {infraSeo}
                  </div>
                </div>
              ) : aiLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : null}
              {infraGraphs.seo && (
                <div className="border border-border overflow-hidden">
                  <div className="px-4 py-2 border-b border-border bg-surface">
                    <p className="text-[length:var(--text-caption)] text-text-secondary font-medium tracking-wide uppercase">
                      Knowledge Graph
                    </p>
                  </div>
                  <KnowledgeGraph graphData={infraGraphs.seo} />
                </div>
              )}
              <div className="flex items-center gap-3 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => setCurrentStep("infra_critical")}
                >
                  ← 이전
                </Button>
                <Button onClick={handleSuggest} isLoading={aiLoading} disabled={!analysis}>
                  구조 제안 받기 →
                </Button>
              </div>
            </div>
          )}

          {/* Step 8: Suggest */}
          {currentStep === "suggest" && (
            <div className="space-y-6">
              <h2 className="text-[length:var(--text-h2)] font-serif font-semibold italic mb-4">
                글 구조 제안
              </h2>
              <p className="text-[length:var(--text-small)] text-text-secondary">
                아래 3가지 주제 중 하나를 선택해주세요. 선택한 주제를 기반으로 초안이 작성됩니다.
              </p>
              {suggestion ? (
                <div className="space-y-3">
                  {suggestion
                    .split(/(?=\d+\.)/)
                    .filter((s) => s.trim())
                    .map((block, i) => {
                      const lines = block.trim().split("\n");
                      const titleLine = lines[0]?.replace(/^\d+\.\s*주제:\s*/, "").trim() || "";
                      const rest = lines.slice(1).join("\n").trim();
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSelectedSuggestionIndex(i)}
                          className={`w-full text-left p-5 border transition-colors ${
                            selectedSuggestionIndex === i
                              ? "border-accent bg-surface"
                              : "border-border bg-background hover:bg-surface"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className={`shrink-0 w-7 h-7 flex items-center justify-center border text-[length:var(--text-caption)] font-medium ${
                              selectedSuggestionIndex === i
                                ? "border-accent bg-accent text-text-inverted"
                                : "border-border text-text-secondary"
                            }`}>
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[length:var(--text-body)] font-semibold leading-snug">
                                {titleLine}
                              </p>
                              {rest && (
                                <p className="text-[length:var(--text-small)] text-text-secondary mt-2 whitespace-pre-wrap leading-relaxed">
                                  {rest}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              ) : aiLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : (
                <p className="text-text-secondary">구조 제안이 여기에 표시됩니다.</p>
              )}
              <div className="flex items-center gap-3 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => setCurrentStep("infra_seo")}
                >
                  ← 이전
                </Button>
                <Button
                  onClick={handleDraft}
                  isLoading={aiLoading}
                  disabled={!suggestion || selectedSuggestionIndex === null}
                >
                  선택한 주제로 초안 작성 →
                </Button>
              </div>
            </div>
          )}

          {/* Step 9: Draft */}
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
                <Button onClick={() => setCurrentStep("thumbnail")}>
                  발행 준비 →
                </Button>
              </div>
            </div>
          )}

          {currentStep === "thumbnail" && (
            <div className="space-y-6">
              <h2 className="text-[length:var(--text-h2)] font-serif font-semibold italic mb-4">
                썸네일 이미지
              </h2>
              <p className="text-[length:var(--text-small)] text-text-secondary">
                글에 어울리는 썸네일 이미지를 AI로 생성할 수 있습니다.
              </p>

              <div>
                <label className="block text-[length:var(--text-small)] font-medium mb-3">
                  이미지 스타일
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {IMAGE_STYLES.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setImageStyle(style.id)}
                      className={`p-3 border text-left transition-colors ${
                        imageStyle === style.id
                          ? "border-accent bg-surface"
                          : "border-border bg-background hover:bg-surface"
                      }`}
                    >
                      <span className="block text-[length:var(--text-body)] font-medium">
                        {style.label}
                      </span>
                      <span className="block text-[length:var(--text-caption)] text-text-secondary mt-1">
                        {style.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {imageStyle && (
                <Button
                  onClick={handleGeneratePrompts}
                  isLoading={imageLoading && imagePrompts.length === 0}
                  disabled={!imageStyle}
                >
                  프롬프트 생성
                </Button>
              )}

              {imagePrompts.length > 0 && (
                <div>
                  <label className="block text-[length:var(--text-small)] font-medium mb-3">
                    프롬프트 선택
                  </label>
                  <div className="space-y-2">
                    {imagePrompts.map((prompt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedPromptIndex(i)}
                        className={`w-full text-left p-4 border transition-colors ${
                          selectedPromptIndex === i
                            ? "border-accent bg-surface"
                            : "border-border bg-background hover:bg-surface"
                        }`}
                      >
                        <span className="text-[length:var(--text-caption)] text-text-secondary">
                          프롬프트 {i + 1}
                        </span>
                        <p className="text-[length:var(--text-small)] mt-1">{prompt}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedPromptIndex !== null && !generatedImageUrl && (
                <Button onClick={handleGenerateImage} isLoading={imageLoading}>
                  이미지 생성
                </Button>
              )}

              {imageError && (
                <div className="p-4 border border-red-300 bg-red-50 text-red-700 text-[length:var(--text-small)]">
                  {imageError}
                </div>
              )}

              {generatedImageUrl && (
                <div>
                  <label className="block text-[length:var(--text-small)] font-medium mb-3">
                    생성된 이미지
                  </label>
                  <div className="border border-border overflow-hidden">
                    <img
                      src={generatedImageUrl}
                      alt="Generated thumbnail"
                      className="w-full max-h-[400px] object-contain bg-surface"
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setGeneratedImageUrl("");
                        setSelectedPromptIndex(null);
                      }}
                    >
                      다시 생성
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-4">
                <Button variant="secondary" onClick={() => setCurrentStep("draft")}>
                  ← 이전
                </Button>
                <Button variant="secondary" onClick={() => setCurrentStep("publish")}>
                  건너뛰기
                </Button>
                {generatedImageUrl && <Button onClick={() => setCurrentStep("publish")}>발행 준비 →</Button>}
              </div>
            </div>
          )}

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
                  onClick={() => setCurrentStep("thumbnail")}
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
