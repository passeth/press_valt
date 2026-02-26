# Press Vault — 개발 기획서 (PRD)

> **버전**: v1.1  
> **최종 수정일**: 2026-02-26  
> **상태**: Phase 1 MVP 기획

---

## 1. 프로젝트 개요

### 1.1 프로젝트명

**Press Vault** — 옵시디언 볼트 개념의 개인 프레스 플랫폼

### 1.2 비전

일방적인 블로그/뉴스레터가 아닌, **읽고 → 모으고 → 쓰는** 순환 구조의 지식 플랫폼.  
사용자는 발행된 아티클을 읽으며 마음에 드는 부분을 드래그하여 스크랩하고, 모은 소재를 기반으로 AI 에이전트와 협업하여 자신만의 글을 작성·발행한다.

### 1.3 핵심 가치

| 가치 | 설명 |
|------|------|
| **개인 볼트** | 모든 사용자가 자신만의 아카이브(프레스)를 소유한다 |
| **소재 기반 글쓰기** | 텍스트 드래그 → 스크랩 → 소재 수집 → AI 글쓰기의 자연스러운 흐름 |
| **에이전틱 워크** | AI가 소재를 분석하고, 주제를 제안하고, 글의 방향을 잡아 초안을 생성한다 |
| **출처 투명성** | 생성된 글에는 원문 소재의 출처가 항상 명시된다 |

### 1.4 MVP 범위 (Phase 1)

**포함**:
1. 인증 (회원가입/로그인)
2. 아티클 발행 (옵시디언 → Git push → 빌드 시 DB 동기화)
3. 아티클 열람 및 텍스트 하이라이트 스크랩
4. 개인 프레스 (컬렉션 관리, 소재 정리)
5. 에이전틱 글쓰기 (소재 분석 → 주제 제안 → 페르소나 선택 → 초안 생성 → 발행)

**제외 (Phase 2 이후)**:
- 스마트 연결 (소재 간 자동 링크)
- 리치 에디터 (WYSIWYG)
- 실시간 협업
- 이메일 뉴스레터 발송
- 옵시디언 볼트 동기화 (사용자측)
- 댓글/소셜 기능
- 구독 관리 상세 기능
- 유료 결제 기능

---

## 2. 기술 스택

### 2.1 프론트엔드

| 기술 | 버전/설명 |
|------|-----------|
| **Next.js** | 15 (App Router) |
| **React** | 19 |
| **TypeScript** | 5.x (strict mode) |
| **Tailwind CSS** | v4 |
| **Vercel AI SDK** | 에이전틱 글쓰기 스트리밍 |

### 2.2 백엔드

| 기술 | 설명 |
|------|------|
| **Supabase** | Auth, PostgreSQL, RLS, Storage, Edge Functions |
| **PostgreSQL** | 15+ (Supabase 관리) |
| **Row Level Security** | 멀티테넌트 데이터 격리 |

### 2.3 AI

| Provider | 모델 | 용도 |
|----------|------|------|
| **OpenAI** | GPT-4o / GPT-4o-mini | 글쓰기 생성 |
| **Anthropic** | Claude Sonnet / Haiku | 글쓰기 생성 |

사용자가 Settings에서 Provider와 API Key를 직접 설정한다.

### 2.4 배포

| 서비스 | 용도 |
|--------|------|
| **Vercel** | Next.js 호스팅, Edge Functions |
| **Supabase Cloud** | DB, Auth, Storage |
| **GitHub** | `https://github.com/passeth/press_valt` |

### 2.5 주요 라이브러리

| 라이브러리 | 용도 |
|------------|------|
| `marked` / `remark` | 마크다운 → HTML 변환 |
| `gray-matter` | YAML frontmatter 파싱 |
| `sharp` | 이미지 최적화 |
| `zustand` | 클라이언트 상태 관리 |
| `@supabase/ssr` | Supabase Next.js SSR 통합 |
| `ai` (Vercel AI SDK) | 스트리밍 AI 응답 |

---

## 3. 핵심 컨셉

### 3.1 콘텐츠 파이프라인 (운영자)

