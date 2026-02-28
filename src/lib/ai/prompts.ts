/**
 * Press Vault — AI Prompt Templates
 * Used in the agentic writing pipeline.
 */

export const PROMPTS = {
  /**
   * Step 1: Analyze collected materials (scraps + notes)
   */
  materialsAnalysis: (materials: string) => `당신은 콘텐츠 전략가입니다. 아래 소재들을 분석하여 다음을 추출하세요:

1. 핵심 주제 및 키워드
2. 소재 간 공통 테마
3. 흥미로운 관점이나 인사이트
4. 글쓰기에 활용할 수 있는 연결고리

분석 결과를 한국어로 작성하세요.

소재 목록:
${materials}`,

  /**
   * Step 2: Suggest 3 topics based on analysis
   */
  topicSuggestions: (analysis: string) => `소재 분석 결과를 바탕으로 글 주제를 3개 제안하세요.
각 주제는 다음 형식으로 제시하세요:

1. 주제: [제목]
   방향: [어떤 각도에서 쓸 것인지]
   예상 독자: [누구를 위한 글인지]

한국어로 작성하세요.

소재 분석:
${analysis}`,

  /**
   * Step 5: Generate draft with citations
   */
  draftGeneration: (params: {
    persona: string;
    materials: string;
    analysis: string;
    topic: string;
    coreMessage: string;
    length: string;
    emphasizedScraps: string;
    additionalInstructions: string;
  }) => `당신은 ${params.persona}입니다. 아래 소재와 지시사항을 바탕으로 글을 작성하세요.

규칙:
1. 반드시 제공된 소재를 활용하여 글을 작성하세요.
2. 소재의 출처를 별도로 표시하지 마세요. [출처: 소재 N] 같은 태그를 절대 포함하지 마세요.
3. 소재에 없는 내용을 임의로 추가하지 마세요.
4. 글의 길이는 약 ${params.length}자로 작성하세요.
5. 한국어로 작성하세요.

[소재]
${params.materials}

[소재 분석]
${params.analysis}

[선택된 주제]
${params.topic}

 [글 방향]
핵심 메시지: ${params.coreMessage}
강조 소재: ${params.emphasizedScraps}
추가 지시: ${params.additionalInstructions}`,

  seoKeywordExtraction: (analysisText: string) => `당신은 SEO 전문가입니다. 아래 콘텐츠 분석 결과를 읽고, 이 글의 핵심 주제에 대해 Google 검색에서 가장 효과적인 SEO 검색 키워드를 하나만 추출하세요.

규칙:
1. 키워드만 응답하세요. 설명이나 부가 텍스트 없이 키워드 하나만 출력하세요.
2. 2~4 단어의 검색어로 작성하세요.
3. 실제 사용자가 Google에서 검색할 법한 자연스러운 표현을 사용하세요.
4. 분석 내용의 언어와 동일한 언어로 작성하세요.

[콘텐츠 분석]
${analysisText}`,

  imagePromptSuggestions: (draft: string, style: string) => `당신은 비주얼 디렉터입니다. 아래 글의 내용과 분위기를 분석하여, "${style}" 스타일에 맞는 이미지 생성 프롬프트를 정확히 3개 제안하세요.

규칙:
1. 각 프롬프트는 영어로 작성하세요 (이미지 생성 AI가 영어를 더 잘 이해합니다).
2. 각 프롬프트는 구체적이고 시각적으로 묘사적이어야 합니다.
3. 글의 핵심 메시지와 감정을 시각적으로 표현하세요.
4. 다음 형식으로 정확히 3개를 제시하세요:

PROMPT_1: [영어 프롬프트]
PROMPT_2: [영어 프롬프트]
PROMPT_3: [영어 프롬프트]

[글 내용]
${draft}

[이미지 스타일]
${style}`,
} as const;

/**
 * Available writing personas
 */
export const PERSONAS = [
  {
    id: "journalist",
    name: "📰 저널리스트",
    tone: "객관적, 정보 전달형",
    description: "사실 중심, 인용 적극 활용",
  },
  {
    id: "essayist",
    name: "📝 에세이스트",
    tone: "개인적, 성찰적",
    description: "경험과 감상 중심",
  },
  {
    id: "analyst",
    name: "🔬 분석가",
    tone: "분석적, 논리적",
    description: "데이터와 근거 중심",
  },
  {
    id: "curator",
    name: "💡 큐레이터",
    tone: "편집자적, 추천형",
    description: '"이것이 좋은 이유" 중심',
  },
  {
    id: "pragmatist",
    name: "🎯 실용주의자",
    tone: "실용적, 가이드형",
    description: '"이렇게 하면 됩니다" 중심',
  },
] as const;

export type PersonaId = (typeof PERSONAS)[number]["id"];

/**
 * Writing length options
 */
export const WRITING_LENGTHS = [
  { id: "short", label: "짧게", chars: "800자" },
  { id: "medium", label: "중간", chars: "1500자" },
  { id: "long", label: "길게", chars: "3000자" },
] as const;

export type WritingLengthId = (typeof WRITING_LENGTHS)[number]["id"];
