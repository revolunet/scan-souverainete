import { readFileSync } from "node:fs";
import type { HosterEntry } from "../types.js";
export type { HosterEntry } from "../types.js";

let hosters: HosterEntry[] | null = null;

export function loadHosters(filePath: string): HosterEntry[] {
  if (hosters) return hosters;
  const raw = readFileSync(filePath, "utf-8");
  hosters = JSON.parse(raw) as HosterEntry[];
  return hosters;
}

function ipToNumber(ip: string): number {
  const octets = ip.split(".").map(Number);
  return (
    octets[0] * 256 ** 3 +
    octets[1] * 256 ** 2 +
    octets[2] * 256 +
    octets[3]
  );
}

function ipInCidr(ip: string, cidr: string): boolean {
  const [netStr, maskStr] = cidr.split("/");
  const mask = Number(maskStr);
  if (isNaN(mask)) return false;
  const ipNum = ipToNumber(ip);
  const netNum = ipToNumber(netStr);
  const shift = 32 - mask;
  return (ipNum >> shift) === (netNum >> shift);
}

export interface HosterMatch {
  entry: HosterEntry;
  source: "cidr" | "exact" | "wildcard" | "substring";
}

export function findHoster(
  hosters: HosterEntry[],
  data: {
    ip: string | null;
    asn: string | null;
    host: string | null;
    hostname: string | null;
    netname: string | null;
    organization: string | null;
  }
): HosterMatch | null {
  if (!data.ip && !data.host) return null;

  const compare = (pattern: string): boolean => {
    // 1. CIDR
    if (/^\d+\.\d+\.\d+\.\d+\/\d+$/.test(pattern) && data.ip) {
      return ipInCidr(data.ip, pattern);
    }
    // 2. Exact match
    if (
      pattern === data.ip ||
      pattern === data.asn ||
      pattern === data.host ||
      pattern === data.hostname ||
      pattern === data.netname
    ) {
      return true;
    }
    // 3. Wildcard suffix (*.example.com)
    if (pattern.startsWith("*.") && data.hostname) {
      return data.hostname.endsWith(pattern.slice(1));
    }
    if (pattern.startsWith("*.") && data.host) {
      return data.host.endsWith(pattern.slice(1));
    }
    // 4. Case-insensitive substring
    const lower = pattern.toLowerCase();
    if (data.organization?.toLowerCase().includes(lower)) return true;
    if (data.hostname?.toLowerCase().includes(lower)) return true;
    if (data.netname?.toLowerCase().includes(lower)) return true;
    if (data.host?.toLowerCase().includes(lower)) return true;

    return false;
  };

  for (const entry of hosters) {
    for (const pattern of entry.patterns) {
      // CIDR patterns have highest priority
      if (/^\d+\.\d+\.\d+\.\d+\/\d+$/.test(pattern) && data.ip) {
        if (ipInCidr(data.ip, pattern)) {
          return { entry, source: "cidr" };
        }
      }
    }
  }

  for (const entry of hosters) {
    for (const pattern of entry.patterns) {
      // Exact match
      if (
        pattern === data.ip ||
        pattern === data.asn ||
        pattern === data.host ||
        pattern === data.hostname ||
        pattern === data.netname
      ) {
        return { entry, source: "exact" };
      }
    }
  }

  for (const entry of hosters) {
    for (const pattern of entry.patterns) {
      // Wildcard suffix
      if (pattern.startsWith("*.") && data.hostname) {
        if (data.hostname.endsWith(pattern.slice(1))) {
          return { entry, source: "wildcard" };
        }
      }
      if (pattern.startsWith("*.") && data.host) {
        if (data.host.endsWith(pattern.slice(1))) {
          return { entry, source: "wildcard" };
        }
      }
    }
  }

  for (const entry of hosters) {
    for (const pattern of entry.patterns) {
      // Substring
      const lower = pattern.toLowerCase();
      if (data.organization?.toLowerCase().includes(lower)) {
        return { entry, source: "substring" };
      }
      if (data.hostname?.toLowerCase().includes(lower)) {
        return { entry, source: "substring" };
      }
      if (data.netname?.toLowerCase().includes(lower)) {
        return { entry, source: "substring" };
      }
      if (data.host?.toLowerCase().includes(lower)) {
        return { entry, source: "substring" };
      }
    }
  }

  return null;
}
