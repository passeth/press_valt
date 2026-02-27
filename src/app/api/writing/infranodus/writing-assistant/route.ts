import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { extractGraphData } from "@/lib/infranodus";

export const maxDuration = 30;

const INFRANODUS_API_KEY = process.env.INFRANODUS_API_KEY!;
const BASE_URL = "https://infranodus.com/api/v1";

type WritingAssistantBody = {
  text: string;
};

/**
 * Writing Assistant — InfraNodus graphAndAdvice (optimize=develop)
 * Gets AI-generated text development advice based on knowledge graph structure.
 * Detects repetitive patterns, error clustering, missing transitions.
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

    const body = (await request.json()) as WritingAssistantBody;
    if (!body.text?.trim()) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const res = await fetch(
      `${BASE_URL}/graphAndAdvice?doNotSave=true&addStats=true&optimize=develop`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${INFRANODUS_API_KEY}`,
        },
        body: JSON.stringify({
          text: body.text,
          requestMode: "response",
          modelToUse: "gpt-4o",
        }),
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
    const advice = data.aiAdvice?.[0]?.text ?? "분석 결과를 가져올 수 없습니다.";
    const graph = extractGraphData(data as Record<string, unknown>);

    return NextResponse.json({
      advice,
      graph,
      usage: data.usage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
