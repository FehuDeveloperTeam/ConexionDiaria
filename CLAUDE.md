# Conexión Diaria — convenciones del proyecto

App para parejas: chat, notas, tareas, deseos, álbum, calendario y ficha de la
pareja. Expo (React Native) con Expo Router, Firebase (Auth, Firestore,
Storage, Cloud Functions) y RevenueCat para las suscripciones. Corre en iOS,
Android y web — **la web no es un extra, se usa a diario en escritorio**.

Este archivo existe porque hasta el Sprint 11.7 todas estas convenciones
vivían solo en la conversación con quien programaba. Cuando esa conversación
se cerraba, se cerraban con ella.

## Antes de cada commit

Cuatro cosas, siempre, en este orden:

```bash
npx tsc --noEmit                   # sin errores
npm run lint                       # exactamente 3 avisos (la línea base)
npm test                           # lógica + interfaz + reglas
npx expo export --platform web     # 32 rutas
```

Los números son la línea base real, no aspiraciones. **Si cambian, hay que
explicar por qué en el mensaje del commit.** Los 3 avisos de lint son dos de
dependencias en las animaciones de onda del chat y uno en el pulso del corazón
de Inicio, los tres revisados y aceptados; el CI los fija con
`--max-warnings 3`, así que un cuarto aviso rompe el build.

Las suites:

| Comando | Qué cubre |
|---|---|
| `npm run test:logic` | Seis suites de lógica pura (precios, hitos, preguntas, recuerdos, cupos, fechas) |
| `npm run test:ui` | Interfaz con jest-expo + Testing Library |
| `npm run test:rules` | Reglas de Firestore y Storage contra los emuladores (necesita Java) |

## Una tarea por commit

Nunca dos cosas en el mismo commit, aunque sean chicas. El mensaje explica
**por qué**, no qué: el diff ya dice qué. Si hubo un camino descartado, se
escribe por qué se descartó — es lo que evita que alguien lo reintente en seis
meses.

Los mensajes van en español. Los comentarios del código también.

## Nunca

- **Subir `.env` ni credenciales.** Tampoco llaves de cuenta de servicio de
  Firebase; `.gitignore` cubre los nombres con que las entrega la consola,
  pero lo correcto es guardarlas fuera del repositorio.
- **Escribir desde el cliente los campos bloqueados.** `plan`, `premiumSince`
  y `founderNumber` en `users`; `usedStorage` y `storageLimit` en
  `relationships`. Los escribe solo el servidor con Admin SDK. Si el cliente
  pudiera tocarlos, el muro de pago sería decorativo.
- **Tocar `firestore.rules` o `storage.rules` sin pruebas.** Un error en las
  reglas no rompe el build ni falla en TypeScript: deja la puerta abierta, en
  silencio. Cada cambio de reglas va con sus pruebas de emulador, y se prueban
  las dos caras — que el ataque falle y que el flujo legítimo siga funcionando.

## Trampas que ya costaron errores en producción

Cada una de estas llegó a un teléfono. Están acá para que no vuelvan.

**`serverTimestamp()` para decisiones inmediatas.** Firestore entrega el
snapshot local al instante, pero con los campos de marca de servidor en
`null` hasta que el servidor confirma. Si algo decide mirando ese campo, lee
`null` y decide mal. La bienvenida rebotaba en bucle por esto. Para un
"ya pasó esto" usar `Timestamp.now()` del cliente.

**`new Date('aaaa-mm-dd')`.** Se interpreta como medianoche **UTC**, así que en
Chile devuelve el día anterior. Construir la fecha a mano
(`new Date(año, mes - 1, día)`) o usar `src/services/dateInput.ts`.

**Truncar días en vez de redondear.** El día en que empieza el horario de
verano dura 23 horas; truncando milisegundos, una cuenta regresiva se adelanta
un día. Usar `daysBetween` de `src/services/milestones.ts`.

**`flexGrow: 1` en los `ScrollView` de react-native-web.** *Todo* `ScrollView`
lo trae por defecto, y en uno **horizontal** ese crecimiento va en el eje del
padre — o sea vertical. Una tira de miniaturas se come media pantalla. Hay que
poner `style={{ flexGrow: 0, flexShrink: 0 }}` explícitamente.

