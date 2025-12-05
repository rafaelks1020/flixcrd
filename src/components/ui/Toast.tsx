"use client";

import { Toaster as HotToaster } from "react-hot-toast";

export default function Toast() {
  return (
    <HotToaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: "#18181b",
          color: "#fff",
          border: "1px solid #27272a",
          borderRadius: "0.5rem",
          padding: "12px 16px",
          fontSize: "14px",
        },
        success: {
          iconTheme: {
            primary: "#10b981",
            secondary: "#fff",
          },
        },
        error: {
          iconTheme: {
            primary: "#ef4444",
            secondary: "#fff",
          },
        },
      }}
    />
  );
}
