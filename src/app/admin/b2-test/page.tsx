"use client";

import { useEffect, useState } from "react";

interface TestResult {
  success: boolean;
  message?: string;
  bucket?: string;
  objectCount?: number;
  sampleFiles?: string[];
  error?: string;
  code?: string;
  details?: any;
}

export default function B2TestPage() {
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);

  const runTest = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/b2/test");
      const data = await response.json();
      setResult(data);
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message || "Erro ao conectar com a API",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runTest();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-800 rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold text-white mb-6">
            🔧 Teste de Conexão B2
          </h1>

          <button
            onClick={runTest}
            disabled={loading}
            className="mb-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? "Testando..." : "🔄 Testar Novamente"}
          </button>

          {result && (
            <div
              className={`p-6 rounded-lg ${
                result.success
                  ? "bg-green-900/30 border border-green-500"
                  : "bg-red-900/30 border border-red-500"
              }`}
            >
              {result.success ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">✅</span>
                    <h2 className="text-2xl font-bold text-green-400">
                      {result.message}
                    </h2>
                  </div>

                  <div className="space-y-3 text-gray-300">
                    <div>
                      <span className="font-semibold text-white">Bucket:</span>{" "}
                      <span className="text-green-400">{result.bucket}</span>
                    </div>

                    <div>
                      <span className="font-semibold text-white">
                        Total de arquivos:
                      </span>{" "}
                      <span className="text-green-400">
                        {result.objectCount}
                      </span>
                    </div>

                    {result.sampleFiles && result.sampleFiles.length > 0 && (
                      <div>
                        <p className="font-semibold text-white mb-2">
                          Arquivos de exemplo:
                        </p>
                        <ul className="space-y-1 ml-4">
                          {result.sampleFiles.map((file, index) => (
                            <li
                              key={index}
                              className="text-sm text-gray-400 font-mono"
                            >
                              📄 {file}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">❌</span>
                    <h2 className="text-2xl font-bold text-red-400">
                      Erro na Conexão
                    </h2>
                  </div>

                  <div className="space-y-3 text-gray-300">
                    {result.error && (
                      <div>
                        <span className="font-semibold text-white">Erro:</span>{" "}
                        <span className="text-red-400">{result.error}</span>
                      </div>
                    )}

                    {result.code && (
                      <div>
                        <span className="font-semibold text-white">
                          Código:
                        </span>{" "}
                        <span className="text-red-400">{result.code}</span>
                      </div>
                    )}

                    {result.details && (
                      <div>
                        <p className="font-semibold text-white mb-2">
                          Detalhes:
                        </p>
                        <pre className="bg-gray-950 p-4 rounded text-xs text-gray-400 overflow-x-auto">
                          {JSON.stringify(result.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-600 rounded">
                    <p className="text-yellow-400 font-semibold mb-2">
                      💡 Possíveis soluções:
                    </p>
                    <ul className="text-sm text-yellow-300 space-y-1 ml-4">
                      <li>• Verifique se B2_KEY_ID e B2_SECRET estão corretos no .env</li>
                      <li>• Confirme se a Application Key tem as permissões necessárias</li>
                      <li>• Verifique se o bucket "paelflix" existe</li>
                      <li>• Reinicie o servidor após alterar o .env</li>
                    </ul>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="mt-8 p-4 bg-gray-950 rounded border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-3">
              📋 Informações do Sistema
            </h3>
            <div className="space-y-2 text-sm text-gray-400">
              <div>
                <span className="font-semibold text-gray-300">Endpoint:</span>{" "}
                https://s3.us-east-005.backblazeb2.com
              </div>
              <div>
                <span className="font-semibold text-gray-300">Região:</span>{" "}
                us-east-005
              </div>
              <div>
                <span className="font-semibold text-gray-300">
                  Cloudflare Link:
                </span>{" "}
                https://hlspaelflix.top/b2/
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
