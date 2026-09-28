# Sprint 10 — Panel, onboarding y avisos

Levantado después de cerrar el Sprint 9, a partir de dos observaciones: que no
hay forma de saber qué pasa dentro de la app, y que una pareja nueva entra sin
que nadie le diga qué hacer.

El orden lo decidió el valor de la información: los 500 cupos de fundador son
un activo de una sola vez, y gastarlos sin medir nada significa no saber
después qué funcionó. Los datos que no se recogen no se recuperan.

| # | Sesión | Estado | Notas |
|---|---|---|---|
| 10.1 | Panel administrativo | ✅ | Métricas agregadas, resumen diario y ficha de soporte. Ruta `/admin` dentro de la misma app, con permiso por *custom claim*. |
| 10.2 | Onboarding al emparejarse | ✅ | Cinco pasos, saltable y repetible desde Ajustes. Incluye pedir el permiso de notificaciones en el momento correcto —cuando ya se explicó para qué— y el estado vacío del álbum, que hoy no dibuja nada cuando no hay recuerdos. |
| 10.3 | Avisos: para uno o para ambos | ✅ | Cada evento guarda a quién avisa. Es el mismo trabajo que arreglar el recordatorio compartido, que hoy es una notificación **local**: solo suena en el aparato que creó el evento. Necesita una función programada. Se suman los avisos de cumpleaños y aniversario, que no existen. |

## Plan de 10.3 — decidido con el usuario

**Recordatorios de eventos.** Quien crea el evento elige a quién avisa —solo a
mí, solo a mi pareja o a los dos— y con cuánta anticipación: a la hora, 15
minutos, 1 hora, 1 día o 1 semana antes. Sigue siendo Premium. Los manda el
servidor, no el teléfono del autor.

**Cumpleaños y aniversario.** Avisos el mismo día, 7 y 14 días antes. En free
solo el del mismo día; los de anticipación —los que dan tiempo de preparar
algo— son Premium, y basta con que uno de los dos pague. El cumpleaños solo le
llega a la pareja; el aniversario, a los dos. Cada quien los apaga en Ajustes.

| Sesión | Qué | Estado |
|---|---|---|
| 10.3a | Lógica pura: quién recibe, cuándo toca, qué dice | ✅ |
| 10.3b | Recordatorios en el servidor: modelo, reglas, índice, función cada minuto | ✅ |
| 10.3c | Selector en el calendario y preferencia en Ajustes | ✅ |
| 10.3d | Cumpleaños y aniversario: función diaria y preferencias | ✅ |
| 10.3e | Retiro de las notificaciones locales y documentación | ✅ |

**Decidido en 10.3a.** La lógica vive en `functions/src/reminderLogic.ts`, sin
Firebase, y su suite corre con el proceso en **UTC** —la zona real de Cloud
Functions—. Los dos errores que importan solo se ven desde ahí: un evento a
las 23:30 de Chile ya es "mañana" en UTC, y una fecha guardada de noche cae
en otro día. Se comprobó que la suite los atrapa rompiendo el código a
propósito: leyendo las fechas en UTC fallan dos pruebas, y quitando el caso
del 29 de febrero fallan otras dos.

**Decidido en 10.3b.** Un barrido cada minuto y no una tarea programada por
evento: con tareas, editar o borrar el evento obliga a cancelar la vieja, que
es el mismo problema que tenían las notificaciones locales. Con el barrido,
editar el evento corrige el aviso solo.

El servidor confía en `remindAt` sin recalcularlo, así que las reglas
comprueban que sea exactamente la hora del evento menos la anticipación, y
que el cliente solo pueda dejar el aviso como pendiente: enviado, vencido y
omitido los escribe el servidor. Cambiar solo el título conserva el estado
—no vuelve a avisar—; mover la hora exige dejarlo pendiente. 13 pruebas de
reglas nuevas, y rompiendo cada una de las dos condiciones a propósito falla
exactamente la prueba que la cubre.

El recordatorio sigue siendo Premium y el plan se mira **al enviar**: si la
pareja dejó de pagar entremedio, no se sigue regalando. Si se desvincularon
después de crear el evento, a la ex pareja no le llega nada. Cada aviso se
marca antes de mandarse, en una transacción: preferimos que uno se pierda por
una caída a que llegue dos veces.

**Decidido en 10.3c.** El interruptor sí/no pasó a ser un selector
(`src/components/ReminderPicker.tsx`): a quién avisa y con cuánta anticipación.
Las anticipaciones que ya pasaron se ven deshabilitadas en vez de
desaparecer: si "1 semana antes" se esfumara para un evento de mañana,
parecería que la opción no existe.

El aviso se rearma solo si cambia algo que lo afecta —a quién, cuándo o la
hora del evento—. Editar solo el título conserva el estado y no vuelve a
avisar. Un evento que ya pasó se guarda sin aviso en vez de bloquear el
guardado: si no, no se le podría corregir ni el título.

Los eventos de antes de 10.3 abren como "a mí, a la hora", que es lo que
eran. Al guardarlos pasan al servidor y se cancela la notificación local, si
está en este teléfono. **Desde otro teléfono no se puede cancelar**: es el
límite del sistema viejo, y puede sonar una vez de más en ese aparato.

La app ya no programa notificaciones locales para eventos nuevos. Borrar el
código que queda es 10.3e.

**Decidido en 10.3d.** `sendDateAlerts` corre a las 09:00 de Chile. Qué sale
cada día lo decide `planDateAlerts()`, con sus pruebas. Solo cuentan las
parejas **mutuas**: si A dice que su pareja es B pero B ya no dice lo mismo,
no se avisa nada. Mandarle a alguien el cumpleaños de su ex es el peor error
posible de esta función, y es la prueba de regresión que la cubre: quitando
la condición, falla.

