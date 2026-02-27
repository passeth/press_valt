import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import matter from 'gray-matter';
import { marked } from 'marked';
import { createClient } from '@supabase/supabase-js';

interface Frontmatter {
  title: string;
  slug: string;
  category?: string;
  tags?: string[];
  date?: string;
  excerpt?: string;
  summary?: string;
  status?: string;
  featured_image?: string;
  thumbnail_url?: string;
  [key: string]: unknown;
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

function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function normalizeFeaturedImage(imagePath: string | null | undefined): string | null {
  if (!imagePath) return null;
  if (imagePath.startsWith('http')) return imagePath;
  const filename = imagePath.split('/').pop();
  if (!filename) return null;
  return `/images/content/${filename}`;
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
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('_')) await walk(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.md')) {
        const content = await fs.readFile(fullPath, 'utf-8');
        const { data, content: markdown } = matter(content);
        files.push({ filepath: fullPath, frontmatter: data as Frontmatter, markdown });
      }
    }
  }

  await walk(contentDir);
  return files;
}

/**
 * Main sync function
 * 
 * DB schema:
 *   admin_articles: id, slug, title, summary, category, tags, thumbnail_url, status, published_revision_id, created_by, created_at, updated_at
 *   admin_article_revisions: id, article_id, markdown, content_hash, rendered_html, created_at
 *   admin_article_blocks: id, revision_id, block_id, block_type, plain_text, markdown_text, order_index
 */
async function syncContent(): Promise<void> {
  const contentDir = path.join(process.cwd(), 'content');
  const result: SyncResult = { created: 0, updated: 0, archived: 0, skipped: 0 };

  console.log('📚 Starting content sync...');

  try {
    const markdownFiles = await readMarkdownFiles(contentDir);
    console.log(`Found ${markdownFiles.length} markdown files`);

    // Fetch existing articles
    const { data: existingArticles, error: fetchError } = await supabase
      .from('admin_articles')
      .select('id, slug');

    if (fetchError) {
      throw new Error(`Failed to fetch existing articles: ${fetchError.message}`);
    }

    const existingMap = new Map(
      existingArticles?.map((a) => [a.slug, a.id]) || []
    );

    // Check existing revision hashes
    const { data: existingRevisions } = await supabase
      .from('admin_article_revisions')
      .select('article_id, content_hash');

    const revisionHashMap = new Map(
      existingRevisions?.map((r) => [r.article_id, r.content_hash]) || []
    );

    for (const file of markdownFiles) {
      const { frontmatter, markdown } = file;

      if (!frontmatter.slug || !frontmatter.title) {
        result.skipped++;
        console.log(`⏭️  Skipped (no slug/title): ${file.filepath}`);
        continue;
      }

      if (frontmatter.status && frontmatter.status !== 'published') {
        result.skipped++;
        console.log(`⏭️  Skipped (not published): ${frontmatter.slug}`);
        continue;
      }

      const contentHash = computeHash(markdown);
      const existingId = existingMap.get(frontmatter.slug);
      const existingHash = existingId ? revisionHashMap.get(existingId) : null;

      if (existingId && existingHash === contentHash) {
        result.skipped++;
        console.log(`⏭️  Skipped (unchanged): ${frontmatter.slug}`);
        continue;
      }

      const summary = frontmatter.summary || frontmatter.excerpt || null;
      const thumbnailUrl = normalizeFeaturedImage(frontmatter.featured_image) || frontmatter.thumbnail_url || null;

      try {
        // Upsert article
        const { data: article, error: articleError } = await supabase
          .from('admin_articles')
          .upsert(
            {
              slug: frontmatter.slug,
              title: frontmatter.title,
              summary,
              category: frontmatter.category || null,
              tags: frontmatter.tags || [],
              thumbnail_url: thumbnailUrl,
              status: 'published',
              created_by: '60904942-0628-4169-ac56-b69647d4b501',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'slug' }
          )
          .select('id')
          .single();

        if (articleError) {
          throw new Error(`Failed to upsert article: ${articleError.message}`);
        }

        // Render HTML
        const renderedHtml = await marked.parse(markdown);

        // Insert revision
        const { data: revision, error: revisionError } = await supabase
          .from('admin_article_revisions')
          .insert({
            article_id: article.id,
            markdown,
            content_hash: contentHash,
            rendered_html: renderedHtml,
          })
          .select('id')
          .single();

        if (revisionError) {
          throw new Error(`Failed to insert revision: ${revisionError.message}`);
        }

        // Update published_revision_id
        await supabase
          .from('admin_articles')
          .update({ published_revision_id: revision.id })
          .eq('id', article.id);

        // Parse and insert blocks
        const tokens = marked.lexer(markdown);
        let blockIndex = 0;
        const blockInserts: Array<{
          revision_id: string;
          block_id: string;
          block_type: string;
          plain_text: string;
          markdown_text: string;
          order_index: number;
        }> = [];

        for (const token of tokens) {
          let blockType = '';
          let plainText = '';

          switch (token.type) {
            case 'heading':
              blockType = 'heading';
              plainText = token.text;
              break;
            case 'paragraph':
              blockType = 'paragraph';
              plainText = token.text;
              break;
            case 'list':
              blockType = 'list';
              plainText = token.raw;
              break;
            case 'blockquote':
              blockType = 'blockquote';
              plainText = token.text;
              break;
            case 'code':
              blockType = 'code';
              plainText = token.text;
              break;
            default:
              continue;
          }

          if (blockType) {
            blockInserts.push({
              revision_id: revision.id,
              block_id: `${blockType}-${blockIndex}`,
              block_type: blockType,
              plain_text: plainText,
              markdown_text: token.raw,
              order_index: blockIndex,
            });
            blockIndex++;
          }
        }

        if (blockInserts.length > 0) {
          const { error: blocksError } = await supabase
            .from('admin_article_blocks')
            .insert(blockInserts);

          if (blocksError) {
            throw new Error(`Failed to insert blocks: ${blocksError.message}`);
          }
        }

        if (existingId) {
          result.updated++;
          console.log(`🔄 Updated: ${frontmatter.slug}`);
        } else {
          result.created++;
          console.log(`✅ Created: ${frontmatter.slug}`);
        }
      } catch (error) {
        console.error(`❌ Error processing ${frontmatter.slug}:`, error);
        throw error;
      }
    }

    // Archive articles that no longer exist in file system
    const fileSlugs = new Set(markdownFiles.map((f) => f.frontmatter.slug));
    for (const [slug] of existingMap) {
      if (!fileSlugs.has(slug)) {
        const { error: archiveError } = await supabase
          .from('admin_articles')
          .update({ status: 'archived' })
          .eq('slug', slug);

        if (archiveError) {
          console.error(`Failed to archive ${slug}:`, archiveError);
        } else {
          result.archived++;
          console.log(`📦 Archived: ${slug}`);
        }
      }
    }

    console.log('\n📊 Sync complete:');
    console.log(`  ✅ Created: ${result.created}`);
    console.log(`  🔄 Updated: ${result.updated}`);
    console.log(`  📦 Archived: ${result.archived}`);
    console.log(`  ⏭️  Skipped: ${result.skipped}`);
  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  }
}

syncContent();
