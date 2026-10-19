#!/usr/bin/env python3
"""Gera a identidade visual do Questlist a partir da geometria do símbolo (ESCOPO_V8 §0).

Saída: assets/brand/ (SVGs, logotipo, peças da loja) e assets/images/ (ícones, splash, favicon).
Precisa de rsvg-convert (librsvg) e Pillow. Fonte do logotipo: Montserrat (OFL), caminho em
MONTSERRAT ou baixada de github.com/google/fonts para a pasta temporária.

    python3 assets/brand/gerar.py
"""

import os
import subprocess
import tempfile
import urllib.request

from PIL import Image, ImageDraw, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
IMAGENS = os.path.join(AQUI, '..', 'images')
LOJA = os.path.join(AQUI, 'loja')

VERDE = '#0F3D32'
LARANJA = '#FF8A3D'
CREME = '#F8F7F4'
PRETO = '#111111'

# Geometria medida na versão limpa pelo ComfyUI (FLUX.2 klein), numa tela de 1024.
# O símbolo ocupa x 108..942 e y 70..909; o viewBox o centraliza num quadrado.
VIEWBOX = '88 60 874 874'
CX, CY = 520, 480


def simbolo(cor, destaque=LARANJA, viewbox=VIEWBOX):
    """SVG do símbolo. Os respiros (neve e contorno da cauda) são recortes transparentes."""
    cauda = 'transform="rotate(-43.5 789 761)"'
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}">
  <defs>
    <clipPath id="disco"><circle cx="{CX}" cy="{CY}" r="410"/></clipPath>
    <mask id="respiro" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
      <rect width="1024" height="1024" fill="#fff"/>
      <polyline points="232,858 468,612 526,668 640,552 760,676" fill="none" stroke="#000"
        stroke-width="44" stroke-linejoin="miter" stroke-miterlimit="10"/>
      <rect {cauda} x="723.5" y="600.5" width="131" height="321" rx="22" fill="#000"/>
    </mask>
  </defs>
  <g mask="url(#respiro)" fill="{cor}">
    <circle cx="{CX}" cy="{CY}" r="344" fill="none" stroke="{cor}" stroke-width="132"/>
    <polygon clip-path="url(#disco)" points="485,398 612,530 660,486 960,800 960,960 80,960 80,840"/>
  </g>
  <rect {cauda} x="736.5" y="613.5" width="105" height="295" rx="12" fill="{destaque}"/>
  <g fill="{destaque}">
    <rect x="519" y="250" width="16" height="200" rx="4"/>
    <path d="M527 250 L676 312 Q690 318 676 325 L527 392 Z" stroke="{destaque}" stroke-width="10"
      stroke-linejoin="round"/>
  </g>
