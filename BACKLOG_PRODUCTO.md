# Backlog de producto — pendiente de priorizar

Levantado en la revisión de escritorio posterior al Sprint 8. **Nada de esto
está implementado todavía.** Antes de ejecutarlo hay que cerrar la definición
de Free vs Premium (ver `FREE_VS_PREMIUM` más abajo), para no construir algo
y tener que rehacerlo cuando cambie el modelo de monetización.

## Decisiones ya tomadas

- **No habrá personalización sin emparejar.** Se descarta conectar
  `ThemeInheritanceDialog` a un tema individual previo. El objetivo es forzar
  el emparejamiento y que el usuario recorra ese flujo. Cierra el punto 8.10.
- **Calendario no tenía el bug de "cápsulas"** reportado; era la lista de
  Deseos (ya corregido).

## INICIO

- Centrar el "juntos desde" para que se lea como título, más orgánico.
- Falta algo en la pantalla principal, sin definir qué. Pendiente elegir
  entre las opciones propuestas.

## CHAT

- **Carril lateral acoplable**: la app puede abrirse en oficinas y terceros
  ven las fotos del carril. Botón para plegar/desplegar; al plegar, el chat
  se agranda.
- **Modo protección**: botón que difumina las fotos (difuminado alto, solo
  siluetas, sin detalle reconocible). La foto se ve recién al abrir el modal.
- **Navegación en el visor**: hoy el modal abre solo la imagen pinchada;
  debe poder viajar entre todas las imágenes del chat.
- **Bug de audios** (posiblemente anterior): el ícono no cambia de play a
  pausa, no se pueden pausar, y dos audios se superponen al reproducirse.
  Debe emitir un sonido al iniciar y otro al terminar.

## NOTAS

- Editar/eliminar: **ya existen** para ambos planes, vía mantener presionado
  (long-press). En escritorio con mouse es invisible — es un problema de
  descubribilidad, no una limitación de plan.
- Definición deseada: en free NO se puede editar ni eliminar; en premium sí.
  Los botones deben verse igual en free (bloqueados) para comunicar el valor
  de comprar.
- Fecha de creación en cada nota y orden de más reciente a más antigua.
- Notas de voz, con las mismas reglas.

## TAREAS

- Agrupar por conjunto de tareas ("compras del finde", "salir con los niños").
- Free: un solo grupo. Premium: grupos ilimitados.
- Free: no se pueden eliminar, solo tachar. Premium: eliminar.

## DESEOS

- Se mantiene el límite de 10 entre las dos cuentas en free, sin poder
  eliminar.
- Categorías de filtro predeterminadas en free; en premium el usuario puede
  escribir y crear las suyas.

## ÁLBUM

- Sin cambios por ahora.

## CALENDARIO

- Es la sección más desatendida.
- Anclar el aniversario entre los primeros eventos, indicando cuánto falta.
- Pendiente definir qué más lo hace valioso.

## AJUSTES

- Revisado en cuenta free: sin observaciones.

## EXTRA — Ficha de la pareja

Al seleccionar el nombre de la pareja (visible hoy en el riel de escritorio),
abrir una ficha con datos consolidados y **notas privadas de un solo lado**
(no compartidas): gustos, tallas de ropa y calzado, medidas, etc., para
preparar la compra de regalos.
