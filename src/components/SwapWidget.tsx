"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchChains,
  fetchQuote,
  createOrder,
  initiateOrder,
  getOrderStatus,
  type Chain,
  type Asset,
  type QuoteResult,
  type Order,
} from "@/lib/gardenApi";
import {
  connectWallet,
  getConnectedAccount,
  signTypedData,
  switchNetwork,
  shortenAddress,
} from "@/lib/wallet";
import OrderStatus from "./OrderStatus";

type Step = "idle" | "quoting" | "quoted" | "creating" | "signing" | "initiating" | "tracking" | "done" | "error";

interface ChainAsset {
  chain: Chain;
  asset: Asset;
}

function AssetSelector({
  label,
  chains,
  value,
  onChange,
  exclude,
}: {
  label: string;
  chains: Chain[];
  value: ChainAsset | null;
  onChange: (val: ChainAsset) => void;
  exclude?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const allOptions: ChainAsset[] = [];
  for (const c of chains) {
    for (const a of c.assets) {
      if (a.id !== exclude) allOptions.push({ chain: c, asset: a });
    }
  }

  return (
    <div className="asset-selector" ref={ref}>
      <label className="selector-label">{label}</label>
      <button className="selector-btn" onClick={() => setOpen((o) => !o)}>
        {value ? (
          <span className="selector-value">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value.asset.icon} alt="" className="asset-icon" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <span className="asset-name">{value.asset.name.split(":")[1] || value.asset.name}</span>
            <span className="chain-badge">{value.chain.name}</span>
          </span>
        ) : (
          <span className="selector-placeholder">Select asset…</span>
        )}
        <span className="selector-arrow">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="selector-dropdown">
          {allOptions.map(({ chain, asset }) => (
            <button
              key={asset.id}
              className={`dropdown-item ${value?.asset.id === asset.id ? "dropdown-item-active" : ""}`}
              onClick={() => {
                onChange({ chain, asset });
                setOpen(false);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset.icon} alt="" className="asset-icon" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <span className="dropdown-asset-name">{asset.name.split(":")[1] || asset.name}</span>
              <span className="dropdown-chain">{chain.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SwapWidget() {
  const [chains, setChains] = useState<Chain[]>([]);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [fromAsset, setFromAsset] = useState<ChainAsset | null>(null);
  const [toAsset, setToAsset] = useState<ChainAsset | null>(null);
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<Order | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const quoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const walletRef = useRef<HTMLDivElement>(null);

  // Load chains on mount
  useEffect(() => {
    fetchChains().then(setChains).catch(console.error);
    getConnectedAccount().then(setWalletAddress);
  }, []);

  // Close disconnect popup on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (walletRef.current && !walletRef.current.contains(e.target as Node)) {
        setShowDisconnect(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Auto-fetch quote when inputs change
  useEffect(() => {
    if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);
    if (!fromAsset || !toAsset || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    quoteTimerRef.current = setTimeout(async () => {
      setQuoteError(null);
      setStep("quoting");
      try {
        const results = await fetchQuote(fromAsset.asset.id, toAsset.asset.id, amount);
        if (results.length > 0) {
          setQuote(results[0]);
          setStep("quoted");
        } else {
          setQuote(null);
          setQuoteError("No routes available for this pair.");
          setStep("idle");
        }
      } catch (e: unknown) {
        setQuote(null);
        setQuoteError(e instanceof Error ? e.message : "Quote failed.");
        setStep("idle");
      }
    }, 600);
  }, [fromAsset, toAsset, amount]);

  // Poll order status
  const startPolling = useCallback((id: string) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(async () => {
      try {
        const order = await getOrderStatus(id);
        setOrderData(order);
        if (order.destination_swap?.redeem_tx_hash) {
          clearInterval(pollTimerRef.current!);
          setStep("done");
        }
      } catch {
        // keep polling
      }
    }, 5000);
  }, []);

  useEffect(() => () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); }, []);

  const handleConnect = async () => {
    try {
      const addr = await connectWallet();
      setWalletAddress(addr);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Wallet connection failed.");
    }
  };

  const handleDisconnect = () => {
    setWalletAddress(null);
    setShowDisconnect(false);
    setStep("idle");
    setQuote(null);
    setOrderId(null);
    setOrderData(null);
    setError(null);
  };

  // Use refs to always have the latest state inside the async callback
  const walletAddressRef = useRef(walletAddress);
  const fromAssetRef = useRef(fromAsset);
  const toAssetRef = useRef(toAsset);
  const quoteRef = useRef(quote);

  useEffect(() => { walletAddressRef.current = walletAddress; }, [walletAddress]);
  useEffect(() => { fromAssetRef.current = fromAsset; }, [fromAsset]);
  useEffect(() => { toAssetRef.current = toAsset; }, [toAsset]);
  useEffect(() => { quoteRef.current = quote; }, [quote]);

  const handleSwap = useCallback(async () => {
    const addr = walletAddressRef.current;
    const from = fromAssetRef.current;
    const to = toAssetRef.current;
    const q = quoteRef.current;

    if (!addr) { setError("Please connect your wallet first."); return; }
    if (!from || !to) { setError("Please select both assets."); return; }
    if (!q) { setError("Please wait for a quote."); return; }

    setError(null);
    try {
      // Create order
      setStep("creating");
      const orderResult = await createOrder(
        from.asset.id,
        addr,
        q.source.amount,
        to.asset.id,
        addr,
        q.destination.amount
      );

      // Switch MetaMask to the source chain before signing.
      // The typed_data domain chainId may be hex ("0xaa36a7") or decimal.
      setStep("signing");
      const typedDataObj = orderResult.typed_data as { domain?: { chainId?: string | number } };
      const rawChainId = typedDataObj?.domain?.chainId;
      if (rawChainId !== undefined) {
        const chainIdNum =
          typeof rawChainId === "string" && rawChainId.startsWith("0x")
            ? parseInt(rawChainId, 16)
            : Number(rawChainId);
        if (!isNaN(chainIdNum)) {
          await switchNetwork(chainIdNum);
        }
      }
      const signature = await signTypedData(addr, orderResult.typed_data);

      // Initiate order with signature
      setStep("initiating");
      await initiateOrder(orderResult.order_id, signature);

      // Start tracking
      setOrderId(orderResult.order_id);
      setStep("tracking");

      // Fetch initial status
      const initialOrder = await getOrderStatus(orderResult.order_id);
      setOrderData(initialOrder);
      startPolling(orderResult.order_id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Swap failed.";
      console.error("[Garden Swap] error:", e);
      setError(msg);
      setStep(quoteRef.current ? "quoted" : "idle");
    }
  }, [startPolling]);

  const resetSwap = () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    setStep(quote ? "quoted" : "idle");
    setOrderId(null);
    setOrderData(null);
    setError(null);
  };

  const evmChains = chains.filter((c) => c.id.startsWith("evm:"));
  const isLoading = ["creating", "signing", "initiating"].includes(step);

  const stepLabel: Record<string, string> = {
    creating: "Creating order…",
    signing: "Waiting for signature…",
    initiating: "Initiating swap…",
  };

  return (
    <div className="swap-container">
      {/* Header */}
      <div className="swap-header">
        <div className="logo-row">
          <div className="garden-logo">🌿</div>
          <div>
            <h1 className="brand-title">Garden Swap</h1>
            <p className="brand-sub">Cross-chain swaps powered by Garden Finance</p>
          </div>
        </div>

        {/* Wallet button with disconnect dropdown */}
        <div className="wallet-wrapper" ref={walletRef}>
          {walletAddress ? (
            <>
              <button
                className="wallet-btn wallet-connected"
                onClick={() => setShowDisconnect((v) => !v)}
                title="Click to manage wallet"
              >
                <span className="wallet-dot" />
                {shortenAddress(walletAddress)}
                <span className="wallet-caret">{showDisconnect ? "▲" : "▼"}</span>
              </button>
              {showDisconnect && (
                <div className="wallet-dropdown">
                  <div className="wallet-full-addr">{walletAddress.slice(0, 20)}…{walletAddress.slice(-6)}</div>
                  <button className="disconnect-btn" onClick={handleDisconnect}>
                    🔌 Disconnect
                  </button>
                </div>
              )}
            </>
          ) : (
            <button className="wallet-btn" onClick={handleConnect}>
              Connect Wallet
            </button>
          )}
        </div>
      </div>

      {/* Main widget */}
      <div className="widget-card">
        {/* Asset selectors */}
        <div className="assets-row">
          <AssetSelector
            label="From"
            chains={evmChains}
            value={fromAsset}
            onChange={setFromAsset}
            exclude={toAsset?.asset.id}
          />
          <button
            className="swap-arrows"
            onClick={() => {
              const tmp = fromAsset;
              setFromAsset(toAsset);
              setToAsset(tmp);
              setQuote(null);
            }}
            title="Swap direction"
          >
            ⇄
          </button>
          <AssetSelector
            label="To"
            chains={evmChains}
            value={toAsset}
            onChange={setToAsset}
            exclude={fromAsset?.asset.id}
          />
        </div>

        {/* Amount input */}
        <div className="amount-section">
          <label className="amount-label">Amount (atomic units)</label>
          <div className="amount-input-row">
            <input
              className="amount-input"
              type="number"
              placeholder={fromAsset ? `Min: ${fromAsset.asset.min_amount}` : "Enter amount…"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
            />
            {fromAsset && (
              <button
                className="max-btn"
                onClick={() => setAmount(fromAsset.asset.max_amount)}
              >
                MAX
              </button>
            )}
          </div>
          {fromAsset && amount && (
            <div className="amount-hint">
              ≈ {(Number(amount) / Math.pow(10, fromAsset.asset.decimals)).toFixed(8)} {fromAsset.asset.name.split(":")[1]}
            </div>
          )}
        </div>

        {/* Quote panel */}
        {step === "quoting" && (
          <div className="quote-loading">
            <span className="spinner" /> Fetching best quote…
          </div>
        )}

        {quoteError && <div className="quote-error">{quoteError}</div>}

        {quote && step !== "quoting" && (
          <div className="quote-panel">
            <div className="quote-title">Quote</div>
            <div className="quote-row">
              <span className="quote-key">You send</span>
              <span className="quote-val">
                {quote.source.display} <span className="muted">(${Number(quote.source.value).toFixed(2)})</span>
              </span>
            </div>
            <div className="quote-row highlight">
              <span className="quote-key">You receive</span>
              <span className="quote-val green">
                {quote.destination.display} <span className="muted">(${Number(quote.destination.value).toFixed(2)})</span>
              </span>
            </div>
            <div className="quote-divider" />
            <div className="quote-row small">
              <span className="quote-key">Fee</span>
              <span className="quote-val">{(quote.fee / 100).toFixed(2)}%{quote.fixed_fee !== "0" && ` + ${quote.fixed_fee} fixed`}</span>
            </div>
            <div className="quote-row small">
              <span className="quote-key">Slippage</span>
              <span className="quote-val">{(quote.slippage / 100).toFixed(2)}%</span>
            </div>
            <div className="quote-row small">
              <span className="quote-key">Estimated time</span>
              <span className="quote-val">{quote.estimated_time < 60 ? `${quote.estimated_time}s` : `${Math.round(quote.estimated_time / 60)}min`}</span>
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="error-box">
            <span>⚠️ {error}</span>
            <button className="error-dismiss" onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {/* Action button */}
        {(step === "idle" || step === "quoted" || step === "error") && (
          <button
            className={`swap-btn ${!walletAddress ? "btn-secondary" : quote ? "btn-primary" : "btn-disabled"}`}
            onClick={!walletAddress ? handleConnect : handleSwap}
            disabled={!!walletAddress && (!quote || isLoading)}
          >
            {!walletAddress
              ? "Connect Wallet to Swap"
              : !fromAsset || !toAsset
              ? "Select Assets"
              : !amount || Number(amount) <= 0
              ? "Enter Amount"
              : !quote
              ? "Getting Quote…"
              : "Swap Now →"}
          </button>
        )}

        {isLoading && (
          <div className="loading-state">
            <span className="spinner large" />
            <span>{stepLabel[step]}</span>
          </div>
        )}
      </div>

      {/* Order status */}
      {(step === "tracking" || step === "done") && orderId && (
        <div className="order-section">
          {orderData && <OrderStatus order={orderData} />}

          {step === "tracking" && (
            <div className="polling-notice">
              <span className="spinner small" /> Polling for updates every 5s…
            </div>
          )}

          {step === "done" && (
            <div className="success-banner">
              🎉 Swap complete! Your funds have been redeemed.
            </div>
          )}

          <button className="new-swap-btn" onClick={resetSwap}>
            ← New Swap
          </button>
        </div>
      )}
    </div>
  );
}
