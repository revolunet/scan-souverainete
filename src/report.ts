#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Summary } from "./types.js";

const [summaryPath = "output/results/_summary.json", outputPath = "output/report.html"] = process.argv.slice(2);

const summary: Summary = JSON.parse(readFileSync(resolve(summaryPath), "utf-8"));

const { stats, hosting, dependencies_by_country, non_fr_dependencies, non_fr_hosted_urls, non_fr_mx_urls, mx_hosters, timestamp } = summary;

const totalSites = stats.total;
const frHosted = hosting.countries["FR"] ?? 0;
const frPercent = totalSites > 0 ? Math.round((frHosted / totalSites) * 100) : 0;
const nonFrHostedCount = non_fr_hosted_urls.length;
const nonFrMxCount = non_fr_mx_urls.length;
const nonFrDepCount = non_fr_dependencies.length;

const frDeps = dependencies_by_country["FR"] ?? 0;
const totalDeps = Object.values(dependencies_by_country).reduce((a, b) => a + b, 0);
const frDepsPercent = totalDeps > 0 ? Math.round((frDeps / totalDeps) * 100) : 0;

const countriesList = Object.entries(hosting.countries).sort((a, b) => b[1] - a[1]);
const orgsList = Object.entries(hosting.organizations).sort((a, b) => b[1] - a[1]);
const depsByCountrySorted = Object.entries(dependencies_by_country).sort((a, b) => b[1] - a[1]);
const mxHostersSorted = Object.entries(mx_hosters).sort((a, b) => b[1] - a[1]);