Se ejecuta una sola vez por día: anota la fecha en `dateAlertRuns` con
`create()`, que falla si ya existe. La contracara es que si la función se cae
a mitad de camino, ese día no se reintenta. Se prefirió así: un aviso de
cumpleaños repetido es peor que uno perdido. Esa colección no tiene regla, y
dos pruebas fijan que ningún cliente pueda crearla ni leerla.

Las pruebas nuevas atraparon un error en mis propios datos de prueba: suponía
que la medianoche chilena era siempre a las 03:00 UTC, y en octubre de 1995
Chile todavía estaba en horario de invierno. Los desfases quedaron
comprobados contra la base de husos de Node.

Es la cuarta tarea programada del proyecto. Google da tres gratis por cuenta
de facturación; la cuarta cuesta del orden de US$0,10 al mes.

El 29 de febrero se celebra el 28 en los años no bisiestos. **Pendiente
anotado:** el calendario de la app hace otra cosa —`nextAnniversary` en
`src/services/milestones.ts` lo corre al 1 de marzo—, así que para quien
empezó un 29 de febrero, la app y el aviso no coinciden. Es un error del
cliente, anterior a este sprint, y queda para su propia sesión.

## Corregido en 10.2b

La bienvenida rebotaba en bucle: se salía al inicio y volvía sola. La causa
era `serverTimestamp()`. Firestore entrega el snapshot local de inmediato,
pero con los campos de marca de servidor en **null** hasta que el servidor
confirma; el guardia leía ese null como «todavía no la ha visto» y devolvía a
/welcome. Se cambió por `Timestamp.now()` del cliente: el campo solo marca que
alguien ya la vio, así que la hora la puede poner el teléfono, y a cambio el
valor existe al instante.

Se sumó además una salida de emergencia en memoria
(`services/onboardingSession.ts`), para que una escritura fallida —sin red,
reglas sin desplegar— no pueda dejar a nadie encerrado entre las dos
pantallas. Se pierde al recargar, que es lo correcto: si la escritura falló, la
bienvenida debe volver a salir.

## Decidido en 10.2

**Saltar también la marca como vista.** Si reapareciera en cada arranque, la
segunda vez ya nadie la lee. Queda disponible para siempre desde Ajustes, que
es la forma honesta de no perderla.

**El permiso de notificaciones va en el último paso**, no al abrir la app por
primera vez. Pedirlo de golpe, antes de explicar para qué sirve, es cuando la
gente dice que no por reflejo — y ese «no» de iOS no se puede volver a pedir
desde la app.

**El espacio de «Un día como hoy» ahora está siempre.** Antes solo aparecía
cuando había algo que mostrar, y con un álbum joven eso es casi nunca: hacen
falta fotos subidas exactamente hace seis meses o un año, el mismo día del
calendario. El resultado era una sección que nadie llegaba a ver. Mientras no
haya recuerdos, promete lo que va a pasar. Un hueco vacío sería peor que nada,
pero una promesa no es un hueco.

## Decidido en 10.1

**El panel no puede leer datos de nadie.** Se descartó darle permiso de
lectura sobre `users` a una cuenta de administrador: con esa regla abierta,
quien tuviera el panel podría leer el perfil entero y de ahí llegar a las
subcolecciones. El soporte pasa por `adminLookupUser`, que devuelve cinco
campos y ninguno más. La privacidad deja de depender de que el panel *no pida*
el contenido y pasa a depender de que no pueda pedirlo. Hay dos pruebas de
reglas que fallan si alguien lo cambia.

**Dos formas de contar, según la frecuencia del evento.** Lo raro (una cuenta,
un emparejamiento, un upgrade) se incrementa en el momento. Lo masivo
(mensajes, fotos, respuestas) se cuenta una vez al día con agregaciones
`count()`. Incrementar en cada mensaje costaría una escritura extra por
mensaje y chocaría con el tope de Firestore de una escritura por segundo sobre
el mismo documento: con volumen real, el contador se pelearía consigo mismo.

**El permiso es un custom claim, no un documento.** Viaja en el token, así que
las reglas lo comprueban sin una lectura extra y ningún cliente puede
escribírselo. Lo otorga un script que se corre desde fuera, con las llaves del
proyecto: el primer administrador no puede dárselo a sí mismo desde dentro del
producto sin abrir esa puerta para cualquiera.

**Un gráfico por medida.** Poner mensajes y personas activas en el mismo
dibujo obligaría a dos escalas verticales, y un gráfico de doble eje deja
comparar visualmente dos cosas que no son comparables: la forma de las curvas
la decide la escala elegida, no los datos.

## Pendiente de configuración (no se puede hacer desde el entorno de desarrollo)

1. Marcarte como administrador. Primero descarga una llave de cuenta de
   servicio en la consola de Firebase (Configuración del proyecto → Cuentas de
   servicio → Generar nueva clave privada) y guárdala **fuera del
   repositorio**. Después, desde la carpeta `functions`:
   `node scripts/setAdmin.js tu@correo.com --key C:\ruta\a\la\llave.json`
   Sirve igual sin `--key` si ya tienes `GOOGLE_APPLICATION_CREDENTIALS` o
   `gcloud auth application-default login`.
   Después hay que cerrar y volver a iniciar sesión: el token viejo sigue
   siendo válido hasta que caduca.
2. `firebase deploy --only firestore:rules,firestore:indexes` — los índices son
   necesarios: el resumen diario cuenta sobre **grupos** de colección, y
   Firestore no los indexa a ese nivel por omisión.
3. `firebase deploy --only functions`.
