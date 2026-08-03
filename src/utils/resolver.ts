import { execSync } from "node:child_process";
import { IpInfo, MxRecord } from "../types.js";
import { HosterEntry, findHoster } from "./hosters.js";

export interface ResolverOptions {
  geoipDb: string;
  hosters: HosterEntry[] | null;
}

function exec(cmd: string): string {
  try {
    return execSync(cmd, { timeout: 30000, encoding: "utf-8" }).trim();
  } catch (e: any) {
    if (e?.stdout) {
      return e.stdout.toString().trim();
    }
    if (e?.stderr) {
      return e.stderr.toString().trim();
    }
    return "";
  }
}

function execWhois(target: string): string {
  const result = exec(`whois "${target}" 2>/dev/null`);
  return result;
}

function extractIp(hostname: string): string | null {
  const out = exec(`host "${hostname}" 2>/dev/null`);
  const match = out.match(/\b(\d+\.\d+\.\d+\.\d+)\b/);
  if (match) return match[1];
  const dig = exec(`dig +short "${hostname}" A 2>/dev/null`);
  if (dig) return dig.split("\n")[0].trim() || null;
  return null;
}

function extractPtr(ip: string): string | null {
  const out = exec(`host "${ip}" 2>/dev/null`);
  const match = out.match(/domain name pointer (.+)\.$/);
  return match ? match[1].replace(/\.$/, "") : null;
}

function extractOrg(whois: string): string | null {
  const patterns = [
    /^org-name:\s*(.+)$/im,
    /^organisation:\s*(.+)$/im,
    /^owner:\s*(.+)$/im,
    /^netname:\s*(.+)$/im,
  ];
  for (const re of patterns) {
    const m = whois.match(re);
    if (m) {
      const val = m[1].trim();
      if (val) return val;
    }
  }
  return null;
}

function extractOrgCymru(ip: string): string | null {
  const cymru = exec(`whois -h whois.cymru.com "${ip}" 2>/dev/null`);
  const parts = cymru.split("|");
  if (parts.length >= 3) return parts[2].trim();
  const cm = cymru.match(/\|\s*([^|]+)/);
  return cm ? cm[1].trim() : null;
}

function extractNetname(whois: string): string | null {
  const m = whois.match(/netname:\s*(.+)/i);
  return m ? m[1].trim() : null;
}

function extractCountry(geoipDb: string, ip: string): { code: string | null; name: string | null } {
  const out = exec(`mmdblookup --file "${geoipDb}" --ip "${ip}" country iso_code 2>/dev/null`);
  const code = out.match(/"([A-Z]{2})"/)?.[1] ?? null;
  const nameOut = exec(`mmdblookup --file "${geoipDb}" --ip "${ip}" country names en 2>/dev/null`);
  const name = nameOut.match(/"([^"]+)"/)?.[1] ?? null;
  return { code, name };
}

export function resolveHost(hostOrIp: string, options: ResolverOptions): IpInfo {
  const ip = /^\d+\.\d+\.\d+\.\d+$/.test(hostOrIp) ? hostOrIp : extractIp(hostOrIp);
  if (!ip) {
    return {
      ip: "",
      hostname: null,
      organization: null,
      country: null,
      country_name: null,
    };
  }

  const hostname = extractPtr(ip) || hostOrIp;
  const ipWhois = execWhois(ip);
  let whoisOrg = extractOrg(ipWhois);
  if (!whoisOrg) {
    whoisOrg = extractOrgCymru(ip);
  }
  const netname = extractNetname(ipWhois);

  let organization = whoisOrg;
  let countryCode: string | null = null;
  let countryName: string | null = null;

  const { code, name } = extractCountry(options.geoipDb, ip);
  countryCode = code;
  countryName = name;

  if (options.hosters) {
    const match = findHoster(options.hosters, {
      ip,
      asn: null,
      host: hostOrIp,
      hostname,
      netname,
      organization,
    });
    if (match) {
      organization = match.entry.organization;
      countryCode = match.entry.country || countryCode;
      countryName = match.entry.country_name || countryName;
    }
  }

  return {
    ip,
    hostname,
    organization,
    country: countryCode,
    country_name: countryName,
  };
}

export function resolveHostname(hostname: string, options: ResolverOptions): IpInfo {
  return resolveHost(hostname, options);
}

export function resolveMx(domain: string, options: ResolverOptions): MxRecord[] {
  const out = exec(`host -t MX "${domain}" 2>/dev/null`);
  if (!out) return [];

  const records: MxRecord[] = [];
  const lines = out.split("\n");
  for (const line of lines) {
    const m = line.match(/handled by\s+(\d+)\s+(\S+)/);
    if (!m) continue;
    const priority = parseInt(m[1], 10);
    const mxHost = m[2].replace(/\.$/, "");
    const ipInfo = resolveHost(mxHost, options);
    records.push({ host: mxHost, priority, ip_info: ipInfo });
  }

  return records;
}
