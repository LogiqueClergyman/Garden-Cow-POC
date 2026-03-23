import { formatUsd } from '../../utils/format'

interface AmountInputProps {
  value: string
  onChange: (val: string) => void
  usdValue?: number
  disabled?: boolean
  placeholder?: string
}

export function AmountInput({ value, onChange, usdValue, disabled, placeholder = '0.0' }: AmountInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    // Allow only valid decimal numbers
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      onChange(val)
    }
  }

  return (
    <div className="flex flex-col">
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full bg-transparent text-2xl font-semibold text-white outline-none
                   placeholder-gray-600 disabled:text-gray-400"
      />
      {usdValue !== undefined && usdValue > 0 && (
        <span className="text-xs text-gray-500 mt-1">{formatUsd(usdValue)}</span>
      )}
    </div>
  )
}
