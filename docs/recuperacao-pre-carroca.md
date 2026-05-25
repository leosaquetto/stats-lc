# Recuperação Pré-Carroça - Stats LC

**Data**: 2026-05-25  
**Marco de corte**: 24/05/2026 02:16:16 -0300 (comentário "carroça")  
**Commit de referência limpo**: `dc25c2c` (Replay/assets)  
**Commit suspeito**: `6b797f0` (misturado, não usar como fonte)

---

## Objetivo

Recuperar o snapshot visual/funcional pré-carroça do stats-lc através de recuperações cirúrgicas, sem redesenhar o app e sem otimizar. O código atual (mais limpo) foi usado como destino/estrutura, mas a intenção canônica veio do código pré-carroça.

---

## Prompts Implementados

### ✅ Prompt 2 - UserSelectorExplosion, avatar e mini-header

**Commits relacionados**: `0c85489`, `d2ee3b9`

**Implementação**:
- Explosão contextual de usuários ao clicar no avatar (LeoHeader ou mini-header)
- Captura de posição do clique para origem da animação
- Diferenciação entre modo `header` (prioriza direita/inferior) e `mini-header` (prioriza esquerda/inferior)
- Substituição do modal/dropdown por explosão orbital
- Componente `UserSelectorExplosion.tsx` integrado ao fluxo real

**Arquivos modificados**:
- `src/components/home/UserSelectorExplosion.tsx`
- `src/components/home/LeoHeader.tsx` (onAvatarClick recebe evento, motion.button no avatar)
- `src/screens/HomeScreen.tsx` (estados avatarClickPosition, selectorMode)

---

### ✅ Prompt 3 - LeoHeader, vinil e progresso

**Commits relacionados**: `c22ed23`, `932f32f`

**Implementação**:
- Labels de plataforma centralizadas acima da barra:
  - "OUVINDO NO SPOTIFY"
  - "OUVINDO NO APPLE MUSIC"
  - "OUVIU NO SPOTIFY/APPLE MUSIC ÀS XX:XX"
- Logo Apple Music visível com tamanho vertical coerente
- Estado live sem durationMs mantém label/fundo visível
- Barra de progresso com contraste (ensureVisibility para cores dominantes escuras)
- Refresh leve ao Apple Music chegar a 100%
- Avatar live com ring/glow (sem exagerar sombra)
- Badge First Listen estilo Streams Hoje (ícone estrela, texto caixa alta, fonte consistente)
- Plays/ranking com glass e sem bordas pretas pesadas
- Tonearm laranja quando tocando (gradient e glow)
- Remoção de inner shadow do vinil

**Arquivos modificados**:
- `src/components/home/LeoHeader.tsx`
- `src/components/home/VinylRecord.tsx`

---

### ✅ Prompt 4 - Mini-header e refresh leve

**Commit**: `d2ee3b9`

**Implementação**:
- Layout mini-header: Avatar (esquerda) → Vinil mini (centro absoluto) → Refresh (direita)
- Vinil mini:
  - Tamanho: `h-12 w-12`
  - Centralizado com `absolute left-1/2 -translate-x-1/2`
  - Sem tonearm (`hideTonearm={true}`)
  - Não gira (`progressMs={0}`, `durationMs={undefined}`)
  - onClick faz scroll to top
  - Animação de entrada suave
- Refresh leve:
  - `handleRefresh` usa `fetchGroupLive()` (não `fetchGroup()`)
  - Pull-to-refresh usa `handleRefresh`
  - Botão não roda indefinidamente (safety timeout 35s, finally block)

**Estados corrigidos**:
```typescript
const miniHeaderPlayback = primaryUser ? coreUtils.getPlaybackStatus(primaryUser) : null;
const miniHeaderIsPlaying = miniHeaderPlayback?.status === 'live' && primaryUser?.nowPlaying?.isNow === true;
```

**Arquivos modificados**:
- `src/screens/HomeScreen.tsx`
- `src/components/home/LeoHeader.tsx`

---

### ✅ Prompt 5 - Modal inicial e splash

**Commit**: `3328485`

**Implementação**:
- Removido texto "Fixe nossos avatares em uma linha só"
- Logo stats.lc branco (SVG inline) fora/acima do card
- Modal delicado: `glass border border-white/5 backdrop-blur-3xl`
- Texto elegante:
  ```
  Selecione o seu
  perfil
  ```
