# Agent Current Rules — stats-lc

Complemento de `CLAUDE.md` e `docs/codex-onboarding.md`.

## Regras atuais

- Agentes sem browser/screenshot tool nao conseguem validar visualmente por screenshots. Quando rodarem so no terminal, devem relatar isso e pedir validacao visual do usuario.
- A tela Stats nao deve copiar a Home nem usar LeoHeader. O topo funcional da Stats e o filtro sticky `Hoje / Semana / Mes / Ano / Total`.
- `hiddenUsers` nao deve resetar `featuredUserId`. Ocultar usuario em Ajustes afeta listas/rankings, nao o usuario principal se ele ainda existe em `allMembers`.
- Orbit mode significa stage orbital real: aneis grandes, elementos absolutos, satelites ao redor do centro, pontos de luz, float leve e scroll vertical preservado.
- Vinil/LeoHeader deve preservar resolucao real de album usando `/api/recent?resolveAlbums=1` quando recentes alimentarem a UI.
- Nunca persistir arrays pesados em `stats-lc-storage` ou `groupStats` salvo. Evitar topItems, history, full stats e caches grandes no estado persistido.
- Stats Alike deve usar cache especifico/estado local para topItems, com in-flight guard, sem injetar arrays completos em `groupStats`.
- UI acionada por scroll deve ficar montada e alternar apenas opacity/transform/pointer-events.
- Graficos da Stats sao features principais. Se Evolucao de Atividade ou Distribuicao Horaria aparecem zerados com dados existentes, corrigir mapper/fonte, nao esconder.
- Laranja precisa virar token de design. Nao inventar novos tons sem auditar `orange-*`, hex e rgba existentes.
- Glassmorphism neste repo e React Web/Tailwind: usar backdrop-filter e -webkit-backdrop-filter, nao expo-blur/BlurView.

## Relatorio final minimo

Todo agente deve responder com:

- arquivos alterados;
- causa real;
- o que mudou;
- houve request novo? sim/nao;
- cache/persistencia mudou? sim/nao;
- scroll mobile preservado? sim/nao;
- lint;
- build;
- riscos restantes;
- comando de commit sugerido;
- confirmar que nao commitou, salvo instrucao explicita.
