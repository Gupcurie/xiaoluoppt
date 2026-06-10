const data = window.CLASSICAL_DANCE_PPT_DATA;
const generated = new Set(window.CLASSICAL_DANCE_GENERATED_IMAGES || []);
const STORAGE_KEY = "flagship-ppt-candidates";

// jsDelivr CDN — free global CDN with Asia-Pacific nodes (HK, SG, Tokyo)
const CDN_BASE = "https://cdn.jsdelivr.net/gh/Gupcurie/xiaoluoppt@master";
function cdn(relPath) {
  // relPath like "./assets/thumbs/xxx.webp" → absolute CDN URL
  if (!relPath) return "";
  return CDN_BASE + relPath.replace(/^\./, "");
}

const HALLS = [
  { category: "手绘与插画", name: "纸上生长原", guide: "水彩、线条与纸张在这里呼吸", dot: "#8fc9a0" },
  { category: "真实与摄影", name: "光影剧场", guide: "追光落下，真实本身就是戏剧", dot: "#f2b36b" },
  { category: "中国传统美学", name: "山水长卷境", guide: "一滴墨，展开一座东方宇宙", dot: "#7fbfa6" },
  { category: "古风与东方幻想", name: "月下云台", guide: "宫墙、云海与没写完的故事", dot: "#b5a7e0" },
  { category: "科技与未来", name: "悬浮数据舱", guide: "信息脱离纸面，开始发光", dot: "#7cc6e8" },
  { category: "动画与卡通", name: "角色星球", guide: "每一页都像动画的第一帧", dot: "#f7a06b" },
  { category: "现代设计", name: "形式试验区", guide: "秩序、网格与反秩序共存", dot: "#c9c2b8" },
  { category: "材质与工艺", name: "材料秘境", guide: "丝绸、陶瓷与金属留下触感", dot: "#d8b36a" },
  { category: "严肃与专业", name: "零号档案室", guide: "克制、准确，信息有重量", dot: "#a9b7bc" },
  { category: "潮流与实验", name: "拼贴失控场", guide: "撕开规则，意外就会出现", dot: "#f48fb1" },
  { category: "空间与场景", name: "微缩舞台盒", guide: "把提案放进一个真实空间", dot: "#e8c36a" },
  { category: "抽象与信息设计", name: "信号花园", guide: "数据与逻辑长成风景", dot: "#8fd0c0" },
];

const styleMap = new Map(data.styles.map((s) => [s.id, s]));
const slidesByStyle = new Map();
for (const slide of data.slides) {
  if (!slidesByStyle.has(slide.styleId)) slidesByStyle.set(slide.styleId, []);
  slidesByStyle.get(slide.styleId).push(slide);
}
const litStyles = data.styles.filter((s) => getSlide(s.id, "cover"));

const state = {
  favs: new Set(loadFavs()),
  detailId: null,
  detailPage: "cover",
  detailPool: [],
  duelRound: 1,
  duelA: null,
  duelB: null,
};

const $ = (sel) => document.querySelector(sel);
const els = Object.fromEntries(Array.from(document.querySelectorAll("[id]")).map((el) => [el.id, el]));

function getSlide(styleId, pageType = "cover") {
  return (slidesByStyle.get(styleId) || []).find((s) => s.pageType === pageType && generated.has(s.filename));
}
function litCount(styleId) {
  return (slidesByStyle.get(styleId) || []).filter((s) => generated.has(s.filename)).length;
}
function thumbOf(slide) {
  return slide ? cdn(`./assets/thumbs/${slide.filename.replace(/\.png$/i, ".webp")}`) : "";
}
function coverThumb(styleId) {
  return thumbOf(getSlide(styleId, "cover"));
}
function hallFor(category) {
  return HALLS.find((h) => h.category === category) || HALLS[0];
}
function loadFavs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((id) => styleMap.has(id)) : [];
  } catch {
    return [];
  }
}
function saveFavs() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(state.favs)));
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 1700);
}

const HEART = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5C7 16.6 3.5 13.4 3.5 9.7 3.5 7 5.6 5 8.1 5c1.5 0 3 .7 3.9 2 .9-1.3 2.4-2 3.9-2 2.5 0 4.6 2 4.6 4.7 0 3.7-3.5 6.9-8.5 10.8z" fill="currentColor"/></svg>`;

// HTML 转义：所有拼进 innerHTML 的动态文本/属性都过这里，杜绝 XSS（即便将来数据来源变得不可信）
const esc = (v) =>
  String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- 渲染：英雄区 ---------- */
