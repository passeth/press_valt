# Press Vault — 기능 기술서 (FSD)

> **버전**: v1.1  
> **최종 수정일**: 2026-02-26  
> **상태**: Phase 1 MVP 기능 명세  
> **참조**: [PRD.md](./PRD.md)

---

## 1. 인증 (Authentication)

### 1.1 회원가입

**흐름**:
1. 이메일 + 비밀번호 입력
2. Supabase Auth `signUp()` 호출
3. 이메일 확인 링크 발송
4. 확인 후 `profiles` 테이블에 레코드 생성 (DB trigger)
5. 핸들(handle) 설정 페이지로 리다이렉트

**입력 검증**:
| 필드 | 규칙 |
|------|------|
| 이메일 | RFC 5322 형식, 중복 불가 |
| 비밀번호 | 8자 이상, 영문 + 숫자 포함 |
| 핸들 | 3-30자, 영소문자 + 숫자 + 하이픈, 유니크 |

**Supabase Trigger**:
```sql
-- profiles 자동 생성 trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 1.2 로그인

**흐름**:
1. 이메일 + 비밀번호 입력
2. Supabase Auth `signInWithPassword()` 호출
3. 성공 시 JWT 쿠키 설정 (httpOnly, secure)
4. `/dashboard`로 리다이렉트

**에러 처리**:
| 에러 | 메시지 |
|------|--------|
| 잘못된 인증 정보 | "이메일 또는 비밀번호가 올바르지 않습니다" |
| 이메일 미확인 | "이메일 확인이 필요합니다. 메일함을 확인해주세요" |
| Rate limit | "잠시 후 다시 시도해주세요" |

### 1.3 로그아웃

- Supabase Auth `signOut()` 호출
- 세션 쿠키 삭제
- `/` 홈으로 리다이렉트

### 1.4 세션 관리

- `@supabase/ssr` 미들웨어로 서버/클라이언트 세션 동기화
- Next.js middleware에서 인증 필요 라우트 보호
- 토큰 자동 갱신 (Supabase 기본)

---

## 2. 아티클 발행 (옵시디언 → Git → DB 동기화)

### 2.1 콘텐츠 파이프라인 개요

운영자는 웹 어드민에서 글을 작성하지 않는다.  
옵시디언에서 마크다운을 작성하고, git push로 배포한다.

```
옵시디언 (content/{category}/{date}-{slug}.md)
  ↓ git commit + push
GitHub 레포 (press_valt)
  ↓ Vercel 자동 빌드 트리거
Next.js 빌드 프로세스
  ↓ 콘텐츠 동기화 스크립트 실행
Supabase DB (articles, revisions, blocks)
  ↓ 사이트 배포 완료
```

### 2.2 콘텐츠 폴더 구조

MY-BLOG_OBSI와 동일한 패턴.

```
press-vault/
└── content/
    ├── development/
    │   └── 2026-01-15-article-title.md
    ├── products/
    ├── trends/
    ├── tips/
    ├── insights/
    └── _assets/
        └── images/
```

**파일 네이밍 규칙**: `{YYYY-MM-DD}-{slug}.md`  
**카테고리**: 폴더명이 카테고리가 된다. `_` 접두어 폴더는 제외.

### 2.3 YAML Frontmatter 스키마

MY-BLOG_OBSI의 YAML_SCHEMA.md와 호환되는 형식.

```yaml
---
title: "How AI is Revolutionizing Retinol Formulation"
slug: "ai-revolutionizing-retinol-formulation"
journalist: "dr-sarah-kim"
persona_role: "R&D Scientist"
category: "development"
tags:
  - ai-formulation
  - retinol
  - innovation
date: "2026-01-15"
updated: "2026-01-15"
featured_image: "/assets/images/1.webp"
excerpt: "아티클 요약 2-3문장 (150-200자)"
status: "published"
featured: false
homepage_priority: 5
reading_time: "8 min"
---
```

**필드 정의**:
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `title` | string | ✅ | 전체 제목 (max 100자) |
| `slug` | string | ✅ | URL 식별자 (영소문자, 하이픈) |
| `journalist` | string | ✅ | 페르소나 ID |
| `persona_role` | string | ✅ | 페르소나 역할 표시 |
| `category` | string | ✅ | 폴더명과 일치 |
| `tags` | array | ✅ | 2-5개 태그 |
| `date` | string | ✅ | 발행일 (YYYY-MM-DD) |
| `updated` | string | ✅ | 수정일 (YYYY-MM-DD) |
| `featured_image` | string | ✅ | 히어로 이미지 경로 |
| `excerpt` | string | ✅ | 요약 (150-200자) |
| `status` | string | ✅ | `draft` \| `published` |
| `featured` | boolean | ✅ | 홈 노출 여부 |
| `homepage_priority` | number | ✅ | 1-10 (1=최우선) |
| `reading_time` | string | ✅ | 예상 읽기 시간 |

### 2.4 콘텐츠 동기화 스크립트

빌드 시 실행되는 Node.js 스크립트. `scripts/sync-content.ts`

**실행 시점**: `next build` 전 또는 build step으로 포함.

**프로세스**:
1. `content/` 폴더 재귀적 스캔 (배제: `_` 접두어 폴더)
2. 각 `.md` 파일에 대해:
   a. `gray-matter`로 frontmatter 파싱
   b. `status: published`인 파일만 DB 동기화 (나머지는 무시)
   c. 마크다운 본문의 content_hash (SHA256) 계산
   d. DB에서 해당 slug의 기존 article 조회

3. **새 아티클** (slug 없음):
   a. `admin_articles` INSERT (slug, title, category, tags, 등)
   b. `admin_article_revisions` INSERT (markdown, content_hash, rendered_html)
   c. `admin_article_blocks` INSERT (블록 파싱 결과)
   d. `admin_articles.published_revision_id` 업데이트

4. **수정된 아티클** (slug 있음 + content_hash 다름):
   a. 새 `admin_article_revisions` INSERT (content_hash 변경)
   b. 새 `admin_article_blocks` INSERT
   c. `admin_articles.published_revision_id` 새 리비전으로 업데이트
   d. **기존 리비전/블록은 변경하지 않음** (스크랩 보호)

5. **변경 없는 아티클** (content_hash 동일): 스킵

6. **삭제된 아티클** (DB에 있지만 파일 없음):
   a. `admin_articles.status = 'archived'`로 변경
   b. 기존 리비전/스크랩은 보존

**의사코드**:
```typescript
// scripts/sync-content.ts
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const CONTENT_DIR = path.join(process.cwd(), 'content');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // 빌드 시에만 사용, RLS 우회
);

