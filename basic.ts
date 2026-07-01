interface ApplicationPayload {
  name: string;
  email: string;
  country: string;
  note: string;
}

interface ApplicationResponse {
  id: number;
  queue_position: number;
  cycle: string;
  status: "received" | "duplicate";
}

interface StatusResponse {
  cycle: string;
  allocation_total: number;
  applications_received: number;
  spots_remaining: number;
}

type FieldName = keyof ApplicationPayload;

interface ValidationRule {
  test: (value: string) => boolean;
  message: string;
}

const VALIDATION_RULES: Record<FieldName, ValidationRule[]> = {
  name: [
    { test: (v) => v.trim().length >= 2, message: "Enter your full name." },
  ],
  email: [
    {
      test: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
      message: "Enter a valid email address.",
    },
  ],
  country: [
    { test: (v) => v.trim().length >= 2, message: "Enter your country." },
  ],
  note: [
    { test: (v) => v.trim().length >= 20, message: "Tell us a little more — 20 characters minimum." },
    { test: (v) => v.trim().length <= 600, message: "Keep it under 600 characters." },
  ],
};

class MeridianClient {
  constructor(private readonly baseUrl: string) {}

  async getStatus(): Promise<StatusResponse> {
    const res = await fetch(`${this.baseUrl}/status`);
    if (!res.ok) throw new Error(`Status request failed: ${res.status}`);
    return res.json() as Promise<StatusResponse>;
  }

  async submitApplication(payload: ApplicationPayload): Promise<ApplicationResponse> {
    const res = await fetch(`${this.baseUrl}/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.status === 429) {
      throw new Error("Too many attempts. Wait a moment before trying again.");
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: "Application could not be submitted." }));
      throw new Error(typeof body.detail === "string" ? body.detail : "Application could not be submitted.");
    }
    return res.json() as Promise<ApplicationResponse>;
  }
}

function validateField(field: FieldName, value: string): string | null {
  const rules = VALIDATION_RULES[field];
  for (const rule of rules) {
    if (!rule.test(value)) return rule.message;
  }
  return null;
}

function validatePayload(payload: ApplicationPayload): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {};
  (Object.keys(payload) as FieldName[]).forEach((field) => {
    const error = validateField(field, payload[field]);
    if (error) errors[field] = error;
  });
  return errors;
}

function setFieldError(field: FieldName, message: string | null): void {
  const input = document.getElementById(`field-${field}`) as HTMLInputElement | HTMLTextAreaElement | null;
  const errorEl = document.querySelector<HTMLSpanElement>(`.field-error[data-for="${field}"]`);
  if (!input || !errorEl) return;
  if (message) {
    input.classList.add("invalid");
    errorEl.textContent = message;
  } else {
    input.classList.remove("invalid");
    errorEl.textContent = "";
  }
}

function readPayload(form: HTMLFormElement): ApplicationPayload {
  const data = new FormData(form);
  return {
    name: String(data.get("name") ?? "").trim(),
    email: String(data.get("email") ?? "").trim(),
    country: String(data.get("country") ?? "").trim(),
    note: String(data.get("note") ?? "").trim(),
  };
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

async function refreshStatus(client: MeridianClient): Promise<void> {
  const statusEl = document.getElementById("spots-status");
  if (!statusEl) return;
  try {
    const status = await client.getStatus();
    if (status.spots_remaining > 0) {
      statusEl.textContent = `${status.spots_remaining} of ${status.allocation_total} build slots remain in cycle ${status.cycle}.`;
    } else {
      statusEl.textContent = `Cycle ${status.cycle} allocation is full. Applications open for the waitlist only.`;
    }
  } catch {
    statusEl.textContent = "Allocation status is unavailable right now — applications are still open.";
  }
}

function wireForm(client: MeridianClient): void {
  const form = document.getElementById("application-form") as HTMLFormElement | null;
  const submitBtn = document.getElementById("submit-btn") as HTMLButtonElement | null;
  const formStatus = document.getElementById("form-status");
  const resultBox = document.getElementById("apply-result");
  if (!form || !submitBtn || !formStatus || !resultBox) return;

  (Object.keys(VALIDATION_RULES) as FieldName[]).forEach((field) => {
    const input = document.getElementById(`field-${field}`);
    input?.addEventListener("blur", () => {
      const payload = readPayload(form);
      setFieldError(field, validateField(field, payload[field]));
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = readPayload(form);
    const errors = validatePayload(payload);

    (Object.keys(VALIDATION_RULES) as FieldName[]).forEach((field) => {
      setFieldError(field, errors[field] ?? null);
    });

    if (Object.keys(errors).length > 0) {
      formStatus.textContent = "Fix the highlighted fields and try again.";
      return;
    }

    submitBtn.disabled = true;
    formStatus.textContent = "Submitting…";
    resultBox.hidden = true;

    try {
      const response = await client.submitApplication(payload);
      formStatus.textContent = "";
      resultBox.hidden = false;

      if (response.status === "duplicate") {
        resultBox.innerHTML = `We already have an application on file for this email for cycle <strong>${response.cycle}</strong>. You're holding position <strong>${ordinal(response.queue_position)}</strong>.`;
      } else {
        resultBox.innerHTML = `Application received for cycle <strong>${response.cycle}</strong>. You're currently at position <strong>${ordinal(response.queue_position)}</strong> pending review.`;
      }

      form.reset();
    } catch (err) {
      formStatus.textContent = err instanceof Error ? err.message : "Something went wrong.";
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function resolveApiBase(): string {
  const meta = document.querySelector('meta[name="meridian-api-base"]');
  const configured = meta?.getAttribute("content");
  return configured && configured.length > 0 ? configured : "/api";
}

document.addEventListener("DOMContentLoaded", () => {
  const client = new MeridianClient(resolveApiBase());
  void refreshStatus(client);
  wireForm(client);
});
