import { ModernPageShell } from "@/components/ModernPageShell";

type LegalPageProps = {
  locale: string;
  eyebrow: string;
  lastUpdatedLabel: string;
  title: string;
  sections: Array<{ title: string; body: string[] }>;
};

export function LegalPage({ locale, eyebrow, lastUpdatedLabel, title, sections }: LegalPageProps) {
  const updated = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(
    new Date("2026-07-18T00:00:00Z"),
  );

  return (
    <ModernPageShell>
      <section className="py-24">
        <div className="halvaa-container max-w-3xl ltr:text-left rtl:text-right">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
          <h1 className="mt-3 text-4xl font-black leading-tight text-foreground sm:text-5xl">{title}</h1>
          <p className="mt-3 text-sm text-muted">{lastUpdatedLabel}: {updated}</p>
          <div className="mt-10 space-y-8">
            {sections.map((section) => (
              <article key={section.title} className="space-y-3">
                <h2 className="text-2xl font-black text-foreground">{section.title}</h2>
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="text-base leading-8 text-muted">
                    {paragraph}
                  </p>
                ))}
              </article>
            ))}
          </div>
        </div>
      </section>
    </ModernPageShell>
  );
}