interface ArticleFile {
  filePath: string;
  slug: string;
  frontmatter: Record<string, any>;
  markdown: string;
  contentHash: string;
  renderedHtml: string;
  blocks: ParsedBlock[];
}

interface ParsedBlock {
  blockId: string;
  blockType: string;
  plainText: string;
  markdownText: string;
  orderIndex: number;
}

async function syncContent() {
  // 1. content/ 스캔
  const files = scanContentDir(CONTENT_DIR);
  
  // 2. DB의 기존 아티클 조회
  const { data: existingArticles } = await supabase
    .from('admin_articles')
    .select('id, slug, published_revision_id, admin_article_revisions(content_hash)');
  
  const existingSlugs = new Map(
    existingArticles?.map(a => [a.slug, a]) || []
  );
  
  // 3. 각 파일 처리
  for (const file of files) {
    const existing = existingSlugs.get(file.slug);
    
    if (!existing) {
      await insertNewArticle(file);
    } else {
      const currentHash = existing.admin_article_revisions?.[0]?.content_hash;
      if (currentHash !== file.contentHash) {
        await updateArticle(existing.id, file);
      }
      existingSlugs.delete(file.slug);
    }
  }
  
  // 4. DB에만 있고 파일이 없는 아티클 → 아카이브
  for (const [slug, article] of existingSlugs) {
    await supabase
      .from('admin_articles')
      .update({ status: 'archived' })
      .eq('id', article.id);
  }
}

syncContent().catch(console.error);
```

### 2.5 블록 파싱

빌드 시 마크다운을 블록 단위로 파싱하여 `admin_article_blocks`에 저장한다.

**블록 타입**:
| 타입 | 설명 | 파싱 규칙 |
|------|------|-----------|
| `heading` | 제목 (h1-h6) | `#` 으로 시작하는 줄 |
| `paragraph` | 본문 단락 | 빈 줄로 구분된 텍스트 블록 |
| `list` | 목록 | `-`, `*`, `1.` 으로 시작하는 연속 줄 |
| `blockquote` | 인용 | `>` 로 시작하는 줄 |
| `code` | 코드 블록 | ` ``` ` 로 감싸진 블록 |
| `image` | 이미지 | `![alt](src)` 패턴 |

**블록 ID 생성 규칙**:
```
block_id = `${block_type}-${order_index}`
예: "paragraph-0", "heading-1", "paragraph-2"
```

각 블록에는 `plain_text` 필드에 마크다운 문법이 제거된 순수 텍스트를 저장한다 (스크랩 offset 계산용).

### 2.6 아티클 상태 관리 (웹 어드민)

웹 어드민에서는 콘텐츠를 작성/편집하지 않는다.  
다음 기능만 제공한다:

| 기능 | 설명 |
|------|------|
| 발행 상태 토글 | published ↔ archived 전환 |
| 동기화 상태 확인 | 마지막 동기화 시간, 총 아티클 수, 에러 로그 |
| 아티클 목록 | 제목, 카테고리, 상태, 날짜 표시 |
| 리비전 히스토리 | 특정 아티클의 리비전 목록 확인 |

### 2.7 관리자 페이지 골격 (Phase 2 대비)

MVP에서는 라우팅과 레이아웃만 구성한다:

```
/admin
├── /admin/articles      ← 콘텐츠 상태 관리 (MVP 구현)
├── /admin/users         ← 사용자 목록 (MVP 구현)
├── /admin/subscriptions ← "Coming Soon" 플레이스홀더
└── /admin/payments      ← "Coming Soon" 플레이스홀더
```

> 구독 관리 및 유료 결제 기능은 Phase 2에서 구현 예정.  
> MVP에서는 네비게이션 항목과 플레이스홀더 UI만 배치하여 확장 기점을 마련한다.

## 3. 아티클 열람 (Article Reading)

### 3.1 아티클 목록

**경로**: `/articles`

**레이아웃**: Magazine B 스타일 카드 그리드

```
┌──────────────────────────────────────────┐
│ [TopNav]                                  │
├──────────────────────────────────────────┤
│                                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ 썸네일   │  │ 썸네일   │  │ 썸네일   │ │
│  │         │  │         │  │         │ │
│  ├─────────┤  ├─────────┤  ├─────────┤ │
│  │ 카테고리 │  │ 카테고리 │  │ 카테고리 │ │
│  │ 제목     │  │ 제목     │  │ 제목     │ │
│  │ 요약     │  │ 요약     │  │ 요약     │ │
│  │ 날짜     │  │ 날짜     │  │ 날짜     │ │
│  └─────────┘  └─────────┘  └─────────┘ │
│                                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │  ...     │  │  ...     │  │  ...     │ │
│  └─────────┘  └─────────┘  └─────────┘ │
│                                          │
│         [Load More / Pagination]         │
└──────────────────────────────────────────┘
```

**데이터 쿼리**:
```sql
SELECT a.slug, a.title, a.created_at,
       r.rendered_html  -- 요약 추출용
