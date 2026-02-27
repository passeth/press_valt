/**
 * Supabase auto-generated types for Press Vault database schema
 * Generated from Supabase schema definition
 */

// JSONB field types
export interface TextQuoteSelector {
  type: "TextQuoteSelector";
  exact: string;
  prefix?: string;
  suffix?: string;
}

export interface WritingDirection {
  topic?: string;
  angle?: string;
  audience?: string;
  tone?: string;
  [key: string]: string | undefined;
}

// Database types
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          handle: string;
          display_name: string | null;
          bio: string | null;
          avatar_url: string | null;
          press_is_public: boolean;
          role: "user" | "admin";
          ai_provider: "openai" | "anthropic" | null;
          ai_api_key_encrypted: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          handle: string;
          display_name?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          press_is_public?: boolean;
          role?: "user" | "admin";
          ai_provider?: "openai" | "anthropic" | null;
          ai_api_key_encrypted?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          handle?: string;
          display_name?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          press_is_public?: boolean;
          role?: "user" | "admin";
          ai_provider?: "openai" | "anthropic" | null;
          ai_api_key_encrypted?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      admin_articles: {
        Row: {
          id: string;
          slug: string;
          title: string;
          summary: string | null;
          category: string | null;
          tags: string[];
          thumbnail_url: string | null;
          status: "draft" | "published" | "archived";
          published_revision_id: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          summary?: string | null;
          category?: string | null;
          tags?: string[];
          thumbnail_url?: string | null;
          status?: "draft" | "published" | "archived";
          published_revision_id?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          summary?: string | null;
          category?: string | null;
          tags?: string[];
          thumbnail_url?: string | null;
          status?: "draft" | "published" | "archived";
          published_revision_id?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };

      admin_article_revisions: {
        Row: {
          id: string;
          article_id: string;
          markdown: string;
          content_hash: string;
          rendered_html: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          article_id: string;
          markdown: string;
          content_hash: string;
          rendered_html?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          article_id?: string;
          markdown?: string;
          content_hash?: string;
          rendered_html?: string | null;
          created_at?: string;
        };
      };

      admin_article_blocks: {
        Row: {
          id: string;
          revision_id: string;
          block_id: string;
          block_type: string;
          plain_text: string | null;
          markdown_text: string | null;
          order_index: number;
        };
        Insert: {
          id?: string;
          revision_id: string;
          block_id: string;
          block_type: string;
          plain_text?: string | null;
          markdown_text?: string | null;
          order_index: number;
        };
        Update: {
          id?: string;
          revision_id?: string;
          block_id?: string;
          block_type?: string;
          plain_text?: string | null;
          markdown_text?: string | null;
          order_index?: number;
        };
      };

      scraps: {
        Row: {
          id: string;
          user_id: string;
          source_revision_id: string;
          source_block_id: string;
          start_offset: number;
          end_offset: number;
          exact_quote: string;
          prefix: string | null;
          suffix: string | null;
          user_note: string | null;
          selector: TextQuoteSelector;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source_revision_id: string;
          source_block_id: string;
          start_offset: number;
          end_offset: number;
          exact_quote: string;
          prefix?: string | null;
          suffix?: string | null;
          user_note?: string | null;
          selector: TextQuoteSelector;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          source_revision_id?: string;
          source_block_id?: string;
          start_offset?: number;
          end_offset?: number;
          exact_quote?: string;
          prefix?: string | null;
          suffix?: string | null;
          user_note?: string | null;
          selector?: TextQuoteSelector;
          created_at?: string;
        };
      };

      collections: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          status: "active" | "archived";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          status?: "active" | "archived";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          status?: "active" | "archived";
          created_at?: string;
          updated_at?: string;
        };
      };

      collection_items: {
        Row: {
          id: string;
          collection_id: string;
          scrap_id: string | null;
          article_id: string | null;
          position: number;
          note: string | null;
          highlight_color: "yellow" | "green" | "blue" | "pink" | "purple" | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          collection_id: string;
          scrap_id?: string | null;
          article_id?: string | null;
          position: number;
          note?: string | null;
          highlight_color?: "yellow" | "green" | "blue" | "pink" | "purple" | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          collection_id?: string;
          scrap_id?: string | null;
          article_id?: string | null;
          position?: number;
          note?: string | null;
          highlight_color?: "yellow" | "green" | "blue" | "pink" | "purple" | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      material_notes: {
        Row: {
          id: string;
          collection_id: string;
          user_id: string;
          content_markdown: string;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          collection_id: string;
          user_id: string;
          content_markdown: string;
          position: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          collection_id?: string;
          user_id?: string;
          content_markdown?: string;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
      };

      writing_sessions: {
        Row: {
          id: string;
          user_id: string;
          collection_id: string;
          persona: string | null;
          direction: WritingDirection | null;
          model_provider: "openai" | "anthropic";
          model_name: string;
          status: "drafting" | "done" | "failed";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          collection_id: string;
          persona?: string | null;
          direction?: WritingDirection | null;
          model_provider: "openai" | "anthropic";
          model_name: string;
          status?: "drafting" | "done" | "failed";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          collection_id?: string;
          persona?: string | null;
          direction?: WritingDirection | null;
          model_provider?: "openai" | "anthropic";
          model_name?: string;
          status?: "drafting" | "done" | "failed";
          created_at?: string;
          updated_at?: string;
        };
      };

      writing_session_artifacts: {
        Row: {
          id: string;
          session_id: string;
          artifact_type:
            | "materials_analysis"
            | "topic_suggestions"
            | "outline"
            | "draft";
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          artifact_type:
            | "materials_analysis"
            | "topic_suggestions"
            | "outline"
            | "draft";
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          artifact_type?:
            | "materials_analysis"
            | "topic_suggestions"
            | "outline"
            | "draft";
          content?: string;
          created_at?: string;
        };
      };

      user_posts: {
        Row: {
          id: string;
          user_id: string;
          slug: string;
          title: string;
          markdown: string;
          rendered_html: string | null;
          status: "draft" | "published" | "unlisted";
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          slug: string;
          title: string;
          markdown: string;
          rendered_html?: string | null;
          status?: "draft" | "published" | "unlisted";
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          slug?: string;
          title?: string;
          markdown?: string;
          rendered_html?: string | null;
          status?: "draft" | "published" | "unlisted";
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      post_sources: {
        Row: {
          id: string;
          post_id: string;
          scrap_id: string;
          usage: "inspiration" | "quoted" | "key_point";
        };
        Insert: {
          id?: string;
          post_id: string;
          scrap_id: string;
          usage: "inspiration" | "quoted" | "key_point";
        };
        Update: {
          id?: string;
          post_id?: string;
          scrap_id?: string;
          usage?: "inspiration" | "quoted" | "key_point";
        };
      };
    };
  };
};

/**
 * Helper type to extract row types from database tables
 * Usage: Tables<'profiles'> returns the profiles row type
 */
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

/**
 * Helper type to extract insert types from database tables
 * Usage: TablesInsert<'profiles'> returns the profiles insert type
 */
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

/**
 * Helper type to extract update types from database tables
 * Usage: TablesUpdate<'profiles'> returns the profiles update type
 */
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
