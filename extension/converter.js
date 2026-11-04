// GERADO por scripts/extensao.mjs a partir de src/lib/html-markdown.ts: não edite aqui.
(() => {
// Página da web → Markdown, para o Web Clipper (OB15, ESCOPO_V11, D305). Puro e sem imports: a
// extensão do navegador usa uma cópia gerada deste arquivo (`npm run extensao` escreve
// extension/converter.js) e os testes usam nós de mentira com a mesma forma do DOM.
/** Teto do texto recortado (a anotação guarda até 20 mil caracteres) */
const CLIP_MAX = 18000;
const SKIP = new Set([
    'SCRIPT',
    'STYLE',
    'NOSCRIPT',
    'TEMPLATE',
    'SVG',
    'CANVAS',
    'IFRAME',
    'OBJECT',
    'EMBED',
    'BUTTON',
    'INPUT',
    'SELECT',
    'TEXTAREA',
    'FORM',
    'NAV',
    'ASIDE',
    'FOOTER',
    'DIALOG',
]);
const BLOCK = new Set([
    'P',
    'DIV',
    'SECTION',
    'ARTICLE',
    'MAIN',
    'HEADER',
    'FIGURE',
    'FIGCAPTION',
    'DL',
    'DT',
    'DD',
    'ADDRESS',
    'DETAILS',
    'SUMMARY',
]);
const attr = (node, name) => node.getAttribute?.(name) ?? null;
const children = (node) => Array.from(node.childNodes);
/** Endereço absoluto (o relativo vira o da página); só http(s) e mailto, o resto some */
function absoluteUrl(href, base) {
    if (!href)
        return null;
    try {
        const url = new URL(href.trim(), base || undefined);
        return /^(https?|mailto):$/.test(url.protocol) ? url.href : null;
    }
    catch {
        return null;
    }
}
/**
 * Texto solto: espaços juntos, e o que a anotação leria como comando vira texto comum (o "[[" de
 * link e o "![[" de incorporar ganham um espaço; nada de criar link para outra anotação sem querer)
 */
function plain(text) {
    return text.replace(/\s+/g, ' ').replace(/\[\[/g, '[ [').replace(/\]\]/g, '] ]');
}
const wrap = (inner, mark) => {
    const t = inner.trim();
    return t ? `${mark}${t}${mark}` : '';
};
function inline(node, ctx) {
    return children(node)
        .map((c) => convert(c, ctx))
        .join('');
}
function listItem(node, ctx) {
    const level = ctx.list.length - 1;
    const current = ctx.list[level];
    const marker = current?.ordered ? `${++current.index}.` : '-';
    const indent = '  '.repeat(Math.max(0, level));
    const body = inline(node, ctx)
        .replace(/^\n+|\n+$/g, '')
        .replace(/\n{2,}/g, '\n');
    const [first = '', ...rest] = body.split('\n');
    const pad = ' '.repeat(marker.length + 1);
    return `\n${indent}${marker} ${first.trim()}${rest.map((l) => `\n${l.startsWith(' ') ? l : `${indent}${pad}${l}`}`).join('')}`;
}
function table(node, ctx) {
    const rows = [];
    const walk = (n) => {
        for (const c of children(n)) {
            if (c.nodeName === 'TR')
                rows.push(children(c)
                    .filter((cell) => cell.nodeName === 'TD' || cell.nodeName === 'TH')
                    .map((cell) => inline(cell, ctx).replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim()));
            else if (c.nodeType === 1)
                walk(c);
        }
    };
    walk(node);
    if (!rows.length)
        return '';
    const width = Math.max(...rows.map((r) => r.length));
    const line = (r) => `| ${Array.from({ length: width }, (_, i) => r[i] ?? '').join(' | ')} |`;
    return `\n\n${[line(rows[0]), `|${' --- |'.repeat(width)}`, ...rows.slice(1).map(line)].join('\n')}\n\n`;
}
function convert(node, ctx) {
    if (node.nodeType === 3) {
        const text = node.textContent ?? '';
        return ctx.pre ? text : plain(text);
    }
    if (node.nodeType !== 1)
        return '';
    const name = node.nodeName.toUpperCase();
    if (SKIP.has(name) || attr(node, 'hidden') !== null || attr(node, 'aria-hidden') === 'true')
        return '';
    switch (name) {
        case 'H1':
        case 'H2':
        case 'H3':
        case 'H4':
        case 'H5':
        case 'H6': {
            const text = inline(node, ctx).replace(/\s+/g, ' ').trim();
            return text ? `\n\n${'#'.repeat(Number(name[1]))} ${text}\n\n` : '';
        }
        case 'BR':
            return '\n';
        case 'HR':
            return '\n\n---\n\n';
        case 'STRONG':
        case 'B':
            return wrap(inline(node, ctx), '**');
        case 'EM':
        case 'I':
            return wrap(inline(node, ctx), '*');
        case 'DEL':
        case 'S':
            return wrap(inline(node, ctx), '~~');
        case 'MARK':
            return wrap(inline(node, ctx), '==');
        case 'CODE':
            if (ctx.pre)
                return node.textContent ?? '';
            return wrap((node.textContent ?? '').replace(/`/g, "'"), '`');
        case 'PRE': {
            const code = children(node).find((c) => c.nodeName.toUpperCase() === 'CODE');
            // A linguagem do bloco; "questlist" seria uma consulta da anotação (OB7), então não passa
            const lang = (/language-([\w+-]+)/.exec(attr(code ?? node, 'class') ?? '')?.[1] ?? '')
                .toLowerCase()
                .replace(/^questlist$/, '');
            const text = (node.textContent ?? '').replace(/\n+$/, '').replace(/```/g, '``​`');
            return `\n\n\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
        }
        case 'A': {
            const text = inline(node, ctx).trim();
            const href = absoluteUrl(attr(node, 'href'), ctx.base);
            if (!href || href.startsWith(`${ctx.base}#`))
                return text;
            return text
                ? `[${text.replace(/[[\]]/g, '')}](${href.replace(/\(/g, '%28').replace(/\)/g, '%29')})`
                : '';
        }
        case 'IMG': {
            const src = absoluteUrl(attr(node, 'src') ?? attr(node, 'data-src'), ctx.base);
            if (!src || src.startsWith('data:'))
                return '';
            const alt = plain(attr(node, 'alt') ?? '')
                .replace(/[[\]]/g, '')
                .trim();
            return `![${alt}](${src.replace(/\(/g, '%28').replace(/\)/g, '%29')})`;
        }
        case 'UL':
        case 'OL': {
            ctx.list.push({ ordered: name === 'OL', index: Number(attr(node, 'start') ?? 1) - 1 });
            const out = children(node)
                .map((c) => (c.nodeName.toUpperCase() === 'LI' ? listItem(c, ctx) : ''))
                .join('');
            ctx.list.pop();
            return ctx.list.length ? out : `\n${out}\n\n`;
        }
        case 'LI':
            return listItem(node, {
                ...ctx,
                list: ctx.list.length ? ctx.list : [{ ordered: false, index: 0 }],
            });
        case 'BLOCKQUOTE': {
            const body = inline(node, ctx)
                .replace(/\n{3,}/g, '\n\n')
                .trim();
            return body
                ? `\n\n${body
                    .split('\n')
                    .map((l) => `> ${l}`.trimEnd())
                    .join('\n')}\n\n`
                : '';
        }
        case 'TABLE':
            return table(node, ctx);
        default: {
            const body = inline(node, ctx);
            return BLOCK.has(name) ? `\n\n${body}\n\n` : body;
        }
    }
}
/** Markdown do nó (a página inteira ou a seleção), limpo e com o teto de tamanho */
function htmlToMarkdown(root, baseUrl, max = CLIP_MAX) {
    const out = convert(root, { base: baseUrl, list: [], pre: false })
        .split('\n')
        .map((l) => l.replace(/[ \t]+$/, ''))
        .join('\n')
        // Espaço que sobrou no começo da linha de parágrafo (não em lista nem em código)
        .replace(/\n {1}(?=[^\s-])/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    if (out.length <= max)
        return out;
    const cut = out.slice(0, max);
    return `${cut.slice(0, Math.max(cut.lastIndexOf('\n\n'), max - 500))}\n\n…`;
}
globalThis.questlistHtmlToMarkdown = htmlToMarkdown;
})();
