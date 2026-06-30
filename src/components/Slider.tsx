interface SliderProps {
  label: string
  min: number
  max: number
  step: number
  value: number
  format?: (v: number) => string
  onChange: (v: number) => void
}

export function Slider({ label, min, max, step, value, format, onChange }: SliderProps) {
  return (
    <label className="slider">
      <span className="slider-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={e => onChange(Number(e.target.value))}
      />
      <span className="slider-value">{format ? format(value) : String(value)}</span>
    </label>
  )
}
