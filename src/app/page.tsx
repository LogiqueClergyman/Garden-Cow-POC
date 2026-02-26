import SwapWidget from "@/components/SwapWidget";

export default function Home() {
  return (
    <main className="main-page">
      <div className="bg-orbs">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>
      <SwapWidget />
    </main>
  );
}
