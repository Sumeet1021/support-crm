import { useState, useEffect, useCallback, useRef } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useParams,
  Link,
} from "react-router-dom";
import axios from "axios";
import "./App.css";

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = "http://127.0.0.1:8000/api";

const STATUS_OPTIONS = ["Open", "In Progress", "Closed"];

const STATUS_META = {
  Open: {
    bg: "#EFF6FF",
    color: "#1D4ED8",
    border: "#BFDBFE",
    dot: "#3B82F6",
    hoverBg: "#DBEAFE",
  },
  "In Progress": {
    bg: "#FFF7ED",
    color: "#C2410C",
    border: "#FED7AA",
    dot: "#F97316",
    hoverBg: "#FFEDD5",
  },
  Closed: {
    bg: "#F0FDF4",
    color: "#15803D",
    border: "#BBF7D0",
    dot: "#22C55E",
    hoverBg: "#DCFCE7",
  },
};

const INITIAL_FORM = {
  customer_name: "",
  customer_email: "",
  subject: "",
  description: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format an ISO date string into "Jun 3, 2025 · 12:30 PM" */
function formatDateTime(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return null;
  }
}

/** Format an ISO date string into "Jun 3, 2025" */
function formatDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

/** Relative label like "2 days ago" */
function timeAgo(iso) {
  if (!iso) return null;
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins  < 1)  return "just now";
    if (mins  < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days  < 7)  return `${days}d ago`;
    return formatDate(iso);
  } catch {
    return null;
  }
}

/** Two initials from a name */
function getInitials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** Basic email check */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── Reusable UI ──────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const meta = STATUS_META[status] ?? {
    bg: "#F3F4F6", color: "#6B7280", border: "#E5E7EB", dot: "#9CA3AF",
  };
  return (
    <span
      className="status-badge"
      style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}
    >
      <span className="status-badge__dot" style={{ background: meta.dot }} />
      {status}
    </span>
  );
}

function Avatar({ name, size = 36 }) {
  const palettes = [
    { bg: "#DBEAFE", fg: "#1D4ED8" },
    { bg: "#EDE9FE", fg: "#6D28D9" },
    { bg: "#FCE7F3", fg: "#BE185D" },
    { bg: "#D1FAE5", fg: "#065F46" },
    { bg: "#FEF3C7", fg: "#92400E" },
    { bg: "#FFE4E6", fg: "#9F1239" },
  ];
  const { bg, fg } = palettes[(name?.charCodeAt(0) ?? 0) % palettes.length];
  return (
    <div
      className="avatar"
      style={{ background: bg, color: fg, width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}

const Icon = {
  Plus: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  User: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  ),
  Mail: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  ),
  Lines: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6h16M4 12h10M4 18h14" />
    </svg>
  ),
  Tag: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2H7a2 2 0 0 0-2 2v5l9.29 9.29a2 2 0 0 0 2.83 0l4.87-4.87a2 2 0 0 0 0-2.83L12 2Z" /><circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
    </svg>
  ),
  Calendar: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  Clock: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
    </svg>
  ),
  Search: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
    </svg>
  ),
  Filter: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M7 12h10M10 18h4" />
    </svg>
  ),
  X: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  Grid: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
    </svg>
  ),
  Chat: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Check: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  AlertCircle: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
    </svg>
  ),
  TicketIcon: () => (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
      <rect width="52" height="52" rx="16" fill="#EFF6FF" />
      <path d="M15 20a4 4 0 0 1 4-4h14a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H19a4 4 0 0 1-4-4V20Z" stroke="#93C5FD" strokeWidth="1.5" />
      <path d="M21 24h10M21 28h7" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  FilterEmpty: () => (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
      <rect width="52" height="52" rx="16" fill="#FFF7ED" />
      <path d="M14 18h24M19 26h14M23 34h6" stroke="#FB923C" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="36" cy="36" r="8" fill="#FFF7ED" stroke="#FB923C" strokeWidth="1.5" />
      <path d="M33.17 36h5.66M36 33.17v5.66" stroke="#FB923C" strokeWidth="1.5" strokeLinecap="round" transform="rotate(45 36 36)" />
    </svg>
  ),
  ArrowLeft: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  ),
  MessageSquare: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Send: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  Trash: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  ),
  Info: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
    </svg>
  ),
};

