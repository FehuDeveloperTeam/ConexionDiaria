// Salida de emergencia de la bienvenida — Sprint 10.2b.
//
// El guardia manda a /welcome mientras el perfil no tenga 'onboardedAt'. Si
// esa escritura falla —sin red, reglas mal desplegadas, lo que sea—, la
// persona queda dando vueltas entre la bienvenida y el inicio sin forma de
// salir, y sin entender por qué.
//
// Esta marca vive solo en memoria y se pierde al recargar la app, que es
// justo lo que se quiere: no reemplaza a 'onboardedAt' (si la escritura
// falló, la próxima vez la bienvenida vuelve a salir, que es lo correcto),
// pero garantiza que dentro de esta sesión nadie quede encerrado.
//
// Guarda el uid y no un booleano para que cerrar sesión y entrar con otra
// cuenta no se salte la bienvenida de esa otra persona.

let dismissedFor: string | null = null;

export const markOnboardingDismissed = (uid: string): void => {
    dismissedFor = uid;
};

export const wasOnboardingDismissed = (uid: string | undefined): boolean =>
    !!uid && dismissedFor === uid;
