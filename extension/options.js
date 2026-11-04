// Endereço do Questlist (produção, alpha ou o seu servidor)
const api = globalThis.browser ?? globalThis.chrome;
const DEFAULT_BASE = 'https://questlist.wavdev.org';
for (const el of document.querySelectorAll('[data-msg]'))
  el.textContent = api.i18n.getMessage(el.dataset.msg);
const input = document.getElementById('base');
api.storage.sync.get({ base: DEFAULT_BASE }).then(({ base }) => (input.value = base));
document.getElementById('save').addEventListener('click', async () => {
  let value = input.value.trim() || DEFAULT_BASE;
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) throw new Error();
    value = url.origin;
  } catch {
    document.getElementById('status').textContent = api.i18n.getMessage('optionsInvalid');
    return;
  }
  await api.storage.sync.set({ base: value });
  input.value = value;
  document.getElementById('status').textContent = api.i18n.getMessage('optionsSaved');
});
