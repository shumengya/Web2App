(function () {
  if (window.__web2appShellInstalled) return;
  window.__web2appShellInstalled = true;

  function isTauriShell() {
    var protocol = location.protocol;
    var host = location.hostname;
    return (
      protocol === "tauri:" ||
      protocol === "file:" ||
      host === "asset.localhost" ||
      host === "tauri.localhost"
    );
  }

  if (!isTauriShell()) return;

  var TOKEN_KEYS = ["sprout2fa_session", "__web2app_bearer_token"];
  /**
   * Bodies larger than this stay on the browser fetch path (needs server CORS
   * for https://tauri.localhost). Keep high enough for typical R2 uploads.
   */
  var PROXY_BODY_LIMIT = 64 * 1024 * 1024;
  /** Soft warn threshold for huge proxied responses (base64 over IPC). */
  var PROXY_RESPONSE_LIMIT = 64 * 1024 * 1024;

  function readToken() {
    try {
      for (var i = 0; i < TOKEN_KEYS.length; i++) {
        var value = localStorage.getItem(TOKEN_KEYS[i]);
        if (value) return value;
      }
    } catch (_) {
      /* ignore */
    }
    return null;
  }

  function writeToken(token) {
    if (!token) return;
    try {
      for (var i = 0; i < TOKEN_KEYS.length; i++) {
        localStorage.setItem(TOKEN_KEYS[i], token);
      }
    } catch (_) {
      /* ignore */
    }
  }

  function clearToken() {
    try {
      for (var i = 0; i < TOKEN_KEYS.length; i++) {
        localStorage.removeItem(TOKEN_KEYS[i]);
      }
    } catch (_) {
      /* ignore */
    }
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      for (var i = 0; i < regs.length; i++) regs[i].unregister();
    });
    navigator.serviceWorker.register = function () {
      return Promise.resolve({
        active: null,
        installing: null,
        waiting: null,
        unregister: function () {
          return Promise.resolve(true);
        },
        update: function () {
          return Promise.resolve();
        },
      });
    };
  }

  function getInvoke() {
    try {
      var core = window.__TAURI__ && window.__TAURI__.core;
      if (core && typeof core.invoke === "function") {
        return core.invoke.bind(core);
      }
    } catch (_) {
      /* ignore */
    }
    return null;
  }

  function resolveUrl(input) {
    if (typeof input === "string") return input;
    if (input instanceof URL) return input.href;
    if (input && typeof input.url === "string") return input.url;
    return "";
  }

  function resolveMethod(input, init) {
    if (init && init.method) return String(init.method).toUpperCase();
    if (input instanceof Request) return input.method.toUpperCase();
    return "GET";
  }

  /**
   * Collect headers without inventing an empty Headers that would later
   * overwrite a signed Request (aws4fetch passes fetch(Request) only).
   */
  function collectHeaders(input, init) {
    var headers = new Headers();
    if (input instanceof Request) {
      input.headers.forEach(function (value, key) {
        headers.set(key, value);
      });
    }
    if (init && init.headers) {
      new Headers(init.headers).forEach(function (value, key) {
        headers.set(key, value);
      });
    }
    return headers;
  }

  function headersToObject(headers) {
    var out = {};
    headers.forEach(function (value, key) {
      // Host is set by the real client; hop-by-hop headers are stripped natively.
      if (key.toLowerCase() === "host") return;
      out[key] = value;
    });
    return out;
  }

  function arrayBufferToBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var binary = "";
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(
        null,
        bytes.subarray(i, i + chunk),
      );
    }
    return btoa(binary);
  }

  function base64ToUint8Array(b64) {
    var binary = atob(b64 || "");
    var len = binary.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function bodyToArrayBuffer(input, init) {
    if (init && init.body != null) {
      var body = init.body;
      if (body === "") return Promise.resolve(null);
      if (typeof body === "string") {
        return Promise.resolve(new TextEncoder().encode(body).buffer);
      }
      if (body instanceof ArrayBuffer) return Promise.resolve(body);
      if (ArrayBuffer.isView(body)) {
        return Promise.resolve(
          body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
        );
      }
      if (typeof Blob !== "undefined" && body instanceof Blob) {
        return body.arrayBuffer();
      }
      if (
        typeof URLSearchParams !== "undefined" &&
        body instanceof URLSearchParams
      ) {
        return Promise.resolve(new TextEncoder().encode(body.toString()).buffer);
      }
      if (typeof FormData !== "undefined" && body instanceof FormData) {
        // FormData needs multipart framing; fall back to browser fetch.
        return Promise.reject(new Error("FORMDATA_UNSUPPORTED"));
      }
      if (
        typeof ReadableStream !== "undefined" &&
        body instanceof ReadableStream
      ) {
        return new Response(body).arrayBuffer();
      }
      return Promise.resolve(null);
    }
    if (input instanceof Request) {
      // Clone so we do not lock the original Request body stream.
      return input
        .clone()
        .arrayBuffer()
        .then(function (buf) {
          return buf && buf.byteLength > 0 ? buf : null;
        })
        .catch(function () {
          return null;
        });
    }
    return Promise.resolve(null);
  }

  function maybeInjectToken(headers) {
    if (headers.has("Authorization")) return;
    var token = readToken();
    if (token) headers.set("Authorization", "Bearer " + token);
  }

  function trackAuthResponse(requestUrl, response) {
    if (!response || !response.ok) return response;
    var path = requestUrl.pathname.replace(/\/$/, "");
    if (/\/auth\/login$/i.test(path)) {
      response
        .clone()
        .json()
        .then(function (data) {
          if (data && typeof data.token === "string" && data.token) {
            writeToken(data.token);
          }
        })
        .catch(function () {
          /* ignore */
        });
    }
    if (/\/auth\/logout$/i.test(path)) {
      clearToken();
    }
    return response;
  }

  function callOriginalFetch(input, init) {
    if (init === undefined) return originalFetch.call(window, input);
    return originalFetch.call(window, input, init);
  }

  /**
   * Proxy cross-origin HTTP(S) through Rust so WebView CORS never applies.
   * Origin of packaged apps is https://tauri.localhost (etc.), which remote
   * APIs (R2/S3) usually do not list — even when AllowedOrigins is ["*"],
   * signed preflights and some WebView builds still fail.
   */
  function proxyFetch(input, init) {
    var invoke = getInvoke();
    if (!invoke) return null;

    var url = resolveUrl(input);
    var method = resolveMethod(input, init);
    var headers = collectHeaders(input, init);
    maybeInjectToken(headers);

    return bodyToArrayBuffer(input, init)
      .then(function (buf) {
        if (buf && buf.byteLength > PROXY_BODY_LIMIT) {
          // Large upload: browser path (needs R2 CORS for tauri.localhost).
          return callOriginalFetch(url, {
            method: method,
            headers: headers,
            body: buf,
          });
        }

        var bodyBase64 =
          buf && buf.byteLength > 0 ? arrayBufferToBase64(buf) : null;

        return invoke("proxy_fetch", {
          method: method,
          url: url,
          headers: headersToObject(headers),
          bodyBase64: bodyBase64,
        }).then(function (result) {
          if (!result || typeof result.status !== "number") {
            throw new TypeError("Failed to fetch");
          }
          if (
            result.bodyBase64 &&
            result.bodyBase64.length * 0.75 > PROXY_RESPONSE_LIMIT
          ) {
            console.warn(
              "[web2app] proxied response is very large; consider presigned URLs",
            );
          }
          var bytes = base64ToUint8Array(result.bodyBase64 || "");
          var responseHeaders = new Headers();
          var pairs = result.headers || [];
          for (var i = 0; i < pairs.length; i++) {
            var pair = pairs[i];
            if (pair && pair.length >= 2) {
              try {
                responseHeaders.append(pair[0], pair[1]);
              } catch (_) {
                /* invalid header name/value */
              }
            }
          }
          return new Response(bytes, {
            status: result.status,
            statusText: result.statusText || "",
            headers: responseHeaders,
          });
        });
      })
      .catch(function (err) {
        if (err && err.message === "FORMDATA_UNSUPPORTED") {
          return callOriginalFetch(url, {
            method: method,
            headers: headers,
            body: init && init.body,
          });
        }
        throw err;
      });
  }

  var originalFetch = window.fetch;
  window.fetch = function (input, init) {
    var url = resolveUrl(input);
    var requestUrl;
    try {
      requestUrl = new URL(url, location.href);
    } catch (_) {
      return callOriginalFetch(input, init);
    }

    var crossOrigin = requestUrl.origin !== location.origin;
    var isHttp =
      requestUrl.protocol === "http:" || requestUrl.protocol === "https:";

    // Same-origin / non-HTTP: never rewrite (preserves Request signatures).
    if (!crossOrigin || !isHttp) {
      return callOriginalFetch(input, init);
    }

    var proxied = proxyFetch(input, init);
    if (proxied) {
      return proxied.then(function (response) {
        return trackAuthResponse(requestUrl, response);
      });
    }

    // Tauri IPC not ready yet: pass through without clobbering Request headers.
    // Only add a bearer token when Authorization is absent.
    var headers = collectHeaders(input, init);
    var hadAuth = headers.has("Authorization");
    maybeInjectToken(headers);
    if (!hadAuth && headers.has("Authorization")) {
      var passInit = Object.assign({}, init || {}, {
        method: resolveMethod(input, init),
        headers: headers,
      });
      if (passInit.body == null && input instanceof Request) {
        // Keep original Request if we only needed headers from it and body unset.
        return callOriginalFetch(input.url, Object.assign({}, passInit, {
          body: undefined,
        })).then(function (response) {
          return trackAuthResponse(requestUrl, response);
        });
      }
      return callOriginalFetch(requestUrl.href, passInit).then(function (
        response,
      ) {
        return trackAuthResponse(requestUrl, response);
      });
    }

    return callOriginalFetch(input, init).then(function (response) {
      return trackAuthResponse(requestUrl, response);
    });
  };
})();
