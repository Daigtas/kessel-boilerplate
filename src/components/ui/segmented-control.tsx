"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Props für die SegmentedControl-Komponente.
 */
interface SegmentedControlProps<T extends string> {
  /** Die aktuell ausgewählte Option */
  value: T
  /** Callback wenn eine Option ausgewählt wird */
  onValueChange: (value: T) => void
  /** Die verfügbaren Optionen */
  options: Array<{
    value: T
    label: string
    icon?: React.ReactNode
  }>
  /** Zusätzliche CSS-Klassen */
  className?: string
  /** Größe der Komponente */
  size?: "sm" | "default" | "lg"
  /** Deaktiviert die gesamte Komponente */
  disabled?: boolean
}

/**
 * SegmentedControl - Ein schicker Toggle für mehrere Optionen.
 *
 * Zeigt eine animierte "Pill" die zwischen den Optionen gleitet.
 * Perfekt als Ersatz für RadioGroups mit besserer UX.
 *
 * @example
 * ```tsx
 * <SegmentedControl
 *   value={tone}
 *   onValueChange={setTone}
 *   options={[
 *     { value: "formal", label: "Förmlich" },
 *     { value: "casual", label: "Locker" },
 *   ]}
 * />
 * ```
 */
function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  className,
  size = "default",
  disabled = false,
}: SegmentedControlProps<T>): React.ReactElement {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [pillStyle, setPillStyle] = React.useState<React.CSSProperties>({})

  const sizeClasses = {
    sm: "h-8 text-xs",
    default: "h-10 text-sm",
    lg: "h-12 text-base",
  }

  const paddingClasses = {
    sm: "px-2.5",
    default: "px-4",
    lg: "px-5",
  }

  // Berechne die Position der Pill basierend auf der ausgewählten Option
  React.useEffect(() => {
    if (!containerRef.current) return

    const selectedIndex = options.findIndex((opt) => opt.value === value)
    if (selectedIndex === -1) return

    const buttons = containerRef.current.querySelectorAll<HTMLButtonElement>('[role="radio"]')
    const selectedButton = buttons[selectedIndex]

    if (selectedButton) {
      const containerRect = containerRef.current.getBoundingClientRect()
      const buttonRect = selectedButton.getBoundingClientRect()

      setPillStyle({
        width: buttonRect.width,
        transform: `translateX(${buttonRect.left - containerRect.left}px)`,
      })
    }
  }, [value, options])

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      className={cn(
        "bg-muted relative inline-flex items-center gap-0 rounded-lg p-1",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      {/* Animierte Pill */}
      <div
        className="bg-background absolute top-1 left-0 rounded-md shadow-sm transition-all duration-200 ease-out"
        style={{
          ...pillStyle,
          height: "calc(100% - 8px)",
        }}
      />

      {/* Option Buttons */}
      {options.map((option) => {
        const isSelected = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => !disabled && onValueChange(option.value)}
            className={cn(
              "relative z-10 inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors duration-200",
              sizeClasses[size],
              paddingClasses[size],
              isSelected ? "text-foreground" : "text-muted-foreground hover:text-foreground/80",
              disabled && "pointer-events-none"
            )}
          >
            {option.icon && <span className="shrink-0">{option.icon}</span>}
            <span>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export { SegmentedControl }
export type { SegmentedControlProps }
