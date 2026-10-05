/**
 * form-manifest.ts — Schema for dynamic, JSON-driven forms.
 *
 * Each manifest describes a multi-step form. The DynamicFormRenderer reads
 * the manifest and renders fields automatically. Add/modify the manifest and
 * the form adjusts — no code changes needed for standard field additions.
 */

export type FieldType =
  | 'text'
  | 'number'
  | 'email'
  | 'password'
  | 'select'
  | 'multiselect'
  | 'country'
  | 'textarea'
  | 'radio'
  | 'checkbox'
  | 'date'
  | 'file'
  | 'currency'
  | 'range'
  | 'yesno';

export interface ValidationRule {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  message?: string;
  required?: boolean;
}

export interface ConditionalRule {
  field: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'gt' | 'lt' | 'isEmpty' | 'isNotEmpty';
  value: unknown;
}

export interface FormFieldOption {
  value: string;
  label: string;
}

export interface FormField {
  /** Unique field name — maps to form state key. */
  name: string;
  /** Human-readable label. */
  label: string;
  /** Field type determines rendering. */
  type: FieldType;
  /** Descriptive text shown below the label. */
  helperText?: string;
  /** Placeholder text. */
  placeholder?: string;
  /** Whether the field is required. */
  required?: boolean;
  /** Default value. */
  defaultValue?: unknown;
  /** Options for select/multiselect/radio fields. */
  options?: FormFieldOption[];
  /**
   * For 'select' / 'region' fields: compute options from current form data.
   * When this returns an empty array and `fallbackType === 'text'`, the
   * renderer falls back to a text input (used for region / province fields
   * where some countries have a curated region list and others don't).
   */
  dynamicOptions?: (formData: Record<string, unknown>) => FormFieldOption[];
  /** Render a text input instead of a select when dynamic options are empty. */
  fallbackType?: 'text';
  /** Validation rules. */
  validation?: ValidationRule;
  /** Conditional visibility — field only shown when condition is met. */
  dependsOn?: ConditionalRule;
  /** Accepted file types (for file fields). */
  accept?: string[];
  /** Max file size in MB (for file fields). */
  maxFileSizeMB?: number;
  /** Mark as JSONB — value stored in extra_data column. */
  schema?: 'jsonb';
  /** Width: 'full' = full width, 'half' = half width. Default 'full'. */
  width?: 'full' | 'half';
  /** For 'yesno' type: custom labels. */
  yesLabel?: string;
  noLabel?: string;
  /** For 'range' type: min/max/step. */
  rangeMin?: number;
  rangeMax?: number;
  rangeStep?: number;
  /** For 'currency' type: currency code. */
  currencyCode?: string;
  /** Whether the field is disabled. */
  disabled?: boolean;
}

export interface FormStep {
  /** Step title shown in the header. */
  title: string;
  /** Subtitle/description for the step. */
  subtitle?: string;
  /** Icon name (from Icons component). */
  icon?: string;
  /** Fields in this step — rendered in order. */
  fields: FormField[];
  /** Step-level validation schema name (maps to Zod schema in project-validation.ts). */
  validationSchema?: string;
}

export interface FormManifest {
  /** Unique manifest ID. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Version for future migration. */
  version: number;
  /** Form steps. */
  steps: FormStep[];
}

/**
 * Evaluate a conditional rule against current form state.
 * Returns true if the condition is met (field should be shown).
 */
export function evaluateCondition(
  condition: ConditionalRule,
  formData: Record<string, unknown>
): boolean {
  const fieldValue = formData[condition.field];

  switch (condition.operator) {
    case 'equals':
      return fieldValue === condition.value;
    case 'notEquals':
      return fieldValue !== condition.value;
    case 'contains':
      if (Array.isArray(fieldValue)) return fieldValue.includes(condition.value as string);
      if (typeof fieldValue === 'string') return fieldValue.includes(condition.value as string);
      return false;
    case 'gt':
      return typeof fieldValue === 'number' && fieldValue > (condition.value as number);
    case 'lt':
      return typeof fieldValue === 'number' && fieldValue < (condition.value as number);
    case 'isEmpty':
      return !fieldValue || (typeof fieldValue === 'string' && fieldValue.trim() === '') || (Array.isArray(fieldValue) && fieldValue.length === 0);
    case 'isNotEmpty':
      return !!fieldValue && !(typeof fieldValue === 'string' && fieldValue.trim() === '') && !(Array.isArray(fieldValue) && fieldValue.length === 0);
    default:
      return true;
  }
}

/**
 * Validate a single field against its validation rules.
 * Returns null if valid, error message if invalid.
 */
export function validateField(
  field: FormField,
  value: unknown,
  formData: Record<string, unknown>
): string | null {
  // Check required
  if (field.required) {
    if (value === undefined || value === null || value === '') return `${field.label} is required`;
    if (Array.isArray(value) && value.length === 0) return `${field.label} is required`;
  }

  // Skip further validation if empty and not required
  if (value === undefined || value === null || value === '') return null;

  const v = field.validation;
  if (!v) return null;

  if (typeof value === 'string') {
    if (v.minLength !== undefined && value.length < v.minLength) return v.message || `${field.label} must be at least ${v.minLength} characters`;
    if (v.maxLength !== undefined && value.length > v.maxLength) return v.message || `${field.label} must be at most ${v.maxLength} characters`;
    if (v.pattern) {
      const regex = new RegExp(v.pattern);
      if (!regex.test(value)) return v.message || `${field.label} format is invalid`;
    }
  }

  if (typeof value === 'number') {
    if (v.min !== undefined && value < v.min) return v.message || `${field.label} must be at least ${v.min}`;
    if (v.max !== undefined && value > v.max) return v.message || `${field.label} must be at most ${v.max}`;
  }

  return null;
}

/**
 * Split form data into standardData (direct DB columns) and extraData (JSONB).
 */
export function splitFormData(
  formData: Record<string, unknown>,
  manifest: FormManifest,
  jsonbFields: Set<string>
): { standardData: Record<string, unknown>; extraData: Record<string, unknown> } {
  const standardData: Record<string, unknown> = {};
  const extraData: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(formData)) {
    if (jsonbFields.has(key)) {
      extraData[key] = value;
    } else {
      standardData[key] = value;
    }
  }

  return { standardData, extraData };
}

/**
 * Collect all fields marked as schema:'jsonb' from a manifest.
 */
export function getJsonbFields(manifest: FormManifest): Set<string> {
  const fields = new Set<string>();
  for (const step of manifest.steps) {
    for (const field of step.fields) {
      if (field.schema === 'jsonb') fields.add(field.name);
    }
  }
  return fields;
}
