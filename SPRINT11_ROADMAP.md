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
| 11.3 | Cupo de almacenamiento en el servidor | | `checkStorage()` vive solo en el cliente; `storage.rules` nunca consulta `usedStorage`. El tope del plan gratuito es burlable. |
| 11.4 | Embudo de conversión en el panel | | El panel mide actividad, no conversión. Sin cohortes no se sabe si el negocio funciona. |

## Fase 2 — Pérdida de usuarios

| # | Sesión | Estado | Notas |
|---|---|---|---|
| 11.5 | Caché offline de Firestore | | `getFirestore(app)` sin caché persistente: la app no sirve sin señal, y es una app de hábito diario que se abre en el metro. |
| 11.6 | Pruebas de los flujos que cobran | | Emparejamiento, bienvenida, paywall y compra. Incluye montar el ejecutor de pruebas de componentes, que no existe. |

## Fase 3 — Deuda

| # | Sesión | Estado | Notas |
|---|---|---|---|
| 11.7 | `CLAUDE.md` | | Las convenciones del proyecto no están escritas en ninguna parte del repo. Va antes de las refactorizaciones. |
| 11.8 | Unificar el reproductor de audio | | 435 líneas en dos implementaciones del mismo problema. |
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
