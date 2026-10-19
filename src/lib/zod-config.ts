import { z } from 'zod';

// Sem compilar validadores com `new Function` (V5 §3, D212): a CSP da web não libera eval, e o Zod
// testava isso a cada carga (o teste vira uma violação no relatório). O ganho de velocidade não
// faz falta nos tamanhos de dado do app.
z.config({ jitless: true });
