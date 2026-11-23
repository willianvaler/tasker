import { router, useLocalSearchParams } from 'expo-router';
import { AArrowDown, AArrowUp, ChevronLeft, ChevronRight, Pencil } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, View } from 'react-native';

import { HtmlView, PdfView } from '@/components/material-view';
import { useOpenLink } from '@/components/note-links';
import { NoteMarkdown, NoteTextScale } from '@/components/note-markdown';
import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { StudySessionBar } from '@/components/study';
import { useTaskMaterialList } from '@/components/task-materials';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button, IconButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { formatBytes } from '@/lib/attachments';
import { materialTitle } from '@/lib/materials';
import { getReaderScale, setReaderScale } from '@/lib/prefs';
import { useLinkTitles } from '@/lib/queries/links';
import {
  type Material,
  useMaterial,
  useProjectMaterials,
  useReadingPosition,
  useSaveReadingPosition,
} from '@/lib/queries/materials';
import { useNotes } from '@/lib/queries/notes';
import { useTask } from '@/lib/queries/tasks';
import { findFolder, useTree } from '@/lib/queries/tree';
import { neighbors, nextScale } from '@/lib/study';
import { parseLinks } from '@/lib/wikilinks';

/**
 * Tela de leitura do material (ES4/ES5/ES7, D325/D326/D328): PDF no leitor, HTML interativo isolado,
 * anotação em leitura (com Editar). **Anterior / próximo** na ordem do material da tarefa (com
 * `?tarefa=`) ou do projeto; **onde parei** (a rolagem da anotação, a página do PDF) por pessoa;
 * tamanho do texto e tema; com a tarefa, a sessão embaixo (foco e concluir).
 */
