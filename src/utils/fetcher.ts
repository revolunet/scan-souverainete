import { Cookie } from "../types.js";

export interface FetchResult {
  html: string;
  finalUrl: string;
  cookies: Cookie[];
}

export async function fetchPage(
  url: string,
  timeoutMs: number = 60000
): Promise<FetchResult> {
  const puppeteer = await import("puppeteer");

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    await page.goto(url, {
      waitUntil: "networkidle0",
      timeout: timeoutMs,
    });

    const finalUrl = page.url();
    const html = await page.content();

    const cookies: Cookie[] = (await page.cookies()).map((c) => ({
      domain: c.domain,
      name: c.name,
      value: c.value,
      path: c.path,
      expiration: c.expires,
      ip_info: null,
    }));

    return { html, finalUrl, cookies };
  } finally {
    await browser.close();
  }
}
