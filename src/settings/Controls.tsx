import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import { Switch } from '@base-ui/react/switch'

export function Spinner() {
  return <span className="spinner" role="status" aria-label="Saving" />
}

export function Segmented<T extends string>({ label, value, options, onChange, disabled, loading }: {
  label: string; value: T; options: readonly { value: T; label: string }[]
  onChange: (value: T) => void; disabled?: boolean; loading?: boolean
}) {
  return <RadioGroup aria-label={label} value={value} disabled={disabled || loading}
    className="segmented" onValueChange={next => {
      const option = options.find(option => option.value === next)
      if (option) onChange(option.value)
    }}>
    {options.map(option => <Radio.Root key={option.value} value={option.value}
      render={<span />} className="segment" aria-label={option.label}>
      <span className={`segment-label${loading && option.value === value ? ' invisible' : ''}`}>{option.label}</span>
      {loading && option.value === value && <span className="segment-loader"><Spinner /></span>}
    </Radio.Root>)}
  </RadioGroup>
}

export function Toggle({ label, checked, onChange, disabled, loading }: {
  label: string; checked: boolean; onChange: (value: boolean) => void
  disabled?: boolean; loading?: boolean
}) {
  return <span className="toggle-space" aria-busy={loading || undefined}>
    <Switch.Root aria-label={label} checked={checked} onCheckedChange={onChange}
      disabled={disabled || loading} className={`switch ${loading ? 'invisible' : ''}`}>
      <Switch.Thumb className="switch-thumb" />
    </Switch.Root>{loading && <Spinner />}
  </span>
}
