import { z } from "zod";

// A CSP de produção não permite eval. Sem JIT, o zod deixa de sondar new Function().
// Este módulo precisa ser o primeiro import do app: os schemas de @estoque/shared são criados
// no carregamento, e a sondagem acontece nesse momento.
z.config({ jitless: true });
