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
} from "@/lib/gardenMainnetApi";
import {
  connectWallet,
  getConnectedAccount,
  signTypedData,
  switchNetwork,
  shortenAddress,
} from "@/lib/wallet";
import {
  isUnisatInstalled,
  connectUnisatWallet,
  getConnectedUnisatAccount,
  sendBitcoinViaUnisat,
  shortenBtcAddress,
} from "@/lib/unisatWallet";
import {
  fetchCowMainnetQuote,
  getCowMainnetOrderStatus,
  COW_MAINNET_DEST_TOKENS,
  WETH_TESTNET,
  type CowMainnetToken,
} from "@/lib/cowMainnetApi";
import { createPublicClient, createWalletClient, custom } from "viem";
import { sepolia } from "viem/chains";
import { COW_PROTOCOL_VAULT_RELAYER_ADDRESS } from "@cowprotocol/cow-sdk";
import OrderStatus from "./OrderStatus";

// ─── WETH Deposit ABI ─────────────────────────────────────────────────────────
const WETH_ABI = [
  {
    "constant": false,
    "inputs": [],
    "name": "deposit",
    "outputs": [],
    "payable": true,
    "stateMutability": "payable",
    "type": "function"
  }
] as const;

// ─── ERC-20 approve ABI (minimal) ─────────────────────────────────────────────
const ERC20_APPROVE_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// ─── Step type ────────────────────────────────────────────────────────────────
type Step =
  | "idle"
  | "quoting"
  | "quoted"
  | "garden_creating"
  | "garden_approving"     // EVM source ERC-20 allowance (non-BTC paths)
  | "btc_sending"          // user sends BTC to HTLC via Unisat
  | "garden_signing"
  | "garden_initiating"
  | "garden_tracking"
  | "wrapping_eth"         // wrapping ETH to WETH for CoW
  | "cow_quoting"
  | "cow_approving"        // USDC allowance for CoW vault relayer
  | "cow_signing"
  | "cow_tracking"
  | "done"
  | "error";

interface ChainAsset {
  chain: Chain;
  asset: Asset;
}

// ─── BITCOIN ASSET CONSTANT ───────────────────────────────────────────────────
// Garden uses "bitcoin_testnet:btc" as the canonical ID for testnet BTC.
const BTC_ASSET_ID = "bitcoin_testnet:btc";

// ─── Asset Selectors ──────────────────────────────────────────────────────────

