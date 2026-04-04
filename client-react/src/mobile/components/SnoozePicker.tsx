import { useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSnooze: (date: string) => void;
}

function laterToday(): string {
  const now = new Date();
  const target = new Date(now);
  const fivePm = new Date(now);
  fivePm.setHours(17, 0, 0, 0);
  if (now < fivePm) {
    target.setHours(17, 0, 0, 0);
  } else {
    target.setTime(now.getTime() + 3 * 60 * 60 * 1000);
  }
  return target.toISOString().slice(0, 10);
}

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function nextMonday(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + daysUntilMonday);
  return d.toISOString().slice(0, 10);
}

function formatDisplay(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function SnoozePicker({ open, onClose, onSnooze }: Props) {
  const [showDateInput, setShowDateInput] = useState(false);
  const [pickedDate, setPickedDate] = useState("");

  if (!open) return null;

  const laterTodayDate = laterToday();
  const tomorrowDate = tomorrow();
  const nextMondayDate = nextMonday();

  const handleOption = (date: string) => {
    onSnooze(date);
    setShowDateInput(false);
    setPickedDate("");
  };

  const handlePickDate = () => {
    if (showDateInput) {
      if (pickedDate) handleOption(pickedDate);
    } else {
      setShowDateInput(true);
    }
  };

  const handleBackdropClick = () => {
    setShowDateInput(false);
    setPickedDate("");
    onClose();
  };

  return (
    <>
      <div className="m-snooze__backdrop" onClick={handleBackdropClick} />
      <div className="m-snooze" role="dialog" aria-modal="true" aria-label="Snooze task">
        <div className="m-snooze__handle-bar" />
        <div className="m-snooze__title">Snooze until…</div>
        <button className="m-snooze__option" onClick={() => handleOption(laterTodayDate)}>
          <span className="m-snooze__option-label">Later Today</span>
          <span className="m-snooze__option-detail">{formatDisplay(laterTodayDate)} · 5 pm</span>
        </button>
        <button className="m-snooze__option" onClick={() => handleOption(tomorrowDate)}>
          <span className="m-snooze__option-label">Tomorrow</span>
          <span className="m-snooze__option-detail">{formatDisplay(tomorrowDate)} · 9 am</span>
        </button>
        <button className="m-snooze__option" onClick={() => handleOption(nextMondayDate)}>
          <span className="m-snooze__option-label">Next Week</span>
          <span className="m-snooze__option-detail">{formatDisplay(nextMondayDate)} · Mon 9 am</span>
        </button>
        <button className="m-snooze__option" onClick={handlePickDate}>
          <span className="m-snooze__option-label">Pick a date</span>
          {showDateInput ? (
            <input
              className="m-snooze__date"
              type="date"
              value={pickedDate}
              min={new Date().toISOString().slice(0, 10)}
              autoFocus
              onChange={(e) => setPickedDate(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="m-snooze__option-detail">Choose a date</span>
          )}
        </button>
        {showDateInput && pickedDate && (
          <button className="m-snooze__confirm" onClick={() => handleOption(pickedDate)}>
            Snooze to {formatDisplay(pickedDate)}
          </button>
        )}
      </div>
    </>
  );
}
