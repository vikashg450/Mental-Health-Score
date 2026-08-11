(() => {
  "use strict";

  // Dynamic API Base URL resolution: use local origin when served via web server, or fallback to local backend server
  const API_BASE = window.location.protocol.startsWith("http")
    ? window.location.origin
    : "http://localhost:8000";

  // DOM Elements
  const htmlEl = document.documentElement;
  const themeToggleBtn = document.getElementById("theme-toggle-btn");
  const form = document.getElementById("predict-form");
  const submitBtn = document.getElementById("submit-btn");
  const resetBtn = document.getElementById("reset-btn");
  const copyBtn = document.getElementById("copy-btn");
  const errorRetryBtn = document.getElementById("error-retry-btn");
  const toastEl = document.getElementById("toast");

  const stateIdle = document.getElementById("state-idle");
  const stateLoading = document.getElementById("state-loading");
  const stateResult = document.getElementById("state-result");
  const stateError = document.getElementById("state-error");

  const scoreNumberEl = document.getElementById("score-number");
  const scoreBandEl = document.getElementById("score-band");
  const scoreContextEl = document.getElementById("score-context");
  const gaugeFill = document.getElementById("gauge-fill");
  const gaugeNeedle = document.getElementById("gauge-needle");
  const errorLabelEl = document.getElementById("error-label");
  const errorCopyEl = document.getElementById("error-copy");

  const bdSleepVal = document.getElementById("bd-sleep-val");
  const bdScreenVal = document.getElementById("bd-screen-val");
  const bdActivityVal = document.getElementById("bd-activity-val");
  const bdStressVal = document.getElementById("bd-stress-val");

  const GAUGE_ARC_LENGTH = 314;

  // ---------------------------------------------------------
  // THEME MANAGEMENT (Light / Dark Mode)
  // ---------------------------------------------------------
  function initTheme() {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      htmlEl.setAttribute("data-theme", savedTheme);
    } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      htmlEl.setAttribute("data-theme", dark);
    } else {
      htmlEl.setAttribute("data-theme", "light");
    }
  }

  themeToggleBtn.addEventListener("click", () => {
    const currentTheme = htmlEl.getAttribute("data-theme") || "light";
    const newTheme = currentTheme === "light" ? "dark" : "light";
    htmlEl.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
  });

  initTheme();

  // ---------------------------------------------------------
  // Draw tick marks on gauge SVG
  // ---------------------------------------------------------
  function drawTicks() {
    document.querySelectorAll(".gauge-ticks").forEach((g) => {
      g.innerHTML = "";
      const cx = 120, cy = 140, rOuter = 100, rInner = 90;
      for (let i = 0; i <= 10; i += 2) {
        const angle = Math.PI - (i / 10) * Math.PI;
        const x1 = cx + rOuter * Math.cos(angle);
        const y1 = cy - rOuter * Math.sin(angle);
        const x2 = cx + rInner * Math.cos(angle);
        const y2 = cy - rInner * Math.sin(angle);
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", x1.toFixed(1));
        line.setAttribute("y1", y1.toFixed(1));
        line.setAttribute("x2", x2.toFixed(1));
        line.setAttribute("y2", y2.toFixed(1));
        g.appendChild(line);
      }
    });
  }
  drawTicks();

  // ---------------------------------------------------------
  // Segmented control (stress_level) wiring
  // ---------------------------------------------------------
  const segGroup = document.getElementById("stress_level_group");
  const stressHiddenInput = document.getElementById("stress_level");
  segGroup.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      segGroup.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      stressHiddenInput.value = btn.dataset.value;
      clearFieldError(stressHiddenInput);
    });
  });

  // ---------------------------------------------------------
  // QUICK PRESETS POPULATOR
  // ---------------------------------------------------------
  const PRESETS = {
    balanced: {
      age: 21,
      gender: "Male",
      country: "India",
      academic_level: "Undergraduate",
      most_used_platform: "LinkedIn",
      purpose_of_use: "Education",
      avg_daily_usage_hours: 3.5,
      daily_unlocks: 45,
      study_hours: 5.0,
      physical_activity_hours: 1.5,
      sleep_hours_per_night: 7.5,
      stress_level: "Low",
    },
    crammer: {
      age: 22,
      gender: "Female",
      country: "USA",
      academic_level: "Graduate",
      most_used_platform: "Instagram",
      purpose_of_use: "Entertainment",
      avg_daily_usage_hours: 8.5,
      daily_unlocks: 120,
      study_hours: 8.5,
      physical_activity_hours: 0.5,
      sleep_hours_per_night: 4.5,
      stress_level: "Very High",
    },
    nightowl: {
      age: 20,
      gender: "Male",
      country: "Canada",
      academic_level: "Undergraduate",
      most_used_platform: "YouTube",
      purpose_of_use: "Entertainment",
      avg_daily_usage_hours: 9.0,
      daily_unlocks: 90,
      study_hours: 4.0,
      physical_activity_hours: 1.0,
      sleep_hours_per_night: 6.0,
      stress_level: "Medium",
    },
  };

  document.querySelectorAll(".preset-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const presetKey = chip.dataset.preset;
      const data = PRESETS[presetKey];
      if (!data) return;

      Object.keys(data).forEach((key) => {
        if (key === "stress_level") {
          stressHiddenInput.value = data[key];
          segGroup.querySelectorAll(".seg-btn").forEach((b) => {
            b.classList.toggle("active", b.dataset.value === data[key]);
          });
        } else {
          const field = document.getElementById(key);
          if (field) field.value = data[key];
        }
      });
      clearAllErrors();

      // Show temporary highlight animation on fields
      form.classList.add("preset-filled");
      setTimeout(() => form.classList.remove("preset-filled"), 500);
    });
  });

  // ---------------------------------------------------------
  // Field Error Helpers
  // ---------------------------------------------------------
  function fieldWrapper(input) {
    return input ? input.closest(".field") : null;
  }

  function setFieldError(input, message) {
    const wrap = fieldWrapper(input);
    if (!wrap) return;
    wrap.classList.add("field-error");
    const msgEl = wrap.querySelector(".error-msg");
    if (msgEl) msgEl.textContent = message;
  }

  function clearFieldError(input) {
    const wrap = fieldWrapper(input);
    if (!wrap) return;
    wrap.classList.remove("field-error");
    const msgEl = wrap.querySelector(".error-msg");
    if (msgEl) msgEl.textContent = "";
  }

  function clearAllErrors() {
    form.querySelectorAll(".field").forEach((f) => f.classList.remove("field-error"));
    form.querySelectorAll(".error-msg").forEach((m) => (m.textContent = ""));
  }

  // ---------------------------------------------------------
  // Client-side Validation
  // ---------------------------------------------------------
  function validate(payload) {
    const errors = [];

    const numericChecks = [
      ["age", 10, 100],
      ["avg_daily_usage_hours", 0, 24],
      ["daily_unlocks", 0, Infinity],
      ["study_hours", 0, 24],
      ["physical_activity_hours", 0, 24],
      ["sleep_hours_per_night", 0, 24],
    ];

    numericChecks.forEach(([key, min, max]) => {
      const input = document.getElementById(key);
      const val = payload[key];
      if (val === "" || val === null || Number.isNaN(val)) {
        errors.push([input, "This field is required."]);
      } else if (val < min || val > max) {
        errors.push([input, `Must be between ${min} and ${max === Infinity ? "0+" : max}.`]);
      }
    });

    ["gender", "country", "academic_level", "most_used_platform", "purpose_of_use"].forEach((key) => {
      const input = document.getElementById(key);
      if (!payload[key] || String(payload[key]).trim() === "") {
        errors.push([input, "This field is required."]);
      }
    });

    if (!payload.stress_level) {
      errors.push([stressHiddenInput, "Pick a stress level."]);
    }

    return errors;
  }

  // ---------------------------------------------------------
  // Gather Payload
  // ---------------------------------------------------------
  function collectPayload() {
    const fd = new FormData(form);
    return {
      age: fd.get("age") === "" ? NaN : parseInt(fd.get("age"), 10),
      gender: fd.get("gender") || "",
      country: (fd.get("country") || "").trim(),
      academic_level: fd.get("academic_level") || "",
      most_used_platform: fd.get("most_used_platform") || "",
      purpose_of_use: fd.get("purpose_of_use") || "",
      avg_daily_usage_hours: fd.get("avg_daily_usage_hours") === "" ? NaN : parseFloat(fd.get("avg_daily_usage_hours")),
      daily_unlocks: fd.get("daily_unlocks") === "" ? NaN : parseInt(fd.get("daily_unlocks"), 10),
      study_hours: fd.get("study_hours") === "" ? NaN : parseFloat(fd.get("study_hours")),
      physical_activity_hours: fd.get("physical_activity_hours") === "" ? NaN : parseFloat(fd.get("physical_activity_hours")),
      sleep_hours_per_night: fd.get("sleep_hours_per_night") === "" ? NaN : parseFloat(fd.get("sleep_hours_per_night")),
      stress_level: fd.get("stress_level") || "",
    };
  }

  // ---------------------------------------------------------
  // UI State Switching
  // ---------------------------------------------------------
  function showState(name) {
    [stateIdle, stateLoading, stateResult, stateError].forEach((el) => (el.hidden = true));
    ({ idle: stateIdle, loading: stateLoading, result: stateResult, error: stateError }[name]).hidden = false;
  }

  function setSubmitting(isSubmitting) {
    submitBtn.disabled = isSubmitting;
    submitBtn.classList.toggle("loading", isSubmitting);
  }

  function bandFor(score) {
    if (score < 4) {
      return {
        label: "Signal: Strained",
        context: "Your habits point to elevated fatigue & stress right now. Small increases in sleep or reduction in screen time can trigger positive momentum.",
      };
    }
    if (score < 7) {
      return {
        label: "Signal: Balanced",
        context: "Your rhythm looks steady with moderate resilience. Balanced habits are protecting your focus and wellbeing.",
      };
    }
    return {
      label: "Signal: Strong Baseline",
      context: "Your routines support high physical and mental resilience. Excellent balance across sleep, activity, and digital usage.",
    };
  }

  function updateBreakdown(payload) {
    if (bdSleepVal) {
      bdSleepVal.textContent = payload.sleep_hours_per_night >= 7 ? "Optimal" : "Deficit";
    }
    if (bdScreenVal) {
      bdScreenVal.textContent = payload.avg_daily_usage_hours <= 4 ? "Low" : payload.avg_daily_usage_hours <= 8 ? "Moderate" : "High";
    }
    if (bdActivityVal) {
      bdActivityVal.textContent = payload.physical_activity_hours >= 1.5 ? "Active" : payload.physical_activity_hours >= 0.5 ? "Moderate" : "Low";
    }
    if (bdStressVal) {
      bdStressVal.textContent = payload.stress_level;
    }
  }

  let currentScore = 0;
  let currentPayload = null;

  function renderResult(score, payload) {
    currentScore = score;
    currentPayload = payload;
    const clamped = Math.max(0, Math.min(10, score));
    const { label, context } = bandFor(clamped);

    scoreNumberEl.textContent = score.toFixed(2);
    scoreBandEl.textContent = label;
    scoreContextEl.textContent = context;

    updateBreakdown(payload);

    // Gauge Arc Fill & Needle Rotation Animation
    gaugeFill.style.transition = "none";
    gaugeFill.style.strokeDashoffset = String(GAUGE_ARC_LENGTH);
    if (gaugeNeedle) {
      gaugeNeedle.style.transition = "none";
      gaugeNeedle.style.transform = "rotate(0deg)";
    }

    requestAnimationFrame(() => {
      gaugeFill.style.transition = "";
      const offset = GAUGE_ARC_LENGTH * (1 - clamped / 10);
      gaugeFill.style.strokeDashoffset = String(offset);

      if (gaugeNeedle) {
        gaugeNeedle.style.transition = "transform 1.2s cubic-bezier(0.22, 1, 0.36, 1)";
        const angleDeg = (clamped / 10) * 180;
        gaugeNeedle.style.transform = `rotate(${angleDeg}deg)`;
      }
    });

    showState("result");
  }

  function renderError(label, copy) {
    if (errorLabelEl) errorLabelEl.textContent = label;
    if (errorCopyEl) errorCopyEl.textContent = copy;
    showState("error");
  }

  function applyServerValidationErrors(detail) {
    if (!Array.isArray(detail)) return false;
    let matched = false;
    detail.forEach((err) => {
      const field = Array.isArray(err.loc) ? err.loc[err.loc.length - 1] : null;
      const input = field ? document.getElementById(field) : null;
      const target = field === "stress_level" ? stressHiddenInput : input;
      if (target) {
        setFieldError(target, err.msg || "Invalid value.");
        matched = true;
      }
    });
    return matched;
  }

  // ---------------------------------------------------------
  // Toast Helper
  // ---------------------------------------------------------
  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    setTimeout(() => toastEl.classList.remove("show"), 2500);
  }

  // ---------------------------------------------------------
  // Submit Handler
  // ---------------------------------------------------------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAllErrors();

    const payload = collectPayload();
    const clientErrors = validate(payload);

    if (clientErrors.length > 0) {
      clientErrors.forEach(([input, msg]) => input && setFieldError(input, msg));
      clientErrors[0][0]?.focus?.();
      return;
    }

    setSubmitting(true);
    showState("loading");

    try {
      const res = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 422) {
        const body = await res.json().catch(() => null);
        const matched = body && applyServerValidationErrors(body.detail);
        renderError(
          "Validation Error",
          matched
            ? "A few fields need your attention — details are marked on the form."
            : "The prediction engine rejected this input. Please review form entries."
        );
        return;
      }

      if (!res.ok) {
        let detailMsg = `Server returned HTTP status ${res.status}.`;
        const body = await res.json().catch(() => null);
        if (body && typeof body.detail === "string") detailMsg = body.detail;
        renderError("Prediction Error", detailMsg);
        return;
      }

      const data = await res.json();
      if (typeof data.predicted_mental_health_score !== "number") {
        renderError("Invalid Response", "The model server returned an invalid or empty score.");
        return;
      }

      renderResult(data.predicted_mental_health_score, payload);
    } catch (err) {
      renderError(
        "Connection Error",
        `Could not reach API server at ${API_BASE}. Ensure the FastAPI server is running.`
      );
    } finally {
      setSubmitting(false);
    }
  });

  // Copy result handler
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      if (!currentScore) return;
      const text = `🧠 Mental Health Signal Score: ${currentScore.toFixed(2)}/10\n📊 Status: ${scoreBandEl.textContent}\n🛌 Sleep: ${bdSleepVal.textContent}\n📱 Screen Time: ${bdScreenVal.textContent}\n🏃 Physical Activity: ${bdActivityVal.textContent}\n⚡ Stress Level: ${bdStressVal.textContent}`;
      navigator.clipboard.writeText(text).then(() => {
        showToast("Result copied to clipboard!");
      }).catch(() => {
        showToast("Failed to copy result.");
      });
    });
  }

  // Live input error clearing
  form.querySelectorAll("input, select").forEach((el) => {
    el.addEventListener("input", () => clearFieldError(el));
    el.addEventListener("change", () => clearFieldError(el));
  });

  resetBtn.addEventListener("click", () => showState("idle"));
  errorRetryBtn.addEventListener("click", () => showState("idle"));
})();
