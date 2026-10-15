// Service Worker do Questlist (J4, D126): só para mostrar e abrir os avisos de fim de timer na
// web (no Chrome do Android, `new Notification` não existe: o aviso precisa vir daqui). Não guarda
// nada em cache e não roda nada em segundo plano.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Tocar no aviso traz o app de volta (a aba que já estava aberta, se houver)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows[0];
      return open ? open.focus() : self.clients.openWindow('/');
    }),
  );
});