const countryFlag: Record<string, string> = {
  FR: "🇫🇷", US: "🇺🇸", DE: "🇩🇪", GB: "🇬🇧", NL: "🇳🇱",
  CH: "🇨🇭", LU: "🇱🇺", BE: "🇧🇪", CA: "🇨🇦", JP: "🇯🇵",
  AU: "🇦🇺", CZ: "🇨🇿", LT: "🇱🇹", IE: "🇮🇪", SE: "🇸🇪",
  ES: "🇪🇸", IT: "🇮🇹", PT: "🇵🇹", PL: "🇵🇱", AT: "🇦🇹",
  DK: "🇩🇰", FI: "🇫🇮", NO: "🇳🇴",
};

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rapport de Souveraineté Numérique</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; }
  h1 { font-size: 2rem; margin-bottom: 0.5rem; background: linear-gradient(135deg, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .subtitle { color: #94a3b8; margin-bottom: 2rem; }
  .date { color: #64748b; font-size: 0.875rem; margin-bottom: 2rem; }

  .score-ring { display: flex; gap: 2rem; justify-content: center; flex-wrap: wrap; margin-bottom: 3rem; }
  .ring { text-align: center; }
  .ring canvas { width: 140px; height: 140px; }
  .ring-label { margin-top: 0.5rem; font-weight: 600; }
  .ring-sub { color: #94a3b8; font-size: 0.8rem; }

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

  .summary-badges { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
  .badge { background: #1e293b; border: 1px solid #334155; border-radius: 0.75rem; padding: 0.75rem 1.25rem; text-align: center; flex: 1; min-width: 100px; }
  .badge .value { font-size: 1.75rem; font-weight: 700; }
  .badge .label { font-size: 0.75rem; color: #94a3b8; margin-top: 0.25rem; }

  .detail-section { margin-top: 1rem; }
  .detail-item { padding: 0.5rem 0; border-bottom: 1px solid #334155; font-size: 0.85rem; }
  .detail-item:last-child { border-bottom: none; }
  .detail-url { color: #93c5fd; word-break: break-all; }
  .detail-org { color: #c084fc; }
</style>
</head>
<body>

<h1>🔭 Rapport de Souveraineté Numérique</h1>
<p class="subtitle">Analyse des dépendances externes, hébergement et infrastructure</p>
<p class="date">${new Date(timestamp).toLocaleDateString("fr-FR", { dateStyle: "long" })} &middot; ${totalSites} sites audités</p>

<div class="summary-badges">
  <div class="badge"><div class="value ${frPercent >= 80 ? 'good' : frPercent >= 50 ? 'warn' : 'bad'}">${frPercent}%</div><div class="label">sites hébergés en France</div></div>
  <div class="badge"><div class="value ${frDepsPercent >= 80 ? 'good' : frDepsPercent >= 50 ? 'warn' : 'bad'}">${frDepsPercent}%</div><div class="label">ressources en France</div></div>
  <div class="badge"><div class="value">${totalDeps}</div><div class="label">ressources externes</div></div>
  <div class="badge"><div class="value ${nonFrDepCount === 0 ? 'good' : 'warn'}">${nonFrDepCount}</div><div class="label">ressources hors 🇫🇷</div></div>
  <div class="badge"><div class="value ${nonFrHostedCount === 0 ? 'good' : 'warn'}">${nonFrHostedCount}</div><div class="label">sites hébergés hors 🇫🇷</div></div>
</div>

<div class="score-ring">
  <div class="ring">
    <canvas id="ringHosting" width="140" height="140"></canvas>
    <div class="ring-label">Hébergement</div>
    <div class="ring-sub">${frHosted} FR / ${totalSites} total</div>
  </div>
  <div class="ring">
    <canvas id="ringDeps" width="140" height="140"></canvas>
    <div class="ring-label">Ressources</div>
    <div class="ring-sub">${frDeps} FR / ${totalDeps} total</div>
  </div>
</div>

<div class="grid">
  <div class="card">
    <h2>🏢 Hébergeurs (sites)</h2>
    ${orgsList.length ? `<table>
      <thead><tr><th>Hébergeur</th><th>Pays</th><th></th><th class="num">Sites</th></tr></thead>
      <tbody>${orgsList.map(([name, count]) => {
        const max = orgsList[0][1];
        const bw = Math.round((count / max) * 100);
        const orgCountry = summary.hosting.organizations_country?.[name];
        const flag = orgCountry ? (countryFlag[orgCountry] || '') : '';
        return `<tr><td>${name}</td><td>${flag} ${orgCountry || ''}</td><td class="bar-cell"><div class="bar-bg"><div class="bar" style="width:${bw}%"></div></div></td><td class="num">${count}</td></tr>`;
      }).join("")}</tbody>
    </table>` : '<p class="subtitle">Aucune donnée</p>'}
  </div>

  <div class="card">
    <h2>🌍 Pays d'hébergement (sites)</h2>
    ${countriesList.length ? `<table>
      <thead><tr><th>Pays</th><th></th><th class="num">Sites</th></tr></thead>
      <tbody>${countriesList.map(([code, count]) => {
        const max = countriesList[0][1];
        const bw = Math.round((count / max) * 100);
        return `<tr><td><span class="flag">${countryFlag[code] || ''}</span> ${code} ${hosting.countries[code] ? `(${hosting.countries[code]})` : ''}</td><td class="bar-cell"><div class="bar-bg"><div class="bar" style="width:${bw}%"></div></div></td><td class="num">${count}</td></tr>`;
      }).join("")}</tbody>
    </table>` : '<p class="subtitle">Aucune donnée</p>'}
  </div>
</div>

<div class="grid">
  <div class="card">
    <h2>📦 Ressources externes par pays</h2>
    ${depsByCountrySorted.length ? `<table>
      <thead><tr><th>Pays</th><th></th><th class="num">Ressources</th></tr></thead>
      <tbody>${depsByCountrySorted.map(([code, count]) => {
        const max = depsByCountrySorted[0][1];
        const bw = Math.round((count / max) * 100);
        return `<tr><td><span class="flag">${countryFlag[code] || ''}</span> ${code}</td><td class="bar-cell"><div class="bar-bg"><div class="bar" style="width:${bw}%"></div></div></td><td class="num">${count}</td></tr>`;
      }).join("")}</tbody>
    </table>` : '<p class="subtitle">Aucune donnée</p>'}
  </div>

  <div class="card">
    <h2>✉️ Hébergeurs MX</h2>
    ${mxHostersSorted.length ? `<table>
      <thead><tr><th>Hébergeur</th><th>Pays</th><th></th><th class="num">Sites</th></tr></thead>
      <tbody>${mxHostersSorted.map(([name, count]) => {
        const max = mxHostersSorted[0][1];
        const bw = Math.round((count / max) * 100);
        const mxCountry = summary.mx_hosters_country?.[name];
        const flag = mxCountry ? (countryFlag[mxCountry] || '') : '';
        return `<tr><td>${name}</td><td>${flag} ${mxCountry || ''}</td><td class="bar-cell"><div class="bar-bg"><div class="bar" style="width:${bw}%"></div></div></td><td class="num">${count}</td></tr>`;
      }).join("")}</tbody>
    </table>` : '<p class="subtitle">Aucune donnée</p>'}
  </div>
</div>

${nonFrHostedCount > 0 ? `<div class="card" style="margin-bottom:1.5rem">
  <h2 style="color:#f87171">⚠️ Sites hébergés hors de France</h2>
  ${non_fr_hosted_urls.map(e => `<div class="detail-item">
    <div class="detail-url">${e.url}</div>
    <div><span class="chip us">${e.organization || '?'}</span> <span class="chip">${countryFlag[e.country || ''] || ''} ${e.country_name || e.country}</span></div>
  </div>`).join("")}
</div>` : ''}

${nonFrMxCount > 0 ? `<div class="card" style="margin-bottom:1.5rem">
  <h2 style="color:#fbbf24">📧 Serveurs MX hébergés hors de France</h2>
  ${non_fr_mx_urls.map(e => `<div class="detail-item">
    <div class="detail-url">${e.url}</div>
    <div>MX: ${e.hostname} — <span class="chip us">${e.organization || '?'}</span> <span class="chip">${countryFlag[e.country || ''] || ''} ${e.country_name || e.country}</span></div>
  </div>`).join("")}
</div>` : ''}

${nonFrDepCount > 0 ? `<div class="card" style="margin-bottom:1.5rem">
  <h2 style="color:#fbbf24">🔗 Ressources externes hors de France</h2>
  ${(() => {
    const bySource: Record<string, { source_url: string; orgCounts: Record<string, number> }> = {};
    for (const d of non_fr_dependencies) {
      if (!bySource[d.source_url]) bySource[d.source_url] = { source_url: d.source_url, orgCounts: {} };
      const org = d.organization || '?';
      bySource[d.source_url].orgCounts[org] = (bySource[d.source_url].orgCounts[org] || 0) + 1;
    }
    return Object.values(bySource).map(e => {
      const orgs = Object.entries(e.orgCounts).map(([org, count]) =>
        `<span class="chip us">${org}: ${count}</span>`
      ).join(' ');
      return `<div class="detail-item"><div class="detail-url">${e.source_url}</div><div>${orgs}</div></div>`;
    }).join("");
  })()}
</div>` : ''}

<div class="card">
  <h2>🏛️ Tous les hébergeurs rencontrés</h2>
  <table>
    <thead><tr><th>Organisation</th><th></th><th class="num">Sites</th></tr></thead>
    <tbody>${[...orgsList].sort((a, b) => b[1] - a[1]).map(([name, count]) => {
      const max = orgsList[0][1];
      const bw = Math.round((count / max) * 100);
      return `<tr><td>${name}</td><td class="bar-cell"><div class="bar-bg"><div class="bar" style="width:${bw}%"></div></div></td><td class="num">${count}</td></tr>`;
    }).join("")}</tbody>
  </table>
</div>

<script>
  function drawRing(canvasId, value, total, label, colors) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    const pct = total > 0 ? value / total : 0;
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [pct, 1 - pct],
          backgroundColor: [colors[0], '#334155'],
          borderWidth: 0,
        }]
      },
      options: {
        cutout: '75%',
        responsive: false,
        plugins: {
          tooltip: { enabled: false },
          legend: { display: false },
        }
      },
      plugins: [{
        id: 'centerText',
        afterDraw(chart) {
          const { ctx, width, height } = chart;
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = 'bold 28px sans-serif';
          ctx.fillStyle = '#e2e8f0';
          ctx.fillText(Math.round(pct * 100) + '%', width / 2, height / 2 - 8);
          ctx.font = '12px sans-serif';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(value + '/' + total, width / 2, height / 2 + 18);
          ctx.restore();
        }
      }]
    });
  }
  drawRing('ringHosting', ${frHosted}, ${totalSites}, 'Hébergement', ['#4ade80']);
  drawRing('ringDeps', ${frDeps}, ${totalDeps}, 'Ressources', ['#38bdf8']);
</script>

<p style="text-align:center;margin-top:2rem;color:#64748b;font-size:0.8rem">
  Rapport généré le ${new Date().toLocaleDateString("fr-FR", { dateStyle: "long" })} — Scan Souveraineté
</p>
</body>
</html>`;

writeFileSync(resolve(outputPath), html, "utf-8");
console.log(`Report generated: ${outputPath}`);