FROM admin_articles a
JOIN admin_article_revisions r ON r.id = a.published_revision_id
WHERE a.status = 'published'
ORDER BY a.created_at DESC
LIMIT 12 OFFSET ?;
```

**필터/정렬**:
- 카테고리 필터
- 태그 필터
- 최신순 / 인기순 정렬

### 3.2 아티클 상세

**경로**: `/articles/[slug]`

**레이아웃**:
```
┌──────────────────────────────────────────┐
│ [TopNav]                                  │
├──────────────────────────────────────────┤
│            ┌──────────────┐              │
│            │   카테고리    │              │
│            │              │              │
│            │  아티클 제목  │              │
│            │              │              │
│            │  작성자 · 날짜│              │
│            │              │              │
│            │  ───────────  │              │
│            │              │              │
│            │  본문 텍스트  │ ← 720px     │
│            │  ...         │              │
│            │              │              │
│            │  [선택 시     │              │
│            │   📝 소재로   │ ← 플로팅    │
│            │   추가]      │   버튼       │
│            │              │              │
│            └──────────────┘              │
└──────────────────────────────────────────┘
```

**렌더링**:
- `rendered_html`을 사용하여 서버 사이드 렌더링
- 블록별로 `data-block-id` 속성 부여 (스크랩 앵커링용)
- 코드 하이라이팅 적용 (선택: Shiki 또는 Prism)

---

## 4. 텍스트 스크랩 (Text Scrapping)

### 4.1 텍스트 선택 UX

**동작 흐름**:
1. 사용자가 아티클 본문에서 텍스트를 드래그하여 선택
2. `mouseup` / `touchend` 이벤트 감지
3. `window.getSelection()` API로 선택된 텍스트와 범위 추출
4. 선택 영역 근처에 플로팅 "📝 소재로 추가" 버튼 표시
5. 버튼 클릭 시 `ScrapModal` 열림

**Selection 데이터 추출**:
```typescript
interface SelectionData {
  // 원문 텍스트
  exactQuote: string;
  
  // 위치 정보
  sourceBlockId: string;       // data-block-id 속성에서 추출
  startOffset: number;         // 블록 내 시작 위치
  endOffset: number;           // 블록 내 끝 위치
  
  // 컨텍스트 (drift 감지용)
  prefix: string;              // 선택 앞 30자
  suffix: string;              // 선택 뒤 30자
  
  // 리비전 정보
  sourceRevisionId: string;    // 페이지 데이터에서 추출
  
  // W3C Text Fragment 호환 (선택)
  selector: {
    type: 'TextQuoteSelector';
    exact: string;
    prefix: string;
    suffix: string;
  };
}
```

**플로팅 버튼 위치 계산**:
```typescript
const rect = selection.getRangeAt(0).getBoundingClientRect();
const buttonTop = rect.top - BUTTON_HEIGHT - 8;  // 선택 영역 위
const buttonLeft = rect.left + (rect.width / 2) - (BUTTON_WIDTH / 2);  // 센터 정렬
```

### 4.2 스크랩 저장 모달 (ScrapModal)

**UI**:
```
┌──────────────────────────────┐
│  소재로 추가                  │  ✕
├──────────────────────────────┤
│                              │
│  "선택된 텍스트 미리보기..."  │
│                              │
│  ─────────────────────────── │
│                              │
│  컬렉션 선택:                │
│  ┌──────────────────────┐    │
│  │ 기본 수집함        ▼ │    │
│  └──────────────────────┘    │
│  + 새 컬렉션 만들기          │
│                              │
│  메모 (선택):                │
│  ┌──────────────────────┐    │
│  │                      │    │
│  │                      │    │
│  └──────────────────────┘    │
│                              │
│        [취소]  [저장하기]     │
└──────────────────────────────┘
```

**저장 프로세스**:
1. `scraps` 테이블에 INSERT
2. `collection_items` 테이블에 INSERT (선택된 컬렉션에 연결)
3. 토스트 알림: "소재가 저장되었습니다"
4. 모달 닫기

### 4.3 하이라이트 표시

- 로그인 사용자가 이전에 스크랩한 부분은 연노랑(#FEF9C3) 하이라이트로 표시
- 하이라이트 클릭 시 해당 스크랩 정보 팝오버 표시
- 스크랩 위치는 `source_block_id` + `start_offset` / `end_offset`으로 복원

---

## 5. 개인 프레스 (Personal Press)

### 5.1 대시보드

**경로**: `/dashboard`

**표시 정보**:
- 최근 스크랩 5개
- 내 컬렉션 요약 (개수, 최근 업데이트)
- 진행 중인 글쓰기 세션
- 내 프레스 최신 포스트

### 5.2 컬렉션 관리

**경로**: `/collections`

**기능**:
| 기능 | 설명 |
|------|------|
| 컬렉션 생성 | 제목 입력, 빈 컬렉션 생성 |
| 컬렉션 목록 | 카드 그리드, 소재 개수 표시 |
| 컬렉션 상세 | 소재 목록 + 메모, 드래그로 순서 변경 |
| 컬렉션 보관 | status = 'archived'로 변경 |
| 소재 이동 | 다른 컬렉션으로 이동 |
| 소재 삭제 | 컬렉션에서 제거 (scrap은 보존) |

**컬렉션 상세 레이아웃**:
```
┌────────────────────────────────────────────┐
│ [TopNav]                                    │
├────────────────────────────────────────────┤
│                                            │
│  컬렉션 제목                    [글쓰기 ▶] │
│  소재 N개 · 메모 N개                        │
│                                            │
│  ─────────────────────────────────────────  │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ 📝 "스크랩된 텍스트..."              │  │
│  │ 출처: 아티클 제목 · 2024.01.15       │  │
│  │ 메모: 사용자 메모 내용...             │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ 📝 "또 다른 스크랩..."              │  │
│  │ 출처: 다른 아티클 · 2024.01.14       │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ 📄 메모: 이 소재들의 공통 테마는...   │  │
│  └──────────────────────────────────────┘  │
│                                            │
└────────────────────────────────────────────┘
```

### 5.3 소재 메모 (Material Notes)

- 컬렉션 내에서 자유 메모 추가 가능
- 마크다운 형식 지원
- 소재들 사이에 삽입하여 맥락 정리
- 글쓰기 시 AI에게 추가 컨텍스트로 전달

---

## 6. 에이전틱 글쓰기 (Agentic Writing)

### 6.1 글쓰기 진입

**진입점**:
1. 컬렉션 상세 페이지 → "글쓰기" 버튼
2. 대시보드 → "새 글쓰기" 버튼 (컬렉션 선택 후 시작)

**글쓰기 세션 생성**:
```sql
INSERT INTO writing_sessions (user_id, collection_id, status)
VALUES (auth.uid(), :collection_id, 'drafting')
RETURNING id;
```

### 6.2 Step 1: 소재 분석 (Materials Analysis)

**경로**: `/write/[session-id]` (step=analysis)

**프로세스**:
1. 선택된 컬렉션의 스크랩 + 메모 로드
2. AI에게 소재 분석 요청

**AI Prompt (시스템)**:
```
당신은 콘텐츠 전략가입니다. 아래 소재들을 분석하여 다음을 추출하세요:
1. 핵심 주제 및 키워드
2. 소재 간 공통 테마
3. 흥미로운 관점이나 인사이트
4. 글쓰기에 활용할 수 있는 연결고리

