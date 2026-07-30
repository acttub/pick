/* 명대사 월드컵 — 화면 전환과 토너먼트.
 *
 * 사용자에게 보이는 문장은 이 파일에 없다. 전부 copy.js에서 온다.
 * 경로(/r16 → /r8 → /r4 → /final → /result/*)는 디자인이 아니라 계측 장치다:
 * Vercel Hobby는 커스텀 이벤트를 못 세므로 단계를 경로로 만들어 페이지뷰로 센다.
 */
(function () {
  "use strict";

  var CORE_TRACK = "https://script.google.com/macros/s/AKfycbxmvQWyu-kslgIbVshJolG2KXV_omgT_vcUpmwJljvvYE8MkwUug-WGEhZmWUdU2ErK/exec";
  var UPSTREAM_KEY = "pick_inbound_utm";

  /* Preserve the first-touch UTM set for this tab. An empty string is also a
   * captured value, so later navigation cannot replace a direct first touch. */
  (function captureInboundUtm() {
    try {
      if (sessionStorage.getItem(UPSTREAM_KEY) !== null) return;
      var inbound = new URLSearchParams();
      new URLSearchParams(location.search).forEach(function (value, name) {
        if (/^utm_/i.test(name)) inbound.append(name.toLowerCase(), value);
      });
      sessionStorage.setItem(UPSTREAM_KEY, inbound.toString());
    } catch (e) { /* Keep the app usable when a webview blocks storage. */ }
  })();

  function inboundUpstream() {
    try {
      return new URLSearchParams(sessionStorage.getItem(UPSTREAM_KEY) || "").get("utm_source") || "direct";
    } catch (e) {
      return "direct";
    }
  }

  function sendToSheet(payload) {
    // Do not mix local or preview checks into production analytics.
    if (!/(^|\.)acttub\.com$/.test(location.hostname)) return;
    try {
      var body = JSON.stringify(payload);
      var blob = new Blob([body], { type: "text/plain;charset=UTF-8" });
      if (!(navigator.sendBeacon && navigator.sendBeacon(CORE_TRACK, blob))) {
        fetch(CORE_TRACK, { method: "POST", mode: "no-cors", keepalive: true, body: body })
          .catch(function () {});
      }
    } catch (e) { /* Analytics must never block the user flow. */ }
  }

  function trackEvent(name) {
    if (!/(^|\.)acttub\.com$/.test(location.hostname)) return;
    sendToSheet({
      type: "event",
      app: "pick",
      name: name,
      at: new Date().toISOString()
    });
  }

  function trackCore(href) {
    var q = href.indexOf("?");
    sendToSheet({
      type: "click",
      at: new Date().toISOString(),
      from: "worldcup",
      src: q < 0 ? "" : href.slice(q),
      upstream: inboundUpstream(),
      ref: location.origin,
      click_id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
    });
    // 시트와 나란히 GA로도 보낸다. 시트는 클릭 수를 세고, GA는 도착 이후까지 세션으로 잇는다.
    // ⚠️ 잇는 건 acttub.com에도 같은 GA가 붙은 뒤부터다 — 2026-07-29 현재 코어는 미계측이라
    // 지금 이 이벤트는 "여기서 눌렀다"까지만 남는다(팀에 계측 요청 대기 중).
    // gtag는 프로덕션 호스트에서만 정의된다(index.html의 가드).
    if (window.gtag) window.gtag("event", "acttub_cta", { from: "worldcup" });
  }

  trackEvent("landing_view");

  var missing = [];
  if (!window.COPY) missing.push("COPY");
  if (!Array.isArray(window.SCENES)) missing.push("SCENES");
  if (missing.length) {
    console.warn("Pick initialization aborted: missing " + missing.join(", ") + ".");
    trackEvent("dependency_load_failed");
    // 백지로 두지 않는다. 이 문구는 copy.js에 두면 안 된다 —
    // copy.js가 못 불러와진 경우가 바로 여기라서 그때 문구까지 같이 사라진다.
    var shell = document.querySelector(".tier-shell");
    if (shell) {
      var box = document.createElement("div");
      box.className = "mt-xl text-body-md text-ink-sub";
      box.setAttribute("role", "alert");
      box.textContent = "화면을 불러오지 못했어요. 잠시 뒤에 새로고침해 주세요.";
      shell.appendChild(box);
    }
    return;
  }

  var C = window.COPY;
  var SCENES = window.SCENES;

  var CORE_URL = "https://acttub.com/?utm_source=worldcup"
    + "&utm_medium=result&utm_campaign=worldcup_seed_2607&utm_content=core"
    + "&utm_term=" + encodeURIComponent(inboundUpstream());

  var ROUND_PATH = { 16: "/r16", 8: "/r8", 4: "/r4", 2: "/final" };

  /* 결과 경로. 내부 태그를 주소에 쓰지 않는다.
   * 내부 라벨 노출 금지는 화면에 렌더되는 문자열로 한정되지 않는다 — 주소창도 사용자가 보고,
   * 링크를 복사하면 같이 옮겨간다. 숫자는 의미를 옮기지 않으면서 4분기를 구분해 주므로
   * 대시보드에서 분포를 세는 데는 그대로 쓸 수 있다. (1 삼킨 말 / 2 대면 / 3 무너짐 / 4 직진) */
  var RESULT_PATH = { swallow: "1", face: "2", collapse: "3", straight: "4" };

  var $ = function (id) { return document.getElementById(id); };

  // ── 문장 주입 ──────────────────────────────────────────────────────
  // data-copy="a.b.c" → textContent, data-copy-html → innerHTML(<br>이 필요한 자리만)
  function get(path) {
    return path.split(".").reduce(function (o, k) { return o && o[k]; }, C);
  }

  function applyCopy(root) {
    (root || document).querySelectorAll("[data-copy]").forEach(function (el) {
      var v = get(el.dataset.copy);
      if (typeof v === "string") el.textContent = v;
    });
    (root || document).querySelectorAll("[data-copy-html]").forEach(function (el) {
      var v = get(el.dataset.copyHtml);
      if (typeof v === "string") el.innerHTML = v;
    });
  }

  // ── 화면 ───────────────────────────────────────────────────────────
  var SCREENS = ["screen-start", "screen-match", "screen-result"];

  function show(id) {
    SCREENS.forEach(function (s) { $(s).hidden = s !== id; });
    window.scrollTo(0, 0);
  }

  // ── 경로 ───────────────────────────────────────────────────────────
  function go(path, replace) {
    if (location.pathname === path) return;
    history[replace ? "replaceState" : "pushState"](null, "", path);
  }

  /* 진입 지점 정리.
   * 대결·결과 경로로 직접 들어오거나 새로고침하면 진행 상태가 없다.
   * 상태를 복구하지 않고 시작 화면으로 되돌린다 — 15번 선택은 다시 하면 되는 비용이고,
   * 상태 직렬화는 이 규모에 과하다. 빈 화면만 안 보이게 하는 것이 목적이다. */
  /* 시작 화면의 카드 뭉치 맨 앞장. 매번 다른 장면을 보여 준다 —
   * 어떤 대사들이 나오는지 한 장이라도 보이지 않으면 "16개의 장면"이 숫자로만 남는다. */
  function renderPeek() {
    renderCard($("peek-card"), SCENES[Math.floor(Math.random() * SCENES.length)]);
  }

  function resolveEntry() {
    renderPeek();
    var m = location.pathname.match(/^\/with\/(\d+)\/?$/);
    if (m) {
      var scene = SCENES[parseInt(m[1], 10)];
      if (scene) {
        $("friend-scene").textContent = scene.work + " — " + scene.line;
        $("friend-note").hidden = false;
        show("screen-start");
        return;
      }
      // 범위 밖 번호: 오류를 띄우지 않고 평범한 시작 화면으로 내린다.
    }
    $("friend-note").hidden = true;
    go("/", true);
    show("screen-start");
  }

  // ── 토너먼트 ───────────────────────────────────────────────────────
  var pool = [];         // 이번 라운드 참가 장면
  var nextPool = [];     // 다음 라운드 진출 장면
  var matchIndex = 0;    // 이번 라운드 안의 경기 번호
  var champion = null;
  /* 진행 표시는 라운드가 아니라 전체 경기 수로 센다. 16장이면 8+4+2+1 = 15경기다.
   * 라운드 안 번호(3/8)로 세면 라운드가 넘어갈 때마다 되감겨서, 옆의 진행바와 어긋난다. */
  var totalMatches = 0;
  var doneMatches = 0;

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* 토너먼트는 참가 수가 2의 거듭제곱일 때만 성립한다.
   * 장면을 하나 지워 15개가 되면 마지막 짝의 상대가 없어 렌더에서 그대로 터진다.
   * "16강이 길면 8강으로 줄인다"는 계획이 있어 실제로 개수를 만질 일이 생기므로,
   * 조용히 깨지는 대신 지원 가능한 크기로 잘라내고 그 사실을 콘솔에 남긴다. */
  function playable(scenes) {
    var n = 1;
    while (n * 2 <= scenes.length && ROUND_PATH[n * 2]) n *= 2;
    if (n < 2) return [];
    if (n !== scenes.length) {
      console.warn("장면 " + scenes.length + "개는 토너먼트로 떨어지지 않아 " + n + "개만 쓴다. data.js를 2의 거듭제곱(8·16)으로 맞춰라.");
    }
    return shuffle(scenes).slice(0, n);
  }

  function startGame() {
    pool = playable(SCENES);
    if (pool.length < 2) { console.error("장면이 2개 미만이라 시작할 수 없다."); return; }
    trackEvent("game_start");
    nextPool = [];
    matchIndex = 0;
    champion = null;
    totalMatches = pool.length - 1;
    doneMatches = 0;
    go(ROUND_PATH[pool.length]);
    show("screen-match");
    trackRound(pool.length);
    renderMatch();
  }

  function trackRound(size) {
    var eventName = { 8: "round_8", 4: "round_4", 2: "round_final" }[size];
    if (eventName) trackEvent(eventName);
  }

  function renderMatch() {
    $("round-name").textContent = C.match.rounds[pool.length];
    /* 카운터와 진행바는 같은 값을 가리켜야 한다. 바에 doneMatches(끝낸 경기)를 주면
     * "3 / 15"인데 바는 2/15만큼만 차서 한 칸 뒤처져 보이고, 마지막 경기에서도 100%가 안 된다.
     * 첫 경기에서 바가 텅 비어 고장난 것처럼 보이던 것도 같이 해결된다. */
    var atMatch = doneMatches + 1;
    $("round-count").textContent = C.match.counter(atMatch, totalMatches);
    $("progress-fill").style.width = (atMatch / totalMatches * 100) + "%";
    renderCard($("card-a"), pool[matchIndex * 2]);
    renderCard($("card-b"), pool[matchIndex * 2 + 1]);
  }

  function renderCard(el, scene) {
    el.replaceChildren(
      row("text-body-sm font-semibold text-primary", scene.work + " ", "text-ink-tertiary font-medium", scene.meta),
      line("mt-sm text-h3", scene.line),
      line("mt-sm text-body-sm text-ink-sub", scene.situation)
    );
  }

  function line(cls, text) {
    var d = document.createElement("div");
    d.className = cls;
    d.textContent = text;
    return d;
  }

  function row(cls, text, subCls, subText) {
    var d = line(cls, text);
    var s = document.createElement("span");
    s.className = subCls;
    s.textContent = subText;
    d.appendChild(s);
    return d;
  }

  /* 연속 탭 잠금.
   * 이게 없으면 같은 카드를 빠르게 두 번 누를 때 두 번째 탭이 다음 경기의 같은 쪽을 자동으로 고른다
   * (첫 탭이 같은 버튼에 다음 경기를 즉시 그려 넣기 때문이다). 모바일에서 흔한 두 번 탭이
   * 사용자가 고르지 않은 장면을 통과시킨다. 220ms는 사람의 연속 탭보다 짧고 의도적인 다음 선택보다 길다. */
  var lockedUntil = 0;

  function pick(side) {
    var now = performance.now();
    if (now < lockedUntil) return;
    lockedUntil = now + 220;

    nextPool.push(pool[matchIndex * 2 + (side === "a" ? 0 : 1)]);
    matchIndex++;
    doneMatches++;
    if (matchIndex * 2 < pool.length) { renderMatch(); return; }

    if (nextPool.length === 1) { finish(nextPool[0]); return; }
    pool = nextPool;
    nextPool = [];
    matchIndex = 0;
    go(ROUND_PATH[pool.length]);   // 라운드가 넘어갈 때만 경로가 바뀐다 = 단계별 페이지뷰
    trackRound(pool.length);
    renderMatch();
  }

  function finish(scene) {
    champion = scene;
    var r = C.reflect[scene.tag];

    $("winner-line").textContent = scene.line;
    $("winner-source").textContent = scene.work + " · " + scene.meta;
    $("winner-situation").textContent = scene.situation;
    $("reflect-intro").textContent = r.intro;
    /* 점 불릿은 .dot-list의 ::before가 그린다 — 번호도 회색 판도 쓰지 않는다.
     * 번호는 순서가 있다는 주장이고 이 질문들엔 순서가 없다. */
    $("reflect-questions").replaceChildren(...r.questions.map(function (q) {
      var li = document.createElement("li");
      li.textContent = q;
      return li;
    }));
    $("btn-core").href = CORE_URL;

    go("/result/" + RESULT_PATH[scene.tag]);
    show("screen-result");
    trackEvent("result_view");
  }

  // ── 공유 ───────────────────────────────────────────────────────────
  function shareUrl() {
    var i = SCENES.indexOf(champion);
    return location.origin + (i >= 0 ? "/with/" + i : "/");
  }

  function wrapText(ctx, text, maxWidth) {
    var lines = [], cur = "";
    text.split("").forEach(function (ch) {
      if (cur !== "" && ctx.measureText(cur + ch).width > maxWidth) { lines.push(cur); cur = ch; }
      else cur += ch;
    });
    if (cur) lines.push(cur);
    return lines;
  }

  /* 공유 이미지. 브랜드 표면이라 그라데이션을 쓴다(제품 화면에는 쓰지 않는다).
     무단 복제를 막을 수 없으므로 워드마크로 출처를 이미지 안에 남긴다. */
  function drawShareImage(scene) {
    var canvas = $("share-canvas");
    var ctx = canvas.getContext("2d");
    var W = 1080, H = 1350;

    var grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#44C0FD");
    grad.addColorStop(1, "#0355F1");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = '600 40px Pretendard, sans-serif';
    ctx.fillText(C.shareImage.top, W / 2, 140);

    var x = 90, y = 260, w = W - 180, h = 700, r = 32;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();

    ctx.fillStyle = "#0A79FB";
    ctx.font = '600 40px Pretendard, sans-serif';
    ctx.fillText(scene.work + " · " + scene.meta, W / 2, y + 130);

    ctx.fillStyle = "#191F28";
    ctx.font = '700 64px Pretendard, sans-serif';
    var quote = wrapText(ctx, scene.line, w - 160);
    var ly = y + h / 2 + 20 - ((quote.length - 1) * 92) / 2;
    quote.forEach(function (l) { ctx.fillText(l, W / 2, ly); ly += 92; });

    // 400은 우리가 싣지 않는 굵기다(가장 얇은 것이 500). 400으로 그리면 대체 폰트로 굳는다.
    ctx.fillStyle = "#4E5968";
    ctx.font = '500 36px Pretendard, sans-serif';
    var sit = wrapText(ctx, scene.situation, w - 160);
    var sy = y + h - 120 - (sit.length - 1) * 52;
    sit.forEach(function (l) { ctx.fillText(l, W / 2, sy); sy += 52; });

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = '600 44px Pretendard, sans-serif';
    ctx.fillText(C.shareImage.ask, W / 2, 1120);
    ctx.font = '700 52px Pretendard, sans-serif';
    ctx.fillText(C.shareImage.wordmark, W / 2, 1230);
    return canvas;
  }

  var toastTimer = null;
  function toast(msg) {
    // 유틸리티 클래스를 얹어 opacity-0을 이기려 하지 않는다 — 같은 특이도라 CSS 출력 순서에 기대게 된다.
    var t = $("toast");
    t.textContent = msg;
    t.style.opacity = "1";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.style.opacity = ""; }, 2200);
  }

  async function saveImage() {
    if (!champion) return;
    var canvas;
    try {
      /* 글꼴이 아직 안 왔으면 캔버스가 시스템 폰트로 굽고, 나중에 폰트가 와도 이미 만든 PNG는 고쳐지지 않는다.
         캔버스가 쓰는 굵기를 전부 기다린다 — 하나만 기다리면 나머지가 대체 폰트로 섞인다. */
      try {
        await Promise.all(["500 36px Pretendard", "600 44px Pretendard", "700 64px Pretendard"]
          .map(function (f) { return document.fonts.load(f); }));
      } catch (e) {}
      canvas = drawShareImage(champion);
      var blob = await new Promise(function (res, rej) {
        canvas.toBlob(function (b) { b ? res(b) : rej(new Error("toBlob")); }, "image/png");
      });
      var file = new File([blob], C.share.fileName, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: C.share.imageText(champion.work, shareUrl()) });
          return;
        } catch (e) { if (e.name === "AbortError") return; }
      }
      // 이미 만든 blob을 쓴다. toDataURL로 다시 구우면 1080×1350을 두 번 인코딩해
      // 저사양 기기에서 메모리 때문에 실패한다 — 쓸 수 있는 결과가 손에 있는데 실패로 끝난다.
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.download = C.share.fileName;
      a.href = url;
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
      toast(C.toast.saved);
    } catch (e) {
      toast(C.toast.canvasFailed);
    }
  }

  async function shareLink() {
    var url = shareUrl();
    if (navigator.share) {
      try {
        await navigator.share({
          title: C.share.linkTitle,
          text: C.share.linkText(champion.work, champion.line),
          url: url,
        });
        return;
      } catch (e) { if (e.name === "AbortError") return; }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast(C.toast.copied);
    } catch (e) {
      toast(C.toast.clipboardBlocked);
    }
  }

  // ── 배선 ───────────────────────────────────────────────────────────
  applyCopy();

  $("btn-start").addEventListener("click", startGame);
  $("card-a").addEventListener("click", function () { pick("a"); });
  $("card-b").addEventListener("click", function () { pick("b"); });
  $("btn-save").addEventListener("click", function () {
    trackEvent("save_click");
    saveImage();
  });
  $("btn-share").addEventListener("click", function () {
    trackEvent("share_click");
    shareLink();
  });
  $("btn-retry").addEventListener("click", function () {
    trackEvent("retry");
    go("/", true);
    startGame();
  });
  $("btn-core").addEventListener("click", function () {
    trackCore(this.href);
    trackEvent("cta_click");
  });

  // 뒤로가기는 앞 라운드로 돌아가지 않고 시작으로 나간다(진행 상태를 보관하지 않으므로).
  window.addEventListener("popstate", resolveEntry);

  resolveEntry();
})();
