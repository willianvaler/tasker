// Nomes dos ícones curados para a busca, em pt, en e es juntos e sem acento. Só dados:
// o componente de cada um está em lib/icons.ts. O ícone é guardado como identificador estável
// ("lucide:dumbbell"), nunca como SVG; emoji continua valendo (guardado como o próprio emoji).

export type IconCategory =
  | 'home'
  | 'work'
  | 'health'
  | 'study'
  | 'money'
  | 'travel'
  | 'food'
  | 'people'
  | 'leisure'
  | 'general';

export const ICON_WORDS: Record<string, { category: IconCategory; words: string }> = {
  house: { category: 'home', words: 'casa lar home house hogar' },
  hammer: { category: 'home', words: 'martelo reforma conserto hammer repair martillo' },
  wrench: { category: 'home', words: 'chave ferramenta manutencao wrench tool llave' },
  brush: { category: 'home', words: 'pincel pintura limpeza brush paint pincel' },
  package: { category: 'home', words: 'caixa mudanca pacote box moving package caja' },
  'flower-2': { category: 'home', words: 'flor planta jardim flower garden plant jardin' },
  briefcase: { category: 'work', words: 'trabalho maleta emprego work job briefcase trabajo' },
  laptop: { category: 'work', words: 'computador notebook laptop computer computadora' },
  'building-2': { category: 'work', words: 'empresa escritorio predio office building oficina' },
  mail: { category: 'work', words: 'email correio carta mail correo' },
  cpu: { category: 'work', words: 'tecnologia codigo programar tech code cpu' },
  rocket: { category: 'work', words: 'lancamento projeto foguete launch rocket cohete' },
  target: { category: 'work', words: 'meta objetivo alvo goal target objetivo' },
  dumbbell: { category: 'health', words: 'academia treino musculacao gym workout gimnasio' },
  bike: { category: 'health', words: 'bicicleta pedal ciclismo bike cycling bicicleta' },
  'heart-pulse': { category: 'health', words: 'saude cardio coracao health heart salud' },
  pill: { category: 'health', words: 'remedio medicamento pill medicine remedio' },
  moon: { category: 'health', words: 'sono dormir noite sleep night sueno noche' },
  flame: { category: 'health', words: 'fogo sequencia habito fire streak fuego' },
  'graduation-cap': { category: 'study', words: 'estudo faculdade escola study school estudio' },
  book: { category: 'study', words: 'livro leitura book reading libro' },
  'book-open': { category: 'study', words: 'ler leitura caderno read notebook leer' },
  pencil: { category: 'study', words: 'lapis escrever anotar pencil write lapiz' },
  lightbulb: { category: 'study', words: 'ideia lampada idea bulb idea' },
  wallet: { category: 'money', words: 'carteira dinheiro financas wallet money cartera' },
  'piggy-bank': { category: 'money', words: 'poupanca economia cofre savings ahorro' },
  banknote: { category: 'money', words: 'dinheiro nota pagamento cash money dinero' },
  receipt: { category: 'money', words: 'conta boleto recibo bill receipt factura' },
  plane: { category: 'travel', words: 'viagem aviao ferias travel plane viaje avion' },
  car: { category: 'travel', words: 'carro auto car coche' },
  'map-pin': { category: 'travel', words: 'lugar local mapa place map lugar' },
  tent: { category: 'travel', words: 'acampamento camping barraca tent campamento' },
  utensils: { category: 'food', words: 'comida refeicao cardapio food meal comida' },
  'chef-hat': { category: 'food', words: 'cozinha receita chef cook recipe cocina receta' },
  coffee: { category: 'food', words: 'cafe pausa coffee break cafe' },
  apple: { category: 'food', words: 'fruta dieta saudavel apple fruit diet fruta' },
  'shopping-cart': {
    category: 'food',
    words: 'mercado compras supermercado groceries shopping compras',
  },
  'shopping-bag': { category: 'food', words: 'compras sacola loja shopping bag tienda' },
  users: { category: 'people', words: 'pessoas equipe time grupo people team equipo' },
  baby: { category: 'people', words: 'bebe filho crianca baby child nino' },
  heart: { category: 'people', words: 'amor familia coracao love family amor' },
  dog: { category: 'people', words: 'cachorro cao pet dog perro' },
  cat: { category: 'people', words: 'gato pet cat gato' },
  'paw-print': { category: 'people', words: 'pet animal pata paw' },
  'party-popper': { category: 'leisure', words: 'festa evento churrasco party event fiesta' },
  gift: { category: 'leisure', words: 'presente aniversario gift birthday regalo' },
  music: { category: 'leisure', words: 'musica instrumento music musica' },
  camera: { category: 'leisure', words: 'foto camera photo camara' },
  'gamepad-2': { category: 'leisure', words: 'jogo game videogame juego' },
  trophy: { category: 'leisure', words: 'trofeu conquista campeonato trophy trofeo' },
  leaf: { category: 'leisure', words: 'natureza folha leaf nature hoja' },
  folder: { category: 'general', words: 'pasta folder carpeta' },
  list: { category: 'general', words: 'lista list lista' },
  inbox: { category: 'general', words: 'entrada caixa inbox bandeja' },
  calendar: { category: 'general', words: 'agenda calendario data calendar date' },
  repeat: { category: 'general', words: 'repetir rotina habito repeat routine rutina' },
  star: { category: 'general', words: 'estrela favorito star favorite estrella' },
  flag: { category: 'general', words: 'bandeira marco flag milestone bandera' },
  sun: { category: 'general', words: 'sol dia hoje sun day hoy' },
  sparkles: { category: 'general', words: 'brilho novo especial sparkles new' },
};

export const ICON_IDS = Object.keys(ICON_WORDS);

export const ICON_PREFIX = 'lucide:';
export const iconValue = (id: string) => `${ICON_PREFIX}${id}`;

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

/** Ícones cuja palavra começa com o que foi digitado (sem acento, em qualquer dos 3 idiomas). */
export function searchIcons(query: string): string[] {
  const q = fold(query);
  if (!q) return ICON_IDS;
  return ICON_IDS.filter(
    (id) => id.startsWith(q) || ICON_WORDS[id].words.split(' ').some((word) => word.startsWith(q)),
  );
}

/** O texto é um emoji (para "usar este emoji" na busca)? */
export function isEmoji(text: string) {
  return /^\p{Extended_Pictographic}(\uFE0F|\u200D\p{Extended_Pictographic})*$/u.test(text.trim());
}
