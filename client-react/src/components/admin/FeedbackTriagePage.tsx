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
  duplicateCandidate: boolean;
  matchedFeedbackIds: string[] | null;
  matchedGithubIssueNumber: number | null;
  matchedGithubIssueUrl: string | null;
  duplicateOfFeedbackId: string | null;
  duplicateOfGithubIssueNumber: number | null;
  duplicateOfGithubIssueUrl: string | null;
  duplicateReason: string | null;
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

/* ── AI helpers ──────────────────────────────────────────────────── */

function aiSuggestionLabel(confidence: number): string {
  if (confidence >= 0.8) return "Promote";
  if (confidence >= 0.5) return "Review";
  return "Reject";
}

function aiStripVariant(confidence: number | null | undefined): string {
  if (confidence == null) return "none";
  if (confidence >= 0.8) return "promote";
  if (confidence >= 0.5) return "review";
  return "reject";
}

/* ── Failure retry helpers ───────────────────────────────────────── */

function mapFailureRetryAction(actionType: string): string {
  if (actionType === "feedback.triage") return "triage";
  if (actionType === "feedback.duplicate_search") return "duplicate_check";
  if (actionType === "feedback.promotion") return "promotion";
  return "";
}

function mapFailureActionLabel(actionType: string): string {
  if (actionType === "feedback.triage") return "Retry triage";
  if (actionType === "feedback.duplicate_search")
    return "Retry duplicate check";
  if (actionType === "feedback.promotion") return "Retry promotion";
  return "Retry";
}

/* ── Props ───────────────────────────────────────────────────────── */

interface Props {
  feedbackId: string;
  queueIds: string[];
  onBack: () => void;
  onNavigate: (id: string) => void;
  onStatusChanged: () => void;
  showToast: (message: string, type: "success" | "error") => void;
}

/* ── Main Component ──────────────────────────────────────────────── */

