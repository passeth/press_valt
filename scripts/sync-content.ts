import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import matter from 'gray-matter';
import { marked } from 'marked';
import { createClient } from '@supabase/supabase-js';

interface Frontmatter {
  title: string;
  slug: string;
  journalist: string;
  persona_role: string;
  category: string;
  tags: string[];
  date: string;
  updated: string;
  featured_image: string;
  excerpt: string;
  status: string;
  featured: boolean;
  homepage_priority: number;
  reading_time: string;
}

interface ContentBlock {
  block_id: string;
  type: string;
  plain_text: string;
  html: string;
}

interface SyncResult {
  created: number;
  updated: number;
  archived: number;
  skipped: number;
}

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️  Skipping content sync: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars not set');
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Compute SHA256 hash of content
 */
function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Extract plain text from markdown by removing markdown syntax
 */
function extractPlainText(markdown: string): string {
  return markdown
    .replace(/^#+\s+/gm, '') // Remove headings
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1') // Remove italic
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links
    .replace(/`(.*?)`/g, '$1') // Remove inline code
    .replace(/^[-*+]\s+/gm, '') // Remove list markers
    .replace(/^>\s+/gm, '') // Remove blockquotes
    .trim();
}

/**
 * Parse markdown into blocks
 */
async function parseMarkdownBlocks(markdown: string): Promise<ContentBlock[]> {
  const blocks: ContentBlock[] = [];
  const tokens = marked.lexer(markdown);

  let blockIndex = 0;

  for (const token of tokens) {
    let blockType = '';
    let plainText = '';
    let html = '';

    switch (token.type) {
      case 'heading':
        blockType = 'heading';
        plainText = token.text;
        html = await marked.parse(`${'#'.repeat(token.depth)} ${token.text}`);
        break;

      case 'paragraph':
        blockType = 'paragraph';
        plainText = extractPlainText(token.text);
        html = await marked.parse(token.text);
        break;

      case 'list':
        blockType = 'list';
        plainText = token.raw
          .split('\n')
          .map((line: string) => extractPlainText(line))
          .join(' ');
        html = await marked.parse(token.raw);
        break;

      case 'blockquote':
        blockType = 'blockquote';
        plainText = extractPlainText(token.text);
        html = await marked.parse(token.raw);
        break;

      case 'code':
        blockType = 'code';
        plainText = token.text;
        html = await marked.parse(token.raw);
        break;

      case 'image':
        blockType = 'image';
        plainText = token.text || (token as unknown as { url?: string }).url || '';
        html = await marked.parse(token.raw);
        break;

      default:
        continue;
    }

    if (blockType) {
      blocks.push({
        block_id: `${blockType}-${blockIndex}`,
        type: blockType,
        plain_text: plainText,
        html: html.trim(),
      });
      blockIndex++;
    }
  }

  return blocks;
}

/**
 * Read and parse markdown files from content directory
 */
async function readMarkdownFiles(
  contentDir: string
): Promise<Array<{ filepath: string; frontmatter: Frontmatter; markdown: string }>> {
  const files: Array<{ filepath: string; frontmatter: Frontmatter; markdown: string }> = [];

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip directories starting with underscore
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('_')) {
          await walk(fullPath);
        }
        continue;
      }

      // Process .md files
      if (entry.isFile() && entry.name.endsWith('.md')) {
        const content = await fs.readFile(fullPath, 'utf-8');
        const { data, content: markdown } = matter(content);

        files.push({
          filepath: fullPath,
          frontmatter: data as Frontmatter,
          markdown,
        });
      }
    }
  }

  await walk(contentDir);
  return files;
}

/**
 * Main sync function
 */
