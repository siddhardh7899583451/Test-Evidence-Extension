/**
 * Test Evidence Extension – popup logic
 * Capture screenshots + structured metadata, edit/delete, filter, export.
 */

let currentPageInfo = { title: "", url: "", userAgent: "", viewport: null };
let editingIndex = null;
let allEvidence = [];

const $ = (id) => document.getElementById(id);
const recordButton = $("recordButton");
const updateButton = $("updateButton");
const cancelButton = $("cancelButton");
const messageEl = $("message");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function parseTags(raw) {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(/[,;]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

function setMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.classList.toggle("error", isError);
}

function clearForm() {
  $("testName").value = "";
  $("expected").value = "";
  $("actual").value = "";
  $("status").value = "PASS";
  $("tags").value = "";
  $("notes").value = "";
}

function exitEditMode() {
  editingIndex = null;
  recordButton.hidden = false;
  updateButton.hidden = true;
  cancelButton.hidden = true;
}

function getFormData() {
  return {
    test_name: $("testName").value.trim(),
    expected: $("expected").value.trim(),
    actual: $("actual").value.trim(),
    status: $("status").value,
    tags: parseTags($("tags").value),
    notes: $("notes").value.trim()
  };
}

function validateForm(data) {
  if (!data.test_name) {
    setMessage("Test name is required.", true);
    $("testName").focus();
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// 1. Load current page info
// ---------------------------------------------------------------------------

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (!tab) return;

  $("pageTitle").textContent = "Page: " + (tab.title || "—");
  $("pageUrl").textContent = "URL: " + (tab.url || "—");
  currentPageInfo = { title: tab.title || "", url: tab.url || "" };

  chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_INFO" }, (pageInfo) => {
    if (chrome.runtime.lastError || !pageInfo) return;
    currentPageInfo = pageInfo;
    $("pageTitle").textContent = "Page: " + (pageInfo.title || "—");
    $("pageUrl").textContent = "URL: " + (pageInfo.url || "—");
  });
});

// ---------------------------------------------------------------------------
// 2. Record evidence (with screenshot)
// ---------------------------------------------------------------------------

