"use client";

import { useEffect, useCallback } from "react";

/**
 * Componente que habilita navegação por gamepad/controle
 * Detecta Xbox Controller, PlayStation, etc.
 */
export default function TVNavigation() {
  // Navegação espacial por teclado/gamepad
  const handleKeyNavigation = useCallback((e: KeyboardEvent) => {
    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
    
    const focusableElements = Array.from(
      document.querySelectorAll<HTMLElement>(focusableSelector)
    ).filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && el.offsetParent !== null;
    });

    const currentElement = document.activeElement as HTMLElement;
    const currentIndex = focusableElements.indexOf(currentElement);
    const currentRect = currentElement?.getBoundingClientRect();

    if (!currentRect) {
      // Se nada está focado, focar no primeiro elemento
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        focusableElements[0]?.focus();
        e.preventDefault();
      }
      return;
    }

    let bestCandidate: HTMLElement | null = null;
    let bestDistance = Infinity;

    const isHorizontal = e.key === "ArrowLeft" || e.key === "ArrowRight";
    const isVertical = e.key === "ArrowUp" || e.key === "ArrowDown";

    if (!isHorizontal && !isVertical) return;

    e.preventDefault();

    focusableElements.forEach((el) => {
      if (el === currentElement) return;

      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const currentCenterX = currentRect.left + currentRect.width / 2;
      const currentCenterY = currentRect.top + currentRect.height / 2;

      let isValidDirection = false;
      let distance = 0;

      switch (e.key) {
        case "ArrowUp":
          isValidDirection = centerY < currentCenterY - 10;
          distance = Math.abs(centerX - currentCenterX) + (currentCenterY - centerY) * 0.5;
          break;
        case "ArrowDown":
          isValidDirection = centerY > currentCenterY + 10;
          distance = Math.abs(centerX - currentCenterX) + (centerY - currentCenterY) * 0.5;
          break;
        case "ArrowLeft":
          isValidDirection = centerX < currentCenterX - 10;
          distance = Math.abs(centerY - currentCenterY) + (currentCenterX - centerX) * 0.5;
          break;
        case "ArrowRight":
          isValidDirection = centerX > currentCenterX + 10;
          distance = Math.abs(centerY - currentCenterY) + (centerX - currentCenterX) * 0.5;
          break;
      }

      if (isValidDirection && distance < bestDistance) {
        bestDistance = distance;
        bestCandidate = el;
      }
    });

    if (bestCandidate) {
      (bestCandidate as HTMLElement).focus();
      (bestCandidate as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }
  }, []);

  // Detectar gamepad e mapear para teclado
  useEffect(() => {
    let animationFrameId: number;
    let lastButtons: boolean[] = [];

    const pollGamepad = () => {
      const gamepads = navigator.getGamepads();
      
      for (const gamepad of gamepads) {
        if (!gamepad) continue;

        // Mapeamento de botões Xbox/PlayStation
        const buttons = gamepad.buttons.map((b) => b.pressed);
        
        // D-Pad (índices podem variar por controle)
        // Xbox: 12=Up, 13=Down, 14=Left, 15=Right
        // A=0, B=1, X=2, Y=3
        
        const buttonMap: Record<number, string> = {
          0: "Enter",      // A / X
          1: "Escape",     // B / Circle
          12: "ArrowUp",   // D-Pad Up
          13: "ArrowDown", // D-Pad Down
          14: "ArrowLeft", // D-Pad Left
          15: "ArrowRight",// D-Pad Right
        };

        // Analog stick também como D-pad
        const axes = gamepad.axes;
        const deadzone = 0.5;

        // Left stick
        if (axes[0] < -deadzone && (!lastButtons[100])) {
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
          lastButtons[100] = true;
        } else if (axes[0] > deadzone && (!lastButtons[101])) {
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
          lastButtons[101] = true;
        } else if (Math.abs(axes[0]) < deadzone) {
          lastButtons[100] = false;
          lastButtons[101] = false;
        }

        if (axes[1] < -deadzone && (!lastButtons[102])) {
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
          lastButtons[102] = true;
        } else if (axes[1] > deadzone && (!lastButtons[103])) {
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
          lastButtons[103] = true;
        } else if (Math.abs(axes[1]) < deadzone) {
          lastButtons[102] = false;
          lastButtons[103] = false;
        }

        // Botões
        buttons.forEach((pressed, index) => {
          if (pressed && !lastButtons[index] && buttonMap[index]) {
            const key = buttonMap[index];
            if (key === "Enter") {
              // Simular clique no elemento focado
              const focused = document.activeElement as HTMLElement;
              focused?.click();
            } else if (key === "Escape") {
              // Voltar
              window.history.back();
            } else {
              document.dispatchEvent(new KeyboardEvent("keydown", { key }));
            }
          }
        });

        lastButtons = [...buttons];
      }

      animationFrameId = requestAnimationFrame(pollGamepad);
    };

    // Iniciar polling quando gamepad conectar
    const handleGamepadConnected = (e: GamepadEvent) => {
      console.log("[TV] Gamepad conectado:", e.gamepad.id);
      document.body.classList.add("tv-mode");
      pollGamepad();
    };

    const handleGamepadDisconnected = () => {
      console.log("[TV] Gamepad desconectado");
      cancelAnimationFrame(animationFrameId);
    };

    window.addEventListener("gamepadconnected", handleGamepadConnected);
    window.addEventListener("gamepaddisconnected", handleGamepadDisconnected);
    document.addEventListener("keydown", handleKeyNavigation);

    // Verificar se já tem gamepad conectado
    const gamepads = navigator.getGamepads();
    if (gamepads.some((g) => g !== null)) {
      document.body.classList.add("tv-mode");
      pollGamepad();
    }

    return () => {
      window.removeEventListener("gamepadconnected", handleGamepadConnected);
      window.removeEventListener("gamepaddisconnected", handleGamepadDisconnected);
      document.removeEventListener("keydown", handleKeyNavigation);
      cancelAnimationFrame(animationFrameId);
    };
  }, [handleKeyNavigation]);

  return null; // Componente invisível, só adiciona comportamento
}
