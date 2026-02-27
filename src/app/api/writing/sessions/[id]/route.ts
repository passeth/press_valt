import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
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

    const { data: session, error: sessionError } = await supabase
      .from("writing_sessions")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (sessionError) {
      return NextResponse.json({ error: sessionError.message }, { status: 500 });
    }

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { data: artifacts, error: artifactsError } = await supabase
      .from("writing_session_artifacts")
      .select("*")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true });

    if (artifactsError) {
      return NextResponse.json({ error: artifactsError.message }, { status: 500 });
    }

    let scraps: Array<{ id: string; exact_quote: string; user_note: string | null }> = [];
    if (session.collection_id) {
      const { data: items, error: itemsError } = await supabase
        .from("collection_items")
        .select("scrap_id")
        .eq("collection_id", session.collection_id)
        .order("position", { ascending: true });

      if (itemsError) {
        return NextResponse.json({ error: itemsError.message }, { status: 500 });
      }

      const scrapIds = (items ?? [])
        .map((item) => item.scrap_id)
        .filter((sid): sid is string => sid !== null);

      if (scrapIds.length > 0) {
        const { data: scrapRows, error: scrapsError } = await supabase
          .from("scraps")
          .select("id, exact_quote, user_note")
          .in("id", scrapIds);

        if (scrapsError) {
          return NextResponse.json({ error: scrapsError.message }, { status: 500 });
        }

        const scrapMap = new Map((scrapRows ?? []).map((s) => [s.id, s]));
        scraps = scrapIds
          .map((sid) => scrapMap.get(sid))
          .filter((s): s is { id: string; exact_quote: string; user_note: string | null } => s !== undefined);
      }
    }

    return NextResponse.json({
      session,
      artifacts: artifacts ?? [],
      scraps,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
