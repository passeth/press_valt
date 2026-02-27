import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types";
import { NextRequest, NextResponse } from "next/server";

type ScrapInsert = Database["public"]["Tables"]["scraps"]["Insert"];

type CreateScrapBody = {
  source_revision_id: string;
  source_block_id: string;
  start_offset: number;
  end_offset: number;
  exact_quote: string;
  prefix?: string | null;
  suffix?: string | null;
  user_note?: string | null;
  selector: Database["public"]["Tables"]["scraps"]["Row"]["selector"];
  collection_id?: string;
  position?: number;
};

export async function GET(request: NextRequest) {
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

    const articleId = new URL(request.url).searchParams.get("article_id");

    let query = supabase
      .from("scraps")
      .select("id, source_revision_id, source_block_id, start_offset, end_offset, exact_quote, prefix, suffix, user_note, selector, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (articleId) {
      const { data: revisions, error: revisionsError } = await supabase
        .from("admin_article_revisions")
        .select("id")
        .eq("article_id", articleId);

      if (revisionsError) {
        return NextResponse.json({ error: revisionsError.message }, { status: 500 });
      }

      const revisionIds = revisions?.map((revision) => revision.id) ?? [];

      if (revisionIds.length === 0) {
        return NextResponse.json({ scraps: [] });
      }

      query = query.in("source_revision_id", revisionIds);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ scraps: data ?? [] });
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

    const body = (await request.json()) as CreateScrapBody;

    if (
      !body.source_revision_id ||
      !body.source_block_id ||
      typeof body.start_offset !== "number" ||
      typeof body.end_offset !== "number" ||
      !body.exact_quote ||
      !body.selector
    ) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const payload: ScrapInsert = {
      user_id: user.id,
      source_revision_id: body.source_revision_id,
      source_block_id: body.source_block_id,
      start_offset: body.start_offset,
      end_offset: body.end_offset,
      exact_quote: body.exact_quote,
      prefix: body.prefix ?? null,
      suffix: body.suffix ?? null,
      user_note: body.user_note ?? null,
      selector: body.selector,
    };

    console.log("[SCRAPS API] Inserting with source_block_id:", body.source_block_id, "type:", typeof body.source_block_id);

    const { data: scrap, error: scrapError } = await supabase
      .from("scraps")
      .insert(payload)
      .select("*")
      .single();

    if (scrapError) {
      return NextResponse.json({ error: scrapError.message }, { status: 500 });
    }

    if (body.collection_id) {
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

      let position = body.position;
      if (typeof position !== "number") {
        const { data: maxItem } = await supabase
          .from("collection_items")
          .select("position")
          .eq("collection_id", body.collection_id)
          .order("position", { ascending: false })
          .limit(1)
          .maybeSingle();

        position = (maxItem?.position ?? -1) + 1;
      }

      const { error: itemError } = await supabase.from("collection_items").insert({
        collection_id: body.collection_id,
        scrap_id: scrap.id,
        position,
      });

      if (itemError) {
        return NextResponse.json({ error: itemError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ scrap }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
