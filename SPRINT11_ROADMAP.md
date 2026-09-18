# Sprint 11 — Mejoras del sistema

Levantado de una auditoría del repositorio, no de una lista de deseos. El
criterio de orden es uno: qué hace perder clientes o dinero **sin que nos
enteremos**. Eso va primero; la deuda que solo hace el trabajo más lento va al
final.

## Fase 1 — Fallas silenciosas

| # | Sesión | Estado | Notas |
|---|---|---|---|
| 11.1 | Reporte de errores y red de seguridad | ✅ | 101 `console.error` que no llegaban a ninguna parte, y pantalla blanca ante cualquier error de render. |
| 11.2 | Integración continua | ✅ | Las 159 pruebas no corren solas: nada impide subir código que las rompa. |
| 11.3 | Cupo de almacenamiento en el servidor | ✅ | `checkStorage()` vive solo en el cliente; `storage.rules` nunca consulta `usedStorage`. El tope del plan gratuito es burlable. |
| 11.4 | Embudo de conversión en el panel | ✅ | El panel mide actividad, no conversión. Sin cohortes no se sabe si el negocio funciona. |

## Fase 2 — Pérdida de usuarios

| # | Sesión | Estado | Notas |
|---|---|---|---|
| 11.5 | Caché offline de Firestore | ✅ | `getFirestore(app)` sin caché persistente: la app no sirve sin señal, y es una app de hábito diario que se abre en el metro. |
| 11.6 | Pruebas de los flujos que cobran | ✅ | Emparejamiento, bienvenida, paywall y compra. Incluye montar el ejecutor de pruebas de componentes, que no existe. |

## Fase 3 — Deuda

| # | Sesión | Estado | Notas |
|---|---|---|---|
| 11.7 | `CLAUDE.md` | ✅ | Las convenciones del proyecto no están escritas en ninguna parte del repo. Va antes de las refactorizaciones. |
| 11.8 | Unificar el reproductor de audio | ⏸ aplazada | 435 líneas en dos implementaciones del mismo problema. |
| 11.9 | Partir `home.tsx` y `chat.tsx` | | 1.387 y 1.293 líneas. Ahí ya se escaparon errores. |
| 11.10 | Accesibilidad en lo antiguo | | 50 atributos para 344 elementos tocables (~15%). |

## Decidido en 11.2

**Tres trabajos en paralelo y no uno secuencial**: app, reglas y functions. El
de reglas necesita la JVM para los emuladores y el de functions su propio
`npm ci`; separarlos evita que la app espere por una dependencia que no usa, y
deja claro en el reporte qué se rompió.

**El lint se fija en 3 avisos con `--max-warnings 3`.** Esa era la línea base
que se venía sosteniendo a mano en cada sesión; sin el tope, un cuarto aviso
entra sin que nadie lo note. Cuando se arregle alguno de los tres, hay que
bajar el número.

**El export corre con credenciales de relleno.** Solo necesita que las
variables existan para inlinearlas; así se comprueba que el build no está roto
sin poner las credenciales reales en CI.

## Decidido en 11.3 — y un inconveniente que cambió el plan

**Las reglas entre servicios no funcionan en el emulador.** El plan era
validar el tope en `storage.rules` leyendo `usedStorage` y `storageLimit` del
documento de la relación con `firestore.get()`. Están documentadas y
probablemente funcionan en producción, pero **`firestore.exists()` devuelve
`false` aunque el documento exista** — comprobado con una sonda: al exigir
`exists()`, las subidas legítimas empezaron a fallar. O sea, no hay forma de
probar esa regla antes de desplegarla.

Y sus dos modos de falla eran inaceptables. Ante «no encuentro el documento»,
dejar pasar significa no aplicar el cupo nunca y que nadie se entere: el mismo
agujero, ahora con la apariencia de estar tapado. Rechazar significa que, si
las reglas entre servicios fallaran en producción, **nadie puede subir nada**.

**Se movió a `onStorageObjectFinalized`**, que ya corría en cada subida. Si el
archivo pasa el cupo, se borra y queda contado en `overQuotaUploads` para
soporte. Cuesta una subida de ancho de banda desperdiciada —acotada por el
tope por archivo, que sí vive en las reglas— a cambio de un control
verificable que no puede fallar en silencio. La decisión va en una transacción:
dos subidas simultáneas leyendo por separado podrían dejar pasar las dos.

**Las tres decisiones se extrajeron a un módulo puro** (`storageQuota.ts`) con
24 pruebas. Son justo las que si están mal no dan error, solo dejan de aplicar
el cupo: qué rutas cuentan (la foto de perfil no), cuál es el tope cuando el
campo falta (gratuito, nunca «sin límite») y cuál es el de una pareja mixta
(basta que uno pague).

## Aplazada en 11.8, y por qué

**No se unificaron los dos reproductores de audio.** El núcleo compartido
(refs + número de intento) es idéntico, pero fusionarlos obliga a cambiar
`useSingleAudioPlayer`, del que dependen las Notas, y a extender su API con
callbacks para intercalar los avisos de inicio y fin del chat.

El problema no es la dificultad: es que **la reproducción real no se puede
probar en el entorno de desarrollo remoto** —sin dispositivo y con `expo-av`
simulado—, y este es el código que costó tres intentos arreglar y que ya está
verificado funcionando. Refactorizarlo a ciegas, sin nadie mirando, cambia un
riesgo hipotético (que un arreglo futuro no llegue a la otra copia) por un
riesgo real (romper algo que funciona).

