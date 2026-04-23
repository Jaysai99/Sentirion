import Link from "next/link";

const contactEmail = "jkatragadda@dekalbcapitalmanagement.com";

const heroStats = [
  { value: "3", label: "Integrated signal streams", detail: "Reddit, news, and SEC filings" },
  { value: "Real-time", label: "Desk-ready delivery", detail: "Built for live market workflows" },
  { value: "Institutional", label: "Research framing", detail: "Designed for PMs, analysts, and trading desks" },
];

const capabilityCards = [
  {
    title: "Narrative Surveillance",
    body: "Track how company and sector narratives evolve across social, news, and filing disclosures without stitching together multiple feeds manually.",
  },
  {
    title: "Signal Qualification",
    body: "Surface signal strength, divergence, and coverage quality so sentiment is interpreted as a measured research input instead of a headline score.",
  },
  {
    title: "Terminal Workflow",
    body: "Move from overview to single-name deep dive with a desk-oriented interface that supports triage, monitoring, and market context in one product.",
  },
];

const workflowSteps = [
  {
    step: "01",
    title: "Aggregate",
    body: "Pull market-facing language from retail sentiment, SEC disclosures, and financial news into one normalized research surface.",
  },
  {
    step: "02",
    title: "Score",
    body: "Apply domain-specific NLP to quantify tone, detect inflections, and separate weak coverage from stronger conviction signals.",
  },
  {
    step: "03",
    title: "Contextualize",
    body: "Pair sentiment with price action, market structure, and catalyst framing to support real investment workflow decisions.",
  },
];

const modules = [
  {
    title: "Single-Name Intelligence",
    body: "Company-level sentiment, catalyst extraction, momentum, and divergence analysis for equity research and risk review.",
  },
  {
    title: "Market Overview",
    body: "Cross-asset and watchlist-level scans to prioritize where attention is needed before moving into deeper review.",
  },
  {
    title: "FICC Monitoring",
    body: "Rates, FX, commodities, shipping, and crypto snapshots to frame broader market tone around the equity signal set.",
  },
  {
    title: "Research Distribution",
    body: "A presentation layer suitable for internal workflow, client demonstrations, and product-led distribution by Dekalb Capital Management LLC.",
  },
];

const audience = [
  "Portfolio managers screening inflections in positioning and narrative tone",
  "Sales and trading teams preparing morning context and intra-day updates",
  "Analysts needing faster first-pass synthesis before deeper fundamental work",
  "Institutional product conversations where a live intelligence interface strengthens the pitch",
];

