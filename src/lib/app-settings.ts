/**
 * Acesso com cache às configurações globais:
 * filtro de conteúdo adulto e categorias ativas.
 */

import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export interface AppSettingsData {
    // Core
    siteName: string;
    siteDescription: string;
    maintenanceMode: boolean;
    allowRegistration: boolean;

    // Content Filtering
    hideAdultContent: boolean;
    hasAdultContentPin: boolean;

    // Categories
    enableMovies: boolean;
    enableSeries: boolean;
    enableAnimes: boolean;
    enableDoramas: boolean;
}

const DEFAULT_SETTINGS: AppSettingsData = {
    siteName: "Pflix",
    siteDescription: "Sua plataforma de streaming",
    maintenanceMode: false,
    allowRegistration: true,
    hideAdultContent: true,
    hasAdultContentPin: false,
    enableMovies: true,
    enableSeries: true,
    enableAnimes: true,
    enableDoramas: true,
};

// Simple in-memory cache
let cachedSettings: AppSettingsData | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000; // 1 minute

/**
 * Get app settings with caching
 */
export async function getAppSettings(): Promise<AppSettingsData> {
    const now = Date.now();

    // Return cached if valid
    if (cachedSettings && now - cacheTime < CACHE_TTL) {
        return cachedSettings;
    }

    try {
        // Find first settings record (singleton pattern)
        const settings = await prisma.settings.findFirst();

        if (!settings) {
            // Create default settings if none exist
            const created = await prisma.settings.create({
                data: {},
            });

            cachedSettings = {
                siteName: created.siteName,
                siteDescription: created.siteDescription,
                maintenanceMode: created.maintenanceMode,
                allowRegistration: created.allowRegistration,
                hideAdultContent: created.hideAdultContent,
                hasAdultContentPin: Boolean(created.adultContentPin),
                enableMovies: created.enableMovies,
                enableSeries: created.enableSeries,
                enableAnimes: created.enableAnimes,
                enableDoramas: created.enableDoramas,
            };
        } else {
            cachedSettings = {
                siteName: settings.siteName,
                siteDescription: settings.siteDescription,
                maintenanceMode: settings.maintenanceMode,
                allowRegistration: settings.allowRegistration,
                hideAdultContent: settings.hideAdultContent,
                hasAdultContentPin: Boolean(settings.adultContentPin),
                enableMovies: settings.enableMovies,
                enableSeries: settings.enableSeries,
                enableAnimes: settings.enableAnimes,
                enableDoramas: settings.enableDoramas,
            };
        }

        cacheTime = now;
        return cachedSettings;
    } catch (error) {
        console.error("[app-settings] Error fetching settings:", error);
        return DEFAULT_SETTINGS;
    }
}

/**
 * Update app settings
 */
export async function updateAppSettings(
    data: Partial<Omit<AppSettingsData, "hasAdultContentPin">> & { adultContentPin?: string | null }
): Promise<AppSettingsData> {
    // Find existing settings
    const existing = await prisma.settings.findFirst();

    const updateData: Record<string, unknown> = { ...data };
    if (data.adultContentPin !== undefined) {
        updateData.adultContentPin = data.adultContentPin ? await hash(data.adultContentPin, 12) : null;
    }

    let updated;
    if (existing) {
        updated = await prisma.settings.update({
            where: { id: existing.id },
            data: updateData,
        });
    } else {
        updated = await prisma.settings.create({
            data: updateData as Record<string, unknown>,
        });
    }

    // Invalidate cache
    invalidateSettingsCache();

    // Return updated settings
    return {
        siteName: updated.siteName,
        siteDescription: updated.siteDescription,
        maintenanceMode: updated.maintenanceMode,
        allowRegistration: updated.allowRegistration,
        hideAdultContent: updated.hideAdultContent,
        hasAdultContentPin: Boolean(updated.adultContentPin),
        enableMovies: updated.enableMovies,
        enableSeries: updated.enableSeries,
        enableAnimes: updated.enableAnimes,
        enableDoramas: updated.enableDoramas,
    };
}

/**
 * Invalidate settings cache (call after updates)
 */
export function invalidateSettingsCache(): void {
    cachedSettings = null;
    cacheTime = 0;
}

// ============================================================================
// Convenience helpers for APIs
// ============================================================================

/**
 * Check if adult content should be hidden
 */
export async function shouldHideAdultContent(): Promise<boolean> {
    const settings = await getAppSettings();
    return settings.hideAdultContent;
}

/**
 * Verify adult content PIN
 */
export async function verifyAdultPin(pin: string): Promise<boolean> {
    const settings = await prisma.settings.findFirst({ select: { id: true, adultContentPin: true } });
    const savedPin = settings?.adultContentPin;
    if (!savedPin) return true;
    if (savedPin.startsWith("$2")) return compare(pin, savedPin);
    if (savedPin !== pin) return false;

    // Só migra o PIN legado se ele não foi alterado por outro administrador.
    const result = await prisma.settings.updateMany({
        where: { id: settings.id, adultContentPin: savedPin },
        data: { adultContentPin: await hash(pin, 12) },
    });
    invalidateSettingsCache();
    if (result.count === 0) return verifyAdultPin(pin);
    return true;
}

/**
 * Get enabled categories
 */
export async function getEnabledCategories(): Promise<string[]> {
    const settings = await getAppSettings();
    const categories: string[] = [];

    if (settings.enableMovies) categories.push("movie");
    if (settings.enableSeries) categories.push("serie");
    if (settings.enableAnimes) categories.push("anime");
    if (settings.enableDoramas) categories.push("dorama");

    return categories;
}
