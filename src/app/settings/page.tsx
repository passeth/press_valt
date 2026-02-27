"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/lib/theme/provider";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import type { ThemeId } from "@/lib/theme/themes";

interface Profile {
  handle: string;
  display_name: string | null;
  bio: string | null;
  press_is_public: boolean;
  ai_provider: "openai" | "anthropic" | null;
}

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme, themes } = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [pressIsPublic, setPressIsPublic] = useState(false);
  const [aiProvider, setAiProvider] = useState<"openai" | "anthropic" | "">("");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("handle, display_name, bio, press_is_public, ai_provider")
      .eq("id", user.id)
      .maybeSingle();

    if (data) {
      setProfile(data);
      setDisplayName(data.display_name || "");
      setBio(data.bio || "");
      setPressIsPublic(data.press_is_public);
      setAiProvider(data.ai_provider || "");
    }

    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName || null,
        bio: bio || null,
        press_is_public: pressIsPublic,
        ai_provider: aiProvider || null,
      })
      .eq("id", user.id);

    if (error) {
      setMessage("저장 중 오류가 발생했습니다.");
    } else {
      setMessage("설정이 저장되었습니다.");
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <TopNav />
        <PageContainer maxWidth="article">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-32 bg-surface" />
            <div className="h-48 bg-surface" />
          </div>
        </PageContainer>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />

      <PageContainer maxWidth="article">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[length:var(--text-h1)] font-serif font-semibold italic mb-2">
            설정
          </h1>
          <p className="text-[length:var(--text-small)] text-text-secondary">
            @{profile?.handle}
          </p>
        </div>

        <div className="space-y-8">
          {/* Theme section */}
          <section className="border border-border p-[var(--section-padding)] rounded-[var(--radius-card)]">
            <h2 className="text-[length:var(--text-h3)] font-medium mb-4">
              테마
            </h2>
            <p className="text-[length:var(--text-caption)] text-text-tertiary mb-4">
              사이트의 색상과 분위기를 변경합니다.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id as ThemeId)}
                  className={`border p-4 text-left transition-colors ${
                    theme === t.id
                      ? "border-accent bg-surface"
                      : "border-border hover:bg-surface"
                  }`}
                >
                  <p className="text-[length:var(--text-body)] font-medium mb-1">
                    {t.name}
                  </p>
                  <p className="text-[length:var(--text-caption)] text-text-secondary leading-relaxed">
                    {t.description}
                  </p>
                  {theme === t.id && (
                    <p className="text-[length:var(--text-badge)] text-accent font-medium mt-2 uppercase tracking-[1px]">
                      현재 적용
                    </p>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Profile section */}
          <section className="border border-border p-[var(--section-padding)] rounded-[var(--radius-card)]">
            <h2 className="text-[length:var(--text-h3)] font-medium mb-6">
              프로필
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[length:var(--text-small)] font-medium mb-2">
                  표시 이름
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="표시될 이름"
                  className="w-full px-4 py-2 border border-border bg-background text-text-primary rounded-[var(--radius-input)] text-[length:var(--text-body)] placeholder:text-placeholder focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              <div>
                <label className="block text-[length:var(--text-small)] font-medium mb-2">
                  소개
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="간단한 자기소개"
                  rows={3}
                  className="w-full px-4 py-2 border border-border bg-background text-text-primary rounded-[var(--radius-input)] text-[length:var(--text-body)] placeholder:text-placeholder focus:outline-none focus:border-accent transition-colors resize-none"
                />
              </div>
            </div>
          </section>

          {/* Press visibility */}
          <section className="border border-border p-[var(--section-padding)] rounded-[var(--radius-card)]">
            <h2 className="text-[length:var(--text-h3)] font-medium mb-4">
              프레스 공개 설정
            </h2>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={pressIsPublic}
                onChange={(e) => setPressIsPublic(e.target.checked)}
                className="w-4 h-4 accent-accent"
              />
              <span className="text-[length:var(--text-small)]">
                나의 프레스를 공개합니다
              </span>
            </label>
            <p className="text-[length:var(--text-caption)] text-text-tertiary mt-2">
              공개 시 /press/{profile?.handle} 에서 발행된 글을 누구나 볼 수 있습니다.
            </p>
          </section>

          {/* AI provider */}
          <section className="border border-border p-[var(--section-padding)] rounded-[var(--radius-card)]">
            <h2 className="text-[length:var(--text-h3)] font-medium mb-4">
              AI 제공자
            </h2>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="ai_provider"
                  value="anthropic"
                  checked={aiProvider === "anthropic"}
                  onChange={(e) => setAiProvider(e.target.value as "anthropic")}
                  className="accent-accent"
                />
                <span className="text-[length:var(--text-small)]">
                  Anthropic (Claude)
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="ai_provider"
                  value="openai"
                  checked={aiProvider === "openai"}
                  onChange={(e) => setAiProvider(e.target.value as "openai")}
                  className="accent-accent"
                />
                <span className="text-[length:var(--text-small)]">
                  OpenAI (GPT)
                </span>
              </label>
            </div>
            <p className="text-[length:var(--text-caption)] text-text-tertiary mt-2">
              글 작성 시 사용할 AI 모델을 선택합니다.
            </p>
          </section>

          {/* Save */}
          <div className="flex items-center gap-4">
            <Button onClick={handleSave} isLoading={saving}>
              저장
            </Button>
            {message && (
              <p className="text-[length:var(--text-small)] text-text-secondary">
                {message}
              </p>
            )}
          </div>
        </div>
      </PageContainer>

      <Footer />
    </div>
  );
}