소재 목록:
{scraps_and_notes}
```

**결과 저장**:
```sql
INSERT INTO writing_session_artifacts (session_id, artifact_type, content)
VALUES (:session_id, 'materials_analysis', :analysis_result);
```

**UI**:
```
┌──────────────────────────────────────┐
│  소재 분석 중...                      │
│  ████████████░░░░  75%               │
│                                      │
│  ─────────────────────────────────── │
│                                      │
│  📊 분석 결과                        │
│                                      │
│  핵심 주제:                          │
│  • 주제 1                            │
│  • 주제 2                            │
│                                      │
│  공통 테마:                          │
│  "분석된 테마 설명..."               │
│                                      │
│  인사이트:                           │
│  "발견된 인사이트..."                │
│                                      │
│              [다음: 주제 선택 →]      │
└──────────────────────────────────────┘
```

### 6.3 Step 2: 주제 제안 (Topic Suggestions)

**경로**: `/write/[session-id]` (step=topics)

**프로세스**:
1. 소재 분석 결과를 기반으로 3개 주제 제안
2. 사용자가 하나를 선택하거나 직접 입력

**AI Prompt**:
```
소재 분석 결과를 바탕으로 글 주제를 3개 제안하세요.
각 주제는 다음 형식으로 제시하세요:

1. 주제: [제목]
   방향: [어떤 각도에서 쓸 것인지]
   예상 독자: [누구를 위한 글인지]

소재 분석:
{materials_analysis}
```

**결과 저장**:
```sql
INSERT INTO writing_session_artifacts (session_id, artifact_type, content)
VALUES (:session_id, 'topic_suggestions', :suggestions);
```

**UI**:
```
┌──────────────────────────────────────┐
│  주제를 선택하세요                    │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ ○ 주제 1: 제목                 │  │
│  │   방향: 설명...                │  │
│  │   예상 독자: 설명...           │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ ● 주제 2: 제목                 │  │
│  │   방향: 설명...                │  │
│  │   예상 독자: 설명...           │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ ○ 주제 3: 제목                 │  │
│  │   방향: 설명...                │  │
│  │   예상 독자: 설명...           │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ ○ 직접 입력: [              ]  │  │
│  └────────────────────────────────┘  │
│                                      │
│     [← 이전]          [다음 →]       │
└──────────────────────────────────────┘
```

### 6.4 Step 3: 페르소나 선택 (Persona Selection)

**경로**: `/write/[session-id]` (step=persona)

**기본 제공 페르소나**:

| 페르소나 | 톤 | 설명 |
|----------|-----|------|
| 📰 저널리스트 | 객관적, 정보 전달형 | 사실 중심, 인용 적극 활용 |
| 📝 에세이스트 | 개인적, 성찰적 | 경험과 감상 중심 |
| 🔬 분석가 | 분석적, 논리적 | 데이터와 근거 중심 |
| 💡 큐레이터 | 편집자적, 추천형 | "이것이 좋은 이유" 중심 |
| 🎯 실용주의자 | 실용적, 가이드형 | "이렇게 하면 됩니다" 중심 |
| ✏️ 커스텀 | 사용자 정의 | 직접 톤과 스타일 설명 |

**세션 업데이트**:
```sql
UPDATE writing_sessions
SET persona = :selected_persona
WHERE id = :session_id AND user_id = auth.uid();
```

### 6.5 Step 4: 글 방향 설정 (Writing Direction)

**경로**: `/write/[session-id]` (step=direction)

**입력 필드**:
| 필드 | 필수 | 설명 |
|------|------|------|
| 글의 핵심 메시지 | ✅ | 이 글을 통해 전달하고 싶은 것 |
| 글 길이 | ✅ | 짧게(800자) / 중간(1500자) / 길게(3000자) |
| 강조할 소재 | ❌ | 특별히 부각하고 싶은 스크랩 선택 |
| 추가 지시사항 | ❌ | 자유 형식 추가 요청 |

**세션 업데이트**:
```sql
UPDATE writing_sessions
SET direction = :direction_json,
    model_provider = :provider,
    model_name = :model
