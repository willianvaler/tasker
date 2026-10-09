// Texto colado que vai para a tela de lote. Fica em memória (não na URL) porque pode ser grande.
let draft: { pageId: string; text: string } | null = null;

export function setBatchDraft(pageId: string, text: string) {
  draft = { pageId, text };
}

export function takeBatchDraft() {
  const current = draft;
  draft = null;
  return current;
}