async function syncContent(): Promise<void> {
  const contentDir = path.join(process.cwd(), 'content');
  const result: SyncResult = { created: 0, updated: 0, archived: 0, skipped: 0 };

  console.log('📚 Starting content sync...');

  try {
    // Read all markdown files
    const markdownFiles = await readMarkdownFiles(contentDir);
    console.log(`Found ${markdownFiles.length} markdown files`);

    // Fetch existing articles from database
    const { data: existingArticles, error: fetchError } = await supabase
      .from('articles')
      .select('slug, content_hash');

    if (fetchError) {
      throw new Error(`Failed to fetch existing articles: ${fetchError.message}`);
    }

    const existingSlugs = new Set(existingArticles?.map((a) => a.slug) || []);
    const existingHashMap = new Map(
      existingArticles?.map((a) => [a.slug, a.content_hash]) || []
    );

    // Process each markdown file
    for (const file of markdownFiles) {
      const { frontmatter, markdown } = file;

      // Skip unpublished articles
      if (frontmatter.status !== 'published') {
        result.skipped++;
        console.log(`⏭️  Skipped (not published): ${frontmatter.slug}`);
        continue;
      }

      const contentHash = computeHash(markdown);
      const htmlContent = await marked.parse(markdown);
      const blocks = await parseMarkdownBlocks(markdown);

      const isNew = !existingSlugs.has(frontmatter.slug);
      const hasChanged = isNew || existingHashMap.get(frontmatter.slug) !== contentHash;

      if (!hasChanged) {
        result.skipped++;
        console.log(`⏭️  Skipped (unchanged): ${frontmatter.slug}`);
        continue;
      }

      try {
        // Upsert article
        const { data: article, error: articleError } = await supabase
          .from('articles')
          .upsert(
            {
              slug: frontmatter.slug,
              title: frontmatter.title,
              excerpt: frontmatter.excerpt,
              category: frontmatter.category,
              featured: frontmatter.featured,
              featured_image: frontmatter.featured_image,
              homepage_priority: frontmatter.homepage_priority,
              content_hash: contentHash,
              updated_at: new Date(frontmatter.updated).toISOString(),
            },
            { onConflict: 'slug' }
          )
          .select()
          .single();

        if (articleError) {
          throw new Error(`Failed to upsert article: ${articleError.message}`);
        }

        // Insert revision
        const { error: revisionError } = await supabase
          .from('article_revisions')
          .insert({
            article_id: article.id,
            journalist: frontmatter.journalist,
            persona_role: frontmatter.persona_role,
            content_hash: contentHash,
            html_content: htmlContent,
            reading_time: frontmatter.reading_time,
            tags: frontmatter.tags,
            created_at: new Date().toISOString(),
          });

        if (revisionError) {
          throw new Error(`Failed to insert revision: ${revisionError.message}`);
        }

        // Insert content blocks
        const blockInserts = blocks.map((block) => ({
          article_id: article.id,
          block_id: block.block_id,
          type: block.type,
          plain_text: block.plain_text,
          html: block.html,
        }));

        if (blockInserts.length > 0) {
          const { error: blocksError } = await supabase
            .from('content_blocks')
            .insert(blockInserts);

          if (blocksError) {
            throw new Error(`Failed to insert blocks: ${blocksError.message}`);
          }
        }

        if (isNew) {
          result.created++;
          console.log(`✅ Created: ${frontmatter.slug}`);
        } else {
          result.updated++;
          console.log(`🔄 Updated: ${frontmatter.slug}`);
        }
      } catch (error) {
        console.error(`❌ Error processing ${frontmatter.slug}:`, error);
        throw error;
      }
    }

    // Archive articles that no longer exist in file system
    const fileSlugs = new Set(markdownFiles.map((f) => f.frontmatter.slug));
    for (const slug of existingSlugs) {
      if (!fileSlugs.has(slug)) {
        const { error: archiveError } = await supabase
          .from('articles')
          .update({ archived_at: new Date().toISOString() })
          .eq('slug', slug);

        if (archiveError) {
          console.error(`Failed to archive ${slug}:`, archiveError);
        } else {
          result.archived++;
          console.log(`📦 Archived: ${slug}`);
        }
      }
    }

    // Log summary
    console.log('\n📊 Sync Summary:');
    console.log(`  ✅ Created:  ${result.created}`);
    console.log(`  🔄 Updated:  ${result.updated}`);
    console.log(`  📦 Archived: ${result.archived}`);
    console.log(`  ⏭️  Skipped:  ${result.skipped}`);
    console.log('✨ Content sync complete!\n');
  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  }
}

// Run sync
syncContent();
