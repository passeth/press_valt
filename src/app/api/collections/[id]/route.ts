import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type UpdateCollectionBody = {
  title?: string;
  description?: string | null;
  status?: "active" | "archived";
};

async function getAuthedUserId() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, userId: null, error: error?.message ?? "Unauthorized" };
  }

  return { supabase, userId: user.id, error: null };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { supabase, userId, error: authError } = await getAuthedUserId();

    if (!userId) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }

    const { data: collection, error: collectionError } = await supabase
      .from("collections")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (collectionError) {
      return NextResponse.json({ error: collectionError.message }, { status: 500 });
    }

    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    const { data: items, error: itemsError } = await supabase
      .from("collection_items")
      .select("id, collection_id, scrap_id, article_id, position, note, highlight_color, created_at, updated_at")
      .eq("collection_id", id)
      .order("position", { ascending: true });

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    const scrapIds = (items ?? []).map((item) => item.scrap_id).filter((sid): sid is string => sid !== null);
    let scrapsById = new Map<string, unknown>();
    if (scrapIds.length > 0) {
      const { data: scraps, error: scrapsError } = await supabase
        .from("scraps")
        .select("*")
        .in("id", scrapIds);
      if (scrapsError) {
        return NextResponse.json({ error: scrapsError.message }, { status: 500 });
      }

      scrapsById = new Map((scraps ?? []).map((scrap) => [scrap.id, scrap]));

      // Enrich scraps with article metadata (revision -> article lookup)
      const revisionIds = Array.from(
        new Set((scraps ?? []).map((s) => s.source_revision_id))
      );

      if (revisionIds.length > 0) {
        const { data: revisions } = await supabase
          .from("admin_article_revisions")
          .select("id, article_id")
          .in("id", revisionIds);

        const articleIds = Array.from(
          new Set((revisions ?? []).map((r) => r.article_id))
        );

        if (articleIds.length > 0) {
          const { data: articles } = await supabase
            .from("admin_articles")
            .select("id, slug, title, thumbnail_url")
            .in("id", articleIds);

          const revisionToArticle = new Map<string, string>();
          (revisions ?? []).forEach((r) => revisionToArticle.set(r.id, r.article_id));

          const articleById = new Map<string, { id: string; slug: string; title: string; thumbnail_url: string | null }>();
          (articles ?? []).forEach((a) => articleById.set(a.id, a as { id: string; slug: string; title: string; thumbnail_url: string | null }));

          // Re-map scraps with article info attached
          const enriched = new Map<string, unknown>();
          scrapsById.forEach((scrap, scrapId) => {
            const s = scrap as { source_revision_id: string; [key: string]: unknown };
            const artId = revisionToArticle.get(s.source_revision_id);
            const art = artId ? articleById.get(artId) : null;
            enriched.set(scrapId, {
              ...s,
              article_title: art?.title ?? null,
              article_slug: art?.slug ?? null,
              article_thumbnail_url: art?.thumbnail_url ?? null,
            });
          });
          scrapsById = enriched;
        }
      }
    }
    const detailItems = (items ?? []).map((item) => ({
      ...item,
      scrap: item.scrap_id ? (scrapsById.get(item.scrap_id) ?? null) : null,
    }));

    const { data: notes, error: notesError } = await supabase
      .from("material_notes")
      .select("*")
      .eq("collection_id", id)
      .eq("user_id", userId)
      .order("position", { ascending: true });

    if (notesError) {
      return NextResponse.json({ error: notesError.message }, { status: 500 });
    }

    return NextResponse.json({
      collection,
      items: detailItems,
      notes: notes ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { supabase, userId, error: authError } = await getAuthedUserId();

    if (!userId) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }

    const body = (await request.json()) as UpdateCollectionBody;
    const updates: UpdateCollectionBody = {};

    if (typeof body.title === "string") {
      updates.title = body.title.trim();
    }

    if (body.description !== undefined) {
      updates.description = body.description;
    }

    if (body.status) {
      updates.status = body.status;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("collections")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    return NextResponse.json({ collection: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { supabase, userId, error: authError } = await getAuthedUserId();

    if (!userId) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("collections")
      .update({ status: "archived" })
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    return NextResponse.json({ collection: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
