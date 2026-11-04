import { parseBatchInput, type BatchItem } from './parser/batch';
import type { Page } from './queries/tree';

// Kits por assunto (PB6, V3 §6 B, D301): modelos prontos mais completos que os de `templates.ts`,
// nos três idiomas. As linhas seguem o "Adicionar várias" (recuo = subtarefa, sintaxe rápida) e
// "^N" diz que o item depende do item N da mesma página (contando de 1, na ordem do texto, as
// subtarefas também). A página de gastos (`expenses`) nasce vazia, com o orçamento.

export type KitLanguage = 'pt-BR' | 'en' | 'es';

export type KitPage = {
  name: string;
  icon?: string;
  view_type?: Page['view_type'];
  reset_cycle?: Page['reset_cycle'];
  /** Só na página de gastos: orçamento em centavos */
  budget_cents?: number;
  lines?: string;
};

export type Kit = {
  key: string;
  icon: string;
  name: string;
  description: string;
  pages: KitPage[];
};

const pt: Kit[] = [
  {
    key: 'treino',
    icon: '🏋️',
    name: 'Treino da semana',
    description:
      'Treinos A e B em cards que reiniciam toda segunda, mais aquecimento e alongamento.',
    pages: [
      {
        name: 'Treino A (peito e costas)',
        icon: '💪',
        view_type: 'cards',
        reset_cycle: 'weekly',
        lines: `Aquecimento 10 minutos
Supino reto 4x10
Remada curvada 4x10
Crucifixo 3x12
Puxada na frente 3x12
Prancha 3x`,
      },
      {
        name: 'Treino B (pernas)',
        icon: '🦵',
        view_type: 'cards',
        reset_cycle: 'weekly',
        lines: `Aquecimento 10 minutos
Agachamento 4x10
Leg press 4x12
Cadeira extensora 3x12
Panturrilha 4x15
Alongamento`,
      },
    ],
  },
  {
    key: 'cardapio',
    icon: '🥗',
    name: 'Cardápio semanal',
    description:
      'Um prato por linha com os ingredientes embaixo: no menu da lista, gere a lista de compras.',
    pages: [
      {
        name: 'Cardápio',
        icon: '🍽️',
        reset_cycle: 'weekly',
        lines: `Segunda: frango grelhado com arroz
  500 g de frango
  2 xícaras de arroz
  Salada verde
Terça: macarrão ao sugo
  500 g de macarrão
  1 lata de molho de tomate
  Queijo ralado
Quarta: omelete com legumes
  6 ovos
  1 abobrinha
  1 cenoura
Quinta: carne moída com purê
  500 g de carne moída
  1 kg de batata
Sexta: peixe assado
  600 g de peixe
  Limão
  Batata`,
      },
      {
        name: 'Compras',
        icon: '🛒',
        lines: `Conferir a despensa\nFazer a lista de compras\nIr ao mercado ^2`,
      },
    ],
  },
  {
    key: 'reforma',
    icon: '🔨',
    name: 'Reforma',
    description: 'Etapas em ordem (uma só começa quando a anterior termina) e o orçamento da obra.',
    pages: [
      {
        name: 'Etapas',
        icon: '🧱',
        lines: `Definir o que vai ser feito !!
Pedir três orçamentos ^1
Fechar com o profissional ^2
Comprar o material ^3
Demolição ^4
Parte elétrica e hidráulica ^5
Reboco e contrapiso ^6
Piso e revestimento ^7
Pintura ^8
Limpeza final ^9`,
      },
      { name: 'Orçamento', icon: '💰', view_type: 'expenses', budget_cents: 1500000 },
    ],
  },
  {
    key: 'viagem',
    icon: '🧭',
    name: 'Viagem com roteiro',
    description: 'Reservas na ordem certa, mala em cards e os gastos da viagem com orçamento.',
    pages: [
      {
        name: 'Planejamento',
        icon: '🗓️',
        lines: `Escolher o destino e as datas !!
Passagens ^1
Hospedagem ^1
Seguro viagem ^2
Documentos
  RG ou passaporte
  Visto, se precisar
Roteiro dia a dia ^3
Avisar o banco`,
      },
      {
        name: 'Mala',
        icon: '🧳',
        view_type: 'cards',
        lines: `Roupas\nItens de higiene\nRemédios\nCarregadores\nAdaptador de tomada\nDocumentos`,
      },
      { name: 'Gastos', icon: '💳', view_type: 'expenses', budget_cents: 500000 },
    ],
  },
  {
    key: 'estudos',
    icon: '📚',
    name: 'Estudos',
    description: 'Matérias com os tópicos, revisões que se repetem e a prova no fim.',
    pages: [
      {
        name: 'Matérias',
        icon: '📖',
        lines: `Matéria 1
  Tópico 1
  Tópico 2
  Exercícios ^2 ^3
Matéria 2
  Tópico 1
  Tópico 2
  Exercícios ^6 ^7
Simulado ^4 ^8 !!`,
      },
      {
        name: 'Rotina',
        icon: '⏱️',
        view_type: 'habits',
        lines: `Estudar 1 hora\nRevisar o que estudou ontem\nLer 10 páginas /seg,qua,sex`,
      },
    ],
  },
  {
    key: 'evento',
    icon: '🎪',
    name: 'Evento',
    description: 'Da data ao dia do evento, com convidados, fornecedores e o orçamento.',
    pages: [
      {
        name: 'Preparação',
        icon: '📋',
        lines: `Definir data e local !!
Lista de convidados ^1
Enviar os convites ^2
Contratar fornecedores ^1
  Comida
  Bebida
  Som
Confirmar presenças ^3
Fechar o número com os fornecedores ^4 ^8`,
      },
      {
        name: 'No dia',
        icon: '⏰',
        view_type: 'cards',
        lines: `Receber os fornecedores\nMontar o espaço\nRecepção\nDesmontar`,
      },
      { name: 'Orçamento', icon: '💰', view_type: 'expenses', budget_cents: 300000 },
    ],
  },
];

