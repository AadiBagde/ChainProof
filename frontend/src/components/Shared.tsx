import { Copy, Check } from 'lucide-react';
import { useState, useCallback } from 'react';
import './shared.css';

/* ─── StatusBadge ───────────────────────────────────────────────── */
interface StatusBadgeProps {
  variant: 'success' | 'warning' | 'error' | 'neutral' | 'info';
  children: React.ReactNode;
}
export function StatusBadge({ variant, children }: StatusBadgeProps) {
  return <span className={`cp-badge cp-badge--${variant}`}>{children}</span>;
}

/* ─── CopyButton ────────────────────────────────────────────────── */
interface CopyButtonProps {
  text: string;
  label?: string;
}
export function CopyButton({ text, label = 'Copy' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);
  return (
    <button
      className="cp-copy-btn"
      onClick={handleCopy}
      title={copied ? 'Copied!' : label}
      aria-label={copied ? 'Copied' : label}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

/* ─── HashDisplay ───────────────────────────────────────────────── */
interface HashDisplayProps {
  hash: string;
  label?: string;
  truncate?: boolean;
}
export function HashDisplay({ hash, label, truncate = true }: HashDisplayProps) {
  const display = truncate && hash.length > 16
    ? `${hash.slice(0, 10)}…${hash.slice(-8)}`
    : hash;
  return (
    <span className="cp-hash-display">
      {label && <span className="cp-hash-display__label">{label}</span>}
      <code className="cp-hash-display__value" title={hash}>{display}</code>
      <CopyButton text={hash} label={`Copy ${label || 'hash'}`} />
    </span>
  );
}

/* ─── AddressDisplay ────────────────────────────────────────────── */
interface AddressDisplayProps {
  address: string;
  label?: string;
}
export function AddressDisplay({ address, label }: AddressDisplayProps) {
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  return (
    <span className="cp-hash-display">
      {label && <span className="cp-hash-display__label">{label}</span>}
      <code className="cp-hash-display__value" title={address}>{short}</code>
      <CopyButton text={address} label={`Copy ${label || 'address'}`} />
    </span>
  );
}

/* ─── MetricPanel ───────────────────────────────────────────────── */
interface MetricPanelProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
}
export function MetricPanel({ icon, label, value, subtitle }: MetricPanelProps) {
  return (
    <div className="cp-metric">
      <div className="cp-metric__icon">{icon}</div>
      <div className="cp-metric__body">
        <span className="cp-metric__label">{label}</span>
        <span className="cp-metric__value">{value}</span>
        {subtitle && <span className="cp-metric__subtitle">{subtitle}</span>}
      </div>
    </div>
  );
}

/* ─── EmptyState ────────────────────────────────────────────────── */
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="cp-empty">
      <div className="cp-empty__icon">{icon}</div>
      <h3 className="cp-empty__title">{title}</h3>
      <p className="cp-empty__desc">{description}</p>
      {action && <div className="cp-empty__action">{action}</div>}
    </div>
  );
}

/* ─── PageHeader ────────────────────────────────────────────────── */
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}
export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="cp-page-header">
      <div>
        <h1 className="cp-page-header__title">{title}</h1>
        {subtitle && <p className="cp-page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="cp-page-header__actions">{actions}</div>}
    </div>
  );
}

/* ─── NetworkStatus ─────────────────────────────────────────────── */
interface NetworkStatusProps {
  name: string;
  chainId: string;
  connected: boolean;
}
export function NetworkStatus({ name, chainId, connected }: NetworkStatusProps) {
  return (
    <div className="cp-network-status">
      <span className={`cp-network-status__dot ${connected ? 'cp-network-status__dot--on' : ''}`} />
      <span className="cp-network-status__name">{name}</span>
      <span className="cp-network-status__chain">ID {chainId}</span>
    </div>
  );
}
