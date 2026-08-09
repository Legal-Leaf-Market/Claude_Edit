import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { ARTICLES, getArticle } from "@/lib/articles"

export function generateStaticParams() {
  return ARTICLES.map((article) => ({ slug: article.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const article = getArticle(slug)
  if (!article) return {}
  return {
    title: article.title,
    description: article.excerpt,
    alternates: { canonical: `/articles/${article.slug}` },
    openGraph: {
      title: article.title,
      description: article.excerpt,
      images: [{ url: article.image }],
    },
  }
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const article = getArticle(slug)
  if (!article) notFound()

  const related = ARTICLES.filter((a) => a.slug !== article.slug).slice(0, 2)

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <Link
          href="/articles"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-black text-gold transition hover:text-lime"
        >
          <ArrowLeft className="h-4 w-4" />
          All Articles
        </Link>

        <p className="mb-2 text-xs font-black uppercase tracking-[0.25em] text-gold">
          {new Date(article.publishedAt).toLocaleDateString(undefined, {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
          {" · "}
          {article.readTime}
        </p>
        <h1 className="text-3xl font-black leading-tight text-mint sm:text-4xl">
          {article.title}
        </h1>

        <div className="relative mt-6 aspect-[16/9] w-full overflow-hidden rounded-2xl border border-gold/20 bg-navy2">
          <Image src={article.image} alt="" fill className="object-cover" priority sizes="(min-width: 768px) 720px, 100vw" />
        </div>

        <article className="mt-8 space-y-6">
          {article.sections.map((section, i) => (
            <section key={i}>
              {section.heading && (
                <h2 className="mb-2 text-xl font-black text-mint">{section.heading}</h2>
              )}
              {section.paragraphs.map((p, j) => (
                <p key={j} className="mb-3 text-[0.95rem] leading-relaxed text-muted-foreground last:mb-0">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </article>

        <p className="mt-10 rounded-xl border border-gold/20 bg-white/[0.04] p-4 text-xs font-medium text-muted-foreground">
          This article is for general education only and isn't legal or medical advice. Hemp and
          THCA regulations vary by state and change often, so confirm current rules before you
          buy, travel, or use any hemp product.
        </p>

        {related.length > 0 && (
          <div className="mt-12 border-t border-gold/15 pt-8">
            <h3 className="mb-4 text-sm font-black uppercase tracking-widest text-gold">
              Keep Reading
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {related.map((a) => (
                <Link
                  key={a.slug}
                  href={`/articles/${a.slug}`}
                  className="rounded-xl border border-gold/20 bg-white/[0.04] p-4 transition hover:border-gold/40 hover:bg-white/[0.06]"
                >
                  <p className="text-sm font-black text-mint hover:text-lime">{a.title}</p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">{a.excerpt}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
