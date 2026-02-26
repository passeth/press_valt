import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { marked } from "marked";

// ── Obsidian image preprocessing ──

/**
 * Convert Obsidian wikilink image syntax to standard markdown images.
 *
 * Handles all variants:
 *   ![[119.jpg]]
 *   ![[content/_assets/images/117.jpg]]
 *   ![[assets/images/2.webp]]
 *   ![[@ONGOING_NEW/ai-diven_cos/content/_assets/images/1.webp]]
 *   ![[image.png|alt text]]
 *
 * All resolve to /images/content/{filename}
 */
function preprocessObsidianImages(markdown: string): string {
  return markdown.replace(
    /!\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g,
    (_match, rawPath: string, altText?: string) => {
      const filename = rawPath.trim().split("/").pop() || rawPath.trim();
      const alt = altText?.trim() || filename;
      return `![${alt}](/images/content/${filename})`;
    }
  );
}

/**
 * Normalize frontmatter featured_image paths to /images/content/{filename}.
 * Handles: /assets/images/xxx, assets/images/xxx, content/_assets/images/xxx, etc.
 */
function normalizeFeaturedImage(imagePath: string | null | undefined): string | null {
  if (!imagePath) return null;
  // Already a full URL (https://) — leave as-is
  if (imagePath.startsWith("http")) return imagePath;
  // Extract filename from any path structure
  const filename = imagePath.split("/").pop();
  if (!filename) return null;
  return `/images/content/${filename}`;
}

export interface ArticleMeta {
  slug: string;
  title: string;
  summary: string | null;
  category: string | null;
  tags: string[];
  thumbnail_url: string | null;
  created_at: string;
  status: string;
}

export interface ArticleDetail extends ArticleMeta {
  rendered_html: string;
  markdown: string;
  blocks: ArticleBlock[];
}

export interface ArticleBlock {
  id: string;
  block_id: string;
  block_type: string;
  plain_text: string | null;
  markdown_text: string | null;
  order_index: number;
}

const CONTENT_DIR = path.join(process.cwd(), "content");

/**
 * Read all published articles from the filesystem.
 * Fallback for when Supabase is not configured.
 */
export async function getAllArticles(): Promise<ArticleMeta[]> {
  const articles: ArticleMeta[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!entry.name.startsWith("_")) {
          await walk(fullPath);
        }
        continue;
      }

      if (entry.isFile() && entry.name.endsWith(".md")) {
        try {
          const content = await fs.readFile(fullPath, "utf-8");
          const { data } = matter(content);

          if (data.status !== "published") continue;

          articles.push({
            slug: data.slug || entry.name.replace(/\.md$/, ""),
            title: data.title || "Untitled",
            summary: data.excerpt || null,
            category: data.category || null,
            tags: data.tags || [],
            thumbnail_url: normalizeFeaturedImage(data.featured_image),
            created_at: data.date
              ? new Date(data.date).toISOString()
              : new Date().toISOString(),
            status: data.status || "draft",
          });
        } catch {
          // Skip files that fail to parse
        }
      }
    }
  }

  await walk(CONTENT_DIR);

  // Sort by date descending
  articles.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return articles;
}

/**
 * Get a single article by slug, with rendered HTML and blocks.
 */
export async function getArticleBySlug(
  slug: string
): Promise<ArticleDetail | null> {
  const articles = await findMarkdownFiles(CONTENT_DIR);

  for (const filePath of articles) {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const { data, content: markdown } = matter(content);

      const fileSlug = data.slug || path.basename(filePath, ".md");
      if (fileSlug !== slug) continue;
      if (data.status !== "published") continue;

      const processedMarkdown = preprocessObsidianImages(markdown);
      const renderedHtml = await marked.parse(processedMarkdown);
      const blocks = await parseBlocks(processedMarkdown);

      return {
        slug: fileSlug,
        title: data.title || "Untitled",
        summary: data.excerpt || null,
        category: data.category || null,
        tags: data.tags || [],
        thumbnail_url: normalizeFeaturedImage(data.featured_image),
        created_at: data.date
          ? new Date(data.date).toISOString()
          : new Date().toISOString(),
        status: data.status,
        rendered_html: renderedHtml,
        markdown,
        blocks,
      };
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Get all unique categories from published articles.
 */
export async function getCategories(): Promise<string[]> {
  const articles = await getAllArticles();
  const cats = new Set(
    articles.map((a) => a.category).filter(Boolean) as string[]
  );
  return [...cats].sort();
}

// ── Internal helpers ──

async function findMarkdownFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(d: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(d, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(d, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith("_")) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(fullPath);
      }
    }
  }

  await walk(dir);
  return files;
}

async function parseBlocks(markdown: string): Promise<ArticleBlock[]> {
  const tokens = marked.lexer(markdown);
  const blocks: ArticleBlock[] = [];
  let idx = 0;

  for (const token of tokens) {
    let blockType = "";
    let plainText = "";

    switch (token.type) {
      case "heading":
        blockType = "heading";
        plainText = token.text;
        break;
      case "paragraph":
        blockType = "paragraph";
        plainText = token.text
          .replace(/\*\*(.*?)\*\*/g, "$1")
          .replace(/\*(.*?)\*/g, "$1")
          .replace(/\[(.*?)\]\(.*?\)/g, "$1");
        break;
      case "list":
        blockType = "list";
        plainText = token.raw;
        break;
      case "blockquote":
        blockType = "blockquote";
        plainText = token.text;
        break;
      case "code":
        blockType = "code";
        plainText = token.text;
        break;
      default:
        continue;
    }

    if (blockType) {
      blocks.push({
        id: `block-${idx}`,
        block_id: `${blockType}-${idx}`,
        block_type: blockType,
        plain_text: plainText,
        markdown_text: token.raw,
        order_index: idx,
      });
      idx++;
    }
  }

  return blocks;
}
