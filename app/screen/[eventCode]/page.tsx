type ScreenPageProps = {
  params: Promise<{ eventCode: string }>;
};

export default async function ScreenPage({ params }: ScreenPageProps) {
  const { eventCode } = await params;

  return (
    <main className="min-h-screen bg-slate-950 p-5 text-white sm:p-8">
      <div className="flex min-h-[calc(100vh-2.5rem)] flex-col gap-5 sm:min-h-[calc(100vh-4rem)]">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/15 pb-5">
          <div>
            <p className="text-sm font-black uppercase text-cyan-200">
              Live Screen
            </p>
            <h1 className="mt-2 text-4xl font-black sm:text-6xl">
              {eventCode.toUpperCase()}
            </h1>
          </div>
          <div className="rounded-3xl border border-white/15 bg-white/10 px-6 py-4 text-right">
            <p className="text-sm font-black uppercase text-slate-300">
              Status
            </p>
            <p className="mt-1 text-3xl font-black text-emerald-300">READY</p>
          </div>
        </header>

        <section className="grid flex-1 gap-5 lg:grid-cols-[1fr_24rem]">
          <div className="flex flex-col justify-between rounded-3xl bg-white p-6 text-slate-950 shadow-2xl sm:p-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <span className="rounded-full bg-cyan-100 px-6 py-3 text-2xl font-black text-cyan-800">
                QUESTION 01
              </span>
              <span className="rounded-full bg-amber-100 px-6 py-3 text-2xl font-black text-amber-800">
                30 SEC
              </span>
            </div>

            <h2 className="my-10 text-5xl font-black leading-tight sm:text-7xl">
              대형 LED와 프로젝터에 표시될 퀴즈 질문입니다.
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              {["A. 첫 번째 선택지", "B. 두 번째 선택지", "C. 세 번째 선택지", "D. 네 번째 선택지"].map(
                (answer) => (
                  <div
                    key={answer}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-3xl font-black"
                  >
                    {answer}
                  </div>
                )
              )}
            </div>
          </div>

          <aside className="grid gap-5">
            <div className="rounded-3xl border border-white/15 bg-white/10 p-6">
              <p className="text-sm font-black uppercase text-slate-300">
                Participants
              </p>
              <p className="mt-4 text-7xl font-black">000</p>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/10 p-6">
              <p className="text-sm font-black uppercase text-slate-300">
                Ranking Preview
              </p>
              <div className="mt-5 grid gap-4 text-3xl font-black">
                <p>1. 참가자 A</p>
                <p>2. 참가자 B</p>
                <p>3. 참가자 C</p>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
