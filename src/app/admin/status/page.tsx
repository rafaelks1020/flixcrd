"use client";

import { useEffect, useState } from "react";

interface StatusCheck {
  name: string;
  status: "checking" | "success" | "error";
  message: string;
  details?: any;
  icon: string;
}

interface CronTask {
  id: string;
  name: string;
  description?: string | null;
  endpoint: string;
  intervalMinutes: number;
  enabled: boolean;
  lastRunAt?: string | null;
  lastSuccessAt?: string | null;
  lastStatus?: number | null;
  lastError?: string | null;
  lastDurationMs?: number | null;
}

export default function SystemStatusPage() {
  const [checks, setChecks] = useState<StatusCheck[]>([
    {
      name: "Banco de Dados (PostgreSQL)",
      status: "checking",
      message: "Verificando conexão...",
      icon: "🗄️",
    },
    {
      name: "Storage (Wasabi)",
      status: "checking",
      message: "Verificando conexão...",
      icon: "☁️",
    },
    {
      name: "Transcoder (Python)",
      status: "checking",
      message: "Verificando conexão...",
      icon: "🎬",
    },
    {
      name: "Cloudflare Proxy",
      status: "checking",
      message: "Verificando conexão...",
      icon: "🌐",
    },
  ]);
  const [cronTasks, setCronTasks] = useState<CronTask[]>([]);
  const [cronLoading, setCronLoading] = useState(true);

  const updateCheck = (index: number, updates: Partial<StatusCheck>) => {
    setChecks((prev) =>
      prev.map((check, i) => (i === index ? { ...check, ...updates } : check))
    );
  };

  useEffect(() => {
    const runChecks = async () => {
      // 1. Verificar Banco de Dados
      try {
        const dbRes = await fetch("/api/status/database");
        const dbData = await dbRes.json();
        
        if (dbData.success) {
          updateCheck(0, {
            status: "success",
            message: dbData.message,
          });
        } else {
          updateCheck(0, {
            status: "error",
            message: dbData.error || "Erro desconhecido",
          });
        }
      } catch (error: any) {
        updateCheck(0, {
          status: "error",
          message: error.message || "Erro ao conectar",
        });
      }

      // 2. Verificar Storage (Wasabi)
      try {
        const storageRes = await fetch("/api/status/storage");
        const storageData = await storageRes.json();
        
        if (storageData.success) {
          updateCheck(1, {
            status: "success",
            message: storageData.message,
            details: storageData,
          });
        } else {
          updateCheck(1, {
            status: "error",
            message: storageData.error || "Erro desconhecido",
            details: storageData,
          });
        }
      } catch (error: any) {
        updateCheck(1, {
          status: "error",
          message: error.message || "Erro ao conectar",
        });
      }

      // 3. Verificar Transcoder
      try {
        const transcoderRes = await fetch("/api/status/transcoder");
        const transcoderData = await transcoderRes.json();
        
        if (transcoderData.success) {
          updateCheck(2, {
            status: "success",
            message: `Online (${transcoderData.status})`,
            details: transcoderData,
          });
        } else {
          updateCheck(2, {
            status: "error",
            message: transcoderData.error || "Offline",
            details: transcoderData,
          });
        }
      } catch (error: any) {
        updateCheck(2, {
          status: "error",
          message: error.message || "Erro ao conectar",
        });
      }

      // 4. Verificar Cloudflare Proxy
      try {
        const cloudflareRes = await fetch("/api/status/cloudflare");
        const cloudflareData = await cloudflareRes.json();
        
        if (cloudflareData.success) {
          updateCheck(3, {
            status: "success",
            message: cloudflareData.message,
            details: cloudflareData,
          });
        } else {
          updateCheck(3, {
            status: "error",
            message: cloudflareData.error || "Offline",
            details: cloudflareData,
          });
        }
      } catch (error: any) {
        updateCheck(3, {
          status: "error",
          message: error.message || "Erro ao conectar",
        });
      }
    };

    runChecks();
  }, []);

  useEffect(() => {
    const loadCronTasks = async () => {
      try {
        const res = await fetch("/api/admin/cron-tasks");
        if (res.ok) {
          const data = await res.json();
          setCronTasks(data.data || []);
        }
      } catch (error) {
        console.error("Erro ao carregar cron tasks:", error);
      } finally {
        setCronLoading(false);
      }
    };

    loadCronTasks();
  }, []);

  const allSuccess = checks.every((c) => c.status === "success");
  const anyError = checks.some((c) => c.status === "error");

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="bg-gray-800 rounded-lg shadow-xl p-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-white">
              📊 Status do Sistema
            </h1>
            
            <div className="flex items-center gap-3">
              {allSuccess && (
                <span className="px-4 py-2 bg-green-900/30 border border-green-500 text-green-400 rounded-lg font-semibold">
                  ✅ Tudo Funcionando
                </span>
              )}
              {anyError && (
                <span className="px-4 py-2 bg-red-900/30 border border-red-500 text-red-400 rounded-lg font-semibold">
                  ⚠️ Problemas Detectados
                </span>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {checks.map((check, index) => (
              <div
                key={index}
                className={`p-6 rounded-lg border-2 transition-all ${
                  check.status === "checking"
                    ? "bg-gray-700/30 border-gray-600 animate-pulse"
                    : check.status === "success"
                    ? "bg-green-900/20 border-green-500"
                    : "bg-red-900/20 border-red-500"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <span className="text-4xl">{check.icon}</span>
                    
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-white mb-2">
                        {check.name}
                      </h3>
                      
                      <p
                        className={`text-sm ${
                          check.status === "success"
                            ? "text-green-400"
                            : check.status === "error"
                            ? "text-red-400"
                            : "text-gray-400"
                        }`}
                      >
                        {check.message}
                      </p>

                      {check.details && (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-300">
                            Ver detalhes
                          </summary>
                          <pre className="mt-2 bg-gray-950 p-3 rounded text-xs text-gray-400 overflow-x-auto">
                            {JSON.stringify(check.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>

                  <div className="ml-4">
                    {check.status === "checking" && (
                      <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    )}
                    {check.status === "success" && (
                      <span className="text-3xl">✅</span>
                    )}
                    {check.status === "error" && (
                      <span className="text-3xl">❌</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 p-4 bg-gray-950 rounded border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-3">
              ℹ️ Informações
            </h3>
            <div className="space-y-2 text-sm text-gray-400">
              <p>• Esta página verifica automaticamente o status de todos os serviços</p>
              <p>• Recarregue a página para atualizar os status</p>
              <p>• Timeouts são configurados para 5 segundos</p>
            </div>
          </div>

          <div className="mt-8 p-6 bg-gray-800 rounded-lg border border-gray-700 shadow-inner">
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <div>
                <h3 className="text-xl font-semibold text-white">⏱️ Cron jobs</h3>
                <p className="text-sm text-gray-400">
                  Dispatcher chamado a cada 15 minutos (cron-job.org) e executa apenas tarefas vencidas.
                </p>
              </div>
              <img
                src="https://api.cron-job.org/jobs/6987011/b23156b1546e0346/status-7.svg"
                alt="Status do cron-job.org"
                className="h-10 bg-white rounded p-1"
              />
            </div>

            {cronLoading ? (
              <p className="text-sm text-gray-400">Carregando tarefas de cron...</p>
            ) : cronTasks.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhuma tarefa registrada.</p>
            ) : (
              <div className="space-y-3">
                {cronTasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded border border-gray-700 bg-gray-900/60 p-4"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <p className="text-sm font-semibold text-white">{task.name}</p>
                        <p className="text-xs text-gray-400">{task.description || task.endpoint}</p>
                      </div>
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded ${
                          task.enabled ? "bg-emerald-900/40 text-emerald-300" : "bg-gray-800 text-gray-400"
                        }`}
                      >
                        {task.enabled ? "Ativa" : "Pausada"}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-gray-300">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">Intervalo:</span>
                        <span className="font-semibold">{task.intervalMinutes} min</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">Última execução:</span>
                        <span className="font-semibold">
                          {task.lastRunAt
                            ? new Date(task.lastRunAt).toLocaleString("pt-BR")
                            : "Nunca"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">Último status:</span>
                        <span
                          className={`font-semibold ${
                            task.lastStatus && task.lastStatus < 400
                              ? "text-emerald-300"
                              : "text-red-300"
                          }`}
                        >
                          {task.lastStatus ?? "—"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">Duração:</span>
                        <span className="font-semibold">
                          {task.lastDurationMs ? `${task.lastDurationMs} ms` : "—"}
                        </span>
                      </div>
                    </div>
                    {task.lastError && (
                      <p className="mt-2 text-xs text-red-300">Erro: {task.lastError}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => window.location.reload()}
            className="mt-6 w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            🔄 Atualizar Status
          </button>
        </div>
      </div>
    </div>
  );
}
