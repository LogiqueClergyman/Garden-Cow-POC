interface ChainBadgeProps {
  chainName: string
  icon?: string
  small?: boolean
}

export function ChainBadge({ chainName, icon, small }: ChainBadgeProps) {
  const size = small ? 'w-4 h-4' : 'w-5 h-5'
  const textSize = small ? 'text-[10px]' : 'text-xs'

  return (
    <span className="inline-flex items-center gap-1 bg-surface-3 rounded-full px-2 py-0.5">
      {icon && (
        <img
          src={icon}
          alt={chainName}
          className={`${size} rounded-full`}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none'
          }}
        />
      )}
      <span className={`${textSize} text-gray-400 font-medium`}>{chainName}</span>
    </span>
  )
}
