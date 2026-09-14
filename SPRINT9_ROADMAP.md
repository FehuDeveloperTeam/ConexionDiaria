# Sprint 9 — Free vs Premium, funciones estrella y monetización

Plan de acción derivado de la revisión de escritorio y de la definición de
monetización. Las decisiones de producto y la comparativa completa están en
`BACKLOG_PRODUCTO.md` y en https://claude.ai/artifact/LyXrGVB3MrVei9S9fx2KJa

Cada sesión se cierra como veníamos trabajando: una tarea a la vez, validada
con `npx tsc --noEmit`, `npm run lint` (línea base: 4 warnings) y
`expo export --platform web` (22 rutas), commit y push antes de la siguiente.

## Por qué la monetización va al final

Los 500 cupos de fundador son un activo de una sola vez, y quien entra por esa
puerta es el usuario que más va a recomendar la app. Si se abre esa ventana
antes de que existan el aviso de regalo, la ficha de la pareja y el modo
protección, se gastan los 500 mejores lugares en una versión donde premium es
poco más que emojis y temas. Primero se construye lo que vale, después se cobra.

---

## Fase A — Arreglos y descubribilidad

Nada de esto toca el modelo de datos; todo es desplegable de inmediato.

| # | Sesión | Notas |
|---|---|---|
| 9.1 | Audios del chat: play/pausa, superposición y avisos | El ícono no cambia a pausa, no se pueden detener y dos audios suenan a la vez. Añadir sonido al iniciar y al terminar. Toca `useAudioPlayback.ts`. |
| 9.2 | Visor de fotos del chat con navegación | Hoy `ImageViewerModal` abre solo la imagen pinchada; debe recorrer todas las del hilo, como ya hace el visor del Álbum. |
| 9.3 | Editar y eliminar visibles en escritorio | Existen desde siempre vía mantener presionado, pero con mouse son invisibles. En escritorio: botones al pasar el cursor. En teléfono se queda el long-press, que ahí sí es intuitivo. Toca Notas, Tareas y Deseos vía `ContextMenuRow`. |
| 9.4 | Notas: fecha de creación y orden | Mostrar la fecha en cada nota y ordenar de más reciente a más antigua. |
| 9.5 | Inicio: «juntos desde» centrado y «Lo próximo» | Centrar el contador como título. Debajo, el próximo evento del calendario y cuánto falta — hoy Inicio y Calendario no se hablan. |
| 9.6 | Chat: carril lateral plegable | La app se abre en oficinas y el carril expone las fotos. Botón para plegarlo; al plegar, la conversación se ensancha. |

## Fase B — Topes y archivo

Aquí se vuelve real la separación entre los planes.

| # | Sesión | Notas |
|---|---|---|
| 9.7 | Archivo + Deseos: lo regalado no ocupa cupo | La pieza central del modelo. Marcar como regalado saca el ítem de la lista activa y lo manda al archivo; el cupo se libera ahí, no al borrar. Free ve los últimos 10 del archivo, premium todo. Se resuelve con un campo de estado y filtros en las consultas, sin migrar datos. |
| 9.8 | Notas: tope de 10 activas, archivo y paywall | Mismo mecanismo que 9.7. |
| 9.9 | Tareas: grupos | Un grupo en free, ilimitados en premium. Es la única de esta fase que agrega una entidad nueva. |
| 9.10 | Chat: historial de 90 días en free | Cumple la promesa de «historial completo» que el paywall ya hace hoy sin respaldo. El envío de mensajes NO se limita nunca. |

## Fase C — Lo que hace que premium valga

| # | Sesión | Notas |
|---|---|---|
| 9.11 | Fecha de nacimiento en el modelo | **Prerrequisito descubierto:** `UserDoc` no guarda fecha de nacimiento, solo `relationshipStartDate`. Sin esto no hay aviso de cumpleaños ni ventana de descuento de cumpleaños. Dato de la app, disponible en ambos planes: modelo, registro, ajustes y relleno para las cuentas que ya existen. Bloquea a 9.13 y a 9.18. |
| 9.12 | Ficha de la pareja | Al tocar su nombre: datos consolidados y notas privadas de un solo lado —gustos, tallas de ropa y calzado, medidas— para preparar regalos. Premium. |
| 9.13 | Aviso de regalo | **La función estrella.** Encadena Calendario → Deseos → tallas: «faltan dos semanas para su cumpleaños, quiere estas tres cosas, usa talla M y calza 38». Convierte la sección más desatendida en la más valiosa. Depende de 9.11 y 9.12. |
| 9.14 | Modo protección | Difuminado alto sobre las fotos del chat: solo siluetas, sin detalle reconocible. La foto se revela al abrir el modal. Premium. |
| 9.15 | Notas de voz | Con las mismas reglas de cupo que las notas escritas. Premium. |
| 9.16 | Deseos: categorías propias | En free las predeterminadas; en premium el usuario escribe las suyas. |

## Fase D — Monetización real

| # | Sesión | Notas |
|---|---|---|
| 9.17 | Contador de fundadores en el servidor | Va en el webhook de RevenueCat que ya existe (`functions/src/index.ts`), que es quien hoy escribe el plan del usuario y el único componente que puede validar una compra. En el cliente sería falsificable. |
| 9.18 | Ofertas por escalón y selección por fecha | Hoy la compra usa `availablePackages[0]`, el primer paquete que devuelva RevenueCat: con cinco escalones eso deja de servir. Una oferta por escalón y que la app elija según la fecha de la pareja y el contador. Antes de implementar, verificar si las tiendas permiten cinco ventanas o si cada escalón debe ser un producto propio. |
| 9.19 | Paywall dinámico | El precio mostrado sale de la oferta que se va a cobrar, nunca de un texto fijo. El cartel de descuento aparece solo cuando aplica de verdad y dice por qué: «quedan 340 cupos», «faltan 3 días para su aniversario». |

## Fase E — Calendario y hábito

| # | Sesión | Notas |
|---|---|---|
| 9.20 | Calendario: aniversario anclado y mesversarios | El aniversario fijo entre los primeros eventos con cuenta regresiva, y los meses cumplidos generados solos. Ambos planes. |
| 9.21 | Inicio: pregunta del día | Una pregunta distinta cada día para los dos. Es el motor de retención: da una razón para abrir la app a diario. Free ve la de hoy; premium, el archivo de todas las respuestas. |
| 9.22 | Calendario: línea de tiempo de la relación | Hitos y fotos en una sola vista. Premium. |

---

## Dependencias que importan

- **9.11 → 9.13 y 9.18.** Sin fecha de nacimiento no hay aviso de cumpleaños
  ni ventana de descuento de cumpleaños.
- **9.12 → 9.13.** El aviso de regalo necesita las tallas de la ficha.
- **9.7 → 9.8.** El mecanismo de archivo se define una vez en Deseos y se
  reutiliza en Notas.
- **Fase C → Fase D.** Ver la nota del principio sobre los 500 cupos.

## Riesgos abiertos

1. Las tiendas limitan las ofertas introductorias a una por persona por
   suscripción. Con cinco ventanas al año, lo más probable es que cada escalón
   tenga que ser un producto propio o un código de oferta. Verificar en 9.18
   antes de comprometer la estructura.
2. Decisión tomada y asumida a conciencia: mantener el precio lista en US$9,99
   con cinco ventanas de descuento al año significa que muchos van a esperar la
   fecha en vez de comprar al momento. Es deliberado — la espera mantiene al
   usuario atento y la conversión llega en la fecha.
