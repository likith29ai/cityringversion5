"use client";

import { addDaysToIstInput, formatDuration, istInputToIso, nowIstInput } from "../lib/groupValidity";

export type ValidityFormState = {
  enabled: boolean;
  start: string; // IST "YYYY-MM-DDTHH:mm"
  expiry: string; // IST "YYYY-MM-DDTHH:mm"
};

export const EMPTY_VALIDITY: ValidityFormState = { enabled: false, start: "", expiry: "" };

/** Returns an error message, or null when valid (or when validity is disabled). */
export function validateValidity(v: ValidityFormState): string | null {
  if (!v.enabled) return null;
  const s = istInputToIso(v.start);
  const e = istInputToIso(v.expiry);
  if (!s) return "Start date & time is required.";
  if (!e) return "Expiry date & time is required.";
  if (new Date(e).getTime() <= new Date(s).getTime()) return "Expiry must be later than the start date.";
  return null;
}

const inputStyle = { padding: 10, borderRadius: 10, border: "1px solid #e5e7eb", background: "white" } as const;

export default function GroupValidityFields({
  value,
  onChange,
  showExtend = false,
}: {
  value: ValidityFormState;
  onChange: (v: ValidityFormState) => void;
  showExtend?: boolean;
}) {
  const startIso = istInputToIso(value.start);
  const expiryIso = istInputToIso(value.expiry);
  const error = validateValidity(value);
  const duration = !error ? formatDuration(startIso, expiryIso) : "";

  function toggle(enabled: boolean) {
    if (enabled && !value.start && !value.expiry) {
      const start = nowIstInput();
      onChange({ enabled, start, expiry: addDaysToIstInput(start, 30) });
      return;
    }
    onChange({ ...value, enabled });
  }

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        background: "#fafafa",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Group Validity</div>

      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
        <input type="checkbox" checked={value.enabled} onChange={(e) => toggle(e.target.checked)} />
        <span style={{ fontWeight: 600 }}>Enable Group Validity</span>
      </label>

      {!value.enabled && (
        <span style={{ fontSize: 12, opacity: 0.7, display: "block", marginTop: 8 }}>
          Off: the group has no start or expiry date and works as normal.
        </span>
      )}

      {value.enabled && (
        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Start Date &amp; Time (IST)</span>
            <input
              type="datetime-local"
              value={value.start}
              onChange={(e) => onChange({ ...value, start: e.target.value })}
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Expiry Date &amp; Time (IST)</span>
            <input
              type="datetime-local"
              value={value.expiry}
              min={value.start || undefined}
              onChange={(e) => onChange({ ...value, expiry: e.target.value })}
              style={inputStyle}
            />
          </label>

          {showExtend && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, opacity: 0.7 }}>Extend expiry:</span>
              {[7, 15, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...value,
                      expiry: addDaysToIstInput(value.expiry || value.start || nowIstInput(), d),
                    })
                  }
                  style={{
                    padding: "6px 10px",
                    borderRadius: 10,
                    border: "1px solid #e5e7eb",
                    background: "white",
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  +{d} days
                </button>
              ))}
            </div>
          )}

          {error ? (
            <div style={{ fontSize: 13, color: "#b91c1c", fontWeight: 600 }}>{error}</div>
          ) : (
            <div style={{ fontWeight: 700 }}>Total Duration: {duration}</div>
          )}
          <span style={{ fontSize: 12, opacity: 0.7 }}>
            Times are entered in India Standard Time (Asia/Kolkata). Duration is calculated automatically.
          </span>
        </div>
      )}
    </div>
  );
}