function renderHero() {
  els.statStyles.textContent = data.styles.length;
  els.statLit.textContent = generated.size;
  const picks = [litStyles[0], litStyles[Math.floor(litStyles.length / 2)], litStyles[litStyles.length - 1]].filter(Boolean);
  [els.fanA, els.fanB, els.fanC].forEach((img, i) => {
    if (picks[i]) img.src = coverThumb(picks[i].id);
  });
}

/* ---------- 渲染：园区与卡片 ---------- */
function renderHalls() {
  els.hallStrip.innerHTML = HALLS.map(
    (h) => `<button class="hall-pill" type="button" data-jump="${esc(h.category)}" style="--dot:${esc(h.dot)}"><i></i>${esc(h.name)}</button>`
  ).join("");

  els.halls.innerHTML = HALLS.map((hall) => {
    const styles = data.styles.filter((s) => s.category === hall.category);
    const lit = styles.filter((s) => litCount(s.id) > 0).length;
    const cards = styles
      .map((style, i) => {
        const cover = getSlide(style.id, "cover");
        const n = litCount(style.id);
        const img = cover
          ? `<img src="${esc(thumbOf(cover))}" alt="${esc(style.name)}" loading="lazy" decoding="async" width="480" height="270" />`
          : `<img alt="" loading="lazy" width="480" height="270" />`;
        return `
        <button class="style-card${cover ? "" : " dim"}" type="button" data-style="${esc(style.id)}" style="--i:${i}">
          ${img}
          <span class="card-name">${esc(style.name)}</span>
          <span class="card-sub">${cover ? `<span class="lit">已点亮 ${n}/7 页</span>` : "样张准备中"}</span>
          <span class="fav-btn${state.favs.has(style.id) ? " on" : ""}" data-fav="${esc(style.id)}" role="button" aria-label="收藏 ${esc(style.name)}">${HEART}</span>
        </button>`;
      })
      .join("");
    return `
    <section class="hall" id="hall-${encodeURIComponent(hall.category)}" data-hall="${esc(hall.category)}" style="--dot:${esc(hall.dot)}">
      <div class="hall-head">
        <h2><i></i>${esc(hall.name)}</h2>
        <p class="hall-guide">${esc(hall.guide)}</p>
        <p class="hall-lit"><b>${lit}</b> / ${styles.length} 套已点亮</p>
      </div>
      <div class="card-grid">${cards}</div>
    </section>`;
  }).join("");

  observeHalls();
}

function refreshFavBtns() {
  document.querySelectorAll("[data-fav]").forEach((btn) => {
    btn.classList.toggle("on", state.favs.has(btn.dataset.fav));
  });
  els.trayCount.textContent = state.favs.size;
}

/* ---------- IntersectionObserver：入场 + scrollspy ---------- */
function observeHalls() {
  const enterIO = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          enterIO.unobserve(e.target);
        }
      }
    },
    { rootMargin: "0px 0px -8% 0px" }
  );
  const spyIO = new IntersectionObserver(
    (entries) => {
      const hit = entries.find((e) => e.isIntersecting);
      if (!hit) return;
      const cat = hit.target.dataset.hall;
      document.querySelectorAll(".hall-pill").forEach((p) => {
        const active = p.dataset.jump === cat;
        p.classList.toggle("active", active);
        if (active) p.scrollIntoView({ block: "nearest", inline: "nearest" });
      });
    },
    { rootMargin: "-30% 0px -60% 0px" }
  );
  document.querySelectorAll(".hall").forEach((el) => {
    enterIO.observe(el);
    spyIO.observe(el);
  });
}

/* ---------- 详情 ---------- */
function openDetail(styleId, pool) {
  const style = styleMap.get(styleId);
  if (!style) return;
  state.detailId = styleId;
  state.detailPool = pool || data.styles.filter((s) => s.category === style.category);
  state.detailPage = "cover";
  renderDetail();
  openOverlay(els.detailOverlay);
}

