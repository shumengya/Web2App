use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use serde::Serialize;
use std::collections::HashMap;
use tauri::Manager;

const TAURI_SHELL_SCRIPT: &str = include_str!("../../scripts/tauri-shell.js");

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

/// Hop-by-hop / forbidden request headers (RFC 7230 / fetch).
const STRIP_REQUEST_HEADERS: &[&str] = &[
    "accept-encoding",
    "connection",
    "content-length",
    "host",
    "keep-alive",
    "proxy-connection",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProxyFetchResponse {
    status: u16,
    status_text: String,
    headers: Vec<(String, String)>,
    body_base64: String,
}

/// Native HTTP client used to bypass WebView CORS for packaged apps.
/// Front-end origin is typically `https://tauri.localhost`, which remote APIs
/// (Cloudflare R2, S3, custom backends) rarely allow even with `AllowedOrigins: ["*"]`.
#[tauri::command]
async fn proxy_fetch(
    method: String,
    url: String,
    headers: HashMap<String, String>,
    body_base64: Option<String>,
) -> Result<ProxyFetchResponse, String> {
    let method = method.trim().to_uppercase();
    if method.is_empty() {
        return Err("method is required".into());
    }

    let url = url.trim();
    if url.is_empty() {
        return Err("url is required".into());
    }
    let parsed = reqwest::Url::parse(url).map_err(|e| format!("invalid url: {e}"))?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err(format!("unsupported scheme: {}", parsed.scheme()));
    }

    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| format!("http client error: {e}"))?;

    let http_method = reqwest::Method::from_bytes(method.as_bytes())
        .map_err(|_| format!("invalid method: {method}"))?;

    let mut builder = client.request(http_method, parsed);

    for (name, value) in &headers {
        let lower = name.to_ascii_lowercase();
        if STRIP_REQUEST_HEADERS.iter().any(|h| *h == lower.as_str()) {
            continue;
        }
        builder = builder.header(name.as_str(), value.as_str());
    }

    if let Some(b64) = body_base64.as_deref() {
        if !b64.is_empty() {
            let bytes = BASE64
                .decode(b64)
                .map_err(|e| format!("invalid body base64: {e}"))?;
            builder = builder.body(bytes);
        }
    }

    let response = builder
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?;

    let status = response.status();
    let status_text = status.canonical_reason().unwrap_or("").to_string();
    let headers: Vec<(String, String)> = response
        .headers()
        .iter()
        .map(|(k, v)| {
            (
                k.as_str().to_string(),
                v.to_str().unwrap_or("").to_string(),
            )
        })
        .collect();

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("read body failed: {e}"))?;

    Ok(ProxyFetchResponse {
        status: status.as_u16(),
        status_text,
        headers,
        body_base64: BASE64.encode(&bytes),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![proxy_fetch])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.eval(TAURI_SHELL_SCRIPT);
                let _ = window.eval(IN_APP_NAV_SCRIPT);
            }
            Ok(())
        })
        .on_page_load(|webview, payload| {
            if payload.event() == tauri::webview::PageLoadEvent::Finished {
                let _ = webview.eval(TAURI_SHELL_SCRIPT);
                let _ = webview.eval(IN_APP_NAV_SCRIPT);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
