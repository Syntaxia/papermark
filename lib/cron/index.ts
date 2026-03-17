import { Receiver } from "@upstash/qstash";
import Bottleneck from "bottleneck";

// we're using Bottleneck to avoid running into email rate limits
export const limiter = new Bottleneck({
  maxConcurrent: 1, // maximum concurrent requests
  minTime: 100, // minimum time between requests in ms
});

// QStash receiver for signature verification (no-op when VERCEL !== "1")
export const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || "",
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || "",
});
