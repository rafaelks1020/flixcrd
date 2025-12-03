"use client";

import { useEffect, useState } from "react";

type UserRole = "USER" | "ADMIN";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

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
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">Usuários</h3>
          {loading && <span className="text-[10px] text-zinc-500">Carregando...</span>}
        </div>

        {users.length === 0 && !loading ? (
          <p className="text-zinc-500 text-xs">
            Nenhum usuário encontrado. Verifique se o seed foi executado no banco de produção.
          </p>
        ) : (
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

                  return (
                    <tr key={u.id} className="align-middle text-[11px]">
                      <td className="px-3 py-2 font-mono text-[11px] text-zinc-100">
                        {u.email}
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
                        {isSaving && (
                          <span className="text-[10px] text-zinc-500">
                            Salvando...
                          </span>
                        )}
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
  );
}
