import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

// GET: Check if current user has bookmarked this article
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ bookmarked: false, collections: [] });
    }

    // Get article id from slug
    const { data: article } = await supabase
      .from("admin_articles")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!article) {
      return NextResponse.json({ bookmarked: false, collections: [] });
    }

    // Find collection_items with this article_id belonging to user's collections
    const { data: items } = await supabase
      .from("collection_items")
      .select("id, collection_id, collections!inner(id, title, user_id)")
      .eq("article_id", article.id)
      .eq("collections.user_id", user.id);

    const bookmarked = (items?.length ?? 0) > 0;
    const collections = items?.map((item: Record<string, unknown>) => ({
      item_id: item.id,
      collection_id: item.collection_id,
      title: (item.collections as Record<string, unknown>)?.title,
    })) ?? [];

    return NextResponse.json({ bookmarked, collections });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: Bookmark article into a collection
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const collectionId = body.collection_id as string | undefined;

    // Get article
    const { data: article } = await supabase
      .from("admin_articles")
      .select("id")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // If no collection specified, use or create "북마크" default collection
    let targetCollectionId = collectionId;
    if (!targetCollectionId) {
      const { data: existing } = await supabase
        .from("collections")
        .select("id")
        .eq("user_id", user.id)
        .eq("title", "북마크")
        .maybeSingle();

      if (existing) {
        targetCollectionId = existing.id;
      } else {
        // Ensure profile exists
        await supabase.from("profiles").upsert(
          {
            id: user.id,
            display_name: user.user_metadata?.display_name ?? user.user_metadata?.name ?? null,
            handle: user.user_metadata?.handle ?? user.email?.split("@")[0] ?? `user_${user.id.slice(0, 8)}`,
          },
          { onConflict: "id", ignoreDuplicates: true }
        );

        const { data: newCol, error: colError } = await supabase
          .from("collections")
          .insert({ user_id: user.id, title: "북마크" })
          .select("id")
          .single();

        if (colError) {
          return NextResponse.json({ error: colError.message }, { status: 500 });
        }
        targetCollectionId = newCol.id;
      }
    }

    // Check ownership
    const { data: col } = await supabase
      .from("collections")
      .select("id")
      .eq("id", targetCollectionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!col) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    // Get next position
    const { data: maxItem } = await supabase
      .from("collection_items")
      .select("position")
      .eq("collection_id", targetCollectionId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const position = (maxItem?.position ?? -1) + 1;

    const { data, error: insertError } = await supabase
      .from("collection_items")
      .insert({
        collection_id: targetCollectionId,
        article_id: article.id,
        position,
      })
      .select("*")
      .single();

    if (insertError) {
      // Unique constraint = already bookmarked
      if (insertError.code === "23505") {
        return NextResponse.json({ error: "Already bookmarked" }, { status: 409 });
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ item: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE: Remove article bookmark
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const collectionId = body.collection_id as string | undefined;

    const { data: article } = await supabase
      .from("admin_articles")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    let query = supabase
      .from("collection_items")
      .delete()
      .eq("article_id", article.id);

    if (collectionId) {
      query = query.eq("collection_id", collectionId);
    }

    // Only delete from user's collections
    const { data: userCollections } = await supabase
      .from("collections")
      .select("id")
      .eq("user_id", user.id);

    const userColIds = userCollections?.map((c) => c.id) ?? [];
    if (userColIds.length === 0) {
      return NextResponse.json({ success: true });
    }

    await supabase
      .from("collection_items")
      .delete()
      .eq("article_id", article.id)
      .in("collection_id", collectionId ? [collectionId] : userColIds);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
