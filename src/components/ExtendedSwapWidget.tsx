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
import { fetchCowQuote, COW_TESTNET_TOKENS, CowToken, getCowSdk, getCowOrderStatus } from "@/lib/cowApi";
import { createWalletClient, createPublicClient, custom, parseEther } from "viem";
import { sepolia } from "viem/chains";
import { COW_PROTOCOL_VAULT_RELAYER_ADDRESS } from "@cowprotocol/cow-sdk";

type Step = 
  | "idle" 
  | "quoting" 
  | "quoted" 
  | "garden_creating" 
  | "garden_approving"
  | "garden_signing" 
  | "garden_initiating" 
  | "garden_tracking" 
  | "cow_switching_network"
  | "wrapping_eth"
  | "cow_quoting"
  | "cow_approving"
  | "cow_signing"
  | "cow_tracking"
  | "done" 
  | "error";

interface ChainAsset {
  chain: Chain;
  asset: Asset;
}

// ABI for WETH9
const WETH_ABI = [
  {
    "constant": false,
    "inputs": [],
    "name": "deposit",
    "outputs": [],
    "payable": true,
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      { "name": "guy", "type": "address" },
      { "name": "wad", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "name": "", "type": "bool" }],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

function GardenAssetSelector({
  label,
  chains,
  value,
  onChange,
}: {
  label: string;
  chains: Chain[];
  value: ChainAsset | null;
  onChange: (val: ChainAsset) => void;
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
      allOptions.push({ chain: c, asset: a });
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
          <span className="selector-placeholder">Select source…</span>
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

function CowAssetSelector({
  label,
  tokens,
  value,
  onChange,
  excludeSymbol
}: {
  label: string;
  tokens: CowToken[];
  value: CowToken | null;
  onChange: (val: CowToken) => void;
  excludeSymbol?: string;
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

  const filteredTokens = tokens.filter(t => t.symbol !== excludeSymbol && t.symbol !== "WETH");

  return (
    <div className="asset-selector" ref={ref}>
      <label className="selector-label">{label}</label>
      <button className="selector-btn" onClick={() => setOpen((o) => !o)}>
        {value ? (
          <span className="selector-value">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value.icon} alt="" className="asset-icon" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <span className="asset-name">{value.symbol}</span>
            <span className="chain-badge">Ethereum Sepolia (CoW)</span>
          </span>
        ) : (
          <span className="selector-placeholder">Select destination…</span>
        )}
        <span className="selector-arrow">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="selector-dropdown">
          {filteredTokens.map((token) => (
            <button
              key={token.address}
              className={`dropdown-item ${value?.address === token.address ? "dropdown-item-active" : ""}`}
              onClick={() => {
                onChange(token);
                setOpen(false);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={token.icon} alt="" className="asset-icon" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <span className="dropdown-asset-name">{token.symbol}</span>
              <span className="dropdown-chain">Ethereum Sepolia</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


export default function ExtendedSwapWidget() {
  const [chains, setChains] = useState<Chain[]>([]);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [showDisconnect, setShowDisconnect] = useState(false);
  
  const [fromAsset, setFromAsset] = useState<ChainAsset | null>(null);
  const [toAsset, setToAsset] = useState<CowToken | null>(null);
  const [amount, setAmount] = useState("");
  
  // Aggregate Quote state
  const [gardenQuote, setGardenQuote] = useState<QuoteResult | null>(null);
  const [cowQuoteData, setCowQuoteData] = useState<any | null>(null);
  
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  
  // order tracking
  const [gardenOrderId, setGardenOrderId] = useState<string | null>(null);
  const [gardenOrderData, setGardenOrderData] = useState<Order | null>(null);
  const [cowOrderId, setCowOrderId] = useState<string | null>(null);
  
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

  // Use refs to always have the latest state inside the async callback
  const walletAddressRef = useRef(walletAddress);
  const fromAssetRef = useRef(fromAsset);
  const toAssetRef = useRef(toAsset);
  const gardenQuoteRef = useRef(gardenQuote);
  const cowQuoteDataRef = useRef(cowQuoteData);
  const amountRef = useRef(amount);

  useEffect(() => { walletAddressRef.current = walletAddress; }, [walletAddress]);
  useEffect(() => { fromAssetRef.current = fromAsset; }, [fromAsset]);
  useEffect(() => { toAssetRef.current = toAsset; }, [toAsset]);
  useEffect(() => { gardenQuoteRef.current = gardenQuote; }, [gardenQuote]);
  useEffect(() => { cowQuoteDataRef.current = cowQuoteData; }, [cowQuoteData]);
  useEffect(() => { amountRef.current = amount; }, [amount]);

  // Aggregate Quoting logic
  useEffect(() => {
    if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);
    if (!fromAsset || !toAsset || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setGardenQuote(null);
      setCowQuoteData(null);
      setQuoteError(null);
      return;
    }
    
    quoteTimerRef.current = setTimeout(async () => {
      setQuoteError(null);
      setStep("quoting");
      try {
        // Step 1: Garden Quote for FromAsset -> Native ETH (ethereum_sepolia:eth)
        const ethAssetId = "ethereum_sepolia:eth";
        const gQuotes = await fetchQuote(fromAsset.asset.id, ethAssetId, amount);
        
        if (gQuotes.length === 0) throw new Error("No Garden routes available to Ethereum Sepolia ETH.");
        const bestGQuote = gQuotes[0];
        setGardenQuote(bestGQuote);

        // Step 2: CoW Quote for WETH -> ToAsset
        const wethToken = COW_TESTNET_TOKENS.find(t => t.symbol === "WETH");
        if (!wethToken) throw new Error("WETH not configured.");
        
        // Output from Garden is in ETH WEI. We will wrap it 1:1, so sellAmount is the destination.amount.
        const cowAmountInWei = bestGQuote.destination.amount; 
        
        const cowRes = await fetchCowQuote(
          wethToken.address, 
          toAsset.address, 
          cowAmountInWei, 
          wethToken.decimals, 
          toAsset.decimals
        );

        if (!cowRes || !cowRes.quoteResults || !cowRes.quoteResults.quoteResponse || !cowRes.quoteResults.quoteResponse.quote) {
            throw new Error("No liquidity found on CoW Protocol for this pair.");
        }

        setCowQuoteData(cowRes);
        setStep("quoted");

      } catch (e: unknown) {
        setGardenQuote(null);
        setCowQuoteData(null);
        setQuoteError(e instanceof Error ? e.message : "Quote failed.");
        setStep("idle");
      }
    }, 800);
  }, [fromAsset, toAsset, amount]);

  // Handle Dual-Swap Execution
  const handleDualSwap = useCallback(async () => {
    const addr = walletAddressRef.current;
    const from = fromAssetRef.current;
    const to = toAssetRef.current;
    const gQuote = gardenQuoteRef.current;
    const cQuoteData = cowQuoteDataRef.current;
    const initialAmount = amountRef.current;

    if (!addr) { setError("Please connect your wallet first."); return; }
    if (!from || !to) { setError("Please select both assets."); return; }
    if (!gQuote || !cQuoteData) { setError("Please wait for aggregate quote."); return; }

    setError(null);
    let currentGardenOrderId = "";

    try {
      /* =========================================================
         PHASE 1: GARDEN SWAP (Source -> ETH on Sepolia)
         ========================================================= */
      console.log(`[E2E] Starting Dual Swap from ${from.asset.id} to ${to.address}`);
      console.log(`[E2E] Source Amount: ${gQuote.source.amount}`);
      console.log(`[E2E] Expected Native ETH out of Garden: ${gQuote.destination.amount}`);
      
      setStep("garden_creating");
      const orderResult = await createOrder(
        from.asset.id,
        addr,
        gQuote.source.amount,
        "ethereum_sepolia:eth",
        addr,
        gQuote.destination.amount
      );
      currentGardenOrderId = orderResult.order_id;
      setGardenOrderId(currentGardenOrderId);

      const typedDataObj = orderResult.typed_data as { domain?: { chainId?: string | number } };
      const rawChainId = typedDataObj?.domain?.chainId;
      if (rawChainId !== undefined) {
        console.log(`[E2E] Garden Typed Data Chain ID: ${rawChainId}`);
        const chainIdNum = typeof rawChainId === "string" && rawChainId.startsWith("0x") ? parseInt(rawChainId, 16) : Number(rawChainId);
        if (!isNaN(chainIdNum)) await switchNetwork(chainIdNum);
      }
      
      if (orderResult.approval_transaction) {
        console.log("[E2E] Garden requires ERC-20 Approval before Initiate! Executing allowance…");
        setStep("garden_approving");
        const arbPublicClient = createPublicClient({ transport: custom(window.ethereum as any) });
        const fees = await arbPublicClient.estimateFeesPerGas();
        
        const walletClient = createWalletClient({
          chain: undefined,
          transport: custom(window.ethereum as any),
          account: addr as `0x${string}`,
        });

        const txHash = await walletClient.sendTransaction({
          chain: null, // Let MetaMask define the chain
          to: orderResult.approval_transaction.to as `0x${string}`,
          data: orderResult.approval_transaction.data as `0x${string}`,
          value: BigInt(orderResult.approval_transaction.value || "0"),
          maxFeePerGas: fees.maxFeePerGas ? (fees.maxFeePerGas * BigInt(2)) : undefined,
          maxPriorityFeePerGas: fees.maxPriorityFeePerGas ? (fees.maxPriorityFeePerGas * BigInt(2)) : undefined,
        });
        await arbPublicClient.waitForTransactionReceipt({ hash: txHash });
      }

      setStep("garden_signing");
      console.log("[E2E] Requesting EIP-712 Signature for Garden Swap…");
      const signature = await signTypedData(addr, orderResult.typed_data);

      setStep("garden_initiating");
      console.log(`[E2E] Initiating Garden Order (OrderID: ${currentGardenOrderId})…`);
      await initiateOrder(currentGardenOrderId, signature);

      setStep("garden_tracking");
      console.log("[E2E] Garden Swap Initiated. Polling for completion…");
      // Wait for Garden Swap to complete
      await new Promise<void>((resolve, reject) => {
        const localPoll = setInterval(async () => {
          try {
            const order = await getOrderStatus(currentGardenOrderId);
            setGardenOrderData(order);
            console.log(`[E2E] Garden Order Poll => Status: ${order.status?.status || order.destination_swap?.redeem_tx_hash ? 'Success' : 'Pending'}`);
            if (order.destination_swap?.redeem_tx_hash) {
              clearInterval(localPoll);
              resolve();
            } else if (order.status?.status === "Dead") {
              clearInterval(localPoll);
              reject(new Error("Garden swap failed."));
            }
          } catch (e) { /* ignore and retry */ }
        }, 5000);
      });

      /* =========================================================
         PHASE 2: ETH to WETH Wrapping (Sepolia)
         ========================================================= */
      console.log("[E2E] Phase 1 Complete. Initiating Network Switch to Sepolia for CoW Protocol (Phase 2)…");
      setStep("cow_switching_network");
      await switchNetwork(11155111); // Switch to Sepolia

      setStep("wrapping_eth");
      console.log("[E2E] Wrapping Native ETH to WETH for CoW…");
      const wethToken = COW_TESTNET_TOKENS.find(t => t.symbol === "WETH");
      if (!wethToken) throw new Error("WETH address not found");
      
      const sepPublicClient = createPublicClient({
        chain: sepolia,
        transport: custom(window.ethereum as any),
      });

      const sepWalletClient = createWalletClient({
        chain: sepolia,
        transport: custom(window.ethereum as any),
        account: addr as `0x${string}`,
      });

      // Wrap the exact amount of ETH we received from Garden
      const txHash = await sepWalletClient.writeContract({
        address: wethToken.address as `0x${string}`,
        abi: WETH_ABI,
        functionName: 'deposit',
        value: BigInt(gQuote.destination.amount),
        account: addr as `0x${string}`
      });
      console.log(`[E2E] \`deposit()\` txHash: ${txHash}. Waiting for block confirmation…`);
      await sepPublicClient.waitForTransactionReceipt({ hash: txHash });
      console.log("[E2E] WETH wrapped successfully!");

      /* =========================================================
         PHASE 3: COW PROTOCOL SWAP (WETH -> Final Token)
         ========================================================= */
      setStep("cow_quoting");
      console.log(`[E2E] Phase 2 (Wrap) believed complete. Re-quoting CoW Protocol Phase 3…`);
      // Re-quote immediately to get a fresh quote ID & validTo
      const cowRes = await fetchCowQuote(
        wethToken.address, 
        to.address, 
        gQuote.destination.amount, 
        wethToken.decimals, 
        to.decimals
      );
      console.log("[E2E] CoW Protocol Quote Refreshed:", cowRes.quoteResults);

      setStep("cow_approving");
      console.log("[E2E] Requesting WETH Allowance for Vault Relayer (CoW Protocol)…");
      const relayerAddress = COW_PROTOCOL_VAULT_RELAYER_ADDRESS[11155111] || COW_PROTOCOL_VAULT_RELAYER_ADDRESS[1];
      const approvalTx = await sepWalletClient.writeContract({
        address: wethToken.address as `0x${string}`,
        abi: WETH_ABI,
        functionName: 'approve',
        args: [relayerAddress as `0x${string}`, BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935")], // Max Uint256
        account: addr as `0x${string}`
      });
      console.log(`[E2E] WETH Approval Tx: ${approvalTx}. Waiting for block confirmation…`);
      await sepPublicClient.waitForTransactionReceipt({ hash: approvalTx });
      console.log("[E2E] Vault relayer approved successfully!");

      setStep("cow_signing");
      console.log("[E2E] Requesting EIP-712 Signature for CoW Swap Order…");
      const cowOrderRes = await cowRes.postSwapOrderFromQuote();
      setCowOrderId(cowOrderRes.orderId);
      console.log(`[E2E] CoW Protocol Order Submitted! OrderID: ${cowOrderRes.orderId}`);

      setStep("cow_tracking");
      console.log("[E2E] Polling CoW Protocol Order Status…");
      // Poll CoW order
      await new Promise<void>((resolve, reject) => {
        const localPoll = setInterval(async () => {
            try {
                const status = await getCowOrderStatus(cowOrderRes.orderId);
                if (status.status === "fulfilled") {
                    clearInterval(localPoll);
                    resolve();
                } else if (status.status === "cancelled" || status.status === "expired") {
                    clearInterval(localPoll);
                    reject(new Error(`CoW order ${status.status}`));
                }
            } catch (e) { /* ignore */ }
        }, 5000);
      });

      setStep("done");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Dual-swap failed.";
      console.error("[Extended Swap] error:", e);
      setError(msg);
      setStep(gardenQuoteRef.current && cowQuoteDataRef.current ? "quoted" : "idle");
    }
  }, []);

  const resetAll = () => {
    setStep(gardenQuote && cowQuoteData ? "quoted" : "idle");
    setGardenOrderId(null);
    setGardenOrderData(null);
    setCowOrderId(null);
    setError(null);
  };

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
    setGardenQuote(null);
    setCowQuoteData(null);
    setGardenOrderId(null);
    setCowOrderId(null);
    setError(null);
  };

  const evmChains = chains.filter((c) => c.id.startsWith("evm:"));
  const isLoading = step !== "idle" && step !== "quoted" && step !== "done" && step !== "error" && step !== "garden_tracking" && step !== "cow_tracking";

  const stepLabel: Record<string, string> = {
    quoting: "Fetching aggregated routes…",
    garden_creating: "Creating Garden order…",
    garden_approving: "Approving ERC20 token allowance…",
    garden_signing: "Sign in wallet (Garden)…",
    garden_initiating: "Initiating cross-chain swap…",
    cow_switching_network: "Switching to Sepolia…",
    wrapping_eth: "Wrapping ETH to WETH…",
    cow_quoting: "Refreshing CoW Quote…",
    cow_approving: "Approving WETH for CoW Vault Relayer…",
    cow_signing: "Sign in wallet (CoW)…",
  };

  const isTracking = step === "garden_tracking" || step === "cow_tracking";

  return (
    <div className="swap-container" style={{ minWidth: "500px" }}>
      {/* Header */}
      <div className="swap-header">
        <div className="logo-row">
          <div className="garden-logo" style={{ background: "linear-gradient(135deg, #FF6B6B, #5F27CD)", filter: "hue-rotate(45deg)" }}>🐮</div>
          <div>
            <h1 className="brand-title">Extended Routing</h1>
            <p className="brand-sub">Garden Cross-Chain + CoW Protocol</p>
          </div>
        </div>

        {/* Wallet button */}
        <div className="wallet-wrapper" ref={walletRef}>
          {walletAddress ? (
            <>
              <button className="wallet-btn wallet-connected" onClick={() => setShowDisconnect((v) => !v)}>
                <span className="wallet-dot" />
                {shortenAddress(walletAddress)}
                <span className="wallet-caret">{showDisconnect ? "▲" : "▼"}</span>
              </button>
              {showDisconnect && (
                <div className="wallet-dropdown">
                  <div className="wallet-full-addr">{walletAddress.slice(0, 20)}…{walletAddress.slice(-6)}</div>
                  <button className="disconnect-btn" onClick={handleDisconnect}>🔌 Disconnect</button>
                </div>
              )}
            </>
          ) : (
            <button className="wallet-btn" onClick={handleConnect}>Connect Wallet</button>
          )}
        </div>
      </div>

      <div className="widget-card">
        {/* Asset selectors */}
        <div className="assets-row" style={{ display: 'flex', gap: '10px' }}>
          <GardenAssetSelector
            label="From"
            chains={evmChains}
            value={fromAsset}
            onChange={setFromAsset}
          />
          <div className="route-arrow">➔</div>
          <CowAssetSelector
            label="Final Destination"
            tokens={COW_TESTNET_TOKENS}
            value={toAsset}
            onChange={setToAsset}
          />
        </div>

        {/* Amount input */}
        <div className="amount-section" style={{ marginTop: '20px' }}>
          <label className="amount-label">Source Amount</label>
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
              <button className="max-btn" onClick={() => setAmount(fromAsset.asset.max_amount)}>MAX</button>
            )}
          </div>
        </div>

        {step === "quoting" && (
          <div className="quote-loading" style={{ marginTop: '20px' }}>
            <span className="spinner" /> Fetching Cross-Chain + CoW routes…
          </div>
        )}

        {quoteError && <div className="quote-error" style={{ marginTop: '20px' }}>{quoteError}</div>}

        {/* Dual Quote Display */}
        {gardenQuote && cowQuoteData && cowQuoteData.quoteResults && cowQuoteData.quoteResults.quoteResponse?.quote && step !== "quoting" && (
          <div className="quote-panel" style={{ marginTop: '20px', background: 'rgba(255,255,255,0.03)' }}>
            <div className="quote-title">Aggregated Route</div>
            
            <div className="routing-path" style={{ margin: '15px 0', fontSize: '12px', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', padding: 0 }}>
                <span className="route-step">{fromAsset?.asset.name.split(":")[1]}<br/><small>{fromAsset?.chain.name}</small></span>
                <span>➔</span>
                <span className="route-step">ETH (Native)<br/><small>Ethereum Sepolia</small></span>
                <span>➔</span>
                <span className="route-step">WETH<br/><small>Ethereum Sepolia</small></span>
                <span>➔</span>
                <span className="route-step" style={{ color: '#fff' }}>{toAsset?.symbol}<br/><small>Ethereum Sepolia</small></span>
            </div>

            <div className="quote-divider" />
            
            <div className="quote-row">
              <span className="quote-key">You spend</span>
              <span className="quote-val">
                {gardenQuote.source.display} 
              </span>
            </div>
            
            <div className="quote-row highlight">
              <span className="quote-key">You receive (Estimated)</span>
              <span className="quote-val green">
                {/* Cow quote amount is returned as buyAmount in atoms. Convert explicitly here using decimals. */}
                {(Number(cowQuoteData.quoteResults.quoteResponse.quote.buyAmount) / Math.pow(10, toAsset!.decimals)).toFixed(4)} {toAsset?.symbol}
              </span>
            </div>
            
            <div className="quote-row small">
              <span className="quote-key">Garden Fee</span>
              <span className="quote-val">{(gardenQuote.fee / 100).toFixed(2)}%</span>
            </div>
            <div className="quote-row small">
              <span className="quote-key">CoW Est. Network Fee</span>
              <span className="quote-val">{(Number(cowQuoteData.quoteResults.quoteResponse.quote.feeAmount) / Math.pow(10, 18)).toFixed(6)} WETH</span>
            </div>
          </div>
        )}

        {error && (
          <div className="error-box" style={{ marginTop: '20px' }}>
            <span>⚠️ {error}</span>
            <button className="error-dismiss" onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {/* Action Button */}
        {!isTracking && step !== "done" && (
          <button
            className={`swap-btn ${(isLoading || !walletAddress || !gardenQuote) ? "btn-disabled" : "btn-primary"}`}
            onClick={!walletAddress ? handleConnect : handleDualSwap}
            disabled={!!walletAddress && (!gardenQuote || isLoading)}
            style={{ marginTop: '20px' }}
          >
            {!walletAddress
              ? "Connect Wallet"
              : !fromAsset || !toAsset
              ? "Select Assets"
              : !amount || Number(amount) <= 0
              ? "Enter Amount"
              : isLoading
              ? stepLabel[step]
              : "Initiate Extended Route →"}
          </button>
        )}

        {/* Live Tracking */}
        {isTracking && (
           <div className="tracking-timeline" style={{ marginTop: '20px', padding: '15px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px' }}>
                <div style={{ marginBottom: '10px', color: step === "garden_tracking" ? '#00d2ff' : '#4cd137', fontWeight: 600 }}>
                    {step === "garden_tracking" ? "Phase 1: Garden Cross-Chain Swap" : "Phase 3: CoW Protocol Order"}
                </div>
                {step === "garden_tracking" && gardenOrderData && (
                    <OrderStatus order={gardenOrderData} />
                )}
                {step === "cow_tracking" && (
                    <div className="order-status-card" style={{ fontSize: '13px' }}>
                        <div><strong>Order ID:</strong> {shortenAddress(cowOrderId || "")}</div>
                        <div style={{ color: "orange", marginTop: '5px' }}>Status: OPEN (waiting for solver)</div>
                    </div>
                )}
                <div className="polling-notice" style={{ marginTop: '10px' }}>
                    <span className="spinner small" /> Polling for status updates…
                </div>
           </div>
        )}

        {step === "done" && (
            <div className="success-banner" style={{ marginTop: '20px' }}>
              🎉 Dual-Swap complete! Tokens have been delivered to your wallet on Sepolia.
              <button className="new-swap-btn" onClick={resetAll} style={{ width: '100%', marginTop: '10px' }}>
                ← New Extended Swap
              </button>
            </div>
        )}

      </div>
    </div>
  );
}