WHERE id = :session_id AND user_id = auth.uid();
```

### 6.6 Step 5: 초안 생성 (Draft Generation)

**경로**: `/write/[session-id]` (step=draft)

**AI Prompt 구성**:
```
[시스템 프롬프트]
당신은 {persona}입니다. 아래 소재와 지시사항을 바탕으로 글을 작성하세요.

규칙:
1. 반드시 제공된 소재를 활용하여 글을 작성하세요.
2. 소재를 인용할 때는 [출처: 소재 번호] 형식으로 표시하세요.
3. 소재에 없는 내용을 임의로 추가하지 마세요.
4. 글의 길이는 약 {length}자로 작성하세요.

[소재]
{indexed_scraps_and_notes}

[소재 분석]
{materials_analysis}

[선택된 주제]
{selected_topic}

[글 방향]
핵심 메시지: {core_message}
강조 소재: {emphasized_scraps}
추가 지시: {additional_instructions}
```

**스트리밍 생성** (Vercel AI SDK):
```typescript
// Route Handler: /api/write/generate
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

export async function POST(req: Request) {
  const { sessionId, provider, model, messages } = await req.json();
  
  const providerInstance = provider === 'openai' 
    ? openai(model) 
    : anthropic(model);
  
  const result = streamText({
    model: providerInstance,
    messages,
    onFinish: async ({ text }) => {
      // 생성 결과 저장
      await supabase.from('writing_session_artifacts').insert({
        session_id: sessionId,
        artifact_type: 'draft',
        content: text,
      });
    },
  });
  
  return result.toDataStreamResponse();
}
```

**UI**:
```
┌──────────────────────────────────────┐
│  초안 생성 중...                      │
│                                      │
│  ┌────────────────────────────────┐  │
│  │                                │  │
│  │  AI가 생성하는 텍스트가         │  │
│  │  실시간으로 스트리밍됩니다...    │  │
│  │                                │  │
│  │  소재를 인용하면                │  │
│  │  [출처: 1] 형식으로             │  │
│  │  표시됩니다.                    │  │
│  │                                │  │
│  │  █ (커서)                      │  │
│  │                                │  │
│  └────────────────────────────────┘  │
│                                      │
│  [← 다시 생성]  [편집하기]  [발행 →] │
└──────────────────────────────────────┘
```

### 6.7 Step 6: 편집 및 발행

**편집**:
- 생성된 초안을 마크다운 textarea에서 직접 수정
- 출처 태그 `[출처: N]`는 발행 시 실제 링크로 변환

**발행 프로세스**:
1. 제목, 슬러그 입력
2. 공개 설정: published (공개) / unlisted (비공개 링크)
3. `user_posts` 테이블에 INSERT
4. `post_sources` 테이블에 출처 정보 INSERT
5. `writing_sessions.status = 'done'` 업데이트
6. 내 프레스 페이지로 리다이렉트

```sql
-- 포스트 발행
INSERT INTO user_posts (user_id, slug, title, markdown, status, published_at)
VALUES (auth.uid(), :slug, :title, :markdown, :status, NOW())
RETURNING id;

