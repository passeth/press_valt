"use client";

import { useEffect, useState, use, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { marked } from "marked";
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

type Step = "materials" | "direction" | "infra_combined" | "suggest" | "draft" | "thumbnail" | "publish";

const STEPS: { key: Step; label: string }[] = [
  { key: "materials", label: "01 소재 확인" },
  { key: "direction", label: "02 방향 설정" },
  { key: "infra_combined", label: "03 AI 분석" },
  { key: "suggest", label: "04 구조 제안" },
  { key: "draft", label: "05 초안 작성" },
  { key: "thumbnail", label: "06 썸네일" },
  { key: "publish", label: "07 발행" },
];

const IMAGE_STYLES = [
  { id: "cinematic", label: "시네마틱", description: "영화적 구도와 조명" },
  { id: "abstract", label: "앱스트랙트", description: "추상적 형태와 색감" },
  { id: "illustration", label: "일러스트", description: "손그림 느낌의 일러스트" },
  { id: "sketch", label: "스케치", description: "연필 스케치 스타일" },
  { id: "colorful", label: "컬러풀", description: "생생한 색감과 패턴" },
];

async function readStream(
  res: Response,
  onChunk: (text: string) => void
): Promise<string> {
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
      full += chunk;
      onChunk(full);
    } else {
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

  const [topic, setTopic] = useState("");
  const [angle, setAngle] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("");

  const [analysis, setAnalysis] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const [infraCognitive, setInfraCognitive] = useState<CognitiveResult | null>(null);
  const [infraWriting, setInfraWriting] = useState("");
  const [infraCritical, setInfraCritical] = useState("");
  const [infraSeo, setInfraSeo] = useState("");
  const [seoKeyword, setSeoKeyword] = useState("");
  const [aiSeoKeyword, setAiSeoKeyword] = useState("");
  const [infraGraphs, setInfraGraphs] = useState<Record<string, GraphData>>({});
  const [infraLoading, setInfraLoading] = useState({ cognitive: false, writing: false, critical: false, seo: false });
  const [userNotes, setUserNotes] = useState("");

  const [imageStyle, setImageStyle] = useState("");
  const [imagePrompts, setImagePrompts] = useState<string[]>([]);
  const [selectedPromptIndex, setSelectedPromptIndex] = useState<number | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState("");
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState("");

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [publishing, setPublishing] = useState(false);

  const anyInfraLoading = infraLoading.cognitive || infraLoading.writing || infraLoading.critical || infraLoading.seo;

  const renderedAnalysis = useMemo(() => {
    if (!analysis || aiLoading) return "";
    return marked.parse(analysis, { async: false }) as string;
  }, [analysis, aiLoading]);

  const renderedWriting = useMemo(() => {
    if (!infraWriting) return "";
    return marked.parse(infraWriting, { async: false }) as string;
  }, [infraWriting]);

  const renderedCritical = useMemo(() => {
    if (!infraCritical) return "";
    return marked.parse(infraCritical, { async: false }) as string;
  }, [infraCritical]);

  const renderedSeo = useMemo(() => {
    if (!infraSeo) return "";
    return marked.parse(infraSeo, { async: false }) as string;
  }, [infraSeo]);

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

  const runAllInfraAnalysis = async (analysisText: string) => {
    setInfraLoading({ cognitive: true, writing: true, critical: true, seo: true });

    // Extract SEO keyword via AI
    let seoQuery = seoKeyword.trim() || topic.trim();
    try {
      const kwRes = await fetch("/api/writing/seo-keyword", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisText }),
      });
      if (kwRes.ok) {
        const kwData = await kwRes.json() as { keyword: string };
        if (kwData.keyword) {
          seoQuery = kwData.keyword;
          setAiSeoKeyword(kwData.keyword);
        }
      }
    } catch { /* AI keyword extraction failed — use fallback */ }

    const cognitiveTask = (async () => {
      try {
        const res = await fetch("/api/writing/infranodus/cognitive-variability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: analysisText }),
        });
        if (res.ok) {
          const data = await res.json();
          setInfraCognitive(data);
          if (data.graph) setInfraGraphs((prev) => ({ ...prev, cognitive: data.graph }));
        }
      } catch {}
      finally { setInfraLoading((prev) => ({ ...prev, cognitive: false })); }
    })();

    const writingTask = (async () => {
      try {
        const res = await fetch("/api/writing/infranodus/writing-assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: analysisText }),
        });
        if (res.ok) {
          const data = await res.json();
          setInfraWriting(data.advice);
          if (data.graph) setInfraGraphs((prev) => ({ ...prev, writing: data.graph }));
        }
      } catch {}
      finally { setInfraLoading((prev) => ({ ...prev, writing: false })); }
    })();

    const criticalTask = (async () => {
      try {
        const res = await fetch("/api/writing/infranodus/critical-perspective", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: analysisText }),
        });
        if (res.ok) {
          const data = await res.json();
          setInfraCritical(data.questions);
          if (data.graph) setInfraGraphs((prev) => ({ ...prev, critical: data.graph }));
        }
      } catch {}
      finally { setInfraLoading((prev) => ({ ...prev, critical: false })); }
    })();

    const seoTask = (async () => {
      if (!seoQuery) {
        setInfraLoading((prev) => ({ ...prev, seo: false }));
        return;
      }
      try {
        const res = await fetch("/api/writing/infranodus/seo-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ searchQuery: seoQuery }),
        });
        if (res.ok) {
          const data = await res.json();
          setInfraSeo(data.seoInsights);
          if (data.graph) setInfraGraphs((prev) => ({ ...prev, seo: data.graph }));
        }
      } catch {}
      finally { setInfraLoading((prev) => ({ ...prev, seo: false })); }
    })();

    await Promise.allSettled([cognitiveTask, writingTask, criticalTask, seoTask]);
  };

  const handleAnalyze = async () => {
    if (scraps.length === 0) {
      setAiError("소재가 없습니다. 먼저 콜렉션에 소재를 추가하세요.");
      return;
    }
    setAiLoading(true);
    setAiError("");
    setAnalysis("");
    setInfraCognitive(null);
    setInfraWriting("");
    setInfraCritical("");
    setInfraSeo("");
    setInfraGraphs({});
    setCurrentStep("infra_combined");

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

      const fullAnalysis = await readStream(res, (text) => setAnalysis(text));
      setAiLoading(false);
      void runAllInfraAnalysis(fullAnalysis);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "분석 중 오류가 발생했습니다.");
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
        userNotes.trim() && `\n\n[사용자 추가 아이디어]\n${userNotes.trim()}`,
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
        <div className="mb-8">
          <h1 className="text-[length:var(--text-h1)] font-serif font-semibold italic mb-2">
            글 쓰기
          </h1>
          <p className="text-[length:var(--text-small)] text-text-secondary">
            모은 소재를 기반으로 AI와 협업하여 글을 작성합니다.
          </p>
        </div>

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

        {aiError && (
          <div className="mb-6 p-4 border border-red-300 bg-red-50 text-red-700 text-[length:var(--text-small)] rounded-[var(--radius-card)]">
            {aiError}
          </div>
        )}

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

          {/* Step 3: Combined AI Analysis (Writing Assistant + Critical + SEO) */}
          {currentStep === "infra_combined" && (
            <div className="space-y-8">
              <div>
                <h2 className="text-[length:var(--text-h2)] font-serif font-semibold italic mb-2">
                  AI 분석
                </h2>
                <p className="text-[length:var(--text-small)] text-text-secondary">
                  소재를 분석하고 InfraNodus로 다각도 인사이트를 생성합니다.
                </p>
              </div>

              {aiLoading && (
                <div className="border border-border p-6 bg-surface">
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-block h-4 w-4 border-2 border-accent border-t-transparent animate-spin"
                      style={{ borderRadius: "50%" }}
                    />
                    <p className="text-[length:var(--text-small)] text-text-secondary">
                      소재를 분석하고 있습니다...
                    </p>
                  </div>
                </div>
              )}

              {!aiLoading && analysis && (
                <details className="border border-border">
                  <summary className="px-4 py-3 bg-surface cursor-pointer text-[length:var(--text-small)] font-medium text-text-primary hover:bg-background transition-colors">
                    소재 분석 결과 보기
                  </summary>
                  <div className="p-4 border-t border-border">
                    <div
                      className="prose text-[length:var(--text-small)] leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: renderedAnalysis }}
                    />
                  </div>
                </details>
              )}

              {!aiLoading && analysis && (
                <>
                  {/* Writing Assistant */}
                  <section className="border border-border">
                    <div className="px-4 py-3 border-b border-border bg-surface">
                      <h3 className="text-[length:var(--text-body)] font-semibold">글쓰기 어시스턴트</h3>
                      <p className="text-[length:var(--text-caption)] text-text-secondary mt-0.5">
                        지식 그래프 구조를 기반으로 글 발전 방향을 제안합니다.
                      </p>
                    </div>
                    <div className="p-4">
                      {infraLoading.writing ? (
                        <div className="space-y-3">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-4 w-full" />
                        </div>
                      ) : infraWriting ? (
                        <div
                          className="prose text-[length:var(--text-small)] leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: renderedWriting }}
                        />
                      ) : (
                        <p className="text-text-tertiary text-[length:var(--text-small)]">결과를 불러오지 못했습니다.</p>
                      )}
                    </div>
                    {infraGraphs.writing && (
                      <div className="border-t border-border">
                        <div className="px-4 py-2 border-b border-border bg-surface">
                          <p className="text-[length:var(--text-caption)] text-text-secondary font-medium tracking-wide uppercase">
                            Knowledge Graph
                          </p>
                        </div>
                        <KnowledgeGraph graphData={infraGraphs.writing} />
                      </div>
                    )}
                  </section>

                  {/* Critical Perspective */}
                  <section className="border border-border">
                    <div className="px-4 py-3 border-b border-border bg-surface">
                      <h3 className="text-[length:var(--text-body)] font-semibold">비판적 관점</h3>
                      <p className="text-[length:var(--text-caption)] text-text-secondary mt-0.5">
                        콘텐츠의 빈틈을 메우는 탐구 질문을 생성합니다.
                      </p>
                    </div>
                    <div className="p-4">
                      {infraLoading.critical ? (
                        <div className="space-y-3">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-4 w-full" />
                        </div>
                      ) : infraCritical ? (
                        <div
                          className="prose text-[length:var(--text-small)] leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: renderedCritical }}
                        />
                      ) : (
                        <p className="text-text-tertiary text-[length:var(--text-small)]">결과를 불러오지 못했습니다.</p>
                      )}
                    </div>
                  </section>

                  {/* SEO Analysis */}
                  <section className="border border-border">
                    <div className="px-4 py-3 border-b border-border bg-surface">
                      <h3 className="text-[length:var(--text-body)] font-semibold">SEO 분석</h3>
                      <p className="text-[length:var(--text-caption)] text-text-secondary mt-0.5">
                        키워드: {aiSeoKeyword || seoKeyword.trim() || topic.trim() || "—"}
                      </p>
                    </div>
                    <div className="p-4">
                      {infraLoading.seo ? (
                        <div className="space-y-3">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-4 w-full" />
                        </div>
                      ) : infraSeo ? (
                        <div
                          className="prose text-[length:var(--text-small)] leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: renderedSeo }}
                        />
                      ) : (
                        <p className="text-text-tertiary text-[length:var(--text-small)]">
                          {(aiSeoKeyword || seoKeyword.trim() || topic.trim()) ? "결과를 불러오지 못했습니다." : "키워드를 추출하지 못해 SEO 분석을 건너뛰었습니다."}
                        </p>
                      )}
                    </div>
                    {infraGraphs.seo && (
                      <div className="border-t border-border">
                        <div className="px-4 py-2 border-b border-border bg-surface">
                          <p className="text-[length:var(--text-caption)] text-text-secondary font-medium tracking-wide uppercase">
                            Knowledge Graph
                          </p>
                        </div>
                        <KnowledgeGraph graphData={infraGraphs.seo} />
                      </div>
                    )}
                  </section>

                  {/* User additional notes */}
                  <div className="border border-border p-5">
                    <label className="block text-[length:var(--text-small)] font-medium mb-2">
                      추가하고 싶은 이야기
                    </label>
                    <p className="text-[length:var(--text-caption)] text-text-secondary mb-3">
                      그래프를 보며 떠오른 아이디어나 추가하고 싶은 내용을 자유롭게 적어주세요. 구조 제안에 반영됩니다.
                    </p>
                    <Textarea
                      value={userNotes}
                      onChange={(e) => setUserNotes(e.target.value)}
                      rows={4}
                      placeholder="예: 이 부분에서 개인적인 경험을 더 넣고 싶다, 반대 의견도 다뤄보자..."
                    />
                  </div>
                </>
              )}

              <div className="flex items-center gap-3 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => setCurrentStep("direction")}
                >
                  ← 이전
                </Button>
                <Button
                  onClick={handleSuggest}
                  isLoading={aiLoading}
                  disabled={!analysis || aiLoading || anyInfraLoading}
                >
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
                  onClick={() => setCurrentStep("infra_combined")}
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
                <Button onClick={() => setCurrentStep("thumbnail")}>
                  발행 준비 →
                </Button>
              </div>
            </div>
          )}

          {/* Step 6: Thumbnail */}
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

          {/* Step 7: Publish */}
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
