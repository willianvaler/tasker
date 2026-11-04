import { Mic, Square } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { speech, speechAvailable } from '@/lib/speech';
import { speechLang, spokenLines } from '@/lib/spoken-list';
import { useToast } from '@/providers/toast';

// Falar uma lista e virar tarefas (PB7, V3 §6 B, D302). Cada frase (o reconhecedor fecha uma a cada
// pausa) vira uma ou mais linhas: `onLines` recebe as de cada frase e `onDone`, todas, quando para
// de ouvir. O reconhecimento é o do aparelho ou do navegador; onde não existe, o botão nem aparece.

type Props = {
  onLines?: (lines: string[]) => void;
  onDone?: (lines: string[]) => void;
  className?: string;
};

export function VoiceButton({ onLines, onDone, className }: Props) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [available] = useState(speechAvailable);
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const heard = useRef<string[]>([]);
  // As funções de quem usa mudam a cada render; o ouvinte lê sempre as de agora
  const callbacks = useRef({ onLines, onDone });
  useEffect(() => {
    callbacks.current = { onLines, onDone };
  });

  useEffect(() => {
    if (!speech || !available) return;
    const lang = i18n.language;
    const subs = [
      speech.addListener('start', () => setListening(true)),
      speech.addListener('result', (event) => {
        const transcript = event.results[0]?.transcript ?? '';
        if (!event.isFinal) return setPartial(transcript);
        setPartial('');
        const lines = spokenLines(transcript, lang);
        if (!lines.length) return;
        heard.current.push(...lines);
        callbacks.current.onLines?.(lines);
      }),
      speech.addListener('error', (event) => {
        if (event.error === 'aborted' || event.error === 'no-speech') return;
        toast({
          message: t(
            event.error === 'not-allowed' || event.error === 'service-not-allowed'
              ? 'voice.denied'
              : event.error === 'network'
                ? 'voice.network'
                : 'voice.failed',
          ),
        });
      }),
      speech.addListener('end', () => {
        setListening(false);
        setPartial('');
        const all = heard.current;
        heard.current = [];
        if (all.length) callbacks.current.onDone?.(all);
      }),
    ];
    return () => {
      subs.forEach((s) => s.remove());
      speech?.abort();
    };
  }, [available, i18n.language, t, toast]);

  if (!speech || !available) return null;

  async function start() {
    if (!speech) return;
    const permission = await speech.requestPermissionsAsync();
    if (!permission.granted) return toast({ message: t('voice.denied') });
    heard.current = [];
    speech.start({
      lang: speechLang(i18n.language),
      interimResults: true,
      continuous: true,
      addsPunctuation: false,
    });
  }

  return (
    <View className={className}>
      <Button
        variant="ghost"
        icon={listening ? Square : Mic}
        className="self-start"
        label={t(listening ? 'voice.stop' : 'voice.start')}
        aria-pressed={listening}
        onPress={() => (listening ? speech?.stop() : start())}
      />
      {listening && (
        <Text accessibilityLiveRegion="polite" className="px-3 text-sm text-ink-muted">
          {partial || t('voice.listening')}
        </Text>
      )}
    </View>
  );
}