```
[1] 옵시디언에서 마크다운 작성 (YAML frontmatter 포함)
    ↓ content/{category}/{date}-{slug}.md 에 저장
[2] git commit + git push
    ↓ GitHub → Vercel 자동 빌드 트리거
[3] 빌드 시 콘텐츠 동기화 스크립트 실행
    │  ├─ /content 폴더 스캔
    │  ├─ frontmatter 파싱 (gray-matter)
    │  ├─ 마크다운 → HTML 변환 (marked/remark)
    │  ├─ 블록 단위 파싱 (스크랩 앵커링용)
    │  └─ Supabase DB에 upsert (articles, revisions, blocks)
    ↓
[4] 사이트에 아티클 자동 배포
```

이 구조는 MY-BLOG_OBSI 레퍼런스와 동일한 패턴이다.
운영자는 옵시디언에서만 콘텐츠를 작성하며, 웹 어드민에서는 콘텐츠를 작성하지 않는다.

### 3.2 사용자 흐름 (Core Loop)

```
[1] 아티클 읽기
    ↓ 텍스트 드래그 선택
[2] "소재로 추가" → 스크랩 생성
    ↓ 컬렉션에 정리
[3] 소재함 (Materials Inbox)
    ↓ 글쓰기 시작
[4] 에이전틱 글쓰기
    │  ├─ 소재 분석
    │  ├─ 주제 3개 제안
    │  ├─ 페르소나 선택
    │  ├─ 글 방향 설정
    │  └─ 초안 생성 (스트리밍)
    ↓
[5] 편집 → 발행 → 내 프레스
```

### 3.3 옵시디언 볼트 비유

| 옵시디언 | Press Vault |
|----------|-------------|
| 볼트 (Vault) | 개인 프레스 (Press) |
| 노트 (Note) | 사용자 포스트 (User Post) |
| 하이라이트/인용 | 스크랩 (Scrap) |
| 폴더 | 컬렉션 (Collection) |
| 데일리 노트 | 소재함 (Materials Inbox) |

### 3.4 콘텐츠 폴더 구조

```
press-vault/
├── content/                    # 옵시디언 볼트 연결 폴더
│   ├── development/            # 카테고리별 폴더
│   ├── products/
│   ├── trends/
│   ├── tips/
│   ├── insights/
│   └── _assets/                # 이미지 등 미디어
│       └── images/
├── src/                        # Next.js 소스코드
└── docs/                       # 기획 문서
```

**YAML Frontmatter 스키마** (MY-BLOG_OBSI 호환):
```yaml
---
title: "아티클 제목"
slug: "url-friendly-slug"
journalist: "persona-id"
persona_role: "R&D Scientist"
category: "development"
tags: ["tag1", "tag2"]
date: "2026-01-15"
updated: "2026-01-15"
featured_image: "/assets/images/article-hero.webp"
excerpt: "아티클 요약 (2-3문장)"
status: "published"
featured: false
homepage_priority: 5
reading_time: "5 min"
---
```

### 3.5 버전 기반 하이라이트 앵커링

스크랩은 **특정 발행 리비전**에 앵커링된다.  
원문이 수정되어도 스크랩은 원래 버전의 텍스트를 유지한다.

```
scrap.source_revision_id → admin_article_revisions.id
scrap.source_block_id    → 해당 리비전의 블록 ID
scrap.start_offset / end_offset → 블록 내 텍스트 위치
scrap.exact_quote        → 원문 텍스트 스냅샷 (drift 방지)
```

빌드 시 마크다운의 content_hash가 변경되면 새 리비전이 생성된다.
기존 리비전의 블록은 변경되지 않으므로 기존 스크랩은 항상 유효하다.

### 3.6 에이전틱 글쓰기 파이프라인

thinkingnote 플러그인의 UX를 웹으로 재구현한다.

**단계**:

1. **소재 분석** (Materials Analysis)  
   - 선택된 컬렉션의 스크랩들을 분석
   - 핵심 주제, 공통 테마, 인사이트 추출

2. **주제 제안** (Topic Suggestions)  
   - 소재 분석 결과 기반 3개 주제 제안
   - 각 주제에 대한 간략 설명과 방향 포함

3. **페르소나 선택** (Persona Selection)  
   - 미리 정의된 글쓰기 페르소나 목록 제공
   - 또는 사용자 커스텀 페르소나

