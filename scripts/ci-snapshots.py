#!/usr/bin/env python3
"""No CI, quando o E2E falha: publica como anotação (::error::) o começo da captura da tela de cada
teste que falhou (error-context.md). As anotações dá para ler sem login; os artefatos, não."""
import glob, os
for path in sorted(glob.glob('test-results/*/error-context.md'))[:10]:
    text = open(path, encoding='utf-8').read()
    start = text.find('# Page snapshot')
    snap = text[start:start + 6000] if start >= 0 else text[:3000]
    name = os.path.basename(os.path.dirname(path))[:120]
    body = snap.replace('%', '%25').replace('\r', '').replace('\n', '%0A')
    print(f'::error title=snapshot {name}::{body}')
