import { env } from "@/lib/env"
import type { Source } from "@/lib/db/schema"

/**
 * Per-store checkout capability, keyed by the same Source values used
 * throughout ingestion.
 *
 * 'shopify' stores support the cart permalink (/cart/{variantId}:{qty},...),
 * which can fill a MULTI-item cart in one URL. 'woocommerce' only takes one
 * line per URL (?add-to-cart={id}&quantity={n}); additional items in the same
 * store have to be added by hand once the shopper is there. 'none' covers
 * every source with no prefillable cart at all (the paused eBay/Reverb/CJ/
 * Awin feeds): checkout there is just the single affiliate/raw link, same as
 * clicking through /go directly.
 */
export type CartPlatform = "shopify" | "woocommerce" | "none"

export type StoreCartConfig = {
  platform: CartPlatform
  baseUrl: string
  /** WooCommerce only. Defaults to '/cart/', the platform default. */
  cartPath?: string
  refParam?: string
  refCode?: string
}

export function storeCartConfig(source: Source): StoreCartConfig {
  switch (source) {
    case "folkcraft":
      return { platform: "shopify", baseUrl: "https://folkcraft.com", ...env.goaffpro.folkcraft }
    case "acousticguitar":
      return {
        platform: "shopify",
        baseUrl: "https://store.acousticguitar.com",
        ...env.goaffpro.acousticGuitar,
      }
    case "jamstik":
      return { platform: "shopify", baseUrl: "https://www.jamstik.com", ...env.goaffpro.jamstik }
    case "jacksonaudio":
      return { platform: "shopify", baseUrl: "https://jackson.audio", ...env.goaffpro.jacksonAudio }
    case "eminencedigital":
      return {
        platform: "shopify",
        baseUrl: "https://eminence-digital.com",
        ...env.goaffpro.eminenceDigital,
      }
    case "hazeguitar":
      return {
        platform: "shopify",
        baseUrl: "https://www.hazeguitar.com.au",
        ...env.goaffpro.hazeGuitar,
      }
    case "eartguitar":
      return { platform: "shopify", baseUrl: "https://eartguitar.com", ...env.goaffpro.eartGuitar }
    case "playwithauthority":
      return {
        platform: "shopify",
        baseUrl: "https://www.playwithauthority.com",
        ...env.goaffpro.playWithAuthority,
      }
    case "puresmusic":
      return { platform: "shopify", baseUrl: "https://www.puresmusic.com", ...env.goaffpro.puresMusic }
    case "easonmusicstore":
      return {
        platform: "shopify",
        baseUrl: "https://www.easonmusicstore.com",
        ...env.goaffpro.easonMusicStore,
      }
    case "gokalimba":
      return { platform: "shopify", baseUrl: "https://www.gokalimba.com", ...env.goaffpro.goKalimba }
    case "squaver":
      return {
        platform: "woocommerce",
        baseUrl: "https://squaver.in",
        cartPath: "/cart/",
        ...env.goaffpro.squaver,
      }
    default:
      // eBay, Reverb, Sweetwater, Gear4music, and the CJ trio: no platform
      // this module knows how to prefill a cart for, paused or not.
      return { platform: "none", baseUrl: "" }
  }
}
