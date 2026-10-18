import * as ImagePicker from 'expo-image-picker';
import { Camera, ImageIcon, Send, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Platform, Pressable, View } from 'react-native';

import { Button, IconButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/person';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import {
  REACTIONS,
  useGroupPosts,
  usePhotoUrls,
  usePostActions,
  type Group,
  type GroupPost,
  type PhotoInput,
} from '@/lib/queries/challenges';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';

type Names = Map<string, string>;

function useWhen() {
  const { i18n } = useTranslation();
  const format = new Intl.DateTimeFormat(i18n.language, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  return (iso: string) => format.format(new Date(iso));
}

/** Mural do grupo (V6 §15.5, AC10.5): check-in do treino do dia, com foto, reações e comentários. */
export function GroupWall({ group, names }: { group: Group; names: Names }) {
  const { t } = useTranslation();
  const me = useSession().session?.user.id;
  const posts = useGroupPosts(group);
  const actions = usePostActions(group, me);
  const toast = useToast();
  const [body, setBody] = useState('');
  const [photo, setPhoto] = useState<PhotoInput | null>(null);

  const all = posts.data ?? [];
  const checkins = all.filter((p) => p.kind === 'checkin');
  const comments = all.filter((p) => p.kind === 'comment');
  const photos = usePhotoUrls(checkins.flatMap((p) => (p.photo_path ? [p.photo_path] : [])));

  async function pick(camera: boolean) {
    if (camera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return toast({ message: t('attach.noCamera') });
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
    const result = camera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return;
    const asset = result.assets[0];
    setPhoto({ uri: asset.uri, width: asset.width, height: asset.height });
  }

  function checkIn() {
    if (!body.trim() && !photo) return;
    actions.send.mutate(
      { kind: 'checkin', body, photo },
      {
        onSuccess: () => {
          setBody('');
          setPhoto(null);
        },
        onError: (e) => toast({ message: t('page.error', { message: e.message }) }),
      },
    );
  }

  return (
    <View className="gap-6">
      <View className="gap-3 rounded-lg border border-line bg-surface p-4">
        <Text accessibilityRole="header" className="text-base font-semibold text-ink">
          {t('group.checkinTitle')}
        </Text>
        <Input
          value={body}
          onChangeText={setBody}
          placeholder={t('group.checkinPlaceholder')}
          accessibilityLabel={t('group.checkinPlaceholder')}
          multiline
          maxLength={2000}
        />
        {photo && (
          <View className="flex-row items-center gap-2">
            <Image
              source={{ uri: photo.uri }}
              accessibilityIgnoresInvertColors
              className="h-20 w-20 rounded"
            />
            <IconButton icon={X} label={t('group.removePhoto')} onPress={() => setPhoto(null)} />
          </View>
        )}
        <View className="flex-row flex-wrap items-center gap-2">
          {Platform.OS !== 'web' && (
            <IconButton icon={Camera} label={t('attach.fromCamera')} onPress={() => pick(true)} />
          )}
          <IconButton icon={ImageIcon} label={t('group.addPhoto')} onPress={() => pick(false)} />
          <View className="flex-1" />
          <Button
            label={t('group.checkin')}
            loading={actions.send.isPending}
            disabled={actions.send.isPending || (!body.trim() && !photo)}
            onPress={checkIn}
          />
        </View>
      </View>

      {posts.data && checkins.length === 0 && <EmptyState title={t('group.noCheckins')} />}
      {checkins.map((post) => (
        <CheckinCard
          key={post.id}
          post={post}
          names={names}
          photoUrl={post.photo_path ? photos.data?.[post.photo_path] : undefined}
          comments={comments.filter((c) => c.parent_id === post.id).reverse()}
          group={group}
        />
      ))}
    </View>
  );
}

function CheckinCard({
  post,
  names,
  photoUrl,
  comments,
  group,
}: {
  post: GroupPost;
  names: Names;
  photoUrl?: string;
  comments: GroupPost[];
  group: Group;
}) {
  const { t } = useTranslation();
  const me = useSession().session?.user.id;
  const actions = usePostActions(group, me);
  const when = useWhen();
  const [comment, setComment] = useState('');
  const name = names.get(post.user_id) ?? t('common.someone');

  return (
    <View className="gap-3 rounded-lg border border-line bg-surface p-4">
      <View className="flex-row items-center gap-2">
        <Avatar name={name} size={32} />
        <View className="flex-1">
          <Text className="text-sm font-semibold text-ink">{name}</Text>
          <Text className="font-mono text-xs text-ink-muted">{when(post.created_at)}</Text>
        </View>
        {post.user_id === me && (
          <IconButton
            icon={Trash2}
            label={t('group.deletePost')}
            onPress={() => actions.remove.mutate(post)}
          />
        )}
      </View>
      {!!post.body && <Text className="text-sm text-ink">{post.body}</Text>}
      {photoUrl && (
        <Image
          source={{ uri: photoUrl }}
          accessibilityLabel={t('group.photoOf', { name })}
          className="aspect-square w-full rounded"
          resizeMode="cover"
        />
      )}
      <Reactions post={post} group={group} />
      {comments.map((c) => (
        <View key={c.id} className="flex-row gap-2 border-t border-line pt-2">
          <Text className="text-sm font-semibold text-ink">
            {names.get(c.user_id) ?? t('common.someone')}
          </Text>
          <Text className="flex-1 text-sm text-ink">{c.body}</Text>
        </View>
      ))}
      <View className="flex-row items-center gap-2">
        <Input
          className="flex-1"
          value={comment}
          onChangeText={setComment}
          placeholder={t('group.commentPlaceholder')}
          accessibilityLabel={t('group.commentPlaceholder')}
          maxLength={2000}
          submitBehavior="submit"
          onSubmitEditing={() => {
            if (!comment.trim()) return;
            actions.send.mutate({ kind: 'comment', body: comment, parentId: post.id });
            setComment('');
          }}
        />
      </View>
    </View>
  );
}

function Reactions({ post, group }: { post: GroupPost; group: Group }) {
  const { t } = useTranslation();
  const me = useSession().session?.user.id;
  const actions = usePostActions(group, me);
  return (
    <View className="flex-row flex-wrap gap-2">
      {REACTIONS.map((emoji) => {
        const count = post.reactions.filter((r) => r.emoji === emoji).length;
        const mine = post.reactions.some((r) => r.emoji === emoji && r.user_id === me);
        return (
          <Pressable
            key={emoji}
            accessibilityRole="button"
            aria-pressed={mine}
            accessibilityLabel={t('group.react', { emoji, count })}
            onPress={() => actions.react.mutate({ post, emoji })}
            className={cn(
              'min-h-8 flex-row items-center gap-1 rounded border border-line px-2',
              mine && 'bg-wash',
            )}
          >
            <Text className="text-sm">{emoji}</Text>
            {count > 0 && <Text className="font-mono text-xs text-ink">{count}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Chat do grupo (V6 §15.5): mensagens curtas, as mais novas embaixo. */
export function GroupChat({ group, names }: { group: Group; names: Names }) {
  const { t } = useTranslation();
  const me = useSession().session?.user.id;
  const posts = useGroupPosts(group);
  const actions = usePostActions(group, me);
  const when = useWhen();
  const [body, setBody] = useState('');
  const messages = (posts.data ?? []).filter((p) => p.kind === 'message').reverse();

  function send() {
    if (!body.trim()) return;
    actions.send.mutate({ kind: 'message', body });
    setBody('');
  }

  return (
    <View className="gap-4">
      {posts.data && messages.length === 0 && <EmptyState title={t('group.noMessages')} />}
      <View accessibilityRole="list" aria-label={t('group.chat')} className="gap-2">
        {messages.map((m) => {
          const mine = m.user_id === me;
          return (
            <View
              key={m.id}
              className={cn(
                'max-w-[85%] gap-1 rounded-lg border border-line p-3',
                mine ? 'self-end bg-wash' : 'self-start bg-surface',
              )}
            >
              <Text className="font-mono text-xs text-ink-muted">
                {mine ? t('group.you') : (names.get(m.user_id) ?? t('common.someone'))} ·{' '}
                {when(m.created_at)}
              </Text>
              <Text className="text-sm text-ink">{m.body}</Text>
            </View>
          );
        })}
      </View>
      <View className="flex-row items-center gap-2">
        <Input
          className="flex-1"
          value={body}
          onChangeText={setBody}
          placeholder={t('group.messagePlaceholder')}
          accessibilityLabel={t('group.messagePlaceholder')}
          maxLength={2000}
          submitBehavior="submit"
          onSubmitEditing={send}
        />
        <IconButton icon={Send} label={t('group.send')} onPress={send} />
      </View>
    </View>
  );
}
