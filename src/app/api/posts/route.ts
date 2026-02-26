import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types";
import { NextRequest, NextResponse } from "next/server";

type CreatePostBody = {
  session_id: string;
  slug: string;
  title: string;
  markdown?: string;
  rendered_html?: string | null;
  status?: Database["public"]["Tables"]["user_posts"]["Row"]["status"];
  published_at?: string | null;
  sources?: Array<{
    scrap_id: string;
    usage: Database["public"]["Tables"]["post_sources"]["Row"]["usage"];
  }>;
};

export async function GET() {
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

    const { data, error } = await supabase
      .from("user_posts")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ posts: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
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

    const body = (await request.json()) as CreatePostBody;

    if (!body.session_id || !body.slug?.trim() || !body.title?.trim()) {
      return NextResponse.json({ error: "session_id, slug, and title are required" }, { status: 400 });
    }

    const { data: session, error: sessionError } = await supabase
      .from("writing_sessions")
      .select("id")
      .eq("id", body.session_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (sessionError) {
      return NextResponse.json({ error: sessionError.message }, { status: 500 });
    }

    if (!session) {
      return NextResponse.json({ error: "Writing session not found" }, { status: 404 });
    }

    let markdown = body.markdown;

    if (!markdown) {
      const { data: draftArtifact, error: artifactError } = await supabase
        .from("writing_session_artifacts")
        .select("content")
        .eq("session_id", body.session_id)
        .eq("artifact_type", "draft")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (artifactError) {
        return NextResponse.json({ error: artifactError.message }, { status: 500 });
      }

      markdown = draftArtifact?.content;
    }

    if (!markdown) {
      return NextResponse.json({ error: "No draft content available" }, { status: 400 });
    }

    const { data: post, error: postError } = await supabase
      .from("user_posts")
      .insert({
        user_id: user.id,
        slug: body.slug.trim(),
        title: body.title.trim(),
        markdown,
        rendered_html: body.rendered_html ?? null,
        status: body.status ?? "draft",
        published_at: body.published_at ?? null,
      })
      .select("*")
      .single();

    if (postError) {
      return NextResponse.json({ error: postError.message }, { status: 500 });
    }

    if (body.sources && body.sources.length > 0) {
      const payload = body.sources.map((source) => ({
        post_id: post.id,
        scrap_id: source.scrap_id,
        usage: source.usage,
      }));

      const { error: sourcesError } = await supabase.from("post_sources").insert(payload);

      if (sourcesError) {
        return NextResponse.json({ error: sourcesError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
