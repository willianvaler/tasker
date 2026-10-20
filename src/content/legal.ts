// Termos de uso e política de privacidade (V5 §4, LGPD; D213). Uma versão para os dois: mudou o
// texto de forma que importe para quem usa? Suba LEGAL_VERSION aqui **e** public.legal_version()
// numa migração nova (o teste legal.test.ts compara); quem já usa aceita de novo ao abrir o app.

export const LEGAL_VERSION = '2026-10-20';

/** Idade mínima para criar conta (LGPD art. 14: abaixo disso, só com os responsáveis). */
export const MIN_AGE = 13;

export type LegalDoc = 'terms' | 'privacy';
type Section = { title: string; body: string };
type Doc = { title: string; updated: string; sections: Section[] };

const ptBR: Record<LegalDoc, Doc> = {
  terms: {
    title: 'Termos de uso',
    updated: 'Versão de 19 de outubro de 2026',
    sections: [
      {
        title: 'O serviço',
        body: 'O Questlist é um app de tarefas, hábitos e projetos com gamificação, mantido por Willian Valer, pessoa física, no Brasil. Ao criar uma conta, você concorda com estes termos e com a Política de privacidade.',
      },
      {
        title: 'Quem pode usar',
        body: `É preciso ter pelo menos ${MIN_AGE} anos. Abaixo dos 18, use com o conhecimento dos seus responsáveis. Uma conta é de uma pessoa: não compartilhe a senha.`,
      },
      {
        title: 'O seu conteúdo',
        body: 'O que você escreve (tarefas, notas, comentários, anexos) é seu. Você nos dá apenas a permissão necessária para guardar, sincronizar e mostrar esse conteúdo a você e a quem você convidar. Não publique nada ilegal, que viole direitos de outras pessoas ou que sirva para assediar alguém.',
      },
      {
        title: 'Projetos, times e clãs',
        body: 'Ao entrar num projeto, time ou clã, os outros membros veem o que é compartilhado ali. Quem criou o projeto define os cargos e pode remover pessoas. Ao sair, o que você criou no projeto continua com ele.',
      },
      {
        title: 'Disponibilidade',
        body: 'O app é oferecido como está, gratuitamente, e pode mudar, ficar fora do ar ou ser encerrado. Fazemos backups, mas recomendamos baixar seus dados de vez em quando (Perfil → Privacidade). Se o serviço for encerrar, avisamos com pelo menos 30 dias para você exportar tudo.',
      },
      {
        title: 'Encerramento da conta',
        body: 'Você pode excluir a conta quando quiser, no Perfil. Podemos suspender contas que violem estes termos, avisando o motivo.',
      },
      {
        title: 'Mudanças',
        body: 'Quando estes termos mudarem de forma importante, o app mostra a nova versão e pede o seu aceite antes de continuar.',
      },
      {
        title: 'Lei e foro',
        body: 'Valem as leis do Brasil, incluindo o Código de Defesa do Consumidor e a LGPD.',
      },
    ],
  },
  privacy: {
    title: 'Política de privacidade',
    updated: 'Versão de 19 de outubro de 2026 (revisão 2: leitura de fotos)',
    sections: [
      {
        title: 'Quem cuida dos dados',
        body: 'O controlador é Willian Valer, que mantém o Questlist e também é o encarregado de dados (DPO). Fale com ele pelo app (Perfil → Privacidade → Pedido sobre meus dados) ou abrindo uma issue em github.com/willianvaler/tasker (sem dados pessoais na issue, que é pública).',
      },
      {
        title: 'O que guardamos',
        body: 'Nome, nick, e-mail, fuso horário e idioma; a sua lista de amigos e os pedidos de amizade; as pastas, páginas, tarefas, notas, comentários e anexos que você cria; os gastos que você lança e as fotos de notas fiscais que anexa; o histórico de conclusões, tempo e XP; o personagem (classe, atributos, ouro, itens e mascotes); a data e a versão destes termos que você aceitou; e, se você ligar os avisos no celular, um identificador do aparelho para as notificações.',
      },
      {
        title: 'Para que usamos e com que base',
        body: 'Só para o app funcionar (execução do contrato, LGPD art. 7º, V): mostrar e sincronizar suas tarefas, mostrar aos membros de um projeto ou clã o que é compartilhado com eles, mandar os avisos que você ligou e calcular XP, dano, ouro e sequência. O registro do aceite e os registros de segurança usam a base do cumprimento de obrigação legal e do legítimo interesse (proteger as contas). Não vendemos dados, não mostramos anúncios e não rastreamos você fora do app.',
      },
      {
        title: 'Quem vê o quê',
        body: 'Suas pastas pessoais são só suas. Em um projeto compartilhado, os membros veem as tarefas, os comentários e a atividade daquele projeto. Num clã, os membros veem seu nome, nível, classe, aparência do personagem, conquistas e dano no boss, nunca as suas tarefas. Quem tem conta pode achar você pelo nick (vê o nome e o nick); pelo e-mail, só se já souber o endereço, e o app não confirma se a conta existe. Seus amigos veem seu nome e seu nick, e as tarefas que você marcar como de amigos; as que marcar como públicas, qualquer pessoa com conta vê no seu perfil. O que você publica na Comunidade (uma cópia da estrutura, sem pessoas, datas, comentários, anexos nem gastos) fica visível para qualquer pessoa com conta, com o seu nick, até você despublicar.',
      },
      {
        title: 'Terceiros e transferência internacional',
        body: 'O servidor fica no Brasil. O tráfego passa pela Cloudflare (proteção e entrega, com servidores em vários países). Os avisos no celular passam pelo serviço de notificações da Expo e pelo Firebase (Google) ou pela Apple, que recebem só o texto do aviso e o identificador do aparelho. As lojas (Google Play e App Store) tratam os dados de quem instala o app segundo as políticas delas. Quando você usa “Foto da nota” ou “Foto de uma lista”, a foto é enviada ao Google (API Gemini) só para ser lida; nesta fase de testes usamos o plano gratuito do Google, em que o Google pode usar o que recebe para melhorar os produtos dele, inclusive com revisão humana. Por isso, evite fotografar documentos com dados de outras pessoas. A foto da nota fica guardada no nosso servidor, junto do lançamento. Essas transferências seguem a LGPD (art. 33), com empresas que adotam cláusulas de proteção de dados.',
      },
      {
        title: 'Por quanto tempo',
        body: 'Enquanto a conta existir. Itens apagados ficam 30 dias na lixeira e depois somem. Ao excluir a conta, os dados pessoais saem do banco na hora e das cópias de segurança (diárias, guardadas por 14 dias) em até 30 dias. Os registros técnicos do servidor (erros e acessos recusados, sem o conteúdo das suas tarefas) são apagados pela rotação do próprio sistema. O registro do aceite dos termos fica enquanto a conta existir.',
      },
      {
        title: 'Seus direitos',
        body: 'Você pode, a qualquer momento: confirmar que tratamos seus dados e acessá-los; corrigir o que estiver errado; levar seus dados para outro serviço; pedir a eliminação; saber com quem compartilhamos; e revogar o consentimento. No Perfil você já baixa tudo (JSON ou planilha), edita seus dados e exclui a conta. Para o resto, use "Pedido sobre meus dados" no Perfil: respondemos em até 15 dias. Você também pode reclamar à ANPD (gov.br/anpd).',
      },
      {
        title: 'Segurança e incidentes',
        body: 'Usamos HTTPS, senhas cifradas, regras de acesso por pessoa no banco e backups. Se houver um incidente que possa causar risco ou dano a você, avisamos você e a ANPD em até 3 dias úteis, dizendo o que aconteceu, quais dados foram afetados e o que fazer.',
      },
      {
        title: 'Crianças e adolescentes',
        body: `A conta exige pelo menos ${MIN_AGE} anos. Se soubermos de uma conta de alguém mais novo sem o consentimento dos responsáveis, ela é excluída.`,
      },
      {
        title: 'Mudanças',
        body: 'Quando esta política mudar de forma importante, o app mostra a nova versão e pede o seu aceite.',
      },
    ],
  },
};

