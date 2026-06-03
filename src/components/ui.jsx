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

// ============================================================================
// FixIt — shared UI component library (presentational only, no data).
// Icon props accept a lucide-react COMPONENT, e.g. <Button icon={Plus}>.
// Colors use stock Tailwind utilities (the design system maps 1:1 to them).
// ============================================================================

// ---------------------------------------------------------------------------
// Button — variant: primary | secondary | destructive | ghost ; size: sm | md
// ---------------------------------------------------------------------------
export function Button({
  variant = "primary",
  size = "md",
  type = "button",
  icon: LeadIcon,
  iconRight: TrailIcon,
  full = false,
  disabled = false,
  className = "",
  children,
  ...rest
}) {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";
  const sizes = { sm: "h-9 px-3 text-sm", md: "h-10 px-4 text-sm" };
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
    secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-sm",
    destructive: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
  };
  const iconSize = size === "sm" ? 16 : 18;
  return (
    <button
      type={type}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${full ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {LeadIcon && <LeadIcon size={iconSize} />}
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
        <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-red-600"> *</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle size={13} />
          {error}
        </p>
      )}
    </div>
  );
}

const controlBase =
  "w-full rounded-lg border bg-white text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 disabled:bg-slate-50 disabled:text-slate-400";
const controlError = "border-red-400 focus:ring-red-600/20 focus:border-red-500";

export function Input({ error, className = "", type, ...rest }) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const borders = error ? controlError : "border-slate-200";

  if (isPassword) {
    return (
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          className={`${controlBase} h-10 pl-3 pr-10 text-sm ${borders} ${className}`}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          tabIndex={-1}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    );
  }

  return (
    <input
      type={type}
      className={`${controlBase} h-10 px-3 text-sm ${borders} ${className}`}
      {...rest}
    />
  );
}

export function Textarea({ error, rows = 4, className = "", ...rest }) {
  return (
    <textarea
      rows={rows}
      className={`${controlBase} px-3 py-2.5 text-sm leading-relaxed resize-y ${error ? controlError : "border-slate-200"} ${className}`}
      {...rest}
    />
  );
}

export function Select({ error, className = "", children, ...rest }) {
  return (
    <div className="relative">
      <select
        className={`${controlBase} h-10 pl-3 pr-9 text-sm appearance-none cursor-pointer ${error ? controlError : "border-slate-200"} ${className}`}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
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
  const [preview, setPreview] = useState(value || null);
  const [localErr, setLocalErr] = useState("");

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
    const url = URL.createObjectURL(file);
    setPreview(url);
    onChange && onChange(url, file);
  }

  function clear(e) {
    e.stopPropagation();
    setPreview(null);
    onChange && onChange(null, null);
    if (inputRef.current) inputRef.current.value = "";
  }

  if (preview) {
    return (
      <div className="relative overflow-hidden rounded-lg border border-slate-200">
        <img src={preview} alt="preview" className="h-44 w-full object-cover" />
        <button
          type="button"
          onClick={clear}
          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-slate-700 shadow-sm hover:bg-white"
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
        className={`flex h-44 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-slate-50 text-center transition-colors hover:bg-slate-100 ${
          error || localErr ? "border-red-400" : "border-slate-300"
        }`}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
          <ImagePlus size={20} />
        </span>
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-xs text-slate-400">PNG or JPG up to {MAX_UPLOAD_MB} MB, drag &amp; drop or click</span>
        <input ref={inputRef} id={id} type="file" accept="image/*" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      </button>
      {localErr && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
          <AlertCircle size={13} />
          {localErr}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge — tone: neutral | blue | amber | emerald | red ; icon: lucide component
// ---------------------------------------------------------------------------
export function Badge({ tone = "neutral", icon: BadgeIcon, className = "", children }) {
  const tones = {
    neutral: "bg-slate-100 text-slate-600",
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-700",
    emerald: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}>
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
  amber: "bg-amber-500",
  blue: "bg-blue-600",
  emerald: "bg-emerald-600",
  red: "bg-red-600",
  neutral: "bg-slate-400",
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
    <div className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`} {...rest}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Avatar — initials only, no photos
// ---------------------------------------------------------------------------
export function Avatar({ name = "", src, size = 36, className = "" }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
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
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials || "?"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Modal / Dialog — icon: lucide component ; tone: blue | red | emerald | amber
// ---------------------------------------------------------------------------
export function Modal({ open, onClose, title, description, icon: HeadIcon, tone = "blue", children, footer, size = "md" }) {
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
    blue: "bg-blue-100 text-blue-700",
    red: "bg-red-100 text-red-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        className={`relative flex max-h-[90vh] w-full flex-col ${widths[size]} rounded-xl border border-slate-200 bg-white shadow-xl focus:outline-none`}
      >
        <div className="overflow-y-auto p-6">
          <div className="flex items-start gap-4">
            {HeadIcon && (
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${toneBg[tone]}`}>
                <HeadIcon size={20} />
              </span>
            )}
            <div className="flex-1 min-w-0">
              {title && <h3 id={titleId} className="text-base font-semibold text-slate-900">{title}</h3>}
              {description && <p id={descId} className="mt-1 text-sm text-slate-600 leading-relaxed">{description}</p>}
              {children && <div className="mt-4">{children}</div>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-1 -mt-1 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 rounded-b-xl">{footer}</div>
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
  success: { Icon: CheckCircle2, color: "text-emerald-600", ring: "bg-emerald-100" },
  error: { Icon: XCircle, color: "text-red-600", ring: "bg-red-100" },
  info: { Icon: Info, color: "text-blue-600", ring: "bg-blue-100" },
};

function ToastItem({ toast, onClose }) {
  const cfg = TOAST_CFG[toast.type || "success"];
  const Ico = cfg.Icon;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3.5 shadow-lg">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${cfg.ring} ${cfg.color}`}>
        <Ico size={16} />
      </span>
      <div className="flex-1 min-w-0 pt-0.5">
        {toast.title && <p className="text-sm font-medium text-slate-900">{toast.title}</p>}
        {toast.message && <p className="text-sm text-slate-600">{toast.message}</p>}
      </div>
      <button onClick={onClose} className="-mr-1 -mt-1 inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
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
export function EmptyState({ icon: EmptyIcon = Inbox, title, message, action, className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/50 px-6 py-14 text-center ${className}`}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
        <EmptyIcon size={22} />
      </span>
      {title && <h3 className="mt-4 text-sm font-semibold text-slate-900">{title}</h3>}
      {message && <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading — Spinner + Skeleton
// ---------------------------------------------------------------------------
export function Spinner({ size = 20, className = "" }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-slate-200 border-t-blue-600 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-md bg-slate-200/70 ${className}`} />;
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
export function StatCard({ label, value, icon: StatIcon, tone = "blue" }) {
  const toneBg = {
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-700",
    emerald: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneBg[tone]}`}>
          {StatIcon && <StatIcon size={20} />}
        </span>
      </div>
      <p className="mt-4 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-0.5 text-sm text-slate-500">{label}</p>
    </Card>
  );
}