const en: Kit[] = [
  {
    key: 'treino',
    icon: '🏋️',
    name: 'Weekly workout',
    description: 'Workouts A and B as cards that reset every Monday, plus warm-up and stretching.',
    pages: [
      {
        name: 'Workout A (chest and back)',
        icon: '💪',
        view_type: 'cards',
        reset_cycle: 'weekly',
        lines: `Warm-up 10 minutes
Bench press 4x10
Bent-over row 4x10
Chest fly 3x12
Lat pulldown 3x12
Plank 3x`,
      },
      {
        name: 'Workout B (legs)',
        icon: '🦵',
        view_type: 'cards',
        reset_cycle: 'weekly',
        lines: `Warm-up 10 minutes
Squat 4x10
Leg press 4x12
Leg extension 3x12
Calf raise 4x15
Stretching`,
      },
    ],
  },
  {
    key: 'cardapio',
    icon: '🥗',
    name: 'Weekly menu',
    description:
      'One dish per line with the ingredients below: from the list menu, build the shopping list.',
    pages: [
      {
        name: 'Menu',
        icon: '🍽️',
        reset_cycle: 'weekly',
        lines: `Monday: grilled chicken with rice
  500 g of chicken
  2 cups of rice
  Green salad
Tuesday: pasta with tomato sauce
  500 g of pasta
  1 can of tomato sauce
  Grated cheese
Wednesday: vegetable omelette
  6 eggs
  1 zucchini
  1 carrot
Thursday: ground beef with mashed potatoes
  500 g of ground beef
  1 kg of potatoes
Friday: baked fish
  600 g of fish
  Lemon
  Potatoes`,
      },
      {
        name: 'Shopping',
        icon: '🛒',
        lines: `Check the pantry\nWrite the shopping list\nGo to the store ^2`,
      },
    ],
  },
  {
    key: 'reforma',
    icon: '🔨',
    name: 'Renovation',
    description: 'Steps in order (each one starts when the previous ends) and the project budget.',
    pages: [
      {
        name: 'Steps',
        icon: '🧱',
        lines: `Decide what will be done !!
Get three quotes ^1
Hire the contractor ^2
Buy the materials ^3
Demolition ^4
Electrical and plumbing ^5
Plaster and subfloor ^6
Flooring and tiles ^7
Painting ^8
Final cleaning ^9`,
      },
      { name: 'Budget', icon: '💰', view_type: 'expenses', budget_cents: 300000 },
    ],
  },
  {
    key: 'viagem',
    icon: '🧭',
    name: 'Trip with itinerary',
    description:
      'Bookings in the right order, packing as cards and the trip expenses with a budget.',
    pages: [
      {
        name: 'Planning',
        icon: '🗓️',
        lines: `Choose the destination and dates !!
Flights ^1
Accommodation ^1
Travel insurance ^2
Documents
  ID or passport
  Visa, if needed
Day-by-day itinerary ^3
Tell the bank`,
      },
      {
        name: 'Packing',
        icon: '🧳',
        view_type: 'cards',
        lines: `Clothes\nToiletries\nMedicine\nChargers\nPlug adapter\nDocuments`,
      },
      { name: 'Expenses', icon: '💳', view_type: 'expenses', budget_cents: 200000 },
    ],
  },
  {
    key: 'estudos',
    icon: '📚',
    name: 'Studies',
    description: 'Subjects with their topics, recurring reviews and the exam at the end.',
    pages: [
      {
        name: 'Subjects',
        icon: '📖',
        lines: `Subject 1
  Topic 1
  Topic 2
  Exercises ^2 ^3
Subject 2
  Topic 1
  Topic 2
  Exercises ^6 ^7
Practice exam ^4 ^8 !!`,
      },
      {
        name: 'Routine',
        icon: '⏱️',
        view_type: 'habits',
        lines: `Study for 1 hour\nReview yesterday's notes\nRead 10 pages /mon,wed,fri`,
      },
    ],
  },
  {
    key: 'evento',
    icon: '🎪',
    name: 'Event',
    description: 'From the date to the day itself, with guests, suppliers and the budget.',
    pages: [
      {
        name: 'Preparation',
        icon: '📋',
        lines: `Set the date and venue !!
Guest list ^1
Send the invitations ^2
Hire suppliers ^1
  Food
  Drinks
  Sound
Confirm attendance ^3
Confirm numbers with suppliers ^4 ^8`,
      },
      {
        name: 'On the day',
        icon: '⏰',
        view_type: 'cards',
        lines: `Meet the suppliers\nSet up the venue\nWelcome the guests\nTear down`,
      },
      { name: 'Budget', icon: '💰', view_type: 'expenses', budget_cents: 100000 },
    ],
  },
];

