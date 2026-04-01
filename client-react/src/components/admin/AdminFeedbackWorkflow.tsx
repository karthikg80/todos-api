import { useState, useEffect, useCallback, useMemo } from "react";
import { apiCall } from "../../api/client";

/* ── Helpers ─────────────────────────────────────────────────────── */

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

function formatConfidence(value: number | null | undefined): string {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "Unknown";
}

/* ── Types ───────────────────────────────────────────────────────── */

interface AutomationConfig {
  feedbackAutomationEnabled: boolean;
  feedbackAutoPromoteEnabled: boolean;
  feedbackAutoPromoteMinConfidence: number;
  allowlistedClassifications: string[];
}

interface AutomationDecision {
  id: string;
  type: string;
  promotionDecision: string;
  title: string;
  promotionReason: string | null;
  promotionDecidedAt: string | null;
  githubIssueNumber: number | null;
  triageConfidence: number | null;
}

interface FeedbackListItem {
  id: string;
  title: string;
  type: string;
  status: string;
  createdAt: string;
  userId: string;
  user?: { email: string };
  classification?: string | null;
  duplicateCandidate?: boolean;
  matchedFeedbackIds?: string[];
  matchedGithubIssueNumber?: number | null;
  githubIssueNumber?: number | null;
  rejectionReason?: string | null;
}

/* ── Pipeline state derivation ──────────────────────────────────── */

type PipelineStage = "triage" | "dedup" | "promote";
type PipelineState = {
  stages: Record<PipelineStage, "done" | "pending" | "skipped">;
  nextAction: { label: string; stage: PipelineStage } | null;
  terminal: boolean; // promoted or rejected — no more actions
};

function derivePipeline(item: {
  status: string;
  classification?: string | null;
  duplicateCandidate?: boolean | null;
  matchedFeedbackIds?: string[] | null;
  matchedGithubIssueNumber?: number | null;
  githubIssueNumber?: number | null;
}): PipelineState {
  const isRejected = item.status === "rejected";
  const isPromoted = item.status === "promoted" || !!item.githubIssueNumber;
  const isTriaged = !!item.classification;
  const isDeduped =
    item.duplicateCandidate != null ||
    (Array.isArray(item.matchedFeedbackIds) &&
      item.matchedFeedbackIds.length > 0) ||
    item.matchedGithubIssueNumber != null;

  if (isRejected) {
    return {
      stages: {
        triage: isTriaged ? "done" : "skipped",
        dedup: isDeduped ? "done" : "skipped",
        promote: "skipped",
      },
      nextAction: null,
      terminal: true,
    };
  }

  if (isPromoted) {
    return {
      stages: {
        triage: "done",
        dedup: isDeduped ? "done" : "skipped",
        promote: "done",
      },
      nextAction: null,
      terminal: true,
    };
  }

  if (!isTriaged) {
    return {
      stages: { triage: "pending", dedup: "pending", promote: "pending" },
      nextAction: { label: "Run triage", stage: "triage" },
      terminal: false,
    };
  }

  if (!isDeduped) {
    return {
      stages: { triage: "done", dedup: "pending", promote: "pending" },
      nextAction: { label: "Check duplicates", stage: "dedup" },
      terminal: false,
    };
  }

  return {
    stages: { triage: "done", dedup: "done", promote: "pending" },
    nextAction: { label: "Promote to GitHub", stage: "promote" },
    terminal: false,
  };
}

interface FeedbackDetail {
  id: string;
  title: string;
  type: string;
  status: string;
  body: string;
  createdAt: string;
  userId: string;
  user?: { email: string };
  reviewer?: { email: string };
  reviewedAt: string | null;
  promotedAt: string | null;
  promotionDecision: string | null;
  promotionReason: string | null;
  promotionRunId: string | null;
  promotionDecidedAt: string | null;
  pageUrl: string | null;
  appVersion: string | null;
  userAgent: string | null;
  screenshotUrl: string | null;
  rejectionReason: string | null;
  attachmentMetadata: {
    name?: string;
    type?: string;
    size?: number;
  } | null;
  // Triage
  classification: string | null;
  triageConfidence: number | null;
  normalizedTitle: string | null;
  normalizedBody: string | null;
  triageSummary: string | null;
  impactSummary: string | null;
  expectedBehavior: string | null;
  actualBehavior: string | null;
  proposedOutcome: string | null;
  dedupeKey: string | null;
  severity: string | null;
  reproSteps: string[] | null;
  agentLabels: string[] | null;
  missingInfo: string[] | null;
  // Duplicate
  duplicateCandidate: boolean;
  matchedFeedbackIds: string[] | null;
  matchedGithubIssueNumber: number | null;
  matchedGithubIssueUrl: string | null;
  duplicateOfFeedbackId: string | null;
  duplicateOfGithubIssueNumber: number | null;
  duplicateOfGithubIssueUrl: string | null;
  duplicateReason: string | null;
  // Promotion
  githubIssueNumber: number | null;
  githubIssueUrl: string | null;
}

