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
| 10.2 | Onboarding al emparejarse | | Cinco pasos, saltable y repetible desde Ajustes. Incluye pedir el permiso de notificaciones en el momento correcto —cuando ya se explicó para qué— y el estado vacío del álbum, que hoy no dibuja nada cuando no hay recuerdos. |
| 10.3 | Avisos: para uno o para ambos | | Cada evento guarda a quién avisa. Es el mismo trabajo que arreglar el recordatorio compartido, que hoy es una notificación **local**: solo suena en el aparato que creó el evento. Necesita una función programada. Se suman los avisos de cumpleaños y aniversario, que no existen. |

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

1. Marcarte como administrador, desde la carpeta `functions`:
   `node scripts/setAdmin.js tu@correo.com`
   (necesita `GOOGLE_APPLICATION_CREDENTIALS` o `gcloud auth application-default login`).
   Después hay que cerrar y volver a iniciar sesión: el token viejo sigue
   siendo válido hasta que caduca.
2. `firebase deploy --only firestore:rules,firestore:indexes` — los índices son
   necesarios: el resumen diario cuenta sobre **grupos** de colección, y
   Firestore no los indexa a ese nivel por omisión.
3. `firebase deploy --only functions`.
