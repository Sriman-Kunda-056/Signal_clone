import { inputClass, inputStyle } from "@/lib/ui";

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoFocus?: boolean;
  placeholder?: string;
}

export function FormField({ label, value, onChange, type = "text", autoFocus, placeholder }: FormFieldProps) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        autoFocus={autoFocus}
        placeholder={placeholder}
        className={inputClass}
        style={inputStyle}
      />
    </div>
  );
}
