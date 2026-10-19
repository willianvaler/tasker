# Questlist — Escopo V8: modo jogo e identidade visual (instruções para o Claude Code)

Pedido do dono em 19/10/2026: **trazer mais do Habitica** e ter um **modo de visualização centrado no jogo** da gamificação. É a prioridade agora; o resto (V4 a V7) espera, porque depende de decisões, análise e da publicação. Absorve o "Modo Jogo completo" do ESCOPO_V5 §7, que passa a morar aqui; em conflito, este vence.

Regras que continuam valendo: XP, dano, ouro, itens e vida são **do servidor** (D33, D60 a D64); o app só espelha. Nada infantil nem pixelado (V5 §7, pedido de 18/10).

## 0. Identidade visual — ✅ done em parte (HB0)

- **Logo escolhido:** o "Q" de anel verde com a montanha, a bandeira laranja e a cauda laranja (painel de identidade do dono, 19/10). O gerado tinha defeitos (mancha onde a cauda encontra a montanha, zigue-zague cortado, grão, círculo torto): foi limpo no ComfyUI e redesenhado em vetor.
- **Paleta da marca:** verde floresta `#0F3D32` (principal), laranja `#FF8A3D` (destaque), creme `#F8F7F4` (fundo claro). Tipografia da marca: Montserrat (ou similar) **só no logotipo e nas lojas**; o app segue com as fontes do `docs/DESIGN.md`.
- **Arquivos** em `assets/brand/` (SVG mestre, PNGs) e aplicados em `assets/images/` (ícone, ícone adaptativo do Android, splash, favicon). Para as lojas: ícone 512×512 e imagem de destaque 1024×500 da Google Play.
- **Falta (HB0.1):** decidir se as cores da marca entram nos tokens do app (acento laranja, verde no tema escuro). É mudança do "Caderno de bolso" (D-B1): pedir aprovação com captura antes.

## 1. Hábitos como no Habitica — ✅ done em parte (HB1)

- **Botões à direita, − à esquerda do +:** `hábito X   |−| |+|`, no bom/ruim e no contador (antes o + ficava antes do título). ✅ HB1.
- **Força do hábito (HB2):** a cor da linha muda com o histórico, como o "valor" das tarefas do Habitica: muito + recente → azul/verde; muito − → laranja/vermelho; parado → neutro. Calculada no servidor a partir dos `habit_tick` (decai com o tempo), espelhada em `lib/`.
- **Hábito só bom ou só ruim (HB2):** opção de esconder o + ou o − (ex.: "fumou um cigarro" só tem −).

## 2. Três níveis de jogo, por pessoa (HB3)

- Perfil → Gamificação: **Desligado** (só lista), **Leve** (o de hoje, padrão) e **Completo** (modo jogo).
- Troca a qualquer hora, sem perder nada: as regras do servidor são as mesmas nos três; o que muda é a apresentação e os sistemas do §3, que só agem no Completo.
- Num projeto em time, cada pessoa usa o seu nível.

## 3. O que vem do Habitica (só no Completo, salvo indicação)

