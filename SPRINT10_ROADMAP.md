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
| 10.3 | Avisos: para uno o para ambos | | Cada evento guarda a quién avisa. Es el mismo trabajo que arreglar el recordatorio compartido, que hoy es una notificación **local**: solo suena en el aparato que creó el evento. Necesita una función programada. Se suman los avisos de cumpleaños y aniversario, que no existen. |

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
