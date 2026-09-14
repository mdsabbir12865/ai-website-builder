.github-connect {
  width: 100%;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  color: #111827;
  font-family: Arial, Helvetica, sans-serif;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

.github-connect * {
  box-sizing: border-box;
}

/* CONNECT BUTTON */

.github-connect-button {
  width: 100%;
  min-height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  background: #111827;
  color: #ffffff;

  border: 1px solid #111827;
  border-radius: 10px;

  padding: 11px 16px;

  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;

  cursor: pointer;
  transition: background 0.15s ease,
    border-color 0.15s ease;
}

.github-connect-button:hover {
  background: #1f2937;
  border-color: #1f2937;
}

.github-connect-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.github-symbol {
  font-size: 18px;
  line-height: 1;
}

/* CONNECTED BUTTON */

.github-connected {
  width: 100%;
  min-height: 46px;

  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;

  background: #f0fdf4;
  color: #166534;

  border: 1px solid #bbf7d0;
  border-radius: 10px;

  padding: 11px 14px;

  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;

  cursor: pointer;
}

.github-connected:hover {
  background: #dcfce7;
}

.github-connected:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.github-login {
  font-weight: 500;
}

/* CARD */

.github-card {
  width: 100%;

  background: #ffffff;
  color: #111827;

  border: 1px solid #e5e7eb;
  border-radius: 12px;

  padding: 16px;
}

.github-card-title {
  color: #111827;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
  margin-bottom: 12px;
}

/* INPUTS */

.github-input,
.github-textarea {
  width: 100%;

  color: #111827 !important;
  background: #ffffff !important;

  border: 1px solid #d1d5db;
  border-radius: 8px;

  padding: 11px 12px;

  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;

  outline: none;

  margin-bottom: 8px;
}

.github-input::placeholder,
.github-textarea::placeholder {
  color: #9ca3af !important;
  opacity: 1;
}

.github-input:focus,
.github-textarea:focus {
  border-color: #6b7280;
  box-shadow: 0 0 0 2px rgba(107, 114, 128, 0.1);
}

.github-input:disabled,
.github-textarea:disabled {
  background: #f9fafb !important;
  cursor: not-allowed;
}

.github-textarea {
  min-height: 90px;
  resize: vertical;
}

/* CHECKBOX */

.github-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;

  color: #374151;

  margin: 4px 0 12px;

  font-size: 14px;
  line-height: 1.4;

  cursor: pointer;
}

.github-checkbox input {
  width: 16px;
  height: 16px;
  margin: 0;
}

/* CREATE BUTTON */

.github-create-button {
  width: 100%;

  background: #111827;
  color: #ffffff;

  border: 1px solid #111827;
  border-radius: 8px;

  padding: 10px 16px;

  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;

  cursor: pointer;
}

.github-create-button:hover {
  background: #1f2937;
}

.github-create-button:disabled {
  background: #9ca3af;
  border-color: #9ca3af;
  cursor: not-allowed;
}

/* REPOSITORY HEADER */

.github-repo-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  margin-bottom: 12px;
}

.github-repo-header .github-card-title {
  margin-bottom: 0;
}

/* REFRESH */

.github-refresh-button {
  flex-shrink: 0;

  background: #ffffff;
  color: #374151;

  border: 1px solid #d1d5db;
  border-radius: 7px;

  padding: 7px 11px;

  font-family: inherit;
  font-size: 12px;
  font-weight: 600;

  cursor: pointer;
}

.github-refresh-button:hover {
  background: #f3f4f6;
}

.github-refresh-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* REPOSITORY LIST */

.github-repo-list {
  display: flex;
  flex-direction: column;
  gap: 8px;

  max-height: 320px;
  overflow-y: auto;
}

.github-repo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  background: #ffffff;
  color: #111827;

  border: 1px solid #e5e7eb;
  border-radius: 9px;

  padding: 12px;
}

.github-repo-info {
  min-width: 0;
}

.github-repo strong {
  color: #111827;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.4;

  word-break: break-word;
}

.github-repo-meta {
  color: #6b7280;

  font-size: 12px;
  line-height: 1.4;

  margin-top: 4px;
}

.github-repo-description {
  color: #6b7280;

  font-size: 13px;
  line-height: 1.45;

  margin-top: 4px;

  word-break: break-word;
}

.github-view-link {
  flex-shrink: 0;

  color: #2563eb;

  font-size: 13px;
  font-weight: 600;

  text-decoration: none;
}

.github-view-link:hover {
  text-decoration: underline;
}

/* MUTED TEXT */

.github-muted {
  color: #6b7280;

  font-size: 13px;
  line-height: 1.5;

  margin: 0;
}

/* ERROR */

.github-error {
  color: #dc2626;

  background: #fef2f2;

  border: 1px solid #fecaca;
  border-radius: 8px;

  padding: 9px 11px;

  font-size: 13px;
  line-height: 1.45;
}

/* MOBILE */

@media (max-width: 480px) {
  .github-connect {
    max-width: 100%;
  }

  .github-card {
    padding: 14px;
  }

  .github-repo {
    align-items: flex-start;
  }

  .github-repo-header {
    align-items: flex-start;
  }
}