"use client";

import { FormEvent, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api-client";

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
};

export function AuthModal({ open, onClose }: AuthModalProps) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const { login, register, zitadelLogin } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotNotice, setForgotNotice] = useState(false);

  if (!open) return null;

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setFullName("");
    setError(null);
  };

  const handleModeChange = (nextMode: "signin" | "signup") => {
    setMode(nextMode);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (mode === "signin") {
        await login(email.trim(), password);
      } else {
        await register({
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          locale,
        });
      }
      resetForm();
      onClose();
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 401
          ? t("error_invalid")
          : err instanceof ApiError
            ? err.message
            : t("error_generic");
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal active modal-entrance" id="authModal">
      <div
        className="modal-overlay"
        onClick={onClose}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onClose(); }}
        role="button"
        tabIndex={0}
        aria-label="Close modal"
      />
      <div className="modal-content auth-modal">
        <button type="button" className="modal-close" onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <div className="auth-header">
          <h1 className="auth-logo">Halvaa</h1>
          <p className="auth-tagline">{t("tagline")}</p>
        </div>

        <button
          type="button"
          className="btn-primary btn-full"
          onClick={zitadelLogin}
          style={{ marginBottom: "1rem" }}
        >
          {t("sign_in_sso")}
        </button>

        <div className="auth-divider">
          <span>{t("or_email")}</span>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab${mode === "signin" ? " active" : ""}`}
            onClick={() => handleModeChange("signin")}
          >
            {t("sign_in")}
          </button>
          <button
            type="button"
            className={`auth-tab${mode === "signup" ? " active" : ""}`}
            onClick={() => handleModeChange("signup")}
          >
            {t("sign_up")}
          </button>
        </div>

        {mode === "signin" ? (
          <form className="auth-form active" id="signinForm" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="signin-email" className="sr-only">{t("email")}</label>
              <input
                id="signin-email"
                type="email"
                className="form-input"
                placeholder={t("email")}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                disabled={submitting}
              />
            </div>
            <div className="form-group">
              <label htmlFor="signin-password" className="sr-only">{t("password")}</label>
              <input
                id="signin-password"
                type="password"
                className="form-input"
                placeholder={t("password")}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                minLength={8}
                required
                disabled={submitting}
              />
            </div>
            <button
              type="button"
              className="forgot-link cursor-pointer"
              onClick={() => setForgotNotice(true)}
              disabled={submitting}
            >
              {t("forgot_password")}
            </button>
            {forgotNotice && (
              <p className="auth-notice" role="status" style={{ fontSize: "0.875rem", color: "var(--halvaa-text-muted)" }}>
                {t("forgot_password_notice")}
              </p>
            )}
            {error && (
              <p className="auth-error feedback-error" style={{ fontSize: "0.875rem" }}>
                {error}
              </p>
            )}
            <button type="submit" className={"btn-primary btn-full" + (submitting ? " btn-loading" : "")} disabled={submitting}>
              <span>{submitting ? t("signing_in") : t("sign_in")}</span>
            </button>
          </form>
        ) : (
          <form className="auth-form active" id="signupForm" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="signup-name" className="sr-only">{t("full_name")}</label>
              <input
                id="signup-name"
                type="text"
                className="form-input"
                placeholder={t("full_name")}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="name"
                required
                disabled={submitting}
              />
            </div>
            <div className="form-group">
              <label htmlFor="signup-email" className="sr-only">{t("email")}</label>
              <input
                id="signup-email"
                type="email"
                className="form-input"
                placeholder={t("email")}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                disabled={submitting}
              />
            </div>
            <div className="form-group">
              <label htmlFor="signup-password" className="sr-only">{t("password")}</label>
              <input
                id="signup-password"
                type="password"
                className="form-input"
                placeholder={t("password")}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                disabled={submitting}
              />
            </div>
            {error && (
              <p className="auth-error feedback-error" style={{ fontSize: "0.875rem" }}>
                {error}
              </p>
            )}
            <button type="submit" className={"btn-primary btn-full" + (submitting ? " btn-loading" : "")} disabled={submitting}>
              <span>{submitting ? t("signing_up") : t("sign_up")}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