-- 출처 연결
INSERT INTO post_sources (post_id, scrap_id, usage)
SELECT :post_id, s.id, :usage_type
FROM scraps s
WHERE s.id = ANY(:scrap_ids) AND s.user_id = auth.uid();
```

---

## 7. 퍼블릭 프레스 (Public Press)

### 7.1 프레스 페이지

**경로**: `/press/[handle]`

**접근 조건**: `profiles.press_is_public = true`

**표시 정보**:
- 프로필: display_name, bio
- 발행된 포스트 목록 (카드 그리드)
- 포스트 개수

**레이아웃**:
```
┌──────────────────────────────────────┐
│ [TopNav]                              │
├──────────────────────────────────────┤
│                                      │
│  ┌──────────┐                        │
│  │ 프로필   │  Display Name          │
│  │ 아바타   │  @handle               │
│  └──────────┘  Bio 텍스트...          │
│                                      │
│  포스트 N개                           │
│  ─────────────────────────────────── │
│                                      │
│  ┌─────────┐  ┌─────────┐           │
│  │ 포스트 1 │  │ 포스트 2 │           │
│  │ 제목     │  │ 제목     │           │
│  │ 요약     │  │ 요약     │           │
│  │ 날짜     │  │ 날짜     │           │
│  └─────────┘  └─────────┘           │
│                                      │
└──────────────────────────────────────┘
```

### 7.2 포스트 상세

**경로**: `/press/[handle]/[slug]`

**표시**:
- 포스트 본문 (마크다운 → HTML)
- 출처 목록 (post_sources 기반)
- 작성자 정보
- 원문 아티클 링크 (출처가 admin_article인 경우)

---

## 8. 데이터 모델 상세 (SQL DDL)

### 8.1 profiles

```sql
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle      TEXT UNIQUE,
  display_name TEXT,
  bio         TEXT,
  avatar_url  TEXT,
  press_is_public BOOLEAN DEFAULT false,
  role        TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  ai_provider TEXT CHECK (ai_provider IN ('openai', 'anthropic')),
  ai_api_key_encrypted TEXT,  -- pgcrypto 암호화
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);
```

### 8.2 admin_articles

```sql
CREATE TABLE public.admin_articles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  TEXT UNIQUE NOT NULL,
  title                 TEXT NOT NULL,
  summary               TEXT,
  category              TEXT,
  tags                  TEXT[] DEFAULT '{}',
  thumbnail_url         TEXT,
  status                TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_revision_id UUID,  -- FK 아래에서 추가
  created_by            UUID REFERENCES public.profiles(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.admin_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published articles are viewable by everyone"
  ON public.admin_articles FOR SELECT
  USING (status = 'published');

CREATE POLICY "Admins can manage articles"
  ON public.admin_articles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### 8.3 admin_article_revisions

```sql
CREATE TABLE public.admin_article_revisions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id    UUID NOT NULL REFERENCES public.admin_articles(id) ON DELETE CASCADE,
  markdown      TEXT NOT NULL,
  content_hash  TEXT NOT NULL,  -- MD5/SHA256 of markdown
  rendered_html TEXT,           -- 캐시된 HTML
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- FK 추가
ALTER TABLE public.admin_articles
  ADD CONSTRAINT fk_published_revision
  FOREIGN KEY (published_revision_id)
  REFERENCES public.admin_article_revisions(id);

-- Index
CREATE INDEX idx_revisions_article ON public.admin_article_revisions(article_id);

-- RLS (articles 정책 따름)
ALTER TABLE public.admin_article_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Revisions follow article visibility"
  ON public.admin_article_revisions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_articles a
      WHERE a.id = article_id AND a.status = 'published'
    )
  );

CREATE POLICY "Admins can manage revisions"
  ON public.admin_article_revisions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### 8.4 admin_article_blocks

```sql
CREATE TABLE public.admin_article_blocks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id   UUID NOT NULL REFERENCES public.admin_article_revisions(id) ON DELETE CASCADE,
  block_id      TEXT NOT NULL,        -- "paragraph-0", "heading-1", etc.
  block_type    TEXT NOT NULL,        -- "heading", "paragraph", "list", etc.
  plain_text    TEXT NOT NULL,        -- 순수 텍스트 (offset 계산용)
  markdown_text TEXT,                 -- 원본 마크다운
  order_index   INTEGER NOT NULL,
  UNIQUE (revision_id, block_id)
);

-- Index
CREATE INDEX idx_blocks_revision ON public.admin_article_blocks(revision_id);

-- RLS (revisions 정책 따름)
ALTER TABLE public.admin_article_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Blocks follow revision visibility"
  ON public.admin_article_blocks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_article_revisions r
      JOIN public.admin_articles a ON a.id = r.article_id
      WHERE r.id = revision_id AND a.status = 'published'
    )
  );

CREATE POLICY "Admins can manage blocks"
  ON public.admin_article_blocks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### 8.5 scraps

```sql
CREATE TABLE public.scraps (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_revision_id  UUID NOT NULL REFERENCES public.admin_article_revisions(id),
  source_block_id     TEXT NOT NULL,
  start_offset        INTEGER NOT NULL,
  end_offset          INTEGER NOT NULL,
  exact_quote         TEXT NOT NULL,
  prefix              TEXT,           -- 앞 30자 컨텍스트
  suffix              TEXT,           -- 뒤 30자 컨텍스트
  user_note           TEXT,
  selector            JSONB,          -- W3C TextQuoteSelector 호환
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_scraps_user ON public.scraps(user_id);
CREATE INDEX idx_scraps_revision ON public.scraps(source_revision_id);

-- RLS
ALTER TABLE public.scraps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own scraps"
  ON public.scraps FOR ALL
  USING (auth.uid() = user_id);
```

### 8.6 collections

```sql
CREATE TABLE public.collections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_collections_user ON public.collections(user_id);

-- RLS
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own collections"
  ON public.collections FOR ALL
  USING (auth.uid() = user_id);
```

### 8.7 collection_items

```sql
CREATE TABLE public.collection_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  scrap_id      UUID NOT NULL REFERENCES public.scraps(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (collection_id, scrap_id)
);

-- Index
CREATE INDEX idx_collection_items_collection ON public.collection_items(collection_id);

-- RLS
ALTER TABLE public.collection_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own collection items"
  ON public.collection_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.collections c
      WHERE c.id = collection_id AND c.user_id = auth.uid()
    )
  );
```

### 8.8 material_notes

```sql
CREATE TABLE public.material_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id   UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content_markdown TEXT NOT NULL,
  position        INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_material_notes_collection ON public.material_notes(collection_id);

-- RLS
ALTER TABLE public.material_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own material notes"
  ON public.material_notes FOR ALL
  USING (auth.uid() = user_id);
```

### 8.9 writing_sessions

```sql
CREATE TABLE public.writing_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  collection_id   UUID REFERENCES public.collections(id),
  persona         TEXT,
  direction       JSONB,          -- {core_message, length, emphasized_scraps, additional}
  model_provider  TEXT CHECK (model_provider IN ('openai', 'anthropic')),
  model_name      TEXT,
  status          TEXT DEFAULT 'drafting' CHECK (status IN ('drafting', 'done', 'failed')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_writing_sessions_user ON public.writing_sessions(user_id);

-- RLS
ALTER TABLE public.writing_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own writing sessions"
  ON public.writing_sessions FOR ALL
  USING (auth.uid() = user_id);
```

### 8.10 writing_session_artifacts

```sql
CREATE TABLE public.writing_session_artifacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES public.writing_sessions(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN (
    'materials_analysis', 'topic_suggestions', 'outline', 'draft'
  )),
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_artifacts_session ON public.writing_session_artifacts(session_id);

-- RLS
ALTER TABLE public.writing_session_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own artifacts"
  ON public.writing_session_artifacts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.writing_sessions ws
      WHERE ws.id = session_id AND ws.user_id = auth.uid()
    )
  );
```

