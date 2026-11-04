// O recorte que a extensão manda vem no fragmento do endereço (/clip#<dados>), que some quando o
// app leva para o login. Na carga do app, antes de qualquer redirecionamento, ele fica guardado na
// aba (sessionStorage) até a tela /clip usar (OB15, D305).

const KEY = 'questlist.clip';

export function stashClipFromUrl() {
  try {
    if (window.location.pathname === '/clip' && window.location.hash.length > 1) {
      // O fragmento não vai ao servidor em nenhum pedido; fica só neste navegador
      sessionStorage.setItem(KEY, window.location.hash.slice(1));
    }
  } catch {
    // Sem sessionStorage (aba privada estrita): o recorte se perde se precisar entrar antes
  }
}

export function hasStashedClip() {
  try {
    return !!sessionStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export function takeStashedClip() {
  try {
    const value = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return value;
  } catch {
    return null;
  }
}

