# Google Play: roteiro de publicação

Conta de desenvolvedor **pessoal** (CPF, sem CNPJ), decidida pelo dono em 19/10/2026. Começa pelo **teste interno** (até 100 pessoas por e-mail, sem a exigência de 12 testadores por 14 dias). Lançar para todo mundo exige antes um teste fechado com pelo menos 12 pessoas por 14 dias seguidos (regra das contas pessoais novas; confira no Play Console, muda de vez em quando).

## Pacote

- `npm run apk -- --aab` gera `dist-play/questlist-<código>.aab` (fora do git). Sai com `EXPO_PUBLIC_STORE=play`: o app da loja não oferece APK por fora (a política da Play proíbe se atualizar por outro caminho).
- Nome do pacote: `com.willianvaler.questlist` (não muda depois de publicado).
- O código da versão é o número de commits: cada envio precisa de um maior que o anterior.
- **Assinatura:** o `.aab` sai assinado com a chave de `~/.config/questlist/release.keystore`, a mesma do APK. No Play Console, em "Assinatura de apps", escolha **usar a sua própria chave** e envie essa (o Console explica como exportar com a ferramenta dele). Assim o app da loja e o APK têm a mesma assinatura: quem tem o APK atualiza pela loja sem desinstalar, e o app do relógio (V5 §1.2) casa com os dois. Se deixar o Google gerar a chave, quem tem o APK precisa desinstalar antes de instalar pela loja.

## Ficha da loja

- Nome: Questlist. Descrição curta (até 80): "Tarefas, hábitos e projetos em grupo, com um jogo leve para manter o ritmo."
- Ícone 512×512, imagem de destaque 1024×500, pelo menos 2 capturas do celular (`npm run capturas` gera as de 390 px).
- Categoria: Produtividade. E-mail de contato: obrigatório (público).
- Política de privacidade: `https://questlist.wavdev.org/privacidade`.

## Conteúdo do app (questionários)

| Item | Resposta |
|---|---|
| Acesso ao app | Precisa de login: criar uma **conta de teste na produção** e informar e-mail e senha para a revisão do Google |
| Anúncios | Não |
| Classificação indicativa | Utilitário/produtividade; pessoas interagem (comentários em projetos e clã); sem violência realista (o "boss" é abstrato); sem compras |
| Público-alvo | 13 anos ou mais (idade mínima dos termos, D213) |
| Apps de saúde | Tem registro de treino (academia); não é app médico; não usa Health Connect ainda (V7, quando entrar, há formulário próprio) |
| Exclusão de conta | No app: Perfil → Privacidade → Excluir conta. Na web: `https://questlist.wavdev.org`, mesmo caminho (entrar e excluir; os dados saem na hora, D213) |
| Notícias, governo, finanças, COVID | Não |

## Segurança dos dados

Tudo **criptografado em trânsito** (HTTPS). A pessoa **pode pedir a exclusão** (no app). Nada é vendido nem usado para anúncio.

| Tipo de dado | Coletado | Para quê | Obrigatório |
|---|---|---|---|
| E-mail | Sim | Conta | Sim |
| Nome (apelido) | Sim | Funcionalidade (projetos, clã) | Sim |
| Fotos | Sim | Anexos e foto da nota | Não |
| Informações financeiras: outras (gastos lançados) | Sim | Funcionalidade | Não |
| Saúde e condicionamento físico: condicionamento (treinos) | Sim | Funcionalidade | Não |
| Mensagens no app (comentários) | Sim | Funcionalidade | Não |
| Outro conteúdo do usuário (tarefas, anotações) | Sim | Funcionalidade | Sim |
| Atividade no app (ações, XP) | Sim | Funcionalidade | Sim |
| IDs do dispositivo (token de push) | Sim | Avisos | Não |
| Localização, contatos, áudio, navegação | Não | | |

**Compartilhamento:** a foto da nota vai ao Google (Gemini) só para ser lida, como prestador de serviço; pela definição da Play, isso não conta como "compartilhar". Confira se o texto da política continua dizendo isso antes de responder.

## Antes do primeiro envio

- [ ] Conta de teste na produção para a revisão
- [ ] Chave própria na "Assinatura de apps" (acima)
- [ ] Capturas e ícone
- [ ] Lista de testadores do teste interno (e-mails das contas Google)
