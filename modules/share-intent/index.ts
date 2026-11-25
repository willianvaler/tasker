import { NativeModule, requireOptionalNativeModule } from 'expo';

// "Compartilhar" de outros apps no Android (PB8, D303; imagem e PDF desde o CP1, D366). Fora dele
// (iPhone, Expo Go, web, APK antigo) não existe; na web, o app instalado recebe pelo share_target do
// manifest (só texto e link).

export type SharedPayload = {
  text: string | null;
  title: string | null;
  /** file:// da cópia no cache do app; null se o arquivo passou do tamanho que vale copiar */
  fileUri?: string | null;
  fileName?: string | null;
  fileMime?: string | null;
  /** Em bytes, como texto */
  fileSize?: string | null;
};

declare class ShareIntentModule extends NativeModule<{
  onShare: (event: SharedPayload) => void;
}> {
  take(): SharedPayload | null;
}

export const ShareIntent = requireOptionalNativeModule<ShareIntentModule>('ShareIntent');
