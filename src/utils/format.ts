export function toHumanReadable(amount: string, decimals: number): string {
  if (!amount || amount === '0') return '0'
  const str = amount.padStart(decimals + 1, '0')
  const intPart = str.slice(0, str.length - decimals) || '0'
  const fracPart = str.slice(str.length - decimals)
  const trimmed = fracPart.replace(/0+$/, '')
  return trimmed ? `${intPart}.${trimmed}` : intPart
}

export function toRawAmount(display: string, decimals: number): string {
  if (!display || display === '0') return '0'
  const [intPart, fracPart = ''] = display.split('.')
  const padded = fracPart.padEnd(decimals, '0').slice(0, decimals)
  const raw = (intPart + padded).replace(/^0+/, '') || '0'
  return raw
}

export function formatUsd(value: number): string {
  if (value < 0.01) return '< $0.01'
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function shortenAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 2) return address
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `~${seconds}s`
  if (seconds < 3600) return `~${Math.ceil(seconds / 60)}m`
  return `~${(seconds / 3600).toFixed(1)}h`
}

export function parseTokenSymbol(name: string): string {
  if (name.includes(':')) return name.split(':').pop()!.trim()
  return name
}

export function parseTokenName(name: string): string {
  if (name.includes(':')) return name.split(':')[0].trim()
  return name
}
