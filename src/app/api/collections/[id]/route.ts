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
      .select("id, collection_id, scrap_id, position, created_at")
      .eq("collection_id", id)
      .order("position", { ascending: true });

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    const scrapIds = items?.map((item) => item.scrap_id) ?? [];
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
    }

    const detailItems = (items ?? []).map((item) => ({
      ...item,
      scrap: scrapsById.get(item.scrap_id) ?? null,
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
