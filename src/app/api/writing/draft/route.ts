import { PROMPTS } from "@/lib/ai/prompts";
import { registry } from "@/lib/ai/registry";
import { createClient } from "@/lib/supabase/server";
import { streamText } from "ai";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

type DraftBody = {
  persona: string;
  materials: string;
  analysis: string;
  topic: string;
  coreMessage: string;
  length: string;
  emphasizedScraps: string;
  additionalInstructions: string;
  provider?: "openai" | "anthropic";
  model?: string;
};

type ProviderModelId = `openai:${string}` | `anthropic:${string}`;

const DEFAULT_MODELS = {
  openai: "openai:gpt-4o",
  anthropic: "anthropic:claude-sonnet-4-5-20250514",
} as const;

function isProviderModelId(value: string): value is ProviderModelId {
  return value.startsWith("openai:") || value.startsWith("anthropic:");
}

function hasDataStreamResponse(value: unknown): value is { toDataStreamResponse: () => Response } {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  if (!("toDataStreamResponse" in value)) {
    return false;
  }

  return typeof value.toDataStreamResponse === "function";
}

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

    const body = (await request.json()) as DraftBody;

    if (
      !body.persona ||
      !body.materials ||
      !body.analysis ||
      !body.topic ||
      !body.coreMessage ||
      !body.length
    ) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const provider = body.provider ?? "openai";
    const model: ProviderModelId =
      body.model && isProviderModelId(body.model) ? body.model : DEFAULT_MODELS[provider];

    const result = streamText({
      model: registry.languageModel(model),
      prompt: PROMPTS.draftGeneration({
        persona: body.persona,
        materials: body.materials,
        analysis: body.analysis,
        topic: body.topic,
        coreMessage: body.coreMessage,
        length: body.length,
        emphasizedScraps: body.emphasizedScraps ?? "",
        additionalInstructions: body.additionalInstructions ?? "",
      }),
    });

    if (hasDataStreamResponse(result)) {
      return result.toDataStreamResponse();
    }

    return result.toTextStreamResponse();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