// ─── AnimatedNumber ────────────────────────────────────────────────────────────

function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(value);
  const prevRef  = useRef(value);
  const frameRef = useRef(null);

  useEffect(() => {
    const from = prevRef.current;
    const to   = value;
    if (from === to) return;
    const duration = 500;
    const start    = performance.now();
    const tick = (now) => {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
      else prevRef.current = to;
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value]);

  return <>{display}</>;
}

// ─── TicketCard ───────────────────────────────────────────────────────────────

function TicketCard({ ticket, onStatusChange, index }) {
  const [updating, setUpdating] = useState(false);
  const navigate = useNavigate();

  const handleStatusChange = async (e) => {
    e.stopPropagation();
    const newStatus = e.target.value;
    setUpdating(true);
    try {
      await axios.put(`${API_BASE}/tickets/${ticket.ticket_id}`, { status: newStatus });
      onStatusChange();
    } catch (err) {
      console.error("Status update failed:", err);
      alert("Failed to update ticket status. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const accentColor  = STATUS_META[ticket.status]?.dot ?? "#3B82F6";
  const createdLabel = formatDate(ticket.created_at);
  const updatedLabel = ticket.updated_at ? timeAgo(ticket.updated_at) : null;
  const createdFull  = formatDateTime(ticket.created_at);
  const updatedFull  = formatDateTime(ticket.updated_at);

  return (
    <article
      className="ticket-card"
      aria-label={`Ticket: ${ticket.subject}`}
      style={{ animationDelay: `${index * 55}ms`, cursor: "pointer" }}
      onClick={() => navigate(`/ticket/${ticket.ticket_id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/ticket/${ticket.ticket_id}`)}
    >
      <div className="ticket-card__accent" style={{ background: accentColor }} />

      <div className="ticket-card__body">
        <div className="ticket-card__header">
          <div className="ticket-card__header-left">
            <Avatar name={ticket.customer_name} />
            <div className="ticket-card__title-group">
              <h3 className="ticket-card__subject">{ticket.subject}</h3>
              <p className="ticket-card__customer">{ticket.customer_name}</p>
            </div>
          </div>
          <StatusBadge status={ticket.status} />
        </div>

        {ticket.description && (
          <p className="ticket-card__description">{ticket.description}</p>
        )}

        <div className="ticket-card__meta">
          <span className="ticket-card__meta-item">
            <Icon.Mail />
            <a
              href={`mailto:${ticket.customer_email}`}
              className="ticket-card__email"
              onClick={(e) => e.stopPropagation()}
            >
              {ticket.customer_email}
            </a>
          </span>

          <span className="ticket-card__meta-item">
            <Icon.Tag />
            <span className="ticket-card__id">{ticket.ticket_id}</span>
          </span>

          {createdLabel && (
            <span className="ticket-card__meta-item" title={`Created: ${createdFull}`}>
              <Icon.Calendar />
              <span>{createdFull || createdLabel}</span>
            </span>
          )}

          {updatedLabel && (
            <span className="ticket-card__meta-item" title={`Updated: ${updatedFull}`}>
              <Icon.Clock />
              <span>Updated {updatedLabel}</span>
            </span>
          )}
        </div>

        <div className="ticket-card__footer" onClick={(e) => e.stopPropagation()}>
          <span className="ticket-card__footer-label">Change status</span>
          <div className="ticket-card__footer-controls">
            <select
              id={`status-${ticket.ticket_id}`}
              value={ticket.status}
              onChange={handleStatusChange}
              disabled={updating}
              className="select select--compact"
              aria-label={`Update status for ticket ${ticket.ticket_id}`}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {updating && (
              <span className="spinner" aria-label="Saving…">
                <span className="spinner__ring" />
              </span>
            )}
          </div>
          <span className="ticket-card__view-link">View details →</span>
        </div>
      </div>
    </article>
  );
}

// ─── LoadingSkeletons ─────────────────────────────────────────────────────────

function LoadingSkeletons() {
  return (
    <div className="ticket-list" aria-busy="true" aria-label="Loading tickets">
      {[0, 1, 2].map((n) => (
        <div key={n} className="skeleton-card" style={{ animationDelay: `${n * 80}ms` }}>
          <div className="skeleton-card__accent" />
          <div className="skeleton-card__body">
            <div className="skeleton-card__header">
              <div className="skeleton skeleton--circle" />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <div className="skeleton skeleton--title" style={{ width: "55%" }} />
                <div className="skeleton skeleton--line"  style={{ width: "30%" }} />
              </div>
              <div className="skeleton skeleton--badge" />
            </div>
            <div className="skeleton skeleton--line" style={{ width: "90%", marginTop: 14 }} />
            <div className="skeleton skeleton--line" style={{ width: "72%", marginTop: 7 }} />
            <div style={{ display: "flex", gap: 16, marginTop: 14 }}>
              <div className="skeleton skeleton--line" style={{ width: 120 }} />
              <div className="skeleton skeleton--line" style={{ width: 90 }} />
              <div className="skeleton skeleton--line" style={{ width: 80 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({ hasFilters }) {
  return (
    <div className="empty-state" role="status" aria-live="polite">
      <div className="empty-state__graphic">
        {hasFilters ? <Icon.FilterEmpty /> : <Icon.TicketIcon />}
      </div>
      <p className="empty-state__title">
        {hasFilters ? "No tickets found" : "No tickets yet"}
      </p>
      <p className="empty-state__subtitle">
        {hasFilters
          ? "No tickets match your current search or filter. Try adjusting your criteria."
          : "Create a ticket to get started. New tickets will appear here."}
      </p>
    </div>
  );
}

// ─── StatsBar ─────────────────────────────────────────────────────────────────

function StatsBar({ tickets }) {
  const open       = tickets.filter((t) => t.status === "Open").length;
  const inProgress = tickets.filter((t) => t.status === "In Progress").length;
  const closed     = tickets.filter((t) => t.status === "Closed").length;

  const stats = [
    {
      label: "Total", value: tickets.length, color: "#2563EB", bg: "#EFF6FF", accent: "#3B82F6",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
        </svg>
      ),
    },
    {
      label: "Open", value: open, color: "#1D4ED8", bg: "#EFF6FF", accent: "#3B82F6",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 3" />
        </svg>
      ),
    },
    {
      label: "In Progress", value: inProgress, color: "#C2410C", bg: "#FFF7ED", accent: "#F97316",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      ),
    },
    {
      label: "Closed", value: closed, color: "#15803D", bg: "#F0FDF4", accent: "#22C55E",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="m9 12 2 2 4-4" />
        </svg>
      ),
    },
  ];

  return (
    <div className="stats-bar" role="region" aria-label="Ticket statistics">
      {stats.map((s) => (
        <div
          key={s.label}
          className="stat-card"
          style={{ "--stat-color": s.color, "--stat-bg": s.bg, "--stat-accent": s.accent }}
        >
          <div className="stat-card__icon" style={{ color: s.color, background: s.bg }}>
            {s.icon}
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value" aria-label={`${s.value} ${s.label} tickets`}>
              <AnimatedNumber value={s.value} />
            </span>
            <span className="stat-card__label">{s.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SuccessBanner ────────────────────────────────────────────────────────────

function SuccessBanner({ ticketId, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="success-banner" role="alert" aria-live="polite">
      <span className="success-banner__icon"><Icon.Check /></span>
      <div>
        <p className="success-banner__title">Ticket created successfully</p>
        {ticketId && (
          <p className="success-banner__sub">
            Ticket ID: <strong>{ticketId}</strong>
          </p>
        )}
      </div>
      <button className="success-banner__close" onClick={onDismiss} aria-label="Dismiss notification">
        <Icon.X />
      </button>
    </div>
  );
}

// ─── FormField ────────────────────────────────────────────────────────────────

function FormField({ id, label, error, required, children }) {
  return (
    <div className={`form-field${error ? " form-field--error" : ""}`}>
      <label htmlFor={id} className="form-label">
        {label}
        {required && <span className="required-star" aria-hidden="true"> *</span>}
      </label>
      {children}
      {error && (
        <span id={`err-${id}`} className="form-error" role="alert">
          <Icon.AlertCircle />{error}
        </span>
      )}
    </div>
  );
}

// ─── Topbar (shared) ──────────────────────────────────────────────────────────

function Topbar() {
  return (
    <header className="topbar" role="banner">
      <div className="topbar__inner">
        <div className="topbar__brand">
          <Link to="/" className="topbar__logo" aria-label="SupportDesk home">
            <Icon.Chat />
          </Link>
          <div>
            <span className="topbar__title">SupportDesk</span>
            <span className="topbar__sep" aria-hidden="true"> · </span>
            <span className="topbar__sub">CRM</span>
          </div>
        </div>
        <div className="topbar__badge" aria-label="System live">
          <span className="topbar__badge-dot" />
          Live
        </div>
      </div>
    </header>
  );
}

// ─── Dashboard page ───────────────────────────────────────────────────────────

function Dashboard() {
  const [tickets,      setTickets]      = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [formData,     setFormData]     = useState(INITIAL_FORM);
  const [submitting,   setSubmitting]   = useState(false);
  const [fieldErrors,  setFieldErrors]  = useState({});
  const [successId,    setSuccessId]    = useState(null);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/tickets`, {
        params: { search, status: statusFilter },
      });
      setTickets(res.data);
    } catch (err) {
      console.error("Failed to fetch tickets:", err);
      alert("Failed to load tickets. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: null }));
  };

  const validate = () => {
    const errors = {};
    if (!formData.customer_name.trim())   errors.customer_name  = "Customer name is required";
    if (!formData.customer_email.trim())  errors.customer_email = "Email address is required";
    else if (!isValidEmail(formData.customer_email)) errors.customer_email = "Please enter a valid email address";
    if (!formData.subject.trim())         errors.subject        = "Subject is required";
    if (!formData.description.trim())     errors.description    = "Description is required";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      setSubmitting(true);
      const res = await axios.post(`${API_BASE}/tickets`, formData);
      setSuccessId(res.data?.ticket_id ?? null);
      setFormData(INITIAL_FORM);
      setFieldErrors({});
      fetchTickets();
    } catch (err) {
      console.error("Failed to create ticket:", err);
      alert("Failed to create ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = () => { setSearch(""); setStatusFilter(""); };
  const hasFilters  = Boolean(search || statusFilter);

  return (
    <>
      <Topbar />

      <div className="hero" role="complementary" aria-label="Dashboard overview">
        <div className="hero__inner">
          <p className="hero__eyebrow">Dashboard</p>
          <h1 className="hero__title">Manage and track customer support tickets efficiently</h1>
        </div>
      </div>

      <main className="page-body" id="main-content">
        {successId !== null && (
          <SuccessBanner ticketId={successId} onDismiss={() => setSuccessId(null)} />
        )}

        {!loading && tickets.length > 0 && <StatsBar tickets={tickets} />}

        {/* ── Create Ticket ── */}
        <section className="panel" aria-labelledby="create-heading">
          <div className="panel__header">
            <div className="panel__icon panel__icon--blue" aria-hidden="true">
              <Icon.Plus />
            </div>
            <h2 id="create-heading" className="panel__title">New Ticket</h2>
          </div>

          <form onSubmit={handleSubmit} className="ticket-form" noValidate aria-label="Create support ticket">
            <div className="form-row">
              <FormField id="customer_name" label="Customer Name" error={fieldErrors.customer_name} required>
                <div className="input-wrap">
                  <span className="input-icon"><Icon.User /></span>
                  <input
                    id="customer_name" name="customer_name" type="text"
                    placeholder="Jane Smith" value={formData.customer_name}
                    onChange={handleFormChange} className="input input--icon"
                    autoComplete="name" aria-required="true"
                    aria-invalid={!!fieldErrors.customer_name}
                    aria-describedby={fieldErrors.customer_name ? "err-customer_name" : undefined}
                  />
                </div>
              </FormField>

              <FormField id="customer_email" label="Email Address" error={fieldErrors.customer_email} required>
                <div className="input-wrap">
                  <span className="input-icon"><Icon.Mail /></span>
                  <input
                    id="customer_email" name="customer_email" type="email"
                    placeholder="jane@example.com" value={formData.customer_email}
                    onChange={handleFormChange} className="input input--icon"
                    autoComplete="email" aria-required="true"
                    aria-invalid={!!fieldErrors.customer_email}
                    aria-describedby={fieldErrors.customer_email ? "err-customer_email" : undefined}
                  />
                </div>
              </FormField>
            </div>

            <FormField id="subject" label="Subject" error={fieldErrors.subject} required>
              <div className="input-wrap">
                <span className="input-icon"><Icon.Lines /></span>
                <input
                  id="subject" name="subject" type="text"
                  placeholder="Brief description of the issue"
                  value={formData.subject} onChange={handleFormChange}
                  className="input input--icon" aria-required="true"
                  aria-invalid={!!fieldErrors.subject}
                  aria-describedby={fieldErrors.subject ? "err-subject" : undefined}
                />
              </div>
            </FormField>

            <FormField id="description" label="Description" error={fieldErrors.description} required>
              <textarea
                id="description" name="description" rows={4}
                placeholder="Provide detailed information about the issue…"
                value={formData.description} onChange={handleFormChange}
                className="textarea" aria-required="true"
                aria-invalid={!!fieldErrors.description}
                aria-describedby={fieldErrors.description ? "err-description" : undefined}
              />
            </FormField>

            <div className="form-actions">
              <p className="form-hint">
                <span className="required-star" aria-hidden="true">*</span> Required fields
              </p>
              <button type="submit" disabled={submitting} className="btn btn--primary" aria-disabled={submitting}>
                {submitting ? (
                  <><span className="btn-spinner" aria-hidden="true" />Creating…</>
                ) : (
                  <><Icon.Plus />Create Ticket</>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* ── Ticket List ── */}
        <section aria-labelledby="tickets-heading">
          <div className="list-header">
            <div className="list-header__left">
              <div className="panel__icon panel__icon--slate" aria-hidden="true"><Icon.Grid /></div>
              <h2 id="tickets-heading" className="panel__title">
                All Tickets
                {!loading && (
                  <span className="count-pill" aria-label={`${tickets.length} tickets`}>
                    {tickets.length}
                  </span>
                )}
              </h2>
            </div>

            <div className="toolbar" role="search" aria-label="Search and filter tickets">
              <div className="input-wrap">
                <span className="input-icon"><Icon.Search /></span>
                <input
                  type="search" placeholder="Search tickets…"
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  className="input input--icon input--search"
                  aria-label="Search tickets"
                />
              </div>

              <div className="input-wrap">
                <span className="input-icon"><Icon.Filter /></span>
                <select
                  value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                  className="select select--icon" aria-label="Filter by ticket status"
                >
                  <option value="">All Statuses</option>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {hasFilters && (
                <button onClick={handleClear} className="btn btn--ghost" aria-label="Clear all filters">
                  <Icon.X /> Clear
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <LoadingSkeletons />
          ) : tickets.length === 0 ? (
            <EmptyState hasFilters={hasFilters} />
          ) : (
            <div className="ticket-list" role="list" aria-label="Support tickets">
              {tickets.map((ticket, i) => (
                <TicketCard
                  key={ticket.ticket_id}
                  ticket={ticket}
                  onStatusChange={fetchTickets}
                  index={i}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="page-footer" role="contentinfo">
        SupportDesk CRM &mdash; Built with FastAPI &amp; React
      </footer>
    </>
  );
}

// ─── NoteItem ─────────────────────────────────────────────────────────────────

function NoteItem({ note, onDelete }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm("Delete this note?")) return;
    setDeleting(true);
    try {
      await axios.delete(`${API_BASE}/tickets/${note.ticket_id}/notes/${note.id}`);
      onDelete();
    } catch (err) {
      console.error("Delete note failed:", err);
      alert("Failed to delete note. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="note-item">
      <div className="note-item__dot" />
      <div className="note-item__card">
        <p className="note-item__text">{note.note_text}</p>
        <div className="note-item__footer">
          <span className="note-item__time" title={formatDateTime(note.created_at)}>
            <Icon.Clock />{timeAgo(note.created_at)}
            <span className="note-item__time-full">&nbsp;· {formatDateTime(note.created_at)}</span>
          </span>
          <button
            className="note-item__delete"
            onClick={handleDelete}
            disabled={deleting}
            aria-label="Delete note"
          >
            {deleting ? <span className="spinner__ring" style={{ borderTopColor: "#EF4444" }} /> : <Icon.Trash />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TicketDetail page ────────────────────────────────────────────────────────

function TicketDetail() {
  const { ticketId } = useParams();
  const navigate     = useNavigate();

  const [ticket,    setTicket]    = useState(null);
  const [notes,     setNotes]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [noteText,  setNoteText]  = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [noteError, setNoteError]  = useState("");
  const [updating,  setUpdating]  = useState(false);
  const noteRef = useRef(null);

  const fetchTicket = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`${API_BASE}/tickets/${ticketId}`);
      setTicket(res.data);
      setNotes(res.data.notes ?? []);
    } catch (err) {
      if (err.response?.status === 404) {
        setError("Ticket not found.");
      } else {
        setError("Failed to load ticket. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => { fetchTicket(); }, [fetchTicket]);

  const handleStatusChange = async (e) => {
    const newStatus = e.target.value;
    setUpdating(true);
    try {
      const res = await axios.put(`${API_BASE}/tickets/${ticketId}`, { status: newStatus });
      setTicket(res.data);
    } catch (err) {
      console.error("Status update failed:", err);
      alert("Failed to update status. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) { setNoteError("Note cannot be empty."); return; }
    if (noteText.trim().length > 2000) { setNoteError("Note must be 2000 characters or fewer."); return; }
    setNoteError("");
    setAddingNote(true);
    try {
      await axios.post(`${API_BASE}/tickets/${ticketId}/notes`, { note_text: noteText.trim() });
      setNoteText("");
      await fetchTicket();
      // Scroll to notes section after add
      setTimeout(() => noteRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
    } catch (err) {
      console.error("Add note failed:", err);
      setNoteError("Failed to add note. Please try again.");
    } finally {
      setAddingNote(false);
    }
  };

  // ── Loading / error states ──
  if (loading) {
    return (
      <>
        <Topbar />
        <main className="page-body">
          <div className="detail-loading">
            <div className="detail-skeleton">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="skeleton skeleton--line" style={{ width: `${85 - n * 8}%`, height: 18, marginBottom: 14 }} />
              ))}
            </div>
          </div>
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Topbar />
        <main className="page-body">
          <div className="detail-error">
            <div className="detail-error__icon"><Icon.AlertCircle /></div>
            <p className="detail-error__title">{error}</p>
            <button className="btn btn--primary" onClick={() => navigate("/")}>
              <Icon.ArrowLeft /> Back to Dashboard
            </button>
          </div>
        </main>
      </>
    );
  }

  const accentColor = STATUS_META[ticket.status]?.dot ?? "#3B82F6";

  return (
    <>
      <Topbar />

      {/* Breadcrumb hero */}
      <div className="hero hero--detail" style={{ borderBottom: `3px solid ${accentColor}` }}>
        <div className="hero__inner">
          <div className="hero__breadcrumb">
            <Link to="/" className="hero__back">
              <Icon.ArrowLeft /> All Tickets
            </Link>
            <span className="hero__breadcrumb-sep">/</span>
            <span className="hero__breadcrumb-id">{ticket.ticket_id}</span>
          </div>
          <div className="hero__detail-header">
            <Avatar name={ticket.customer_name} size={48} />
            <div>
              <h1 className="hero__title hero__title--detail">{ticket.subject}</h1>
              <p className="hero__sub-name">{ticket.customer_name}</p>
            </div>
            <StatusBadge status={ticket.status} />
          </div>
        </div>
      </div>

      <main className="page-body" id="main-content">
        <div className="detail-grid">

          {/* ── Left column: ticket info ── */}
          <div className="detail-main">

            {/* Info panel */}
            <section className="panel" aria-labelledby="info-heading">
              <div className="panel__header">
                <div className="panel__icon panel__icon--blue"><Icon.Info /></div>
                <h2 id="info-heading" className="panel__title">Ticket Information</h2>
              </div>

              <div className="detail-info-grid">
                <div className="detail-info-row">
                  <span className="detail-info-label"><Icon.Tag /> Ticket ID</span>
                  <span className="ticket-card__id" style={{ fontFamily: "var(--font-mono)" }}>{ticket.ticket_id}</span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label"><Icon.User /> Customer</span>
                  <span className="detail-info-value">{ticket.customer_name}</span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label"><Icon.Mail /> Email</span>
                  <a href={`mailto:${ticket.customer_email}`} className="ticket-card__email">
                    {ticket.customer_email}
                  </a>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label"><Icon.Lines /> Subject</span>
                  <span className="detail-info-value">{ticket.subject}</span>
                </div>
                <div className="detail-info-row detail-info-row--full">
                  <span className="detail-info-label">Description</span>
                  <p className="detail-description">{ticket.description}</p>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label"><Icon.Calendar /> Created</span>
                  <span className="detail-info-value">{formatDateTime(ticket.created_at) ?? "—"}</span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label"><Icon.Clock /> Updated</span>
                  <span className="detail-info-value">{formatDateTime(ticket.updated_at) ?? "—"}</span>
                </div>
              </div>
            </section>

            {/* Notes section */}
            <section className="panel" aria-labelledby="notes-heading" ref={noteRef}>
              <div className="panel__header">
                <div className="panel__icon panel__icon--blue"><Icon.MessageSquare /></div>
                <h2 id="notes-heading" className="panel__title">
                  Notes &amp; Comments
                  <span className="count-pill">{notes.length}</span>
                </h2>
              </div>

              {/* Add note */}
              <div className="note-composer">
                <textarea
                  className={`textarea${noteError ? " textarea--error" : ""}`}
                  rows={3}
                  placeholder="Add a note or comment… (e.g. Customer contacted. Issue being investigated. Password reset sent.)"
                  value={noteText}
                  onChange={(e) => { setNoteText(e.target.value); if (noteError) setNoteError(""); }}
                  aria-label="New note text"
                  aria-invalid={!!noteError}
                  disabled={addingNote}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAddNote();
                  }}
                />
                {noteError && (
                  <span className="form-error" role="alert"><Icon.AlertCircle />{noteError}</span>
                )}
                <div className="note-composer__footer">
                  <span className="note-composer__hint">
                    {noteText.length}/2000 · Ctrl+Enter to submit
                  </span>
                  <button
                    className="btn btn--primary"
                    onClick={handleAddNote}
                    disabled={addingNote || !noteText.trim()}
                    aria-disabled={addingNote}
                  >
                    {addingNote
                      ? <><span className="btn-spinner" aria-hidden="true" />Adding…</>
                      : <><Icon.Send />Add Note</>
                    }
                  </button>
                </div>
              </div>

              {/* Note history */}
              <div className="notes-timeline" aria-label="Note history" aria-live="polite">
                {notes.length === 0 ? (
                  <div className="notes-empty">
                    <Icon.MessageSquare />
                    <p>No notes yet. Add the first note above.</p>
                  </div>
                ) : (
                  [...notes].reverse().map((note) => (
                    <NoteItem key={note.id} note={note} onDelete={fetchTicket} />
                  ))
                )}
              </div>
            </section>
          </div>

          {/* ── Right sidebar: status control ── */}
          <aside className="detail-sidebar">
            <div className="panel">
              <div className="panel__header">
                <div className="panel__icon panel__icon--slate"><Icon.Tag /></div>
                <h2 className="panel__title">Status</h2>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <StatusBadge status={ticket.status} />
                <label className="form-label" htmlFor="detail-status">Change status</label>
                <div className="input-wrap" style={{ alignItems: "center" }}>
                  <select
                    id="detail-status"
                    value={ticket.status}
                    onChange={handleStatusChange}
                    disabled={updating}
                    className="select"
                    aria-label="Update ticket status"
                  >
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {updating && (
                    <span className="spinner" style={{ marginLeft: 8 }} aria-label="Saving…">
                      <span className="spinner__ring" />
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="panel detail-sidebar__timestamps">
              <div className="panel__header">
                <div className="panel__icon panel__icon--slate"><Icon.Calendar /></div>
                <h2 className="panel__title">Timestamps</h2>
              </div>
              <dl className="ts-list">
                <div className="ts-row">
                  <dt><Icon.Calendar /> Created</dt>
                  <dd>{formatDateTime(ticket.created_at) ?? "—"}</dd>
                </div>
                <div className="ts-row">
                  <dt><Icon.Clock /> Updated</dt>
                  <dd>{formatDateTime(ticket.updated_at) ?? "—"}</dd>
                </div>
              </dl>
            </div>

            <Link to="/" className="btn btn--ghost" style={{ justifyContent: "center", width: "100%" }}>
              <Icon.ArrowLeft /> Back to Dashboard
            </Link>
          </aside>
        </div>
      </main>

      <footer className="page-footer" role="contentinfo">
        SupportDesk CRM &mdash; Built with FastAPI &amp; React
      </footer>
    </>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                  element={<Dashboard />} />
        <Route path="/ticket/:ticketId"  element={<TicketDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;