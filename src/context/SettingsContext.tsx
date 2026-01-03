"use client";

import React, { createContext, useContext } from "react";

export interface PublicSettings {
    siteName: string;
    maintenanceMode: boolean;
    allowRegistration: boolean;
    labEnabled: boolean;

    // Streaming & Categories
    streamingProvider: string; // "LAB" | "WASABI"
    superflixApiUrl?: string; // Should we expose this? Maybe just the host if needed, or keeping it hidden is safer.

    enableMovies: boolean;
    enableSeries: boolean;
    enableAnimes: boolean;
    enableDoramas: boolean;

    hideAdultContent: boolean;
}

const SettingsContext = createContext<PublicSettings | null>(null);

export function SettingsProvider({
    settings,
    children,
}: {
    settings: PublicSettings;
    children: React.ReactNode;
}) {
    return (
        <SettingsContext.Provider value={settings}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (!context) {
        // Fallback safe defaults if used outside provider (e.g. tests) or during hydration mismatch prevention
        return {
            siteName: "Pflix",
            maintenanceMode: false,
            allowRegistration: true,
            labEnabled: true,
            streamingProvider: "LAB",
            enableMovies: true,
            enableSeries: true,
            enableAnimes: true,
            enableDoramas: true,
            hideAdultContent: false,
        };
    }
    return context;
}