function renderDetail() {
  const style = styleMap.get(state.detailId);
  if (!style) return;
  const hall = hallFor(style.category);
  const slide = getSlide(style.id, state.detailPage) || getSlide(style.id, "cover");

  els.detailImage.alt = `${style.name} ${slide?.pageName || ""}`;
  if (slide) {
    els.detailImage.style.backgroundImage = `url("${thumbOf(slide)}")`;
    const big = cdn(slide.image);
    if (els.detailImage.getAttribute("src") !== big) {
      els.detailImage.classList.add("loading"); // 先透明、露出缩略图占位，大图解码完再淡入
      els.detailImage.src = big;
      const done = () => els.detailImage.classList.remove("loading");
      els.detailImage.decode ? els.detailImage.decode().then(done, done) : (els.detailImage.onload = done);
    }
  } else {
    els.detailImage.style.backgroundImage = "";
    els.detailImage.classList.remove("loading");
    els.detailImage.removeAttribute("src");
  }
  els.detailHall.textContent = `${hall.name} · ${style.category}`;
  els.detailName.textContent = style.name;
  els.detailMood.textContent = style.mood;
  els.detailTags.innerHTML = style.tags.map((t) => `<span>${esc(t)}</span>`).join("");
  els.detailProgress.innerHTML = `已点亮 <b>${litCount(style.id)}</b> / 7 种页型`;
  els.detailFav.textContent = state.favs.has(style.id) ? "已在收藏 ✓" : "收藏这套";

  els.detailPages.innerHTML = data.pageTypes
    .map((p) => {
      const ok = Boolean(getSlide(style.id, p.id));
      return `<button type="button" data-page="${esc(p.id)}" class="${state.detailPage === p.id ? "active" : ""}" ${ok ? "" : "disabled"}>${esc(p.short)}</button>`;
    })
    .join("");

  prefetchNeighbors();
}

// 预取相邻风格的封面大图，左右切换更跟手
function prefetchNeighbors() {
  const pool = state.detailPool.length ? state.detailPool : data.styles;
  if (!pool.length) return;
  const idx = pool.findIndex((s) => s.id === state.detailId);
  if (idx < 0) return;
  for (const j of [idx - 1, idx + 1]) {
    const s = pool[(j + pool.length) % pool.length];
    const sl = s && getSlide(s.id, "cover");
    if (sl) {
      const im = new Image();
      im.decoding = "async";
      im.src = cdn(sl.image);
    }
  }
}

function stepDetail(delta) {
  const pool = state.detailPool.length ? state.detailPool : data.styles;
  const idx = Math.max(0, pool.findIndex((s) => s.id === state.detailId));
  const next = pool[(idx + delta + pool.length) % pool.length];
  state.detailId = next.id;
  state.detailPage = "cover";
  renderDetail();
}

/* ---------- 收藏 ---------- */
function toggleFav(styleId, popEl) {
  if (state.favs.has(styleId)) {
    state.favs.delete(styleId);
    showToast("已取消收藏");
  } else {
    state.favs.add(styleId);
    showToast(`「${styleMap.get(styleId)?.name}」已收藏`);
    if (popEl) {
      popEl.classList.remove("pop");
      void popEl.offsetWidth;
      popEl.classList.add("pop");
    }
  }
  saveFavs();
  refreshFavBtns();
  if (!els.detailOverlay.hidden) renderDetail();
  if (!els.trayOverlay.hidden) renderTray();
}

/* ---------- 二选一 ---------- */
function randomLit(excludeId) {
  const pool = litStyles.filter((s) => s.id !== excludeId);
  return pool[Math.floor(Math.random() * pool.length)];
}
function startDuel(seedId) {
  state.duelRound = 1;
  state.duelA = (seedId && styleMap.get(seedId)) || randomLit();
  state.duelB = randomLit(state.duelA.id);
  renderDuel();
  openOverlay(els.duelOverlay);
}
function duelCard(style) {
  const hall = hallFor(style.category);
  return `<img src="${esc(coverThumb(style.id))}" alt="${esc(style.name)}" /><strong>${esc(style.name)}</strong><small>${esc(hall.name)}</small>`;
}
function renderDuel() {
  els.duelRound.textContent = `第 ${state.duelRound} / 5 轮`;
  els.duelA.innerHTML = duelCard(state.duelA);
  els.duelB.innerHTML = duelCard(state.duelB);
}
function pickDuel(winner) {
  if (!state.favs.has(winner.id)) {
    state.favs.add(winner.id);
    saveFavs();
    refreshFavBtns();
  }
  showToast(`「${winner.name}」赢了，已收藏`);
  if (state.duelRound >= 5) {
    closeOverlays();
    openTray();
    return;
  }
  state.duelRound += 1;
  state.duelA = winner;
  state.duelB = randomLit(winner.id);
  renderDuel();
}

