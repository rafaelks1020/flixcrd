import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <div className="relative min-h-screen flex flex-col">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-900/20 via-black to-purple-900/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-600/10 via-transparent to-transparent" />
        
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-red-600/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-1/2 -left-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute bottom-20 right-1/4 w-64 h-64 bg-red-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }} />
        </div>

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-6 md:px-12 py-6">
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent">
              Pflix
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-gray-300 hover:text-white transition-colors"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-all hover:scale-105"
            >
              Começar Agora
            </Link>
          </div>
        </header>

        {/* Hero Content */}
        <main className="relative z-10 flex-1 flex items-center justify-center px-6 md:px-12">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              Seu portal de
              <span className="block bg-gradient-to-r from-red-500 via-red-400 to-orange-500 bg-clip-text text-transparent">
                entretenimento digital
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
              Acesse conteúdo exclusivo, crie perfis personalizados e aproveite 
              a melhor experiência de streaming. Tudo em um só lugar.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-semibold rounded-xl transition-all hover:scale-105 shadow-lg shadow-red-600/30"
              >
                Criar Conta Grátis
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-all backdrop-blur-sm border border-white/10"
              >
                Já tenho conta
              </Link>
            </div>

            {/* Price tag */}
            <div className="mt-12 inline-flex items-center gap-3 px-6 py-3 bg-white/5 backdrop-blur-sm rounded-full border border-white/10">
              <span className="text-gray-400">Planos a partir de</span>
              <span className="text-2xl font-bold text-white">R$ 10</span>
              <span className="text-gray-400">/mês</span>
            </div>
          </div>
        </main>

        {/* Scroll indicator */}
        <div className="relative z-10 pb-8 flex justify-center">
          <div className="animate-bounce">
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <section className="py-20 px-6 md:px-12 bg-gradient-to-b from-black to-gray-900">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
            Por que escolher o <span className="text-red-500">Pflix</span>?
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-8 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 hover:border-red-500/50 transition-all group">
              <div className="w-14 h-14 bg-red-600/20 rounded-xl flex items-center justify-center mb-6 group-hover:bg-red-600/30 transition-colors">
                <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Multi-dispositivo</h3>
              <p className="text-gray-400">
                Acesse de qualquer lugar: computador, tablet ou celular. Sua conta, sua experiência.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 hover:border-red-500/50 transition-all group">
              <div className="w-14 h-14 bg-red-600/20 rounded-xl flex items-center justify-center mb-6 group-hover:bg-red-600/30 transition-colors">
                <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Até 4 Perfis</h3>
              <p className="text-gray-400">
                Crie perfis para toda a família. Cada um com suas preferências e histórico.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 hover:border-red-500/50 transition-all group">
              <div className="w-14 h-14 bg-red-600/20 rounded-xl flex items-center justify-center mb-6 group-hover:bg-red-600/30 transition-colors">
                <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Alta Qualidade</h3>
              <p className="text-gray-400">
                Streaming em HD sem travamentos. Tecnologia de ponta para a melhor experiência.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-6 md:px-12 bg-gray-900">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Escolha seu plano
          </h2>
          <p className="text-gray-400 mb-12">
            Planos flexíveis para você e sua família. Cancele quando quiser.
          </p>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Plano Básico */}
            <div className="bg-gradient-to-br from-slate-800/80 via-slate-900 to-slate-950 rounded-3xl p-8 border border-slate-700/50 relative overflow-hidden shadow-xl">
              <div className="absolute top-0 right-0 w-40 h-40 bg-red-600/10 rounded-full blur-3xl" />
              
              <div className="relative">
                <h3 className="text-xl font-bold mb-2">Plano Básico</h3>
                
                <div className="flex items-baseline justify-center gap-1 mb-6">
                  <span className="text-4xl font-bold">R$ 10</span>
                  <span className="text-gray-400">/mês</span>
                </div>

                <ul className="text-left space-y-3 mb-8">
                  {[
                    "Acesso completo ao catálogo",
                    "Streaming em HD",
                    "1 tela simultânea",
                    "Até 4 perfis",
                    "Sem anúncios",
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-300 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/register"
                  className="inline-block w-full px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-all border border-white/10"
                >
                  Começar Agora
                </Link>
              </div>
            </div>

            {/* Plano Duo */}
            <div className="bg-gradient-to-br from-slate-800/80 via-slate-900 to-slate-950 rounded-3xl p-8 border border-amber-500/50 relative overflow-hidden shadow-xl">
              <div className="absolute top-0 right-0 w-40 h-40 bg-amber-600/10 rounded-full blur-3xl" />
              
              <div className="relative">
                <div className="inline-block px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-xs font-bold rounded-full mb-4">
                  MAIS POPULAR
                </div>
                
                <h3 className="text-xl font-bold mb-2">Plano Duo</h3>
                
                <div className="flex items-baseline justify-center gap-1 mb-6">
                  <span className="text-4xl font-bold">R$ 14,99</span>
                  <span className="text-gray-400">/mês</span>
                </div>

                <ul className="text-left space-y-3 mb-8">
                  {[
                    "Acesso completo ao catálogo",
                    "Streaming em HD",
                    "2 telas simultâneas",
                    "Até 4 perfis",
                    "Sem anúncios",
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-300 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/register"
                  className="inline-block w-full px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-semibold rounded-xl transition-all"
                >
                  Começar Agora
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 md:px-12 bg-gradient-to-b from-gray-900 to-black">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Pronto para começar?
          </h2>
          <p className="text-gray-400 mb-8">
            Crie sua conta em segundos e comece a aproveitar.
          </p>
          <Link
            href="/register"
            className="inline-block px-10 py-4 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-semibold rounded-xl transition-all hover:scale-105 shadow-lg shadow-red-600/30"
          >
            Criar Minha Conta
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 md:px-12 border-t border-gray-800">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-2xl font-bold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent">
            Pflix
          </span>
          <p className="text-gray-500 text-sm">
            © 2024 Pflix. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
