import { PROMPTS } from "@/lib/ai/prompts";
import { registry } from "@/lib/ai/registry";
import { getDefaultModel } from "@/lib/ai/registry";
import { createClient } from "@/lib/supabase/server";
import { generateText } from "ai";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

type ImagePromptBody = {
  draft: string;
  style: string;
};

type ProviderModelId = `openai:${string}` | `anthropic:${string}`;

function buildModelId(provider: "openai" | "anthropic", model: string | null): ProviderModelId {
  if (model) {
    const candidate = `${provider}:${model}`;
    if (candidate.startsWith("openai:") || candidate.startsWith("anthropic:")) {
      return candidate as ProviderModelId;
    }
  }
  const fallback = `${provider}:${getDefaultModel(provider)}`;
  return fallback as ProviderModelId;
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

    const body = (await request.json()) as ImagePromptBody;

    if (!body.draft?.trim() || !body.style?.trim()) {
      return NextResponse.json({ error: "draft and style are required" }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("ai_provider, ai_model")
      .eq("id", user.id)
      .maybeSingle();

    const provider: "openai" | "anthropic" = profile?.ai_provider ?? "openai";
    const model = buildModelId(provider, profile?.ai_model ?? null);

    const result = await generateText({
      model: registry.languageModel(model),
      prompt: PROMPTS.imagePromptSuggestions(body.draft, body.style),
    });

    const prompts = Array.from(result.text.matchAll(/PROMPT_\d+:\s*(.+)/g), (match) => match[1].trim()).slice(0, 3);

    if (prompts.length !== 3) {
      return NextResponse.json({ error: "Failed to parse 3 prompts from model response" }, { status: 422 });
    }

    return NextResponse.json({ prompts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
