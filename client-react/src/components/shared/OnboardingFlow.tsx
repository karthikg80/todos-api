import { useState, useCallback } from "react";
import type { CreateTodoDto } from "../../types";

interface Props {
  onComplete: () => void;
  onAddTodo: (dto: CreateTodoDto) => Promise<unknown>;
}

const STEPS = [
  {
    title: "Welcome to Todos",
    description:
      "Your personal task manager. Let's get you set up in a few quick steps.",
  },
  {
    title: "Add your first tasks",
    description:
      "Here are some sample tasks to get started. You can edit or delete them later.",
    sampleTasks: [
      "Review my weekly goals",
      "Organize my inbox",
      "Plan tomorrow's priorities",
    ],
  },
  {
    title: "You're all set!",
    description:
      "Start adding tasks, create projects, and use keyboard shortcuts (press ? for help).",
  },
];

export function OnboardingFlow({ onComplete, onAddTodo }: Props) {
  const [step, setStep] = useState(0);
  const [addedSamples, setAddedSamples] = useState(false);

  const current = STEPS[step];

  const handleAddSamples = useCallback(async () => {
    if (addedSamples) return;
    const tasks = STEPS[1].sampleTasks || [];
    for (const title of tasks) {
      await onAddTodo({ title });
    }
    setAddedSamples(true);
  }, [addedSamples, onAddTodo]);

  const handleNext = useCallback(() => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      localStorage.setItem("todos:onboarding-complete", "true");
      onComplete();
    }
  }, [step, onComplete]);

  const handleSkip = useCallback(() => {
    localStorage.setItem("todos:onboarding-complete", "true");
    onComplete();
  }, [onComplete]);

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <div className="onboarding-card__progress">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`onboarding-card__dot${i === step ? " onboarding-card__dot--active" : ""}${i < step ? " onboarding-card__dot--done" : ""}`}
            />
          ))}
        </div>

        <h2 className="onboarding-card__title">{current.title}</h2>
        <p className="onboarding-card__desc">{current.description}</p>

        {step === 1 && current.sampleTasks && (
          <div className="onboarding-card__samples">
            {current.sampleTasks.map((task) => (
              <div key={task} className="onboarding-card__sample">
                ✓ {task}
              </div>
            ))}
            {!addedSamples ? (
              <button
                className="btn"
                style={{
                  background: "var(--accent)",
                  color: "#fff",
                  borderColor: "var(--accent)",
                  marginTop: "var(--s-3)",
                }}
                onClick={handleAddSamples}
              >
                Add these tasks
              </button>
            ) : (
              <p
                style={{
                  color: "var(--success)",
                  fontSize: "var(--fs-meta)",
                  marginTop: "var(--s-3)",
                }}
              >
                Tasks added!
              </p>
            )}
          </div>
        )}

        <div className="onboarding-card__actions">
          <button className="btn" onClick={handleSkip}>
            Skip
          </button>
          <button
            className="btn"
            style={{
              background: "var(--accent)",
              color: "#fff",
              borderColor: "var(--accent)",
            }}
            onClick={handleNext}
          >
            {step === STEPS.length - 1 ? "Get Started" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
