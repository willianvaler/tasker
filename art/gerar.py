#!/usr/bin/env python3
"""Gera a arte do jogo no ComfyUI do dono (ESCOPO_V8 §4).

Lê art/prompts.yaml (estilo comum, e por imagem: id, prompt, semente), manda o fluxo fixo
art/workflows/z-image-turbo.json (Z-Image Turbo, Apache 2.0: uso comercial liberado) para o ComfyUI
em 127.0.0.1:8188 e grava em assets/game/<grupo>/<id>.webp (512 px; retratos com fundo
transparente por chroma key). Refazer uma imagem é apagar o arquivo e rodar de novo: as que existem
são puladas. O registro (modelo, semente, licença) fica em art/lote.json.

    art/gerar.py                 # tudo o que falta
    art/gerar.py bosses          # só um grupo
    art/gerar.py bosses/hidra    # só uma imagem (refaz mesmo que exista)
"""

import io
import json
import os
import sys
import time
import urllib.request
import uuid

import yaml
from PIL import Image, ImageFilter

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
SAIDA = os.path.join(RAIZ, 'assets', 'game')
SERVIDOR = os.environ.get('COMFY_URL', 'http://127.0.0.1:8188')
MODELO = 'z_image_turbo-Q8_0.gguf'


def pedir(caminho, dados=None):
    headers = {'Content-Type': 'application/json'} if dados else {}
    r = urllib.request.Request(SERVIDOR + caminho, data=dados, headers=headers)
    with urllib.request.urlopen(r, timeout=120) as resp:
        return resp.read()


def gerar(prompt, semente, largura, altura):
    wf = json.load(open(os.path.join(AQUI, 'workflows', 'z-image-turbo.json')))
    wf['9']['inputs']['text'] = prompt
    wf['12']['inputs']['seed'] = semente
    wf['11']['inputs']['width'] = largura
    wf['11']['inputs']['height'] = altura
    pid = json.loads(pedir('/prompt', json.dumps({'prompt': wf, 'client_id': uuid.uuid4().hex}).encode()))['prompt_id']
    while True:
        time.sleep(2)
        h = json.loads(pedir(f'/history/{pid}'))
        if pid not in h:
            continue
        if h[pid].get('status', {}).get('status_str') == 'error':
            raise RuntimeError(json.dumps(h[pid]['status'])[:500])
        for out in h[pid]['outputs'].values():
            for img in out.get('images', []):
                q = urllib.parse.urlencode({'filename': img['filename'], 'subfolder': img['subfolder'], 'type': img['type']})
                return Image.open(io.BytesIO(pedir(f'/view?{q}'))).convert('RGB')


def tirar_verde(img):
    """Chroma key: o fundo verde vira transparente, com borda suave e sem o halo verde."""
    img = img.convert('RGBA')
    px = img.load()
    w, h = img.size
    alfa = Image.new('L', img.size, 255)
    a = alfa.load()
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            dom = g - max(r, b)
            if dom > 60:
                a[x, y] = 0
            elif dom > 20:
                a[x, y] = int(255 * (60 - dom) / 40)
            if dom > 0:
                px[x, y] = (r, max(r, b), b, 255)  # tira o verde que vazou na borda
    img.putalpha(alfa.filter(ImageFilter.GaussianBlur(0.8)))
    return img


def main():
    cfg = yaml.safe_load(open(os.path.join(AQUI, 'prompts.yaml')))
    filtro = sys.argv[1] if len(sys.argv) > 1 else None
    lote_path = os.path.join(AQUI, 'lote.json')
    lote = json.load(open(lote_path)) if os.path.exists(lote_path) else {}
    for grupo, g in cfg['grupos'].items():
        if filtro and filtro.split('/')[0] != grupo:
            continue
        os.makedirs(os.path.join(SAIDA, grupo), exist_ok=True)
        for item in g['itens']:
            chave = f"{grupo}/{item['id']}"
            destino = os.path.join(SAIDA, grupo, item['id'] + '.webp')
            if os.path.exists(destino) and filtro != chave:
                continue
            prompt = ' '.join(filter(None, [g.get('antes', ''), item['prompt'], g.get('depois', ''), cfg['estilo']]))
            larg, alt = g.get('tamanho', [1024, 1024])
            t0 = time.time()
            img = gerar(prompt, item.get('semente', cfg['semente']), larg, alt)
            if g.get('chroma'):
                img = tirar_verde(img)
            img.thumbnail((g.get('saida', 512),) * 2, Image.LANCZOS)
            img.save(destino, 'WEBP', quality=82, method=6)
            lote[chave] = {'modelo': MODELO, 'licenca': 'Apache-2.0', 'semente': item.get('semente', cfg['semente']),
                           'prompt': prompt}
            json.dump(lote, open(lote_path, 'w'), ensure_ascii=False, indent=1, sort_keys=True)
            print(f'{chave}: {time.time() - t0:.0f}s', flush=True)


def indice():
    """Escreve src/lib/game-art.ts: um require por imagem que existe (o Metro precisa do caminho fixo)."""
    cfg = yaml.safe_load(open(os.path.join(AQUI, 'prompts.yaml')))
    linhas = ['// GERADO por art/gerar.py a partir de assets/game: não edite à mão.', '',
              'export const GAME_ART = {']
    for grupo, g in cfg['grupos'].items():
        linhas.append(f'  {grupo}: {{')
        for item in g['itens']:
            if os.path.exists(os.path.join(SAIDA, grupo, item['id'] + '.webp')):
                linhas.append(f"    '{item['id']}': require('../../assets/game/{grupo}/{item['id']}.webp'),")
        linhas.append('  },')
    linhas.append('} as const;')
    nomes = {i['nome']: i['id'] for i in cfg['grupos']['bosses']['itens'] if 'nome' in i}
    linhas += ['', '/** Nome do boss (como o banco grava) → arte. */', 'export const BOSS_ART_BY_NAME: Record<string, string> = {']
    linhas += [f"  '{n}': '{k}'," for n, k in nomes.items()]
    linhas.append('};')
    open(os.path.join(RAIZ, 'src', 'lib', 'game-art.ts'), 'w').write('\n'.join(linhas) + '\n')


if __name__ == '__main__':
    import urllib.parse  # noqa: E402
    if sys.argv[1:] == ['indice']:
        indice()
    else:
        main()
        indice()