function GardenAssetSelector({
  label,
  chains,
  btcOption,   // whether to show a synthetic BTC row
  value,
  onChange,
}: {
  label: string;
  chains: Chain[];  // EVM chains from Garden API
  btcOption: boolean;
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

  // Synthetic BTC chain/asset for the dropdown
  const btcChainAsset: ChainAsset = {
    chain: { chain: "bitcoin_testnet", name: "Bitcoin Testnet", id: "bitcoin_testnet", icon: "https://garden.imgix.net/chain-images/bitcoin.svg", explorer_url: "https://mempool.space", assets: [] },
    asset: {
      id: "bitcoin_testnet:btc",
      name: "bitcoin_testnet:BTC",
      chain: "bitcoin_testnet",
      icon: "https://garden.imgix.net/token-images/wbtc.svg",
      decimals: 8,
      min_amount: "10000",   // 0.0001 BTC — will be overwritten by Garden API real values
      max_amount: "100000000",
      price: 0,
      htlc: null,
      token: null,
    },
  };

  const allOptions: ChainAsset[] = [];
  if (btcOption) allOptions.push(btcChainAsset);
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
              onClick={() => { onChange({ chain, asset }); setOpen(false); }}
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

function CowMainnetTokenSelector({
  label,
  tokens,
  value,
  onChange,
}: {
  label: string;
  tokens: CowMainnetToken[];
  value: CowMainnetToken | null;
  onChange: (val: CowMainnetToken) => void;
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

  return (
    <div className="asset-selector" ref={ref}>
      <label className="selector-label">{label}</label>
      <button className="selector-btn" onClick={() => setOpen((o) => !o)}>
        {value ? (
          <span className="selector-value">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value.icon} alt="" className="asset-icon" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <span className="asset-name">{value.symbol}</span>
            <span className="chain-badge">Ethereum</span>
          </span>
        ) : (
          <span className="selector-placeholder">Select destination…</span>
        )}
        <span className="selector-arrow">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="selector-dropdown">
          {tokens.map((token) => (
            <button
              key={token.address}
              className={`dropdown-item ${value?.address === token.address ? "dropdown-item-active" : ""}`}
              onClick={() => { onChange(token); setOpen(false); }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={token.icon} alt="" className="asset-icon" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <span className="dropdown-asset-name">{token.symbol}</span>
              <span className="dropdown-chain">Ethereum Sepolia (CoW)</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Widget ──────────────────────────────────────────────────────────────

export default function MainnetSwapWidget() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [chains, setChains] = useState<Chain[]>([]);

  // EVM wallet (MetaMask) — used for CoW & Ethereum txs
  const [evmAddress, setEvmAddress] = useState<string | null>(null);
  const [showEvmDisconnect, setShowEvmDisconnect] = useState(false);

  // Bitcoin wallet (Unisat) — used to send BTC to Garden HTLC
  const [btcAddress, setBtcAddress] = useState<string | null>(null);
  const [unisatAvailable, setUnisatAvailable] = useState(false);

  const [fromAsset, setFromAsset] = useState<ChainAsset | null>(null);
  const [toToken, setToToken] = useState<CowMainnetToken | null>(null);
  const [amount, setAmount] = useState("");

  const [gardenQuote, setGardenQuote] = useState<QuoteResult | null>(null);
  const [cowQuoteData, setCowQuoteData] = useState<any | null>(null);

  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [gardenOrderId, setGardenOrderId] = useState<string | null>(null);
  const [gardenOrderData, setGardenOrderData] = useState<Order | null>(null);
  const [cowOrderId, setCowOrderId] = useState<string | null>(null);
  const [htlcAddress, setHtlcAddress] = useState<string | null>(null);

  const quoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const walletRef = useRef<HTMLDivElement>(null);

  // ── Refs (stable refs into state for async callbacks) ─────────────────────
  const evmAddressRef = useRef(evmAddress);
  const btcAddressRef = useRef(btcAddress);
  const fromAssetRef = useRef(fromAsset);
  const toTokenRef = useRef(toToken);
  const gardenQuoteRef = useRef(gardenQuote);
  const cowQuoteDataRef = useRef(cowQuoteData);
  const amountRef = useRef(amount);

  useEffect(() => { evmAddressRef.current = evmAddress; }, [evmAddress]);
  useEffect(() => { btcAddressRef.current = btcAddress; }, [btcAddress]);
  useEffect(() => { fromAssetRef.current = fromAsset; }, [fromAsset]);
  useEffect(() => { toTokenRef.current = toToken; }, [toToken]);
  useEffect(() => { gardenQuoteRef.current = gardenQuote; }, [gardenQuote]);
  useEffect(() => { cowQuoteDataRef.current = cowQuoteData; }, [cowQuoteData]);
  useEffect(() => { amountRef.current = amount; }, [amount]);

  // ── Bootstrap + wallet event listeners ────────────────────────────────────
  useEffect(() => {
    fetchChains()
      .then((all) => {
        const evm = all.filter((c) => c.id.startsWith("evm:"));
        setChains(evm);
      })
      .catch(console.error);

    // Restore any already-connected wallets on mount
    getConnectedAccount().then((addr) => {
      if (addr) {
        console.log("[Mainnet Wallet] MetaMask already connected:", addr);
        setEvmAddress(addr);
      }
    });
    getConnectedUnisatAccount().then((addr) => {
      if (addr) {
        console.log("[Mainnet Wallet] Unisat already connected:", addr);
        setBtcAddress(addr);
      }
    });

    // Detect Unisat — it may inject slightly after page load
    const checkUnisat = () => setUnisatAvailable(isUnisatInstalled());
    checkUnisat();
    // Re-check after a tick in case the extension injects after React hydration
    const timer = setTimeout(checkUnisat, 500);

    // ── MetaMask: react to account changes from the extension UI ────────────
    const handleEvmAccountsChanged = (accounts: unknown) => {
      const list = accounts as string[];
      console.log("[Mainnet Wallet] MetaMask accountsChanged:", list);
      setEvmAddress(list.length > 0 ? list[0] : null);
      if (list.length === 0) setShowEvmDisconnect(false);
    };

    if (window.ethereum) {
      window.ethereum.on("accountsChanged", handleEvmAccountsChanged);
    }

    // ── Unisat: react to account changes from the extension UI ──────────────
    // window.unisat uses the same accountsChanged event name
    const handleBtcAccountsChanged = (accounts: unknown) => {
      const list = accounts as string[];
      console.log("[Mainnet Wallet] Unisat accountsChanged:", list);
      setBtcAddress(list.length > 0 ? list[0] : null);
    };

    if (isUnisatInstalled() && window.unisat) {
      // Unisat exposes .on() for events — attach listener
      (window.unisat as any).on("accountsChanged", handleBtcAccountsChanged);
    }

    return () => {
      clearTimeout(timer);
      if (window.ethereum) {
        // window.ethereum.removeListener is not in our narrow type — cast
        (window.ethereum as any).removeListener?.("accountsChanged", handleEvmAccountsChanged);
      }
      if (isUnisatInstalled() && window.unisat) {
        (window.unisat as any).removeListener?.("accountsChanged", handleBtcAccountsChanged);
      }
    };
  }, []);



  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (walletRef.current && !walletRef.current.contains(e.target as Node)) {
        setShowEvmDisconnect(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Quote Logic ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);
    if (!fromAsset || !toToken || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setGardenQuote(null);
      setCowQuoteData(null);
      setQuoteError(null);
      return;
    }

    quoteTimerRef.current = setTimeout(async () => {
      setQuoteError(null);
      setStep("quoting");

      console.group("[Mainnet Quote] Aggregate quoting started");
      console.log("  fromAsset :", fromAsset.asset.id, `(${fromAsset.asset.decimals} dec)`);
      console.log("  toToken   :", toToken.symbol, toToken.address, `(${toToken.decimals} dec)`);
      console.log("  amount    :", amount, `→ ${(Number(amount) / Math.pow(10, fromAsset.asset.decimals)).toFixed(8)} ${fromAsset.asset.name.split(":")[1]}`);
      console.groupEnd();

      try {
        // ── Step 1: Garden quote — fromAsset → ethereum:usdc ─────────────
        console.log(`[Mainnet Quote] Step 1: Garden quote ${fromAsset.asset.id} → ethereum:usdc, amount=${amount}`);
        // ── Step 1: Garden quote — source → Native ETH on Sepolia ──────
        const gQuotes = await fetchQuote(fromAsset.asset.id, "ethereum_sepolia:eth", amount);

        if (gQuotes.length === 0) throw new Error("No Garden routes available to ETH.");
        const bestGQuote = gQuotes[0];

        console.log("[Mainnet Quote] ✅ Garden quote received:", {
          sourceDisplay: bestGQuote.source.display,
          destDisplay: bestGQuote.destination.display,
          destAmountAtoms: bestGQuote.destination.amount,
          destAmountHuman: (Number(bestGQuote.destination.amount) / 1e18).toFixed(6) + " ETH",
          fee: (bestGQuote.fee / 100).toFixed(2) + "%",
          estimatedTime: bestGQuote.estimated_time + "s",
        });

        setGardenQuote(bestGQuote);

        // ── Step 2: CoW quote — WETH → destination token ─────────────────
        console.log(
          `[Mainnet Quote] Step 2: CoW quote WETH → ${toToken.symbol}`,
          `\n  sellAmount (atoms) : ${bestGQuote.destination.amount}`,
          `\n  sellAmount (human) : ${(Number(bestGQuote.destination.amount) / 1e18).toFixed(6)} WETH`,
          `\n  buyToken address   : ${toToken.address}`
        );

        const cowRes = await fetchCowMainnetQuote(
          WETH_TESTNET.address,
          toToken.address,
          bestGQuote.destination.amount,   // WETH atoms (18 dec)
          WETH_TESTNET.decimals,
          toToken.decimals
        );

        if (!cowRes?.quoteResults?.quoteResponse?.quote) {
          console.error("[Mainnet Quote] ❌ CoW response missing quote field:", cowRes);
          throw new Error("No CoW Protocol liquidity found for this pair.");
        }

        const cowQ = cowRes.quoteResults.quoteResponse.quote;
        console.log("[Mainnet Quote] ✅ CoW quote received:", {
          sellAmount: cowQ.sellAmount,
          buyAmount: cowQ.buyAmount,
          buyAmountHuman: (Number(cowQ.buyAmount) / Math.pow(10, toToken.decimals)).toFixed(6) + " " + toToken.symbol,
          feeAmount: cowQ.feeAmount,
          validTo: new Date((cowQ.validTo ?? 0) * 1000).toISOString(),
        });

        setCowQuoteData(cowRes);
        setStep("quoted");
        console.log("[Mainnet Quote] ✅ Aggregate quote complete — ready to swap");

      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Quote failed.";
        console.error("[Mainnet Quote] ❌ Failed:", msg, e);
        setGardenQuote(null);
        setCowQuoteData(null);
        setQuoteError(msg);
        setStep("idle");
      }
    }, 800);
  }, [fromAsset, toToken, amount]);


  // ── Dual-Swap Execution ────────────────────────────────────────────────────
  const handleDualSwap = useCallback(async () => {
    const evmAddr = evmAddressRef.current;
    const btcAddr = btcAddressRef.current;
    const from = fromAssetRef.current;
    const to = toTokenRef.current;
    const gQuote = gardenQuoteRef.current;
    const cQuoteData = cowQuoteDataRef.current;
    const isBtcSource = from?.asset.id === BTC_ASSET_ID;

    if (!evmAddr) { setError("Please connect MetaMask first."); return; }
    if (isBtcSource && !btcAddr) { setError("Please connect your Bitcoin (Unisat) wallet to send BTC."); return; }
    if (!from || !to) { setError("Please select both assets."); return; }
    if (!gQuote || !cQuoteData) { setError("Please wait for aggregate quote."); return; }

    setError(null);
    let currentGardenOrderId = "";

    try {
      /* =====================================================================
         PHASE 1: GARDEN SWAP  (Source → ETH on Ethereum Sepolia)
         ===================================================================== */
      console.log(`[Mainnet] Starting: ${from.asset.id} → ${to.symbol} via WETH pivot`);

      setStep("garden_creating");
      // For BTC source, sourceOwner is the Bitcoin address.
      // destOwner is the EVM address that will receive ETH.
      const sourceOwner = isBtcSource ? btcAddr! : evmAddr;
      const orderResult = await createOrder(
        from.asset.id,
        sourceOwner,
        gQuote.source.amount,
        "ethereum_sepolia:eth",
        evmAddr,                        // EVM address receives ETH
        gQuote.destination.amount
      );
      currentGardenOrderId = orderResult.order_id;
      setGardenOrderId(currentGardenOrderId);
      console.log(`[Mainnet] Garden Order created: ${currentGardenOrderId}`);

      // ── EVM source: handle optional ERC-20 approval ─────────────────────
      if (!isBtcSource && orderResult.approval_transaction) {
        console.log("[Mainnet] ERC-20 approval required before Garden initiate");
        setStep("garden_approving");

        const pubClient = createPublicClient({ chain: sepolia, transport: custom(window.ethereum as any) });
        const wClient = createWalletClient({ chain: sepolia, transport: custom(window.ethereum as any), account: evmAddr as `0x${string}` });
        const fees = await pubClient.estimateFeesPerGas();

        const txHash = await wClient.sendTransaction({
          chain: null,
          to: orderResult.approval_transaction.to as `0x${string}`,
          data: orderResult.approval_transaction.data as `0x${string}`,
          value: BigInt(orderResult.approval_transaction.value || "0"),
          maxFeePerGas: fees.maxFeePerGas ? fees.maxFeePerGas * BigInt(2) : undefined,
          maxPriorityFeePerGas: fees.maxPriorityFeePerGas ? fees.maxPriorityFeePerGas * BigInt(2) : undefined,
        });
        await pubClient.waitForTransactionReceipt({ hash: txHash });
        console.log("[Mainnet] ERC-20 approval confirmed");
      }

      // ── BTC source: send BTC to Garden's HTLC address via Unisat ─────────
      if (isBtcSource) {
        // Log the full order result to diagnose which field Garden uses
        console.log("[Mainnet] Full orderResult for BTC source:", JSON.stringify(orderResult, null, 2));

        // Garden may return HTLC info under several different field names depending on API version
        // Try the official V2 format first (root `to` and `amount` fields)
        let htlcTo: string | undefined;
        let htlcSats: number | undefined;

        if (orderResult.to && orderResult.amount) {
          htlcTo = orderResult.to;
          htlcSats = parseInt(orderResult.amount, 10);
          console.log("[Mainnet] HTLC from root (V2 API):", htlcTo, htlcSats);
        } else if (orderResult.initiate_transaction?.to) {
          htlcTo = orderResult.initiate_transaction.to;
          htlcSats = parseInt(orderResult.initiate_transaction.value, 10);
          console.log("[Mainnet] HTLC from initiate_transaction:", htlcTo, htlcSats);
        } else if ((orderResult as any).initiate_tx?.to) {
          htlcTo = (orderResult as any).initiate_tx.to;
          htlcSats = parseInt((orderResult as any).initiate_tx.value, 10);
          console.log("[Mainnet] HTLC from initiate_tx:", htlcTo, htlcSats);
        } else if ((orderResult as any).source_htlc?.address) {
          htlcTo = (orderResult as any).source_htlc.address;
          htlcSats = parseInt((orderResult as any).source_htlc.amount, 10);
          console.log("[Mainnet] HTLC from source_htlc:", htlcTo, htlcSats);
        } else if ((orderResult as any).htlc_address) {
          htlcTo = (orderResult as any).htlc_address;
          htlcSats = parseInt(gQuote.source.amount, 10);
          console.log("[Mainnet] HTLC from htlc_address:", htlcTo, htlcSats);
        } else {
          // Last resort: poll the order status immediately — Garden sometimes
          // only exposes the HTLC via the order's source_swap.htlc_address
          console.warn("[Mainnet] No HTLC found in createOrder response — fetching order status for HTLC address");
          const statusCheck = await getOrderStatus(currentGardenOrderId);
          console.log("[Mainnet] Order status (HTLC lookup):", JSON.stringify(statusCheck, null, 2));
          htlcTo = (statusCheck.source_swap as any)?.htlc_address
            ?? (statusCheck as any)?.htlc_address;
          htlcSats = parseInt(gQuote.source.amount, 10);
        }

        if (!htlcTo) {
          throw new Error(
            "Garden did not return a BTC HTLC address in the order response. " +
            "Check the console for the full orderResult shape and update the field mapping."
          );
        }

        setHtlcAddress(htlcTo);
        console.log(`[Mainnet] ✅ BTC HTLC resolved — address: ${htlcTo}, satoshis: ${htlcSats}`);

        setStep("btc_sending");
        const btcTxid = await sendBitcoinViaUnisat(htlcTo, htlcSats!);
        console.log(`[Mainnet] ✅ BTC sent via Unisat! txid: ${btcTxid}`);
      }

      // ── Sign & initiate the Garden order (EVM source only) ───────────────
      // For BTC source orders, typed_data is null — Garden detects the BTC
      // on-chain transaction automatically. No EIP-712 signing needed.
      if (orderResult.typed_data) {
        setStep("garden_signing");
        console.log("[Mainnet] typed_data present — signing with MetaMask (EVM source order)");
        const typedDataObj = orderResult.typed_data as { domain?: { chainId?: string | number } };
        const rawChainId = typedDataObj?.domain?.chainId;
        if (rawChainId !== undefined) {
          const chainIdNum = typeof rawChainId === "string" && rawChainId.startsWith("0x")
            ? parseInt(rawChainId, 16)
            : Number(rawChainId);
          if (!isNaN(chainIdNum)) {
            console.log(`[Mainnet] Switching to chainId ${chainIdNum} before signing`);
            await switchNetwork(chainIdNum);
          }
        }
        const signature = await signTypedData(evmAddr, orderResult.typed_data);

        setStep("garden_initiating");
        console.log(`[Mainnet] Calling initiateOrder with signature`);
        await initiateOrder(currentGardenOrderId, signature);
        console.log("[Mainnet] Garden order initiated via EIP-712");
      } else {
        // BTC source — the Unisat sendBitcoin() call above IS the initiation.
        // Garden's backend watches for the on-chain BTC deposit to the HTLC.
        console.log("[Mainnet] typed_data is null (BTC source) — skipping EIP-712 signing. Garden will detect BTC deposit on-chain.");
      }

      setStep("garden_tracking");
      // Poll Garden until USDC is redeemed on Ethereum
      await new Promise<void>((resolve, reject) => {
        const poll = setInterval(async () => {
          try {
            const order = await getOrderStatus(currentGardenOrderId);
            setGardenOrderData(order);
            if (order.destination_swap?.redeem_tx_hash) { clearInterval(poll); resolve(); }
            else if (order.status?.status === "Dead") { clearInterval(poll); reject(new Error("Garden swap failed or expired.")); }
          } catch { /* retry */ }
        }, 5000);
      });

      console.log("[Mainnet] Garden complete — ETH received. Proceeding to WETH wrapping…");

      /* =====================================================================
         PHASE 1.5: WRAP ETH TO WETH
         ===================================================================== */
      setStep("wrapping_eth");
      await switchNetwork(11155111); // Ensure we're on Sepolia

      const sepPub = createPublicClient({ chain: sepolia, transport: custom(window.ethereum as any) });
      const sepWallet = createWalletClient({ chain: sepolia, transport: custom(window.ethereum as any), account: evmAddr as `0x${string}` });

      console.log("[Mainnet] Wrapping Native ETH to WETH for CoW…");
      const wrapTxHash = await sepWallet.writeContract({
        address: WETH_TESTNET.address as `0x${string}`,
        abi: WETH_ABI,
        functionName: "deposit",
        value: BigInt(gQuote.destination.amount),
        account: evmAddr as `0x${string}`,
      });
      console.log(`[Mainnet] \`deposit()\` wrap txHash: ${wrapTxHash}. Waiting for confirmation...`);
      await sepPub.waitForTransactionReceipt({ hash: wrapTxHash });
      console.log("[Mainnet] WETH wrapped successfully!");

      /* =====================================================================
         PHASE 2: COW PROTOCOL SWAP (WETH → Destination ERC-20 on Testnet)
         ===================================================================== */
      setStep("cow_quoting");

      const cowRes = await fetchCowMainnetQuote(
        WETH_TESTNET.address,
        to.address,
        gQuote.destination.amount,
        WETH_TESTNET.decimals,
        to.decimals
      );
      console.log("[Mainnet] CoW testnet quote refreshed");

      // Approve WETH to CoW Vault Relayer
      setStep("cow_approving");
      const relayerAddress = COW_PROTOCOL_VAULT_RELAYER_ADDRESS[11155111] || COW_PROTOCOL_VAULT_RELAYER_ADDRESS[100];

      const approvalTx = await sepWallet.writeContract({
        address: WETH_TESTNET.address as `0x${string}`,
        abi: ERC20_APPROVE_ABI,
        functionName: "approve",
        args: [
          relayerAddress as `0x${string}`,
          BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935"),
        ],
        account: evmAddr as `0x${string}`,
      });
      await sepPub.waitForTransactionReceipt({ hash: approvalTx });
      console.log("[Mainnet] WETH approved to CoW Vault Relayer");

      // Submit CoW order
      setStep("cow_signing");
      const cowOrderRes = await cowRes.postSwapOrderFromQuote();
      setCowOrderId(cowOrderRes.orderId);
      console.log(`[Mainnet] CoW order submitted: ${cowOrderRes.orderId}`);

      // Poll CoW until fulfilled
      setStep("cow_tracking");
      await new Promise<void>((resolve, reject) => {
        const poll = setInterval(async () => {
          try {
            const status = await getCowMainnetOrderStatus(cowOrderRes.orderId);
            if (status.status === "fulfilled") { clearInterval(poll); resolve(); }
            else if (status.status === "cancelled" || status.status === "expired") {
              clearInterval(poll);
              reject(new Error(`CoW order ${status.status}`));
            }
          } catch { /* retry */ }
        }, 5000);
      });

      setStep("done");
      console.log("[Mainnet] Dual swap complete! 🎉");

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Dual-swap failed.";
      console.error("[Mainnet Swap] error:", e);
      setError(msg);
      setStep(gardenQuoteRef.current && cowQuoteDataRef.current ? "quoted" : "idle");
    }
  }, []);

  // ── Wallet helpers ─────────────────────────────────────────────────────────
  const handleConnectEvm = async () => {
    try { setEvmAddress(await connectWallet()); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "MetaMask connection failed."); }
  };

  const handleConnectBtc = async () => {
    try { setBtcAddress(await connectUnisatWallet()); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Unisat connection failed."); }
  };

  const handleDisconnectEvm = () => {
    setEvmAddress(null);
    setShowEvmDisconnect(false);
    resetAll();
  };

  const resetAll = () => {
    setStep(gardenQuote && cowQuoteData ? "quoted" : "idle");
    setGardenOrderId(null);
    setGardenOrderData(null);
    setCowOrderId(null);
    setHtlcAddress(null);
    setError(null);
  };

  // ── Derived UI state ───────────────────────────────────────────────────────
  const isBtcSource = fromAsset?.asset.id === BTC_ASSET_ID;
  const isTracking = step === "garden_tracking" || step === "cow_tracking" || step === "wrapping_eth";
  const isLoading = step !== "idle" && step !== "quoted" && step !== "done" && step !== "error" && !isTracking;

  const stepLabel: Record<string, string> = {
    quoting: "Fetching routes…",
    garden_creating: "Creating Garden order…",
    garden_approving: "Approving ERC-20 allowance…",
    btc_sending: "Sending BTC via Unisat…",
    garden_signing: "Sign in MetaMask (Garden)…",
    garden_initiating: "Initiating cross-chain swap…",
    cow_quoting: "Refreshing CoW quote…",
    cow_approving: "Approving USDC for CoW…",
    cow_signing: "Sign in MetaMask (CoW)…",
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="swap-container" style={{ minWidth: "520px" }}>

      {/* Header */}
      <div className="swap-header">
        <div className="logo-row">
          <div className="garden-logo" style={{ background: "linear-gradient(135deg, #f7931a, #627eea)", fontSize: "22px" }}>₿</div>
          <div>
            <h1 className="brand-title">Mainnet BTC → ERC-20</h1>
            <p className="brand-sub">Garden (Bitcoin) + CoW Protocol (Ethereum)</p>
          </div>
        </div>

        {/* Wallet row */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-end" }}>

          {/* MetaMask */}
          <div className="wallet-wrapper" ref={walletRef}>
            {evmAddress ? (
              <>
                <button
                  className="wallet-btn wallet-connected"
                  onClick={() => setShowEvmDisconnect((v) => !v)}
                  style={{ fontSize: "12px" }}
                >
                  <span className="wallet-dot" style={{ background: "#627eea" }} />
                  ETH: {shortenAddress(evmAddress)}
                  <span className="wallet-caret">{showEvmDisconnect ? "▲" : "▼"}</span>
                </button>
                {showEvmDisconnect && (
                  <div className="wallet-dropdown">
                    <div className="wallet-full-addr">{evmAddress.slice(0, 20)}…{evmAddress.slice(-6)}</div>
                    <button className="disconnect-btn" onClick={handleDisconnectEvm}>🔌 Disconnect MetaMask</button>
                  </div>
                )}
              </>
            ) : (
              <button className="wallet-btn" onClick={handleConnectEvm} style={{ fontSize: "12px" }}>
                Connect MetaMask
              </button>
            )}
          </div>

          {/* Unisat */}
          {btcAddress ? (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
              <span className="wallet-dot" style={{ background: "#f7931a" }} />
              <span style={{ color: "#f7931a", fontWeight: 600 }}>BTC: {shortenBtcAddress(btcAddress)}</span>
              <button
                onClick={() => setBtcAddress(null)}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "10px" }}
                title="Disconnect Bitcoin wallet"
              >✕</button>
            </div>
          ) : (
            <button
              className="wallet-btn"
              onClick={handleConnectBtc}
              style={{ fontSize: "12px", background: unisatAvailable ? "rgba(247,147,26,0.15)" : "rgba(255,255,255,0.05)", borderColor: unisatAvailable ? "rgba(247,147,26,0.4)" : "rgba(255,255,255,0.1)" }}
            >
              {unisatAvailable ? "🟠 Connect Bitcoin (Unisat)" : "Install Unisat for BTC"}
            </button>
          )}
        </div>
      </div>

      {/* Main card */}
      <div className="widget-card">

        {/* Asset Selectors */}
        <div className="assets-row" style={{ display: "flex", gap: "10px" }}>
          <GardenAssetSelector
            label="From"
            chains={chains}
            btcOption={true}
            value={fromAsset}
            onChange={setFromAsset}
          />
          <div className="route-arrow">➔</div>
          <CowMainnetTokenSelector
            label="Final Destination"
            tokens={COW_MAINNET_DEST_TOKENS}
            value={toToken}
            onChange={setToToken}
          />
        </div>

        {/* BTC wallet reminder */}
        {isBtcSource && !btcAddress && (
          <div style={{ marginTop: "14px", padding: "10px 14px", background: "rgba(247,147,26,0.1)", borderRadius: "10px", border: "1px solid rgba(247,147,26,0.3)", fontSize: "12px", color: "#f7931a" }}>
            ⚠️ Connect your Bitcoin (Unisat) wallet to enable BTC source swaps.
          </div>
        )}

        {/* Amount input */}
        <div className="amount-section" style={{ marginTop: "20px" }}>
          <label className="amount-label">
            {isBtcSource ? "Amount (satoshis)" : "Amount (atomic units)"}
          </label>
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
          {fromAsset && amount && !isNaN(Number(amount)) && Number(amount) > 0 && (
            <div className="amount-hint">
              ≈ {(Number(amount) / Math.pow(10, fromAsset.asset.decimals)).toFixed(8)} {fromAsset.asset.name.split(":")[1]}
            </div>
          )}
        </div>

        {/* Quote loading */}
        {step === "quoting" && (
          <div className="quote-loading" style={{ marginTop: "20px" }}>
            <span className="spinner" /> Fetching Garden + CoW mainnet routes…
          </div>
        )}

        {quoteError && <div className="quote-error" style={{ marginTop: "20px" }}>{quoteError}</div>}

        {/* Aggregated Quote Panel */}
        {gardenQuote && cowQuoteData?.quoteResults?.quoteResponse?.quote && step !== "quoting" && (
          <div className="quote-panel" style={{ marginTop: "20px", background: "rgba(255,255,255,0.03)" }}>
            <div className="quote-title">Aggregated Route</div>

            {/* Route path visualisation */}
            <div style={{ margin: "15px 0", fontSize: "12px", color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span className="route-step">
                {fromAsset?.asset.name.split(":")[1]}<br />
                <small>{fromAsset?.chain.name}</small>
              </span>
              <span>➔</span>
              <span className="route-step">
                ETH (Native)<br /><small>Ethereum</small>
              </span>
              <span>➔</span>
              <span className="route-step">
                WETH<br /><small>Ethereum</small>
              </span>
              <span>➔</span>
              <span className="route-step" style={{ color: "#fff" }}>
                {toToken?.symbol}<br /><small>Ethereum</small>
              </span>
            </div>

            <div className="quote-divider" />

            <div className="quote-row">
              <span className="quote-key">You spend</span>
              <span className="quote-val">{gardenQuote.source.display}</span>
            </div>
            <div className="quote-row">
              <span className="quote-key">Intermediate (ETH → WETH)</span>
              <span className="quote-val" style={{ color: "#aaa" }}>
                {(Number(gardenQuote.destination.amount) / 1e18).toFixed(4)} ETH
              </span>
            </div>
            <div className="quote-row highlight">
              <span className="quote-key">You receive (est.)</span>
              <span className="quote-val green">
                {(Number(cowQuoteData.quoteResults.quoteResponse.quote.buyAmount) / Math.pow(10, toToken!.decimals)).toFixed(6)} {toToken?.symbol}
              </span>
            </div>
            <div className="quote-divider" />
            <div className="quote-row small">
              <span className="quote-key">Garden Fee</span>
              <span className="quote-val">{(gardenQuote.fee / 100).toFixed(2)}%{gardenQuote.fixed_fee !== "0" && ` + ${gardenQuote.fixed_fee} fixed`}</span>
            </div>
            <div className="quote-row small">
              <span className="quote-key">CoW Est. Network Fee</span>
              <span className="quote-val">{(Number(cowQuoteData.quoteResults.quoteResponse.quote.feeAmount) / 1e18).toFixed(6)} WETH</span>
            </div>
            <div className="quote-row small">
              <span className="quote-key">Est. time</span>
              <span className="quote-val">{gardenQuote.estimated_time < 60 ? `${gardenQuote.estimated_time}s` : `${Math.round(gardenQuote.estimated_time / 60)}min`} + CoW settlement</span>
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="error-box" style={{ marginTop: "20px" }}>
            <span>⚠️ {error}</span>
            <button className="error-dismiss" onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {/* Action button */}
        {!isTracking && step !== "done" && (
          <button
            className={`swap-btn ${isLoading || !evmAddress || !gardenQuote ? "btn-disabled" : "btn-primary"}`}
            onClick={!evmAddress ? handleConnectEvm : handleDualSwap}
            disabled={!!evmAddress && (!gardenQuote || isLoading)}
            style={{ marginTop: "20px" }}
          >
            {!evmAddress
              ? "Connect MetaMask"
              : !fromAsset || !toToken
              ? "Select Assets"
              : !amount || Number(amount) <= 0
              ? "Enter Amount"
              : isLoading
              ? stepLabel[step] || "Processing…"
              : "Swap Now (Mainnet) →"}
          </button>
        )}

        {/* HTLC address display (BTC send) */}
        {htlcAddress && step === "btc_sending" && (
          <div style={{ marginTop: "14px", padding: "12px 14px", background: "rgba(247,147,26,0.1)", borderRadius: "10px", border: "1px solid rgba(247,147,26,0.4)", fontSize: "12px" }}>
            <div style={{ color: "#f7931a", fontWeight: 600, marginBottom: "6px" }}>₿ Sending BTC via Unisat…</div>
            <div style={{ color: "rgba(255,255,255,0.6)" }}>HTLC Address: <span style={{ fontFamily: "monospace", color: "#fff" }}>{htlcAddress}</span></div>
          </div>
        )}

        {/* Live tracking timeline */}
        {isTracking && (
          <div className="tracking-timeline" style={{ marginTop: "20px", padding: "15px", background: "rgba(0,0,0,0.3)", borderRadius: "12px" }}>
            <div style={{ marginBottom: "10px", color: step === "garden_tracking" || step === "wrapping_eth" ? "#f7931a" : "#4cd137", fontWeight: 600 }}>
              {step === "garden_tracking" ? "Phase 1: Garden Cross-Chain (→ ETH)" : step === "wrapping_eth" ? "Phase 1.5: Wrapping ETH to WETH" : "Phase 2: CoW Protocol (WETH → " + toToken?.symbol + ")"}
            </div>

            {step === "garden_tracking" && gardenOrderData && (
              <OrderStatus order={gardenOrderData} />
            )}

            {step === "cow_tracking" && (
              <div className="order-status-card" style={{ fontSize: "13px" }}>
                <div><strong>CoW Order ID:</strong> {cowOrderId ? (cowOrderId.slice(0, 16) + "…") : "-"}</div>
                <div style={{ color: "orange", marginTop: "5px" }}>Status: OPEN — waiting for CoW solver…</div>
              </div>
            )}

            <div className="polling-notice" style={{ marginTop: "10px" }}>
              <span className="spinner small" /> Polling for updates…
            </div>
          </div>
        )}

        {/* Done */}
        {step === "done" && (
          <div className="success-banner" style={{ marginTop: "20px" }}>
            🎉 Swap complete! {toToken?.symbol} delivered to your Ethereum wallet.
            <button className="new-swap-btn" onClick={resetAll} style={{ width: "100%", marginTop: "10px" }}>
              ← New Mainnet Swap
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
