import fs from "node:fs";
import path from "node:path";

const MARKER = "data-web2app-in-app-nav";

const NAV_SCRIPT = `(function(){if(window.__web2appNavInstalled)return;window.__web2appNavInstalled=true;function ok(a){if(!a||!a.href||a.hasAttribute("download"))return false;var h=a.getAttribute("href");if(!h||h.startsWith("#")||h.startsWith("javascript:"))return false;try{var u=new URL(a.href,location.href);return u.protocol==="http:"||u.protocol==="https:"}catch(e){return false}}function go(url){location.assign(url)}document.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest("a"):null;if(!ok(a))return;if(a.target==="_blank"||a.target==="_top"||location.protocol==="file:"||location.protocol==="tauri:"||location.hostname==="asset.localhost"){e.preventDefault();go(a.href);return}try{var t=new URL(a.href,location.href),c=new URL(location.href);if(t.origin!==c.origin){e.preventDefault();go(a.href)}}catch(e){}},true);var o=window.open;window.open=function(url,t,f){if(url&&(!t||t==="_blank")){go(url);return null}return o.call(window,url,t,f)}})();`;

export function injectInAppNav(distDir) {
  const indexPath = path.join(distDir, "index.html");
  if (!fs.existsSync(indexPath)) return;

  let html = fs.readFileSync(indexPath, "utf8");
  if (html.includes(MARKER)) return;

  const tag = `<script ${MARKER}>${NAV_SCRIPT}</script>`;
  if (html.includes("</body>")) {
    html = html.replace("</body>", `${tag}\n</body>`);
  } else {
    html += `\n${tag}\n`;
  }

  fs.writeFileSync(indexPath, html);
  console.log("Injected in-app navigation script into index.html");
}
