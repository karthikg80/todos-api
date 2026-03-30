import { useState, useEffect, useCallback, useRef } from "react";
import { apiCall } from "../../api/client";

interface Suggestion {
  id: string;
  field: string;
  value: string;
  reason: string;
}

interface Props {
  title: string;
  onApplySuggestion: (field: string, value: string) => void;
}

export function AiOnCreateAssist({ title, onApplySuggestion }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastTitleRef = useRef("");

  // Debounced fetch suggestions when title changes
  useEffect(() => {
    const trimmed = title.trim();
    if (trimmed.length < 5 || trimmed === lastTitleRef.current) return;

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      lastTitleRef.current = trimmed;
      setLoading(true);
      try {
        const res = await apiCall(
          "/ai/decision-assist/stub",
          {
            method: "POST",
            body: JSON.stringify({
              surface: "on_create",
              context: { title: trimmed },
            }),
          },
        );
        if (res.ok) {
          const data = await res.json();
          const items: Suggestion[] = (data.suggestions || []).map(
            (s: { field?: string; value?: string; reason?: string }, i: number) => ({
              id: `${i}`,
              field: s.field || "",
              value: s.value || "",
              reason: s.reason || "",
            }),
          );
          setSuggestions(items);
          setApplied(new Set());
        }
      } catch {
        // Fail silently — AI assist is optional
      } finally {
        setLoading(false);
      }
    }, 600);

    return () => clearTimeout(debounceRef.current);
  }, [title]);

  const handleApply = useCallback(
    (s: Suggestion) => {
      onApplySuggestion(s.field, s.value);
      setApplied((prev) => new Set(prev).add(s.id));
    },
    [onApplySuggestion],
  );

  if (!loading && suggestions.length === 0) return null;

  return (
    <div data-testid="ai-on-create-row" className="ai-on-create">
      {loading && (
        <div className="ai-on-create__loading">Analyzing task…</div>
      )}
      {suggestions.map((s) => (
        <div key={s.id} className="ai-on-create__chip">
          <span className="ai-on-create__chip-text">
            <strong>{s.field}:</strong> {s.value}
            {s.reason && (
              <span className="ai-on-create__chip-reason"> — {s.reason}</span>
            )}
          </span>
          {applied.has(s.id) ? (
            <span className="ai-on-create__chip-applied">Applied</span>
          ) : (
            <button
              data-testid={`ai-chip-apply-oc-${s.id}`}
              className="ai-on-create__chip-btn"
              onClick={() => handleApply(s)}
            >
              Apply
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
