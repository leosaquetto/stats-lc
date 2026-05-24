# Replay Feature - Documentação de Implementação

**Data:** 2026-05-24  
**Autor:** Leo Saquetto  
**Status:** ✅ Implementado e pronto para commit

---

## 📋 Visão Geral

A funcionalidade **Replay** foi implementada como uma seção na HomeScreen que exibe estatísticas musicais do usuário em diferentes períodos de tempo, inspirada no conceito de "Wrapped" do Spotify. A feature permite visualizar artistas, músicas e álbuns mais ouvidos com filtros temporais dinâmicos.

---

## 🎯 Funcionalidades Implementadas

### 1. **ReplaySection Component** (`src/components/home/ReplaySection.tsx`)
- **Filtros de período:**
  - Hoje
  - Semana (últimos 7 dias / semana atual)
  - Mês (seletor de mês com dropdown)
  - Ano (seletor de ano: 2024, 2025, 2026)
  - Tudo (lifetime)

- **Três seções de conteúdo:**
  1. **Artistas mais ouvidos** (top 10)
     - Cards verticais grandes (44vh de altura)
     - Imagem do artista com gradiente inferior
     - Número do ranking em destaque
     - Efeito grain/granulado nos últimos 20% do card
     - Nome e contagem de reproduções
     - Scroll horizontal com snap

  2. **Músicas mais ouvidas** (top 12)
     - Layout em colunas de 4 músicas
     - Scroll horizontal paginado
     - Capa pequena (12x12), número do ranking, nome e artista
     - Botão "⋯" para abrir na plataforma (placeholder)

  3. **Álbuns mais ouvidos** (top 10)
     - Cards quadrados com capa do álbum
     - Informações: ranking, nome, artista, minutos ouvidos
     - Scroll horizontal com snap

- **Contador dinâmico:**
  - Exibe total de minutos ouvidos no período selecionado
  - Animação suave ao trocar de período
  - Texto contextual: "Você ouviu X minutos de música {período}"

- **Botão de compartilhamento:**
  - Ícone Share2 no header
  - Placeholder para funcionalidade futura

### 2. **ReplayModals Component** (`src/components/home/ReplayModals.tsx`)
Três modais para visualização expandida:

- **TopArtistsModal:** Lista completa de até 20 artistas
- **TopSongsModal:** Lista completa de até 30 músicas
- **TopAlbumsModal:** Grid 2 colunas com até 15 álbuns

Cada modal inclui:
- Header com título e período selecionado
- Botão de fechar (X)
- Backdrop com blur
- Animações de entrada/saída (Framer Motion)

### 3. **Integração na HomeScreen** (`src/screens/HomeScreen.tsx`)
- Seção Replay adicionada após as seções existentes
- Dados alimentados por `primaryUser.topItems` (artistas, músicas, álbuns)
- Animação de entrada com `whileInView` (lazy loading visual)
- Mapeamento de dados da API para formato esperado pelos componentes

### 4. **Novos Componentes Auxiliares**

#### **BassPulseIcon** (`src/components/shared/BassPulseIcon.tsx`)
- Ícone animado de pulso de grave
- 3 camadas de explosão com diferentes durações e delays
- Usado para indicar atividade musical intensa

#### **UserSelectorModal** (`src/components/home/UserSelectorModal.tsx`)
- Modal para seleção de usuário featured
- Avatares em linha horizontal com scroll
- Animações de flutuação e rotação individuais
- Indicador visual do usuário selecionado (ponto laranja)
- Backdrop com blur cobrindo toda a tela

### 5. **Melhorias Visuais e UX**

#### **Splash Screen** (`index.html`)
- Splash screen inline com logo stats.lc
- Barra de progresso animada
- Remoção suave após carregamento (fade out 300ms)
- Rodapé "powered by stats.fm"

#### **Novos Ícones** (`public/`)
- `statslc_white.svg` - Logo branco
- `statslc_black.svg` - Logo preto
- `faveiconsvg_nobackground.svg` - Favicon sem fundo
- `faveiconsvg_withoutbackground.png` - Favicon PNG
- `faveicon_png_black.png` - Favicon preto

