#!/usr/bin/env python3
"""Sons curtos do modo jogo (ESCOPO_V8, HB11), sintetizados aqui: sem amostra de terceiros.

    python3 assets/sounds/gerar.py   # escreve nivel.wav, boss.wav e item.wav nesta pasta
"""
import math
import os
import struct
import wave

TAXA = 22050
AQUI = os.path.dirname(os.path.abspath(__file__))


def nota(freq, dur, vol=0.35, ataque=0.01, harm=(1, 0.5, 0.25)):
    n = int(TAXA * dur)
    out = []
    for i in range(n):
        t = i / TAXA
        env = min(1, t / ataque) * math.exp(-3.2 * t / dur)
        s = sum(a * math.sin(2 * math.pi * freq * (k + 1) * t) for k, a in enumerate(harm)) / sum(harm)
        out.append(s * env * vol)
    return out


def mistura(*faixas):
    n = max(len(f) for f in faixas)
    return [sum(f[i] for f in faixas if i < len(f)) for i in range(n)]


def seq(*partes, gap=0.0):
    out = []
    for p in partes:
        out += p + [0.0] * int(TAXA * gap)
    return out


def grava(nome, amostras):
    with wave.open(os.path.join(AQUI, nome), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(TAXA)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, s)) * 32000)) for s in amostras))


# Subiu de nível: arpejo maior ascendente (dó, mi, sol, dó)
grava('nivel.wav', seq(nota(523, 0.12), nota(659, 0.12), nota(784, 0.12), nota(1047, 0.45)))
# Boss derrotado: tambor grave e acorde
tambor = [math.sin(2 * math.pi * (90 - 40 * i / TAXA) * i / TAXA) * math.exp(-8 * i / TAXA) * 0.6
          for i in range(int(TAXA * 0.35))]
grava('boss.wav', seq(tambor, mistura(nota(392, 0.8), nota(494, 0.8), nota(587, 0.8)), gap=0.02))
# Drop: brilho curto
grava('item.wav', seq(nota(1319, 0.08, 0.25), nota(1760, 0.18, 0.25, harm=(1, 0.3))))
print('ok')