### 8.11 user_posts

```sql
CREATE TABLE public.user_posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slug          TEXT NOT NULL,
  title         TEXT NOT NULL,
  markdown      TEXT NOT NULL,
  rendered_html TEXT,
  status        TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'unlisted')),
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, slug)
);

-- Indexes
CREATE INDEX idx_user_posts_user ON public.user_posts(user_id);
CREATE INDEX idx_user_posts_status ON public.user_posts(status);

-- RLS
ALTER TABLE public.user_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published posts are viewable by everyone"
  ON public.user_posts FOR SELECT
  USING (
    status = 'published'
    OR (status = 'unlisted')  -- unlisted는 링크로 접근 가능
    OR auth.uid() = user_id   -- 본인은 모두 조회 가능
  );

CREATE POLICY "Users can manage own posts"
  ON public.user_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts"
  ON public.user_posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
  ON public.user_posts FOR DELETE
  USING (auth.uid() = user_id);
```

### 8.12 post_sources

```sql
CREATE TABLE public.post_sources (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id   UUID NOT NULL REFERENCES public.user_posts(id) ON DELETE CASCADE,
  scrap_id  UUID NOT NULL REFERENCES public.scraps(id),
  usage     TEXT DEFAULT 'inspiration' CHECK (usage IN ('inspiration', 'quoted', 'key_point')),
  UNIQUE (post_id, scrap_id)
);

-- Index
CREATE INDEX idx_post_sources_post ON public.post_sources(post_id);

-- RLS
ALTER TABLE public.post_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Post sources follow post visibility"
  ON public.post_sources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_posts p
      WHERE p.id = post_id AND (
        p.status IN ('published', 'unlisted')
        OR p.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage own post sources"
  ON public.post_sources FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_posts p
      WHERE p.id = post_id AND p.user_id = auth.uid()
    )
  );
```

---

## 9. API 설계

### 9.1 Next.js Route Handlers

모든 API는 Next.js App Router의 Route Handler로 구현한다.

#### 인증

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/auth/signup` | 회원가입 |
| POST | `/api/auth/login` | 로그인 |
| POST | `/api/auth/logout` | 로그아웃 |
| GET | `/api/auth/session` | 현재 세션 조회 |

#### 아티클 (Admin — 상태 관리만, 콘텐츠 작성 없음)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/admin/articles` | 아티클 목록 (전체 상태 포함) |
| PUT | `/api/admin/articles/[id]/status` | 상태 변경 (published ↔ archived) |
| GET | `/api/admin/articles/[id]/revisions` | 리비전 히스토리 |
| GET | `/api/admin/sync-status` | 콘텐츠 동기화 상태 (마지막 실행 시간, 에러 로그) |

> **Note**: 아티클 생성/수정/삭제는 옵시디언 + Git push로 처리.
> 빌드 시 `scripts/sync-content.ts`가 DB를 자동 동기화한다.

#### 관리자 (사용자/구독/결제)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/admin/users` | 사용자 목록 |
| PUT | `/api/admin/users/[id]/role` | 사용자 역할 변경 |
| GET | `/api/admin/subscriptions` | 구독 목록 (Phase 2) |
| GET | `/api/admin/payments` | 결제 내역 (Phase 2) |
#### 아티클 (Public)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/articles` | 발행된 아티클 목록 |
| GET | `/api/articles/[slug]` | 아티클 상세 |
| GET | `/api/articles/[slug]/blocks` | 아티클 블록 목록 (스크랩용) |

#### 스크랩

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/scraps` | 내 스크랩 목록 |
| POST | `/api/scraps` | 스크랩 생성 |
| DELETE | `/api/scraps/[id]` | 스크랩 삭제 |
| GET | `/api/scraps/by-article/[slug]` | 특정 아티클의 내 스크랩 |

#### 컬렉션

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/collections` | 내 컬렉션 목록 |
| POST | `/api/collections` | 컬렉션 생성 |
| PUT | `/api/collections/[id]` | 컬렉션 수정 |
| DELETE | `/api/collections/[id]` | 컬렉션 아카이브 |
| GET | `/api/collections/[id]/items` | 컬렉션 아이템 목록 |
| POST | `/api/collections/[id]/items` | 컬렉션에 아이템 추가 |
| PUT | `/api/collections/[id]/items/reorder` | 아이템 순서 변경 |
| DELETE | `/api/collections/[id]/items/[itemId]` | 아이템 제거 |

#### 소재 메모

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/collections/[id]/notes` | 메모 추가 |
| PUT | `/api/collections/[id]/notes/[noteId]` | 메모 수정 |
| DELETE | `/api/collections/[id]/notes/[noteId]` | 메모 삭제 |

#### 글쓰기

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/write/sessions` | 글쓰기 세션 생성 |
| GET | `/api/write/sessions/[id]` | 세션 상세 조회 |
| PUT | `/api/write/sessions/[id]` | 세션 업데이트 (페르소나, 방향 등) |
| POST | `/api/write/analyze` | 소재 분석 (AI) |
| POST | `/api/write/suggest-topics` | 주제 제안 (AI) |
| POST | `/api/write/generate` | 초안 생성 (AI 스트리밍) |

#### 사용자 포스트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/my-press/posts` | 내 포스트 목록 |
| POST | `/api/my-press/posts` | 포스트 발행 |
| PUT | `/api/my-press/posts/[id]` | 포스트 수정 |
| DELETE | `/api/my-press/posts/[id]` | 포스트 삭제 |

