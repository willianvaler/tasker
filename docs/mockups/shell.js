// Partes repetidas dos mockups: ícones (Lucide, traço 1,5), barra lateral, barra inferior e o
// botão de tema. Cada tela chama shell({ active, tab }).
const ICONS = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1Z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  play: '<path d="m7 4 13 8-13 8Z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  flag: '<path d="M4 22V4a1 1 0 0 1 1-1h13l-3 5 3 5H5"/>',
  tag: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4Z"/><circle cx="7.5" cy="7.5" r=".5"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  dumbbell: '<path d="M14.4 14.4 9.6 9.6M18.7 21.1a2 2 0 1 1-2.8-2.8l-1.8 1.8a2 2 0 1 1-2.8-2.8l6.4-6.4a2 2 0 1 1 2.8 2.8l1.8-1.8a2 2 0 1 1 2.8 2.8Z M2.9 5.7a2 2 0 1 1 2.8-2.8l1.8-1.8a2 2 0 1 1 2.8 2.8L3.9 10.3a2 2 0 1 1-2.8-2.8Z"/>',
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z"/>',
  flame: '<path d="M12 22c4 0 7-2.7 7-7 0-4-3-6-4-9-1.5 2-2 3-3.5 3.5C11 7 11 5 10 2 7 5 5 9 5 15c0 4.3 3 7 7 7Z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
};

function i(name, size) {
  return `<svg class="i${size === 20 ? ' i20' : ''}" viewBox="0 0 24 24">${ICONS[name]}</svg>`;
}

function sidebar(active) {
  const a = (id) => (id === active ? ' active' : '');
  return `
  <aside class="sidebar">
    <div class="search">${i('search')} Buscar ou executar <kbd>Ctrl K</kbd></div>
    <nav class="nav">
      <a class="item${a('hoje')}">${i('sun')} Hoje <span class="count">6</span></a>
      <a class="item${a('entrada')}">${i('inbox')} Caixa de entrada <span class="count">3</span></a>
      <a class="item${a('minhas')}">${i('user')} Minhas tarefas</a>
      <a class="item${a('habitos')}">${i('repeat')} Hábitos</a>
    </nav>
    <nav class="nav">
      <div class="label">Pastas</div>
      <a class="item">${i('chevron')}<span class="marker" style="background:#7a8b5c"></span>Academia</a>
      <a class="item child${a('treino')}">${i('grid')} Treino A</a>
      <a class="item child">${i('list')} Alongamento</a>
      <a class="item">${i('chevron')}<span class="marker" style="background:#b07a4f"></span>Casa</a>
      <a class="item${a('mercado')}">${i('chevron')}<span class="marker" style="background:#5f7a8a"></span>Mercado</a>
    </nav>
    <nav class="nav">
      <div class="label">Projetos</div>
      <a class="item${a('churrasco')}">${i('chevron')}<span class="marker" style="background:#a35d4a"></span>Churrasco do Greg</a>
      <a class="item">${i('chevron')}<span class="marker" style="background:#8a7a4f"></span>Reforma da cozinha</a>
    </nav>
    <div class="sidebar-foot">
      <button class="btn">${i('plus', 20)} Novo <kbd style="margin-left:auto">Ctrl N</kbd></button>
      <div class="me"><span class="avatar">W</span> Willian <span class="meta" style="margin-left:auto">nv 7</span><span class="dot" title="Sincronizado"></span></div>
    </div>
  </aside>`;
}

function tabbar(active) {
  const t = (id, icon, label) =>
    `<div class="tab${id === active ? ' active' : ''}">${i(icon, 20)}${label}</div>`;
  return `<nav class="tabbar">${t('hoje', 'sun', 'Hoje')}${t('entrada', 'inbox', 'Caixa')}
    <div class="fab">${i('plus', 20)}</div>${t('pastas', 'folder', 'Pastas')}${t('eu', 'user', 'Eu')}</nav>`;
}

function shell({ title }) {
  const head = document.createElement('div');
  head.className = 'stage-title';
  head.innerHTML = `${title} <button>Claro / escuro</button><span>1280 px · 390 px</span>`;
  head.querySelector('button').onclick = () => {
    const html = document.documentElement;
    html.dataset.theme = html.dataset.theme === 'dark' ? 'light' : 'dark';
  };
  document.body.prepend(head);
  for (const el of document.querySelectorAll('[data-sidebar]')) el.outerHTML = sidebar(el.dataset.sidebar);
  for (const el of document.querySelectorAll('[data-tabbar]')) el.outerHTML = tabbar(el.dataset.tabbar);
  for (const el of document.querySelectorAll('[data-i]'))
    el.outerHTML = i(el.dataset.i, Number(el.dataset.size) || 16);
}
