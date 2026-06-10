# Guia de Teste: Animações "Seus Destaques"

## Como Executar os Testes

### 1. Iniciar o Servidor de Desenvolvimento

```bash
npm run dev
```

Aguarde o servidor iniciar e abra no navegador (geralmente `http://localhost:5173`)

---

## Checklist de Testes

### ✅ Transições entre Categorias

**O que testar:**
1. Clique no botão "Artistas"
2. Clique no botão "Músicas"
3. Clique no botão "Álbuns"
4. Volte para "Artistas"

**O que observar:**
- [ ] Transição suave com slide horizontal
- [ ] Efeito 3D (rotação sutil no eixo Y)
- [ ] Cards aparecem com stagger (um após o outro)
- [ ] Direção da animação muda conforme navegação (esquerda/direita)
- [ ] Sem "pulos" ou saltos visuais

**Duração esperada:** ~0.45s por transição

---

### ✅ Controle de Categoria (Dropdown)

**O que testar:**
1. Clique no botão de categoria (ex: "Músicas")
2. Observe o menu abrir
3. Hover sobre as opções
4. Selecione uma opção diferente
5. Observe o menu fechar

**O que observar:**
- [ ] Menu abre com spring animation (bounce suave)
- [ ] Opções aparecem com stagger (top to bottom)
- [ ] Hover tem scale + background change
- [ ] Background ativo tem layoutId animation (transição fluida)
- [ ] Ao selecionar, botão principal dá "pulse" (scale + glow)
- [ ] Ícone gira sutilmente ao mudar categoria

---

### ✅ Controle de Período (Dropdown)

**O que testar:**
1. Clique no botão de período (ex: "jan.")
2. Clique em "Mês"
3. Selecione outro mês
4. Teste "Semana" e alterne entre "7 dias" e "Semana atual"
5. Teste "Ano" e selecione outro ano

**O que observar:**
- [ ] Menu abre com spring animation
- [ ] Label do período muda com fade (key animation)
- [ ] Botão dá pulse ao mudar período
- [ ] Submenus (mês/semana/ano) expandem suavemente (height: auto)
- [ ] Seletores de ano/mês aparecem com stagger
- [ ] Indicadores ativos têm layoutId animation
- [ ] Meses futuros aparecem disabled (opacidade baixa)
- [ ] Chevron rota 180° ao abrir/fechar

---

### ✅ Entrada da Seção (Scroll)

**O que testar:**
1. Scroll para baixo até a seção "Seus Destaques" sair da tela
2. Scroll para cima até a seção voltar

**O que observar:**
- [ ] Ícone Sparkles entra com bounce + rotation
- [ ] Título "Seus Destaques" entra com fade + slide up
- [ ] Badge de período entra com scale
- [ ] Contador de minutos entra com slide from right
- [ ] Controles entram com fade + slide up
- [ ] **Cascata de delays:** cada elemento entra após o anterior
- [ ] Anéis orbitais materializam (scale + opacity)
- [ ] Anel tracejado começa girando e continua rotação infinita
- [ ] Glow central aparece com scale suave

**Timeline esperada:**
- 0.0s: Sparkles + título
- 0.1s: Sparkles bounce completo
- 0.15s: Badge período
- 0.2s: Contador minutos
- 0.25s: Controles

---

### ✅ Cards do Carrossel

**O que testar:**
1. Observe os cards aparecerem ao trocar categoria
2. Passe o mouse sobre um card
3. Clique em um card
4. Scroll horizontal no carrossel

**O que observar:**
- [ ] Cards entram com spring (não linear)
- [ ] Entrada tem efeito 3D (rotateX inicial)
- [ ] Stagger progressivo (cada card com pequeno delay)
- [ ] Hover: scale 1.05 + z-index elevado
- [ ] Tap/click: scale 0.98 (feedback tátil)
- [ ] Scroll mantém as transformações de tamanho
- [ ] Card central sempre maior que os satélites

---

### ✅ Indicadores de Navegação (Dots)

**O que testar:**
1. Clique nos dots abaixo do carrossel
2. Hover sobre dots inativos
3. **Mobile/Touch:** Swipe esquerda/direita nos dots

