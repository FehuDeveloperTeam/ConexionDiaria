# Sprint 7 — Sistema de diseño (Claude Design) — hoja de ruta

Re-skin completo de la app según el handoff de diseño entregado. Todas las
sesiones están **completas, validadas (tsc/lint/expo export) y pusheadas**
a `claude/conexiondiaria-app-review-o9tn7y`.

| # | Sesión | Commit |
|---|---|---|
| 7.0 | Fundamentos del sistema de diseño (tokens, tipografía, fuentes) | `bb49734` |
| 7.1 | Componentes transversales del sistema de diseño | `5a1c3db` |
| 7.2 | Re-skin de Landing, Login y Registro | `45029c1` |
| 7.3a | Inicio — hero de aniversario y selector de ánimo | `9e6229c` |
| 7.3b | Inicio — extrañómetro, historial y estado sin pareja | `dcb845a` |
| 7.4a | Chat — burbujas y estados de entrega | `267b326` |
| 7.4b | Chat — barra de entrada, hoja de adjuntar, grabación, aviso de almacenamiento | `d073df1` |
| 7.5 | Re-skin de Notas y Tareas | `794e833` |
| 7.6a | Re-skin de Deseos | `abff1cf` |
| 7.6b | Re-skin de Álbum | `7c81cba` |
| 7.7 | Re-skin de Calendario | `92e5dc4` |
| 7.8a | Re-skin de Ajustes | `082c8eb` |
| 7.8b | Probador de tema premium y personalización a nivel de app | `3c8f5c9` |
| 7.9 | Auditoría de modo oscuro en las 8 pantallas y modales | `a9c50c5` |
| 7.10 | Responsive de escritorio (riel lateral, ancho de contenido, paywall en panel) | `7458f82` |

## Decisiones tomadas de forma autónoma (para revisar)

1. **Emojis "picantes" en el plan free**: quedó pendiente — no se agregaron
   emojis picantes a `MOODS_BASE` (el set gratuito). El usuario dijo que
   buscaría una librería propia para la categoría picante y que, mientras
   tanto, se agregaran picantes al free "de la librería que tenemos
   disponible" — esto no llegó a implementarse en ninguna sesión del
   sprint. Sigue pendiente.
2. **ThemeInheritanceDialog no se conectó al emparejamiento real** (7.8b):
   el modelo de datos guarda `settings` en el documento de la relación
   compartida (`relationships/{id}`), que recién existe cuando dos
   personas YA están emparejadas. No hay un tema individual previo que
   "perder" al vincularse — conectar ese diálogo de verdad requeriría
   guardar un tema personal por usuario antes de emparejar, un cambio de
   modelo de datos fuera del alcance de este sprint.
3. **Tipografía de cuerpo elegida en el probador de tema no se propaga**
   a las 8 pantallas ya construidas (7.8b): se guarda y se refleja en el
   preview del probador, pero reemplazar `fontFamilies.body` por una
   fuente dinámica en cada pantalla ya finalizada era un refactor
   mecánico grande y riesgoso para el alcance de esa sesión.
4. **Borde/radio de la personalización premium** solo se aplicó al hero
   de Inicio y a la tab bar/riel (7.8b) — no a todas las tarjetas de la
   app (notas, tareas, deseos, etc.), porque forzar el mismo borde sobre
   diseños con identidad propia (nota adhesiva rotada, badges de
   categoría) los degradaba en vez de mejorarlos.
5. **Responsive de escritorio (7.10)** se acotó a: riel lateral de 248px
   (el ítem más visible del handoff), ancho de contenido de 720px en
   Notas/Tareas/Ajustes (pantallas sin FAB ni elementos anclados al
   borde), y el paywall como panel lateral. Quedaron fuera — y no se
   intentaron a medias — el carril de contexto de 320px, el panel
   derecho de Chat en escritorio, centrar el contenido en pantallas con
   FAB (Álbum/Deseos/Calendario), "Enter envía" en el chat, y hover/
   atajos de teclado. Son funciones nuevas o cambios de mayor riesgo que
   no se podían verificar visualmente en esta sesión (sin navegador con
   sesión iniciada).
6. **El riel lateral de escritorio no se pudo verificar visualmente**
   (esta sesión no tiene una cuenta con la que iniciar sesión en un
   navegador real) — vale la pena confirmarlo con la pareja de prueba.

## Hallazgos corregidos en la auditoría de modo oscuro (7.9)

- Sombra del botón primario y del Toast fijas en los dos temas (debían
  volverse borde en oscuro, regla del handoff).
- Separador de día del chat con colores fijos de claro.
- `UpgradeModal.tsx` (chat) seguía sin re-skinear y sin conectar a la
  compra real — se reemplazó por `PaywallSheet` y se borró el archivo.
- Varios componentes/pantallas usaban `useColorScheme()` directo en vez
  de `useTheme()`, así que no respetaban el override manual de "Modo
  oscuro" de Ajustes (7.8a).
