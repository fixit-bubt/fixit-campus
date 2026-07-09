import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useId } from "react";
import {
  X,
  AlertCircle,
  ChevronDown,
  ImagePlus,
  CheckCircle2,
  XCircle,
  Info,
  Inbox,
  Eye,
  EyeOff,
} from "lucide-react";
import { resolveIcon } from "./Icon.jsx";

// ============================================================================
// FixIt — shared UI component library (presentational only, no data).
// Icon props accept a lucide-react COMPONENT, e.g. <Button icon={Plus}>.
// Colors use the design tokens (tailwind.config.js → CSS variables), so every
// component re-themes automatically when `.dark` is set on <html>.
// Legacy accent tones (teal/violet/…) keep Tailwind hues with dark: variants.
// ============================================================================

// ---------------------------------------------------------------------------
// Button — variant: primary | secondary | destructive | ghost ; size: sm | md
// ---------------------------------------------------------------------------
export function Button({
  variant = "primary",
  size = "md",
  type = "button",
  icon,
  iconRight,
  full = false,
  loading = false,
  disabled = false,
  className = "",
  children,
  ...rest
}) {
  // icon props accept either a lucide component or a name string (see Icon.jsx).
  const LeadIcon = resolveIcon(icon);
  const TrailIcon = resolveIcon(iconRight);
  const base =
    "inline-flex items-center justify-center gap-2 font-bold rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";
  const sizes = { sm: "h-9 px-3 text-sm", md: "h-11 px-4 text-base" };
  const variants = {
    primary: "bg-brand text-white hover:bg-brand-700 shadow-sm",
    secondary: "bg-surface text-ink-2 border border-brd hover:bg-surface-2 shadow-sm",
    destructive: "bg-danger text-white hover:brightness-95 shadow-sm",
    ghost: "bg-transparent text-ink-3 hover:bg-surface-2 hover:text-ink-2",
  };
  const iconSize = size === "sm" ? 16 : 18;
  // `loading` disables the button (prevents double-submit) and swaps the lead
  // icon for a spinner that inherits the button's text color (border-current).
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${base} ${sizes[size]} ${variants[variant]} ${full ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {loading ? (
        <span
          className="inline-block animate-spin rounded-full border-2 border-current border-r-transparent opacity-70"
          style={{ width: iconSize, height: iconSize }}
        />
      ) : (
        LeadIcon && <LeadIcon size={iconSize} />
      )}
      {children}
      {TrailIcon && <TrailIcon size={iconSize} />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Field — label + control wrapper with error message
// ---------------------------------------------------------------------------
export function Field({ label, htmlFor, required, error, hint, children, className = "" }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={htmlFor} className="text-md font-semibold text-ink-2">
          {label}
          {required && <span className="text-danger"> *</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-xs text-ink-3">{hint}</p>}
      {error && (
        <p className="flex items-center gap-1 text-xs text-danger">
          <AlertCircle size={13} />
          {error}
        </p>
      )}
    </div>
  );
}

const controlBase =
  "w-full rounded-md border bg-surface text-ink placeholder:text-ink-3 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand disabled:bg-surface-2 disabled:text-ink-3";
const controlError = "border-danger focus:ring-danger-bg focus:border-danger";

export function Input({ error, className = "", type, ...rest }) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const borders = error ? controlError : "border-brd";

  if (isPassword) {
    return (
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          className={`${controlBase} h-12 pl-3.5 pr-10 text-md ${borders} ${className}`}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          tabIndex={-1}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink-2"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    );
  }

  return (
    <input
      type={type}
      className={`${controlBase} h-12 px-3.5 text-md ${borders} ${className}`}
      {...rest}
    />
  );
}

export function Textarea({ error, rows = 4, className = "", ...rest }) {
  return (
    <textarea
      rows={rows}
      className={`${controlBase} px-3.5 py-3 text-md leading-relaxed resize-y ${error ? controlError : "border-brd"} ${className}`}
      {...rest}
    />
  );
}

export function Select({ error, className = "", children, ...rest }) {
  return (
    <div className="relative">
      <select
        className={`${controlBase} h-12 pl-3.5 pr-9 text-md appearance-none cursor-pointer ${error ? controlError : "border-brd"} ${className}`}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// FileUpload — drag/click area with image preview
// ---------------------------------------------------------------------------
const MAX_UPLOAD_MB = 5;

export function FileUpload({ value, onChange, error, label = "Upload photo", id }) {
  const inputRef = useRef(null);
  const objectUrl = useRef(null); // the blob: URL we created, so we can revoke it
  const [preview, setPreview] = useState(value || null);
  const [localErr, setLocalErr] = useState("");

  // Revoke any object URL we made when this component unmounts.
  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);

  function handleFiles(files) {
    const file = files && files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLocalErr("Please choose an image file (PNG or JPG).");
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setLocalErr(`Image must be under ${MAX_UPLOAD_MB} MB.`);
      return;
    }
    setLocalErr("");
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); // free the previous one
    const url = URL.createObjectURL(file);
    objectUrl.current = url;
    setPreview(url);
    onChange && onChange(url, file);
  }

  function clear(e) {
    e.stopPropagation();
    if (objectUrl.current) { URL.revokeObjectURL(objectUrl.current); objectUrl.current = null; }
    setPreview(null);
    onChange && onChange(null, null);
    if (inputRef.current) inputRef.current.value = "";
  }

  if (preview) {
    return (
      <div className="relative overflow-hidden rounded-md border border-brd">
        <img
          src={preview}
          alt="preview"
          onError={() => {
            if (objectUrl.current) { URL.revokeObjectURL(objectUrl.current); objectUrl.current = null; }
            setPreview(null);
            setLocalErr("That image couldn't be loaded — please choose another.");
            onChange && onChange(null, null);
          }}
          className="h-44 w-full object-cover"
        />
        <button
          type="button"
          onClick={clear}
          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/90 text-slate-700 shadow-sm hover:bg-white dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current && inputRef.current.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        className={`flex h-44 w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-surface-2 text-center transition-colors hover:bg-surface-3 ${
          error || localErr ? "border-danger" : "border-brd-2"
        }`}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink-3 shadow-sm">
          <ImagePlus size={20} />
        </span>
        <span className="text-md font-semibold text-ink-2">{label}</span>
        <span className="text-xs text-ink-3">PNG or JPG up to {MAX_UPLOAD_MB} MB, drag &amp; drop or click</span>
        <input ref={inputRef} id={id} type="file" accept="image/*" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      </button>
      {localErr && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-danger">
          <AlertCircle size={13} />
          {localErr}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge — tone: neutral | blue | amber | emerald | red (semantic tokens),
// plus legacy accent hues. icon: lucide component
// ---------------------------------------------------------------------------
export function Badge({ tone = "neutral", icon, className = "", children }) {
  const BadgeIcon = resolveIcon(icon);
  const tones = {
    neutral: "bg-surface-3 text-ink-2",
    slate: "bg-surface-3 text-ink-2",
    blue: "bg-info-bg text-info",
    amber: "bg-warn-bg text-warn",
    emerald: "bg-success-bg text-success",
    red: "bg-danger-bg text-danger",
    teal: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    purple: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
    indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    fuchsia: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${tones[tone] || tones.neutral} ${className}`}>
      {BadgeIcon && <BadgeIcon size={12} />}
      {children}
    </span>
  );
}

// StatusBadge — maps a domain status string to a tone + colored dot
const STATUS_TONE = {
  Open: "amber",
  "In Progress": "blue",
  Resolved: "emerald",
  Rejected: "red",
  Closed: "red",
  Pending: "amber",
  Approved: "emerald",
  Lost: "red",
  Found: "emerald",
};
const DOT_COLOR = {
  amber: "bg-warn",
  blue: "bg-info",
  emerald: "bg-success",
  red: "bg-danger",
  neutral: "bg-ink-3",
};
export function StatusBadge({ status }) {
  const tone = STATUS_TONE[status] || "neutral";
  return (
    <Badge tone={tone}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_COLOR[tone]}`} />
      {status}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------
export function Card({ className = "", children, ...rest }) {
  return (
    <div className={`rounded-lg border border-brd bg-surface shadow-sm ${className}`} {...rest}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Avatar — initials only, no photos
// ---------------------------------------------------------------------------
export function Avatar({ name = "", src, size = 36, className = "" }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        className={`inline-block shrink-0 rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials || "?"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Modal / Dialog — icon: lucide component ; tone: blue | red | emerald | amber
// ---------------------------------------------------------------------------
export function Modal({ open, onClose, title, description, icon, tone = "blue", children, footer, size = "md" }) {
  const HeadIcon = resolveIcon(icon);
  const dialogRef = useRef(null);
  const titleId = useId();
  const descId = useId();

  // Close on Escape; move focus into the dialog on open and restore it on close.
  useEffect(() => {
    if (!open) return;
    const prevFocused = document.activeElement;
    const onKey = (e) => { if (e.key === "Escape") onClose && onClose(); };
    document.addEventListener("keydown", onKey);
    if (dialogRef.current) dialogRef.current.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      if (prevFocused && typeof prevFocused.focus === "function") prevFocused.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg" };
  const toneBg = {
    blue: "bg-info-bg text-info",
    red: "bg-danger-bg text-danger",
    emerald: "bg-success-bg text-success",
    amber: "bg-warn-bg text-warn",
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 dark:bg-black/60" onClick={onClose} />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        className={`relative flex max-h-[90vh] w-full flex-col ${widths[size]} rounded-xl border border-brd bg-surface shadow-xl focus:outline-none`}
      >
        <div className="overflow-y-auto p-6">
          <div className="flex items-start gap-4">
            {HeadIcon && (
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${toneBg[tone]}`}>
                <HeadIcon size={20} />
              </span>
            )}
            <div className="flex-1 min-w-0">
              {title && <h3 id={titleId} className="text-xl font-bold text-ink">{title}</h3>}
              {description && <p id={descId} className="mt-1 text-md text-ink-2 leading-relaxed">{description}</p>}
              {children && <div className="mt-4">{children}</div>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1 -mt-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink-2"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-brd bg-surface-2 px-6 py-4 rounded-b-xl">{footer}</div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toasts — <ToastProvider> + useToast()
// ---------------------------------------------------------------------------
const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((toast) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, ...toast }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), toast.duration || 3500);
  }, []);
  const remove = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const TOAST_CFG = {
  success: { Icon: CheckCircle2, color: "text-success", ring: "bg-success-bg" },
  error: { Icon: XCircle, color: "text-danger", ring: "bg-danger-bg" },
  info: { Icon: Info, color: "text-info", ring: "bg-info-bg" },
};

function ToastItem({ toast, onClose }) {
  const cfg = TOAST_CFG[toast.type || "success"];
  const Ico = cfg.Icon;
  return (
    <div className="flex items-start gap-3 rounded-md border border-brd bg-surface p-3.5 shadow-lg">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${cfg.ring} ${cfg.color}`}>
        <Ico size={16} />
      </span>
      <div className="flex-1 min-w-0 pt-0.5">
        {toast.title && <p className="text-md font-semibold text-ink">{toast.title}</p>}
        {toast.message && <p className="text-md text-ink-2">{toast.message}</p>}
      </div>
      <button onClick={onClose} className="-mr-1 -mt-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2">
        <X size={15} />
      </button>
    </div>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

// ---------------------------------------------------------------------------
// EmptyState — icon: lucide component (defaults to Inbox)
// ---------------------------------------------------------------------------
export function EmptyState({ icon, title, message, action, className = "" }) {
  const EmptyIcon = resolveIcon(icon) || Inbox;
  return (
    <div className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-brd-2 bg-surface-2 px-6 py-14 text-center ${className}`}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-ink-3 shadow-sm">
        <EmptyIcon size={22} />
      </span>
      {title && <h3 className="mt-4 text-md font-bold text-ink">{title}</h3>}
      {message && <p className="mt-1 max-w-sm text-md text-ink-3">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading — Spinner
// ---------------------------------------------------------------------------
export function Spinner({ size = 20, className = "" }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-surface-3 border-t-brand ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

// Centered loading spinner for list/dashboard areas while data loads.
export function Loading({ className = "" }) {
  return (
    <div className={`flex items-center justify-center py-16 ${className}`}>
      <Spinner size={28} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatCard — dashboard metric tile. icon: lucide component
// ---------------------------------------------------------------------------
export function StatCard({ label, value, icon, tone = "blue" }) {
  const StatIcon = resolveIcon(icon);
  const toneBg = {
    blue: "bg-info-bg text-info",
    amber: "bg-warn-bg text-warn",
    emerald: "bg-success-bg text-success",
    red: "bg-danger-bg text-danger",
    teal: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
    slate: "bg-surface-3 text-ink-2",
  };
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-md ${toneBg[tone]}`}>
          {StatIcon && <StatIcon size={20} />}
        </span>
      </div>
      <p className="mt-4 text-3xl font-bold text-ink">{value}</p>
      <p className="mt-0.5 text-md text-ink-3">{label}</p>
    </Card>
  );
}
