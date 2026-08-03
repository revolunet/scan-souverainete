#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Summary } from "./types.js";
import puppeteer from "puppeteer";

const CHROME_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;

const [summaryPath = "output/results/_summary.json", outputPath = "output/social.png"] = process.argv.slice(2);

const summary: Summary = JSON.parse(readFileSync(resolve(summaryPath), "utf-8"));
const { stats, hosting, dependencies_by_country, non_fr_dependencies, non_fr_hosted_urls, non_fr_mx_urls } = summary;

const totalSites = stats.total;
const frHosted = hosting.countries["FR"] ?? 0;
const frPercent = Math.round((frHosted / totalSites) * 100);
const nonFrHostedCount = non_fr_hosted_urls.length;
const nonFrDepCount = non_fr_dependencies.length;
const frDeps = dependencies_by_country["FR"] ?? 0;
const totalDeps = Object.values(dependencies_by_country).reduce((a, b) => a + b, 0);
const frDepsPercent = Math.round((frDeps / totalDeps) * 100);
const score = Math.round((frPercent + frDepsPercent) / 2);

const orgsList = Object.entries(hosting.organizations).sort((a, b) => b[1] - a[1]).slice(0, 5);
const countriesList = Object.entries(hosting.countries).sort((a, b) => b[1] - a[1]).slice(0, 5);

const countryFlag: Record<string, string> = {
  FR: "🇫🇷", US: "🇺🇸", DE: "🇩🇪", GB: "🇬🇧", NL: "🇳🇱",
  CH: "🇨🇭", LU: "🇱🇺", BE: "🇧🇪", CA: "🇨🇦", JP: "🇯🇵",
  AU: "🇦🇺", CZ: "🇨🇿", LT: "🇱🇹", IE: "🇮🇪", SE: "🇸🇪",
};

