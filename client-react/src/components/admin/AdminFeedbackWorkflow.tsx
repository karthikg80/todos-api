import { useState, useEffect, useCallback } from "react";
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

function FeedbackQueue({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [items, setItems] = useState<FeedbackListItem[]>([]);
  const [loading, setLoading] = useState(true);

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
      </div>

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
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`afw-row${item.id === selectedId ? " is-selected" : ""}`}
              onClick={() => onSelect(item.id)}
            >
              <div className="afw-row__top">
                <Pill variant={item.type}>{item.type}</Pill>
                <Pill variant="status">{item.status}</Pill>
              </div>
              <strong className="afw-row__title">{item.title}</strong>
              <div className="afw-row__meta">
                <span>{item.user?.email || item.userId}</span>
                <span>{formatDateTime(item.createdAt)}</span>
              </div>
            </button>
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
}: {
  feedbackId: string;
  onStatusChanged: () => void;
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
    await apiCall(`/admin/feedback/${encodeURIComponent(feedbackId)}/triage`, {
      method: "POST",
    });
    await loadDetail();
  };

  const handleDuplicateCheck = async () => {
    await apiCall(
      `/admin/feedback/${encodeURIComponent(feedbackId)}/duplicate-check`,
      {
        method: "POST",
      },
    );
    await loadDetail();
  };

  const handlePromote = async () => {
    await apiCall(`/admin/feedback/${encodeURIComponent(feedbackId)}/promote`, {
      method: "POST",
    });
    await loadDetail();
    onStatusChanged();
  };

  const handleReject = async () => {
    await apiCall(`/admin/feedback/${encodeURIComponent(feedbackId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "rejected",
        rejectionReason: rejectionReason || undefined,
      }),
    });
    await loadDetail();
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

  const handleStatusChanged = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

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
          />
          {selectedId ? (
            <DetailPanel
              key={selectedId}
              feedbackId={selectedId}
              onStatusChanged={handleStatusChanged}
            />
          ) : (
            <div className="afw-detail afw-empty-block">
              Select a feedback item to inspect the full submission and
              metadata.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
