import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
    const limit = Number.parseInt(searchParams.get("limit") ?? "12", 10);
    const category = searchParams.get("category");

    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 12;

    let query = supabase
      .from("admin_articles")
      .select("slug, title, summary, category, tags, thumbnail_url, created_at", {
        count: "exact",
      })
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .range((safePage - 1) * safeLimit, safePage * safeLimit - 1);

    if (category) {
      query = query.eq("category", category);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      articles: data,
      total: count ?? 0,
      page: safePage,
      limit: safeLimit,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
