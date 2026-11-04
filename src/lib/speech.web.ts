import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

// Na web, o reconhecimento é o do navegador (Web Speech API: Chrome, Edge e Safari; o Firefox não
// tem). PB7, D302.
export const speech = ExpoSpeechRecognitionModule;

export function speechAvailable() {
  try {
    return speech.isRecognitionAvailable();
  } catch {
    return false;
  }
}
