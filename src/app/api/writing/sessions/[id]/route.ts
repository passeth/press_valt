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

    return NextResponse.json({
      session,
      artifacts: artifacts ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
