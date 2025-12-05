"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Profile {
  id: string;
  name: string;
  avatar: string | null;
  isKids: boolean;
}

const DEFAULT_AVATARS = ["👤", "😀", "😎", "🤓", "🥳", "🤩", "😇", "🤠", "👨", "👩", "👦", "👧"];

export default function ProfilesPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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
    localStorage.setItem("activeProfileId", profileId);
    router.push("/");
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '16px' }}>Carregando perfis...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#141414', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      {/* Logo */}
      <Link href="/" style={{ position: 'absolute', top: '24px', left: '4%', textDecoration: 'none' }}>
        <span style={{ fontSize: '32px', fontWeight: 800, background: 'linear-gradient(135deg, #e50914 0%, #b81d24 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          PaelFlix
        </span>
      </Link>

      {/* Title */}
      <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 3.5rem)', fontWeight: 400, color: '#fff', marginBottom: '40px', textAlign: 'center' }}>
        Quem está assistindo?
      </h1>

      {/* Profiles Grid */}
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '50px' }}>
        {profiles.map((profile) => (
          <button
            key={profile.id}
            onClick={() => handleSelectProfile(profile.id)}
            onMouseEnter={() => setHoveredId(profile.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              padding: '8px',
              transition: 'transform 0.2s ease',
              transform: hoveredId === profile.id ? 'scale(1.05)' : 'scale(1)',
            }}
          >
            <div
              style={{
                width: '140px',
                height: '140px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #333 0%, #1a1a1a 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '64px',
                border: hoveredId === profile.id ? '3px solid #fff' : '3px solid transparent',
                transition: 'border-color 0.2s ease',
                overflow: 'hidden',
              }}
            >
              {profile.avatar || DEFAULT_AVATARS[0]}
            </div>
            <div style={{ textAlign: 'center' }}>
              <p
                style={{
                  color: hoveredId === profile.id ? '#fff' : 'rgba(255,255,255,0.7)',
                  fontSize: '16px',
                  fontWeight: 500,
                  transition: 'color 0.2s ease',
                }}
              >
                {profile.name}
              </p>
              {profile.isKids && (
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '4px' }}>
                  Kids
                </p>
              )}
            </div>
          </button>
        ))}

        {/* Add Profile */}
        {profiles.length < 5 && (
          <Link
            href="/profiles/manage"
            onMouseEnter={() => setHoveredId('add')}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              padding: '8px',
              textDecoration: 'none',
              transition: 'transform 0.2s ease',
              transform: hoveredId === 'add' ? 'scale(1.05)' : 'scale(1)',
            }}
          >
            <div
              style={{
                width: '140px',
                height: '140px',
                borderRadius: '8px',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '64px',
                border: hoveredId === 'add' ? '3px solid #fff' : '3px solid rgba(255,255,255,0.3)',
                transition: 'border-color 0.2s ease',
                color: hoveredId === 'add' ? '#fff' : 'rgba(255,255,255,0.5)',
              }}
            >
              <svg style={{ width: '60px', height: '60px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <p
              style={{
                color: hoveredId === 'add' ? '#fff' : 'rgba(255,255,255,0.5)',
                fontSize: '16px',
                fontWeight: 500,
                transition: 'color 0.2s ease',
              }}
            >
              Adicionar perfil
            </p>
          </Link>
        )}
      </div>

      {/* Manage Profiles Button */}
      <Link
        href="/profiles/manage"
        style={{
          padding: '10px 28px',
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.5)',
          borderRadius: '4px',
          color: 'rgba(255,255,255,0.7)',
          fontSize: '14px',
          fontWeight: 500,
          textDecoration: 'none',
          transition: 'all 0.2s ease',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.borderColor = '#fff';
          e.currentTarget.style.color = '#fff';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)';
          e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
        }}
      >
        Gerenciar perfis
      </Link>
    </div>
  );
}