| Id | Sistema | Como fica aqui | Já existe |
|---|---|---|---|
| HB4 | **Início como acampamento** | Personagem em destaque com o equipamento, barras de vida, XP, mana e ouro; bosses do dia e da semana com arte e uma fala curta; missões do dia | personagem, bosses, ouro (D60 a D64) |
| HB5 | **Vida e diárias** | Tarefa recorrente e hábito de checagem viram "diárias"; diária não feita tira vida na virada do dia (`refresh_cycles`), proporcional à força dela e reduzida pela Constituição | ciclos (D24) |
| HB5 | **"O que você fez ontem?"** | Na primeira abertura do dia, antes de tirar a vida, a lista das diárias de ontem para marcar o que ficou esquecido (como o "Record Yesterday's Activity") | — |
| HB5 | **Descansar na taverna** | Pausa o dano das diárias (viagem, doença); o dano no boss também pausa | — |
| HB5 | **Zerar a vida** | Consequência leve, decisão do dono (proposta: perde o ouro do dia e um nível de XP, nunca itens) | — |
| HB6 | **Mana e habilidades por classe** | Mana regenera com tarefas; 4 habilidades por classe, liberadas por nível (ex.: guerreiro "golpe brutal", curandeiro "cura do grupo") | `use_skill`, classes (D61) |
| HB6 | **Dia perfeito** | Todas as diárias feitas → bônus de atributos no dia seguinte | — |
| HB7 | **Recompensas personalizadas** | A pessoa cria prêmios da vida real com preço em ouro ("um episódio: 30 de ouro") e resgata; vale também no Leve | ouro (D63) |
| HB7 | **Baú encantado** | Gastar ouro num item aleatório da loja (raridade do V4 §2) | loja, drops (D64) |
| HB8 | **Mascotes e montarias** | Ovos, poções de eclosão e comida saem nos drops; chocar, alimentar até virar montaria; estábulo. Só visual e colecionável | drops (D64) |
| HB9 | **Missões com história** | Pergaminho de missão (drop ou loja): boss com um capítulo curto, ou missão de coleta (itens que caem ao concluir tarefas); sozinho ou com o clã | bosses de clã (D49) |
| HB10 | **Avatar em camadas** | Corpo, pele, cabelo, fundo; equipamento visível; **equipamento de batalha** (atributos) separado da **fantasia** (só aparência) | equipamento (V4 §3) |
| HB11 | **Vocabulário de jogo** | Tarefas viram missões, recorrentes viram diárias; liga e desliga à parte | — |
| HB11 | **Animações e sons** | Subir de nível, drop, golpe crítico; respeitam "reduzir movimento" e o som é desligável | — |
| — | **Renascer** | Segue no V4 §1.4 (R1); entra no Completo como o "Orbe do renascimento" | — |
| — | **Desafios com prêmio** | Generalizar os desafios da academia (D184) para qualquer projeto ou time | desafios da academia |
| — | Gemas e assinatura | Ficam no V4 §6 (monetização) | — |

## 4. Arte (vale para HB4, HB8 a HB10)

- **Direção:** ilustração pintada, fantasia sóbria e adulta (tinta e aquarela de caderno de campo, conversando com o `docs/DESIGN.md`), nas cores da marca do §0. Nada de pixel art nem fofo. Legível em 48 px, nos dois temas.
- **ComfyUI do dono** (neste PC: RX 6750 XT, 12 GB; `~/projects/comfyui`, `comfy_run.py`): fluxo fixo e versionado em `art/workflows/`, prompt, semente e modelo de cada imagem em `art/prompts.yaml`; estilo travado (mesmo modelo e paleta; se preciso, LoRA de estilo treinada com imagens aprovadas pelo dono). Avatar em camadas: base fixa e cada peça por máscara (inpainting).
- **Pós-processo:** tirar o fundo, recortar, WebP em dois tamanhos. Cada lote passa pela aprovação do dono.
- **Licença:** só modelos com uso comercial das imagens (Z-Image Turbo e FLUX.2 klein 4B são Apache 2.0; FLUX.1 dev e FLUX.2 klein 9B têm licença não comercial do modelo: conferir o que ela diz das imagens geradas antes de usar). Nunca LoRA de pessoa real nem estilo de artista vivo. Registrar modelo e licença de cada lote.
- **Entrega:** imagens no Storage, baixadas sob demanda e guardadas no aparelho; um conjunto mínimo vem no app.
- **Acessibilidade:** texto alternativo em toda imagem; nenhuma informação só na imagem.
- **Volume:** avatar base (~10), equipamentos (~60), bosses (~20), mascotes (~15 × 3 estágios), cenários (~6), selos de conquista (~80).

## 5. Ordem

1. HB0 identidade visual (ícone, splash, lojas) · HB1 botões dos hábitos.
2. HB3 três níveis no Perfil e HB4 esqueleto do acampamento, com arte provisória.
3. HB2 força do hábito · HB7 recompensas personalizadas (valem no Leve também).
4. HB5 vida, diárias e "o que você fez ontem?".
5. HB6 mana e habilidades.
6. Pipeline de arte e primeiro lote (avatar base e 3 bosses) para aprovar.
7. HB8 mascotes · HB9 missões · HB10 avatar · HB11 vocabulário, animações e sons.

## Decisões em aberto (do dono)

1. Cores da marca nos tokens do app (HB0.1)?
2. Consequência de zerar a vida (proposta no §3).
3. Estilo de arte: escolher entre 3 amostras geradas no ComfyUI.
4. Vocabulário de jogo ligado por padrão no Completo?
5. O Completo será recurso de plano pago (V4 §6)?
