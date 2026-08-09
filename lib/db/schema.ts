import { pgTable, text, timestamp, boolean, serial, numeric } from "drizzle-orm/pg-core"

// ── Better Auth tables (camelCase columns match Better Auth defaults) ──────────
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// ── App tables ─────────────────────────────────────────────────────────────
// Watchlist entries tied to a user account. No FK by design (per-user scoping
// is done in every query via userId); a saved price/stock baseline lets us flag
// drops and restocks on return visits.
export const watchlist = pgTable("watchlist", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  productId: text("productId").notNull(),
  title: text("title").notNull(),
  storeName: text("storeName").notNull(),
  strainName: text("strainName"),
  image: text("image"),
  url: text("url"),
  // Frozen baseline captured at save time. Column names match the DB table
  // (basePrice / baseInStock); numeric returns a string, hence Number()/toFixed
  // conversions in the actions layer.
  basePrice: numeric("basePrice", { precision: 10, scale: 2 }).notNull(),
  baseInStock: boolean("baseInStock").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})
