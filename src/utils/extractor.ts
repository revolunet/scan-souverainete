import { ExternalResource } from "../types.js";

// Only resources that are actually loaded by the browser (not page links).
// Generic href extraction would capture <a> links which are navigations, not loaded resources.
const RESOURCE_SELECTORS: Array<{ type: string; attr: string; tag?: string }> = [
  { type: "stylesheet", attr: "href", tag: "link" },
  { type: "script", attr: "src" },
  { type: "image", attr: "src" },
  { type: "iframe", attr: "src" },
  { type: "source", attr: "src" },
  { type: "media", attr: "src" },
];

export function extractResources(html: string, baseUrl: string): ExternalResource[] {
  const seen = new Set<string>();
  const resources: ExternalResource[] = [];

  let baseHostname: string;
  try {
    baseHostname = new URL(baseUrl).hostname.replace(/^www\./, "");
  } catch {
    baseHostname = baseUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  }

  for (const sel of RESOURCE_SELECTORS) {
    const tagPattern = sel.tag
      ? `<${sel.tag}[^>]*${sel.attr}\\s*=\\s*"([^"]+)"`
      : `${sel.attr}\\s*=\\s*"([^"]+)"`;
    const regex = new RegExp(tagPattern, "gi");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(html)) !== null) {
      const rawUrl = match[1];
      if (!rawUrl) continue;
      if (/^(data|javascript|mailto|tel|blob):/i.test(rawUrl)) continue;

      const absoluteUrl = normalizeUrl(rawUrl, baseUrl);
      if (!absoluteUrl) continue;

      let urlHostname: string;
      try {
        urlHostname = new URL(absoluteUrl).hostname.replace(/^www\./, "");
      } catch {
        continue;
      }

      if (urlHostname === baseHostname) continue;
      if (seen.has(absoluteUrl)) continue;
      seen.add(absoluteUrl);

      resources.push({ type: sel.type, url: absoluteUrl, ip_info: null });
    }
  }

  return resources;
}

function normalizeUrl(raw: string, base: string): string | null {
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^\/\//.test(raw)) {
    try {
      const baseProto = new URL(base).protocol;
      return `${baseProto}${raw}`;
    } catch {
      return `https:${raw}`;
    }
  }
  if (/^\//.test(raw)) {
    try {
      const baseUrl = new URL(base);
      return `${baseUrl.origin}${raw}`;
    } catch {
      return null;
    }
  }
  try {
    return new URL(raw, base).href;
  } catch {
    return null;
  }
}
