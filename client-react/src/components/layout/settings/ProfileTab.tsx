import { useState, useCallback, useEffect } from "react";
import { useAuth } from "../../../auth/AuthProvider";
import { apiCall } from "../../../api/client";
import { Field } from "../../shared/Field";

export function ProfileTab() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [sendingVerification, setSendingVerification] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState("");

  useEffect(() => {
    setName(user?.name || "");
    setEmail(user?.email || "");
  }, [user?.name, user?.email]);

  const handleSaveProfile = useCallback(async () => {
    if (!user) return;

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    setSavingProfile(true);
    setProfileMessage("");
    try {
      const res = await apiCall("/users/me", {
        method: "PUT",
        body: JSON.stringify({
          name: trimmedName || null,
          email: trimmedEmail,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setProfileMessage(
          (err as { error?: string }).error || "Failed to save profile",
        );
        return;
      }
      const updated = await res.json();
      setUser(updated);
      setProfileMessage(
        trimmedEmail !== user.email
          ? "Profile updated. Please verify your new email."
          : "Profile saved.",
      );
    } catch {
      setProfileMessage("Network error");
    } finally {
      setSavingProfile(false);
    }
  }, [email, name, setUser, user]);

  const resendVerification = useCallback(async () => {
    if (!user?.email) return;
    setSendingVerification(true);
    setVerificationMessage("");
    try {
      const res = await apiCall("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email: user.email }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setVerificationMessage(
          (err as { error?: string }).error ||
            "Could not send verification email",
        );
        return;
      }
      setVerificationMessage("Verification email sent.");
    } catch {
      setVerificationMessage("Network error");
    } finally {
      setSendingVerification(false);
    }
  }, [user?.email]);

  const profileDirty =
    (name.trim() || "") !== (user?.name || "") ||
    email.trim().toLowerCase() !== (user?.email || "");

  return (
    <section className="settings-section">
      <div className="settings-grid">
        <Field label="Name" htmlFor="settingsName">
          <input
            id="settingsName"
            className="settings-field__input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field
          label="Email"
          htmlFor="settingsEmail"
          help="Changing your email will require verification again."
        >
          <input
            id="settingsEmail"
            className="settings-field__input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </Field>
      </div>

      <div
        className={`settings-status${user?.isVerified ? " settings-status--good" : " settings-status--warning"}`}
      >
        <div>
          <div className="settings-status__title">
            {user?.isVerified ? "Email verified" : "Email verification pending"}
          </div>
          <p className="settings-status__copy">
            {user?.isVerified
              ? "Your account email is verified."
              : "Verify your email to keep account recovery and linked sessions healthy."}
          </p>
        </div>
        {!user?.isVerified && (
          <button
            className="btn"
            onClick={resendVerification}
            disabled={sendingVerification}
          >
            {sendingVerification ? "Sending…" : "Resend verification"}
          </button>
        )}
      </div>

      {verificationMessage && (
        <p className="settings-message">{verificationMessage}</p>
      )}
      {profileMessage && (
        <p id="profileMessage" className="settings-message">
          {profileMessage}
        </p>
      )}
      <button
        className="btn"
        onClick={handleSaveProfile}
        disabled={!profileDirty || savingProfile}
      >
        {savingProfile ? "Saving…" : "Save profile"}
      </button>

      <p className="settings-meta">
        Logged in as <strong>{user?.email}</strong>
      </p>
      <DataExportButton />
    </section>
  );
}

function DataExportButton() {
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  const handleExport = useCallback(async () => {
    setExporting(true);
    setMessage("");
    try {
      const res = await apiCall("/users/me/export");
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "todos-export.json";
        a.click();
        URL.revokeObjectURL(url);
        setMessage("Export downloaded");
      } else if (res.status === 429) {
        setMessage("Export limited to once per hour");
      } else {
        setMessage("Export failed");
      }
    } catch {
      setMessage("Network error");
    } finally {
      setExporting(false);
      setTimeout(() => setMessage(""), 3000);
    }
  }, []);

  return (
    <Field label="Data export" htmlFor="settingsDataExport" layout="row">
      <div className="settings-actions">
        <button
          id="settingsDataExport"
          className="btn"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? "Exporting…" : "Download JSON"}
        </button>
        {message && <span className="settings-meta">{message}</span>}
      </div>
    </Field>
  );
}