const es: Kit[] = [
  {
    key: 'treino',
    icon: '🏋️',
    name: 'Entreno de la semana',
    description:
      'Entrenos A y B en tarjetas que se reinician cada lunes, más calentamiento y estiramiento.',
    pages: [
      {
        name: 'Entreno A (pecho y espalda)',
        icon: '💪',
        view_type: 'cards',
        reset_cycle: 'weekly',
        lines: `Calentamiento 10 minutos
Press de banca 4x10
Remo inclinado 4x10
Aperturas 3x12
Jalón al pecho 3x12
Plancha 3x`,
      },
      {
        name: 'Entreno B (piernas)',
        icon: '🦵',
        view_type: 'cards',
        reset_cycle: 'weekly',
        lines: `Calentamiento 10 minutos
Sentadilla 4x10
Prensa 4x12
Extensión de piernas 3x12
Pantorrilla 4x15
Estiramiento`,
      },
    ],
  },
  {
    key: 'cardapio',
    icon: '🥗',
    name: 'Menú semanal',
    description:
      'Un plato por línea con los ingredientes debajo: en el menú de la lista, genera la lista de compras.',
    pages: [
      {
        name: 'Menú',
        icon: '🍽️',
        reset_cycle: 'weekly',
        lines: `Lunes: pollo a la plancha con arroz
  500 g de pollo
  2 tazas de arroz
  Ensalada verde
Martes: pasta con salsa de tomate
  500 g de pasta
  1 lata de salsa de tomate
  Queso rallado
Miércoles: tortilla de verduras
  6 huevos
  1 calabacín
  1 zanahoria
Jueves: carne picada con puré
  500 g de carne picada
  1 kg de patatas
Viernes: pescado al horno
  600 g de pescado
  Limón
  Patatas`,
      },
      {
        name: 'Compras',
        icon: '🛒',
        lines: `Revisar la despensa\nHacer la lista de compras\nIr al súper ^2`,
      },
    ],
  },
  {
    key: 'reforma',
    icon: '🔨',
    name: 'Reforma',
    description:
      'Etapas en orden (cada una empieza cuando termina la anterior) y el presupuesto de la obra.',
    pages: [
      {
        name: 'Etapas',
        icon: '🧱',
        lines: `Definir qué se va a hacer !!
Pedir tres presupuestos ^1
Cerrar con el profesional ^2
Comprar el material ^3
Demolición ^4
Electricidad y fontanería ^5
Enlucido y solado ^6
Suelo y revestimiento ^7
Pintura ^8
Limpieza final ^9`,
      },
      { name: 'Presupuesto', icon: '💰', view_type: 'expenses', budget_cents: 300000 },
    ],
  },
  {
    key: 'viagem',
    icon: '🧭',
    name: 'Viaje con itinerario',
    description:
      'Reservas en el orden correcto, la maleta en tarjetas y los gastos del viaje con presupuesto.',
    pages: [
      {
        name: 'Planificación',
        icon: '🗓️',
        lines: `Elegir el destino y las fechas !!
Vuelos ^1
Alojamiento ^1
Seguro de viaje ^2
Documentos
  DNI o pasaporte
  Visado, si hace falta
Itinerario día a día ^3
Avisar al banco`,
      },
      {
        name: 'Maleta',
        icon: '🧳',
        view_type: 'cards',
        lines: `Ropa\nArtículos de aseo\nMedicinas\nCargadores\nAdaptador de enchufe\nDocumentos`,
      },
      { name: 'Gastos', icon: '💳', view_type: 'expenses', budget_cents: 200000 },
    ],
  },
  {
    key: 'estudos',
    icon: '📚',
    name: 'Estudios',
    description: 'Asignaturas con sus temas, repasos que se repiten y el examen al final.',
    pages: [
      {
        name: 'Asignaturas',
        icon: '📖',
        lines: `Asignatura 1
  Tema 1
  Tema 2
  Ejercicios ^2 ^3
Asignatura 2
  Tema 1
  Tema 2
  Ejercicios ^6 ^7
Simulacro ^4 ^8 !!`,
      },
      {
        name: 'Rutina',
        icon: '⏱️',
        view_type: 'habits',
        lines: `Estudiar 1 hora\nRepasar lo de ayer\nLeer 10 páginas /lun,mié,vie`,
      },
    ],
  },
  {
    key: 'evento',
    icon: '🎪',
    name: 'Evento',
    description: 'De la fecha al día del evento, con invitados, proveedores y el presupuesto.',
    pages: [
      {
        name: 'Preparación',
        icon: '📋',
        lines: `Definir fecha y lugar !!
Lista de invitados ^1
Enviar las invitaciones ^2
Contratar proveedores ^1
  Comida
  Bebida
  Sonido
Confirmar asistencia ^3
Cerrar el número con los proveedores ^4 ^8`,
      },
      {
        name: 'El día',
        icon: '⏰',
        view_type: 'cards',
        lines: `Recibir a los proveedores\nMontar el espacio\nRecepción\nDesmontar`,
      },
      { name: 'Presupuesto', icon: '💰', view_type: 'expenses', budget_cents: 100000 },
    ],
  },
];

