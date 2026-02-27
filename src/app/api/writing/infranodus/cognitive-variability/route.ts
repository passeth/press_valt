import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

const INFRANODUS_API_KEY = process.env.INFRANODUS_API_KEY!;
const BASE_URL = "https://infranodus.com/api/v1";

type CognitiveBody = {
  text: string;
};

/**
 * Cognitive Variability — InfraNodus graphAndStatements
 * Analyzes text to determine cognitive diversity state
 * (biased / focused / diversified / dispersed)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 401 });
    }
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as CognitiveBody;
    if (!body.text?.trim()) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const res = await fetch(
      `${BASE_URL}/graphAndStatements?doNotSave=true&addStats=true&includeGraphSummary=true`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${INFRANODUS_API_KEY}`,
        },
        body: JSON.stringify({ text: body.text, aiTopics: false }),
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "InfraNodus API error");
      return NextResponse.json(
        { error: `InfraNodus API error: ${res.status} ${errText}` },
        { status: 502 }
      );
    }

    const data = await res.json();


    const diversityStats = data.graphSummary?.diversity_stats;
    const diversityScore = diversityStats?.diversity_score ?? "unknown";
    const topConcepts = data.graphSummary?.top_concepts ?? [];
    const gapConcepts = data.graphSummary?.gap_concepts ?? [];


    const stateMap: Record<string, { state: string; description: string; suggestion: string }> = {
      biased: {
        state: "편향됨 (Biased)",
        description:
          "하나의 관점이나 주제에 집중되어 있습니다. 텍스트가 특정 방향으로 편향되어 있어 다양한 시각이 부족합니다.",
        suggestion:
          "새로운 관점이나 반대 의견을 추가해보세요. 다른 분야의 소재를 연결하면 글의 깊이가 더해집니다.",
      },
      focused: {
        state: "집중됨 (Focused)",
        description:
          "몇 가지 핵심 주제에 잘 집중하고 있습니다. 구조는 좋지만 연결이 더 필요할 수 있습니다.",
        suggestion:
          "핵심 주제 간의 연결고리를 강화하세요. 빈틈(gap)에 있는 개념을 활용하면 더 풍부한 글이 됩니다.",
      },
      diversified: {
        state: "다양함 (Diversified)",
        description:
          "여러 주제가 잘 연결되어 있습니다. 다양한 관점이 균형 있게 분포되어 있어 좋은 상태입니다.",
        suggestion:
          "현재 균형이 잘 잡혀있습니다. 핵심 메시지를 더 명확히 하고, 가장 강력한 연결고리를 중심으로 구조를 잡아보세요.",
      },
      dispersed: {
        state: "분산됨 (Dispersed)",
        description:
          "너무 많은 주제가 흩어져 있어 초점이 부족합니다. 독자가 핵심을 파악하기 어려울 수 있습니다.",
        suggestion:
          "핵심 주제 2-3개로 좁히세요. 관련 없는 소재는 과감히 빼고, 남은 소재 간의 연결을 강화하세요.",
      },
    };

    const cognitiveState = stateMap[diversityScore] ?? {
      state: `분석됨 (${diversityScore})`,
      description: "텍스트의 인지적 다양성을 분석했습니다.",
      suggestion: "분석 결과를 바탕으로 글의 방향을 조정해보세요.",
    };

    return NextResponse.json({
      diversityScore,
      cognitiveState: cognitiveState.state,
      description: cognitiveState.description,
      suggestion: cognitiveState.suggestion,
      topConcepts: topConcepts.slice(0, 10),
      gapConcepts: gapConcepts.slice(0, 5),
      stats: diversityStats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
