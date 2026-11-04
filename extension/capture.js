// Roda na página aberta (depois do converter.js): monta o recorte. O valor da última expressão é o
// que o background recebe.
(() => {
  const meta = (...names) => {
    for (const name of names) {
      const el = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
      const value = el?.getAttribute('content')?.trim();
      if (value) return value;
    }
    return null;
  };
  const url = document.querySelector('link[rel="canonical"]')?.href || location.href;
  const toMarkdown = globalThis.questlistHtmlToMarkdown;
  const selection = getSelection();
  let root = null;
  let isSelection = false;
  if (selection && !selection.isCollapsed && selection.toString().trim()) {
    root = document.createElement('div');
    for (let i = 0; i < selection.rangeCount; i++)
      root.appendChild(selection.getRangeAt(i).cloneContents());
    isSelection = true;
  } else {
    // O conteúdo principal: o <article> mais longo, o <main> ou a página inteira
    const articles = [...document.querySelectorAll('article')].sort(
      (a, b) => (b.innerText ?? '').length - (a.innerText ?? '').length,
    );
    root = articles[0] ?? document.querySelector('main, [role="main"]') ?? document.body;
  }
  return {
    title: meta('og:title', 'twitter:title') || document.title || location.hostname,
    url,
    markdown: toMarkdown ? toMarkdown(root, location.href) : (root?.innerText ?? ''),
    author: meta('author', 'article:author', 'og:article:author'),
    description: meta('description', 'og:description'),
    published: meta('article:published_time', 'datePublished', 'date'),
    selection: isSelection,
  };
})();