export default function Home() {
  return (
    <main className="relative overflow-hidden px-4 pb-20 pt-8 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[-8rem] h-[28rem] w-[28rem] rounded-full bg-[#b8f36b]/10 blur-3xl" />
        <div className="absolute right-[-8%] top-[8rem] h-[26rem] w-[26rem] rounded-full bg-[#7fd0ff]/10 blur-3xl" />
        <div className="absolute inset-x-0 top-[30rem] h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
      </div>

      <div className="relative mx-auto flex max-w-7xl flex-col gap-8">
        <section className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="glass-panel dashboard-fade rounded-[34px] px-6 py-8 sm:px-8 sm:py-10">
            <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#94a99f]">
              Sentirion by Dekalb Capital Management LLC
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[0.94] tracking-[-0.06em] text-[#f4f0e8] sm:text-6xl lg:text-7xl">
              Institutional market sentiment intelligence, presented as a product.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[#bfd0c7] sm:text-lg">
              Sentirion is Dekalb Capital Management LLC&apos;s market intelligence platform for monitoring
              narrative shifts, cross-source sentiment, and catalyst-driven market tone across equities,
              macro, and FICC workflows.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/sentiment"
                className="rounded-full bg-[#b8f36b] px-6 py-3 text-sm font-semibold text-[#09110f] transition hover:bg-[#c7f784]"
              >
                Open Sentiment Terminal
              </Link>
              <Link
                href="/markets"
                className="rounded-full border border-white/12 bg-white/6 px-6 py-3 text-sm font-semibold text-[#f4f0e8] transition hover:bg-white/10"
              >
                View Global Markets
              </Link>
              <a
                href={`mailto:${contactEmail}`}
                className="rounded-full border border-[#7fd0ff]/25 bg-[#7fd0ff]/10 px-6 py-3 text-sm font-semibold text-[#dff4ff] transition hover:bg-[#7fd0ff]/16"
              >
                Contact Dekalb Capital Management LLC
              </a>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {heroStats.map((stat) => (
                <div key={stat.label} className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
                  <div className="text-2xl font-semibold tracking-[-0.04em] text-[#f4f0e8]">{stat.value}</div>
                  <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#8ea198]">
                    {stat.label}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#aebeb5]">{stat.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel dashboard-fade rounded-[34px] px-6 py-8 sm:px-8 sm:py-10">
            <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#94a99f]">
              Product Positioning
            </div>
            <div className="mt-5 rounded-[28px] border border-[#b8f36b]/14 bg-[linear-gradient(180deg,rgba(184,243,107,0.08),rgba(127,208,255,0.04))] p-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#d3e0b9]">
                Dekalb Capital Management LLC
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-[#f4f0e8]">
                Sentirion
              </div>
              <p className="mt-3 text-sm leading-6 text-[#d1ddd7]">
                A branded intelligence interface for presenting market sentiment, catalyst interpretation,
                and institutional narrative surveillance in a single workflow.
              </p>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-[24px] border border-white/8 bg-[#0b1714] p-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#8ea198]">Use Cases</div>
                <p className="mt-2 text-sm leading-6 text-[#bfd0c7]">
                  Internal research tooling, client-facing demos, portfolio review workflows, and live desk
                  context for fast-moving market sessions.
                </p>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-[#0b1714] p-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#8ea198]">Public Contact</div>
                <a
                  href={`mailto:${contactEmail}`}
                  className="mt-2 inline-block text-sm font-medium text-[#7fd0ff] transition hover:text-[#b2e2ff]"
                >
                  {contactEmail}
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {capabilityCards.map((card) => (
            <article key={card.title} className="rounded-[28px] border border-white/8 bg-white/[0.04] p-6">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#8ea198]">Capability</div>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[#f4f0e8]">{card.title}</h2>
              <p className="mt-4 text-sm leading-7 text-[#b7c8bf]">{card.body}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[32px] border border-white/8 bg-[#08120f]/88 p-6 sm:p-8">
            <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#94a99f]">
              Operating Model
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-[#f4f0e8] sm:text-4xl">
              Built to move from raw language flow to decision-ready context.
            </h2>
            <div className="mt-8 space-y-4">
              {workflowSteps.map((item) => (
                <div key={item.step} className="grid gap-4 rounded-[24px] border border-white/8 bg-white/[0.03] p-5 md:grid-cols-[88px_1fr]">
                  <div className="font-mono text-2xl text-[#b8f36b]">{item.step}</div>
                  <div>
                    <h3 className="text-xl font-semibold tracking-[-0.03em] text-[#f4f0e8]">{item.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-[#b7c8bf]">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-white/8 bg-white/[0.04] p-6 sm:p-8">
            <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#94a99f]">
              Who It Serves
            </div>
            <ul className="mt-6 space-y-3">
              {audience.map((item) => (
                <li key={item} className="rounded-[22px] border border-white/8 bg-[#0b1714] px-4 py-4 text-sm leading-7 text-[#d0dbd5]">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="rounded-[32px] border border-white/8 bg-white/[0.04] p-6 sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#94a99f]">
                Platform Modules
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#f4f0e8] sm:text-4xl">
                Sentirion as a Dekalb Capital Management LLC product suite.
              </h2>
            </div>
            <a
              href={`mailto:${contactEmail}`}
              className="text-sm font-medium text-[#7fd0ff] transition hover:text-[#b2e2ff]"
            >
              Product inquiries: {contactEmail}
            </a>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {modules.map((module) => (
              <article key={module.title} className="rounded-[26px] border border-white/8 bg-[#0b1714] p-5">
                <h3 className="text-xl font-semibold tracking-[-0.03em] text-[#f4f0e8]">{module.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#b7c8bf]">{module.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="contact" className="rounded-[32px] border border-[#7fd0ff]/14 bg-[linear-gradient(180deg,rgba(127,208,255,0.08),rgba(8,18,15,0.92))] px-6 py-8 sm:px-8 sm:py-10">
          <div className="max-w-3xl">
            <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#9bcce8]">
              Contact
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-[#f4f0e8] sm:text-4xl">
              Discuss Sentirion with Dekalb Capital Management LLC.
            </h2>
            <p className="mt-4 text-base leading-7 text-[#d9e8ef]">
              For product demos, strategic partnerships, or institutional deployment conversations, contact
              Dekalb Capital Management LLC directly.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a
                href={`mailto:${contactEmail}`}
                className="rounded-full bg-[#f4f0e8] px-6 py-3 text-sm font-semibold text-[#08120f] transition hover:bg-white"
              >
                {contactEmail}
              </a>
              <Link
                href="/sentiment"
                className="rounded-full border border-white/16 bg-white/8 px-6 py-3 text-sm font-semibold text-[#f4f0e8] transition hover:bg-white/12"
              >
                Launch Product Preview
              </Link>
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-3 border-t border-white/8 px-1 pt-6 text-sm text-[#8ea198] sm:flex-row sm:items-center sm:justify-between">
          <div>&copy; {new Date().getFullYear()} Sentirion by Dekalb Capital Management LLC. All rights reserved.</div>
          <div className="text-left sm:text-right">
            Sentirion is presented as a market intelligence product of Dekalb Capital Management LLC. Content is
            for informational purposes only and does not constitute investment advice or a solicitation.
          </div>
        </footer>
      </div>
    </main>
  );
}
