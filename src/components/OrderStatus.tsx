"use client";

import { useState, useCallback } from "react";
import type { Order, SwapStatus } from "@/lib/gardenApi";

interface OrderStatusProps {
  order: Order;
  explorerBaseUrl?: string;
}

function SwapStatusCard({
  label,
  swap,
  explorerUrl,
}: {
  label: string;
  swap: SwapStatus;
  explorerUrl?: string;
}) {
  const isDone = !!swap.redeem_tx_hash;
  const isInitiated = !!swap.initiate_tx_hash;

  return (
    <div className="status-card">
      <div className="status-card-header">
        <span className="status-label">{label}</span>
        <span className={`status-badge ${isDone ? "badge-done" : isInitiated ? "badge-active" : "badge-pending"}`}>
          {isDone ? "✓ Redeemed" : isInitiated ? "⏳ Initiated" : "⌛ Waiting"}
        </span>
      </div>
      <div className="status-asset">{swap.asset}</div>
      <div className="status-amount">
        {swap.amount} <span className="muted">atomic units</span>
      </div>

      {swap.initiate_tx_hash && (
        <div className="tx-row">
          <span className="tx-label">Initiate Tx</span>
          {explorerUrl ? (
            <a
              href={`${explorerUrl}/tx/${swap.initiate_tx_hash.replace(/:.*/, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="tx-link"
            >
              {swap.initiate_tx_hash.slice(0, 10)}…{swap.initiate_tx_hash.slice(-6)}
            </a>
          ) : (
            <span className="tx-hash">
              {swap.initiate_tx_hash.slice(0, 10)}…{swap.initiate_tx_hash.slice(-6)}
            </span>
          )}
        </div>
      )}

      {swap.redeem_tx_hash && (
        <div className="tx-row">
          <span className="tx-label">Redeem Tx</span>
          {explorerUrl ? (
            <a
              href={`${explorerUrl}/tx/${swap.redeem_tx_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="tx-link"
            >
              {swap.redeem_tx_hash.slice(0, 10)}…{swap.redeem_tx_hash.slice(-6)}
            </a>
          ) : (
            <span className="tx-hash">
              {swap.redeem_tx_hash.slice(0, 10)}…{swap.redeem_tx_hash.slice(-6)}
            </span>
          )}
        </div>
      )}

      <div className="confirmations">
        Confirmations: {swap.current_confirmations}/{Math.max(swap.required_confirmations, 1)}
        <div className="conf-bar">
          <div
            className="conf-fill"
            style={{
              width: `${Math.min(100, (swap.current_confirmations / Math.max(swap.required_confirmations, 1)) * 100)}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function OrderStatus({ order, explorerBaseUrl }: OrderStatusProps) {
  const [copied, setCopied] = useState(false);

  const copyOrderId = useCallback(() => {
    navigator.clipboard.writeText(order.order_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [order.order_id]);

  const isComplete = !!order.destination_swap?.redeem_tx_hash;

  return (
    <div className="order-status-panel">
      <div className="order-header">
        <div className="order-title-row">
          <span className="order-title">Order Status</span>
          {isComplete && (
            <span className="complete-badge">🎉 Complete</span>
          )}
        </div>
        <div className="order-id-row" onClick={copyOrderId} title="Click to copy">
          <span className="order-id-label">Order ID</span>
          <span className="order-id-value">
            {order.order_id.slice(0, 12)}…{order.order_id.slice(-8)}
          </span>
          <span className="copy-icon">{copied ? "✓" : "⎘"}</span>
        </div>
        <div className="order-meta">
          <span>Created: {new Date(order.created_at).toLocaleString()}</span>
          <span>Version: {order.version}</span>
        </div>
      </div>

      <div className="swaps-grid">
        <SwapStatusCard label="Source (You Send)" swap={order.source_swap} explorerUrl={explorerBaseUrl} />
        <div className="swap-arrow">→</div>
        <SwapStatusCard label="Destination (You Receive)" swap={order.destination_swap} explorerUrl={explorerBaseUrl} />
      </div>
    </div>
  );
}