</svg>
'''


def com_margem(fracao):
    """viewBox com o símbolo ocupando só `fracao` do lado (ícones com área segura)."""
    lado = 874 / fracao
    x = 525 - lado / 2
    y = 497 - lado / 2
    return f'{x:.1f} {y:.1f} {lado:.1f} {lado:.1f}'


def png(svg, saida, lado, fundo=None):
    with tempfile.NamedTemporaryFile('w', suffix='.svg', delete=False) as f:
        f.write(svg)
    args = ['rsvg-convert', '-w', str(lado), '-h', str(lado), f.name, '-o', saida]
    if fundo:
        args[1:1] = ['-b', fundo]
    subprocess.run(args, check=True)
    os.unlink(f.name)


def fonte(peso, tamanho):
    caminho = os.environ.get('MONTSERRAT') or os.path.join(tempfile.gettempdir(), 'Montserrat.ttf')
    if not os.path.exists(caminho):
        urllib.request.urlretrieve(
            'https://github.com/google/fonts/raw/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf', caminho)
    f = ImageFont.truetype(caminho, tamanho)
    f.set_variation_by_axes([peso])
    return f


def logotipo(saida, cor_texto, cor_simbolo, fundo, lema=True, largura=1600):
    """Símbolo + "Questlist" (Montserrat 700) + lema, como no painel do dono."""
    alto = int(largura * 0.32)
    img = Image.new('RGBA', (largura, alto), fundo or (0, 0, 0, 0))
    lado = int(alto * 0.86)
    tmp = os.path.join(tempfile.gettempdir(), 'ql-simbolo.png')
    png(simbolo(cor_simbolo), tmp, lado)
    img.alpha_composite(Image.open(tmp), ((alto - lado) // 2, (alto - lado) // 2))
    d = ImageDraw.Draw(img)
    x = alto + int(alto * 0.04)
    titulo = fonte(700, int(alto * 0.40))
    d.text((x, int(alto * 0.10)), 'Questlist', font=titulo, fill=cor_texto)
    if lema:
        sub = fonte(450, int(alto * 0.095))
        d.text((x + 8, int(alto * 0.60)), 'Tarefas com propósito.', font=sub, fill=cor_texto)
        d.text((x + 8, int(alto * 0.73)), 'Conquistas em conjunto.', font=sub, fill=cor_texto)
    img = img.crop(img.getbbox() if fundo is None else (0, 0, largura, alto))
    img.save(saida)


def destaque_play(saida):
    """Imagem de destaque da Google Play: 1024×500, sem transparência."""
    img = Image.new('RGB', (1024, 500), VERDE)
    tmp = os.path.join(tempfile.gettempdir(), 'ql-simbolo.png')
    png(simbolo(CREME), tmp, 300)
    img.paste(Image.open(tmp), (90, 100), Image.open(tmp))
    d = ImageDraw.Draw(img)
    d.text((430, 130), 'Questlist', font=fonte(700, 112), fill=CREME)
    sub = fonte(450, 34)
    d.text((436, 280), 'Tarefas com propósito.', font=sub, fill=CREME)
    d.text((436, 326), 'Conquistas em conjunto.', font=sub, fill=LARANJA)
    img.save(saida)


def main():
    os.makedirs(LOJA, exist_ok=True)
    arquivos = {
        'simbolo.svg': simbolo(VERDE),
        'simbolo-claro.svg': simbolo(CREME),  # para fundo verde ou escuro
        'simbolo-mono.svg': simbolo(PRETO, PRETO),
    }
    for nome, svg in arquivos.items():
        with open(os.path.join(AQUI, nome), 'w') as f:
            f.write(svg)

    # Ícone principal: fundo verde, símbolo creme (o "ícone do app" do painel). As lojas arredondam.
    icone = simbolo(CREME, viewbox=com_margem(0.74))
    png(icone, os.path.join(IMAGENS, 'icon.png'), 1024, VERDE)
    png(icone, os.path.join(LOJA, 'icone-512.png'), 512, VERDE)
    png(simbolo(VERDE, viewbox=com_margem(0.74)), os.path.join(LOJA, 'icone-claro-512.png'), 512, CREME)

    # Android adaptativo: a área segura é o círculo de 66% do centro.
    png(simbolo(CREME, viewbox=com_margem(0.58)), os.path.join(IMAGENS, 'android-icon-foreground.png'), 1024)
    Image.new('RGB', (1024, 1024), VERDE).save(os.path.join(IMAGENS, 'android-icon-background.png'))
    png(simbolo('#FFFFFF', '#FFFFFF', viewbox=com_margem(0.58)),
        os.path.join(IMAGENS, 'android-icon-monochrome.png'), 432)

    # Splash (o fundo vem do app.json) e favicon.
    png(simbolo(VERDE), os.path.join(IMAGENS, 'splash-icon.png'), 512)
    png(simbolo(CREME), os.path.join(IMAGENS, 'splash-icon-dark.png'), 512)
    png(simbolo(VERDE, viewbox=com_margem(0.92)), os.path.join(IMAGENS, 'favicon.png'), 96)

    logotipo(os.path.join(AQUI, 'logotipo.png'), VERDE, VERDE, None)
    logotipo(os.path.join(AQUI, 'logotipo-escuro.png'), CREME, CREME, VERDE)
    logotipo(os.path.join(AQUI, 'logotipo-simples.png'), VERDE, VERDE, None, lema=False)
    destaque_play(os.path.join(LOJA, 'destaque-play-1024x500.png'))
    print('ok')


if __name__ == '__main__':
    main()
