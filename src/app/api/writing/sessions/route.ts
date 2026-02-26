import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types";
import { NextRequest, NextResponse } from "next/server";

type CreateSessionBody = {
  collection_id: string;
  persona?: string | null;
  direction?: Database["public"]["Tables"]["writing_sessions"]["Row"]["direction"];
  model_provider: Database["public"]["Tables"]["writing_sessions"]["Row"]["model_provider"];
  model_name: string;
};

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

    const body = (await request.json()) as CreateSessionBody;

    if (!body.collection_id || !body.model_provider || !body.model_name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!["openai", "anthropic"].includes(body.model_provider)) {
      return NextResponse.json({ error: "Invalid model_provider" }, { status: 400 });
    }

    const { data: collection, error: collectionError } = await supabase
      .from("collections")
      .select("id")
      .eq("id", body.collection_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (collectionError) {
      return NextResponse.json({ error: collectionError.message }, { status: 500 });
    }

    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("writing_sessions")
      .insert({
        user_id: user.id,
        collection_id: body.collection_id,
        persona: body.persona ?? null,
        direction: body.direction ?? null,
        model_provider: body.model_provider,
        model_name: body.model_name,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ session: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
