#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Summary } from "./types.js";

const [
  summaryPath = "output/results/_summary.json",
  outputPath = "output/report.html",
] = process.argv.slice(2);

const summary: Summary = JSON.parse(
  readFileSync(resolve(summaryPath), "utf-8"),
);

const {
  stats,
  hosting,
  dependencies_by_country,
  non_fr_dependencies,
  non_fr_hosted_urls,
  non_fr_mx_urls,
  mx_hosters,
  timestamp,
} = summary;

const totalSites = stats.total;
const validSites = stats.success;
const frHosted = hosting.countries["FR"] ?? 0;
const frPercent =
  validSites > 0 ? Math.round((frHosted / validSites) * 100) : 0;
const nonFrHostedCount = non_fr_hosted_urls.length;
const nonFrMxCount = non_fr_mx_urls.length;
const nonFrDepCount = non_fr_dependencies.length;

const frDeps = dependencies_by_country["FR"] ?? 0;
const totalDeps = Object.values(dependencies_by_country).reduce(
  (a, b) => a + b,
  0,
);
const frDepsPercent =
  totalDeps > 0 ? Math.round((frDeps / totalDeps) * 100) : 0;
const score = Math.round((frPercent + frDepsPercent) / 2);

const countriesList = Object.entries(hosting.countries).sort(
  (a, b) => b[1] - a[1],
);
const orgsList = Object.entries(hosting.organizations).sort(
  (a, b) => b[1] - a[1],
);
const depsByCountrySorted = Object.entries(dependencies_by_country).sort(
  (a, b) => b[1] - a[1],
);
const mxHostersSorted = Object.entries(mx_hosters).sort((a, b) => b[1] - a[1]);

const countryFlag: Record<string, string> = {
  FR: "🇫🇷",
  US: "🇺🇸",
  DE: "🇩🇪",
  GB: "🇬🇧",
  NL: "🇳🇱",
  CH: "🇨🇭",
  LU: "🇱🇺",
  BE: "🇧🇪",
  CA: "🇨🇦",
  JP: "🇯🇵",
  AU: "🇦🇺",
  CZ: "🇨🇿",
  LT: "🇱🇹",
  IE: "🇮🇪",
  SE: "🇸🇪",
  ES: "🇪🇸",
  IT: "🇮🇹",
  PT: "🇵🇹",
  PL: "🇵🇱",
  AT: "🇦🇹",
  DK: "🇩🇰",
  FI: "🇫🇮",
  NO: "🇳🇴",
};