#### **Melhorias no Layout** (`src/components/Layout.tsx`)
- Ajustes no footer e navegação
- Melhor responsividade mobile

#### **Otimizações de Performance**
- `useCallback` para handlers de refresh e toast
- Memoização de listas ordenadas
- Lazy loading visual com `whileInView`

---

## 🎨 Design System

### Cores
- **Primária:** `#f5761f` (laranja stats.lc)
- **Background:** `#050505` (preto profundo)
- **Glass effects:** `bg-white/5`, `bg-white/10`
- **Texto:** `text-white`, `text-white/50`, `text-white/70`

### Animações
- **Duração padrão:** 0.4s
- **Easing:** `[0.16, 1, 0.3, 1]` (ease-out suave)
- **Delays escalonados:** 0.04s entre itens
- **Shimmer:** 2.8s de duração

### Tipografia
- **Headers:** `font-black` (900)
- **Body:** `font-medium` (500), `font-semibold` (600)
- **Tamanhos:** 
  - Título principal: `text-4xl`
  - Subtítulos: `text-[18px]`
  - Corpo: `text-sm`, `text-xs`

---

## 📦 Estrutura de Arquivos

```
src/
├── components/
│   ├── home/
│   │   ├── ReplaySection.tsx          (512 linhas) ✨ NOVO
│   │   ├── ReplayModals.tsx           (277 linhas) ✨ NOVO
│   │   ├── UserSelectorModal.tsx      (165 linhas) ✨ NOVO
│   │   ├── VinylRecord.tsx            (modificado)
│   │   ├── FriendsSection.tsx         (modificado)
│   │   ├── HomeHighlights.tsx         (modificado)
│   │   └── StatsAlike.tsx             (modificado)
│   ├── shared/
│   │   ├── BassPulseIcon.tsx          (34 linhas) ✨ NOVO
│   │   └── SnapshotHistoryModal.tsx   (modificado)
│   ├── modals/
│   │   ├── CircleActivityModal.tsx    (modificado)
│   │   ├── TrackHistoryModal.tsx      (modificado)
│   │   └── UserModals.tsx             (modificado)
│   └── stats/
│       ├── DailyActivityHeatmap.tsx   (modificado)
│       └── FriendsStatsComparer.tsx   (modificado)
├── screens/
│   ├── HomeScreen.tsx                 (modificado - +60 linhas)
│   ├── StatsScreen.tsx                (modificado)
│   ├── RankingScreen.tsx              (modificado)
│   ├── AlikeScreen.tsx                (modificado)
│   └── SettingsScreen.tsx             (modificado)
├── services/
│   ├── statsService.ts                (modificado)
│   └── snapshotService.ts             (modificado)
├── store/
│   └── useStatsStore.ts               (modificado)
├── lib/
│   └── colorUtils.ts                  (+107 linhas)
├── global.d.ts                        (11 linhas) ✨ NOVO
├── App.tsx                            (modificado)
├── Layout.tsx                         (modificado)
├── main.tsx                           (modificado)
└── index.css                          (modificado)

public/
├── statslc_white.svg                  ✨ NOVO
├── statslc_black.svg                  ✨ NOVO
├── faveiconsvg_nobackground.svg       ✨ NOVO
├── faveiconsvg_withoutbackground.png  ✨ NOVO
└── faveicon_png_black.png             ✨ NOVO

index.html                             (modificado - splash screen)
```

---

## 🔧 Dependências

Nenhuma nova dependência foi adicionada. A implementação usa apenas bibliotecas já presentes:
- `react` (19.x)
- `framer-motion` (motion/react)
- `lucide-react` (ícones)
- `clsx` + `tailwind-merge` (utilitários CSS)

---

## 🚀 Como Usar

### Para o Usuário Final:
1. Acesse a HomeScreen
2. Role até a seção "Replay"
3. Use os filtros no topo para selecionar o período desejado
4. Navegue horizontalmente pelas listas de artistas, músicas e álbuns
5. Clique nos títulos das seções para abrir os modais com listas completas