En su lugar se hizo lo que sí baja el riesgo hoy:

- **Cinco pruebas del núcleo**, tres de ellas regresión directa de los
  síntomas de 9.1: que pausar pause de verdad, que tocar otro audio no deje
  los dos sonando, y que una carga obsoleta no arranque tarde encima del que
  ya suena.
- **El acoplamiento queda visible**: las dos copias se nombran mutuamente con
  una advertencia de que un arreglo en una no llega a la otra.

Queda para cuando haya un dispositivo donde verificarlo.

## Decidido en 11.6 — y un error de orden en este propio plan

**Los flujos completos de `config.tsx` y `home.tsx` NO quedaron cubiertos**, y
no por falta de ganas: con 739 y 1.387 líneas y una decena de dependencias
externas cada uno, montar sus dobles cuesta más que el valor que entrega, y el
resultado sería una prueba frágil que se rompe con cualquier cambio.

Eso significa que **11.9 (partir los archivos grandes) es prerrequisito de
probarlos**, no una tarea posterior. El plan los tenía al revés.

Lo que sí quedó cubierto son los componentes donde de verdad ocurrieron los
errores: el límite de error, la bienvenida —incluidas dos pruebas de regresión
del bucle—, el paywall (que un cartel no invente precios) y la fila de tallas.
22 pruebas de interfaz.

**El ícono perdía su etiqueta de accesibilidad bajo jest.** Al descubrirlo, la
etiqueta se movió del ícono a una vista que lo envuelve. No es un parche para
la prueba: un glifo de fuente se anuncia de forma menos confiable que una
vista marcada como accesible, así que el cambio mejora el producto real.

**`react-test-renderer` queda con versión exacta.** Con caret resuelve a 19.3,
que exige React ^19.3 mientras el proyecto está en 19.1, y rompe la instalación.

## Decidido en 11.5 — y una corrección al propio plan

**La caché persistente de Firestore es solo para web.** Va sobre IndexedDB,
que no existe en React Native. La justificación con la que se priorizó este
ítem —«la app se abre en el metro y no sirve»— es el caso **móvil**, y este
cambio **no lo resuelve**: en el teléfono el SDK web sigue con caché en
memoria, así que la app funciona mientras está abierta pero arranca vacía sin
señal.

Lo que sí se gana, y es real, es la experiencia en escritorio, que es donde
más se está usando la app hoy: cada recarga de pestaña dejaba todo vacío un
instante mientras la red respondía. Se usa `persistentMultipleTabManager`
porque sin él una segunda pestaña rompe la persistencia de la primera.

Resolver el caso móvil exige migrar a `@react-native-firebase`, que trae el
SDK nativo con persistencia propia. Es una decisión grande y aparte — toca
toda la capa de datos — y no estaba dimensionada en este plan.

## Decidido en 11.4 — y una limitación que no se puede salvar

**Las descargas no se pueden medir desde acá.** Ese dato vive en App Store
Connect y en Play Console, no en Firestore, y no hay forma honesta de
inferirlo. El embudo empieza donde empiezan nuestros datos —la cuenta
creada— y el panel lo dice explícitamente, en vez de dejar creer que está
completo. Para el número de arriba hay que mirar las consolas de las tiendas.

**Cohorte = mes de registro, no porcentaje sobre el total.** Preguntar «qué
porcentaje de los usuarios paga» mezcla a quien se registró ayer con quien
lleva un año: da un número que siempre parece malo justo cuando la app crece,
y que empeora al crecer más rápido.

**Se leen los documentos de la cohorte en vez de usar `count()`.** A este
volumen son centavos, y permite medir además la mediana de días hasta
emparejarse — que es lo que distingue un problema de producto de un problema
de tráfico: si la gente se registra y no se empareja nunca, no faltan
descargas. Solo se recalculan los últimos 6 meses; una cohorte vieja ya no se
mueve.

## Corrección de la auditoría preliminar

Se reportó el latido de presencia (`isOnline`) como una fuga de costos por
escribir cada 30 segundos. **Es falso**: ya está en 4 minutos
(`src/hooks/useOnlineStatus.ts`) y cuesta menos de un dólar al mes a mil
usuarios activos. El error salió de un comentario desactualizado en
`planContext.tsx` que todavía describe el intervalo antiguo. El ítem se
descarta del plan; el comentario queda corregido en 11.1.

## Decidido en 11.1

**No se instaló Sentry, todavía.** Es la opción correcta a mediano plazo, pero
exige una dependencia nativa y una reconstrucción con EAS que no se puede
validar desde el entorno de desarrollo remoto: si rompe el build nativo, el
resultado es peor que no tener reporte de errores. En su lugar se construyó
una capa con **destino intercambiable** — el resto de la app solo conoce
`captureError()`, y pasar a Sentry o Crashlytics es reemplazar el cuerpo de
`send()` en `src/services/errorReporter.ts`.

**La función acepta llamadas sin sesión iniciada.** Los errores que más
importan son los de antes de entrar —registro, login—, y exigir autenticación
los dejaría justamente fuera. El costo del abuso está acotado por los topes de
tamaño y por `maxInstances: 3`. La puerta correcta si algún día molesta es App
Check, no pedir sesión.

**El límite de error no usa el tema de la app.** Tiene que poder dibujarse
cuando lo que falló es el proveedor de tema o el de sesión. Colores fijos,
leyendo la apariencia del sistema directamente.