const grade =
  score >= 90
    ? "A+"
    : score >= 75
      ? "A"
      : score >= 60
        ? "B"
        : score >= 40
          ? "C"
          : "D";

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rapport de Souveraineté Numérique</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; }
  h1 { font-size: 1.8rem; margin-bottom: 0.25rem; background: linear-gradient(135deg, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .date { color: #64748b; font-size: 0.85rem; margin-bottom: 1.5rem; }

  /* Social recap card */
  .social-recap { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border: 1px solid #334155; border-radius: 1rem; padding: 1.5rem 2rem; margin-bottom: 2rem; display: flex; flex-wrap: wrap; align-items: center; gap: 1.5rem; }
  .social-recap .grade-box { background: ${score >= 75 ? "linear-gradient(135deg, #166534, #15803d)" : score >= 50 ? "linear-gradient(135deg, #92400e, #a16207)" : "linear-gradient(135deg, #7f1d1d, #991b1b)"}; border: 1px solid ${score >= 75 ? "#22c55e" : score >= 50 ? "#eab308" : "#ef4444"}; border-radius: 1rem; padding: 0.75rem 1.5rem; text-align: center; min-width: 100px; }
  .social-recap .grade-box .grade { font-size: 2rem; font-weight: 900; }
  .social-recap .grade-box .label { font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; }
  .social-recap .stat { text-align: center; min-width: 100px; }
  .social-recap .stat .value { font-size: 1.5rem; font-weight: 800; }
  .social-recap .stat .value.good { color: #4ade80; }
  .social-recap .stat .value.warn { color: #fbbf24; }
  .social-recap .stat .value.bad { color: #f87171; }
  .social-recap .stat .label { font-size: 0.75rem; color: #94a3b8; margin-top: 0.15rem; }

  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
  .card { background: #1e293b; border-radius: 1rem; padding: 1.5rem; border: 1px solid #334155; }
  .card h2 { font-size: 1.1rem; margin-bottom: 1rem; color: #38bdf8; }

  table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
  th { text-align: left; padding: 0.5rem 0.5rem; color: #94a3b8; border-bottom: 1px solid #334155; font-weight: 500; }
  td { padding: 0.5rem; border-bottom: 1px solid #1e293b; }
  .bar-cell { display: flex; align-items: center; gap: 0.5rem; }
  .bar { height: 8px; border-radius: 4px; background: linear-gradient(90deg, #38bdf8, #818cf8); min-width: 4px; }
  .bar-bg { flex: 1; background: #334155; border-radius: 4px; height: 8px; }
  .num { font-variant-numeric: tabular-nums; text-align: right; min-width: 2.5rem; }

  .warn { color: #fbbf24; }
  .good { color: #4ade80; }
  .bad { color: #f87171; }

  .flag { font-size: 1.2rem; }
  .chip { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.75rem; background: #334155; margin: 0.1rem; }
  .chip.fr { background: #166534; color: #bbf7d0; }
  .chip.us { background: #1e3a5f; color: #93c5fd; }

  .detail-section { margin-top: 1rem; }
  .detail-item { padding: 0.5rem 0; border-bottom: 1px solid #334155; font-size: 0.85rem; }
  .detail-item:last-child { border-bottom: none; }
  .detail-url { color: #93c5fd; word-break: break-all; }
  .detail-org { color: #c084fc; }
</style>
</head>
<body>

<h1>🔭 Rapport de Souveraineté Numérique</h1>
<p class="date">${new Date(timestamp).toLocaleDateString("fr-FR", { dateStyle: "long" })} &middot; ${totalSites} sites audités (${validSites} valides)</p>

<div class="social-recap">
  <div class="grade-box">
    <div class="grade">${grade}</div>
    <div class="label">Score</div>
  </div>
  <div class="stat">
    <div class="value ${frPercent >= 80 ? "good" : frPercent >= 50 ? "warn" : "bad"}">${frPercent}%</div>
    <div class="label">hébergés en France</div>
  </div>
  <div class="stat">
    <div class="value ${frDepsPercent >= 80 ? "good" : frDepsPercent >= 50 ? "warn" : "bad"}">${frDepsPercent}%</div>
    <div class="label">ressources en France</div>
  </div>
  <div class="stat">
    <div class="value ${nonFrHostedCount + nonFrDepCount === 0 ? "good" : "warn"}">${nonFrHostedCount}</div>
    <div class="label">sites hors 🇫🇷</div>
  </div>
  <div class="stat">
    <div class="value ${nonFrDepCount === 0 ? "good" : "warn"}">${nonFrDepCount}</div>
    <div class="label">ressources hors 🇫🇷</div>
  </div>
  <div class="stat">
    <div class="value">${totalDeps}</div>
    <div class="label">ressources totales</div>
  </div>
</div>

<div class="grid">
  <div class="card">
    <h2>🏢 Hébergeurs (sites)</h2>
    ${
      orgsList.length
        ? `<table>
      <thead><tr><th>Hébergeur</th><th>Pays</th><th></th><th class="num">Sites</th></tr></thead>
      <tbody>${orgsList
        .map(([name, count]) => {
          const max = orgsList[0][1];
          const bw = Math.round((count / max) * 100);
          const orgCountry = summary.hosting.organizations_country?.[name];
          const flag = orgCountry ? countryFlag[orgCountry] || "" : "";
          return `<tr><td>${name}</td><td>${flag} ${orgCountry || ""}</td><td class="bar-cell"><div class="bar-bg"><div class="bar" style="width:${bw}%"></div></div></td><td class="num">${count}</td></tr>`;
        })
        .join("")}</tbody>
    </table>`
        : '<p class="subtitle">Aucune donnée</p>'
    }
  </div>

  <div class="card">
    <h2>🌍 Pays d'hébergement (sites)</h2>
    ${
      countriesList.length
        ? `<table>
      <thead><tr><th>Pays</th><th></th><th class="num">Sites</th></tr></thead>
      <tbody>${countriesList
        .map(([code, count]) => {
          const max = countriesList[0][1];
          const bw = Math.round((count / max) * 100);
          return `<tr><td><span class="flag">${countryFlag[code] || ""}</span> ${code}</td><td class="bar-cell"><div class="bar-bg"><div class="bar" style="width:${bw}%"></div></div></td><td class="num">${count}</td></tr>`;
        })
        .join("")}</tbody>
    </table>`
        : '<p class="subtitle">Aucune donnée</p>'
    }
  </div>
</div>

<div class="grid">
  <div class="card">
    <h2>📦 Ressources externes par pays</h2>
    ${
      depsByCountrySorted.length
        ? `<table>
      <thead><tr><th>Pays</th><th></th><th class="num">Ressources</th></tr></thead>
      <tbody>${depsByCountrySorted
        .map(([code, count]) => {
          const max = depsByCountrySorted[0][1];
          const bw = Math.round((count / max) * 100);
          return `<tr><td><span class="flag">${countryFlag[code] || ""}</span> ${code}</td><td class="bar-cell"><div class="bar-bg"><div class="bar" style="width:${bw}%"></div></div></td><td class="num">${count}</td></tr>`;
        })
        .join("")}</tbody>
    </table>`
        : '<p class="subtitle">Aucune donnée</p>'
    }
  </div>

  <div class="card">
    <h2>✉️ Hébergeurs MX</h2>
    ${
      mxHostersSorted.length
        ? `<table>
      <thead><tr><th>Hébergeur</th><th>Pays</th><th></th><th class="num">Sites</th></tr></thead>
      <tbody>${mxHostersSorted
        .map(([name, count]) => {
          const max = mxHostersSorted[0][1];
          const bw = Math.round((count / max) * 100);
          const mxCountry = summary.mx_hosters_country?.[name];
          const flag = mxCountry ? countryFlag[mxCountry] || "" : "";
          return `<tr><td>${name}</td><td>${flag} ${mxCountry || ""}</td><td class="bar-cell"><div class="bar-bg"><div class="bar" style="width:${bw}%"></div></div></td><td class="num">${count}</td></tr>`;
        })
        .join("")}</tbody>
    </table>`
        : '<p class="subtitle">Aucune donnée</p>'
    }
  </div>
</div>

${
  nonFrHostedCount > 0
    ? `<div class="card" style="margin-bottom:1.5rem">
  <h2 style="color:#f87171">⚠️ Sites hébergés hors de France</h2>
  ${non_fr_hosted_urls
    .map(
      (e) => `<div class="detail-item">
    <div class="detail-url">${e.url}</div>
    <div><span class="chip us">${e.organization || "?"}</span> <span class="chip">${countryFlag[e.country || ""] || ""} ${e.country_name || e.country}</span></div>
  </div>`,
    )
    .join("")}
</div>`
    : ""
}

${
  nonFrMxCount > 0
    ? `<div class="card" style="margin-bottom:1.5rem">
  <h2 style="color:#fbbf24">📧 Serveurs MX hébergés hors de France</h2>
  ${non_fr_mx_urls
    .map(
      (e) => `<div class="detail-item">
    <div class="detail-url">${e.url}</div>
    <div>MX: ${e.hostname} — <span class="chip us">${e.organization || "?"}</span> <span class="chip">${countryFlag[e.country || ""] || ""} ${e.country_name || e.country}</span></div>
  </div>`,
    )
    .join("")}
</div>`
    : ""
}

${
  nonFrDepCount > 0
    ? `<div class="card" style="margin-bottom:1.5rem">
  <h2 style="color:#fbbf24">🔗 Ressources externes hors de France</h2>
  ${(() => {
    const bySource: Record<
      string,
      { source_url: string; orgCounts: Record<string, number> }
    > = {};
    for (const d of non_fr_dependencies) {
      if (!bySource[d.source_url])
        bySource[d.source_url] = { source_url: d.source_url, orgCounts: {} };
      const org = d.organization || "?";
      bySource[d.source_url].orgCounts[org] =
        (bySource[d.source_url].orgCounts[org] || 0) + 1;
    }
    return Object.values(bySource)
      .map((e) => {
        const orgs = Object.entries(e.orgCounts)
          .map(
            ([org, count]) => `<span class="chip us">${org}: ${count}</span>`,
          )
          .join(" ");
        return `<div class="detail-item"><div class="detail-url">${e.source_url}</div><div>${orgs}</div></div>`;
      })
      .join("");
  })()}
</div>`
    : ""
}

<p style="text-align:center;margin-top:2rem;color:#64748b;font-size:0.8rem">
  Rapport généré le ${new Date().toLocaleDateString("fr-FR", { dateStyle: "long" })} — Scan Souveraineté
</p>
</body>
</html>`;

writeFileSync(resolve(outputPath), html, "utf-8");
console.log(`Report generated: ${outputPath}`);
