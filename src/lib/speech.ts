import { requireOptionalNativeModule } from 'expo';

// Reconhecimento de fala (PB7, D302) no Android e no iPhone: só existe no APK novo (no Expo Go ou
// num APK antigo o módulo nativo falta, e o botão de voz some em vez de derrubar o app).
type SpeechModule = typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule;
const present = !!requireOptionalNativeModule('ExpoSpeechRecognition');

export const speech: SpeechModule | null = present
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('expo-speech-recognition') as typeof import('expo-speech-recognition'))
      .ExpoSpeechRecognitionModule
  : null;

export function speechAvailable() {
  try {
    return !!speech?.isRecognitionAvailable();
  } catch {
    return false;
  }
}
