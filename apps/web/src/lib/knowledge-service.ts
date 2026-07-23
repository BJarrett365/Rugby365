/**
 * Server-side Knowledge Base markdown loader/saver.
 * Files live at repo docs/knowledge/ — not a separate docs app.
 */

import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getKnowledgePage, KNOWLEDGE_PAGES, type KnowledgePageMeta } from "./knowledge-catalog";

function knowledgeRoot(): string {
  const cwd = process.cwd();
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  // apps/web/src/lib -> ../../../../docs/knowledge (repo root)
  const fromModule = path.resolve(moduleDir, "../../../../docs/knowledge");
  const candidates = [
    fromModule,
    path.resolve(cwd, "docs/knowledge"),
    path.resolve(cwd, "../../docs/knowledge"),
    path.resolve(cwd, "../docs/knowledge"),
  ];
  return candidates.find((p) => existsSync(p)) ?? fromModule;
}

export async function listKnowledgePages(): Promise<KnowledgePageMeta[]> {
  return KNOWLEDGE_PAGES;
}

export async function readKnowledgePage(slug: string): Promise<{
  meta: KnowledgePageMeta;
  content: string;
} | null> {
  const meta = getKnowledgePage(slug);
  if (!meta) return null;
  const filePath = path.join(knowledgeRoot(), meta.file);
  try {
    const content = await fs.readFile(filePath, "utf8");
    return { meta, content };
  } catch {
    return { meta, content: `# ${meta.title}\n\n_Content not found. Create \`${meta.file}\` under docs/knowledge/._\n` };
  }
}

export async function writeKnowledgePage(slug: string, content: string): Promise<KnowledgePageMeta> {
  const meta = getKnowledgePage(slug);
  if (!meta) throw new Error(`Unknown knowledge page: ${slug}`);
  const root = knowledgeRoot();
  await fs.mkdir(root, { recursive: true });
  const filePath = path.join(root, meta.file);
  await fs.writeFile(filePath, content.replace(/\r\n/g, "\n"), "utf8");
  return meta;
}
