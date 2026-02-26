import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type AddCollectionItemBody = {
  scrap_id: string;
  position?: number;
};

type RemoveCollectionItemBody = {
  item_id?: string;
  scrap_id?: string;
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
      .select("id, collection_id, scrap_id, position, created_at")
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

    if (!body.scrap_id) {
      return NextResponse.json({ error: "scrap_id is required" }, { status: 400 });
    }

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
        scrap_id: body.scrap_id,
        position,
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

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { supabase, error } = await getAuthorizedCollectionId(id);

    if (error) {
      const status = error === "Unauthorized" ? 401 : error === "Collection not found" ? 404 : 500;
      return NextResponse.json({ error }, { status });
    }

    const body = (await request.json()) as RemoveCollectionItemBody;

    if (!body.item_id && !body.scrap_id) {
      return NextResponse.json({ error: "Provide item_id or scrap_id" }, { status: 400 });
    }

    let deleteQuery = supabase.from("collection_items").delete().eq("collection_id", id);

    if (body.item_id) {
      deleteQuery = deleteQuery.eq("id", body.item_id);
    }

    if (body.scrap_id) {
      deleteQuery = deleteQuery.eq("scrap_id", body.scrap_id);
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