4. **글 방향 설정** (Writing Direction)  
   - 사용자가 글의 톤, 길이, 강조점 입력
   - 추가 지시사항 자유 입력

5. **초안 생성** (Draft Generation)  
   - Vercel AI SDK로 스트리밍 생성
   - 원문 소재의 출처 인용 포함
   - 생성 후 편집 가능

6. **발행** (Publish)  
   - 내 프레스에 게시
   - public / unlisted 선택
---

## 4. 구현 전략

### 4.1 Hybrid Interaction-First 접근법

Oracle 아키텍처 분석 결과 채택된 전략.

**Day 1 목표**: 디자인 토큰 + 프리미티브 컴포넌트 완성
```
디자인 토큰: 타입 스케일, 스페이싱, 컬러, 서피스
프리미티브 (8-12개):
  Button, Panel, Tabs, Sheet/Modal, Callout,
  Textarea, Toast, Tooltip, Skeleton, Badge
```

**Week 1 목표**: 전체 Core Loop를 실제 UX 수준으로 동작
```
아티클 읽기 → 텍스트 선택 → "소재로 추가" → 소재함 →
가이디드 생성 (주제 → 페르소나 → 방향) → 출처 포함 초안 → 프레스 발행
```

**Week 2+**: Core Loop 안정화 후 폴리싱

### 4.2 개발 순서

```
Phase 1-A: 기반 (Day 1-2)
├── Next.js 프로젝트 초기화
├── Supabase 연동 (Auth, DB)
├── 디자인 토큰 + 프리미티브 컴포넌트
├── 레이아웃 쉘 (네비게이션, 페이지 구조)
└── 콘텐츠 동기화 스크립트 (content/ → Supabase DB)

Phase 1-B: 읽기 + 수집 (Day 3-5)
├── 콘텐츠 폴더 구조 + 샘플 아티클 작성
├── 빌드 시 마크다운 → DB 동기화 파이프라인
├── 아티클 목록 / 상세 페이지
├── 텍스트 선택 → 스크랩 UX
└── 컬렉션 관리

Phase 1-C: 쓰기 + 발행 (Day 6-9)
├── 에이전틱 글쓰기 파이프라인
├── AI Provider 설정 (OpenAI / Anthropic)
├── 초안 편집 + 발행
└── 내 프레스 페이지

Phase 1-D: 폴리싱 + 관리자 골격 (Day 10-12)
├── 반응형 디자인
├── 에러 핸들링
├── 퍼블릭 프레스 뷰
├── 관리자 페이지 골격 (콘텐츠 상태 관리, 구독/결제 플레이스홀더)
└── Vercel 배포
```

---

## 5. UI 디자인 가이드

### 5.1 디자인 레퍼런스