export default function MaterialScreen() {
  const { t, i18n } = useTranslation();
  const { id, tarefa } = useLocalSearchParams<{ id: string; tarefa?: string }>();
  const material = useMaterial(id);
  const task = useTask(tarefa);
  const tree = useTree();
  const m = material.data;
  const found = m ? findFolder(tree.data, m.folder_id) : null;
  const root = found?.parent ?? (found && 'children' in found.folder ? found.folder : undefined);
  const project = useProjectMaterials(root ? [root.id, ...root.children.map((c) => c.id)] : []);
  const forTask = useTaskMaterialList(tarefa ? (task.data ?? null) : null);
  const [scale, setScale] = useState(getReaderScale);

  // A ordem: a do material da tarefa, quando veio dela; senão, a do projeto
  const order =
    tarefa && forTask.items.length
      ? forTask.items.map((x) => ({ id: x.material_id }))
      : (project.data ?? []).map((x) => ({ id: x.id }));
  const { prev, next } = neighbors(order, id);
  const go = (target: { id: string }) =>
    router.replace({
      pathname: '/material/[id]',
      params: tarefa ? { id: target.id, tarefa } : { id: target.id },
    });
  const changeScale = (direction: 1 | -1) => {
    const value = nextScale(scale, direction);
    setScale(value);
    setReaderScale(value);
  };
  const isNote = !!m?.note_id;

  return (
    <Screen size="wide">
      <ScreenHeader
        title={m ? materialTitle(m.name) : t('materials.title')}
        eyebrow={
          m
            ? [
                found?.folder.name,
                isNote
                  ? t('materials.kindNote')
                  : t(m.mime === 'text/html' ? 'materials.kindHtml' : 'materials.kindPdf', {
                      size: formatBytes(m.size ?? 0, i18n.language),
                    }),
              ]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        back
      />
      {/* Controles numa faixa própria: no celular, o título fica com a largura toda */}
      <View
        className="-mt-1 flex-row flex-wrap items-center justify-end pb-1"
        testID="reader-tools"
      >
        {isNote && (
          <>
            <IconButton
              icon={AArrowDown}
              label={t('study.smaller')}
              onPress={() => changeScale(-1)}
            />
            <IconButton icon={AArrowUp} label={t('study.bigger')} onPress={() => changeScale(1)} />
          </>
        )}
        <ThemeToggle />
        <IconButton
          icon={ChevronLeft}
          label={t('study.prev')}
          disabled={!prev}
          onPress={() => prev && go(prev)}
        />
        <IconButton
          icon={ChevronRight}
          label={t('study.next')}
          disabled={!next}
          onPress={() => next && go(next)}
        />
      </View>
      {material.isPending ? null : !m ? (
        <EmptyState title={t('materials.missing')} />
      ) : m.note_id ? (
        <NoteReader key={m.id} material={m} noteId={m.note_id} scale={scale} />
      ) : !m.path ? (
        <EmptyState title={t('materials.missing')} />
      ) : m.mime === 'text/html' ? (
        <View className="flex-1 pb-4">
          <HtmlView path={m.path} name={m.name} />
        </View>
      ) : (
        <PdfReader key={m.id} material={m} path={m.path} />
      )}
      {tarefa && <StudySessionBar taskId={tarefa} />}
    </Screen>
  );
}

/** A anotação em leitura, com a rolagem guardada (onde parei) */
function NoteReader({
  material,
  noteId,
  scale,
}: {
  material: Material;
  noteId: string;
  scale: number;
}) {
  const { t } = useTranslation();
  const notes = useNotes({ templates: 'include' });
  const note = notes.data?.find((n) => n.id === noteId);
  const position = useReadingPosition(material.id);
  const save = useSaveReadingPosition(material.id);
  const openLink = useOpenLink();
  const resolve = useLinkTitles(
    parseLinks(note?.body ?? '').flatMap((l) =>
      l.kind && l.id ? [{ kind: l.kind, id: l.id }] : [],
    ),
  );
  const scroll = useRef<ScrollView>(null);
  const viewport = useRef(0);
  const content = useRef(0);
  /** A pessoa já rolou: daí em diante, vale a rolagem dela */
  const touched = useRef(false);
  /** Hora da última rolagem feita pelo app (o onScroll dela não é da pessoa) */
  const programmatic = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Volta para onde parou; repete enquanto o texto cresce (imagens, fórmulas), até a pessoa rolar
  const tryRestore = () => {
    const ratio = position.data?.scroll ?? 0;
    if (touched.current || position.isPending || ratio <= 0) return;
    if (viewport.current <= 0 || content.current <= viewport.current) return;
    programmatic.current = Date.now();
    scroll.current?.scrollTo({ y: ratio * (content.current - viewport.current), animated: false });
  };
  useEffect(tryRestore);

  if (notes.isPending) return null;
  if (!note) return <EmptyState title={t('materials.missing')} />;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (position.isPending || Date.now() - programmatic.current < 400) return;
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const room = contentSize.height - layoutMeasurement.height;
    if (room <= 0) return;
    touched.current = true;
    const ratio = Math.min(1, Math.max(0, contentOffset.y / room));
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () => save.mutate({ scroll: Math.round(ratio * 1000) / 1000 }),
      1200,
    );
  };

  return (
    <ScreenScroll
      ref={scroll}
      contentContainerClassName="pb-clear"
      scrollEventThrottle={200}
      onScroll={onScroll}
      onLayout={(e) => {
        viewport.current = e.nativeEvent.layout.height;
        tryRestore();
      }}
      onContentSizeChange={(_w, h) => {
        content.current = h;
        tryRestore();
      }}
      testID="note-reader"
    >
      <View className="flex-row justify-end">
        <Button
          variant="ghost"
          icon={Pencil}
          label={t('study.edit')}
          onPress={() => router.push({ pathname: '/nota/[id]', params: { id: noteId } })}
        />
      </View>
      <NoteTextScale.Provider value={scale}>
        <NoteMarkdown value={note.body} resolve={resolve} onLink={openLink} />
      </NoteTextScale.Provider>
    </ScreenScroll>
  );
}

/** O PDF com a página onde parou (o leitor do navegador abre nela) */
function PdfReader({ material, path }: { material: Material; path: string }) {
  const { t } = useTranslation();
  const position = useReadingPosition(material.id);
  const save = useSaveReadingPosition(material.id);
  const saved = position.data?.page;
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? (saved ? String(saved) : '');
  const commit = () => {
    const page = Number(value);
    setDraft(null);
    if (Number.isInteger(page) && page > 0 && page !== saved) save.mutate({ page });
  };
  if (position.isPending) return null;
  return (
    <View className="flex-1 gap-2 pb-4">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="text-sm text-ink-muted">{t('study.page')}</Text>
        <Input
          accessibilityLabel={t('study.page')}
          accessibilityHint={t('study.pageHint')}
          value={value}
          onChangeText={(text) => setDraft(text.replace(/\D/g, '').slice(0, 5))}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType="number-pad"
          className="w-20"
        />
      </View>
      <PdfView path={path} name={material.name} page={saved} />
    </View>
  );
}
