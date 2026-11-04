import { NativeModule, requireOptionalNativeModule } from 'expo';

// "Compartilhar" de outros apps no Android (PB8, D303). Fora dele (iPhone, Expo Go, web, APK antigo)
// não existe; na web, o app instalado recebe pelo share_target do manifest.

export type SharedPayload = { text: string | null; title: string | null };

declare class ShareIntentModule extends NativeModule<{
  onShare: (event: SharedPayload) => void;
}> {
  take(): SharedPayload | null;
}

export const ShareIntent = requireOptionalNativeModule<ShareIntentModule>('ShareIntent');
