"use client";

import { useEffect, useState } from "react";

type UserRole = "USER" | "ADMIN";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role: UserRole;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("USER");
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("USER");
  const [editAvatar, setEditAvatar] = useState<string | null>(null);

  const avatarOptions = [
    "red",
    "orange",
    "yellow",
    "green",
    "cyan",
    "blue",
    "purple",
    "pink",
  ];

  async function loadUsers() {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao carregar usuários");
      }
      setUsers(data as AdminUser[]);
    } catch (err: any) {
      setError(err.message ?? "Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleChangeRole(id: string, role: UserRole) {
    setSavingId(id);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao atualizar usuário");
      }
      setUsers((prev) => prev.map((u) => (u.id === id ? (data as AdminUser) : u)));
      setInfo("Usuário atualizado com sucesso.");
    } catch (err: any) {
      setError(err.message ?? "Erro ao atualizar usuário");
    } finally {
      setSavingId(null);
    }
  }

  async function handleCreateUser(event: any) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newUserEmail.trim(),
          name: newUserName.trim() || null,
          password: newUserPassword,
          role: newUserRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao criar usuário");
      }
      setUsers((prev) => [data as AdminUser, ...prev]);
      setNewUserEmail("");
      setNewUserName("");
      setNewUserPassword("");
      setNewUserRole("USER");
      setInfo("Usuário criado com sucesso.");
    } catch (err: any) {
      setError(err.message ?? "Erro ao criar usuário");
    } finally {
      setCreating(false);
    }
  }

  async function handleChangePassword(id: string, email: string) {
    // eslint-disable-next-line no-alert
    const newPassword = window.prompt(`Nova senha para ${email}:`);
    if (!newPassword) return;
    if (newPassword.length < 6) {
      // eslint-disable-next-line no-alert
      window.alert("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setSavingId(id);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao alterar senha");
      }
      setInfo("Senha atualizada com sucesso.");
    } catch (err: any) {
      setError(err.message ?? "Erro ao alterar senha");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDeleteUser(id: string, email: string) {
    // eslint-disable-next-line no-alert
    const confirmed = window.confirm(`Excluir usuário ${email}? Esta ação não pode ser desfeita.`);
    if (!confirmed) return;

    setDeletingId(id);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao excluir usuário");
      }
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setInfo("Usuário excluído com sucesso.");
    } catch (err: any) {
      setError(err.message ?? "Erro ao excluir usuário");
    } finally {
      setDeletingId(null);
    }
  }

  function openEditModal(user: AdminUser) {
    setEditingUser(user);
    setEditName(user.name || "");
    setEditRole(user.role);
    setEditAvatar(user.avatar);
    setError(null);
    setInfo(null);
  }

  async function handleSaveEdit(event: any) {
    event.preventDefault();
    if (!editingUser) return;

    const id = editingUser.id;
    setSavingId(id);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name: editName.trim() || null,
          role: editRole,
          avatar: editAvatar,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao editar usuário");
      }
      setUsers((prev) => prev.map((u) => (u.id === id ? (data as AdminUser) : u)));
      setInfo("Usuário atualizado com sucesso.");
      setEditingUser(null);
    } catch (err: any) {
      setError(err.message ?? "Erro ao editar usuário");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Usuários e permissões</h2>
        <p className="text-sm text-zinc-400">
          Gerencie quem pode acessar o painel admin e acompanhe as contas cadastradas.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}
      {info && !error && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {info}
        </div>
      )}

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 text-xs">
        <div className="mb-4">
          <h3 className="mb-2 text-sm font-semibold text-zinc-100">Criar novo usuário</h3>
          <form onSubmit={handleCreateUser} className="grid grid-cols-1 gap-2 md:grid-cols-4 md:items-end">
            <div className="space-y-1">
              <label className="block text-[11px] text-zinc-300">Email</label>
              <input
                type="email"
                required
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-50 outline-none focus:border-zinc-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] text-zinc-300">Nome</label>
              <input
                type="text"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-50 outline-none focus:border-zinc-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] text-zinc-300">Senha inicial</label>
              <input
                type="password"
                required
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-50 outline-none focus:border-zinc-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] text-zinc-300">Role</label>
              <div className="flex gap-2">
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-50 outline-none focus:border-zinc-500"
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
                <button
                  type="submit"
                  disabled={creating}
                  className="whitespace-nowrap rounded-md bg-zinc-100 px-3 py-1 text-[11px] font-semibold text-zinc-900 hover:bg-white disabled:opacity-60"
                >
                  {creating ? "Criando..." : "Criar"}
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 text-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-100">Usuários cadastrados</h3>
            <div className="flex items-center gap-2">
              {loading && <span className="text-[10px] text-zinc-500">Carregando...</span>}
              <input
                type="text"
                placeholder="🔍 Buscar usuário..."
                className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>
          {!loading && users.length === 0 && (
            <p className="text-center text-xs text-zinc-500 py-8">
              Nenhum usuário encontrado.
            </p>
          )}
          {!loading && users.length > 0 && (
          <div className="max-h-[480px] overflow-y-auto rounded-md border border-zinc-800">
            <table className="w-full border-collapse text-left">
              <thead className="bg-zinc-900 text-[11px] uppercase text-zinc-400">
                <tr>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Criado em</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 bg-zinc-950">
                {users.map((u) => {
                  const created = new Date(u.createdAt).toLocaleString();
                  const isSaving = savingId === u.id;
                  const isDeleting = deletingId === u.id;

                  return (
                    <tr key={u.id} className="align-middle text-[11px]">
                      <td className="px-3 py-2 text-zinc-100">
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-zinc-900 ${
                              u.avatar === "red"
                                ? "bg-red-500"
                                : u.avatar === "orange"
                                  ? "bg-orange-500"
                                  : u.avatar === "yellow"
                                    ? "bg-yellow-400"
                                    : u.avatar === "green"
                                      ? "bg-emerald-500"
                                      : u.avatar === "cyan"
                                        ? "bg-cyan-400"
                                        : u.avatar === "blue"
                                          ? "bg-sky-500"
                                          : u.avatar === "purple"
                                            ? "bg-violet-500"
                                            : u.avatar === "pink"
                                              ? "bg-pink-500"
                                              : "bg-zinc-400"
                            }`}
                          >
                            {(u.name || u.email || "?").charAt(0).toUpperCase()}
                          </div>
                          <span className="font-mono text-[11px]">{u.email}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-zinc-300">{u.name || "-"}</td>
                      <td className="px-3 py-2 text-zinc-400">{created}</td>
                      <td className="px-3 py-2">
                        <select
                          value={u.role}
                          onChange={(e) =>
                            handleChangeRole(u.id, e.target.value as UserRole)
                          }
                          disabled={isSaving}
                          className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-50 outline-none focus:border-zinc-500"
                        >
                          <option value="USER">USER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(u)}
                            disabled={isSaving || isDeleting}
                            className="rounded-md border border-zinc-700 px-2 py-1 text-[10px] text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleChangePassword(u.id, u.email)}
                            disabled={isSaving || isDeleting}
                            className="rounded-md border border-zinc-700 px-2 py-1 text-[10px] text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                          >
                            Alterar senha
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u.id, u.email)}
                            disabled={isSaving || isDeleting}
                            className="rounded-md border border-red-700 px-2 py-1 text-[10px] text-red-200 hover:bg-red-900/40 disabled:opacity-50"
                          >
                            Excluir
                          </button>
                          {(isSaving || isDeleting) && (
                            <span className="text-[10px] text-zinc-500">
                              {isDeleting ? "Excluindo..." : "Salvando..."}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs shadow-2xl">
            <h3 className="mb-3 text-sm font-semibold text-zinc-100">
              Editar usuário
            </h3>
            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-[11px] text-zinc-300">Email</label>
                <div className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-[11px] text-zinc-400">
                  {editingUser.email}
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] text-zinc-300">Nome</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-50 outline-none focus:border-zinc-500"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] text-zinc-300">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-50 outline-none focus:border-zinc-500"
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] text-zinc-300">Avatar</label>
                <div className="flex flex-wrap gap-2">
                  {avatarOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setEditAvatar(opt)}
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-zinc-900 ring-2 ring-offset-2 ring-offset-zinc-950 ${
                        opt === "red"
                          ? "bg-red-500"
                          : opt === "orange"
                            ? "bg-orange-500"
                            : opt === "yellow"
                              ? "bg-yellow-400"
                              : opt === "green"
                                ? "bg-emerald-500"
                                : opt === "cyan"
                                  ? "bg-cyan-400"
                                  : opt === "blue"
                                    ? "bg-sky-500"
                                    : opt === "purple"
                                      ? "bg-violet-500"
                                      : "bg-pink-500"
                      } ${editAvatar === opt ? "ring-zinc-50" : "ring-transparent"}`}
                    >
                      {(editingUser.name || editingUser.email || "?").charAt(0).toUpperCase()}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setEditAvatar(null)}
                    className={`flex h-8 items-center justify-center rounded-full border px-2 text-[10px] ${
                      editAvatar === null
                        ? "border-zinc-200 text-zinc-50"
                        : "border-zinc-600 text-zinc-300"
                    }`}
                  >
                    Sem avatar
                  </button>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="rounded-md border border-zinc-700 px-3 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingId === editingUser.id}
                  className="rounded-md bg-zinc-100 px-3 py-1 text-[11px] font-semibold text-zinc-900 hover:bg-white disabled:opacity-60"
                >
                  {savingId === editingUser.id ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
