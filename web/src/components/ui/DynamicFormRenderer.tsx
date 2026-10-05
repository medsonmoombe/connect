'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { SearchableCountrySelect } from '@/components/ui/SearchableCountrySelect';
import { YesNoField } from '@/components/ui/YesNoField';
import type { FormManifest, FormField } from '@/lib/form-manifest';
import { evaluateCondition, validateField } from '@/lib/form-manifest';
import { toast } from 'sonner';

interface DynamicFormRendererProps {
  manifest: FormManifest;
  initialData?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>, extraData: Record<string, unknown>) => void | Promise<void>;
  onChange?: (data: Record<string, unknown>) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  showDraftSave?: boolean;
  onDraftSave?: (data: Record<string, unknown>) => void;
  className?: string;
}

const inputClass =
  'w-full h-10 px-4 rounded-none border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-green-700/15 focus:border-green-700 transition-colors text-slate-900 text-sm';
const labelClass = 'text-[11px] font-semibold text-slate-400 uppercase tracking-widest ml-1';
const textareaClass =
  'w-full px-3 py-2.5 rounded-none border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-green-700/15 focus:border-green-700 transition-colors text-slate-900 resize-none text-sm';
const helperClass = 'text-[11px] text-slate-400 font-medium mt-1 ml-1';
const errorClass = 'text-[10px] text-red-500 font-medium ml-1 flex items-center gap-1 mt-1';

// ── File upload slot ──────────────────────────────────────────────────────
function FileUploadSlot({
  field,
  file,
  error,
  onSelect,
}: {
  field: FormField;
  file?: File | null;
  error?: string;
  onSelect: (file: File) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="cursor-pointer">
        <input
          type="file"
          className="hidden"
          accept={field.accept?.join(',')}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              if (field.maxFileSizeMB && f.size > field.maxFileSizeMB * 1024 * 1024) {
                toast.error(`File must be under ${field.maxFileSizeMB}MB`);
                return;
              }
              onSelect(f);
            }
            e.target.value = '';
          }}
        />
        <div
          className={cn(
            'flex items-center gap-3 h-16 px-4 rounded-none border-2 border-dashed transition-colors cursor-pointer',
            file
              ? 'border-green-300 bg-green-50/40'
              : 'border-slate-200 bg-slate-50 hover:border-green-300 hover:bg-green-50/20'
          )}
        >
          <div
            className={cn(
              'size-10 rounded-none flex items-center justify-center shrink-0',
              file ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'
            )}
          >
            {file ? <Icons.check className="size-5" /> : <Icons.upload className="size-5" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-700 truncate">
              {file ? file.name : 'Click to upload or drag and drop'}
            </p>
            <p className="text-[11px] text-slate-400">
              {field.accept?.join(', ') ?? 'Any file'}
              {field.maxFileSizeMB ? ` (max ${field.maxFileSizeMB}MB)` : ''}
            </p>
          </div>
        </div>
      </label>
      {error && (
        <p className={errorClass}>
          <Icons.alertTriangle className="size-3" />
          {error}
        </p>
      )}
    </div>
  );
}

