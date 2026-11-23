// Adicionar material (ES4/ES5, D325/D326): dos textos escolhidos (ou de dentro do .zip) para o que
// entra. `.md` e HTML com texto viram arquivos de um cofre só (o importador do OB13 liga os
// [[links]] entre eles e traz as imagens); cada `.md`, cada HTML solto e cada livro em HTML é um
// material (a anotação principal); o HTML que é quase só script vai como arquivo.

import { convertHtmlGroup, groupHtml } from './html-book';
import type { VaultFile } from './vault';

export type TextEntry = { path: string; text: string };
const baseName = (path: string) => path.split('/').pop() ?? path;

/** Caminhos do .zip que não são material (pasta do macOS, configuração do Obsidian, ocultos) */
export function ignoredZipPath(path: string) {
  return (
    path.endsWith('/') ||
    /(^|\/)(__MACOSX|\.obsidian|\.trash|\.git)(\/|$)/.test(path) ||
    /(^|\/)\./.test(path)
  );
}

export function buildMaterialImport(input: { markdown: TextEntry[]; html: TextEntry[] }) {
  const vault: VaultFile[] = [];
  /** Título da anotação principal → nome do material */
  const mains: { title: string; name: string }[] = [];
  const interactive: { path: string; name: string }[] = [];
  for (const md of input.markdown) {
    vault.push({ path: md.path, text: md.text });
    mains.push({
      title: baseName(md.path).replace(/\.(md|markdown)$/i, ''),
      name: baseName(md.path),
    });
  }
  for (const group of groupHtml(input.html.map((h) => ({ path: h.path, html: h.text })))) {
    const result = convertHtmlGroup(group);
    if (result.interactive) {
      const page = group.pages[0];
      interactive.push({ path: page.path, name: baseName(page.path) });
      continue;
    }
    vault.push(...result.files);
    if (result.mainTitle)
      mains.push({
        title: result.mainTitle,
        name: group.book ? group.name : baseName(group.pages[0].path),
      });
  }
  return { vault, mains, interactive };
}
