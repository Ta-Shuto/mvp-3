"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";

const roleLabels: Record<string, string> = {
  ADMIN: "管理者",
  INTERVIEWER: "担当者",
  INTERVIEWEE: "閲覧者",
  OPERATOR: "運用者",
};

const roleBadgeColors: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  INTERVIEWER: "bg-blue-100 text-blue-700",
  INTERVIEWEE: "bg-gray-100 text-gray-700",
  OPERATOR: "bg-green-100 text-green-700",
};

const roleInitials: Record<string, string> = {
  ADMIN: "管",
  INTERVIEWER: "担",
  INTERVIEWEE: "閲",
  OPERATOR: "運",
};

export default function UsersPage() {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.user.list.useQuery();

  const inviteMutation = trpc.user.invite.useMutation({
    onSuccess: () => {
      utils.user.list.invalidate();
      setShowInviteModal(false);
    },
  });

  const updateMutation = trpc.user.update.useMutation({
    onSuccess: () => {
      utils.user.list.invalidate();
      setEditingUser(null);
    },
  });

  const deleteMutation = trpc.user.delete.useMutation({
    onSuccess: () => utils.user.list.invalidate(),
  });

  const handleDelete = (user: any) => {
    if (!confirm(`${user.name} を削除しますか？この操作は取り消せません。`)) return;
    deleteMutation.mutate({ id: user.id });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">ユーザー管理</h1>
          <p className="text-base text-muted-foreground mt-1">
            テナント内のユーザー一覧・招待・権限管理
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="px-4 py-2 btn-glass-primary rounded-xl text-base font-medium hover:opacity-90 transition-opacity"
        >
          + ユーザーを招待
        </button>
      </div>

      {/* ユーザー一覧テーブル */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-base">
          <thead>
            <tr className="border-b border-border glass-thead">
              <th className="text-left p-3 font-medium text-muted-foreground">名前</th>
              <th className="text-left p-3 font-medium text-muted-foreground">メール</th>
              <th className="text-left p-3 font-medium text-muted-foreground">部署</th>
              <th className="text-left p-3 font-medium text-muted-foreground">ロール</th>
              <th className="text-right p-3 font-medium text-muted-foreground">担当案件</th>
              <th className="text-right p-3 font-medium text-muted-foreground">面談数</th>
              <th className="text-left p-3 font-medium text-muted-foreground">登録日</th>
              <th className="text-right p-3 font-medium text-muted-foreground">操作</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((user: any) => (
              <tr key={user.id} className="border-b border-border hover:bg-white/30">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 text-white text-sm font-medium">
                      {roleInitials[user.role] ?? "?"}
                    </span>
                    <span className="font-medium text-foreground">{user.name}</span>
                  </div>
                </td>
                <td className="p-3 text-muted-foreground">{user.email}</td>
                <td className="p-3 text-muted-foreground">{user.department ?? "—"}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-sm font-medium ${roleBadgeColors[user.role] ?? "bg-gray-100 text-gray-700"}`}>
                    {roleLabels[user.role] ?? user.role}
                  </span>
                </td>
                <td className="p-3 text-right">{user.caseCount}</td>
                <td className="p-3 text-right">{user.meetingCount}</td>
                <td className="p-3 text-muted-foreground">
                  {new Date(user.createdAt).toLocaleDateString("ja-JP")}
                </td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditingUser(user)}
                      className="text-sm text-primary hover:underline"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(user)}
                      disabled={deleteMutation.isPending}
                      className="text-sm text-destructive hover:underline disabled:opacity-50"
                    >
                      削除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users?.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  ユーザーが登録されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {isLoading && (
          <p className="p-4 text-muted-foreground">読み込み中...</p>
        )}
      </div>

      <p className="text-sm text-muted-foreground text-right">
        {users?.length ?? 0}件表示
      </p>

      {/* 招待モーダル */}
      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onSubmit={(data) => inviteMutation.mutate(data)}
          isLoading={inviteMutation.isPending}
          error={inviteMutation.error?.message}
        />
      )}

      {/* 編集モーダル */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSubmit={(data) => updateMutation.mutate(data)}
          isLoading={updateMutation.isPending}
          error={updateMutation.error?.message}
        />
      )}
    </div>
  );
}

function InviteModal({
  onClose,
  onSubmit,
  isLoading,
  error,
}: {
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    email: string;
    password: string;
    department?: string;
    role: "ADMIN" | "INTERVIEWER" | "INTERVIEWEE" | "OPERATOR";
  }) => void;
  isLoading: boolean;
  error?: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState<"ADMIN" | "INTERVIEWER" | "INTERVIEWEE" | "OPERATOR">("INTERVIEWER");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      email,
      password,
      department: department || undefined,
      role,
    });
  };

  const roleOptions = [
    { value: "ADMIN" as const, label: "管理者" },
    { value: "INTERVIEWER" as const, label: "担当者" },
    { value: "INTERVIEWEE" as const, label: "閲覧者" },
  ];

  return (
    <div className="fixed inset-0 glass-overlay flex items-center justify-center z-50">
      <div className="glass-modal rounded-2xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold">新規ユーザー招待</h2>
          <button
            onClick={onClose}
            className="text-base text-primary hover:underline"
          >
            閉じる
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-base font-medium mb-1">
                名前 <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="山田 太郎"
                required
                className="w-full px-3 py-2 border border-border rounded-lg text-base bg-background"
              />
            </div>
            <div>
              <label className="block text-base font-medium mb-1">
                メール <span className="text-destructive">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                required
                className="w-full px-3 py-2 border border-border rounded-lg text-base bg-background"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-base font-medium mb-1">
                初期パスワード <span className="text-destructive">*</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 border border-border rounded-lg text-base bg-background"
              />
            </div>
            <div>
              <label className="block text-base font-medium mb-1">部署</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="コンプライアンス部"
                className="w-full px-3 py-2 border border-border rounded-lg text-base bg-background"
              />
            </div>
          </div>

          <div>
            <label className="block text-base font-medium mb-2">ロール</label>
            <div className="flex gap-2">
              {roleOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  className={`flex-1 px-4 py-2 rounded-lg border text-base font-medium transition-colors ${
                    role === opt.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-base text-destructive">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border rounded-xl text-base bg-white/30 hover:bg-accent transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isLoading || !name || !email || !password}
              className="flex-1 px-4 py-2 btn-glass-primary rounded-xl text-base font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isLoading ? "招待中..." : "招待する"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditUserModal({
  user,
  onClose,
  onSubmit,
  isLoading,
  error,
}: {
  user: any;
  onClose: () => void;
  onSubmit: (data: { id: string; name?: string; department?: string; role?: "ADMIN" | "INTERVIEWER" | "INTERVIEWEE" | "OPERATOR" }) => void;
  isLoading: boolean;
  error?: string;
}) {
  const [name, setName] = useState(user.name);
  const [department, setDepartment] = useState(user.department ?? "");
  const [role, setRole] = useState<"ADMIN" | "INTERVIEWER" | "INTERVIEWEE" | "OPERATOR">(user.role);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      id: user.id,
      name: name !== user.name ? name : undefined,
      department: department !== (user.department ?? "") ? (department || undefined) : undefined,
      role: role !== user.role ? role : undefined,
    });
  };

  const roleOptions = [
    { value: "ADMIN" as const, label: "管理者" },
    { value: "INTERVIEWER" as const, label: "担当者" },
    { value: "INTERVIEWEE" as const, label: "閲覧者" },
  ];

  return (
    <div className="fixed inset-0 glass-overlay flex items-center justify-center z-50">
      <div className="glass-modal rounded-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold">ユーザー編集</h2>
          <button onClick={onClose} className="text-base text-primary hover:underline">閉じる</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-base font-medium mb-1">名前</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-border rounded-lg text-base bg-background"
            />
          </div>

          <div>
            <label className="block text-base font-medium mb-1">メール（変更不可）</label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full px-3 py-2 border border-border rounded-lg text-base bg-muted opacity-60"
            />
          </div>

          <div>
            <label className="block text-base font-medium mb-1">部署</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-base bg-background"
            />
          </div>

          <div>
            <label className="block text-base font-medium mb-2">ロール</label>
            <div className="flex gap-2">
              {roleOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  className={`flex-1 px-3 py-2 rounded-lg border text-base font-medium transition-colors ${
                    role === opt.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-base text-destructive">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border rounded-xl text-base bg-white/30 hover:bg-accent"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 btn-glass-primary rounded-xl text-base font-medium hover:opacity-90 disabled:opacity-50"
            >
              {isLoading ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
