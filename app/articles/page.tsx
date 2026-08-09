import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { ARTICLES } from "@/lib/articles"

export const metadata: Metadata = {
  title: "Articles",
  description:
    "Guides on THCA, hemp flower, and how to shop smarter — from what THCA actually is to how to store your flower.",
  alternates: { canonical: "/articles" },
}

export default function ArticlesPage() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
        <div className="mb-8 text-center sm:mb-12">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.25em] text-gold">
            Legal-Leaf Market
          </p>
          <h1 className="text-3xl font-black uppercase tracking-tight text-mint sm:text-4xl">
            Articles
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm font-medium text-muted-foreground">
            Plain-language guides to help you shop THCA and hemp flower with confidence.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ARTICLES.map((article) => (
            <Link
              key={article.slug}
              href={`/articles/${article.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-gold/20 bg-white/[0.04] transition hover:border-gold/40 hover:bg-white/[0.06]"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-navy2">
                <Image
                  src={article.image}
                  alt=""
                  fill
                  className="object-cover opacity-90 transition duration-300 group-hover:scale-105 group-hover:opacity-100"
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <p className="mb-2 text-[0.65rem] font-black uppercase tracking-widest text-gold">
                  {new Date(article.publishedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {" · "}
                  {article.readTime}
                </p>
                <h2 className="text-lg font-black leading-snug text-mint group-hover:text-lime">
                  {article.title}
                </h2>
                <p className="mt-2 flex-1 text-sm font-medium text-muted-foreground">
                  {article.excerpt}
                </p>
                <span className="mt-4 text-sm font-black text-lime">Read article →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
