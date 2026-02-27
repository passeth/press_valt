export default function AdminDashboard() {
  const stats = [
    { label: "총 아티클", value: "–" },
    { label: "총 사용자", value: "–" },
    { label: "활성 구독", value: "–" },
    { label: "월 수익", value: "–" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-8">대시보드</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[var(--section-gap)]">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="border border-border rounded-sm p-[var(--section-padding)] bg-white"
          >
            <p className="text-sm text-text-secondary mb-2">{stat.label}</p>
            <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Recent Activity Placeholder */}
      <div className="mt-12">
        <h2 className="text-lg font-semibold mb-6">최근 활동</h2>
        <div className="border border-border rounded-sm p-8 bg-surface text-center">
          <p className="text-text-secondary">데이터를 불러오는 중...</p>
        </div>
      </div>
    </div>
  );
}
