#!/usr/bin/env node

import {
  readFileSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchPage } from "./utils/fetcher.js";
import {
  resolveHostname,
  resolveMx,
  ResolverOptions,
} from "./utils/resolver.js";
import { extractResources } from "./utils/extractor.js";
import { loadHosters, findHoster } from "./utils/hosters.js";
import { UrlResult, Summary, ExternalResource } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = resolve(__dirname, "..");

const args = process.argv.slice(2);
const forceRescan = args.includes("--force");
const filteredArgs = args.filter((arg) => arg !== "--force");

const [
  urlsFileArg = `${PROJECT_DIR}/data/urls.txt`,
  outputDirArg = `${PROJECT_DIR}/output`,
  parallelJobsArg = "8",
  timeoutArg = "30",
] = filteredArgs;

const URLS_FILE = resolve(urlsFileArg);
const OUTPUT_DIR = resolve(outputDirArg);
const PARALLEL_JOBS = parseInt(parallelJobsArg, 10) || 4;
const TIMEOUT = parseInt(timeoutArg, 10) || 30;
const GEOIP_DB = `${OUTPUT_DIR}/geoip/GeoLite2-Country.mmdb`;
const RESULTS_DIR = `${OUTPUT_DIR}/results`;
const ERROR_LOG = `${OUTPUT_DIR}/raw/logs/errors.log`;

mkdirSync(RESULTS_DIR, { recursive: true });
mkdirSync(`${OUTPUT_DIR}/raw/logs`, { recursive: true });

const hostersFilePath = `${PROJECT_DIR}/data/hosters.json`;
const hostersData = existsSync(hostersFilePath)
  ? loadHosters(hostersFilePath)
  : null;

const resolverOptions: ResolverOptions = {
  geoipDb: GEOIP_DB,
  hosters: hostersData,
};