export const KITS: Record<KitLanguage, Kit[]> = { 'pt-BR': pt, en, es };

/** Idioma da interface → idioma dos kits (o que não for inglês nem espanhol fica no português) */
export function kitLanguage(lang: string | undefined): KitLanguage {
  if (lang?.startsWith('en')) return 'en';
  if (lang?.startsWith('es')) return 'es';
  return 'pt-BR';
}

type KitItem = {
  id: string;
  title: string;
  priority: number;
  labels: string[];
  recurrence: BatchItem['recurrence'];
  meta: BatchItem['meta'];
  done: false;
  children: KitItem[];
};

export type KitData = {
  pages: {
    name: string;
    icon: string | null;
    view_type: NonNullable<Page['view_type']>;
    reset_cycle: NonNullable<Page['reset_cycle']>;
    budget_cents?: number;
    items: KitItem[];
  }[];
  deps: { task: string; on: string }[];
};

/**
 * Kit → formato do `create_from_template` (com ids gerados aqui, para as dependências). `newId`
 * vem de fora (uuidv7 no app, um contador nos testes). Datas relativas não entram.
 */
export function kitData(kit: Kit, today: string, newId: () => string): KitData {
  const deps: KitData['deps'] = [];
  const pages = kit.pages.map((page) => {
    const view_type = page.view_type ?? 'list';
    const parsed = page.lines
      ? parseBatchInput(page.lines, { today, meta: view_type === 'cards', prereqs: true })
      : [];
    // Ordem do texto (pré-ordem): é a numeração do "^N"
    const flat: { id: string; prereqs: string[] }[] = [];
    const walk = (item: BatchItem): KitItem => {
      const id = newId();
      flat.push({ id, prereqs: item.prereqs });
      return {
        id,
        title: item.title,
        priority: item.priority,
        labels: item.labels,
        recurrence: item.recurrence,
        meta: item.meta,
        done: false,
        children: item.children.map(walk),
      };
    };
    const items = parsed.map(walk);
    for (const node of flat)
      for (const ref of node.prereqs) {
        const on = /^\d+$/.test(ref) ? flat[Number(ref) - 1] : undefined;
        if (on && on.id !== node.id) deps.push({ task: node.id, on: on.id });
      }
    return {
      name: page.name,
      icon: page.icon ?? null,
      view_type,
      reset_cycle: page.reset_cycle ?? 'none',
      ...(view_type === 'expenses' && page.budget_cents ? { budget_cents: page.budget_cents } : {}),
      items,
    };
  });
  return { pages, deps };
}
