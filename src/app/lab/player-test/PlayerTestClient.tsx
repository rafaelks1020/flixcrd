"use client";

import { useState } from "react";
import { Copy, Play, Settings } from "lucide-react";
import { createPortal } from "react-dom";

export default function PlayerTestClient() {
    const [baseUrl, setBaseUrl] = useState("https://superflixapi.buzz");
    const [videoId, setVideoId] = useState("");
    const [subUrl, setSubUrl] = useState("");
    const [lang, setLang] = useState("pt-BR");
    const [logoUrl, setLogoUrl] = useState("");
    const [logoLink, setLogoLink] = useState("");
    const [vastUrl, setVastUrl] = useState("");
    const [posterUrl, setPosterUrl] = useState("");

    const [generatedUrl, setGeneratedUrl] = useState("");

    const handleGenerate = () => {
        if (!videoId) return;

        const params = new URLSearchParams();
        if (subUrl) params.set("sub", subUrl);
        if (lang) params.set("lang", lang);
        if (logoUrl) params.set("logo", logoUrl);
        if (logoLink) params.set("logo_link", logoLink);
        if (vastUrl) params.set("vast", vastUrl);
        if (posterUrl) params.set("image", posterUrl);

        const finalUrl = `${baseUrl.replace(/\/$/, "")}/stape/${videoId}?${params.toString()}`;
        setGeneratedUrl(finalUrl);
    };

    return (
        <div className="min-h-screen bg-[#141414] text-white p-6 md:p-12 font-sans">
            <div className="max-w-6xl mx-auto">
                <header className="mb-10 border-b border-gray-800 pb-6">
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Settings className="w-8 h-8 text-blue-500" />
                        Streamtape Player Generator
                    </h1>
                    <p className="text-gray-400 mt-2">
                        Teste a geração de players personalizados com a SuperFlixAPI.
                    </p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Form Section */}
                    <div className="bg-[#1F1F1F] p-6 rounded-xl border border-gray-800 space-y-5">
                        <h2 className="text-xl font-semibold mb-4 text-gray-200">Configuração</h2>

                        {/* Base Config */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Base URL</label>
                                <input
                                    type="text"
                                    value={baseUrl}
                                    onChange={(e) => setBaseUrl(e.target.value)}
                                    className="w-full bg-[#2A2A2A] border border-gray-700 rounded p-2 text-sm focus:border-blue-500 outline-none transition"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-blue-400 mb-1">ID do Vídeo (Streamtape) *</label>
                                <input
                                    type="text"
                                    value={videoId}
                                    onChange={(e) => setVideoId(e.target.value)}
                                    placeholder="Ex: abcd1234efgh"
                                    className="w-full bg-[#2A2A2A] border border-blue-900/50 rounded p-2 text-sm focus:border-blue-500 outline-none transition"
                                />
                                <div className="text-xs text-gray-500 mt-1">
                                    Insira o <strong>ID do arquivo</strong> no Streamtape (ex: <code>AbC123XyZ</code>), não o ID do TMDB.
                                </div>
                            </div>
                        </div>

                        <div className="h-px bg-gray-800 my-4" />

                        {/* Optional Params */}
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Idioma (Lang)</label>
                                    <input
                                        type="text"
                                        value={lang}
                                        onChange={(e) => setLang(e.target.value)}
                                        className="w-full bg-[#2A2A2A] border border-gray-700 rounded p-2 text-sm focus:border-blue-500 outline-none transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Legenda (URL .vtt/.srt)</label>
                                    <input
                                        type="text"
                                        value={subUrl}
                                        onChange={(e) => setSubUrl(e.target.value)}
                                        placeholder="https://..."
                                        className="w-full bg-[#2A2A2A] border border-gray-700 rounded p-2 text-sm focus:border-blue-500 outline-none transition"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Logo URL</label>
                                <input
                                    type="text"
                                    value={logoUrl}
                                    onChange={(e) => setLogoUrl(e.target.value)}
                                    placeholder="https://site.com/logo.png"
                                    className="w-full bg-[#2A2A2A] border border-gray-700 rounded p-2 text-sm focus:border-blue-500 outline-none transition"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Logo Link (Destino)</label>
                                <input
                                    type="text"
                                    value={logoLink}
                                    onChange={(e) => setLogoLink(e.target.value)}
                                    placeholder="https://meusite.com"
                                    className="w-full bg-[#2A2A2A] border border-gray-700 rounded p-2 text-sm focus:border-blue-500 outline-none transition"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">VAST Tag (Anúncios) <span className="text-xs text-green-500">- Deixe vazio para sem anúncios</span></label>
                                <input
                                    type="text"
                                    value={vastUrl}
                                    onChange={(e) => setVastUrl(e.target.value)}
                                    placeholder="https://adserver.com/vast.xml..."
                                    className="w-full bg-[#2A2A2A] border border-gray-700 rounded p-2 text-sm focus:border-blue-500 outline-none transition"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Imagem de Capa (Poster)</label>
                                <input
                                    type="text"
                                    value={posterUrl}
                                    onChange={(e) => setPosterUrl(e.target.value)}
                                    placeholder="https://site.com/capa.jpg"
                                    className="w-full bg-[#2A2A2A] border border-gray-700 rounded p-2 text-sm focus:border-blue-500 outline-none transition"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleGenerate}
                            disabled={!videoId}
                            className={`w-full py-3 rounded font-bold text-center transition ${videoId
                                ? "bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
                                : "bg-gray-700 text-gray-500 cursor-not-allowed"
                                }`}
                        >
                            Gerar Player
                        </button>
                    </div>

                    {/* Preview Section */}
                    <div className="space-y-6">
                        <div className="bg-[#1F1F1F] p-6 rounded-xl border border-gray-800 min-h-[400px] flex flex-col">
                            <h2 className="text-xl font-semibold mb-4 text-gray-200 flex justify-between items-center">
                                Preview
                                {generatedUrl && (
                                    <a
                                        href={generatedUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-400 hover:text-blue-300 underline"
                                    >
                                        Abrir em nova aba
                                    </a>
                                )}
                            </h2>

                            <div className="flex-1 bg-black rounded overflow-hidden relative border border-gray-800 flex items-center justify-center">
                                {generatedUrl ? (
                                    <iframe
                                        src={generatedUrl}
                                        className="w-full h-full absolute inset-0"
                                        frameBorder="0"
                                        allowFullScreen
                                        allow="autoplay; encrypted-media"
                                        sandbox="allow-scripts allow-same-origin"
                                    />
                                ) : (
                                    <div className="text-center text-gray-600">
                                        <Play className="w-16 h-16 mx-auto mb-2 opacity-20" />
                                        <p>Preencha os dados e clique em Gerar</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {generatedUrl && (
                            <div className="bg-[#111] p-4 rounded border border-gray-800">
                                <label className="text-xs text-gray-500 uppercase font-bold mb-2 block">URL Gerada</label>
                                <div className="flex items-center gap-2 bg-[#0a0a0a] p-3 rounded border border-gray-800">
                                    <code className="text-green-400 text-sm flex-1 truncate">{generatedUrl}</code>
                                    <button
                                        onClick={() => navigator.clipboard.writeText(generatedUrl)}
                                        className="p-2 hover:bg-gray-800 rounded transition text-gray-400 hover:text-white"
                                        title="Copiar"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
