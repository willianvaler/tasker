# App do relógio (Wear OS)

Companheiro do Modo Treino (D287): o treino aberto no celular aparece no relógio, com Feita, Pular e +30 s, e o relógio vibra no fim do descanso. O código fica em `wear/` (Kotlin + Compose for Wear OS); o lado do celular, em `modules/workout-live` (`WearSync.kt`, `WearActionService.kt`).

## Precisa

- Relógio com Wear OS 3 ou mais novo (Galaxy Watch4 em diante), pareado com o celular (no Samsung, pelo app Galaxy Wearable).
- No celular, o APK do Questlist a partir do código que tem o `WearSync` (X3). O APK antigo não fala com o relógio.
- Os dois apps assinados com a mesma chave (`~/.config/questlist/release.keystore`): o `npm run wear` usa a do `npm run apk`.

## Instalar pelo celular, sem computador (para quem usa)

O guia curto está na Ajuda do app (artigo "Séries, repetições e descanso", em "Instalar o app no relógio"): ligar a Depuração por Wi-Fi no relógio, baixar `https://questlist.wavdev.org/downloads/questlist-wear.apk` no celular e mandar para o relógio com um instalador da Play Store (Wear Installer 2, Bugjaeger). Publicar o APK do relógio: `npm run wear` e copiar `downloads/questlist-wear.apk` para o `downloads/` do servidor, junto com o do celular.

## Compilar e instalar no relógio (pelo PC)

O relógio não instala APK pelo navegador: vai por adb pelo Wi-Fi, a partir deste PC.

1. No relógio: **Configurações → Sobre o relógio → Software**, toque 7 vezes em **Versão do software** (liga as Opções do desenvolvedor).
2. **Configurações → Opções do desenvolvedor**: ligue **Depuração ADB** e **Depuração por Wi-Fi**. O relógio e o PC precisam estar na mesma rede Wi-Fi (o relógio no Wi-Fi, não só no Bluetooth do celular).
3. Em **Depuração por Wi-Fi → Parear novo dispositivo**, o relógio mostra um endereço `IP:porta` e um código de 6 dígitos. No PC:
   ```bash
   ~/Android/Sdk/platform-tools/adb pair IP:PORTA_DO_PAREAMENTO CODIGO
   ```
4. Na tela **Depuração por Wi-Fi** aparece outro `IP:porta` (o de conexão). Compile e instale:
   ```bash
   npm run wear -- --install IP:PORTA_DE_CONEXAO
   ```
   Sem `--install`, só compila (`downloads/questlist-wear.apk`).
5. No relógio, abra o **Questlist** uma vez e aceite as notificações (é o que põe o treino no mostrador).

Depois de instalado, desligue a Depuração por Wi-Fi: ela gasta bateria.

## Usar

Abra o Modo Treino no celular: o relógio mostra a série (sozinho, pelo aviso fixo, ou abrindo o app). **Feita**, **Pular** e **+30 s** fazem o mesmo que os botões da notificação do celular. O celular precisa estar por perto, com o treino aberto. Sem nenhum celular conectado, o relógio avisa "Celular fora de alcance".

## Testar sem relógio

Emulador do Wear OS (`system-images;android-33;android-wear;x86_64`, AVD `questlist-wear`). O build de debug tem um modo de demonstração:

```bash
(cd wear && ./gradlew assembleDebug) && adb install -r wear/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.willianvaler.questlist/.wear.MainActivity --es demo set   # ou rest
```