**GiftedChat memoiza las filas.** Su comparador mira solo el mensaje, no
`renderBubble`, así que el estado externo no llega a la burbuja. Los cambios de
estado tienen que entrar por contexto (ver
`src/screens/chat/context/audioPlaybackContext.tsx`).

**Hooks después de un `return` condicional.** Varias pantallas tienen early
returns por carga y por "sin pareja". Cualquier hook nuevo va **arriba**, antes
de ellos.

**Las reglas entre servicios no funcionan en el emulador.**
`firestore.get()`/`exists()` desde `storage.rules` devuelve como si el
documento no existiera. No se puede probar una regla así, y una regla de
seguridad no verificable es una ilusión de control — el tope de almacenamiento
se hace cumplir en una Cloud Function por eso (ver `storage.rules`).

## Arquitectura

**Rutas.** Expo Router con grupos. Las pantallas que no son pestañas pero
necesitan el riel lateral van **dentro** de `app/(tabs)/` con
`options={{ href: null }}` — como ruta suelta pierden la navegación entera y el
borde del contenido queda donde estaba la barra, cortando la pantalla. Las que
no lo necesitan (`admin`, `welcome`, `theme-editor`) van en la raíz.

**Estado.** `PlanProvider` expone `user`, `userData`, `partnerData`,
`relationshipData` y `plan`. Su listener se dispara seguido (presencia cada 4
minutos, cambios de ánimo), así que **no** crear listeners dentro de ese
efecto y usar dependencias finas — `partnerData?.measurements` como
dependencia re-ejecuta todo en cada latido; serializar o extraer el valor.

**Planes.** El plan es de la **persona**, no de la pareja, y la pareja lo
deriva como el OR de los dos: "uno paga, ambos disfrutan". Los topes de
almacenamiento viven en `src/config/plans.ts` y se duplican a propósito en
`functions/src/storageQuota.ts` (proyectos con build separado) — si cambian,
cambian juntos.

**Lógica pura.** Todo lo que sea fechas, precios o decisiones va en un módulo
sin Firebase ni React, con su propia suite y su `tests/tsconfig.*.json`. Es lo
que permite probarlo. Ejemplos: `pricing.ts`, `milestones.ts`, `memories.ts`,
`dailyQuestions.ts`, `storageQuota.ts`, `dateInput.ts`.

**Errores.** `captureError()` de `src/services/errorReporter.ts` en los puntos
donde alguien pierde algo o falla dinero. El destino es intercambiable: pasar a
Sentry es reemplazar el cuerpo de `send()`. No usar `console.error` a secas
para esos casos: nadie lee la consola de un teléfono ajeno.

## Despliegue

```bash
npx firebase deploy --only firestore:rules,firestore:indexes
npx firebase deploy --only functions
npx firebase deploy --only storage
```

Los índices importan: el resumen del panel cuenta sobre **grupos** de
colección, y Firestore no los indexa a ese nivel por omisión.

Para dar permiso de panel a alguien, desde `functions/`:

```bash
node scripts/setAdmin.js correo@ejemplo.com --key /ruta/a/la/llave.json
```

Después hay que cerrar y volver a iniciar sesión: el token viejo sigue siendo
válido hasta que caduca.

## Deuda conocida

- `app/(tabs)/home.tsx` (1.387 líneas) y `app/(tabs)/chat.tsx` (1.293) son
  demasiado grandes; ahí ya se escaparon errores. **Partirlos es
  prerrequisito** para poder probar sus flujos: hoy montar sus dobles cuesta
  más de lo que entrega.
- Dos reproductores de audio para el mismo problema:
  `src/hooks/useSingleAudioPlayer.ts` (lo usan las Notas) y
  `src/screens/chat/hooks/useAudioPlayback.ts` (lo usa el Chat). Un arreglo en
  uno no llega al otro.
- Accesibilidad: ~50 atributos para ~344 elementos tocables. Lo nuevo los
  lleva; lo antiguo no.
- Sin persistencia offline en móvil: la caché persistente de Firestore va sobre
  IndexedDB, que no existe en React Native. Resolverlo exige migrar a
  `@react-native-firebase`.