**Magazine B** (https://magazine-b.com/)  
미니멀 에디토리얼 스타일. 특히 뉴스레터 리스트 페이지(https://magazine-b.com/newsletter/list.html) 의 카드 그리드 구조를 핵심 레퍼런스로 사용한다.

### 5.2 디자인 원칙

| 원칙 | 설명 |
|------|------|
| **화이트 스페이스** | 여백을 아끼지 않는다. 콘텐츠가 숨 쉴 공간을 확보한다 |
| **타이포그래피 우선** | 폰트 크기, 굵기, 행간으로 정보 계층을 표현한다 |
| **최소 장식** | 불필요한 보더, 그림자, 그라데이션을 배제한다 |
| **콘텐츠 중심** | UI는 콘텐츠를 방해하지 않는다 |

### 5.3 컬러 시스템

```
Background:    #FFFFFF (순백)
Surface:       #FAFAFA (카드, 패널)
Border:        #E5E5E5 (구분선)
Text Primary:  #1A1A1A (본문)
Text Secondary:#6B7280 (부제, 메타)
Text Tertiary: #9CA3AF (힌트, 비활성)
Accent:        #1A1A1A (블랙 — CTA 버튼, 링크)
Accent Hover:  #404040
Highlight:     #FEF9C3 (스크랩 하이라이트 — 연노랑)
Highlight Active: #FDE68A (선택 중 하이라이트)
Error:         #EF4444
Success:       #22C55E
```

### 5.4 타이포그래피

```
Font Family:   'Noto Sans KR', sans-serif
Font English:  'Inter', sans-serif

Display:       36px / 700 / 1.2 line-height  (페이지 타이틀)
Heading 1:     28px / 700 / 1.3              (섹션 타이틀)
Heading 2:     22px / 600 / 1.4              (서브 타이틀)
Heading 3:     18px / 600 / 1.4              (카드 타이틀)
Body:          16px / 400 / 1.75             (본문 — 넉넉한 행간)
Body Small:    14px / 400 / 1.6              (메타 정보)
Caption:       12px / 400 / 1.5              (태그, 날짜)
```

### 5.5 스페이싱 스케일

```
4px  — 인라인 요소 간격
8px  — 타이트한 요소 간격
12px — 컴포넌트 내부 패딩 (소)
16px — 컴포넌트 내부 패딩 (기본)
24px — 섹션 간 간격 (소)
32px — 섹션 간 간격 (기본)
48px — 섹션 간 간격 (대)
64px — 페이지 섹션 구분
96px — 히어로 영역
```

### 5.6 레이아웃

```
Max Width:     1200px (콘텐츠 영역)
Article Width: 720px  (아티클 본문)
Grid:          1-3 컬럼 반응형 그리드

Breakpoints:
  sm:  640px
  md:  768px
  lg:  1024px
  xl:  1280px

Navigation:    상단 고정, 센터 로고, 좌우 메뉴
Article List:  카드 그리드 (Magazine B 스타일)
Article View:  단일 컬럼, 중앙 정렬
Press View:    2-3 컬럼 그리드
```

### 5.7 핵심 컴포넌트

| 컴포넌트 | 설명 |
|----------|------|
| `TopNav` | 고정 상단 네비게이션. 로고 센터, 좌측 메뉴, 우측 사용자 |
| `ArticleCard` | 썸네일 + 제목 + 요약 + 날짜. Magazine B 카드 스타일 |
| `ArticleView` | 720px 단일 컬럼. 텍스트 선택 시 플로팅 "소재로 추가" 버튼 |
| `ScrapButton` | 텍스트 선택 시 커서 근처에 나타나는 플로팅 버튼 |
| `ScrapModal` | 스크랩 추가 시 컬렉션 선택 + 메모 입력 |
| `CollectionPanel` | 컬렉션 목록 + 소재 카드 |
| `WritingWizard` | 에이전틱 글쓰기 다단계 위저드 |
| `DraftEditor` | 마크다운 편집기 (textarea 기반, MVP) |
| `PressGrid` | 사용자 프레스의 포스트 그리드 |

---

## 6. 사용자 역할 및 권한

### 6.1 역할 정의

| 역할 | 설명 |
|------|------|
| **Admin** | 플랫폼 관리자. 콘텐츠 상태 관리, 사용자 관리, 구독/결제 관리 (Phase 2) |
| **User** | 일반 사용자. 아티클 열람, 스크랩, 글쓰기, 프레스 운영 |
| **Visitor** | 비로그인. 퍼블릭 아티클 열람, 퍼블릭 프레스 열람 |

### 6.2 권한 매트릭스

| 기능 | Admin | User | Visitor |
|------|-------|------|---------|
| 아티클 발행 (옵시디언 → Git) | ✅ | ❌ | ❌ |
| 아티클 상태 관리 (웹 어드민) | ✅ | ❌ | ❌ |
| 아티클 열람 (published) | ✅ | ✅ | ✅ |
| 텍스트 스크랩 | ✅ | ✅ | ❌ |
| 컬렉션 관리 | ✅ | ✅ | ❌ |
| 에이전틱 글쓰기 | ✅ | ✅ | ❌ |
| 내 프레스 관리 | ✅ | ✅ | ❌ |
| 퍼블릭 프레스 열람 | ✅ | ✅ | ✅ |
| 사용자 관리 | ✅ | ❌ | ❌ |
| 구독/결제 관리 (Phase 2) | ✅ | ❌ | ❌ |

---

## 7. 페이지 맵

### 7.1 퍼블릭 페이지

```
/                           — 홈 (최신 아티클 + 추천 프레스)
/articles                   — 아티클 목록 (Magazine B 그리드)
/articles/[slug]            — 아티클 상세 (읽기 + 스크랩 UX)
/press/[handle]             — 퍼블릭 프레스 (사용자 발행 글 목록)
/press/[handle]/[slug]      — 퍼블릭 포스트 상세
/login                      — 로그인
/signup                     — 회원가입
```

### 7.2 인증 필요 페이지

```
/dashboard                  — 대시보드 (내 스크랩 요약, 최근 활동)
/collections                — 내 컬렉션 목록
/collections/[id]           — 컬렉션 상세 (소재 목록)
/write                      — 에이전틱 글쓰기 위저드
/write/[session-id]         — 글쓰기 세션 (진행 중인 작업)
/my-press                   — 내 프레스 관리
/my-press/[slug]/edit       — 포스트 편집
/settings                   — 설정 (프로필, AI Provider, API Key)
```

### 7.3 관리자 페이지

```
/admin                      — 관리자 대시보드
/admin/articles             — 아티클 상태 관리 (발행/아카이브 토글, 동기화 상태 확인)
/admin/users                — 사용자 관리
/admin/subscriptions        — 구독 관리 (Phase 2 — 골격만 MVP)
/admin/payments             — 결제 관리 (Phase 2 — 골격만 MVP)
```

> **Note**: 아티클 작성/편집은 웹 어드민에서 하지 않는다.
> 운영자는 옵시디언에서 마크다운을 작성하고 git push로 배포한다.
> 웹 어드민은 발행 상태 관리, 사용자 관리, 구독/결제 관리만 담당한다.

---

## 8. 데이터 모델

### 8.1 ERD 개요

```
profiles ─────────────────────────────── user_posts
    │                                        │
    ├── scraps ──── collection_items ── collections
    │       │                               │
    │       │                        material_notes
    │       │
    │       └── post_sources ──────── user_posts
    │
    └── writing_sessions ── writing_session_artifacts
            │
            └── collections

admin_articles ── admin_article_revisions ── admin_article_blocks
                          │
                          └── scraps (source_revision_id)
```

### 8.2 핵심 테이블

| 테이블 | 설명 | 주요 필드 |
|--------|------|-----------|
| `profiles` | 사용자 프로필 | handle, display_name, bio, press_is_public, role |
| `admin_articles` | 관리자 발행 아티클 | slug, title, status, published_revision_id |
| `admin_article_revisions` | 아티클 버전 | article_id, markdown, content_hash, rendered_html |
| `admin_article_blocks` | 리비전 내 블록 | revision_id, block_id, block_type, plain_text, order_index |
| `scraps` | 사용자 스크랩 | user_id, source_revision_id, source_block_id, exact_quote, start/end_offset |
| `collections` | 스크랩 컬렉션 | user_id, title, status |
| `collection_items` | 컬렉션 ↔ 스크랩 | collection_id, scrap_id, position |
| `material_notes` | 컬렉션 내 메모 | collection_id, user_id, content_markdown |
| `writing_sessions` | 글쓰기 세션 | user_id, collection_id, persona, direction, model_provider, status |
| `writing_session_artifacts` | 생성 결과물 | session_id, artifact_type, content |
| `user_posts` | 사용자 발행 글 | user_id, slug, title, markdown, status |
| `post_sources` | 포스트 출처 | post_id, scrap_id, usage |

### 8.3 RLS 정책 요약

```
admin_articles:
  SELECT → status = 'published' (모든 사용자)
  INSERT/UPDATE/DELETE → profiles.role = 'admin'

scraps, collections, collection_items, material_notes:
  ALL → user_id = auth.uid()

writing_sessions, writing_session_artifacts:
  ALL → user_id = auth.uid() (sessions 경유)

user_posts:
  SELECT → status = 'published' (퍼블릭) OR user_id = auth.uid() (본인)
  INSERT/UPDATE/DELETE → user_id = auth.uid()

profiles:
  SELECT → 전체 공개 (handle, display_name, bio만)
  UPDATE → id = auth.uid()
```

---

## 9. 성공 지표

### 9.1 Phase 1 MVP 완료 기준

| 항목 | 기준 |
|------|------|
| Core Loop 동작 | 읽기 → 스크랩 → 글쓰기 → 발행 전 과정이 끊김 없이 작동 |
| 인증 | 회원가입, 로그인, 프로필 설정 정상 동작 |
| 아티클 | 마크다운 → HTML 발행, 목록/상세 페이지 렌더링 |
| 스크랩 | 텍스트 드래그 → 플로팅 버튼 → 스크랩 저장 정상 동작 |
| AI 글쓰기 | OpenAI/Anthropic 모두 정상 동작, 스트리밍 응답 |
| 프레스 | 내 프레스 관리 + 퍼블릭 프레스 열람 정상 동작 |
| 배포 | Vercel에 정상 배포, 커스텀 도메인 설정 가능 |

### 9.2 품질 기준

| 항목 | 기준 |
|------|------|
| Lighthouse Performance | > 90 |
| TypeScript | strict mode, zero `any` |
| 반응형 | 모바일 ~ 데스크톱 정상 |
| 접근성 | 키보드 네비게이션, 시맨틱 HTML |
| 에러 핸들링 | 모든 API 호출에 에러 처리 |

---

## 부록: 기술 결정 기록

### A. 아키텍처 접근법

**Hybrid Interaction-First** (Oracle 권고 채택)

- 디자인 토큰과 프리미티브를 Day 1에 확립하되, 전체 디자인 시스템 완성을 기다리지 않고 Core Loop를 우선 구현한다.
- Core Loop 외의 기능(관리자 대시보드 등)은 실용적 수준으로 유지하고 Loop 안정화 후 폴리싱한다.

### B. 콘텐츠 발행: 옵시디언 → Git → 빌드 시 DB 동기화

**MY-BLOG_OBSI 패턴 채택** (사용자 요구)

- 운영자는 옵시디언에서 마크다운을 작성하고, 특정 폴더(`content/`)를 Git 레포에 연결한다.
- `git commit + push` → Vercel이 빌드를 트리거한다.
- 빌드 시 `content/` 폴더를 스캔하여 Supabase DB에 동기화한다:
  - 새 파일 → `admin_articles` + `admin_article_revisions` + `admin_article_blocks` INSERT
  - 수정된 파일 (content_hash 변경) → 새 리비전 생성, `published_revision_id` 업데이트
  - 삭제된 파일 → `status = 'archived'` (소프트 삭제, 기존 스크랩 보호)
- 웹 어드민에서는 콘텐츠를 작성하지 않는다. 발행 상태 토글과 관리 기능만 제공한다.

### C. 하이라이트 버전 앵커링

**리비전 기반 앵커링** (Oracle 권고 채택)

- 스크랩은 `source_revision_id`로 특정 버전에 고정된다.
- 원문이 수정되어도 스크랩의 `exact_quote`는 변하지 않는다.
- Phase 2에서 "원문이 변경되었습니다" 알림 기능 추가 가능.

### D. 실시간 협업 미도입

**MVP에서 제외** (Oracle 권고 채택)

- 낙관적 동시성 제어(version number)로 확장 여지를 남긴다.
- `admin_article_revisions`의 리비전 체계가 이후 협업 기능의 기반이 된다.

### E. AI Provider 구조

**사용자 선택형 멀티 Provider**

- 사용자가 Settings에서 OpenAI 또는 Anthropic을 선택하고 자신의 API Key를 입력한다.
- Vercel AI SDK의 provider 추상화를 활용하여 동일한 인터페이스로 두 Provider를 지원한다.
- API Key는 Supabase에 암호화 저장 (pgcrypto 또는 클라이언트 사이드 암호화).

### F. 관리자 페이지 골격 (구독/결제 확장 대비)

**MVP에서 골격만 구현** (사용자 요구)

- 구독 관리, 유료 결제 기능은 Phase 2에서 구현 예정.
- MVP에서는 관리자 페이지의 기초 라우팅과 레이아웃만 구성한다:
  - `/admin` — 대시보드 (아티클 수, 사용자 수, 동기화 상태)
  - `/admin/articles` — 콘텐츠 상태 관리 (발행/아카이브 토글)
  - `/admin/users` — 사용자 목록
  - `/admin/subscriptions` — "Coming Soon" 플레이스홀더
  - `/admin/payments` — "Coming Soon" 플레이스홀더