/* ---------- 收藏托盘 ---------- */
function openTray() {
  renderTray();
  openOverlay(els.trayOverlay);
}
function renderTray() {
  const favs = Array.from(state.favs).map((id) => styleMap.get(id)).filter(Boolean);
  els.trayList.innerHTML = favs
    .map(
      (s) => `
      <div class="tray-item">
        <img src="${esc(coverThumb(s.id))}" alt="" loading="lazy" />
        <div><strong>${esc(s.name)}</strong><small>${esc(hallFor(s.category).name)} · 已点亮 ${litCount(s.id)}/7</small></div>
        <button class="tray-remove" type="button" data-remove="${esc(s.id)}" aria-label="移除 ${esc(s.name)}">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>
        </button>
      </div>`
    )
    .join("");
  els.trayEmpty.hidden = favs.length > 0;
  els.trayFoot.hidden = favs.length === 0;
  els.mixCard.hidden = favs.length < 2;
  if (favs.length >= 2) renderMix(favs[0], favs[1]);
}
function renderMix(a, b) {
  const v = Number(els.mixRange.value);
  els.mixNames.textContent = `${a.name} × ${b.name}`;
  els.mixText.textContent = `以 ${100 - v}% 的「${a.name}」打底，混入 ${v}% 的「${b.name}」制造记忆点。关键词：${[...a.tags.slice(0, 2), ...b.tags.slice(0, 2)].join("、")}。`;
}

function handoffText() {
  const favs = Array.from(state.favs).map((id) => styleMap.get(id)).filter(Boolean);
  return [
    "古典舞 PPT · 客户审美确认单",
    "",
    ...favs.flatMap((s, i) => [
      `${i + 1}. ${s.name}`,
      `   园区：${hallFor(s.category).name}（${s.category}）`,
      `   气质：${s.mood}`,
      `   标签：${s.tags.join("、")}`,
      `   已点亮页型：${litCount(s.id)}/7`,
      "",
    ]),
    "下一步：从以上候选中确认 1 个主方向、1 个备选方向，再进入完整 PPT 制作。",
  ].join("\n");
}

/* ---------- 浮层管理 ---------- */
function openOverlay(el) {
  closeOverlays();
  el.hidden = false;
  document.body.style.overflow = "hidden";
}
function closeOverlays() {
  [els.detailOverlay, els.duelOverlay, els.trayOverlay].forEach((el) => (el.hidden = true));
  document.body.style.overflow = "";
}

/* ---------- 事件 ---------- */
function bindEvents() {
  document.addEventListener("click", (event) => {
    const fav = event.target.closest("[data-fav]");
    if (fav) {
      event.stopPropagation();
      toggleFav(fav.dataset.fav, fav);
      return;
    }
    const card = event.target.closest("[data-style]");
    if (card) {
      const cat = styleMap.get(card.dataset.style)?.category;
      openDetail(card.dataset.style, data.styles.filter((s) => s.category === cat));
      return;
    }
    const jump = event.target.closest("[data-jump]");
    if (jump) {
      document.getElementById(`hall-${encodeURIComponent(jump.dataset.jump)}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const remove = event.target.closest("[data-remove]");
    if (remove) {
      state.favs.delete(remove.dataset.remove);
      saveFavs();
      refreshFavBtns();
      renderTray();
      return;
    }
    if (event.target.closest("[data-close]") || event.target.classList.contains("overlay")) closeOverlays();
  });

  $("[data-start]").addEventListener("click", () => els.halls.scrollIntoView({ behavior: "smooth", block: "start" }));
  $("[data-top]").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  $("[data-lucky]").addEventListener("click", () => {
    const s = randomLit();
    if (s) openDetail(s.id, litStyles);
  });
  $("[data-open-duel]").addEventListener("click", () => startDuel());
  $("[data-open-tray]").addEventListener("click", openTray);
  $("[data-detail-duel]").addEventListener("click", () => startDuel(state.detailId));
  els.detailFav.addEventListener("click", () => toggleFav(state.detailId));
  els.duelA.addEventListener("click", () => pickDuel(state.duelA));
  els.duelB.addEventListener("click", () => pickDuel(state.duelB));
  els.clearTray.addEventListener("click", () => {
    state.favs.clear();
    saveFavs();
    refreshFavBtns();
    renderTray();
  });
  els.copyHandoff.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(handoffText());
      showToast("客户确认单已复制");
    } catch {
      showToast("复制失败，请稍后重试");
    }
  });
  els.mixRange.addEventListener("input", () => renderTray());

  document.querySelectorAll("[data-step]").forEach((btn) =>
    btn.addEventListener("click", () => stepDetail(Number(btn.dataset.step)))
  );
  els.detailPages.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-page]");
    if (btn && !btn.disabled) {
      state.detailPage = btn.dataset.page;
      renderDetail();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeOverlays();
    if (!els.detailOverlay.hidden) {
      if (event.key === "ArrowLeft") stepDetail(-1);
      if (event.key === "ArrowRight") stepDetail(1);
    }
  });
}

renderHero();
renderHalls();
refreshFavBtns();
bindEvents();
