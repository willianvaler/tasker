import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { currentLocale, tr } from './i18n-ref';
import { localStore } from './storage';
import { supabase } from './supabase';

const TOKEN_KEY = 'questlist:push-token';

// Push no celular. Precisa de development build (o Expo Go não recebe push no Android desde o
// SDK 53) e do projectId do EAS em app.json (extra.eas.projectId).

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export const pushSupported = true;

export type PushResult = { ok: true } | { ok: false; reason: string };

/** Pede permissão, pega o token da Expo e registra o aparelho para o usuário logado. */
export async function enablePush(): Promise<PushResult> {
  if (Platform.OS === 'android') {
    // No Android 13+, o pedido de permissão só aparece depois de existir um canal
    await Notifications.setNotificationChannelAsync('default', {
      name: tr('push.channel'),
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const granted =
    current.granted ||
    (await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    }).then(
      (r) => r.granted || r.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL,
    ));
  if (!granted) return { ok: false, reason: tr('push.denied') };

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return { ok: false, reason: tr('push.noProject') };
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const { error } = await supabase.rpc('register_push_token', {
      p_token: token,
      p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
      // O push sai no idioma do aparelho (F3)
      p_locale: currentLocale(),
    });
    if (error) return { ok: false, reason: error.message };
    localStore.setItem(TOKEN_KEY, token);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

/** Para de receber neste aparelho (os outros aparelhos da pessoa continuam recebendo). */
export async function disablePush() {
  const token = localStore.getItem(TOKEN_KEY);
  if (!token) return;
  await supabase.from('push_tokens').delete().eq('token', token);
  localStore.removeItem(TOKEN_KEY);
}

/** Trocou o idioma no app: o aparelho já registrado passa a receber o push no novo idioma (F3). */
export async function updatePushLocale(locale: string) {
  const token = localStore.getItem(TOKEN_KEY);
  if (!token) return;
  await supabase.rpc('register_push_token', {
    p_token: token,
    p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
    p_locale: locale,
  });
}

/** Este aparelho está registrado? */
export function hasPushToken() {
  return !!localStore.getItem(TOKEN_KEY);
}

/** Tocar no aviso abre a tarefa ou o projeto (data.url vem da Edge Function). */
export function usePushTapHandler() {
  useEffect(() => {
    const open = (response: Notifications.NotificationResponse) => {
      if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const url = response.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) router.push(url as Href);
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) open(last);
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, []);
}
