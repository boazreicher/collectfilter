(() => {
  // --- State ---
  const allRequests = [];
  let paused = false;
  let columns = JSON.parse(localStorage.getItem("cf-columns") || "[]");

  // --- DOM refs ---
  const urlPatternInput = document.getElementById("url-pattern");
  const payloadRegexInput = document.getElementById("payload-regex");
  const pauseBtn = document.getElementById("pause-btn");
  const clearBtn = document.getElementById("clear-btn");
  const requestList = document.getElementById("request-list");
  const statusEl = document.getElementById("status");
  const countsEl = document.getElementById("counts");
  const detailOverlay = document.getElementById("detail-overlay");
  const detailTitle = document.getElementById("detail-title");
  const detailContent = document.getElementById("detail-content");
  const detailClose = document.getElementById("detail-close");
  const detailTabs = document.querySelectorAll(".detail-tabs .tab");
  const columnChips = document.getElementById("column-chips");
  const addColumnInput = document.getElementById("add-column-input");

  // --- Helpers ---
  function safeRegex(pattern) {
    if (!pattern) return null;
    try {
      return new RegExp(pattern, "i");
    } catch {
      return null;
    }
  }

  function formatTime(date) {
    return date.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 });
  }

  function truncate(str, maxLen = 160) {
    if (!str) return "";
    return str.length > maxLen ? str.slice(0, maxLen) + "…" : str;
  }

  function prettyJson(str) {
    try {
      return JSON.stringify(JSON.parse(str), null, 2);
    } catch {
      return str || "(empty)";
    }
  }

  // Syntax-highlight JSON and optionally overlay regex matches
  function colorizeJson(jsonStr, regex) {
    // Tokenize the pretty-printed JSON with a single regex
    // Capture groups: 1=key, 2=string value, 3=number, 4=bool/null
    const tokenPattern = /("(?:\\.|[^"\\])*")\s*:/g;
    const valuePattern = /("(?:\\.|[^"\\])*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b|(true|false|null)\b/g;

    // First pass: escape HTML
    const escaped = escapeHtml(jsonStr);

    // Colorize in a single pass over the escaped string
    let colored = escaped
      // Keys (property names followed by colon)
      .replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;)\s*:/g,
        '<span class="json-key">$1</span>:')
      // String values (not already wrapped as keys)
      .replace(/(<span class="json-key">(?:(?!<\/span>).)*<\/span>:\s*)?(&quot;(?:[^&]|&(?!quot;))*?&quot;)/g,
        (match, keyPart, strVal) => {
          if (keyPart) return match; // already handled as key: value
          return `<span class="json-string">${strVal}</span>`;
        })
      // Numbers
      .replace(/\b(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g,
        '<span class="json-number">$1</span>')
      // Booleans and null
      .replace(/\b(true|false)\b/g, '<span class="json-bool">$1</span>')
      .replace(/\bnull\b/g, '<span class="json-null">null</span>');

    // Second pass: overlay regex matches with <mark> (inside or across spans)
    if (regex) {
      try {
        const global = new RegExp(regex.source, "gi");
        // Apply marks on the visible-text layer by stripping tags, matching, then reinserting
        // Simpler approach: just mark in the raw text positions
        colored = colored.replace(global, match => `<mark>${match}</mark>`);
      } catch { /* ignore */ }
    }

    return colored;
  }

  function highlightMatches(text, regex) {
    if (!regex) return escapeHtml(text);
    const escaped = escapeHtml(text);
    try {
      const global = new RegExp(regex.source, "gi");
      return escaped.replace(global, match => `<mark>${match}</mark>`);
    } catch {
      return escaped;
    }
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Recursively find the first leaf value matching a field name (case-insensitive)
  function findLeafValue(obj, fieldName) {
    if (obj === null || obj === undefined) return undefined;
    if (typeof obj !== "object") return undefined;

    const lowerField = fieldName.toLowerCase();

    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = findLeafValue(item, fieldName);
        if (found !== undefined) return found;
      }
      return undefined;
    }

    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (key.toLowerCase() === lowerField && (typeof val !== "object" || val === null)) {
        return val;
      }
    }
    // Recurse into nested objects
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val === "object" && val !== null) {
        const found = findLeafValue(val, fieldName);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  }

  function formatValue(val) {
    if (typeof val === "number") return String(Math.trunc(val));
    return String(val);
  }

  function extractColumnValue(entry, fieldName) {
    if (!entry.parsedPayload) {
      try {
        entry.parsedPayload = JSON.parse(entry.payload);
      } catch {
        entry.parsedPayload = null;
      }
    }
    if (!entry.parsedPayload) return "—";
    const val = findLeafValue(entry.parsedPayload, fieldName);
    return val === undefined ? "—" : formatValue(val);
  }

  // --- Column management ---
  function saveColumns() {
    localStorage.setItem("cf-columns", JSON.stringify(columns));
  }

  function addColumn(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (columns.some(c => c.toLowerCase() === trimmed.toLowerCase())) return;
    columns.push(trimmed);
    saveColumns();
    renderColumnChips();
    render();
  }

  function removeColumn(name) {
    columns = columns.filter(c => c !== name);
    saveColumns();
    renderColumnChips();
    render();
  }

  function renderColumnChips() {
    columnChips.innerHTML = "";
    for (const col of columns) {
      const chip = document.createElement("span");
      chip.className = "column-chip";
      chip.innerHTML = `${escapeHtml(col)}<button class="chip-remove" data-col="${escapeHtml(col)}">✕</button>`;
      chip.querySelector(".chip-remove").addEventListener("click", (e) => {
        e.stopPropagation();
        removeColumn(col);
      });
      columnChips.appendChild(chip);
    }
  }

  addColumnInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      addColumn(addColumnInput.value);
      addColumnInput.value = "";
    }
  });

  // --- Filtering ---
  function getFilteredRequests() {
    const urlRegex = safeRegex(urlPatternInput.value);
    const payloadRegex = safeRegex(payloadRegexInput.value);

    return allRequests.filter(entry => {
      if (urlRegex && !urlRegex.test(entry.url)) return false;
      if (payloadRegex && !payloadRegex.test(entry.payload)) return false;
      return true;
    });
  }

  // --- Rendering ---
  function render() {
    const filtered = getFilteredRequests();
    countsEl.textContent = `${filtered.length} / ${allRequests.length} requests`;

    if (filtered.length === 0) {
      statusEl.textContent = allRequests.length === 0
        ? "Waiting for requests…"
        : "No requests match the current filters";
      requestList.innerHTML = "";
      return;
    }

    statusEl.textContent = paused ? "⏸ Paused" : "● Capturing";
    const payloadRegex = safeRegex(payloadRegexInput.value);

    const fragment = document.createDocumentFragment();
    // Render in reverse chronological order
    for (let i = filtered.length - 1; i >= 0; i--) {
      const entry = filtered[i];
      const row = document.createElement("div");
      row.className = "request-row";
      row.dataset.index = entry.index;

      const time = document.createElement("span");
      time.className = "req-time";
      time.textContent = formatTime(entry.time);

      const method = document.createElement("span");
      method.className = `req-method method-${entry.method.toLowerCase()}`;
      method.textContent = entry.method;

      const url = document.createElement("span");
      url.className = "req-url";
      url.textContent = truncate(entry.url, 80);
      url.title = entry.url;

      const preview = document.createElement("span");
      preview.className = "req-preview";
      preview.innerHTML = highlightMatches(truncate(entry.payload, 200), payloadRegex);

      row.append(time, method, url);

      // Custom columns
      for (const col of columns) {
        const cell = document.createElement("span");
        cell.className = "req-col";
        cell.textContent = truncate(extractColumnValue(entry, col), 60);
        cell.title = `${col}: ${extractColumnValue(entry, col)}`;
        row.appendChild(cell);
      }

      row.appendChild(preview);
      row.addEventListener("click", () => showDetail(entry));
      fragment.appendChild(row);
    }

    requestList.innerHTML = "";
    requestList.appendChild(fragment);
  }

  // --- Detail overlay ---
  let currentDetailEntry = null;
  let currentTab = "payload";

  function showDetail(entry) {
    currentDetailEntry = entry;
    detailOverlay.classList.remove("hidden");
    detailTitle.textContent = `${entry.method} ${entry.url}`;
    renderDetailTab(currentTab);
  }

  function renderDetailTab(tab) {
    currentTab = tab;
    detailTabs.forEach(t => t.classList.toggle("active", t.dataset.tab === tab));

    if (!currentDetailEntry) return;

    const payloadRegex = safeRegex(payloadRegexInput.value);

    switch (tab) {
      case "payload": {
        const pretty = prettyJson(currentDetailEntry.payload);
        detailContent.innerHTML = colorizeJson(pretty, payloadRegex);
        break;
      }
      case "headers": {
        const headers = currentDetailEntry.requestHeaders
          .map(h => `${h.name}: ${h.value}`)
          .join("\n");
        detailContent.innerHTML = escapeHtml(headers || "(no headers captured)");
        break;
      }
      case "response": {
        if (currentDetailEntry.harEntry) {
          currentDetailEntry.harEntry.getContent((body) => {
            detailContent.innerHTML = colorizeJson(prettyJson(body || "(empty)"), null);
          });
        } else {
          detailContent.innerHTML = "(response not available)";
        }
        break;
      }
    }
  }

  detailClose.addEventListener("click", () => {
    detailOverlay.classList.add("hidden");
    currentDetailEntry = null;
  });

  detailOverlay.addEventListener("click", (e) => {
    if (e.target === detailOverlay) {
      detailOverlay.classList.add("hidden");
      currentDetailEntry = null;
    }
  });

  detailTabs.forEach(tab => {
    tab.addEventListener("click", () => renderDetailTab(tab.dataset.tab));
  });

  // --- Network capture ---
  chrome.devtools.network.onRequestFinished.addListener((harEntry) => {
    if (paused) return;

    const request = harEntry.request;
    const payload = request.postData ? request.postData.text : "";

    const entry = {
      index: allRequests.length,
      time: new Date(harEntry.startedDateTime),
      method: request.method,
      url: request.url,
      payload: payload || "",
      requestHeaders: request.headers || [],
      status: harEntry.response.status,
      harEntry: harEntry,
    };

    allRequests.push(entry);
    render();
  });

  // --- Event handlers ---
  let renderDebounce = null;
  function debouncedRender() {
    clearTimeout(renderDebounce);
    renderDebounce = setTimeout(render, 150);
  }

  urlPatternInput.addEventListener("input", debouncedRender);
  payloadRegexInput.addEventListener("input", debouncedRender);

  // Visual feedback for invalid regex
  [urlPatternInput, payloadRegexInput].forEach(input => {
    input.addEventListener("input", () => {
      if (input.value && !safeRegex(input.value)) {
        input.classList.add("invalid");
      } else {
        input.classList.remove("invalid");
      }
    });
  });

  pauseBtn.addEventListener("click", () => {
    paused = !paused;
    pauseBtn.textContent = paused ? "▶" : "⏸";
    pauseBtn.title = paused ? "Resume capture" : "Pause capture";
    render();
  });

  clearBtn.addEventListener("click", () => {
    allRequests.length = 0;
    render();
  });

  // Keyboard shortcut: Escape closes detail
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !detailOverlay.classList.contains("hidden")) {
      detailOverlay.classList.add("hidden");
      currentDetailEntry = null;
    }
  });

  renderColumnChips();
  render();
})();
