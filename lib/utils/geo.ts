import geoip from "geoip-lite";

import { Geo } from "../types";

export function getGeoData(headers: {
  [key: string]: string | string[] | undefined;
}): Geo {
  return {
    city: Array.isArray(headers["x-vercel-ip-city"])
      ? headers["x-vercel-ip-city"][0]
      : headers["x-vercel-ip-city"],
    region: Array.isArray(headers["x-vercel-ip-region"])
      ? headers["x-vercel-ip-region"][0]
      : headers["x-vercel-ip-region"],
    country: Array.isArray(headers["x-vercel-ip-country"])
      ? headers["x-vercel-ip-country"][0]
      : headers["x-vercel-ip-country"],
    latitude: Array.isArray(headers["x-vercel-ip-latitude"])
      ? headers["x-vercel-ip-latitude"][0]
      : headers["x-vercel-ip-latitude"],
    longitude: Array.isArray(headers["x-vercel-ip-longitude"])
      ? headers["x-vercel-ip-longitude"][0]
      : headers["x-vercel-ip-longitude"],
  };
}

/**
 * Look up geo data from an IP address using geoip-lite (MaxMind GeoLite2).
 * Used for self-hosted deployments where Vercel geo headers aren't available.
 */
export function getGeoDataFromIp(ip: string | null): Geo & { continent?: string } {
  if (!ip) return LOCALHOST_GEO_DATA;

  const geo = geoip.lookup(ip);
  if (!geo) return LOCALHOST_GEO_DATA;

  return {
    city: geo.city || undefined,
    region: geo.region || undefined,
    country: geo.country || undefined,
    latitude: geo.ll?.[0]?.toString(),
    longitude: geo.ll?.[1]?.toString(),
    continent: undefined, // geoip-lite doesn't provide continent
  };
}

/**
 * Extract the real client IP from request headers (for proxied requests).
 * Works with Kamal proxy, nginx, and other reverse proxies.
 */
export function getClientIp(req: { headers: { get(name: string): string | null } }): string | null {
  // X-Forwarded-For is set by most reverse proxies (including Kamal proxy)
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ip = forwardedFor.split(",")[0]?.trim();
    if (ip) return ip;
  }

  // X-Real-IP is set by nginx
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return null;
}

export const LOCALHOST_GEO_DATA = {
  continent: "Europe",
  city: "Munich",
  region: "BY",
  country: "DE",
  latitude: "48.1371",
  longitude: "11.5761",
};

export const LOCALHOST_IP = "127.0.0.1";
