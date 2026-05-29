use tauri::Manager;

const IN_APP_NAV_SCRIPT: &str = r##"
(function () {
  if (window.__web2appNavInstalled) return;
  window.__web2appNavInstalled = true;

  function shouldHandleLink(anchor) {
    if (!anchor || !anchor.href) return false;
    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return false;
    try {
      const url = new URL(anchor.href, window.location.href);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
      return false;
    }
  }

  function navigateInApp(url) {
    window.location.assign(url);
  }

  document.addEventListener(
    "click",
    function (e) {
      const anchor = e.target && e.target.closest ? e.target.closest("a") : null;
      if (!shouldHandleLink(anchor)) return;
      if (anchor.hasAttribute("download")) return;
      if (
        anchor.target === "_blank" ||
        anchor.target === "_top" ||
        location.protocol === "file:" ||
        location.protocol === "tauri:" ||
        location.hostname === "asset.localhost"
      ) {
        e.preventDefault();
        navigateInApp(anchor.href);
        return;
      }
      try {
        const target = new URL(anchor.href, window.location.href);
        const current = new URL(window.location.href);
        if (target.origin !== current.origin) {
          e.preventDefault();
          navigateInApp(anchor.href);
        }
      } catch (_) {
        /* keep default */
      }
    },
    true,
  );

  const originalOpen = window.open;
  window.open = function (url, target, features) {
    if (url && (!target || target === "_blank")) {
      navigateInApp(url);
      return null;
    }
    return originalOpen.call(window, url, target, features);
  };
})();
"##;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.eval(IN_APP_NAV_SCRIPT);
            }
            Ok(())
        })
        .on_page_load(|webview, payload| {
            if payload.event() == tauri::webview::PageLoadEvent::Finished {
                let _ = webview.eval(IN_APP_NAV_SCRIPT);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