const en: Record<LegalDoc, Doc> = {
  terms: {
    title: 'Terms of use',
    updated: 'Version of October 19, 2026',
    sections: [
      {
        title: 'The service',
        body: 'Questlist is a tasks, habits and projects app with gamification, run by Willian Valer, an individual in Brazil. By creating an account you agree to these terms and to the Privacy policy.',
      },
      {
        title: 'Who can use it',
        body: `You must be at least ${MIN_AGE}. Under 18, use it with your parents' or guardians' knowledge. An account belongs to one person: do not share the password.`,
      },
      {
        title: 'Your content',
        body: "What you write (tasks, notes, comments, attachments) is yours. You only give us the permission needed to store, sync and show it to you and to the people you invite. Do not post anything illegal, that violates other people's rights or that is used to harass someone.",
      },
      {
        title: 'Projects, teams and clans',
        body: 'When you join a project, team or clan, the other members see what is shared there. Whoever created the project sets the roles and can remove people. If you leave, what you created in the project stays with it.',
      },
      {
        title: 'Availability',
        body: "The app is offered as is, for free, and may change, go down or be shut down. We keep backups, but we recommend downloading your data now and then (Profile → Privacy). If the service is going to close, we will give at least 30 days' notice so you can export everything.",
      },
      {
        title: 'Closing the account',
        body: 'You can delete your account at any time in the Profile. We may suspend accounts that break these terms, telling you why.',
      },
      {
        title: 'Changes',
        body: 'When these terms change in an important way, the app shows the new version and asks for your acceptance before continuing.',
      },
      {
        title: 'Law',
        body: "Brazilian law applies, including the Consumer Defense Code and the LGPD (Brazil's data protection law).",
      },
    ],
  },
  privacy: {
    title: 'Privacy policy',
    updated: 'Version of October 19, 2026 (revision 2: photo reading)',
    sections: [
      {
        title: 'Who looks after the data',
        body: 'The controller is Willian Valer, who runs Questlist and is also the data protection officer (DPO). Reach him in the app (Profile → Privacy → Request about my data) or by opening an issue at github.com/willianvaler/tasker (no personal data in the issue, which is public).',
      },
      {
        title: 'What we store',
        body: 'Name, nick, email, time zone and language; your friends list and friend requests; the folders, pages, tasks, notes, comments and attachments you create; the expenses you add and the receipt photos you attach; the history of completions, time and XP; the character (class, attributes, gold, items and pets); the date and version of these terms you accepted; and, if you turn on phone notifications, a device identifier to send them.',
      },
      {
        title: 'What we use it for, and on what basis',
        body: 'Only to make the app work (performance of a contract, LGPD art. 7, V): show and sync your tasks, show project or clan members what is shared with them, send the notifications you turned on and compute XP, damage, gold and streaks. The acceptance record and security logs rely on legal obligation and legitimate interest (protecting accounts). We do not sell data, show ads or track you outside the app.',
      },
      {
        title: 'Who sees what',
        body: "Your personal folders are only yours. In a shared project, members see that project's tasks, comments and activity. In a clan, members see your name, level, class, character look, achievements and boss damage, never your tasks. Anyone with an account can find you by your nick (they see your name and nick); by email only if they already know the address, and the app does not confirm whether the account exists. Your friends see your name and nick, and the tasks you mark for friends; tasks you mark public can be seen on your profile by anyone with an account. What you publish to the Community (a copy of the structure, without people, dates, comments, attachments or expenses) is visible to anyone with an account, with your nick, until you unpublish it.",
      },
      {
        title: 'Third parties and international transfer',
        body: "The server is in Brazil. Traffic goes through Cloudflare (protection and delivery, with servers in many countries). Phone notifications go through Expo's notification service and Firebase (Google) or Apple, which receive only the notification text and the device identifier. The app stores (Google Play and App Store) handle installer data under their own policies. When you use “Receipt photo” or “Photo of a list”, the photo is sent to Google (Gemini API) only to be read; during this testing phase we use Google's free tier, under which Google may use what it receives to improve its products, including human review. So avoid photographing documents with other people's data. The receipt photo is stored on our server, with the entry. These transfers follow the LGPD (art. 33), with companies that adopt data protection clauses.",
      },
      {
        title: 'How long',
        body: "For as long as the account exists. Deleted items stay 30 days in the trash and then disappear. When you delete the account, personal data leaves the database immediately and the backups (daily, kept for 14 days) within 30 days. The server's technical logs (errors and refused requests, without the content of your tasks) are removed by the system's own rotation. The record of your acceptance of the terms is kept while the account exists.",
      },
      {
        title: 'Your rights',
        body: 'At any time you can: confirm that we process your data and access it; correct what is wrong; take your data to another service; ask for deletion; know whom we share it with; and withdraw consent. In the Profile you can already download everything (JSON or spreadsheet), edit your data and delete the account. For anything else, use "Request about my data" in the Profile: we answer within 15 days. You can also complain to the ANPD, Brazil\'s data protection authority (gov.br/anpd).',
      },
      {
        title: 'Security and incidents',
        body: 'We use HTTPS, hashed passwords, per-person access rules in the database and backups. If an incident may put you at risk or cause you harm, we will tell you and the ANPD within 3 business days, explaining what happened, which data was affected and what to do.',
      },
      {
        title: 'Children and teenagers',
        body: `An account requires being at least ${MIN_AGE}. If we learn of an account of someone younger without their parents' or guardians' consent, it is deleted.`,
      },
      {
        title: 'Changes',
        body: 'When this policy changes in an important way, the app shows the new version and asks for your acceptance.',
      },
    ],
  },
};