function slug(url: string): string {
  return (
    url
      .replace(/^https?:\/\//i, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .substring(0, 100) || "unknown"
  );
}

function logError(url: string, type: string, msg: string) {
  const ts = new Date().toISOString();
  const line = `[${ts}] FAIL: ${url} | Type: ${type} | Message: ${msg}`;
  writeFileSync(ERROR_LOG, line + "\n", { flag: "a" });
  console.error(line);
}

async function processUrl(rawUrl: string): Promise<UrlResult> {
  const s = slug(rawUrl);

  console.log(`Fetching: ${rawUrl}`);

  let fetchResult;
  try {
    fetchResult = await fetchPage(rawUrl, TIMEOUT * 1000);
  } catch (err: any) {
    logError(rawUrl, "fetch", err?.message || String(err));
    return {
      url: rawUrl,
      final_url: rawUrl,
      hostname: rawUrl,
      ip_info: null,
      mx: [],
      resources: [],
      cookies: [],
      timestamp: new Date().toISOString(),
    };
  }

  const { html, finalUrl, cookies } = fetchResult;

  let hostname: string;
  try {
    hostname = new URL(finalUrl).hostname;
  } catch {
    hostname = finalUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }

  const ipInfo = resolveHostname(hostname, resolverOptions);
  const mx = resolveMx(hostname, resolverOptions);
  const rawResources = extractResources(html, finalUrl);

  const resources: ExternalResource[] = [];
  for (const res of rawResources) {
    let resHostname: string;
    try {
      resHostname = new URL(res.url).hostname;
    } catch {
      continue;
    }
    const resIpInfo = resolveHostname(resHostname, resolverOptions);
    resources.push({ ...res, ip_info: resIpInfo });
  }

  const cookiesWithIp = cookies.map((c) => {
    const domain = c.domain.startsWith(".") ? c.domain.slice(1) : c.domain;
    const cookieIpInfo = resolveHostname(domain, resolverOptions);
    return { ...c, ip_info: cookieIpInfo };
  });

  return {
    url: rawUrl,
    final_url: finalUrl,
    hostname,
    ip_info: ipInfo,
    mx,
    resources,
    cookies: cookiesWithIp,
    timestamp: new Date().toISOString(),
  };
}

async function main() {
  console.log("========================================");
  console.log("  SCAN DE SOUVERAINETE WEB");
  console.log("========================================");

  if (!existsSync(URLS_FILE)) {
    console.error(`ERROR: URL file not found: ${URLS_FILE}`);
    process.exit(1);
  }

  if (!existsSync(GEOIP_DB)) {
    console.warn(
      `[WARN] GeoIP DB not found: ${GEOIP_DB} (géolocalisation désactivée)`,
    );
  }

  const urls = readFileSync(URLS_FILE, "utf-8")
    .split("\n")
    .map((l) => l.replace(/#.*$/, "").trim())
    .filter(Boolean);

  // Remove stale per-URL results from previous runs
  const expectedSlugs = new Set(urls.map((u) => slug(u)));
  if (existsSync(RESULTS_DIR)) {
    for (const f of readdirSync(RESULTS_DIR)) {
      if (f.endsWith(".json") && f !== "_summary.json" && f !== "urls.json") {
        const key = f.replace(/\.json$/, "");
        if (!expectedSlugs.has(key)) {
          rmSync(`${RESULTS_DIR}/${f}`, { force: true });
          console.log(`[CLEAN] Removed stale result: ${f}`);
        }
      }
    }
  }

  // Filter out URLs that already have a result file unless --force is set
  const urlsToProcess: string[] = [];
  const skippedUrls: string[] = [];

  for (const rawUrl of urls) {
    const resultFile = `${RESULTS_DIR}/${slug(rawUrl)}.json`;
    if (existsSync(resultFile) && !forceRescan) {
      // Check if the existing file has valid data (ip_info is not null)
      try {
        const existingResult = JSON.parse(readFileSync(resultFile, "utf-8"));
        if (existingResult.ip_info !== null) {
          skippedUrls.push(rawUrl);
          continue;
        }
      } catch {
        // If file is corrupted, reprocess it
        urlsToProcess.push(rawUrl);
        continue;
      }
    }
    urlsToProcess.push(rawUrl);
  }

  if (skippedUrls.length > 0) {
    console.log(
      `[SKIP] Skipping ${skippedUrls.length} URLs with existing valid data.`,
    );
    if (forceRescan) {
      console.log("[FORCE] Re-scanning all URLs due to --force flag.");
    }
  }

  console.log(
    `URLs to process: ${urlsToProcess.length} (skipped: ${skippedUrls.length})`,
  );
  console.log(`Parallel jobs: ${PARALLEL_JOBS}`);
  console.log(`Timeout per URL: ${TIMEOUT}s`);
  console.log("----------------------------------------");

  let aborted = false;
  const results: UrlResult[] = [];

  process.on("SIGINT", () => {
    console.log("\n[INTERRUPT] Aborting...");
    aborted = true;
  });

  let index = 0;
  async function worker(): Promise<void> {
    while (!aborted) {
      const i = index++;
      if (i >= urlsToProcess.length) return;
      const rawUrl = urlsToProcess[i];
      try {
        const result = await processUrl(rawUrl);
        results.push(result);
        const resultFile = `${RESULTS_DIR}/${slug(rawUrl)}.json`;
        writeFileSync(resultFile, JSON.stringify(result, null, 2));
        console.log(`[OK] ${rawUrl} -> ${resultFile}`);
      } catch (err: any) {
        logError(rawUrl, "process", err?.message || String(err));
      }
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < PARALLEL_JOBS; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  if (aborted) {
    console.log("[INTERRUPT] Scan interrupted.");
    process.exit(130);
  }

  // Summary
  console.log("[SUMMARY] Generating summary files...");

  const succeeded = results.filter((r) => r.ip_info !== null);
  const failed = results.filter((r) => r.ip_info === null);

  // Include skipped URLs (with existing valid data) in the succeeded count
  const totalValidUrls = succeeded.length + skippedUrls.length;

  const countries: Record<string, number> = {};
  const organizations: Record<string, number> = {};
  const dependencies: Record<string, number> = {};
  const depsByCountry: Record<string, number> = {};
  const nonFrDeps: Array<{
    source_url: string;
    domain: string;
    organization: string | null;
    country: string | null;
    country_name: string | null;
  }> = [];
  const nonFrHosted: Array<{
    url: string;
    hostname: string;
    organization: string | null;
    country: string | null;
    country_name: string | null;
  }> = [];
  const nonFrMx: Array<{
    url: string;
    hostname: string;
    organization: string | null;
    country: string | null;
    country_name: string | null;
  }> = [];
  const orgsCountry: Record<string, string> = {};
  const mxHosters: Record<string, number> = {};
  const mxHostersCountry: Record<string, string> = {};
  // Process skipped URLs (existing valid data) for summary computation
  for (const skippedUrl of skippedUrls) {
    try {
      const resultFile = `${RESULTS_DIR}/${slug(skippedUrl)}.json`;
      const existingResult = JSON.parse(readFileSync(resultFile, "utf-8"));

      // Include existing data in summary computations
      const ip = existingResult.ip_info;
      if (ip?.country) {
        countries[ip.country] = (countries[ip.country] || 0) + 1;
        if (ip.country !== "FR") {
          nonFrHosted.push({
            url: skippedUrl,
            hostname: existingResult.hostname,
            organization: ip.organization,
            country: ip.country,
            country_name: ip.country_name,
          });
        }
      }
      if (ip?.organization) {
        organizations[ip.organization] =
          (organizations[ip.organization] || 0) + 1;
        if (ip.country && !orgsCountry[ip.organization]) {
          orgsCountry[ip.organization] = ip.country;
        }
      }

      // Process resources from existing data
      for (const res of existingResult.resources || []) {
        let domain: string;
        try {
          domain = new URL(res.url).hostname.replace(/^www\./, "");
        } catch {
          continue;
        }
        dependencies[domain] = (dependencies[domain] || 0) + 1;
        const depCountry = res.ip_info?.country;
        if (depCountry)
          depsByCountry[depCountry] = (depsByCountry[depCountry] || 0) + 1;
        if (depCountry && depCountry !== "FR") {
          nonFrDeps.push({
            source_url: skippedUrl,
            domain,
            organization: res.ip_info?.organization ?? null,
            country: depCountry,
            country_name: res.ip_info?.country_name ?? null,
          });
        }
      }

      // Process MX records from existing data
      for (const mx of existingResult.mx || []) {
        if (mx.ip_info?.organization) {
          mxHosters[mx.ip_info.organization] =
            (mxHosters[mx.ip_info.organization] || 0) + 1;
          if (
            mx.ip_info.country &&
            !mxHostersCountry[mx.ip_info.organization]
          ) {
            mxHostersCountry[mx.ip_info.organization] = mx.ip_info.country;
          }
        }
        if (mx.ip_info?.country && mx.ip_info.country !== "FR") {
          nonFrMx.push({
            url: skippedUrl,
            hostname: mx.host,
            organization: mx.ip_info.organization,
            country: mx.ip_info.country,
            country_name: mx.ip_info.country_name,
          });
        }
      }
    } catch {
      // Skip corrupted files
      continue;
    }
  }

  for (const r of succeeded) {
    const ip = r.ip_info;
    if (ip?.country) {
      countries[ip.country] = (countries[ip.country] || 0) + 1;
      if (ip.country !== "FR") {
        nonFrHosted.push({
          url: r.url,
          hostname: r.hostname,
          organization: ip.organization,
          country: ip.country,
          country_name: ip.country_name,
        });
      }
    }
    if (ip?.organization) {
      organizations[ip.organization] =
        (organizations[ip.organization] || 0) + 1;
      if (ip.country && !orgsCountry[ip.organization]) {
        orgsCountry[ip.organization] = ip.country;
      }
    }
    if (!orgsCountry[ip?.organization ?? ""] && hostersData) {
      const hMatch = findHoster(hostersData, {
        ip: ip?.ip ?? null,
        asn: null,
        host: null,
        hostname: ip?.hostname ?? null,
        netname: null,
        organization: ip?.organization ?? null,
      });
      if (hMatch && hMatch.entry.country) {
        orgsCountry[ip!.organization!] = hMatch.entry.country;
      }
    }

    for (const res of r.resources) {
      let domain: string;
      try {
        domain = new URL(res.url).hostname.replace(/^www\./, "");
      } catch {
        continue;
      }
      dependencies[domain] = (dependencies[domain] || 0) + 1;
      const depCountry = res.ip_info?.country;
      if (depCountry)
        depsByCountry[depCountry] = (depsByCountry[depCountry] || 0) + 1;
      if (depCountry && depCountry !== "FR") {
        nonFrDeps.push({
          source_url: r.url,
          domain,
          organization: res.ip_info?.organization ?? null,
          country: depCountry,
          country_name: res.ip_info?.country_name ?? null,
        });
      }
    }

    for (const mx of r.mx) {
      if (mx.ip_info?.organization) {
        mxHosters[mx.ip_info.organization] =
          (mxHosters[mx.ip_info.organization] || 0) + 1;
        if (mx.ip_info.country && !mxHostersCountry[mx.ip_info.organization]) {
          mxHostersCountry[mx.ip_info.organization] = mx.ip_info.country;
        }
        if (!mxHostersCountry[mx.ip_info.organization] && hostersData) {
          const hMatch = findHoster(hostersData, {
            ip: mx.ip_info.ip,
            asn: null,
            host: mx.host,
            hostname: mx.ip_info.hostname,
            netname: null,
            organization: mx.ip_info.organization,
          });
          if (hMatch && hMatch.entry.country) {
            mxHostersCountry[mx.ip_info.organization] = hMatch.entry.country;
          }
        }
      }
      if (mx.ip_info?.country && mx.ip_info.country !== "FR") {
        nonFrMx.push({
          url: r.url,
          hostname: mx.host,
          organization: mx.ip_info.organization,
          country: mx.ip_info.country,
          country_name: mx.ip_info.country_name,
        });
      }
    }
  }

  const summary: Summary = {
    timestamp: new Date().toISOString(),
    stats: {
      total: totalValidUrls + failed.length,
      success: totalValidUrls,
      failed: failed.length,
    },
    hosting: { countries, organizations, organizations_country: orgsCountry },
    dependencies,
    dependencies_by_country: depsByCountry,
    non_fr_dependencies: Array.from(
      new Map(
        nonFrDeps.map((d) => [`${d.source_url}|${d.domain}`, d]),
      ).values(),
    ),
    non_fr_hosted_urls: nonFrHosted,
    non_fr_mx_urls: nonFrMx,
    mx_hosters: mxHosters,
    mx_hosters_country: mxHostersCountry,
  };

  writeFileSync(
    `${RESULTS_DIR}/_summary.json`,
    JSON.stringify(summary, null, 2),
  );
  console.log("[OK] Summary files generated.");

  console.log("========================================");
  console.log("  SCAN COMPLETE");
  console.log("========================================");
  console.log(`Results: ${RESULTS_DIR}/`);
  console.log(`  - urls/*.json: Per-URL results`);
  console.log(`  - _summary.json: Global stats`);
  console.log(`Errors: ${ERROR_LOG}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
