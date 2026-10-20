// Racha de contas (PB5, D225): quanto cada um pagou e deve nos gastos do projeto, e os acertos
// que zeram tudo com o menor número de transferências que a conta gulosa acha.

export type SplitExpense = {
  kind: string;
  amount_cents: number;
  currency: string;
  paid_by: string | null;
  split_among: string[] | null;
};

/** Saldo de cada pessoa (positivo = tem a receber), por moeda. */
export type Balances = Map<string, Map<string, number>>;

/** Partes iguais em centavos; o resto vai, um centavo para cada, aos primeiros da lista. */
export function shares(amount: number, people: string[]) {
  const base = Math.floor(amount / people.length);
  const rest = amount - base * people.length;
  return people.map((person, i) => ({ person, cents: base + (i < rest ? 1 : 0) }));
}

export function balances(expenses: SplitExpense[]): Balances {
  const result: Balances = new Map();
  const add = (currency: string, person: string, cents: number) => {
    const of = result.get(currency) ?? new Map<string, number>();
    of.set(person, (of.get(person) ?? 0) + cents);
    result.set(currency, of);
  };
  for (const e of expenses) {
    const people = e.split_among ?? [];
    if (!e.paid_by || people.length === 0) continue;
    if (e.kind === 'out') {
      add(e.currency, e.paid_by, e.amount_cents);
      for (const s of shares(e.amount_cents, people)) add(e.currency, s.person, -s.cents);
    } else if (e.kind === 'settle') {
      // Quem pagou o acerto deixa de dever; quem recebeu deixa de ter a receber
      add(e.currency, e.paid_by, e.amount_cents);
      add(e.currency, people[0], -e.amount_cents);
    }
  }
  return result;
}

export type Transfer = { from: string; to: string; cents: number; currency: string };

/** Quem paga a quem: o que mais deve paga ao que mais tem a receber, até zerar. */
export function settlements(all: Balances): Transfer[] {
  const out: Transfer[] = [];
  for (const [currency, of] of [...all].sort(([a], [b]) => a.localeCompare(b))) {
    const sorted = (sign: 1 | -1) =>
      [...of]
        .filter(([, v]) => v * sign > 0)
        .map(([person, v]) => ({ person, left: Math.abs(v) }))
        .sort((a, b) => b.left - a.left || a.person.localeCompare(b.person));
    const debtors = sorted(-1);
    const creditors = sorted(1);
    let d = 0;
    let c = 0;
    while (d < debtors.length && c < creditors.length) {
      const cents = Math.min(debtors[d].left, creditors[c].left);
      out.push({ from: debtors[d].person, to: creditors[c].person, cents, currency });
      debtors[d].left -= cents;
      creditors[c].left -= cents;
      if (debtors[d].left === 0) d++;
      if (creditors[c].left === 0) c++;
    }
  }
  return out;
}