interface PromotionPreview {
  issueType: string;
  title: string;
  labels: string[];
  sourceFeedbackIds: string[];
  body: string;
  canPromote: boolean;
}

interface PipelineFailure {
  id: string;
  actionType: string;
  errorMessage: string | null;
  errorCode: string | null;
  createdAt: string;
  retryCount: number;
  retryable: boolean;
  resolvedAt: string | null;
  resolution: string | null;
}

const STATUS_FILTERS = ["new", "triaged", "promoted", "rejected"] as const;
const TYPE_FILTERS = ["bug", "feature"] as const;

/* ── Sub-components ──────────────────────────────────────────────── */

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="afw-meta__row">
      <span className="afw-meta__label">{label}</span>
      <span className="afw-meta__value">{value || "\u2014"}</span>
    </div>
  );
}

function ListBlock({
  title,
  items,
  emptyLabel = "None",
}: {
  title: string;
  items: string[] | null | undefined;
  emptyLabel?: string;
}) {
  const filtered = (items || []).filter(Boolean);
  return (
    <div className="afw-block">
      <h4>{title}</h4>
      {filtered.length ? (
        <ul className="afw-list">
          {filtered.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="afw-empty">{emptyLabel}</p>
      )}
    </div>
  );
}

function Pill({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant: string;
}) {
  return <span className={`afw-pill afw-pill--${variant}`}>{children}</span>;
}

/* ── Pipeline Indicator (3-dot progress for queue rows) ──────────── */

const STAGE_LABELS: Record<PipelineStage, string> = {
  triage: "Triage",
  dedup: "Dedup",
  promote: "Promote",
};

function PipelineIndicator({ item }: { item: FeedbackListItem }) {
  const { stages, terminal } = derivePipeline(item);
  return (
    <div
      className="afw-pipeline"
      title={terminal ? item.status : "In progress"}
    >
      {(["triage", "dedup", "promote"] as PipelineStage[]).map((stage) => (
        <span
          key={stage}
          className={`afw-pipeline__dot afw-pipeline__dot--${stages[stage]}`}
          title={`${STAGE_LABELS[stage]}: ${stages[stage]}`}
        />
      ))}
    </div>
  );
}

/* ── Next Action Banner (top of detail panel) ───────────────────── */

function NextActionBanner({
  item,
  onTriage,
  onDedup,
  onPromote,
}: {
  item: FeedbackDetail;
  onTriage: () => void;
  onDedup: () => void;
  onPromote: () => void;
}) {
  const pipeline = derivePipeline(item);

  if (pipeline.terminal) {
    if (item.status === "promoted" && item.githubIssueUrl) {
      return (
        <div className="afw-next-action afw-next-action--done">
          <span className="afw-next-action__label">Promoted</span>
          <a
            className="afw-next-action__link"
            href={item.githubIssueUrl}
            target="_blank"
            rel="noreferrer"
          >
            View GitHub issue #{item.githubIssueNumber}
          </a>
        </div>
      );
    }
    if (item.status === "rejected") {
      return (
        <div className="afw-next-action afw-next-action--rejected">
          <span className="afw-next-action__label">Rejected</span>
          {item.rejectionReason && (
            <span className="afw-next-action__reason">
              {item.rejectionReason}
            </span>
          )}
        </div>
      );
    }
    return null;
  }

  if (!pipeline.nextAction) return null;

  const handlers: Record<PipelineStage, () => void> = {
    triage: onTriage,
    dedup: onDedup,
    promote: onPromote,
  };

  return (
    <div className="afw-next-action">
      <div className="afw-next-action__pipeline">
        {(["triage", "dedup", "promote"] as PipelineStage[]).map((stage) => (
          <span
            key={stage}
            className={`afw-pipeline__step afw-pipeline__step--${pipeline.stages[stage]}`}
          >
            {STAGE_LABELS[stage]}
          </span>
        ))}
      </div>
      <button
        className="btn btn--primary afw-next-action__btn"
        onClick={handlers[pipeline.nextAction.stage]}
      >
        {pipeline.nextAction.label}
      </button>
    </div>
  );
}

/* ── Automation Panel ────────────────────────────────────────────── */

function AutomationPanel({
  onSelectFeedback,
}: {
  onSelectFeedback: (id: string) => void;
}) {
  const [config, setConfig] = useState<AutomationConfig | null>(null);
  const [decisions, setDecisions] = useState<AutomationDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  // Local form state
  const [enabled, setEnabled] = useState(false);
  const [autoPromote, setAutoPromote] = useState(false);
  const [minConfidence, setMinConfidence] = useState(0.7);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, decisionsRes] = await Promise.all([
        apiCall("/admin/feedback/automation/config"),
        apiCall("/admin/feedback/automation/decisions"),
      ]);
      if (configRes.ok) {
        const c: AutomationConfig = await configRes.json();
        setConfig(c);
        setEnabled(c.feedbackAutomationEnabled);
        setAutoPromote(c.feedbackAutoPromoteEnabled);
        setMinConfidence(c.feedbackAutoPromoteMinConfidence);
      }
      if (decisionsRes.ok) {
        const d = await decisionsRes.json();
        setDecisions(Array.isArray(d) ? d : []);
      }
    } catch {
      /* network error */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiCall("/admin/feedback/automation/config", {
        method: "PATCH",
        body: JSON.stringify({
          feedbackAutomationEnabled: enabled,
          feedbackAutoPromoteEnabled: autoPromote,
          feedbackAutoPromoteMinConfidence: minConfidence,
        }),
      });
    } catch {
      /* ignore */
    }
    setSaving(false);
  };

  const handleRun = async () => {
    setRunning(true);
    try {
      await apiCall("/admin/feedback/automation/run", { method: "POST" });
      await loadData();
    } catch {
      /* ignore */
    }
    setRunning(false);
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading automation controls...
      </div>
    );
  }

  if (!config) {
    return (
      <p className="afw-empty">
        Automation settings are unavailable right now.
      </p>
    );
  }

  return (
    <div className="afw-auto-grid">
      <div className="afw-block">
        <h4>Controls</h4>
        <div className="afw-auto-form">
          <label className="afw-toggle">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span>Enable feedback automation</span>
          </label>
          <label className="afw-toggle">
            <input
              type="checkbox"
              checked={autoPromote}
              onChange={(e) => setAutoPromote(e.target.checked)}
            />
            <span>Enable auto-promotion after checks pass</span>
          </label>
          <label className="afw-auto-label">Minimum confidence threshold</label>
          <input
            className="afw-auto-input"
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={minConfidence}
            onChange={(e) => setMinConfidence(Number(e.target.value))}
          />
          <p className="afw-empty">
            Allowlisted classifications:{" "}
            {(config.allowlistedClassifications || []).join(", ")}
          </p>
          <div className="afw-actions">
            <button className="btn" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save settings"}
            </button>
            <button
              className="btn btn--primary"
              onClick={handleRun}
              disabled={running}
            >
              {running ? "Running..." : "Run now"}
            </button>
          </div>
        </div>
      </div>
      <div className="afw-block">
        <h4>Recent Decisions</h4>
        {decisions.length === 0 ? (
          <p className="afw-empty">No automation decisions yet.</p>
        ) : (
          <div className="afw-decision-list">
            {decisions.map((d) => (
              <button
                key={d.id}
                type="button"
                className="afw-decision"
                onClick={() => onSelectFeedback(d.id)}
              >
                <div className="afw-row__top">
                  <Pill variant={d.type}>{d.type}</Pill>
                  <Pill variant="status">{d.promotionDecision}</Pill>
                </div>
                <strong className="afw-row__title">{d.title}</strong>
                <div className="afw-row__meta">
                  <span>{d.promotionReason || "No reason captured"}</span>
                </div>
                <div className="afw-row__meta">
                  <span>{formatDateTime(d.promotionDecidedAt)}</span>
                  <span>
                    {d.githubIssueNumber
                      ? `#${d.githubIssueNumber}`
                      : formatConfidence(d.triageConfidence)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Feedback Queue ──────────────────────────────────────────────── */

/* ── Queue group derivation (Enhancement 3) ───────────────────────── */

interface QueueGroup {
  key: string;
  label: string;
  items: FeedbackListItem[];
}

function deriveQueueGroups(items: FeedbackListItem[]): QueueGroup[] {
  const needsTriage: FeedbackListItem[] = [];
  const triaged: FeedbackListItem[] = [];
  const promoted: FeedbackListItem[] = [];
  const rejected: FeedbackListItem[] = [];

  for (const item of items) {
    if (item.status === "rejected") {
      rejected.push(item);
    } else if (item.githubIssueNumber || item.status === "promoted") {
      promoted.push(item);
    } else if (item.classification) {
      triaged.push(item);
    } else {
      needsTriage.push(item);
    }
  }

  return [
    { key: "needs-triage", label: "Needs triage", items: needsTriage },
    { key: "triaged", label: "Triaged", items: triaged },
    { key: "promoted", label: "Promoted", items: promoted },
    { key: "rejected", label: "Rejected", items: rejected },
  ].filter((g) => g.items.length > 0);
}

function FeedbackQueue({
  selectedId,
  onSelect,
  onBatchComplete,
  showToast,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
  onBatchComplete: () => void;
  showToast: (message: string, type: "success" | "error") => void;
}) {
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [items, setItems] = useState<FeedbackListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (typeFilter) params.set("type", typeFilter);
    const qs = params.toString();
    try {
      const res = await apiCall(`/admin/feedback${qs ? `?${qs}` : ""}`);
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const groups = useMemo(() => deriveQueueGroups(items), [items]);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.size === items.length ? new Set() : new Set(items.map((i) => i.id)),
    );
  }, [items]);

  const handleBatchTriage = useCallback(async () => {
    setBatchLoading(true);
    let ok = 0;
    for (const id of selectedIds) {
      try {
        const res = await apiCall(
          `/admin/feedback/${encodeURIComponent(id)}/triage`,
          { method: "POST" },
        );
        if (res.ok) ok++;
      } catch {
        /* continue */
      }
    }
    setSelectedIds(new Set());
    setBatchLoading(false);
    showToast(`Triaged ${ok} of ${selectedIds.size} items`, "success");
    await loadItems();
    onBatchComplete();
  }, [selectedIds, loadItems, onBatchComplete, showToast]);

  const handleBatchReject = useCallback(async () => {
    setBatchLoading(true);
    let ok = 0;
    for (const id of selectedIds) {
      try {
        const res = await apiCall(`/admin/feedback/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "rejected" }),
        });
        if (res.ok) ok++;
      } catch {
        /* continue */
      }
    }
    setSelectedIds(new Set());
    setBatchLoading(false);
    showToast(`Rejected ${ok} of ${selectedIds.size} items`, "success");
    await loadItems();
    onBatchComplete();
  }, [selectedIds, loadItems, onBatchComplete, showToast]);

  const handleQuickReject = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      try {
        const res = await apiCall(`/admin/feedback/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "rejected" }),
        });
        if (res.ok) {
          setItems((prev) => prev.filter((i) => i.id !== id));
          showToast("Item rejected", "success");
          onBatchComplete();
        } else {
          showToast("Failed to reject item", "error");
        }
      } catch {
        showToast("Network error rejecting item", "error");
      }
    },
    [showToast, onBatchComplete],
  );

  const renderRow = (item: FeedbackListItem) => (
    <div
      key={item.id}
      className={`afw-row${item.id === selectedId ? " is-selected" : ""}`}
    >
      <input
        type="checkbox"
        className="afw-row__checkbox"
        checked={selectedIds.has(item.id)}
        onChange={() => toggleSelected(item.id)}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Select ${item.title}`}
      />
      <button
        type="button"
        className="afw-row__body"
        onClick={() => onSelect(item.id)}
      >
        <div className="afw-row__top">
          <Pill variant={item.type}>{item.type}</Pill>
          <Pill variant="status">{item.status}</Pill>
          <PipelineIndicator item={item} />
        </div>
        <strong className="afw-row__title">{item.title}</strong>
        <div className="afw-row__meta">
          <span>{item.user?.email || item.userId}</span>
          <span>{formatDateTime(item.createdAt)}</span>
        </div>
      </button>
      <button
        type="button"
        className="afw-row__quick-reject"
        aria-label="Quick reject"
        onClick={(e) => handleQuickReject(e, item.id)}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>
  );

  return (
    <div className="afw-queue">
      <div className="afw-filters">
        <div className="afw-filter-group">
          <span className="afw-filter-label">Status</span>
          <div className="afw-filter-row">
            <button
              type="button"
              className={`field-chip${statusFilter === "" ? " field-chip--active" : ""}`}
              onClick={() => setStatusFilter("")}
            >
              All
            </button>
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                className={`field-chip${statusFilter === s ? " field-chip--active" : ""}`}
                onClick={() => setStatusFilter(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="afw-filter-group">
          <span className="afw-filter-label">Type</span>
          <div className="afw-filter-row">
            <button
              type="button"
              className={`field-chip${typeFilter === "" ? " field-chip--active" : ""}`}
              onClick={() => setTypeFilter("")}
            >
              All
            </button>
            {TYPE_FILTERS.map((t) => (
              <button
                key={t}
                type="button"
                className={`field-chip${typeFilter === t ? " field-chip--active" : ""}`}
                onClick={() => setTypeFilter(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="afw-filter-group">
          <label className="afw-filter-label afw-select-all">
            <input
              type="checkbox"
              checked={items.length > 0 && selectedIds.size === items.length}
              onChange={toggleSelectAll}
            />
            <span>Select all</span>
          </label>
        </div>
      </div>

      {/* Batch toolbar */}
      {selectedIds.size > 0 && (
        <div className="afw-batch-toolbar">
          <span className="afw-batch-toolbar__count">
            {selectedIds.size} selected
          </span>
          <button
            className="btn btn--primary"
            onClick={handleBatchTriage}
            disabled={batchLoading}
          >
            Triage all
          </button>
          <button
            className="btn btn--danger"
            onClick={handleBatchReject}
            disabled={batchLoading}
          >
            Reject all
          </button>
          <button
            className="btn"
            onClick={() => setSelectedIds(new Set())}
            disabled={batchLoading}
          >
            Clear
          </button>
        </div>
      )}

      {loading ? (
        <div className="loading">
          <div className="spinner" />
          Loading feedback...
        </div>
      ) : items.length === 0 ? (
        <div className="afw-empty-block">
          No feedback matches the current filters.
        </div>
      ) : (
        <div className="afw-list-items">
          {groups.map((group) => (
            <div key={group.key} className="afw-queue-group">
              <div className="afw-queue-group__header">
                {group.label} ({group.items.length})
              </div>
              {group.items.map(renderRow)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Detail Panel ────────────────────────────────────────────────── */

function DetailPanel({
  feedbackId,
  onStatusChanged,
  showToast,
}: {
  feedbackId: string;
  onStatusChanged: () => void;
  showToast: (message: string, type: "success" | "error") => void;
}) {
  const [item, setItem] = useState<FeedbackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<PromotionPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [failures, setFailures] = useState<PipelineFailure[]>([]);
  const [failuresLoading, setFailuresLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setPreview(null);
    setPreviewError("");
    setFailures([]);
    try {
      const res = await apiCall(
        `/admin/feedback/${encodeURIComponent(feedbackId)}`,
      );
      if (res.ok) {
        const data: FeedbackDetail = await res.json();
        setItem(data);
        setRejectionReason(data.rejectionReason || "");
      } else {
        setItem(null);
      }
    } catch {
      setItem(null);
    }
    setLoading(false);
  }, [feedbackId]);

  const loadFailures = useCallback(async () => {
    setFailuresLoading(true);
    try {
      const res = await apiCall(
        `/admin/feedback/${encodeURIComponent(feedbackId)}/failures`,
      );
      if (res.ok) {
        const data = await res.json();
        setFailures(Array.isArray(data) ? data : []);
      }
    } catch {
      /* ignore */
    }
    setFailuresLoading(false);
  }, [feedbackId]);

  useEffect(() => {
    loadDetail();
    loadFailures();
  }, [loadDetail, loadFailures]);

  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    setPreviewError("");
    try {
      const res = await apiCall(
        `/admin/feedback/${encodeURIComponent(feedbackId)}/promotion-preview`,
      );
      if (res.ok) {
        setPreview(await res.json());
      } else {
        const err = await res.json().catch(() => ({}));
        setPreviewError(
          (err as { error?: string }).error ||
            "Failed to load promotion preview",
        );
      }
    } catch {
      setPreviewError("Network error loading preview");
    }
    setPreviewLoading(false);
  }, [feedbackId]);

  // Load preview automatically after detail loads
  useEffect(() => {
    if (item) loadPreview();
  }, [item, loadPreview]);

  const handleTriage = async () => {
    try {
      const res = await apiCall(
        `/admin/feedback/${encodeURIComponent(feedbackId)}/triage`,
        { method: "POST" },
      );
      await loadDetail();
      if (res.ok) showToast("Triage complete", "success");
      else showToast("Triage failed", "error");
    } catch {
      showToast("Network error during triage", "error");
    }
    onStatusChanged();
  };

  const handleDuplicateCheck = async () => {
    try {
      const res = await apiCall(
        `/admin/feedback/${encodeURIComponent(feedbackId)}/duplicate-check`,
        { method: "POST" },
      );
      await loadDetail();
      if (res.ok) showToast("Duplicate check complete", "success");
      else showToast("Duplicate check failed", "error");
    } catch {
      showToast("Network error during duplicate check", "error");
    }
    onStatusChanged();
  };

  const handlePromote = async () => {
    try {
      const res = await apiCall(
        `/admin/feedback/${encodeURIComponent(feedbackId)}/promote`,
        { method: "POST" },
      );
      await loadDetail();
      if (res.ok) showToast("Promoted to GitHub", "success");
      else showToast("Promotion failed", "error");
    } catch {
      showToast("Network error during promotion", "error");
    }
    onStatusChanged();
  };

  const handleReject = async () => {
    try {
      const res = await apiCall(
        `/admin/feedback/${encodeURIComponent(feedbackId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: "rejected",
            rejectionReason: rejectionReason || undefined,
          }),
        },
      );
      await loadDetail();
      if (res.ok) showToast("Item rejected", "success");
      else showToast("Rejection failed", "error");
    } catch {
      showToast("Network error during rejection", "error");
    }
    onStatusChanged();
  };

  const handleRetry = async (action: string) => {
    await apiCall(`/admin/feedback/${encodeURIComponent(feedbackId)}/retry`, {
      method: "POST",
      body: JSON.stringify({ action }),
    });
    await loadDetail();
    await loadFailures();
  };

  if (loading) {
    return (
      <div className="afw-detail loading">
        <div className="spinner" />
        Loading details...
      </div>
    );
  }

  if (!item) {
    return (
      <div className="afw-detail afw-empty-block">
        Select a feedback item to inspect the full submission and metadata.
      </div>
    );
  }

  const attachmentSummary = item.attachmentMetadata
    ? `${item.attachmentMetadata.name || "Attachment"} \u2022 ${item.attachmentMetadata.type || "unknown"} \u2022 ${item.attachmentMetadata.size ?? 0} bytes`
    : "No attachment metadata";

  const hasDuplicateData =
    item.duplicateCandidate ||
    item.duplicateOfFeedbackId ||
    item.duplicateOfGithubIssueNumber ||
    (Array.isArray(item.matchedFeedbackIds) &&
      item.matchedFeedbackIds.length > 0) ||
    item.matchedGithubIssueNumber;

  return (
    <div className="afw-detail">
      <div className="afw-card">
        {/* Header */}
        <div className="afw-card__header">
          <div className="afw-row__top">
            <Pill variant={item.type}>{item.type}</Pill>
            <Pill variant="status">{item.status}</Pill>
          </div>
          <h3>{item.title}</h3>
          <p className="afw-subtitle">
            Submitted by {item.user?.email || item.userId} on{" "}
            {formatDateTime(item.createdAt)}
          </p>
        </div>

        {/* Next action banner */}
        <NextActionBanner
          item={item}
          onTriage={handleTriage}
          onDedup={handleDuplicateCheck}
          onPromote={handlePromote}
        />

        {/* Raw submission */}
        <div className="afw-block">
          <h4>Raw submission</h4>
          <pre className="afw-pre">{item.body}</pre>
        </div>

        {/* Captured metadata */}
        <div className="afw-block">
          <h4>Captured metadata</h4>
          <div className="afw-meta">
            <MetadataRow label="User" value={item.user?.email || item.userId} />
            <MetadataRow label="Reviewer" value={item.reviewer?.email || ""} />
            <MetadataRow
              label="Reviewed at"
              value={item.reviewedAt ? formatDateTime(item.reviewedAt) : ""}
            />
            <MetadataRow
              label="Promoted at"
              value={item.promotedAt ? formatDateTime(item.promotedAt) : ""}
            />
            <MetadataRow
              label="Automation decision"
              value={item.promotionDecision || ""}
            />
            <MetadataRow
              label="Decision reason"
              value={item.promotionReason || ""}
            />
            <MetadataRow label="Page URL" value={item.pageUrl || ""} />
            <MetadataRow label="App version" value={item.appVersion || ""} />
            <MetadataRow label="Browser" value={item.userAgent || ""} />
            <MetadataRow
              label="Screenshot URL"
              value={item.screenshotUrl || ""}
            />
            <MetadataRow label="Attachment" value={attachmentSummary} />
            <MetadataRow
              label="Rejection reason"
              value={item.rejectionReason || ""}
            />
          </div>
        </div>

        {/* AI Triage */}
        <div className="afw-block">
          <div className="afw-block__header">
            <h4>AI Triage</h4>
            <button className="btn" onClick={handleTriage}>
              {item.classification ? "Re-run triage" : "Run triage"}
            </button>
          </div>
          <div className="afw-meta">
            <MetadataRow
              label="Classification"
              value={item.classification || ""}
            />
            <MetadataRow
              label="Confidence"
              value={formatConfidence(item.triageConfidence)}
            />
            <MetadataRow
              label="Normalized title"
              value={item.normalizedTitle || ""}
            />
            <MetadataRow label="Summary" value={item.triageSummary || ""} />
            <MetadataRow label="Impact" value={item.impactSummary || ""} />
            <MetadataRow
              label="Expected behavior"
              value={item.expectedBehavior || ""}
            />
            <MetadataRow
              label="Actual behavior"
              value={item.actualBehavior || ""}
            />
            <MetadataRow
              label="Proposed outcome"
              value={item.proposedOutcome || ""}
            />
            <MetadataRow label="Dedupe key" value={item.dedupeKey || ""} />
            <MetadataRow label="Severity" value={item.severity || ""} />
          </div>
          <div className="afw-block">
            <h4>Normalized body</h4>
            <pre className="afw-pre">
              {item.normalizedBody || "No triage output yet."}
            </pre>
          </div>
          <ListBlock
            title="Repro steps"
            items={item.reproSteps}
            emptyLabel="No repro steps extracted"
          />
          <ListBlock
            title="Labels"
            items={item.agentLabels}
            emptyLabel="No labels assigned"
          />
          <ListBlock
            title="Missing info flags"
            items={item.missingInfo}
            emptyLabel="No missing info flags"
          />
        </div>

        {/* Duplicate Review */}
        {hasDuplicateData && (
          <div className="afw-block">
            <div className="afw-block__header">
              <h4>Duplicate Review</h4>
              <button className="btn" onClick={handleDuplicateCheck}>
                Check duplicates
              </button>
            </div>
            <div className="afw-meta">
              <MetadataRow
                label="Suggested duplicate"
                value={item.duplicateCandidate ? "Yes" : "No"}
              />
              <MetadataRow
                label="Suggested feedback IDs"
                value={(item.matchedFeedbackIds || []).join(", ")}
              />
              <MetadataRow
                label="Suggested GitHub issue"
                value={
                  item.matchedGithubIssueNumber
                    ? `#${item.matchedGithubIssueNumber}`
                    : ""
                }
              />
              <MetadataRow
                label="Confirmed feedback duplicate"
                value={item.duplicateOfFeedbackId || ""}
              />
              <MetadataRow
                label="Confirmed GitHub duplicate"
                value={
                  item.duplicateOfGithubIssueNumber
                    ? `#${item.duplicateOfGithubIssueNumber}`
                    : ""
                }
              />
              <MetadataRow
                label="Duplicate reason"
                value={item.duplicateReason || ""}
              />
            </div>
            {item.duplicateCandidate && (
              <div className="afw-actions">
                {item.matchedFeedbackIds?.[0] && (
                  <button className="btn" onClick={handleDuplicateCheck}>
                    Link matched feedback
                  </button>
                )}
                {item.matchedGithubIssueNumber && (
                  <button className="btn" onClick={handleDuplicateCheck}>
                    Link GitHub issue
                  </button>
                )}
                <button className="btn btn--primary" onClick={handlePromote}>
                  Ignore and promote
                </button>
              </div>
            )}
          </div>
        )}

        {/* Promotion Preview */}
        {previewLoading ? (
          <div className="afw-block loading">
            <div className="spinner" />
            Building issue preview...
          </div>
        ) : previewError ? (
          <div className="afw-block">
            <div className="afw-block__header">
              <h4>Promotion Preview</h4>
              <button className="btn" onClick={loadPreview}>
                Refresh preview
              </button>
            </div>
            <p className="afw-empty">{previewError}</p>
          </div>
        ) : preview ? (
          <div className="afw-block">
            <div className="afw-block__header">
              <h4>Promotion Preview</h4>
              <button className="btn" onClick={loadPreview}>
                Refresh preview
              </button>
            </div>
            <div className="afw-meta">
              <MetadataRow label="Issue type" value={preview.issueType} />
              <MetadataRow label="Issue title" value={preview.title} />
              <MetadataRow
                label="Labels"
                value={(preview.labels || []).join(", ")}
              />
              <MetadataRow
                label="Source feedback IDs"
                value={(preview.sourceFeedbackIds || []).join(", ")}
              />
              <MetadataRow
                label="Promotion status"
                value={
                  item.githubIssueNumber
                    ? `Created as #${item.githubIssueNumber}`
                    : preview.canPromote
                      ? "Ready"
                      : "Blocked"
                }
              />
            </div>
            {item.githubIssueUrl && (
              <div className="afw-links">
                <a
                  className="afw-link"
                  href={item.githubIssueUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open created GitHub issue
                </a>
              </div>
            )}
            <div className="afw-block">
              <h4>Issue body</h4>
              <pre className="afw-pre">{preview.body}</pre>
            </div>
            <div className="afw-actions">
              <button
                className="btn btn--primary"
                onClick={handlePromote}
                disabled={!!item.githubIssueNumber}
              >
                {item.githubIssueNumber
                  ? "Issue already created"
                  : "Create GitHub issue"}
              </button>
            </div>
          </div>
        ) : null}

        {/* Pipeline Failures */}
        {failuresLoading ? (
          <div className="afw-block loading">
            <div className="spinner" />
            Loading failures...
          </div>
        ) : failures.length > 0 ? (
          <div className="afw-block">
            <div className="afw-block__header">
              <h4>Pipeline Failures</h4>
            </div>
            <div className="afw-stack">
              {failures.map((f) => {
                const retryAction = mapFailureRetryAction(f.actionType);
                return (
                  <div key={f.id} className="afw-meta afw-meta--card">
                    <MetadataRow label="Action" value={f.actionType} />
                    <MetadataRow
                      label="Error"
                      value={f.errorMessage || f.errorCode || ""}
                    />
                    <MetadataRow
                      label="Created"
                      value={formatDateTime(f.createdAt)}
                    />
                    <MetadataRow
                      label="Retry count"
                      value={String(f.retryCount ?? 0)}
                    />
                    <MetadataRow
                      label="Resolved"
                      value={
                        f.resolvedAt ? formatDateTime(f.resolvedAt) : "Open"
                      }
                    />
                    <MetadataRow
                      label="Resolution"
                      value={f.resolution || ""}
                    />
                    {retryAction && f.retryable && !f.resolvedAt && (
                      <div className="afw-actions">
                        <button
                          className="btn"
                          onClick={() => handleRetry(retryAction)}
                        >
                          {mapFailureActionLabel(f.actionType)}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Status actions */}
        <div className="afw-block">
          <h4>Review Actions</h4>
          <div className="afw-actions">
            <button className="btn btn--danger" onClick={handleReject}>
              Reject
            </button>
          </div>
          <label className="afw-rejection-label">Rejection reason</label>
          <textarea
            className="afw-rejection-textarea"
            placeholder="Add context if you reject this item."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

function mapFailureActionLabel(actionType: string): string {
  if (actionType === "feedback.triage") return "Retry triage";
  if (actionType === "feedback.duplicate_search")
    return "Retry duplicate check";
  if (actionType === "feedback.promotion") return "Retry promotion";
  return "Retry";
}

function mapFailureRetryAction(actionType: string): string {
  if (actionType === "feedback.triage") return "triage";
  if (actionType === "feedback.duplicate_search") return "duplicate_check";
  if (actionType === "feedback.promotion") return "promotion";
  return "";
}

/* ── Main Component ──────────────────────────────────────────────── */

export function AdminFeedbackWorkflow() {
  const [selectedId, setSelectedId] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [automationOpen, setAutomationOpen] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const handleStatusChanged = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const showToast = useCallback(
    (message: string, type: "success" | "error") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
    },
    [],
  );

  return (
    <div className="afw">
      {/* Automation section — collapsible */}
      <section className="afw-collapsible">
        <button
          type="button"
          className="afw-collapsible__trigger"
          onClick={() => setAutomationOpen((o) => !o)}
          aria-expanded={automationOpen}
        >
          <svg
            className={`afw-collapsible__chevron${automationOpen ? " afw-collapsible__chevron--open" : ""}`}
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 4l4 4-4 4" />
          </svg>
          <span>Automation settings</span>
        </button>
        {automationOpen && (
          <div className="afw-collapsible__body">
            <AutomationPanel onSelectFeedback={setSelectedId} />
          </div>
        )}
      </section>

      {/* Queue + Detail master-detail section */}
      <section className="afw-section afw-section--fill">
        <div className="afw-section__header">
          <h3 className="afw-section__title">Feedback Queue</h3>
          <p className="afw-section__subtitle">
            Review incoming bugs and feature requests before promotion.
          </p>
        </div>
        <div className="afw-master-detail">
          <FeedbackQueue
            key={refreshKey}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onBatchComplete={handleStatusChanged}
            showToast={showToast}
          />
          {selectedId ? (
            <DetailPanel
              key={selectedId}
              feedbackId={selectedId}
              onStatusChanged={handleStatusChanged}
              showToast={showToast}
            />
          ) : (
            <div className="afw-detail afw-empty-block">
              Select a feedback item to inspect the full submission and
              metadata.
            </div>
          )}
        </div>
      </section>

      {/* Toast notification */}
      {toast && (
        <div className={`afw-toast afw-toast--${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
