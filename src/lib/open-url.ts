import { Linking, Platform } from 'react-native';

/** Abre um link (arquivo, foto) numa aba nova na web ou no app do sistema no celular. */
export async function openUrl(url: string) {
  if (Platform.OS === 'web') window.open(url, '_blank', 'noopener');
  else await Linking.openURL(url);
}
