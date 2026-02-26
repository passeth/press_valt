"use client";

import { Suspense } from "react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      const redirectTo = searchParams.get("redirectTo") || "/dashboard";
      router.push(redirectTo);
    } catch {
      setError("로그인 중 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-2xl font-bold tracking-tight mb-2">Press Vault</h1>
          <p className="text-sm text-text-secondary">로그인</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Input */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              이메일
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-2 border border-border rounded-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent transition-colors"
              required
            />
          </div>

          {/* Password Input */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-border rounded-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent transition-colors"
              required
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-error/10 border border-error rounded-sm text-sm text-error">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-accent text-white font-medium rounded-sm hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        {/* Signup Link */}
        <div className="mt-8 text-center text-sm">
          <span className="text-text-secondary">계정이 없으신가요? </span>
          <Link href="/signup" className="text-accent hover:text-accent-hover transition-colors">
            회원가입
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">로딩 중...</div>}>
      <LoginForm />
    </Suspense>
  );
}