export function FeedbackTriagePage({
  feedbackId,
  queueIds,
  onBack,
  onNavigate,
  onStatusChanged,
  showToast,
}: Props) {
  const [item, setItem] = useState<FeedbackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<PromotionPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [failures, setFailures] = useState<PipelineFailure[]>([]);
  const [failuresLoading, setFailuresLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  /* ── Data loading ─────────────────────────────────────────────── */

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

  useEffect(() => {
    loadDetail();
    loadFailures();
  }, [loadDetail, loadFailures]);

  useEffect(() => {
    if (item) loadPreview();
  }, [item, loadPreview]);

  /* ── Action handlers ──────────────────────────────────────────── */

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

  /* ── Navigation ───────────────────────────────────────────────── */

  const currentIndex = queueIds.indexOf(feedbackId);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < queueIds.length - 1;

  const goPrev = () => {
    if (hasPrev) onNavigate(queueIds[currentIndex - 1]);
  };
  const goNext = () => {
    if (hasNext) onNavigate(queueIds[currentIndex + 1]);
  };

  /* ── Render ───────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="aft-page">
        <div className="aft-header">
          <button className="btn aft-back" onClick={onBack}>
            ← Queue
          </button>
        </div>
        <div className="loading" style={{ flex: 1 }}>
          <div className="spinner" />
          Loading details...
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="aft-page">
        <div className="aft-header">
          <button className="btn aft-back" onClick={onBack}>
            ← Queue
          </button>
        </div>
        <div className="afw-empty-block" style={{ flex: 1 }}>
          Feedback item not found.
        </div>
      </div>
    );
  }

  const confidence = item.triageConfidence;
  const stripVariant = aiStripVariant(confidence);
  const hasTriage = item.classification != null && confidence != null;

  const hasDuplicateData =
    item.duplicateCandidate ||
    item.duplicateOfFeedbackId ||
    item.duplicateOfGithubIssueNumber ||
    (Array.isArray(item.matchedFeedbackIds) &&
      item.matchedFeedbackIds.length > 0) ||
    item.matchedGithubIssueNumber;

  const attachmentSummary = item.attachmentMetadata
    ? `${item.attachmentMetadata.name || "Attachment"} \u2022 ${item.attachmentMetadata.type || "unknown"} \u2022 ${item.attachmentMetadata.size ?? 0} bytes`
    : "No attachment metadata";

  return (
    <div className="aft-page">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="aft-header">
        <button className="btn aft-back" onClick={onBack}>
          ← Queue
        </button>
        <h2 className="aft-title">
          Feedback: {item.normalizedTitle || item.title}
        </h2>
        <div className="aft-nav">
          <button className="btn" onClick={goPrev} disabled={!hasPrev}>
            ← Prev
          </button>
          <span className="aft-nav__pos">
            {currentIndex >= 0
              ? `${currentIndex + 1} / ${queueIds.length}`
              : ""}
          </span>
          <button className="btn" onClick={goNext} disabled={!hasNext}>
            Next →
          </button>
        </div>
      </div>

      {/* ── AI Suggestion Strip ───────────────────────────────────── */}
      <div className={`aft-ai-strip aft-ai-strip--${stripVariant}`}>
        {hasTriage ? (
          <>
            <span className="aft-ai-strip__label">
              AI suggests: {aiSuggestionLabel(confidence!)} &middot;{" "}
              {Math.round(confidence! * 100)}% confidence
            </span>
            <span className="aft-ai-strip__reason">
              {item.triageSummary || item.impactSummary || "No reason provided"}
            </span>
          </>
        ) : (
          <>
            <span className="aft-ai-strip__label">Not yet triaged</span>
            <button className="btn btn--primary" onClick={handleTriage}>
              Run triage
            </button>
          </>
        )}
      </div>

      {/* ── Action Bar ────────────────────────────────────────────── */}
      <div className="aft-actions">
        <button
          className="btn btn--primary"
          onClick={handlePromote}
          disabled={!!item.githubIssueNumber}
        >
          {item.githubIssueNumber
            ? `Promoted #${item.githubIssueNumber}`
            : "Promote to GitHub"}
        </button>
        <button className="btn btn--danger" onClick={handleReject}>
          Reject
        </button>
        <button className="btn" onClick={handleTriage}>
          {item.classification ? "Re-run triage" : "Run triage"}
        </button>
        <button className="btn" onClick={handleDuplicateCheck}>
          Check duplicates
        </button>
      </div>

      {/* ── Body (2-column) ───────────────────────────────────────── */}
      <div className="aft-body">
        {/* ── Left column (main reading) ─────────────────────────── */}
        <div className="aft-main">
          {/* Decision Summary */}
          <div className="afw-block">
            <h4>Decision Summary</h4>
            <div className="afw-meta">
              <MetadataRow
                label="Normalized title"
                value={item.normalizedTitle || item.title}
              />
              <MetadataRow
                label="Suggested action"
                value={
                  hasTriage
                    ? `${aiSuggestionLabel(confidence!)} (${formatConfidence(confidence)})`
                    : "Pending triage"
                }
              />
              <MetadataRow label="Impact" value={item.impactSummary || ""} />
              <MetadataRow label="Severity" value={item.severity || ""} />
            </div>
          </div>

          {/* Expected vs Actual */}
          {(item.expectedBehavior || item.actualBehavior) && (
            <div className="afw-block">
              <h4>Expected vs Actual</h4>
              <div className="afw-meta">
                <MetadataRow
                  label="Expected"
                  value={item.expectedBehavior || ""}
                />
                <MetadataRow label="Actual" value={item.actualBehavior || ""} />
              </div>
            </div>
          )}

          {/* Reporter Submission */}
          <div className="afw-block">
            <h4>Reporter Submission</h4>
            <pre className="afw-pre">{item.body}</pre>
          </div>

          {/* AI Triage Details */}
          <div className="afw-block">
            <div className="afw-block__header">
              <h4>AI Triage Details</h4>
              <button className="btn" onClick={handleTriage}>
                {item.classification ? "Regenerate" : "Run triage"}
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
                label="Normalized body"
                value={item.normalizedBody || "No triage output yet."}
              />
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
              <div className="afw-block">
                <h4>Issue body</h4>
                <pre className="afw-pre">{preview.body}</pre>
              </div>
            </div>
          ) : null}

          {/* Attachments */}
          <div className="afw-block">
            <h4>Attachments</h4>
            <div className="afw-meta">
              <MetadataRow
                label="Screenshot URL"
                value={item.screenshotUrl || ""}
              />
              <MetadataRow label="Attachment" value={attachmentSummary} />
            </div>
          </div>

          {/* Metadata */}
          <div className="afw-block">
            <h4>Metadata</h4>
            <div className="afw-meta">
              <MetadataRow
                label="User"
                value={item.user?.email || item.userId}
              />
              <MetadataRow
                label="Reviewer"
                value={item.reviewer?.email || ""}
              />
              <MetadataRow
                label="Submitted"
                value={formatDateTime(item.createdAt)}
              />
              <MetadataRow
                label="Reviewed at"
                value={item.reviewedAt ? formatDateTime(item.reviewedAt) : ""}
              />
              <MetadataRow
                label="Promoted at"
                value={item.promotedAt ? formatDateTime(item.promotedAt) : ""}
              />
              <MetadataRow label="Page URL" value={item.pageUrl || ""} />
              <MetadataRow label="Browser" value={item.userAgent || ""} />
              <MetadataRow label="App version" value={item.appVersion || ""} />
            </div>
          </div>

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
        </div>

        {/* ── Right column (sticky rail) ─────────────────────────── */}
        <div className="aft-rail">
          {/* Review Status */}
          <div className="afw-block">
            <h4>Review Status</h4>
            <div className="aft-rail-pills">
              <Pill variant="status">{item.status}</Pill>
              <Pill variant={item.type}>{item.type}</Pill>
              {item.classification && (
                <Pill variant="status">{item.classification}</Pill>
              )}
            </div>
            {hasTriage && (
              <div className="aft-confidence-bar">
                <div className="aft-confidence-bar__label">
                  Confidence: {formatConfidence(confidence)}
                </div>
                <div className="aft-confidence-bar__track">
                  <div
                    className={`aft-confidence-bar__fill aft-confidence-bar__fill--${stripVariant}`}
                    style={{ width: `${Math.round((confidence ?? 0) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="afw-block">
            <h4>Quick Actions</h4>
            <div className="aft-rail-actions">
              <button
                className="btn btn--primary"
                onClick={handlePromote}
                disabled={!!item.githubIssueNumber}
              >
                {item.githubIssueNumber
                  ? `Promoted #${item.githubIssueNumber}`
                  : "Promote"}
              </button>
              <button className="btn btn--danger" onClick={handleReject}>
                Reject
              </button>
              <button className="btn" onClick={handleTriage}>
                {item.classification ? "Re-triage" : "Triage"}
              </button>
            </div>
          </div>

          {/* GitHub */}
          <div className="afw-block">
            <h4>GitHub</h4>
            {item.githubIssueNumber && item.githubIssueUrl ? (
              <div className="afw-meta">
                <MetadataRow
                  label="Issue"
                  value={`#${item.githubIssueNumber}`}
                />
              </div>
            ) : (
              <p className="afw-empty">Not yet promoted</p>
            )}
            {item.githubIssueUrl && (
              <a
                className="afw-link"
                href={item.githubIssueUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open GitHub issue
              </a>
            )}
            {!item.githubIssueNumber && (
              <button
                className="btn btn--primary"
                onClick={handlePromote}
                style={{ marginTop: "var(--s-2)" }}
              >
                Create issue
              </button>
            )}
          </div>

          {/* Rejection */}
          <div className="afw-block">
            <h4>Rejection</h4>
            <textarea
              className="afw-rejection-textarea"
              placeholder="Add context if you reject this item."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
            <button className="btn btn--danger" onClick={handleReject}>
              Reject with reason
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
