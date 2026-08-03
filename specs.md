# Scan Souveraineté — Specification

## Objectif

Analyser un parc de sites web pour déterminer leur **souveraineté numérique** : où sont hébergés les serveurs, où sont situés les prestataires externes (CDN, polices, scripts), et quantifier la part française vs étrangère.

## Fonctionnalités

| Fonctionnalité | Détail |
|---|---|
| **Fetch HTML** | Puppeteer (Chromium headless), attend `networkidle0` pour laisser le JS s'exécuter |
| **IP** | A/AAAA via `host`/`dig`, PTR via `host`, whois IP (org-name, netname), whois domaine (owner), GeoIP via mmdblookup |
| **MX** | Résolution MX + IP/hoster pour chaque serveur de courrier |
| **Ressources externes** | Extraction des `src` (script, img, iframe, source) et `<link rel="stylesheet">` — pas des liens de navigation `<a>` |
| **Cookies** | Cookies du navigateur + résolution IP/hoster du domaine du cookie |
| **Hosters** | Fichier `data/hosters.json` — surcharge l'organisation et le pays quand le whois ne donne rien, normalise les noms |
| **Parallélisation** | Workers parallèles (défaut: 8), SIGINT propre |
| **Rapport HTML** | Génération d'un rapport standalone avec Chart.js (CDN) |
| **Image social** | Capture Puppeteer 1200×675 du résumé pour publication |
| **GeoIP** | Téléchargé au démarrage du conteneur depuis P3TERX/GeoLite.mmdb (mirror GitHub, ~8 Mo) |

## Structure des données

### Résultat par URL (`output/results/{slug}.json`)

```json
{
  "url": "https://exemple.gouv.fr",
  "final_url": "https://exemple.gouv.fr",
  "hostname": "exemple.gouv.fr",
  "ip_info": {
    "ip": "1.2.3.4",
    "hostname": "exemple.gouv.fr",
    "organization": "Outscale",
    "country": "FR",
    "country_name": "France"
  },
  "mx": [
    {
      "host": "mx1.alwaysdata.com",
      "priority": 10,
      "ip_info": { "ip": "5.196.27.76", "organization": "alwaysdata", "country": "FR", ... }
    }
  ],
  "resources": [
    { "type": "script", "url": "https://cdn.jsdelivr.net/...", "ip_info": { "ip": "...", "organization": "jsDelivr", "country": "LT", ... } }
  ],
  "cookies": [
    { "domain": ".exemple.gouv.fr", "name": "session", "value": "...", "path": "/", "expiration": 0, "ip_info": { ... } }
  ],
  "timestamp": "2026-08-03T20:28:40.429Z"
}
```

### Fichier de référence hébergeurs (`data/hosters.json`)

Tableau d'entrées avec motifs (CIDR, wildcard, exact, substring) et organisation/pays de substitution :

```json
[
  { "patterns": ["194.5.170.0/24"], "organization": "MTES", "country": "FR", "country_name": "France" },
  { "patterns": ["*.outscale.com", "outscale"], "organization": "Outscale", "country": "FR", "country_name": "France" },
  { "patterns": ["*.gouv.fr"], "organization": "État français", "country": "FR", "country_name": "France" }
]
```

Priorité : CIDR → exact → wildcard suffix → substring (org-name, hostname, netname).

### Résumé (`output/results/_summary.json`)

```json
{
  "timestamp": "2026-08-03T20:28:40.429Z",
  "stats": { "total": 30, "success": 28, "failed": 2 },
  "hosting": {
    "countries": { "FR": 25, "US": 3, "DE": 2 },
    "organizations": { "Outscale": 10, "OVHcloud": 8, "Amazon Web Services": 3 },
    "organizations_country": { "Outscale": "FR", "Amazon Web Services": "US" }
  },
  "dependencies": { "cdn.jsdelivr.net": 15, "fonts.googleapis.com": 10 },
  "dependencies_by_country": { "FR": 80, "US": 20, "LT": 5 },
  "non_fr_dependencies": [{ "source_url": "...", "domain": "cdn.jsdelivr.net", "organization": "jsDelivr", "country": "LT", "country_name": "Lithuania" }],
  "non_fr_hosted_urls": [{ "url": "...", "hostname": "...", "organization": "Amazon Web Services", "country": "US", "country_name": "United States" }],
  "non_fr_mx_urls": [{ "url": "...", "hostname": "mx1.google.com", "organization": "Google", "country": "US", "country_name": "United States" }],
  "mx_hosters": { "Google": 3, "alwaysdata": 5 },
  "mx_hosters_country": { "Google": "US", "alwaysdata": "FR" }
}
```

## Scripts disponibles

| Commande | Description |
|---|---|
| `npm start` | Lance le scan |
| `npm run report` | Génère `output/report.html` (rapport standalone) |
| `npm run social` | Génère `output/social.png` (image 1200×675) |
| `npm run clean` | Supprime `output/results`, `output/raw`, `output/geoip`, `output/report.html` |
| `npm run build` | Compile TypeScript |

## Docker

```bash
docker compose build
docker compose run --rm scan
```

- Multi‑arch : `linux/amd64` et `linux/arm64`
- Le conteneur télécharge GeoIP au démarrage (si absent)
- Puppeteer utilise le chromium système via `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`

## Utilisation

```bash
npm run build

# Scan
node dist/index.js data/urls.txt ./output 8 60

# Rapport
node dist/report.js output/results/_summary.json output/report.html

# Image social
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium node dist/social.js

# Nettoyage
node dist/clean.js ./output
```

## Architecture

```
src/
├── index.ts             # Orchestrateur (parallélisation, summary)
├── types.ts             # Types TypeScript partagés
├── report.ts            # Génération rapport HTML
├── social.ts            # Génération image social (Puppeteer)
├── clean.ts             # Nettoyage des artefacts
└── utils/
    ├── fetcher.ts       # Puppeteer fetch HTML + cookies
    ├── resolver.ts      # DNS, whois, GeoIP
    ├── extractor.ts     # Extraction ressources externes du HTML
    └── hosters.ts       # Chargement et matching hosters.json
```

## Dépendances systèmes

- `node` 22+
- `whois`, `dnsutils` (dig), `bind9-host` (host), `mmdb-bin` (mmdblookup), `chromium`

## Limitations

- Analyse des dépendances de niveau 1 uniquement
- GeoIP indisponible sans la base (mode dégradé, pays déduit des hosters si possible)
- Sites avec JS lourd : timeout possible (défaut 60s, `networkidle0` attend le réseau)