### Para Desenvolvedores:
```tsx
import { ReplaySection } from '../components/home/ReplaySection';

<ReplaySection
  topArtists={artists}
  topTracks={tracks}
  topAlbums={albums}
  totalSongsCount={minutesPlayed}
  onOpenArtistsModal={() => setShowArtistsModal(true)}
  onOpenSongsModal={() => setShowSongsModal(true)}
  onOpenAlbumsModal={() => setShowAlbumsModal(true)}
/>
```

---

## 📊 Estatísticas da Implementação

- **Arquivos criados:** 5
- **Arquivos modificados:** 25
- **Linhas adicionadas:** ~1.200
- **Linhas removidas:** ~200
- **Componentes novos:** 4
- **Modais novos:** 3
- **Ícones novos:** 5

---

## ✅ Checklist de Implementação

- [x] ReplaySection component com filtros de período
- [x] Dropdown de seleção de mês (apenas meses já passados)
- [x] Dropdown de seleção de ano (2024-2026)
- [x] Dropdown de modo de semana (últimos 7 dias / semana atual)
- [x] Seção de artistas com cards verticais grandes
- [x] Seção de músicas com layout em colunas
- [x] Seção de álbuns com cards quadrados
- [x] Contador dinâmico de minutos ouvidos
- [x] Modais para visualização expandida
- [x] Animações de entrada/saída
- [x] Scroll horizontal com snap
- [x] Efeito grain nos cards de artistas
- [x] Integração com HomeScreen
- [x] BassPulseIcon component
- [x] UserSelectorModal melhorado
- [x] Splash screen inline
- [x] Novos ícones e favicons
- [x] Otimizações de performance
- [x] Responsividade mobile

---

## 🐛 Issues Conhecidos

1. **Botão de compartilhamento:** Placeholder - funcionalidade não implementada
2. **Botão "⋯" nas músicas:** Placeholder - link para plataforma não implementado
3. **Dados de API:** Depende de `primaryUser.topItems` estar populado
4. **Filtros de período:** Lógica de filtragem real não conectada à API (apenas UI)

---

## 🔮 Próximos Passos

1. **Conectar filtros à API:**
   - Implementar chamadas para `/api/top` com parâmetros de período
   - Adicionar loading states durante fetch
   - Implementar cache de dados por período

2. **Funcionalidade de compartilhamento:**
   - Gerar imagem do Replay usando `html-to-image`
   - Integrar com `snapshotService`
   - Adicionar templates de compartilhamento

3. **Links para plataformas:**
   - Detectar plataforma do usuário (Spotify/Apple Music)
   - Gerar deep links para abrir músicas/artistas
   - Fallback para web player

4. **Melhorias de UX:**
   - Adicionar skeleton loaders
   - Implementar pull-to-refresh na seção
   - Adicionar animações de transição entre períodos

5. **Analytics:**
   - Trackear uso dos filtros
   - Trackear abertura de modais
   - Trackear compartilhamentos

---

## 📝 Notas Técnicas

### Performance
- Componentes usam `useMemo` para evitar re-renders desnecessários
- Listas limitadas (10/12/15 itens) para performance de scroll
- Lazy loading visual com `whileInView` (margin: -100px)

### Acessibilidade
- Botões com `title` attributes
- Contraste adequado (WCAG AA)
- Animações respeitam `prefers-reduced-motion`

### Responsividade
- Mobile-first design
- Scroll horizontal com snap points
- Cards adaptam tamanho em diferentes viewports
- Dropdowns centralizados e responsivos

---

## 🎓 Aprendizados

1. **Framer Motion:** Uso avançado de `whileInView` para lazy loading visual
2. **Tailwind CSS:** Técnicas de glass morphism e gradientes complexos
3. **React Patterns:** Composição de componentes modulares e reutilizáveis
4. **UX Design:** Importância de feedback visual e animações suaves
5. **Performance:** Otimizações com memoização e callbacks

---

**Fim da Documentação**
