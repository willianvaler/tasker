import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Tables } from '../db';
import type { EffortSetting } from '../gym/effort';
import { DEFAULT_BAR, DEFAULT_PLATES } from '../gym/plates';
import type { WeightUnit } from '../gym/types';
import { todayIn } from '../parser/dates';
import { supabase } from '../supabase';
import type { ReviewPrefs } from '../weekly-review';
import { useSession } from '@/providers/session';
import { keys } from './keys';

export type Profile = Tables<'profiles'>;

const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

export function useProfile() {
  const { session } = useSession();
  return useQuery({
    queryKey: keys.profile,
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session?.user.id ?? '')
        .single();
      if (error) throw error;
      return data;
    },
  });
}

/** Fuso do perfil (padrão America/Sao_Paulo enquanto carrega). */
export function useTimeZone() {
  const { data } = useProfile();
  return data?.timezone ?? DEFAULT_TIMEZONE;
}

/** Hoje ('YYYY-MM-DD') no fuso do perfil. */
export function useToday() {
  return todayIn(useTimeZone());
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { session } = useSession();
  return useMutation({
    mutationFn: async (patch: {
      display_name?: string;
      timezone?: string;
      onboarded_at?: string;
      locale?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', session?.user.id ?? '')
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(keys.profile, profile);
      queryClient.invalidateQueries({ queryKey: keys.tasks });
    },
  });
}

/** Preferências de interface salvas no perfil (valem em todos os aparelhos, V6 §15.2). */
export type UiPrefs = {
  sidebar?: { order?: string[]; hidden?: string[] };
  /** As duas posições do meio da barra de baixo do celular (D258, `lib/tab-slots.ts`) */
  tabs?: string[];
  /** Revisão semanal (PB3): última feita ou dispensada */
  review?: ReviewPrefs;
  /** Bem-estar (D270): a Academia aparece dentro dele em vez de ter lugar próprio */
  wellness?: { gym?: boolean };
  /** Registro do treino (AC4): unidade de carga e escala de esforço */
  gym?: {
    unit?: WeightUnit;
    effort?: EffortSetting;
    figure?: 'male' | 'female';
    /** Barra e anilhas que a pessoa tem (AC9), na unidade dela */
    bar?: number;
    plates?: number[];
    /** Lembrete em dia de treino (AC9.5); padrão ligado */
    remind?: boolean;
  };
};

/** Unidade (padrão kg, V6 decisão 3) e esforço (padrão desligado) de quem treina. */
export function useGymPrefs(): {
  unit: WeightUnit;
  effort: EffortSetting;
  bar: number;
  plates: number[];
} {
  const gym = useUiPrefs().gym ?? {};
  const unit: WeightUnit = gym.unit === 'lb' ? 'lb' : 'kg';
  return {
    unit,
    effort: gym.effort === 'rir' || gym.effort === 'rpe' ? gym.effort : 'off',
    bar: typeof gym.bar === 'number' && gym.bar >= 0 ? gym.bar : DEFAULT_BAR[unit],
    plates: Array.isArray(gym.plates) && gym.plates.length ? gym.plates : DEFAULT_PLATES[unit],
  };
}

/** Treino ligado e "Academia dentro do Bem-estar" (D270): o Treino sai da navegação e mora lá. */
export function useGymInWellness(): boolean {
  const gymOn = useProfile().data?.gym_enabled === true;
  const inside = useUiPrefs().wellness?.gym === true;
  return gymOn && inside;
}

export function useUiPrefs(): UiPrefs {
  const prefs = useProfile().data?.ui_prefs;
  return prefs && typeof prefs === 'object' && !Array.isArray(prefs) ? (prefs as UiPrefs) : {};
}

/** Troca uma parte das preferências (ex.: { sidebar }), já na tela antes da resposta. */
export function useUpdateUiPrefs() {
  const queryClient = useQueryClient();
  const { session } = useSession();
  return useMutation({
    mutationFn: async (patch: UiPrefs) => {
      const current = queryClient.getQueryData<Profile>(keys.profile)?.ui_prefs;
      const next = { ...(current && typeof current === 'object' ? current : {}), ...patch };
      const { error } = await supabase
        .from('profiles')
        .update({ ui_prefs: next })
        .eq('id', session?.user.id ?? '');
      if (error) throw error;
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: keys.profile });
      const previous = queryClient.getQueryData<Profile>(keys.profile);
      if (previous) {
        const base =
          previous.ui_prefs && typeof previous.ui_prefs === 'object' ? previous.ui_prefs : {};
        queryClient.setQueryData(keys.profile, { ...previous, ui_prefs: { ...base, ...patch } });
      }
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(keys.profile, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.profile }),
  });
}

/** Liga ou desliga o modo academia (V6 §15.1); ligar cria a pasta Academia no servidor. */
export function useSetGymMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data, error } = await supabase.rpc('set_gym_mode', { p_enabled: enabled });
      if (error) throw error;
      return data;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: keys.profile });
      queryClient.invalidateQueries({ queryKey: keys.tree });
    },
  });
}
