// Esforço por série (AC4.2, V6 §3): RIR (repetições que sobraram) ou RPE (até 10). Desligado
// por padrão; a escala fica no Perfil. Cada série guarda a escala em que foi registrada, então
// trocar a escala não reescreve o passado: a tela converte na hora de mostrar.

export type EffortScale = 'rir' | 'rpe';
export type EffortSetting = 'off' | EffortScale;

/** RPE vai de 6 a 10 em meios pontos; RIR, de 0 a 5 (5 = "5 ou mais"). */
export const RPE_MIN = 6;
export const RPE_MAX = 10;
export const RIR_MAX = 5;

export function effortOptions(scale: EffortScale): number[] {
  if (scale === 'rir') return Array.from({ length: RIR_MAX + 1 }, (_, i) => i);
  const out: number[] = [];
  for (let v = RPE_MIN; v <= RPE_MAX; v += 0.5) out.push(v);
  return out;
}

/** RIR ↔ RPE pela regra usual (RPE = 10 − RIR), dentro das faixas. */
export const rirToRpe = (rir: number) => Math.min(RPE_MAX, Math.max(RPE_MIN, 10 - rir));
export const rpeToRir = (rpe: number) => Math.min(RIR_MAX, Math.max(0, 10 - rpe));

/** Valor válido na escala? (o banco confere o mesmo no `_record_set`) */
export function isValidEffort(scale: EffortScale, value: number) {
  return effortOptions(scale).includes(value);
}

/** Uma série guardada numa escala, mostrada em outra. */
export function convertEffort(value: number, from: EffortScale, to: EffortScale) {
  if (from === to) return value;
  return from === 'rir' ? rirToRpe(value) : rpeToRir(value);
}

/** Média do esforço das séries na escala pedida (séries sem esforço ficam de fora). */
export function averageEffort(
  sets: { effort?: number | null; effort_scale?: EffortScale | null }[],
  to: EffortScale,
): number | null {
  const values = sets
    .filter((s) => s.effort != null && s.effort_scale)
    .map((s) => convertEffort(s.effort as number, s.effort_scale as EffortScale, to));
  if (!values.length) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

/** "RIR 2" / "RPE 8,5" */
export function effortLabel(value: number, scale: EffortScale, locale = 'pt-BR') {
  const text = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  return `${scale.toUpperCase()} ${text}`;
}
