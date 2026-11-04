// Web Clipper do Questlist (OB15, D305). Ao clicar no ícone (ou em "Salvar no Questlist" no menu do
// botão direito), lê a página aberta, ou só o trecho selecionado, em Markdown e abre o Questlist em
// /clip com o recorte no fragmento do endereço (#…): ele não vai para o servidor no pedido, e o app
// salva como anotação depois de um toque, já com o login da pessoa. A extensão não guarda nada além
// do endereço do Questlist e não tem acesso às páginas sem o clique (permissão activeTab).

const DEFAULT_BASE = 'https://questlist.wavdev.org';
const api = globalThis.browser ?? globalThis.chrome;

async function baseUrl() {
  const { base } = await api.storage.sync.get({ base: DEFAULT_BASE });
  return String(base || DEFAULT_BASE).replace(/\/+$/, '');
}

function encode(clip) {
  const bytes = new TextEncoder().encode(JSON.stringify(clip));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function clip(tab) {
  if (!tab?.id || !/^https?:/.test(tab.url ?? '')) return;
  let clipped = null;
  try {
    const [result] = await api.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['converter.js', 'capture.js'],
    });
    clipped = result?.result ?? null;
  } catch {
    // Página que o navegador não deixa ler (loja, PDF, configurações): vai só o título e o link
  }
  const data = clipped ?? { title: tab.title ?? '', url: tab.url, markdown: '' };
  await api.tabs.create({ url: `${await baseUrl()}/clip#${encode(data)}`, index: tab.index + 1 });
}

api.action.onClicked.addListener((tab) => void clip(tab));

api.runtime.onInstalled.addListener(() => {
  api.contextMenus.create({
    id: 'questlist-clip',
    title: api.i18n.getMessage('menu'),
    contexts: ['page', 'selection', 'link', 'image'],
  });
});

api.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'questlist-clip') void clip(tab);
});
