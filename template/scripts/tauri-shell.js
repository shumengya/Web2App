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

  var originalFetch = window.fetch;
  window.fetch = function (input, init) {
    init = init || {};
    var url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input && input.url
            ? input.url
            : "";

    var requestUrl;
    try {
      requestUrl = new URL(url, location.href);
    } catch (_) {
      return originalFetch.call(this, input, init);
    }

    var crossOrigin = requestUrl.origin !== location.origin;
    if (crossOrigin) {
      var headers = new Headers(init.headers || {});
      if (!headers.has("Authorization")) {
        var token = readToken();
        if (token) headers.set("Authorization", "Bearer " + token);
      }
      init = Object.assign({}, init, { headers: headers });
    }

    return originalFetch.call(this, input, init).then(function (response) {
      if (!response.ok) return response;

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
    });
  };
})();