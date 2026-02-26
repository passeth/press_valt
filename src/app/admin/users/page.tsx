export default function AdminUsers() {
  const users = [
    {
      id: "1",
      handle: "user-one",
      email: "user1@example.com",
      role: "구독자",
      joinedDate: "2026-01-15",
    },
    {
      id: "2",
      handle: "user-two",
      email: "user2@example.com",
      role: "크리에이터",
      joinedDate: "2026-02-01",
    },
    {
      id: "3",
      handle: "user-three",
      email: "user3@example.com",
      role: "구독자",
      joinedDate: "2026-02-20",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-8">사용자 관리</h1>

      {/* Table */}
      <div className="border border-border rounded-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="px-6 py-4 text-left font-semibold">핸들</th>
              <th className="px-6 py-4 text-left font-semibold">이메일</th>
              <th className="px-6 py-4 text-left font-semibold">역할</th>
              <th className="px-6 py-4 text-left font-semibold">가입일</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                className="border-b border-border hover:bg-surface transition-colors"
              >
                <td className="px-6 py-4 font-medium text-text-primary">
                  {user.handle}
                </td>
                <td className="px-6 py-4 text-text-secondary text-xs">
                  {user.email}
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-sm text-xs font-medium bg-border text-text-secondary">
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-text-secondary text-xs">
                  {user.joinedDate}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