const es: Record<LegalDoc, Doc> = {
  terms: {
    title: 'Términos de uso',
    updated: 'Versión del 19 de octubre de 2026',
    sections: [
      {
        title: 'El servicio',
        body: 'Questlist es una app de tareas, hábitos y proyectos con gamificación, mantenida por Willian Valer, persona física, en Brasil. Al crear una cuenta aceptas estos términos y la Política de privacidad.',
      },
      {
        title: 'Quién puede usarla',
        body: `Hay que tener al menos ${MIN_AGE} años. Si eres menor de 18, úsala con conocimiento de tus padres o responsables. Una cuenta es de una persona: no compartas la contraseña.`,
      },
      {
        title: 'Tu contenido',
        body: 'Lo que escribes (tareas, notas, comentarios, adjuntos) es tuyo. Solo nos das el permiso necesario para guardarlo, sincronizarlo y mostrarlo a ti y a quien invites. No publiques nada ilegal, que viole derechos de otras personas o que sirva para acosar a alguien.',
      },
      {
        title: 'Proyectos, equipos y clanes',
        body: 'Al entrar en un proyecto, equipo o clan, los demás miembros ven lo que se comparte allí. Quien creó el proyecto define los roles y puede quitar personas. Si sales, lo que creaste en el proyecto se queda en él.',
      },
      {
        title: 'Disponibilidad',
        body: 'La app se ofrece tal cual, gratis, y puede cambiar, caerse o cerrarse. Hacemos copias de seguridad, pero recomendamos descargar tus datos de vez en cuando (Perfil → Privacidad). Si el servicio va a cerrar, avisaremos con al menos 30 días para que exportes todo.',
      },
      {
        title: 'Cierre de la cuenta',
        body: 'Puedes eliminar la cuenta cuando quieras, en el Perfil. Podemos suspender cuentas que incumplan estos términos, indicando el motivo.',
      },
      {
        title: 'Cambios',
        body: 'Cuando estos términos cambien de forma importante, la app muestra la nueva versión y pide tu aceptación antes de seguir.',
      },
      {
        title: 'Ley',
        body: 'Se aplican las leyes de Brasil, incluido el Código de Defensa del Consumidor y la LGPD.',
      },
    ],
  },
  privacy: {
    title: 'Política de privacidad',
    updated: 'Versión del 19 de octubre de 2026 (revisión 2: lectura de fotos)',
    sections: [
      {
        title: 'Quién cuida los datos',
        body: 'El responsable es Willian Valer, que mantiene Questlist y es también el encargado de protección de datos (DPO). Contáctalo desde la app (Perfil → Privacidad → Solicitud sobre mis datos) o abriendo un issue en github.com/willianvaler/tasker (sin datos personales en el issue, que es público).',
      },
      {
        title: 'Qué guardamos',
        body: 'Nombre, nick, correo, zona horaria e idioma; tu lista de amigos y las solicitudes de amistad; las carpetas, páginas, tareas, notas, comentarios y adjuntos que creas; los gastos que registras y las fotos de tickets que adjuntas; el historial de tareas completadas, tiempo y XP; el personaje (clase, atributos, oro, objetos y mascotas); la fecha y la versión de estos términos que aceptaste; y, si activas los avisos en el móvil, un identificador del dispositivo para enviarlos.',
      },
      {
        title: 'Para qué los usamos y con qué base',
        body: 'Solo para que la app funcione (ejecución del contrato, LGPD art. 7, V): mostrar y sincronizar tus tareas, mostrar a los miembros de un proyecto o clan lo que se comparte con ellos, enviar los avisos que activaste y calcular XP, daño, oro y rachas. El registro de la aceptación y los registros de seguridad se basan en la obligación legal y el interés legítimo (proteger las cuentas). No vendemos datos, no mostramos anuncios y no te rastreamos fuera de la app.',
      },
      {
        title: 'Quién ve qué',
        body: 'Tus carpetas personales son solo tuyas. En un proyecto compartido, los miembros ven las tareas, los comentarios y la actividad de ese proyecto. En un clan, los miembros ven tu nombre, nivel, clase, aspecto del personaje, logros y daño al boss, nunca tus tareas. Quien tiene cuenta puede encontrarte por tu nick (ve tu nombre y tu nick); por el correo, solo si ya conoce la dirección, y la app no confirma si la cuenta existe. Tus amigos ven tu nombre y tu nick, y las tareas que marques para amigos; las que marques como públicas, cualquier persona con cuenta las ve en tu perfil. Lo que publicas en la Comunidad (una copia de la estructura, sin personas, fechas, comentarios, adjuntos ni gastos) queda visible para cualquier persona con cuenta, con tu nick, hasta que lo despubliques.',
      },
      {
        title: 'Terceros y transferencia internacional',
        body: 'El servidor está en Brasil. El tráfico pasa por Cloudflare (protección y entrega, con servidores en varios países). Los avisos en el móvil pasan por el servicio de notificaciones de Expo y por Firebase (Google) o Apple, que reciben solo el texto del aviso y el identificador del dispositivo. Las tiendas (Google Play y App Store) tratan los datos de quien instala la app según sus propias políticas. Cuando usas “Foto del ticket” o “Foto de una lista”, la foto se envía a Google (API Gemini) solo para leerla; en esta fase de pruebas usamos el plan gratuito de Google, en el que Google puede usar lo que recibe para mejorar sus productos, incluso con revisión humana. Por eso, evita fotografiar documentos con datos de otras personas. La foto del ticket queda guardada en nuestro servidor, junto al registro. Estas transferencias siguen la LGPD (art. 33), con empresas que adoptan cláusulas de protección de datos.',
      },
      {
        title: 'Por cuánto tiempo',
        body: 'Mientras exista la cuenta. Lo eliminado queda 30 días en la papelera y luego desaparece. Al eliminar la cuenta, los datos personales salen de la base de datos al momento y de las copias de seguridad (diarias, guardadas 14 días) en hasta 30 días. Los registros técnicos del servidor (errores y accesos rechazados, sin el contenido de tus tareas) se borran con la rotación del propio sistema. El registro de la aceptación de los términos se guarda mientras exista la cuenta.',
      },
      {
        title: 'Tus derechos',
        body: 'En cualquier momento puedes: confirmar que tratamos tus datos y acceder a ellos; corregir lo que esté mal; llevar tus datos a otro servicio; pedir su eliminación; saber con quién los compartimos; y revocar el consentimiento. En el Perfil ya puedes descargar todo (JSON u hoja de cálculo), editar tus datos y eliminar la cuenta. Para lo demás, usa "Solicitud sobre mis datos" en el Perfil: respondemos en hasta 15 días. También puedes reclamar ante la ANPD, la autoridad de protección de datos de Brasil (gov.br/anpd).',
      },
      {
        title: 'Seguridad e incidentes',
        body: 'Usamos HTTPS, contraseñas cifradas, reglas de acceso por persona en la base de datos y copias de seguridad. Si hay un incidente que pueda ponerte en riesgo o causarte daño, te avisamos a ti y a la ANPD en hasta 3 días hábiles, explicando qué pasó, qué datos se vieron afectados y qué hacer.',
      },
      {
        title: 'Niños y adolescentes',
        body: `La cuenta exige tener al menos ${MIN_AGE} años. Si sabemos de una cuenta de alguien menor sin el consentimiento de sus responsables, se elimina.`,
      },
      {
        title: 'Cambios',
        body: 'Cuando esta política cambie de forma importante, la app muestra la nueva versión y pide tu aceptación.',
      },
    ],
  },
};

const DOCS: Record<string, Record<LegalDoc, Doc>> = { 'pt-BR': ptBR, en, es };

export function legalDoc(doc: LegalDoc, locale: string): Doc {
  return (DOCS[locale] ?? ptBR)[doc];
}
