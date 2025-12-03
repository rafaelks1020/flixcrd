"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

interface Profile {
  id: string;
  name: string;
  avatar: string | null;
  isKids: boolean;
}

const DEFAULT_AVATARS = [
  "👤", "😀", "😎", "🤓", "🥳", "🤩", "😇", "🤠",
  "👨", "👩", "👦", "👧", "🧑", "👶", "🐶", "🐱",
];

export default function ManageProfilesPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    avatar: "👤",
    isKids: false,
  });

  useEffect(() => {
    loadProfiles();
  }, []);

  async function loadProfiles() {
    try {
      const res = await fetch("/api/profiles");
      if (res.ok) {
        const data = await res.json();
        setProfiles(data);
      }
    } catch (err) {
      console.error("Erro ao carregar perfis", err);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingId(null);
    setForm({ name: "", avatar: "👤", isKids: false });
    setError(null);
    setShowModal(true);
  }

  function openEditModal(profile: Profile) {
    setEditingId(profile.id);
    setForm({
      name: profile.name,
      avatar: profile.avatar || "👤",
      isKids: profile.isKids,
    });
    setError(null);
    setShowModal(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      if (editingId) {
        // Editar
        const res = await fetch(`/api/profiles/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Erro ao atualizar perfil");
        }
      } else {
        // Criar
        const res = await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Erro ao criar perfil");
        }
      }

      setShowModal(false);
      await loadProfiles();
    } catch (err: any) {
      setError(err.message || "Erro ao salvar perfil");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir este perfil? Todo o histórico e favoritos serão perdidos.")) {
      return;
    }

    try {
      const res = await fetch(`/api/profiles/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao excluir perfil");
      }

      await loadProfiles();
    } catch (err: any) {
      alert(err.message || "Erro ao excluir perfil");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-zinc-50">
        <div className="text-sm text-zinc-400">Carregando perfis...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black px-4 py-12 text-zinc-50">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-semibold md:text-4xl">Gerenciar perfis</h1>
          <Link
            href="/profiles"
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
          >
            Concluído
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="group flex flex-col items-center gap-3 rounded-md bg-zinc-900 p-4"
            >
              <div className="flex h-24 w-24 items-center justify-center rounded-md bg-zinc-800 text-5xl">
                {profile.avatar || DEFAULT_AVATARS[0]}
              </div>
              <div className="w-full text-center">
                <div className="truncate font-medium text-zinc-200">
                  {profile.name}
                </div>
                {profile.isKids && (
                  <div className="mt-1 text-xs text-zinc-500">Kids</div>
                )}
              </div>
              <div className="flex w-full gap-2">
                <button
                  type="button"
                  onClick={() => openEditModal(profile)}
                  className="flex-1 rounded-md border border-zinc-700 px-3 py-1 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(profile.id)}
                  className="flex-1 rounded-md border border-red-900 px-3 py-1 text-xs font-semibold text-red-400 hover:bg-red-950"
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}

          {profiles.length < 5 && (
            <button
              type="button"
              onClick={openCreateModal}
              className="flex flex-col items-center gap-3 rounded-md border-2 border-dashed border-zinc-700 p-4 transition hover:border-zinc-500 hover:bg-zinc-900"
            >
              <div className="flex h-24 w-24 items-center justify-center rounded-md bg-zinc-800 text-5xl text-zinc-500">
                +
              </div>
              <div className="font-medium text-zinc-400">Adicionar perfil</div>
            </button>
          )}
        </div>
      </div>

      {/* Modal de criar/editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-md rounded-lg bg-zinc-900 p-6">
            <h2 className="mb-4 text-xl font-semibold">
              {editingId ? "Editar perfil" : "Novo perfil"}
            </h2>

            {error && (
              <div className="mb-4 rounded-md bg-red-950 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-300">
                  Nome
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-zinc-500"
                  required
                  maxLength={20}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">
                  Avatar
                </label>
                <div className="grid grid-cols-8 gap-2">
                  {DEFAULT_AVATARS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setForm({ ...form, avatar: emoji })}
                      className={`flex h-10 w-10 items-center justify-center rounded-md text-2xl transition ${
                        form.avatar === emoji
                          ? "bg-zinc-600 ring-2 ring-zinc-400"
                          : "bg-zinc-800 hover:bg-zinc-700"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isKids"
                  checked={form.isKids}
                  onChange={(e) => setForm({ ...form, isKids: e.target.checked })}
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-red-600 focus:ring-red-600"
                />
                <label htmlFor="isKids" className="text-sm text-zinc-300">
                  Perfil infantil (Kids)
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-md border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  {editingId ? "Salvar" : "Criar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
