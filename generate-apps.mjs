import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.join(root, "index.html");
const indexHtml = await readFile(indexPath, "utf8");
const startMarker = "        <!-- apps:start -->";
const endMarker = "        <!-- apps:end -->";
const start = indexHtml.indexOf(startMarker);
const end = indexHtml.indexOf(endMarker, start + startMarker.length);

if (start === -1 || end === -1) {
  throw new Error("Could not find the apps section markers in index.html");
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function getMetadata(html, folderName) {
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1];
  const description = html.match(/<meta\b(?=[^>]*\bname\s*=\s*["']description["'])(?=[^>]*\bcontent\s*=\s*["']([^"']*)["'])[^>]*>/i)?.[1];
  const folderTitle = folderName.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const appTitle = title
    ? decodeEntities(title.trim()).replace(/^privacy policy\s*[—–-]\s*/i, "")
    : folderTitle;

  return {
    title: appTitle || folderTitle,
    description: description ? decodeEntities(description.trim()) : "Explore this app.",
  };
}

const folders = await readdir(root, { withFileTypes: true });
const cards = [];

for (const folder of folders.filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))) {
  const appIndexPath = path.join(root, folder.name, "index.html");
  try {
    const appHtml = await readFile(appIndexPath, "utf8");
    const { title, description } = getMetadata(appHtml, folder.name);
    const href = `./${encodeURIComponent(folder.name)}/index.html`;

    cards.push(`        <article class="app-card">
          <div class="app-icon" aria-hidden="true">↗</div>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(description)}</p>
          <a class="app-link" href="${href}">Explore ${escapeHtml(title)} <span aria-hidden="true">→</span></a>
        </article>`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

cards.sort((a, b) => a.localeCompare(b));
const generatedContent = cards.length ? cards.join("\n\n") : "        <p>No apps are available yet.</p>";
const updatedHtml = `${indexHtml.slice(0, start + startMarker.length)}\n${generatedContent}\n${indexHtml.slice(end)}`;

await writeFile(indexPath, updatedHtml, "utf8");
console.log(`Generated ${cards.length} app card${cards.length === 1 ? "" : "s"}.`);
