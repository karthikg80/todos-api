import { useState, useCallback, useEffect } from "react";
import { apiCall } from "../../../api/client";
import { Field } from "../../shared/Field";

interface Props {
  onOpenTuneUp: () => void;
}

export function DangerTab({ onOpenTuneUp }: Props) {
  return (
    <section className="settings-section">
      <Field
        label="Tune-up"
        htmlFor="settingsOpenTuneUp"
        help="Review stale tasks, clean up projects, and improve task quality."
        layout="row"
      >
        <button id="settingsOpenTuneUp" className="btn" onClick={onOpenTuneUp}>
          Open Tune-up
        </button>
      </Field>

      <Field
        label="Onboarding"
        htmlFor="settingsRestartOnboarding"
        help="Re-run the intro flow with your current account."
        layout="row"
      >
        <button
          id="settingsRestartOnboarding"
          className="btn"
          onClick={() => {
            localStorage.removeItem("todos:onboarding-complete");
            window.location.reload();
          }}
        >
          Restart onboarding
        </button>
      </Field>

      <Field
        label="Archived Projects"
        help="Restore or permanently delete archived projects."
      >
        <ArchivedProjectsSection />
      </Field>
    </section>
  );
}

function ArchivedProjectsSection() {
  const [projects, setProjects] = useState<
    Array<{ id: string; name: string; archivedAt: string | null }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);

  const fetchArchived = useCallback(async () => {
    try {
      const res = await apiCall("/projects");
      if (!res.ok) return;
      const all = await res.json();
      setProjects(all.filter((p: any) => p.archived));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchArchived();
  }, [fetchArchived]);

  const handleUnarchive = async (id: string) => {
    setActionInFlight(id);
    try {
      await apiCall(`/projects/${id}`, {
        method: "PUT",
        body: JSON.stringify({ archived: false }),
      });
      await fetchArchived();
    } finally {
      setActionInFlight(null);
    }
  };

  const handleDelete = async (id: string) => {
    setActionInFlight(id);
    try {
      await apiCall(`/projects/${id}?taskDisposition=unsorted`, {
        method: "DELETE",
      });
      await fetchArchived();
    } finally {
      setActionInFlight(null);
    }
  };

  if (loading)
    return <p className="settings-meta">Loading archived projects...</p>;
  if (projects.length === 0)
    return <p className="settings-meta">No archived projects.</p>;

  return (
    <div className="settings-archived-list">
      {projects.map((p) => (
        <div key={p.id} className="settings-archived-item">
          <span className="settings-archived-item__name">{p.name}</span>
          <div className="settings-archived-item__actions">
            <button
              className="btn"
              onClick={() => handleUnarchive(p.id)}
              disabled={actionInFlight === p.id}
            >
              Restore
            </button>
            <button
              className="btn btn--danger"
              onClick={() => handleDelete(p.id)}
              disabled={actionInFlight === p.id}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
