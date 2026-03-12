"use client";

import { useState } from "react";
import SwapWidget from "@/components/SwapWidget";
import ExtendedSwapWidget from "@/components/ExtendedSwapWidget";
import MainnetSwapWidget from "@/components/MainnetSwapWidget";

export default function Home() {
  const [mode, setMode] = useState<"standard" | "extended" | "mainnet">("standard");

  return (
    <main className="main-page">
      <div className="bg-orbs">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>
      
      <div className="layout-container">
        {/* Toggle Switch */}
        <div className="mode-toggle" style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "30px",
          gap: "10px",
          background: "rgba(0,0,0,0.4)",
          padding: "5px",
          borderRadius: "16px",
          width: "max-content",
          margin: "0 auto 30px auto",
          border: "1px solid rgba(255,255,255,0.05)"
        }}>
          <button 
            onClick={() => setMode("standard")}
            style={{
              padding: "10px 20px",
              borderRadius: "12px",
              background: mode === "standard" ? "rgba(255,255,255,0.1)" : "transparent",
              color: mode === "standard" ? "#fff" : "rgba(255,255,255,0.5)",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              transition: "all 0.2s"
            }}
          >
            Garden Swap
          </button>
          <button 
            onClick={() => setMode("extended")}
            style={{
              padding: "10px 20px",
              borderRadius: "12px",
              background: mode === "extended" ? "rgba(255,255,255,0.1)" : "transparent",
              color: mode === "extended" ? "#fff" : "rgba(255,255,255,0.5)",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              transition: "all 0.2s"
            }}
          >
            Garden + CoW Routing
          </button>
          <button 
            onClick={() => setMode("mainnet")}
            style={{
              padding: "10px 20px",
              borderRadius: "12px",
              background: mode === "mainnet" ? "rgba(247,147,26,0.2)" : "transparent",
              color: mode === "mainnet" ? "#f7931a" : "rgba(255,255,255,0.5)",
              border: mode === "mainnet" ? "1px solid rgba(247,147,26,0.4)" : "1px solid transparent",
              cursor: "pointer",
              fontWeight: 600,
              transition: "all 0.2s"
            }}
          >
            ₿ Mainnet BTC→ERC20
          </button>
        </div>

        {/* Active Widget */}
        {mode === "standard" && <SwapWidget />}
        {mode === "extended" && <ExtendedSwapWidget />}
        {mode === "mainnet" && <MainnetSwapWidget />}
      </div>
    </main>
  );
}
