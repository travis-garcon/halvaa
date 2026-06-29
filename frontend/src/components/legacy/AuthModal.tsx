"use client";

import { ClipboardEvent, FormEvent, KeyboardEvent, useRef, useState } from "react";
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
  const { startOtp, verifyOtp, googleLogin } = useAuth();
  const googleEnabled = Boolean(process.env.NEXT_PUBLIC_GOOGLE_AUTH_URL);
  const [step, setStep] = useState<"start" | "verify">("start");
  const [otpId, setOtpId] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState<string[]>(["", "", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const codeInputs = useRef<Array<HTMLInputElement | null>>([]);

  if (!open) return null;

  const resetForm = () => {
    setStep("start");
    setOtpId(null);
    setIdentifier("");
    setCode(["", "", "", ""]);
    setError(null);
    setNotice(null);
  };

  const close = () => {
    resetForm();
    onClose();
  };

  const handleStart = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await startOtp({
        identifier: identifier.trim(),
        locale,
      });
      setOtpId(response.otp_id);
      setStep("verify");
      setNotice(t("otp_sent"));
      window.setTimeout(() => codeInputs.current[0]?.focus(), 80);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("error_generic"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!otpId) return;
    const otpCode = code.join("");
    if (otpCode.length !== 4) {
      setError(t("error_invalid"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await verifyOtp(otpId, otpCode);
      close();
    } catch (err) {
      const message = err instanceof ApiError && err.status === 401 ? t("error_invalid") : err instanceof ApiError ? err.message : t("error_generic");
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const setCodeAt = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    setCode((current) => {
      const next = [...current];
      next[index] = digit;
      return next;
    });
    if (digit && index < 3) {
      codeInputs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !code[index] && index > 0) {
      codeInputs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4).split("");
    if (pasted.length === 0) return;
    const next = ["", "", "", ""];
    pasted.forEach((digit, index) => {
      next[index] = digit;
    });
    setCode(next);
    codeInputs.current[Math.min(pasted.length, 4) - 1]?.focus();
  };

  return (
    <div className="modal active modal-entrance" id="authModal">
      <div
        className="modal-overlay"
        onClick={close}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") close();
        }}
        role="button"
        tabIndex={0}
        aria-label="Close modal"
      />
      <div className="modal-content auth-modal">
        <button type="button" className="modal-close" onClick={close} aria-label="Close">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <div className="auth-header">
          <h1 className="auth-logo">Halvaa</h1>
          <p className="auth-tagline">{t("tagline")}</p>
        </div>

        <button type="button" className="google-auth-button" onClick={googleLogin} disabled={!googleEnabled} aria-disabled={!googleEnabled}>
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4c-.2 1.2-.9 2.3-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.3Z" />
            <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.5L15.4 17c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6C4.7 19.7 8.1 22 12 22Z" />
            <path fill="#FBBC05" d="M6.4 13.8a6 6 0 0 1 0-3.6V7.6H3.1a10 10 0 0 0 0 8.8l3.3-2.6Z" />
            <path fill="#EA4335" d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.9C17 3 14.7 2 12 2 8.1 2 4.7 4.3 3.1 7.6l3.3 2.6c.8-2.3 3-4.1 5.6-4.1Z" />
          </svg>
          <span>{googleEnabled ? t("sign_in_sso") : t("sign_in_sso_soon")}</span>
        </button>

        <div className="auth-divider">
          <span>{t("or_email")}</span>
        </div>

        {step === "start" ? (
          <form className="auth-form active" onSubmit={handleStart}>
            <div className="form-group">
              <label htmlFor="otp-identifier" className="sr-only">{t("identifier")}</label>
              <input
                id="otp-identifier"
                type="text"
                className="form-input"
                placeholder={t("identifier")}
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                autoComplete="username"
                required
                disabled={submitting}
                dir="auto"
              />
            </div>
            {error && <p className="auth-error feedback-error text-sm">{error}</p>}
            <button type="submit" className={"btn-primary btn-full" + (submitting ? " btn-loading" : "")} disabled={submitting}>
              <span>{submitting ? t("otp_sending") : t("otp_send")}</span>
            </button>
          </form>
        ) : (
          <form className="auth-form active" onSubmit={handleVerify}>
            {notice && <p className="auth-notice text-sm text-muted" role="status">{notice}</p>}
            <div className="otp-code-row" dir="ltr" aria-label={t("otp_code")}>
              {code.map((digit, index) => (
                <input
                  // eslint-disable-next-line react/no-array-index-key
                  key={index}
                  ref={(input) => {
                    codeInputs.current[index] = input;
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="otp-digit-input"
                  value={digit}
                  onChange={(event) => setCodeAt(index, event.target.value)}
                  onKeyDown={(event) => handleCodeKeyDown(index, event)}
                  onPaste={handleCodePaste}
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  aria-label={`${t("otp_code")} ${index + 1}`}
                  maxLength={1}
                  required
                  disabled={submitting}
                />
              ))}
            </div>
            {error && <p className="auth-error feedback-error text-sm">{error}</p>}
            <button type="submit" className={"btn-primary btn-full" + (submitting ? " btn-loading" : "")} disabled={submitting}>
              <span>{submitting ? t("otp_verifying") : t("otp_verify")}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
