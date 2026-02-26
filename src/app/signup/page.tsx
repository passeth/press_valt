"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [handle, setHandle] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const validateHandle = (value: string): boolean => {
    const handleRegex = /^[a-z0-9\-]{3,30}$/;
    return handleRegex.test(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    // Validation
    if (!validateHandle(handle)) {
      setError("핸들은 3~30자의 소문자, 숫자, 하이픈만 포함해야 합니다.");
      setLoading(false);
      return;
    }

    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            handle,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setEmail("");
      setPassword("");
      setPasswordConfirm("");
      setHandle("");
      setLoading(false);
    } catch {
      setError("회원가입 중 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-2xl font-bold tracking-tight mb-2">Press Vault</h1>
          <p className="text-sm text-text-secondary">회원가입</p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-success/10 border border-success rounded-sm text-sm text-success text-center">
            <p className="font-medium mb-1">회원가입 완료!</p>
            <p>확인 이메일을 발송했습니다. 메일함을 확인해주세요.</p>
          </div>
        )}

        {!success && (
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

            {/* Handle Input */}
            <div>
              <label htmlFor="handle" className="block text-sm font-medium mb-2">
                핸들
              </label>
              <input
                id="handle"
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase())}
                placeholder="your-handle"
                className="w-full px-4 py-2 border border-border rounded-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent transition-colors"
                required
              />
              <p className="text-xs text-text-tertiary mt-1">
                3~30자, 소문자, 숫자, 하이픈만 사용 가능
              </p>
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

            {/* Password Confirm Input */}
            <div>
              <label htmlFor="passwordConfirm" className="block text-sm font-medium mb-2">
                비밀번호 확인
              </label>
              <input
                id="passwordConfirm"
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
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
              {loading ? "가입 중..." : "회원가입"}
            </button>
          </form>
        )}

        {/* Login Link */}
        {!success && (
          <div className="mt-8 text-center text-sm">
            <span className="text-text-secondary">이미 계정이 있으신가요? </span>
            <Link href="/login" className="text-accent hover:text-accent-hover transition-colors">
              로그인
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