#### 퍼블릭 프레스

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/press/[handle]` | 프레스 프로필 + 포스트 목록 |
| GET | `/api/press/[handle]/[slug]` | 퍼블릭 포스트 상세 |

#### 설정

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/settings/profile` | 프로필 조회 |
| PUT | `/api/settings/profile` | 프로필 수정 |
| PUT | `/api/settings/ai` | AI Provider 설정 |

### 9.2 API 응답 형식

**성공**:
```json
{
  "data": { ... },
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 12
  }
}
```

**에러**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "핸들은 3-30자의 영소문자, 숫자, 하이픈만 사용할 수 있습니다.",
    "details": { ... }
  }
}
```

### 9.3 에러 코드

| 코드 | HTTP Status | 설명 |
|------|-------------|------|
| `UNAUTHORIZED` | 401 | 인증 필요 |
| `FORBIDDEN` | 403 | 권한 없음 |
| `NOT_FOUND` | 404 | 리소스 없음 |
| `VALIDATION_ERROR` | 400 | 입력 검증 실패 |
| `CONFLICT` | 409 | 중복 (slug, handle 등) |
| `AI_PROVIDER_ERROR` | 502 | AI Provider 호출 실패 |
| `RATE_LIMITED` | 429 | 요청 제한 초과 |
| `INTERNAL_ERROR` | 500 | 서버 내부 오류 |

---

## 10. 비기능 요구사항

### 10.1 성능

| 항목 | 목표 |
|------|------|
| 페이지 로드 (FCP) | < 1.5초 |
| 아티클 렌더링 (LCP) | < 2.5초 |
| 스크랩 저장 응답 | < 500ms |
| AI 스트리밍 첫 토큰 | < 2초 |
| Lighthouse Score | > 90 |

### 10.2 보안

| 항목 | 구현 |
|------|------|
| 인증 | Supabase Auth (JWT, httpOnly 쿠키) |
| 인가 | PostgreSQL RLS (모든 테이블) |
| API Key 저장 | pgcrypto 암호화 |
| XSS 방지 | HTML 새니타이즈 (DOMPurify) |
| CSRF | Supabase 내장 보호 |
| Rate Limiting | Vercel Edge / Supabase rate limit |

### 10.3 접근성

| 항목 | 구현 |
|------|------|
| 키보드 네비게이션 | 모든 인터랙티브 요소 Tab 접근 |
| 시맨틱 HTML | article, nav, main, section, aside |
| ARIA 레이블 | 아이콘 버튼, 모달, 토스트에 필수 |
| 색상 대비 | WCAG AA 준수 (4.5:1 이상) |
| 스크린 리더 | 의미있는 alt 텍스트, 상태 알림 |

### 10.4 반응형 디자인

| 뷰포트 | 레이아웃 |
|---------|----------|
| < 640px (모바일) | 1컬럼, 햄버거 메뉴, 풀 너비 카드 |
| 640-1024px (태블릿) | 2컬럼 그리드, 축소된 네비게이션 |
| > 1024px (데스크톱) | 3컬럼 그리드, 전체 네비게이션 |

### 10.5 에러 핸들링

| 레이어 | 전략 |
|--------|------|
| API Route | try/catch + NextResponse.json (에러 코드) |
| Client Fetch | React Error Boundary + Toast 알림 |
| AI 생성 | 스트림 에러 감지 → 재시도 버튼 제공 |
| DB 접근 | Supabase 에러 → 사용자 친화적 메시지 변환 |
| 네트워크 | 오프라인 감지 → "네트워크 연결을 확인해주세요" |

### 10.6 SEO

| 항목 | 구현 |
|------|------|
| 메타 태그 | Next.js Metadata API (타이틀, 설명, OG) |
| Open Graph | 아티클별 OG 이미지, 제목, 설명 |
| Sitemap | 자동 생성 (`/sitemap.xml`) |
| 구조화 데이터 | Article schema (JSON-LD) |
| SSR | 아티클, 프레스 페이지 서버 사이드 렌더링 |

---

## 부록: 마이그레이션 실행 순서

```sql
-- 실행 순서 (FK 의존성 순)
-- 1. profiles (auth.users 의존)
-- 2. admin_articles
-- 3. admin_article_revisions (admin_articles 의존)
-- 4. admin_articles FK 추가 (published_revision_id)
-- 5. admin_article_blocks (admin_article_revisions 의존)
-- 6. scraps (profiles, admin_article_revisions 의존)
-- 7. collections (profiles 의존)
-- 8. collection_items (collections, scraps 의존)
-- 9. material_notes (collections, profiles 의존)
-- 10. writing_sessions (profiles, collections 의존)
-- 11. writing_session_artifacts (writing_sessions 의존)
-- 12. user_posts (profiles 의존)
-- 13. post_sources (user_posts, scraps 의존)
-- 14. Triggers (handle_new_user)
-- 15. RLS policies (모든 테이블)
```

## 부록 B: 콘텐츠 동기화 설정

### package.json 스크립트

```json
{
  "scripts": {
    "sync-content": "tsx scripts/sync-content.ts",
    "prebuild": "npm run sync-content",
    "build": "next build",
    "dev": "next dev --turbopack"
  }
}
```

`prebuild` 훅으로 `next build` 전에 자동 동기화.

### 환경 변수

```bash
# .env.local (로컬 개발)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # 동기화 전용

# Vercel 환경 변수 (배포)
SUPABASE_SERVICE_ROLE_KEY=...  # Vercel 대시보드에서 설정
```

> **보안**: `SUPABASE_SERVICE_ROLE_KEY`는 서버 사이드(빌드 스크립트)에서만 사용.  
> `NEXT_PUBLIC_` 접두어를 붙이지 않아 클라이언트에 노출되지 않는다.