**O que observar:**
- [ ] Dot ativo tem transição suave de width (6px → 20px)
- [ ] Background color transiciona suavemente
- [ ] layoutId faz o background "deslizar" entre dots
- [ ] Spring physics visível (pequeno overshoot)
- [ ] Hover: scale 1.2 nos inativos
- [ ] Tap: scale 0.9 feedback
- [ ] **Touch:** Swipe >30px muda categoria

---

### ✅ Performance

**O que testar:**
1. Abra DevTools → Performance
2. Grave enquanto troca entre categorias
3. Observe FPS counter

**O que verificar:**
- [ ] Mínimo 55 FPS durante animações
- [ ] Sem layout shifts (CLS)
- [ ] Sem memory leaks ao trocar múltiplas vezes
- [ ] GPU acceleration ativa (verde no profiler)

**Como verificar GPU:**
- Chrome DevTools → More tools → Rendering
- Enable "Paint flashing"
- Elementos animados devem ter borda verde

---

### ✅ Reduced Motion (Acessibilidade)

**O que testar:**
1. **macOS:** System Preferences → Accessibility → Display → Reduce motion
2. **Windows:** Settings → Ease of Access → Display → Show animations
3. Recarregue a página

**O que observar:**
- [ ] Todas as animações devem ser muito rápidas ou instantâneas
- [ ] Sem animações de rotação
- [ ] Sem animações de bounce
- [ ] Transições básicas apenas (fade simples)
- [ ] Funcionalidade permanece 100% intacta

---

### ✅ Responsive / Mobile

**O que testar:**
1. Redimensione a janela para 375px (iPhone SE)
2. Teste em 768px (iPad)
3. Teste em 1920px (Desktop)

**O que observar:**
- [ ] Dropdowns se ajustam à viewport
- [ ] Cards dimensionam proporcionalmente
- [ ] Touch gestures funcionam (swipe, tap)
- [ ] Sem scroll horizontal indesejado
- [ ] Botões têm área de toque adequada (min 44x44px)

---

## Testes de Integração

### Fluxo Completo
1. Entre na home
2. Aguarde seção carregar
3. Troque categoria: Artistas → Músicas → Álbuns
4. Mude período: Mês → Semana
5. Altere submenu: 7 dias → Semana atual
6. Clique em um card
7. Volte e use os dots de navegação
8. Scroll para fora e volte

**Tempo total:** ~2 minutos

**Resultado esperado:** Todas as animações fluidas, sem bugs visuais, sem erros no console.

---

## Problemas Conhecidos / Limitações

### Não Implementado (Futuro)
- [ ] Parallax nos anéis (scroll-based)
- [ ] Blur progressivo nos cards periféricos
- [ ] Momentum scrolling customizado
- [ ] Haptic feedback (vibração mobile)
- [ ] Loading shimmer ao trocar período

### Pode Precisar Ajuste
- Velocidade das animações (ajustar DURATION se necessário)
- Intensidade do bounce (ajustar SPRING configs)
- Delay do stagger (se muito rápido/lento)

---

## Debug

### Console Errors
Não deve haver erros no console durante uso normal.

Se houver warnings de `useEffect dependencies`, ignorar se não afetar funcionalidade.

### Animation Flickering
Se cards piscarem ao trocar categoria:
- Verificar se `AnimatePresence mode="wait"` está correto
- Verificar se `key` dos cards é único

### Slow Performance
Se FPS < 50:
- Verificar se GPU acceleration está ativa
- Desabilitar temporariamente `will-change` em massa
- Reduzir duração das animações

---

## Métricas de Sucesso

| Métrica | Target | Como Medir |
|---------|--------|------------|
| FPS mínimo | ≥55 | DevTools Performance |
| Tempo de transição | ~0.45s | Cronômetro visual |
| Bounce overshoot | ~5-10% | Observação visual |
| Stagger perceptível | Sim | Deve ver um-a-um |
| Entrada cascata | ~0.5s total | Cronômetro visual |
| Touch response | <100ms | Sensação ao toque |

---

**Data:** 2026-06-10
**Versão:** 1.0.0
**Testado em:** [PENDENTE]
