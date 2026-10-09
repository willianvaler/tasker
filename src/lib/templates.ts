import { parseBatchInput, type BatchChild } from './parser/batch';
import type { Page } from './queries/tree';

// Modelos de projeto prontos (ESCOPO 4.5). Cada página é escrita como no "Adicionar várias":
// uma tarefa por linha, recuo = subtarefa, sintaxe rápida vale (#etiqueta, !, /semanal...).

export type BuiltInTemplate = {
  key: string;
  name: string;
  icon: string;
  description: string;
  pages: {
    name: string;
    icon?: string;
    view_type?: Page['view_type'];
    reset_cycle?: Page['reset_cycle'];
    lines: string;
  }[];
};

export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  {
    key: 'churrasco',
    name: 'Churrasco',
    icon: '🍖',
    description: 'Compras, local e convidados. Cole a lista com @nomes antes de convidar.',
    pages: [
      {
        name: 'Compras',
        icon: '🛒',
        lines: `Carne !!
  Picanha
  Linguiça
  Frango
Bebidas
  Cerveja
  Refrigerante
  Água
Carvão
Gelo
Pão de alho
Descartáveis (pratos, copos, talheres)
Farofa e vinagrete`,
      },
      {
        name: 'Organização',
        icon: '📋',
        lines: `Definir local !!
Definir data e horário
Lista de convidados
Confirmar presença
Dividir a conta`,
      },
    ],
  },
  {
    key: 'viagem',
    name: 'Viagem',
    icon: '✈️',
    description: 'Reservas, documentos e a mala em cards para marcar enquanto arruma.',
    pages: [
      {
        name: 'Antes de ir',
        icon: '🗓️',
        lines: `Passagens !!
Hospedagem !!
Seguro viagem
Documentos
  RG ou passaporte
  Comprovante de vacina
Avisar o banco
Roteiro`,
      },
      {
        name: 'Mala',
        icon: '🧳',
        view_type: 'cards',
        lines: `Roupas
Roupa de banho
Itens de higiene
Remédios
Carregadores
Fone de ouvido`,
      },
    ],
  },
  {
    key: 'mudanca',
    name: 'Mudança',
    icon: '📦',
    description: 'Do contrato à última caixa, com contas para transferir.',
    pages: [
      {
        name: 'Antes',
        icon: '📝',
        lines: `Contratar transportadora !!
Separar caixas e fita
Doar o que não vai
Embalar por cômodo
  Cozinha
  Quartos
  Sala
  Banheiro`,
      },
      {
        name: 'Contas e endereço',
        icon: '🏠',
        lines: `Luz
Água
Gás
Internet
Atualizar endereço no banco
Atualizar endereço nas compras online`,
      },
    ],
  },
  {
    key: 'festa',
    name: 'Festa',
    icon: '🎉',
    description: 'Convite, comida, decoração e o dia da festa.',
    pages: [
      {
        name: 'Preparação',
        icon: '🎈',
        lines: `Definir data e local !!
Lista de convidados
Enviar convites
Bolo
Salgados e doces
Bebidas
Decoração
Playlist`,
      },
      {
        name: 'No dia',
        icon: '⏰',
        view_type: 'cards',
        lines: `Buscar o bolo
Montar a decoração
Gelar as bebidas
Arrumar a mesa`,
      },
    ],
  },
];

/** Pastas para começar, oferecidas no onboarding (pessoais, não são projetos). */
export const STARTER_TEMPLATES: BuiltInTemplate[] = [
  {
    key: 'treino',
    name: 'Academia',
    icon: '🏋️',
    description: 'Treino em cards que reinicia toda segunda.',
    pages: [
      {
        name: 'Treino A',
        view_type: 'cards',
        reset_cycle: 'weekly',
        lines: `Supino 4x12 20kg
Agachamento 4x10
Remada 3x12
Prancha 3x`,
      },
    ],
  },
  {
    key: 'casa',
    name: 'Casa',
    icon: '🏠',
    description: 'Lista do mercado e contas do mês.',
    pages: [
      { name: 'Mercado', icon: '🛒', lines: `Arroz\nFeijão\nCafé\nFrutas` },
      { name: 'Contas', icon: '💡', lines: `Luz /mensal\nInternet /mensal` },
    ],
  },
  {
    key: 'habitos',
    name: 'Hábitos',
    icon: '🔥',
    description: 'Marque todo dia e veja a sequência crescer.',
    pages: [
      {
        name: 'Hábitos',
        view_type: 'habits',
        lines: `Beber 2 litros de água\nLer 10 páginas /seg,qua,sex\nMeditar 5 minutos`,
      },
    ],
  },
];

type TemplateItem = {
  title: string;
  priority: number;
  labels: string[];
  recurrence: BatchChild['recurrence'];
  meta: BatchChild['meta'];
  done: boolean;
  children?: TemplateItem[];
};

const toItem = (item: BatchChild): TemplateItem => ({
  title: item.title,
  priority: item.priority,
  labels: item.labels,
  recurrence: item.recurrence,
  meta: item.meta,
  done: false,
});

/** Modelo pronto → formato do create_from_template. Datas relativas não entram (não fazem sentido). */
export function templateData(template: BuiltInTemplate, today: string) {
  return {
    pages: template.pages.map((page) => ({
      name: page.name,
      icon: page.icon ?? null,
      view_type: page.view_type ?? 'list',
      reset_cycle: page.reset_cycle ?? 'none',
      items: parseBatchInput(page.lines, { today, meta: page.view_type === 'cards' }).map(
        (item) => ({ ...toItem(item), children: item.children.map(toItem) }),
      ),
    })),
  };
}
