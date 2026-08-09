"use client"

import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  // Same origin, so the base URL is inferred from the browser.
})

export const { signIn, signUp, signOut, useSession } = authClient
