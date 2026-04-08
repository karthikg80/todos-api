// Helper functions extracted from FeedbackView.tsx for testing.
// These are the pure utility functions used by the FeedbackView component.

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case "new": return "Submitted";
    case "triaged": return "Under review";
    case "promoted": return "Tracked";
    case "rejected": return "Closed";
    case "resolved": return "Resolved";
    default: return status;
  }
}

export function statusClass(status: string): string {
  switch (status) {
    case "new": return "feedback-list__status--new";
    case "triaged": return "feedback-list__status--triaged";
    case "promoted": return "feedback-list__status--promoted";
    default: return "feedback-list__status--new";
  }
}

export function typeLabel(type: string): string {
  switch (type) {
    case "bug": return "Bug";
    case "feature": return "Feature";
    case "general": return "Feedback";
    default: return type;
  }
}

export function typeClass(type: string): string {
  switch (type) {
    case "bug": return "feedback-list__type--bug";
    case "feature": return "feedback-list__type--feature";
    default: return "feedback-list__type--bug";
  }
}