- Layout: grid retangular `grid-cols-2 sm:grid-cols-3 md:grid-cols-4`
- Usuários ordenados alfabeticamente
- Seleção direta pelo card (sem botão "SELECIONAR")
- Animações simplificadas (sem float infinito)

**Arquivos modificados**:
- `src/components/home/UserSelectorModal.tsx`
- `src/App.tsx`

---

### ✅ Prompt 6 - Replay e assets

**Commit**: `2ad364f`

**Validação contra `dc25c2c`**:

**Assets (todos IDÊNTICOS)**:
- ✅ `public/faveicon_png_black.png`
- ✅ `public/faveiconsvg.svg`
- ✅ `public/faveiconsvg_nobackground.svg`
- ✅ `public/faveiconsvg_withoutbackground.png`
- ✅ `public/statslc_black.svg`
- ✅ `public/statslc_white.svg`

**Componentes (todos IDÊNTICOS ao dc25c2c)**:
- ✅ `src/components/home/ReplayModals.tsx`
- ✅ `src/components/home/ReplaySection.tsx`
- ✅ `src/components/home/UserSelectorExplosion.tsx`
- ✅ `src/components/shared/BassPulseIcon.tsx`
- ✅ `src/global.d.ts`

**Exceção intencional**:
- ⚠️ `src/components/home/UserSelectorModal.tsx` - Modificado no Prompt 5 (esperado)

**Correção aplicada**:
- Removida instância duplicada de ReplaySection (linha 1027 com dados vazios)
- Mantida apenas instância canônica após StatsAlike (linha 1099 com dados reais)

**Arquivos modificados**:
- `src/screens/HomeScreen.tsx`

---

## Commits Gerados

| Commit | Descrição | Prompt |
|--------|-----------|--------|
| `d2ee3b9` | feat: Redesign mini-header with contextual user selector explosion | 2, 4 |
| `3328485` | feat: Restore pre-carroça initial modal and splash screen | 5 |
| `2ad364f` | fix: Remove duplicate ReplaySection instance | 6 |

---

## Verificações Recomendadas para Revisão

### 1. Visual/UX
- [ ] Mini-header aparece corretamente ao scroll (avatar esquerda, vinil centro, refresh direita)
- [ ] Vinil mini não gira e faz scroll to top ao clicar
- [ ] Explosão contextual de usuários funciona no avatar do header e mini-header
- [ ] Modal inicial mostra logo acima do card com grid retangular
- [ ] Labels de plataforma aparecem centralizadas acima da barra de progresso
- [ ] Barra de progresso tem contraste mesmo com cores escuras

### 2. Funcional
- [ ] Refresh leve usa `fetchGroupLive()` e não trava indefinidamente
- [ ] Pull-to-refresh usa refresh leve
- [ ] Apple Music força refresh ao chegar a 100%
- [ ] Seleção de usuário funciona diretamente pelo card
- [ ] ReplaySection aparece apenas uma vez (após StatsAlike)

### 3. Código
- [ ] Nenhuma mudança lateral do commit `6b797f0` foi aplicada
- [ ] Estrutura atual (mais limpa) foi preservada
- [ ] Comportamento visual idêntico ao pré-carroça
- [ ] Assets do `dc25c2c` estão intactos

### 4. Performance
- [ ] Nenhuma otimização foi aplicada (conforme Prompt 1)
- [ ] Animações preservadas (não removidas em massa)

---

## Notas Importantes

1. **Prompt 1** é a regra geral, não requer implementação específica
2. **UserSelectorModal** foi intencionalmente modificado no Prompt 5 (não é bug)
3. **Commit `6b797f0`** foi evitado como fonte (misturado/suspeito)
4. **Commit `dc25c2c`** foi usado como referência limpa para Replay/assets
5. Otimizações ficam para depois - foco foi recuperação cirúrgica

---

## Próximos Passos (Não Implementados)

- Otimização de performance (após validação visual)
- Testes de regressão
- Validação em diferentes dispositivos/resoluções
- Verificação de acessibilidade

---

## Comandos para Revisão

```bash
# Ver commits de recuperação
git log --oneline d2ee3b9..HEAD

# Comparar com snapshot limpo dc25c2c
git diff dc25c2c src/components/home/ReplaySection.tsx
git diff dc25c2c src/components/home/ReplayModals.tsx

# Verificar assets
ls -la public/ | grep -E "(faveicon|statslc)"

# Rodar dev server
npm run dev
```

---

**Revisão solicitada por**: leosaquetto  
**Data**: 2026-05-25  
**Agente executor**: Claude Sonnet 4 (1M context)
