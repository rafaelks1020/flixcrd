"use client";

import { useEffect, useState } from "react";
import {
  Users,
  UserPlus,
  Mail,
  User,
  Lock,
  Shield,
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  Key,
  BarChart3,
  CreditCard,
  Download,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  RefreshCw,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import UserStatsModal from "@/components/admin/UserStatsModal";
import SubscriptionModal from "@/components/admin/SubscriptionModal";
import Badge from "@/components/admin/Badge";

type UserRole = "USER" | "ADMIN";

interface UserData {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  avatar: string | null;
  createdAt: string;
}

const avatarOptions = [
  "red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink"
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Search and Filter
  const [searchQuery, setSearchQuery] = useState("");

  // Create User State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("USER");
  const [creating, setCreating] = useState(false);

  // Actions and Modals
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("USER");
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // External Modals
  const [statsUserId, setStatsUserId] = useState<string | null>(null);
  const [subscriptionUserId, setSubscriptionUserId] = useState<string | null>(null);

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Erro ao carregar usuários");
      const data = await res.json();
      setUsers(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newUserEmail,
          name: newUserName,
          password: newUserPassword,
          role: newUserRole
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao criar usuário");
      }

      setInfo("Usuário criado com sucesso!");
      setShowCreateForm(false);
      setNewUserEmail("");
      setNewUserName("");
      setNewUserPassword("");
      await loadUsers();
      setTimeout(() => setInfo(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteUser(id: string, email: string) {
    if (!confirm(`Tem certeza que deseja banir o usuário ${email}?`)) return;

    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao banir usuário");
      setInfo("Usuário removido da base de dados.");
      await loadUsers();
      setTimeout(() => setInfo(null), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleChangeRole(id: string, role: UserRole) {
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error("Erro ao alterar cargo");
      await loadUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;

    setSavingId(editingUser.id);
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          role: editRole,
          avatar: editAvatar
        }),
      });
      if (!res.ok) throw new Error("Erro ao salvar alterações");
      setEditingUser(null);
      await loadUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  }

  async function handleChangePassword(id: string, email: string) {
    const newPass = prompt(`Digite a nova senha para ${email}:`);
    if (!newPass) return;

    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPass }),
      });
      if (!res.ok) throw new Error("Erro ao alterar senha");
      alert("Senha alterada com sucesso!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  }

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-lg shadow-primary/5">
              <Users size={24} />
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight text-white uppercase">Usuários</h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Controle de Acesso e Permissões</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-primary transition-colors" size={18} />
            <input
              type="text"
              placeholder="Localizar usuário..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-12 w-64 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-xs font-bold text-white placeholder:text-zinc-700 focus:outline-none focus:border-primary/50 transition-all"
            />
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="h-12 px-8 rounded-2xl bg-primary text-white text-[11px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-xl shadow-primary/20 flex items-center gap-3 hover:scale-[1.02] active:scale-[0.98]"
          >
            <UserPlus size={18} />
            Injetar Usuário
          </button>
        </div>
      </div>

      {/* Status Messages */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold uppercase tracking-widest flex items-center gap-3">
            <AlertCircle size={18} /> {error}
          </motion.div>
        )}
        {info && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold uppercase tracking-widest flex items-center gap-3">
            <CheckCircle2 size={18} /> {info}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create User Modal Overlay */}
      <AnimatePresence>
        {showCreateForm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateForm(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-8 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">Novo Usuário</h3>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Adicionar conta à base de dados</p>
                  </div>
                  <button onClick={() => setShowCreateForm(false)} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 text-zinc-500 transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleCreateUser} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Email Principal</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                        <input
                          type="email"
                          required
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-sm text-white focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all font-mono"
                          placeholder="exemplo@flixcrd.com"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Nome Completo</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                        <input
                          type="text"
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-sm text-white focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
                          placeholder="Rafael K."
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Senha de Acesso</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                        <input
                          type="password"
                          required
                          value={newUserPassword}
                          onChange={(e) => setNewUserPassword(e.target.value)}
                          className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-sm text-white focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Nível de Permissão</label>
                      <div className="relative">
                        <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                        <select
                          value={newUserRole}
                          onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                          className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-sm text-white focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all appearance-none cursor-pointer"
                        >
                          <option value="USER" className="bg-zinc-950">USUÁRIO PADRÃO</option>
                          <option value="ADMIN" className="bg-zinc-950">ADMINISTRADOR</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={creating}
                    className="w-full h-14 bg-white text-black font-black uppercase tracking-[0.2em] text-xs rounded-2xl hover:bg-zinc-200 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {creating ? "Processando..." : (
                      <>
                        <Plus size={18} />
                        Finalizar Cadastro
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Users Table */}
      <div className="overflow-hidden rounded-3xl border border-white/5 bg-zinc-950/50 backdrop-blur-3xl shadow-2xl">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-black text-white uppercase tracking-widest">Base de Dados</h3>
          {loading && <div className="animate-spin text-primary"><RefreshCw size={16} /></div>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
              <tr>
                <th className="px-8 py-6">Identidade</th>
                <th className="px-8 py-6">Status/Permissão</th>
                <th className="px-8 py-6">Data de Ingresso</th>
                <th className="px-8 py-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {!loading && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-2 text-zinc-600">
                      <AlertCircle size={32} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Lista vazia</span>
                    </div>
                  </td>
                </tr>
              )}
              {filteredUsers.map((u) => {
                const created = new Date(u.createdAt).toLocaleDateString();
                const isSelected = openActionsId === u.id;

                return (
                  <tr key={u.id} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center text-zinc-950 font-black text-lg shadow-lg",
                          u.avatar === "red" ? "bg-red-500" :
                            u.avatar === "orange" ? "bg-orange-500" :
                              u.avatar === "yellow" ? "bg-yellow-400" :
                                u.avatar === "green" ? "bg-emerald-500" :
                                  u.avatar === "cyan" ? "bg-cyan-400" :
                                    u.avatar === "blue" ? "bg-sky-500" :
                                      u.avatar === "purple" ? "bg-violet-500" :
                                        u.avatar === "pink" ? "bg-pink-500" : "bg-zinc-700"
                        )}>
                          {(u.name || u.email).charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-white group-hover:text-primary transition-colors">{u.name || "Sem Nome"}</span>
                          <span className="text-[10px] font-mono text-zinc-600">{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <select
                          value={u.role}
                          onChange={(e) => handleChangeRole(u.id, e.target.value as UserRole)}
                          disabled={savingId === u.id}
                          className="bg-zinc-900 border border-white/5 rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-400 focus:text-white outline-none transition-all cursor-pointer"
                        >
                          <option value="USER">USER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>

                        {u.role === "ADMIN" && (
                          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" title="Admin Ativo" />
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2 text-zinc-500">
                        <Clock size={14} className="opacity-30" />
                        <span className="text-[10px] font-black uppercase tracking-widest">{created}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center justify-end gap-2 translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                        <button
                          onClick={() => setStatsUserId(u.id)}
                          className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-emerald-500 transition-all border border-white/5"
                          title="Stats"
                        >
                          <BarChart3 size={16} />
                        </button>
                        <button
                          onClick={() => setSubscriptionUserId(u.id)}
                          className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-blue-500 transition-all border border-white/5"
                          title="Assinatura"
                        >
                          <CreditCard size={16} />
                        </button>

                        <div className="relative">
                          <button
                            onClick={() => setOpenActionsId(isSelected ? null : u.id)}
                            className={cn(
                              "w-10 h-10 flex items-center justify-center rounded-xl transition-all border border-white/5",
                              isSelected ? "bg-primary text-white" : "bg-white/5 text-zinc-400 hover:bg-white/10"
                            )}
                          >
                            <MoreVertical size={16} />
                          </button>

                          <AnimatePresence>
                            {isSelected && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                className="absolute right-0 mt-2 w-56 bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl p-2 z-[100] backdrop-blur-3xl overflow-hidden"
                              >
                                <button
                                  onClick={() => {
                                    setEditingUser(u);
                                    setEditName(u.name || "");
                                    setEditRole(u.role);
                                    setEditAvatar(u.avatar);
                                    setOpenActionsId(null);
                                  }}
                                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:bg-white/5 hover:text-white transition-all text-left"
                                >
                                  <Edit2 size={14} />
                                  Editar Perfil
                                </button>
                                <button
                                  onClick={() => {
                                    handleChangePassword(u.id, u.email);
                                    setOpenActionsId(null);
                                  }}
                                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:bg-white/5 hover:text-white transition-all text-left"
                                >
                                  <Key size={14} />
                                  Alterar Senha
                                </button>
                                <div className="h-px bg-white/5 my-1" />
                                <button
                                  onClick={() => {
                                    handleDeleteUser(u.id, u.email);
                                    setOpenActionsId(null);
                                  }}
                                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10 transition-all text-left"
                                >
                                  <Trash2 size={14} />
                                  Banir Usuário
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingUser(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">Editar Perfil</h3>
                  <button onClick={() => setEditingUser(null)} className="text-zinc-500 hover:text-white"><X size={20} /></button>
                </div>

                <form onSubmit={handleSaveEdit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nome</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-primary/50 outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Gênero Visual (Avatar)</label>
                    <div className="flex flex-wrap gap-2 pt-2">
                      {avatarOptions.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setEditAvatar(opt)}
                          className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center text-zinc-950 font-black ring-2 transition-all",
                            opt === "red" ? "bg-red-500" :
                              opt === "orange" ? "bg-orange-500" :
                                opt === "yellow" ? "bg-yellow-400" :
                                  opt === "green" ? "bg-emerald-500" :
                                    opt === "cyan" ? "bg-cyan-400" :
                                      opt === "blue" ? "bg-sky-500" :
                                        opt === "purple" ? "bg-violet-500" : "bg-pink-500",
                            editAvatar === opt ? "ring-white" : "ring-transparent hover:ring-white/20"
                          )}
                        >
                          {(editName || editingUser.email).charAt(0).toUpperCase()}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setEditAvatar(null)}
                        className={cn(
                          "px-3 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all",
                          editAvatar === null ? "bg-white text-black border-white" : "border-white/10 text-zinc-500 hover:border-white/30"
                        )}
                      >
                        Default
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setEditingUser(null)}
                      className="flex-1 h-12 rounded-xl bg-white/5 text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-all"
                    >
                      Descartar
                    </button>
                    <button
                      type="submit"
                      disabled={savingId === editingUser.id}
                      className="flex-1 h-12 rounded-xl bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] hover:bg-zinc-200 transition-all flex items-center justify-center"
                    >
                      {savingId === editingUser.id ? "Salvando..." : "Gravar Mudanças"}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stats Modal */}
      {statsUserId && (
        <UserStatsModal
          userId={statsUserId}
          userName={users.find((u) => u.id === statsUserId)?.name || users.find((u) => u.id === statsUserId)?.email || "Usuário"}
          onClose={() => setStatsUserId(null)}
        />
      )}

      {/* Subscription Modal */}
      {subscriptionUserId && (
        <SubscriptionModal
          userId={subscriptionUserId}
          userName={users.find((u) => u.id === subscriptionUserId)?.name || users.find((u) => u.id === subscriptionUserId)?.email || "Usuário"}
          onClose={() => setSubscriptionUserId(null)}
          onSuccess={() => {
            setInfo("Assinatura atualizada com sucesso!");
            setTimeout(() => setInfo(null), 3000);
            loadUsers();
          }}
        />
      )}
    </div>
  );
}
