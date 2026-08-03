#!/usr/bin/env node

import { rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const outputDir = resolve(process.argv[2] || "output");
const targets = [
  `${outputDir}/results`,
  `${outputDir}/raw`,
  `${outputDir}/geoip`,
  `${outputDir}/report.html`,
];

let removed = 0;
for (const t of targets) {
  if (existsSync(t)) {
    rmSync(t, { recursive: true, force: true });
    console.log(`Removed: ${t}`);
    removed++;
  }
}

if (removed === 0) {
  console.log("Nothing to clean up.");
} else {
  console.log(`Done. ${removed} path(s) removed.`);
}
