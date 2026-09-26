# Backlog de producto — pendiente de priorizar

Levantado en la revisión de escritorio posterior al Sprint 8. **Nada de esto
está implementado todavía.** Antes de ejecutarlo hay que cerrar la definición
de Free vs Premium (ver `FREE_VS_PREMIUM` más abajo), para no construir algo
y tener que rehacerlo cuando cambie el modelo de monetización.

## Monetización — decidido

Modelo: **intimidad y memoria**, no escasez. Editar y borrar quedan libres en
ambos planes. Compra a nivel de pareja ("uno paga, ambos disfrutan", ya
implementado en `planContext.tsx`).

**Cupos**: activos + archivo. El cupo se libera al *cumplir* (regalado/hecho),
no al borrar, y lo cumplido pasa a un archivo permanente. Free ve los últimos
10 del archivo; premium, todo. Se descarta el contador persistente de por vida.

**Topes del plan free**: 10 deseos activos (ya existe), 10 notas activas, un
grupo de tareas, 90 días de historial de chat. El envío de mensajes NO se
limita nunca — es el hábito diario que sostiene la app.

**Escalera de precios** (el anual siempre equivale a 10 meses):

| Momento | Mensual | Anual | Desc. |
|---|---|---|---|
| Precio lista (desde el usuario 501) | US$9,99 | US$99,99 ¹ | — |
| Navidad y San Valentín ¹ | US$5,99 | US$59,99 | 40 % |
| Cumpleaños de cada uno | US$4,99 | US$49,99 | 50 % |
| Aniversario (3 días previos) | US$2,99 | US$29,99 | 70 % |
| Fundadores (primeros 500) | US$2,99 | US$29,99 | 70 % |

¹ Propuesto por Claude siguiendo el patrón, no definido por el usuario.

**Riesgos abiertos**:

1. Cinco ventanas de descuento al año dejan a cualquiera a menos de tres meses
   de la siguiente: conviene mantenerlas cortas y sin anuncio previo, o bajar
   el lista a US$6,99.
2. `availablePackages[0]` ya no sirve con cinco escalones: hace falta una
   oferta por escalón y que la app elija según fecha de la pareja y contador.
3. El contador de 500 debe vivir en el servidor, no en el cliente.
4. Verificar cómo implementar cinco ventanas si las tiendas limitan las
   ofertas introductorias a una por persona (probablemente productos propios
   o códigos de oferta).

Comparativa completa: https://claude.ai/artifact/LyXrGVB3MrVei9S9fx2KJa

## Orden de construcción acordado

1. Arreglos y visibilidad de editar/eliminar en escritorio.
2. Archivo y topes del plan free.
3. Funciones estrella: aviso de regalo, ficha de pareja, modo protección.

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