// ── Single field renderer ─────────────────────────────────────────────────
function FieldRenderer({
  field,
  value,
  formData,
  onChange,
  error,
  onFileSelect,
  fileValue,
}: {
  field: FormField;
  value: unknown;
  formData: Record<string, unknown>;
  onChange: (value: unknown) => void;
  error?: string;
  onFileSelect?: (file: File) => void;
  fileValue?: File | null;
}) {
  if (field.dependsOn && !evaluateCondition(field.dependsOn, formData)) {
    return null;
  }

  const widthClass = field.width === 'half' ? 'col-span-1' : 'col-span-2';

  switch (field.type) {
    case 'yesno':
      return (
        <div className={widthClass}>
          <YesNoField
            id={field.name}
            label={field.label}
            description={field.helperText}
            value={value as boolean | null}
            onChange={onChange}
            required={field.required}
            error={error}
            yesLabel={field.yesLabel}
            noLabel={field.noLabel}
          />
        </div>
      );

    case 'select': {
      // Some fields have a dynamicOptions function that derives options from
      // the live form state (e.g. region depends on the chosen country). When
      // those return an empty list and fallbackType is 'text', render a free-
      // text input so the user can still enter a value.
      const dynamicOpts = field.dynamicOptions ? field.dynamicOptions(formData) : null;
      const staticOpts = field.options ?? [];
      const resolved = dynamicOpts ?? staticOpts;
      if (resolved.length === 0 && field.fallbackType === 'text') {
        return (
          <div className={cn('space-y-1.5', widthClass)}>
            <label htmlFor={field.name} className={labelClass}>
              {field.label}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {field.helperText ? <p className={helperClass}>{field.helperText}</p> : null}
            <input
              id={field.name}
              type="text"
              value={(value as string) ?? ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder}
              className={cn(inputClass, error && 'border-red-300')}
              disabled={field.disabled}
            />
            {error && (
              <p className={errorClass}>
                <Icons.alertTriangle className="size-3" />
                {error}
              </p>
            )}
          </div>
        );
      }
      return (
        <div className={cn('space-y-1.5', widthClass)}>
          <SearchableSelect
            value={(value as string) ?? ''}
            onChange={(val) => onChange(val)}
            options={resolved.map((opt) => ({ value: opt.value, label: opt.label }))}
            placeholder={field.placeholder ?? 'Select...'}
            label={field.label}
            required={field.required}
            helperText={field.helperText}
            error={error}
            disabled={field.disabled}
          />
        </div>
      );
    }

    case 'country':
      return (
        <div className={cn('space-y-1.5', widthClass)}>
          <SearchableCountrySelect
            value={(value as string) ?? ''}
            onChange={(val) => onChange(val)}
            placeholder={field.placeholder ?? 'Search country…'}
            label={field.label}
            required={field.required}
            helperText={field.helperText}
            error={error}
            disabled={field.disabled}
          />
        </div>
      );

    case 'multiselect':
      const selectedValues = (Array.isArray(value) ? value : []) as string[];
      return (
        <div className={cn('space-y-1.5', widthClass)}>
          <label className={labelClass}>
            {field.label}
            {field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          {field.helperText ? <p className={helperClass}>{field.helperText}</p> : null}
          <div className="flex flex-wrap gap-2">
            {field.options?.map((opt) => {
              const isSelected = selectedValues.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    const next = isSelected
                      ? selectedValues.filter((v) => v !== opt.value)
                      : [...selectedValues, opt.value];
                    onChange(next);
                  }}
                  className={cn(
                    'px-3 py-1.5 rounded-none border text-xs font-bold transition-all',
                    isSelected
                      ? 'bg-green-600 border-green-600 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-green-300'
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {error && (
            <p className={errorClass}>
              <Icons.alertTriangle className="size-3" />
              {error}
            </p>
          )}
        </div>
      );

    case 'textarea':
      return (
        <div className={cn('space-y-1.5', widthClass)}>
          <label htmlFor={field.name} className={labelClass}>
            {field.label}
            {field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          {field.helperText ? <p className={helperClass}>{field.helperText}</p> : null}
          <textarea
            id={field.name}
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className={cn(textareaClass, error && 'border-red-300')}
            rows={4}
            disabled={field.disabled}
          />
          {error && (
            <div className={errorClass}>
              <Icons.alertTriangle className="size-3" />
              {error}
            </div>
          )}
        </div>
      );

    case 'radio':
      return (
        <div className={cn('space-y-1.5', widthClass)}>
          <label className={labelClass}>
            {field.label}
            {field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          {field.helperText ? <p className={helperClass}>{field.helperText}</p> : null}
          <div className="flex gap-2">
            {field.options?.map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  'relative flex items-center gap-2 px-4 py-2 rounded-none border-2 cursor-pointer transition-all text-sm font-bold',
                  value === opt.value
                    ? 'bg-green-600 border-green-600 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-green-300'
                )}
              >
                <input
                  type="radio"
                  name={field.name}
                  value={opt.value}
                  checked={value === opt.value}
                  onChange={() => onChange(opt.value)}
                  className="sr-only"
                />
                {opt.label}
              </label>
            ))}
          </div>
          {error && (
            <p className={errorClass}>
              <Icons.alertTriangle className="size-3" />
              {error}
            </p>
          )}
        </div>
      );

    case 'checkbox':
      const isChecked = value === true;
      return (
        <div className={widthClass}>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => onChange(e.target.checked)}
              className="size-4 rounded border-slate-300 text-green-600 focus:ring-green-600/20"
            />
            <span className="text-sm font-medium text-slate-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </span>
          </label>
          {field.helperText ? <p className={helperClass}>{field.helperText}</p> : null}
          {error ? (
            <p className={errorClass}>
              <Icons.alertTriangle className="size-3" />
              {error}
            </p>
          ) : null}
        </div>
      );

    case 'file':
      return (
        <div className={widthClass}>
          <label className={labelClass}>
            {field.label}
            {field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          {field.helperText ? <p className={helperClass}>{field.helperText}</p> : null}
          <FileUploadSlot
            field={field}
            file={fileValue}
            error={error}
            onSelect={onFileSelect ?? (() => {})}
          />
        </div>
      );

    case 'range':
      return (
        <div className={cn('space-y-1.5', widthClass)}>
          <label htmlFor={field.name} className={labelClass}>
            {field.label}
            {field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          {field.helperText ? <p className={helperClass}>{field.helperText}</p> : null}
          <div className="flex items-center gap-3">
            <input
              type="range"
              id={field.name}
              min={field.rangeMin ?? 0}
              max={field.rangeMax ?? 100}
              step={field.rangeStep ?? 1}
              value={(value as number) ?? field.rangeMin ?? 0}
              onChange={(e) => onChange(Number(e.target.value))}
              className="flex-1 accent-green-600"
              disabled={field.disabled}
            />
            <span className="text-sm font-bold text-slate-700 min-w-[3rem] text-right">
              {String(value ?? field.rangeMin ?? 0)}
            </span>
          </div>
          {error && (
            <p className={errorClass}>
              <Icons.alertTriangle className="size-3" />
              {error}
            </p>
          )}
        </div>
      );

    case 'currency':
      return (
        <div className={cn('space-y-1.5', widthClass)}>
          <label htmlFor={field.name} className={labelClass}>
            {field.label}
            {field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          {field.helperText ? <p className={helperClass}>{field.helperText}</p> : null}
          <div className="relative">
            {field.currencyCode && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                {field.currencyCode}
              </span>
            )}
            <input
              type="number"
              id={field.name}
              value={(value as number) ?? ''}
              onChange={(e) => onChange(Number(e.target.value))}
              placeholder={field.placeholder}
              className={cn(inputClass, field.currencyCode && 'pl-12', error && 'border-red-300')}
              min={field.validation?.min}
              max={field.validation?.max}
              disabled={field.disabled}
            />
          </div>
          {error && (
            <p className={errorClass}>
              <Icons.alertTriangle className="size-3" />
              {error}
            </p>
          )}
        </div>
      );

    default:
      return (
        <div className={cn('space-y-1.5', widthClass)}>
          <label htmlFor={field.name} className={labelClass}>
            {field.label}
            {field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          {field.helperText ? <p className={helperClass}>{field.helperText}</p> : null}
          <input
            type={field.type === 'number' ? 'number' : field.type}
            id={field.name}
            value={(value as string | number) ?? ''}
            onChange={(e) =>
              onChange(field.type === 'number' ? Number(e.target.value) : e.target.value)
            }
            placeholder={field.placeholder}
            className={cn(inputClass, error && 'border-red-300')}
            min={field.validation?.min}
            max={field.validation?.max}
            disabled={field.disabled}
          />
          {error && (
            <p className={errorClass}>
              <Icons.alertTriangle className="size-3" />
              {error}
            </p>
          )}
        </div>
      );
  }
}

// ── Main renderer ─────────────────────────────────────────────────────────
export function DynamicFormRenderer({
  manifest,
  initialData,
  onSubmit,
  onChange,
  isSubmitting = false,
  submitLabel = 'Submit',
  showDraftSave = false,
  onDraftSave,
  className,
}: DynamicFormRendererProps) {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, unknown>>(() => {
    const data: Record<string, unknown> = {};
    for (const s of manifest.steps) {
      for (const f of s.fields) {
        data[f.name] = initialData?.[f.name] ?? f.defaultValue ?? (f.type === 'yesno' ? null : f.type === 'multiselect' ? [] : '');
      }
    }
    return data;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fileValues, setFileValues] = useState<Record<string, File>>({});

  useEffect(() => {
    if (!initialData) return;
    setFormData((prev) => {
      const next = { ...prev };
      for (const [key, val] of Object.entries(initialData)) {
        if (val !== undefined && val !== null) next[key] = val;
      }
      return next;
    });
  }, [initialData]);

  useEffect(() => {
    onChange?.(formData);
  }, [formData]);

  const totalSteps = manifest.steps.length;
  const currentStep = manifest.steps[step];

  const visibleFields = useMemo(() => {
    if (!currentStep) return [];
    return currentStep.fields.filter(
      (f) => !f.dependsOn || evaluateCondition(f.dependsOn, formData)
    );
  }, [currentStep, formData]);

  const updateField = useCallback((name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const validateCurrentStep = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    for (const field of visibleFields) {
      const err = validateField(field, formData[field.name], formData);
      if (err) newErrors[field.name] = err;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [visibleFields, formData]);

  const handleNext = useCallback(() => {
    if (!validateCurrentStep()) {
      toast.error('Please fix the errors before continuing');
      return;
    }
    if (step < totalSteps - 1) {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [step, totalSteps, validateCurrentStep]);

  const handleBack = useCallback(() => {
    if (step > 0) {
      setStep((s) => s - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [step]);

  const handleSubmit = useCallback(async () => {
    if (!validateCurrentStep()) {
      toast.error('Please fix the errors before submitting');
      return;
    }
    await onSubmit(formData, fileValues);
  }, [formData, fileValues, validateCurrentStep, onSubmit]);

  const handleDraftSave = useCallback(() => {
    onDraftSave?.(formData);
    toast.success('Draft saved');
  }, [formData, onDraftSave]);

  const progress = ((step + 1) / totalSteps) * 100;

  return (
    <div className={cn('max-w-3xl mx-auto', className)}>
      {/* Step progress indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          {manifest.steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={cn(
                  'size-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                  i < step
                    ? 'bg-green-600 text-white'
                    : i === step
                      ? 'bg-green-600 text-white ring-4 ring-green-100'
                      : 'bg-slate-100 text-slate-400'
                )}
              >
                {i < step ? <Icons.check className="size-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  'text-xs font-bold hidden sm:block',
                  i <= step ? 'text-slate-700' : 'text-slate-400'
                )}
              >
                {s.title}
              </span>
            </div>
          ))}
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-600 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step header */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-900">{currentStep?.title}</h2>
        {currentStep?.subtitle && (
          <p className="text-sm text-slate-500 mt-1">{currentStep.subtitle}</p>
        )}
      </div>

      {/* Fields */}
      <div className="grid grid-cols-2 gap-5">
        {visibleFields.map((field) => (
          <FieldRenderer
            key={field.name}
            field={field}
            value={formData[field.name]}
            formData={formData}
            onChange={(val) => updateField(field.name, val)}
            error={errors[field.name]}
            onFileSelect={field.type === 'file' ? (f) => setFileValues((prev) => ({ ...prev, [field.name]: f })) : undefined}
            fileValue={fileValues[field.name]}
          />
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
        <div className="flex items-center gap-3">
          {step > 0 && (
            <Button type="button" variant="outline" onClick={handleBack} disabled={isSubmitting}>
              <Icons.arrowLeft className="size-4 mr-2" />
              Back
            </Button>
          )}
          {showDraftSave && onDraftSave && (
            <Button type="button" variant="ghost" onClick={handleDraftSave} disabled={isSubmitting}>
              Save Draft
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-medium">
            Step {step + 1} of {totalSteps}
          </span>
          {step < totalSteps - 1 ? (
            <Button type="button" onClick={handleNext} disabled={isSubmitting}>
              Next
              <Icons.arrowRight className="size-4 ml-2" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <>
                  <Icons.spinner className="size-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {submitLabel}
                  <Icons.check className="size-4 ml-2" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

