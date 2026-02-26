import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type UpdatePostBody = {
  slug?: string;
  title?: string;
  markdown?: string;
  rendered_html?: string | null;
  status?: "draft" | "published" | "unlisted";
  published_at?: string | null;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: post, error } = await supabase
      .from("user_posts")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const canRead = post.status === "published" || (user && post.user_id === user.id);

    if (!canRead) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: sources, error: sourcesError } = await supabase
      .from("post_sources")
      .select("*")
      .eq("post_id", post.id);

    if (sourcesError) {
      return NextResponse.json({ error: sourcesError.message }, { status: 500 });
    }

    return NextResponse.json({ post, sources: sources ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
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

    const body = (await request.json()) as UpdatePostBody;
    const updates: UpdatePostBody = {};

    if (body.slug !== undefined) {
      updates.slug = body.slug.trim();
    }

    if (body.title !== undefined) {
      updates.title = body.title.trim();
    }

    if (body.markdown !== undefined) {
      updates.markdown = body.markdown;
    }

    if (body.rendered_html !== undefined) {
      updates.rendered_html = body.rendered_html;
    }

    if (body.status !== undefined) {
      updates.status = body.status;
    }

    if (body.published_at !== undefined) {
      updates.published_at = body.published_at;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("user_posts")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json({ post: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
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

    const { error } = await supabase
      .from("user_posts")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