recordButton.addEventListener("click", () => {
  const data = getFormData();
  if (!validateForm(data)) return;

  recordButton.disabled = true;
  setMessage("Capturing screenshot…");

  chrome.tabs.captureVisibleTab(null, { format: "png" }, (imageData) => {
    if (chrome.runtime.lastError) {
      setMessage("Screenshot failed: " + chrome.runtime.lastError.message, true);
      recordButton.disabled = false;
      return;
    }

    const evidence = {
      id: uuid(),
      ...data,
      page_title: currentPageInfo.title || "",
      page_url: currentPageInfo.url || "",
      user_agent: currentPageInfo.userAgent || "",
      viewport: currentPageInfo.viewport || null,
      recorded_at: new Date().toISOString(),
      screenshot: imageData
    };

    chrome.storage.local.get(["evidenceList"], (result) => {
      const list = result.evidenceList || [];
      list.push(evidence);
      chrome.storage.local.set({ evidenceList: list }, () => {
        recordButton.disabled = false;
        setMessage("Evidence saved. Total: " + list.length);
        clearForm();
        loadAndDisplay();
      });
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Update existing
// ---------------------------------------------------------------------------

updateButton.addEventListener("click", () => {
  if (editingIndex === null) return;
  const data = getFormData();
  if (!validateForm(data)) return;

  chrome.storage.local.get(["evidenceList"], (result) => {
    const list = result.evidenceList || [];
    if (!list[editingIndex]) return;

    Object.assign(list[editingIndex], data, {
      updated_at: new Date().toISOString()
    });

    chrome.storage.local.set({ evidenceList: list }, () => {
      setMessage("Evidence updated.");
      exitEditMode();
      clearForm();
      loadAndDisplay();
    });
  });
});

// ---------------------------------------------------------------------------
// 4. Cancel edit
// ---------------------------------------------------------------------------

cancelButton.addEventListener("click", () => {
  exitEditMode();
  clearForm();
  setMessage("Editing cancelled.");
});

// ---------------------------------------------------------------------------
// 5. Display / filter history
// ---------------------------------------------------------------------------

function loadAndDisplay() {
  chrome.storage.local.get(["evidenceList"], (result) => {
    allEvidence = result.evidenceList || [];
    $("recordCount").textContent = String(allEvidence.length);
    renderHistory(applyFilters(allEvidence));
  });
}

function applyFilters(list) {
  const text = ($("filterInput").value || "").trim().toLowerCase();
  const status = $("filterStatus").value;

  return list.filter((ev) => {
    if (status && ev.status !== status) return false;
    if (!text) return true;
    const hay = [
      ev.test_name,
      ev.expected,
      ev.actual,
      ev.notes,
      ev.page_title,
      ev.page_url,
      ...(ev.tags || [])
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(text);
  });
}

function renderHistory(list) {
  const container = $("evidenceHistory");
  container.innerHTML = "";

  if (list.length === 0) {
    container.innerHTML = '<p class="empty">No evidence recorded yet.</p>';
    return;
  }

  // Show newest first
  const ordered = [...list].reverse();

  ordered.forEach((evidence) => {
    // Find real index in allEvidence for edit/delete
    const realIndex = allEvidence.findIndex(
      (e) => e.id === evidence.id || (e.recorded_at === evidence.recorded_at && e.test_name === evidence.test_name)
    );

    const record = document.createElement("div");
    record.className = "record";

    const tagsHtml = (evidence.tags || [])
      .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
      .join("");

    record.innerHTML = `
      <div class="record-header">
        <span class="record-title">${escapeHtml(evidence.test_name || "(unnamed)")}</span>
        <span class="status-pill status-${escapeHtml(evidence.status || "PASS")}">${escapeHtml(evidence.status || "PASS")}</span>
      </div>
      <div class="record-meta">
        ${evidence.expected ? "Expected: " + escapeHtml(evidence.expected) + "<br>" : ""}
        ${evidence.actual ? "Actual: " + escapeHtml(evidence.actual) + "<br>" : ""}
        ${evidence.notes ? "Notes: " + escapeHtml(evidence.notes) + "<br>" : ""}
        Page: ${escapeHtml(evidence.page_title || "")}<br>
        URL: ${escapeHtml(evidence.page_url || "")}<br>
        Recorded: ${escapeHtml(evidence.recorded_at || "")}
        ${evidence.updated_at ? "<br>Updated: " + escapeHtml(evidence.updated_at) : ""}
      </div>
      ${tagsHtml ? `<div class="record-tags">${tagsHtml}</div>` : ""}
    `;

    if (evidence.screenshot) {
      const img = document.createElement("img");
      img.src = evidence.screenshot;
      img.alt = "Screenshot";
      img.title = "Click to open full size";
      img.addEventListener("click", () => {
        const w = window.open();
        if (w) {
          w.document.write(`<img src="${evidence.screenshot}" style="max-width:100%">`);
        }
      });
      record.appendChild(img);
    }

    const actions = document.createElement("div");
    actions.className = "record-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "btn small";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => startEdit(realIndex, evidence));

    const delBtn = document.createElement("button");
    delBtn.className = "btn small danger";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => deleteRecord(realIndex));

    const dlBtn = document.createElement("button");
    dlBtn.className = "btn small";
    dlBtn.textContent = "Save PNG";
    dlBtn.addEventListener("click", () => downloadScreenshot(evidence));

    actions.append(editBtn, delBtn, dlBtn);
    record.appendChild(actions);
    container.appendChild(record);
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function startEdit(index, evidence) {
  if (index < 0) return;
  editingIndex = index;
  $("testName").value = evidence.test_name || "";
  $("expected").value = evidence.expected || "";
  $("actual").value = evidence.actual || "";
  $("status").value = evidence.status || "PASS";
  $("tags").value = (evidence.tags || []).join(", ");
  $("notes").value = evidence.notes || "";
  recordButton.hidden = true;
  updateButton.hidden = false;
  cancelButton.hidden = false;
  setMessage("Editing record…");
  $("testName").focus();
}

function deleteRecord(index) {
  if (index < 0) return;
  if (!confirm("Delete this evidence record?")) return;
  chrome.storage.local.get(["evidenceList"], (result) => {
    const list = result.evidenceList || [];
    list.splice(index, 1);
    chrome.storage.local.set({ evidenceList: list }, () => {
      setMessage("Record deleted.");
      if (editingIndex === index) {
        exitEditMode();
        clearForm();
      }
      loadAndDisplay();
    });
  });
}

function downloadScreenshot(evidence) {
  if (!evidence.screenshot) return;
  const a = document.createElement("a");
  a.href = evidence.screenshot;
  const safe = (evidence.test_name || "screenshot").replace(/[^\w\-]+/g, "_").slice(0, 40);
  a.download = `evidence_${safe}_${(evidence.recorded_at || "").slice(0, 19).replace(/[:T]/g, "-")}.png`;
  a.click();
}

// ---------------------------------------------------------------------------
// 6. Export
// ---------------------------------------------------------------------------

$("exportJsonBtn").addEventListener("click", () => {
  chrome.storage.local.get(["evidenceList"], (result) => {
    const list = result.evidenceList || [];
    // Strip huge base64 for a lighter JSON option? Keep full for fidelity.
    const blob = new Blob([JSON.stringify(list, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `test-evidence-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage("JSON exported (" + list.length + " records).");
  });
});

$("exportHtmlBtn").addEventListener("click", () => {
  chrome.storage.local.get(["evidenceList"], (result) => {
    const list = result.evidenceList || [];
    const html = buildHtmlReport(list);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `test-evidence-report-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage("HTML report exported.");
  });
});

function buildHtmlReport(list) {
  const rows = list
    .map(
      (ev, i) => `
    <section class="card">
      <h2>#${i + 1} ${escapeHtml(ev.test_name || "")}
        <span class="status">${escapeHtml(ev.status || "")}</span>
      </h2>
      <p><strong>Expected:</strong> ${escapeHtml(ev.expected || "—")}</p>
      <p><strong>Actual:</strong> ${escapeHtml(ev.actual || "—")}</p>
      ${ev.notes ? `<p><strong>Notes:</strong> ${escapeHtml(ev.notes)}</p>` : ""}
      <p><strong>Tags:</strong> ${(ev.tags || []).map(escapeHtml).join(", ") || "—"}</p>
      <p><strong>Page:</strong> ${escapeHtml(ev.page_title || "")}<br>
         <strong>URL:</strong> <a href="${escapeHtml(ev.page_url || "")}">${escapeHtml(ev.page_url || "")}</a></p>
      <p><strong>Recorded:</strong> ${escapeHtml(ev.recorded_at || "")}</p>
      ${ev.screenshot ? `<img src="${ev.screenshot}" alt="screenshot" style="max-width:100%;border:1px solid #ccc;border-radius:4px"/>` : ""}
    </section>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Test Evidence Report</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:900px;margin:24px auto;padding:0 16px;color:#222}
  h1{border-bottom:2px solid #4f8cff;padding-bottom:8px}
  .card{border:1px solid #ddd;border-radius:8px;padding:16px;margin:16px 0;background:#fafafa}
  .status{font-size:12px;background:#e8f0fe;padding:2px 8px;border-radius:999px;margin-left:8px}
  a{color:#1a73e8}
</style>
</head>
<body>
<h1>Test Evidence Report</h1>
<p>Generated ${new Date().toISOString()} · ${list.length} record(s)</p>
${rows || "<p>No records.</p>"}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// 7. Clear all
// ---------------------------------------------------------------------------

$("clearAllBtn").addEventListener("click", () => {
  if (!confirm("Delete ALL evidence records? This cannot be undone.")) return;
  chrome.storage.local.set({ evidenceList: [] }, () => {
    setMessage("All evidence cleared.");
    exitEditMode();
    clearForm();
    loadAndDisplay();
  });
});

// ---------------------------------------------------------------------------
// 8. Filter listeners
// ---------------------------------------------------------------------------

$("filterInput").addEventListener("input", () => {
  renderHistory(applyFilters(allEvidence));
});
$("filterStatus").addEventListener("change", () => {
  renderHistory(applyFilters(allEvidence));
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

loadAndDisplay();
