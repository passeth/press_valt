import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const VALID_HIGHLIGHT_COLORS = ["yellow", "green", "blue", "pink", "purple"] as const;
type HighlightColor = (typeof VALID_HIGHLIGHT_COLORS)[number];

type AddCollectionItemBody = {
  scrap_id?: string;
  article_id?: string;
  position?: number;
  note?: string | null;
  highlight_color?: HighlightColor | null;
};

type UpdateCollectionItemBody = {
  item_id: string;
  note?: string | null;
  highlight_color?: HighlightColor | null;
  position?: number;
};

type RemoveCollectionItemBody = {
  item_id?: string;
  scrap_id?: string;
  article_id?: string;
};

async function getAuthorizedCollectionId(
  collectionId: string
): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; userId: string | null; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, userId: null, error: error?.message ?? "Unauthorized" };
  }

  const { data: collection, error: collectionError } = await supabase
    .from("collections")
    .select("id")
    .eq("id", collectionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (collectionError) {
    return { supabase, userId: null, error: collectionError.message };
  }

  if (!collection) {
    return { supabase, userId: null, error: "Collection not found" };
  }

  return { supabase, userId: user.id, error: null };
}

function isValidHighlightColor(value: unknown): value is HighlightColor {
  return typeof value === "string" && VALID_HIGHLIGHT_COLORS.includes(value as HighlightColor);
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { supabase, error } = await getAuthorizedCollectionId(id);

    if (error) {
      const status = error === "Unauthorized" ? 401 : error === "Collection not found" ? 404 : 500;
      return NextResponse.json({ error }, { status });
    }

    const { data, error: itemsError } = await supabase
      .from("collection_items")
      .select("id, collection_id, scrap_id, article_id, position, note, highlight_color, created_at, updated_at")
      .eq("collection_id", id)
      .order("position", { ascending: true });

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    return NextResponse.json({ items: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { supabase, userId, error } = await getAuthorizedCollectionId(id);

    if (error || !userId) {
      const status = error === "Unauthorized" ? 401 : error === "Collection not found" ? 404 : 500;
      return NextResponse.json({ error }, { status });
    }

    const body = (await request.json()) as AddCollectionItemBody;

    if (!body.scrap_id && !body.article_id) {
      return NextResponse.json({ error: "scrap_id or article_id is required" }, { status: 400 });
    }

    if (body.highlight_color !== undefined && body.highlight_color !== null && !isValidHighlightColor(body.highlight_color)) {
      return NextResponse.json({ error: "Invalid highlight_color. Must be one of: yellow, green, blue, pink, purple" }, { status: 400 });
    }

    if (body.scrap_id) {
      const { data: scrap, error: scrapError } = await supabase
        .from("scraps")
        .select("id")
        .eq("id", body.scrap_id)
        .eq("user_id", userId)
        .maybeSingle();

      if (scrapError) {
        return NextResponse.json({ error: scrapError.message }, { status: 500 });
      }
      if (!scrap) {
        return NextResponse.json({ error: "Scrap not found" }, { status: 404 });
      }
    }

    if (body.article_id) {
      const { data: article, error: articleError } = await supabase
        .from("admin_articles")
        .select("id")
        .eq("id", body.article_id)
        .eq("status", "published")
        .maybeSingle();

      if (articleError) {
        return NextResponse.json({ error: articleError.message }, { status: 500 });
      }
      if (!article) {
        return NextResponse.json({ error: "Article not found" }, { status: 404 });
      }
    }

    let position = body.position;
    if (typeof position !== "number") {
      const { data: maxItem } = await supabase
        .from("collection_items")
        .select("position")
        .eq("collection_id", id)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      position = (maxItem?.position ?? -1) + 1;
    }

    const { data, error: insertError } = await supabase
      .from("collection_items")
      .insert({
        collection_id: id,
        scrap_id: body.scrap_id ?? null,
        article_id: body.article_id ?? null,
        position,
        note: body.note ?? null,
        highlight_color: body.highlight_color ?? null,
      })
      .select("*")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ item: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { supabase, error } = await getAuthorizedCollectionId(id);

    if (error) {
      const status = error === "Unauthorized" ? 401 : error === "Collection not found" ? 404 : 500;
      return NextResponse.json({ error }, { status });
    }

    const body = (await request.json()) as UpdateCollectionItemBody;

    if (!body.item_id) {
      return NextResponse.json({ error: "item_id is required" }, { status: 400 });
    }

    if (body.highlight_color !== undefined && body.highlight_color !== null && !isValidHighlightColor(body.highlight_color)) {
      return NextResponse.json({ error: "Invalid highlight_color. Must be one of: yellow, green, blue, pink, purple" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};

    if (body.note !== undefined) {
      updates.note = body.note;
    }

    if (body.highlight_color !== undefined) {
      updates.highlight_color = body.highlight_color;
    }

    if (typeof body.position === "number") {
      updates.position = body.position;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error: updateError } = await supabase
      .from("collection_items")
      .update(updates)
      .eq("id", body.item_id)
      .eq("collection_id", id)
      .select("*")
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { supabase, error } = await getAuthorizedCollectionId(id);

    if (error) {
      const status = error === "Unauthorized" ? 401 : error === "Collection not found" ? 404 : 500;
      return NextResponse.json({ error }, { status });
    }

    const body = (await request.json()) as RemoveCollectionItemBody;

    if (!body.item_id && !body.scrap_id && !body.article_id) {
      return NextResponse.json({ error: "Provide item_id, scrap_id, or article_id" }, { status: 400 });
    }

    let deleteQuery = supabase.from("collection_items").delete().eq("collection_id", id);

    if (body.item_id) {
      deleteQuery = deleteQuery.eq("id", body.item_id);
    }

    if (body.scrap_id) {
      deleteQuery = deleteQuery.eq("scrap_id", body.scrap_id);
    }

    if (body.article_id) {
      deleteQuery = deleteQuery.eq("article_id", body.article_id);
    }

    const { error: deleteError } = await deleteQuery;

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
