"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Profile {
  id: string;
  name: string;
  avatar: string | null;
  isKids: boolean;
  useCloudflareProxy?: boolean;
}

const DEFAULT_AVATARS = [
  "👤", "😀", "😎", "🤓", "🥳", "🤩", "😇", "🤠",
  "👨", "👩", "👦", "👧", "🧑", "👶", "🐶", "🐱",
];

export default function ProfilesPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

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

  function handleSelectProfile(profileId: string) {
    // Salvar perfil ativo no localStorage
    localStorage.setItem("activeProfileId", profileId);
    router.push("/");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-zinc-50">
        <div className="text-sm text-zinc-400">Carregando perfis...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-zinc-50">
      <div className="w-full max-w-5xl">
        <h1 className="mb-12 text-center text-4xl font-semibold md:text-5xl">
          Quem está assistindo?
        </h1>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => handleSelectProfile(profile.id)}
              className="group flex flex-col items-center gap-3 rounded-md p-4 transition hover:bg-zinc-900"
            >
              <div className="flex h-32 w-32 items-center justify-center rounded-md border-4 border-transparent bg-zinc-800 text-6xl transition group-hover:border-zinc-400">
                {profile.avatar || DEFAULT_AVATARS[0]}
              </div>
              <div className="text-center">
                <div className="font-medium text-zinc-200 group-hover:text-white">
                  {profile.name}
                </div>
                {profile.isKids && (
                  <div className="mt-1 text-xs text-zinc-500">Kids</div>
                )}
              </div>
            </button>
          ))}

          {profiles.length < 5 && (
            <Link
              href="/profiles/manage"
              className="group flex flex-col items-center gap-3 rounded-md p-4 transition hover:bg-zinc-900"
            >
              <div className="flex h-32 w-32 items-center justify-center rounded-md border-4 border-transparent bg-zinc-800 text-6xl transition group-hover:border-zinc-400">
                <span className="text-zinc-500 group-hover:text-zinc-300">+</span>
              </div>
              <div className="text-center font-medium text-zinc-400 group-hover:text-zinc-200">
                Adicionar perfil
              </div>
            </Link>
          )}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/profiles/manage"
            className="inline-block rounded-md border border-zinc-700 px-6 py-2 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
          >
            Gerenciar perfis
          </Link>
        </div>
      </div>
    </div>
  );
}
