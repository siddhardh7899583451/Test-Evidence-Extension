/**
 * Content script – page metadata collection and lightweight UI feedback.
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_PAGE_INFO") {
    const pageInfo = {
      title: document.title || "",
      url: window.location.href,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1
      },
      readyState: document.readyState,
      lang: document.documentElement.lang || ""
    };
    sendResponse(pageInfo);
    return true;
  }

  if (message.type === "SHOW_CAPTURE_HINT") {
    showToast("Press the extension icon or Alt+Shift+S for quick capture");
  }

  if (message.type === "SHOW_TOAST") {
    showToast(message.message || "Done");
  }
});

function showToast(text) {
  const existing = document.getElementById("tee-toast");
  if (existing) existing.remove();

  const el = document.createElement("div");
  el.id = "tee-toast";
  el.textContent = text;
  Object.assign(el.style, {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    zIndex: "2147483647",
    background: "#1a1a2e",
    color: "#eaeaea",
    padding: "12px 18px",
    borderRadius: "8px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "14px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
    opacity: "0",
    transition: "opacity 0.25s ease"
  });
  document.documentElement.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = "1";
  });
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  }, 2500);
}
