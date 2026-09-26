// Precio que de verdad se le va a cobrar a esta persona — Sprint 9.18/9.19.
//
// Junta las tres piezas que decidían el precio por separado: el escalón que
// corresponde según fechas y cupos (services/pricing.ts), las ofertas que
// RevenueCat tiene configuradas, y el paquete concreto que se va a comprar.
//
// La regla que ordena todo: lo que muestra el cartel sale del paquete que se
// va a cobrar, nunca de un texto escrito a mano. Un precio pintado en el
// código se desincroniza del cobro real el día que alguien cambia una tarifa
// en el dashboard, y el que reclama tiene razón.
import { useCallback, useEffect, useState } from 'react';
import Purchases, { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { usePlan } from '../contexts/planContext';
import { resolvePricingOffer, PricingOffer, TIER_OFFERING_IDS } from '../services/pricing';
import { fetchFoundersLeft } from '../services/founders';

export interface PricingState {
    offer: PricingOffer;
    // Los paquetes del escalón vigente. Null mientras cargan, o si el
    // escalón no está creado todavía en RevenueCat y tampoco hay oferta
    // actual de la cual caer.
    monthly: PurchasesPackage | null;
    annual: PurchasesPackage | null;
    // Precio de lista mensual, el que se muestra tachado. Sale de la oferta
    // de lista, no de una constante: si algún día sube a US$12,99, el tachado
    // sube solo.
    listMonthlyPrice: string | null;
    isLoading: boolean;
}

const toDate = (value: any): Date | null =>
    value?.toDate ? value.toDate() : null;

const pickMonthly = (offering: PurchasesOffering | null): PurchasesPackage | null =>
    offering?.monthly ?? offering?.availablePackages?.[0] ?? null;

// 'enabled' existe por el paywall: hay una instancia de PaywallSheet montada
// en casi cada pantalla, casi siempre invisible. Sin esta compuerta, abrir la
// app dispararía una consulta de ofertas y una lectura de Firestore por cada
// una de ellas, para carteles que nadie va a ver.
export const usePricing = (
    { enabled = true }: { enabled?: boolean } = {}
): PricingState & { purchase: (pkg: PurchasesPackage) => Promise<boolean> } => {
    const { userData, partnerData } = usePlan();

    const [offerings, setOfferings] = useState<Record<string, PurchasesOffering> | null>(null);
    const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | null>(null);
    const [foundersLeft, setFoundersLeft] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;

        (async () => {
            // En paralelo: son dos servicios distintos y ninguno depende del
            // otro. Y con Promise.allSettled, que RevenueCat no responda no
            // puede dejar sin contador al cartel, ni al revés.
            const [offeringsResult, foundersResult] = await Promise.allSettled([
                Purchases.getOfferings(),
                fetchFoundersLeft(),
            ]);

            if (cancelled) return;

            if (offeringsResult.status === 'fulfilled') {
                setOfferings(offeringsResult.value.all ?? {});
                setCurrentOffering(offeringsResult.value.current ?? null);
            } else {
                console.error('No se pudieron cargar las ofertas:', offeringsResult.reason);
            }

            setFoundersLeft(foundersResult.status === 'fulfilled' ? foundersResult.value : null);
            setIsLoading(false);
        })();

        return () => { cancelled = true; };
    }, [enabled]);

    const offer = resolvePricingOffer({
        foundersLeft,
        anniversary: toDate(userData?.relationshipStartDate),
        myBirthday: toDate(userData?.birthDate),
        partnerBirthday: toDate(partnerData?.birthDate),
        partnerName: partnerData?.displayName ?? null,
    });

    // Si el escalón no existe en el dashboard, se cobra el precio de lista en
    // vez de romper la compra. Una configuración a medias hace perder un
    // descuento; una compra que revienta hace perder al cliente.
    const tierOffering = offerings?.[offer.offeringId] ?? currentOffering;
    const listOffering = offerings?.[TIER_OFFERING_IDS.list] ?? currentOffering;

    const monthly = pickMonthly(tierOffering);
    const annual = tierOffering?.annual ?? null;
    const listMonthly = pickMonthly(listOffering);

    const purchase = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        return typeof customerInfo.entitlements.active['premium_entitlement'] !== 'undefined';
    }, []);

    return {
        offer,
        monthly,
        annual,
        // Tacharlo solo tiene sentido si el precio vigente es OTRO: en el
        // escalón de lista, tachar el mismo número es ruido.
        listMonthlyPrice:
            offer.tier !== 'list' && listMonthly?.product.priceString
                ? listMonthly.product.priceString
                : null,
        // Mientras no se haya intentado cargar, "cargando" — así el cartel
        // sabe que todavía no puede mostrar ningún precio.
        isLoading: enabled ? isLoading : true,
        purchase,
    };
};
