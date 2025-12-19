"use client";

import { useEffect, useState, useRef } from "react";
import { motion, useSpring, useMotionValue } from "framer-motion";

export default function GhostSpotlight() {
    const [mounted, setMounted] = useState(false);
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    // Smooth out the movement with springs
    const springConfig = { damping: 25, stiffness: 150 };
    const shadowX = useSpring(mouseX, springConfig);
    const shadowY = useSpring(mouseY, springConfig);

    useEffect(() => {
        setMounted(true);

        const handleMouseMove = (e: MouseEvent) => {
            mouseX.set(e.clientX);
            mouseY.set(e.clientY);
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, [mouseX, mouseY]);

    if (!mounted) return null;

    return (
        <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
            {/* Laser Scan Line - Subtle one-time sweep */}
            <motion.div
                initial={{ top: "-10%", opacity: 0.8 }}
                animate={{ top: "110%", opacity: 0 }}
                transition={{ duration: 2, ease: "easeInOut", delay: 0.5 }}
                className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent shadow-[0_0_15px_var(--primary)] z-[110]"
            />

            {/* Atmospheric Glow - The "Ghost" feel */}
            <motion.div
                className="absolute h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 bg-[radial-gradient(circle_at_center,var(--primary-glow)_0%,transparent_70%)]"
                style={{
                    left: shadowX,
                    top: shadowY,
                    "--primary-glow": "var(--spotlight-color, rgba(229, 9, 20, 0.25))",
                } as any}
            />

            {/* Soft Secondary Flare */}
            <motion.div
                className="absolute h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.2)_0%,transparent_70%)]"
                style={{
                    left: shadowX,
                    top: shadowY,
                }}
            />

            {/* Tiny Core - Focus point */}
            <motion.div
                animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.2, 0.3, 0.2]
                }}
                transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
                className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white blur-[6px]"
                style={{
                    left: shadowX,
                    top: shadowY,
                }}
            />
        </div>
    );
}
