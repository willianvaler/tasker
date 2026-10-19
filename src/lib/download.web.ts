/** Na web: baixa o arquivo direto pelo navegador. */
export async function saveFile(name: string, content: string | Uint8Array, mimeType: string) {
  const type = typeof content === 'string' ? `${mimeType};charset=utf-8` : mimeType;
  const url = URL.createObjectURL(new Blob([content as BlobPart], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const saveTextFile = (name: string, content: string, mimeType: string) =>
  saveFile(name, content, mimeType);
