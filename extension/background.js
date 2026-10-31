/**
 * Service worker – keyboard shortcuts, messaging, and storage helpers.
 */

const DEFAULT_SETTINGS = {
  autoClearForm: true,
  includeUserAgent: true,
  includeViewport: true,
  defaultStatus: "PASS",
  maxRecordsWarning: 50
};

// Install / upgrade defaults
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["settings", "evidenceList"], (result) => {
    if (!result.settings) {
      chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    }
    if (!result.evidenceList) {
      chrome.storage.local.set({ evidenceList: [] });
    }
  });
});

// Keyboard commands
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "capture-evidence") {
    // Open the action popup (Chrome opens it when action is clicked;
    // for commands we can inject a small notification or open options).
    // Best UX: focus the current tab and show a brief overlay via content script.
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: "SHOW_CAPTURE_HINT" });
      } catch (_) {
        // Content script may not be ready on restricted pages
      }
    }
  }

  if (command === "quick-capture") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: "png" });
      let pageInfo = { title: tab.title || "", url: tab.url || "" };
      try {
        pageInfo = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_INFO" });
      } catch (_) {}

      const settings = await getSettings();
      const evidence = {
        id: crypto.randomUUID(),
        test_name: "Quick Capture",
        expected: "",
        actual: "",
        status: settings.defaultStatus || "PASS",
        tags: ["quick"],
        notes: "",
        page_title: pageInfo.title || tab.title || "",
        page_url: pageInfo.url || tab.url || "",
        user_agent: pageInfo.userAgent || "",
        viewport: pageInfo.viewport || null,
        recorded_at: new Date().toISOString(),
        screenshot: dataUrl
      };

      const { evidenceList = [] } = await chrome.storage.local.get("evidenceList");
      evidenceList.push(evidence);
      await chrome.storage.local.set({ evidenceList });

      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: "SHOW_TOAST",
          message: "Quick evidence captured"
        });
      } catch (_) {}
    } catch (err) {
      console.error("Quick capture failed:", err);
    }
  }
});

async function getSettings() {
  const { settings } = await chrome.storage.local.get("settings");
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

// Message relay / helpers for popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_SETTINGS") {
    getSettings().then(sendResponse);
    return true;
  }
  if (message.type === "SAVE_SETTINGS") {
    chrome.storage.local.set({ settings: message.settings }, () => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === "EXPORT_EVIDENCE") {
    chrome.storage.local.get("evidenceList", (result) => {
      sendResponse({ evidenceList: result.evidenceList || [] });
    });
    return true;
  }
});
