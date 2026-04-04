import { useState, useCallback } from "react";
import { IllustrationSwipe, IllustrationCapture, IllustrationTap } from "./Illustrations";

const ONBOARDING_KEY = "mobile:onboardingDone";

interface Step {
  icon: React.ReactNode;
  title: string;
  desc: string;
}

const STEPS: Step[] = [
  { icon: <IllustrationSwipe />, title: "Swipe to act", desc: "Swipe right to complete a task. Swipe left to snooze." },
  { icon: <IllustrationCapture />, title: "Quick capture", desc: "Tap the + button to add a task in seconds." },
  { icon: <IllustrationTap />, title: "Tap for details", desc: "Tap any task to see details. Drag up for more." },
];

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(ONBOARDING_KEY) === "1");

  const handleNext = useCallback(() => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      localStorage.setItem(ONBOARDING_KEY, "1");
      setDismissed(true);
    }
  }, [step]);

  const handleSkip = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, "1");
    setDismissed(true);
  }, []);

  if (dismissed) return null;

  const current = STEPS[step];

  return (
    <div className="m-onboarding__backdrop">
      <div className="m-onboarding">
        <div className="m-onboarding__icon">{current.icon}</div>
        <h2 className="m-onboarding__title">{current.title}</h2>
        <p className="m-onboarding__desc">{current.desc}</p>

        <div className="m-onboarding__dots">
          {STEPS.map((_, i) => (
            <div key={i} className={`m-onboarding__dot${i === step ? " m-onboarding__dot--active" : ""}`} />
          ))}
        </div>

        <div className="m-onboarding__actions">
          <button className="m-onboarding__skip" onClick={handleSkip}>Skip</button>
          <button className="m-onboarding__next" onClick={handleNext}>
            {step < STEPS.length - 1 ? "Next" : "Get started"}
          </button>
        </div>
      </div>
    </div>
  );
}
