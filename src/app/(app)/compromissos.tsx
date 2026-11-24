import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { CalendarClock, Copy, ExternalLink, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, Pressable, View } from 'react-native';

import { BookingTypeForm, NEW_TYPE } from '@/components/agenda/booking-type-form';
import { readTask } from '@/lib/open-task';
import { READABLE, Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button, IconButton } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { formatDuration, type BookingType } from '@/lib/booking';
import { cn } from '@/lib/cn';
import { useAvailability } from '@/lib/queries/availability';
import {
  useBookingActions,
  useBookingTypes,
  useOwnerBookings,
  type BookingTypeInput,
  type OwnerBooking,
} from '@/lib/queries/booking';
import { useProfile, useToday } from '@/lib/queries/profile';
import { webUrl } from '@/lib/queries/projects';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

/**
 * Compromissos (AG2, D311): o link da agenda, os tipos de compromisso e as reservas recebidas
 * (aprovar, recusar, cancelar). Configurar pede conexão. A disponibilidade fica na tela ao lado.
 */
export default function BookingsScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const online = useIsOnline();
  const today = useToday();
  const profile = useProfile();
  const types = useBookingTypes();
  const bookings = useOwnerBookings();
  const availability = useAvailability(today);
  const { saveType, removeType, respond } = useBookingActions();
  const [editing, setEditing] = useState<(BookingTypeInput & { id?: string }) | null>(null);
  const [removing, setRemoving] = useState<BookingType | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const username = profile.data?.username;
  const agendaUrl = username ? webUrl(`/agenda/${username}`) : null;
  const noHours = availability.data && availability.data.rules.length === 0;

  async function copy(url: string) {
    await Clipboard.setStringAsync(url);
    toast({ message: t('share.copied') });
  }

  return (
    <Screen size="medium">
      <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerClassName="pb-clear">
        <ScreenHeader back help="agenda" title={t('bookingTypes.title')} />
        <View className={cn(READABLE, 'gap-8')}>
          <Text className="text-ink-muted">{t('bookingTypes.intro')}</Text>

          {noHours && (
            <View className="gap-2 rounded border border-line p-4">
              <Text className="text-ink">{t('bookingTypes.noHours')}</Text>
              <Button
                className="self-start"
                icon={CalendarClock}
                label={t('availability.title')}
                onPress={() => router.push('/disponibilidade')}
              />
            </View>
          )}

          {agendaUrl && (
            <View className="gap-2">
              <SectionLabel title={t('bookingTypes.link')} />
              <Text
                selectable
                className="rounded border border-line bg-surface p-3 font-mono text-xs text-ink"
              >
                {agendaUrl}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                <Button icon={Copy} label={t('share.copy')} onPress={() => copy(agendaUrl)} />
                {Platform.OS === 'web' && (
                  <Button
                    variant="ghost"
                    icon={ExternalLink}
                    label={t('bookingTypes.openPage')}
                    onPress={() => Linking.openURL(agendaUrl)}
                  />
                )}
                <Button
                  variant="ghost"
                  icon={CalendarClock}
                  label={t('availability.title')}
                  onPress={() => router.push('/disponibilidade')}
                />
              </View>
              <Text className="text-xs text-ink-muted">{t('bookingTypes.linkHint')}</Text>
            </View>
          )}

          <View className="gap-2">
            <SectionLabel
              title={t('bookingTypes.types')}
              right={
                <Button
                  variant="ghost"
                  icon={Plus}
                  label={t('bookingTypes.new')}
                  disabled={!online}
                  onPress={() => {
                    setSaveError(null);
                    setEditing({ ...NEW_TYPE });
                  }}
                />
              }
            />
            {types.data && types.data.length === 0 ? (
              <EmptyState title={t('bookingTypes.empty')} />
            ) : (
              types.data?.map((type) => {
                const url = username ? webUrl(`/agenda/${username}/${type.slug}`) : null;
                return (
                  <View
                    key={type.id}
                    className="flex-row items-center gap-2 border-b border-line py-2"
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('bookingTypes.editNamed', { name: type.name })}
                      disabled={!online}
                      onPress={() => {
                        setSaveError(null);
                        setEditing(type);
                      }}
                      className="gap-1 flex-1"
                    >
                      <Text
                        className={
                          type.active ? 'font-semibold text-ink' : 'font-semibold text-ink-muted'
                        }
                      >
                        {type.name}
                      </Text>
                      <Text className="text-sm text-ink-muted">
                        {[
                          formatDuration(type.duration_min),
                          type.needs_approval ? t('bookingTypes.withApproval') : null,
                          type.active ? null : t('bookingTypes.inactive'),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </Pressable>
                    {url && (
                      <IconButton
                        icon={Copy}
                        label={t('bookingTypes.copyLink', { name: type.name })}
                        onPress={() => copy(url)}
                      />
                    )}
                  </View>
                );
              })
            )}
          </View>

          <BookingList bookings={bookings.data ?? []} online={online} respond={respond} />
        </View>
      </ScreenScroll>

      {editing && (
        <BookingTypeForm
          initial={editing}
          taken={(types.data ?? []).filter((x) => x.id !== editing.id).map((x) => x.slug)}
          saving={saveType.isPending}
          error={saveError}
          onClose={() => setEditing(null)}
          onSave={(value) =>
            saveType
              .mutateAsync(value)
              .then(() => {
                setEditing(null);
                toast({ message: t('bookingTypes.saved') });
              })
              .catch((e: Error) =>
                setSaveError(t('availability.saveError', { message: e.message })),
              )
          }
          onDelete={
            editing.id
              ? () => {
                  const found = types.data?.find((x) => x.id === editing.id);
                  if (found) setRemoving(found);
                }
              : undefined
          }
        />
      )}
      {removing && (
        <ConfirmDialog
          title={t('bookingTypes.deleteTitle', { name: removing.name })}
          message={t('bookingTypes.deleteMessage')}
          confirmLabel={t('bookingTypes.delete')}
          destructive
          onClose={() => setRemoving(null)}
          onConfirm={() => {
            const id = removing.id;
            setRemoving(null);
            setEditing(null);
            removeType.mutate(id);
          }}
        />
      )}
    </Screen>
  );
}

