"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function PendingApprovalPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    // Se já foi aprovado, redirecionar para subscribe ou browse
    if (status === "authenticated") {
      const approvalStatus = (session?.user as any)?.approvalStatus;
      if (approvalStatus === "APPROVED") {
        router.push("/subscribe");
      } else if (approvalStatus === "REJECTED") {
        // Mantém na página para mostrar mensagem de rejeição
      }
    }
  }, [status, session, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  const approvalStatus = (session?.user as any)?.approvalStatus;
  const isRejected = approvalStatus === "REJECTED";

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-zinc-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {isRejected ? (
          <>
            {/* Rejected State */}
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg
                className="w-12 h-12 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">
              Cadastro Não Aprovado
            </h1>
            <p className="text-zinc-400 mb-8">
              Infelizmente seu cadastro não foi aprovado. Se você acredita que
              isso foi um erro, entre em contato com o suporte.
            </p>
          </>
        ) : (
          <>
            {/* Pending State */}
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <svg
                className="w-12 h-12 text-yellow-500 animate-pulse"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">
              Aguardando Aprovação
            </h1>
            <p className="text-zinc-400 mb-8">
              Seu cadastro está sendo analisado pela nossa equipe. Você receberá
              uma notificação assim que for aprovado.
            </p>
            <div className="bg-zinc-800/50 rounded-xl p-6 mb-8 border border-zinc-700">
              <p className="text-sm text-zinc-400 mb-2">Cadastrado como:</p>
              <p className="text-lg font-medium text-white">
                {session?.user?.email}
              </p>
            </div>
          </>
        )}

        <div className="space-y-3">
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors"
          >
            🔄 Verificar Status
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full py-3 bg-transparent border border-zinc-700 hover:bg-zinc-800 text-zinc-300 font-medium rounded-lg transition-colors"
          >
            Sair da Conta
          </button>
        </div>

        <p className="text-xs text-zinc-500 mt-8">
          Dúvidas? Entre em contato pelo suporte.
        </p>
      </div>
    </div>
  );
}