const grade = score >= 90 ? "A+" : score >= 75 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D";

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, sans-serif;
    width: 1200px; height: 675px;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
    color: #e2e8f0;
    display: flex; flex-direction: column;
    padding: 2.5rem 3rem;
    position: relative;
    overflow: hidden;
  }
  body::before {
    content: '';
    position: absolute;
    top: -200px; right: -200px;
    width: 500px; height: 500px;
    background: radial-gradient(circle, rgba(56,189,248,0.08) 0%, transparent 70%);
    border-radius: 50%;
  }
  body::after {
    content: '';
    position: absolute;
    bottom: -150px; left: -150px;
    width: 400px; height: 400px;
    background: radial-gradient(circle, rgba(129,140,248,0.06) 0%, transparent 70%);
    border-radius: 50%;
  }
  .top { display: flex; justify-content: space-between; align-items: flex-start; position: relative; z-index: 1; }
  .title { font-size: 2rem; font-weight: 900; background: linear-gradient(135deg, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; line-height: 1.2; }
  .subtitle { font-size: 0.85rem; color: #94a3b8; margin-top: 0.25rem; }
  .grade-box {
    background: ${score >= 75 ? 'linear-gradient(135deg, #166534, #15803d)' : score >= 50 ? 'linear-gradient(135deg, #92400e, #a16207)' : 'linear-gradient(135deg, #7f1d1d, #991b1b)'};
    border: 1px solid ${score >= 75 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444'};
    border-radius: 1rem;
    padding: 0.75rem 1.5rem;
    text-align: center;
  }
  .grade-box .grade { font-size: 2.5rem; font-weight: 900; }
  .grade-box .label { font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; }

  .stats { display: flex; gap: 1.5rem; margin-top: 1.5rem; position: relative; z-index: 1; }
  .stat-box {
    flex: 1;
    background: rgba(30, 41, 59, 0.8);
    backdrop-filter: blur(8px);
    border: 1px solid #334155;
    border-radius: 1rem;
    padding: 1rem 1.25rem;
  }
  .stat-box .value { font-size: 2rem; font-weight: 800; }
  .stat-box .value.good { color: #4ade80; }
  .stat-box .value.warn { color: #fbbf24; }
  .stat-box .value.bad { color: #f87171; }
  .stat-box .label { font-size: 0.75rem; color: #94a3b8; margin-top: 0.25rem; }
  .stat-box .sublabel { font-size: 0.65rem; color: #64748b; }

  .rings { display: flex; justify-content: center; gap: 3rem; margin-top: 1.5rem; position: relative; z-index: 1; }
  .ring-item { text-align: center; }
  .ring-value { font-size: 2.5rem; font-weight: 800; }
  .ring-value.good { color: #4ade80; }
  .ring-value.warn { color: #fbbf24; }
  .ring-value.bad { color: #f87171; }
  .ring-label { font-size: 0.75rem; color: #94a3b8; margin-top: 0.15rem; }

  .bottom { display: flex; gap: 1.5rem; margin-top: 1.25rem; position: relative; z-index: 1; flex: 1; }
  .col { flex: 1; background: rgba(30, 41, 59, 0.5); border-radius: 0.75rem; padding: 1rem; border: 1px solid #334155; }
  .col h3 { font-size: 0.75rem; color: #38bdf8; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .row { display: flex; justify-content: space-between; padding: 0.25rem 0; font-size: 0.8rem; border-bottom: 1px solid #1e293b; }
  .row:last-child { border-bottom: none; }
  .row .count { color: #94a3b8; }
  .warn-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 0.4rem; }
  .warn-dot.fr { background: #22c55e; }
  .warn-dot.nonfr { background: #f87171; }

  .footer {
    margin-top: auto;
    display: flex; justify-content: space-between;
    font-size: 0.65rem; color: #475569;
    position: relative; z-index: 1;
  }

  .bar-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.2rem 0; }
  .bar-row .bar-bg { flex: 1; height: 6px; background: #334155; border-radius: 3px; }
  .bar-row .bar-fill { height: 6px; border-radius: 3px; background: linear-gradient(90deg, #38bdf8, #818cf8); }
  .bar-row .name { font-size: 0.75rem; min-width: 5rem; }
  .bar-row .num { font-size: 0.75rem; color: #94a3b8; min-width: 2rem; text-align: right; }
</style>
</head>
<body>
<div class="top">
  <div>
    <div class="title">🔭 Souveraineté<br>Numérique</div>
    <div class="subtitle">Audit des dépendances et de l'hébergement</div>
  </div>
  <div class="grade-box">
    <div class="grade">${grade}</div>
    <div class="label">Score</div>
  </div>
</div>

<div class="stats">
  <div class="stat-box">
    <div class="value ${frPercent >= 80 ? 'good' : frPercent >= 50 ? 'warn' : 'bad'}">${frPercent}%</div>
    <div class="label">des sites hébergés en France</div>
    <div class="sublabel">${frHosted} / ${totalSites} sites</div>
  </div>
  <div class="stat-box">
    <div class="value ${frDepsPercent >= 80 ? 'good' : frDepsPercent >= 50 ? 'warn' : 'bad'}">${frDepsPercent}%</div>
    <div class="label">des ressources chargées depuis la France</div>
    <div class="sublabel">${frDeps} / ${totalDeps} ressources</div>
  </div>
  <div class="stat-box">
    <div class="value ${nonFrHostedCount + nonFrDepCount === 0 ? 'good' : 'warn'}">${nonFrHostedCount + nonFrDepCount}</div>
    <div class="label">dépendances hors 🇫🇷</div>
    <div class="sublabel">${nonFrHostedCount} sites + ${nonFrDepCount} ressources</div>
  </div>
</div>

<div class="rings">
  <div class="ring-item"><div class="ring-value ${frPercent >= 80 ? 'good' : frPercent >= 50 ? 'warn' : 'bad'}">${frPercent}%</div><div class="ring-label">Hébergement France</div></div>
  <div class="ring-item"><div class="ring-value ${frDepsPercent >= 80 ? 'good' : frDepsPercent >= 50 ? 'warn' : 'bad'}">${frDepsPercent}%</div><div class="ring-label">Ressources France</div></div>
  <div class="ring-item"><div class="ring-value">${totalSites}</div><div class="ring-label">Sites audités</div></div>
  <div class="ring-item"><div class="ring-value">${totalDeps}</div><div class="ring-label">Ressources totales</div></div>
</div>

<div class="bottom">
  <div class="col">
    <h3>Top hébergeurs</h3>
    ${orgsList.map(([name, count]) => {
      const max = orgsList[0][1];
      const bw = Math.round((count / max) * 100);
      return `<div class="bar-row"><div class="name">${name}</div><div class="bar-bg"><div class="bar-fill" style="width:${bw}%"></div></div><div class="num">${count}</div></div>`;
    }).join("")}
  </div>
  <div class="col">
    <h3>Pays d'hébergement</h3>
    ${countriesList.map(([code, count]) => {
      const max = countriesList[0][1];
      const bw = Math.round((count / max) * 100);
      const isFr = code === "FR";
      return `<div class="row"><span><span class="warn-dot ${isFr ? 'fr' : 'nonfr'}"></span> ${countryFlag[code] || ''} ${code}</span><span class="count">${count} site${count > 1 ? 's' : ''}</span></div>`;
    }).join("")}
  </div>
  <div class="col">
    <h3>⚠️ Points d'attention</h3>
    ${nonFrHostedCount > 0 ? `<div class="row">🔴 ${nonFrHostedCount} site${nonFrHostedCount > 1 ? 's' : ''} hébergé${nonFrHostedCount > 1 ? 's' : ''} hors France</div>` : '<div class="row" style="color:#4ade80">✅ Tous les sites hébergés en France</div>'}
    ${nonFrDepCount > 0 ? `<div class="row">🟡 ${nonFrDepCount} ressource${nonFrDepCount > 1 ? 's' : ''} externe${nonFrDepCount > 1 ? 's' : ''} hors France</div>` : '<div class="row" style="color:#4ade80">✅ Toutes les ressources en France</div>'}
    ${non_fr_mx_urls.length > 0 ? `<div class="row">🟡 ${non_fr_mx_urls.length} MX hors France</div>` : '<div class="row" style="color:#4ade80">✅ MX en France</div>'}
  </div>
</div>

<div class="footer">
  <span>Scan Souveraineté Numérique</span>
  <span>${new Date().toLocaleDateString("fr-FR", { dateStyle: "long" })}</span>
  <span>${totalSites} sites audités · Score ${score}/100</span>
</div>
</body>
</html>`;

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME_PATH,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 675 });
  await page.setContent(html, { waitUntil: "load" });
  await page.screenshot({ path: resolve(outputPath), fullPage: false });
  await browser.close();
  console.log(`Social image generated: ${outputPath}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
