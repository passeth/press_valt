export default function AdminArticles() {
  const articles = [
    {
      id: "1",
      title: "테스트 아티클 1",
      category: "테크",
      status: "발행",
      date: "2026-02-26",
    },
    {
      id: "2",
      title: "테스트 아티클 2",
      category: "디자인",
      status: "작성 중",
      date: "2026-02-25",
    },
    {
      id: "3",
      title: "테스트 아티클 3",
      category: "비즈니스",
      status: "발행",
      date: "2026-02-24",
    },
    {
      id: "4",
      title: "테스트 아티클 4",
      category: "라이프스타일",
      status: "임시저장",
      date: "2026-02-23",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-8">아티클 관리</h1>

      {/* Table */}
      <div className="border border-border rounded-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="px-6 py-4 text-left font-semibold">제목</th>
              <th className="px-6 py-4 text-left font-semibold">카테고리</th>
              <th className="px-6 py-4 text-left font-semibold">상태</th>
              <th className="px-6 py-4 text-left font-semibold">날짜</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((article) => (
              <tr
                key={article.id}
                className="border-b border-border hover:bg-surface transition-colors"
              >
                <td className="px-6 py-4 font-medium text-text-primary">
                  {article.title}
                </td>
                <td className="px-6 py-4 text-text-secondary">{article.category}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-sm text-xs font-medium bg-border text-text-secondary">
                    {article.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-text-secondary text-xs">
                  {article.date}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
