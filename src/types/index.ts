/**
 * Central type exports for Press Vault
 * Re-exports all database and domain types
 */

// Database types
export type {
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
  TextQuoteSelector,
  WritingDirection,
} from "./database";

// Convenience type aliases for common tables
import type { Database } from "./database";

// Profiles
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

// Admin Articles
export type AdminArticle = Database["public"]["Tables"]["admin_articles"]["Row"];
export type AdminArticleInsert = Database["public"]["Tables"]["admin_articles"]["Insert"];
export type AdminArticleUpdate = Database["public"]["Tables"]["admin_articles"]["Update"];

// Admin Article Revisions
export type AdminArticleRevision = Database["public"]["Tables"]["admin_article_revisions"]["Row"];
export type AdminArticleRevisionInsert = Database["public"]["Tables"]["admin_article_revisions"]["Insert"];
export type AdminArticleRevisionUpdate = Database["public"]["Tables"]["admin_article_revisions"]["Update"];

// Admin Article Blocks
export type AdminArticleBlock = Database["public"]["Tables"]["admin_article_blocks"]["Row"];
export type AdminArticleBlockInsert = Database["public"]["Tables"]["admin_article_blocks"]["Insert"];
export type AdminArticleBlockUpdate = Database["public"]["Tables"]["admin_article_blocks"]["Update"];

// Scraps
export type Scrap = Database["public"]["Tables"]["scraps"]["Row"];
export type ScrapInsert = Database["public"]["Tables"]["scraps"]["Insert"];
export type ScrapUpdate = Database["public"]["Tables"]["scraps"]["Update"];

// Collections
export type Collection = Database["public"]["Tables"]["collections"]["Row"];
export type CollectionInsert = Database["public"]["Tables"]["collections"]["Insert"];
export type CollectionUpdate = Database["public"]["Tables"]["collections"]["Update"];

// Collection Items
export type CollectionItem = Database["public"]["Tables"]["collection_items"]["Row"];
export type CollectionItemInsert = Database["public"]["Tables"]["collection_items"]["Insert"];
export type CollectionItemUpdate = Database["public"]["Tables"]["collection_items"]["Update"];

// Material Notes
export type MaterialNote = Database["public"]["Tables"]["material_notes"]["Row"];
export type MaterialNoteInsert = Database["public"]["Tables"]["material_notes"]["Insert"];
export type MaterialNoteUpdate = Database["public"]["Tables"]["material_notes"]["Update"];

// Writing Sessions
export type WritingSession = Database["public"]["Tables"]["writing_sessions"]["Row"];
export type WritingSessionInsert = Database["public"]["Tables"]["writing_sessions"]["Insert"];
export type WritingSessionUpdate = Database["public"]["Tables"]["writing_sessions"]["Update"];

// Writing Session Artifacts
export type WritingSessionArtifact = Database["public"]["Tables"]["writing_session_artifacts"]["Row"];
export type WritingSessionArtifactInsert = Database["public"]["Tables"]["writing_session_artifacts"]["Insert"];
export type WritingSessionArtifactUpdate = Database["public"]["Tables"]["writing_session_artifacts"]["Update"];

// User Posts
export type UserPost = Database["public"]["Tables"]["user_posts"]["Row"];
export type UserPostInsert = Database["public"]["Tables"]["user_posts"]["Insert"];
export type UserPostUpdate = Database["public"]["Tables"]["user_posts"]["Update"];

// Post Sources
export type PostSource = Database["public"]["Tables"]["post_sources"]["Row"];
export type PostSourceInsert = Database["public"]["Tables"]["post_sources"]["Insert"];
export type PostSourceUpdate = Database["public"]["Tables"]["post_sources"]["Update"];
