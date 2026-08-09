import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { merchantLeads } from "@/lib/db/schema"
import { notifyMerchantLead } from "@/lib/notify"

export const dynamic = "force-dynamic"

const leadSchema = z.object({
  shopName: z.string().trim().min(2).max(200),
  contactName: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(30).optional(),
  location: z.string().trim().max(200).optional(),
  hasOnlineCatalog: z.enum(["yes", "pos-only", "no", "unsure"]).default("unsure"),
  existingLink: z.string().trim().max(500).optional(),
  message: z.string().trim().max(2000).optional(),
  referredBy: z.enum(["owner", "customer"]).default("owner"),
  // Honeypot: a real visitor never fills this in, since it is hidden from view.
  website: z.string().max(0).optional(),
})

export async function POST(request: NextRequest) {
  const parsed = leadSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid submission", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { website: _honeypot, ...data } = parsed.data

  const [created] = await db
    .insert(merchantLeads)
    .values({
      shopName: data.shopName,
      contactName: data.contactName,
      email: data.email,
      phone: data.phone || null,
      location: data.location || null,
      hasOnlineCatalog: data.hasOnlineCatalog,
      existingLink: data.existingLink || null,
      message: data.message || null,
      referredBy: data.referredBy,
    })
    .returning()

  // Best effort, same as every other notification here: a shop's spot in the
  // queue is the database row, not the email that announces it.
  await notifyMerchantLead(created).catch((error) => {
    console.error(
      `[merchant-leads] notify failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  })

  return NextResponse.json({ received: true }, { status: 201 })
}
