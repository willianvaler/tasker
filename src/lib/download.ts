import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** No celular: grava no cache e abre o "Compartilhar" do sistema (salvar, mandar por e-mail...). */
export async function saveTextFile(name: string, content: string, mimeType: string) {
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
}