function BookingList({
  bookings,
  online,
  respond,
}: {
  bookings: OwnerBooking[];
  online: boolean;
  respond: ReturnType<typeof useBookingActions>['respond'];
}) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [cancelling, setCancelling] = useState<OwnerBooking | null>(null);
  const format = new Intl.DateTimeFormat(i18n.language, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const act = (b: OwnerBooking, action: 'approve' | 'decline' | 'cancel') =>
    respond
      .mutateAsync({ id: b.id, action })
      .then(() => toast({ message: t(`bookingTypes.done.${action}`) }))
      .catch((e: Error) => toast({ message: t('availability.saveError', { message: e.message }) }));
  const pending = bookings.filter((b) => b.status === 'pending').length;

  return (
    <View className="gap-2">
      <SectionLabel title={t('bookingTypes.bookings')} count={pending || undefined} />
      {bookings.length === 0 ? (
        <Text className="text-ink-muted">{t('bookingTypes.noBookings')}</Text>
      ) : (
        bookings.map((b) => (
          <View key={b.id} className="gap-1 border-b border-line py-2">
            <Pressable
              accessibilityRole={b.task_id ? 'link' : undefined}
              disabled={!b.task_id}
              onPress={() => b.task_id && readTask(b.task_id)}
            >
              <Text
                className={cn(
                  'text-ink',
                  (b.status === 'cancelled' || b.status === 'declined') &&
                    'text-ink-muted line-through',
                )}
              >
                {format.format(new Date(b.starts_at))} · {b.type_name} · {b.guest_name}
              </Text>
              <Text className="text-sm text-ink-muted">
                {[t(`bookingTypes.status.${b.status}`), b.guest_email, b.guest_phone]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              {b.guest_note ? <Text className="text-sm text-ink">{b.guest_note}</Text> : null}
            </Pressable>
            {(b.status === 'pending' || b.status === 'confirmed') && (
              <View className="flex-row flex-wrap gap-2">
                {b.status === 'pending' && (
                  <>
                    <Button
                      label={t('bookingTypes.approve')}
                      disabled={!online}
                      onPress={() => act(b, 'approve')}
                    />
                    <Button
                      variant="ghost"
                      label={t('bookingTypes.decline')}
                      disabled={!online}
                      onPress={() => act(b, 'decline')}
                    />
                  </>
                )}
                {b.status === 'confirmed' && (
                  <Button
                    variant="ghost"
                    destructive
                    label={t('bookingTypes.cancelBooking')}
                    disabled={!online}
                    onPress={() => setCancelling(b)}
                  />
                )}
              </View>
            )}
          </View>
        ))
      )}
      {cancelling && (
        <ConfirmDialog
          title={t('bookingTypes.cancelTitle', { name: cancelling.guest_name })}
          message={t('bookingTypes.cancelMessage')}
          confirmLabel={t('booking.cancel')}
          destructive
          onClose={() => setCancelling(null)}
          onConfirm={() => {
            const b = cancelling;
            setCancelling(null);
            void act(b, 'cancel');
          }}
        />
      )}
    </View>
  );
}
