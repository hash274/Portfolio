/*
 * "Конструктор" mode: on desktop/laptop visitors can drag photos, buttons and
 * whole blocks around the page. The header and all text stay in place.
 * Off by default; toggled by a floating button. Nothing is saved — reload or
 * "Reset" puts everything back.
 *   drag            → photo or button under the cursor
 *   Shift + drag    → the whole block (case card, service, form, hero photo + buttons)
 *   Esc             → leave the mode
 */
(() => {
  const desktop = window.matchMedia("(min-width: 1024px) and (pointer: fine)");

  const TEXT = {
    uk: { on: "Режим конструктора", off: "Вийти з конструктора", reset: "Скинути",
          hint: "Тягни фото й кнопки · Shift — цілий блок · Esc — вийти" },
    en: { on: "Playground mode", off: "Exit playground", reset: "Reset",
          hint: "Drag photos & buttons · Shift — whole block · Esc — exit" },
    pl: { on: "Tryb konstruktora", off: "Wyjdź z konstruktora", reset: "Resetuj",
          hint: "Przeciągaj zdjęcia i przyciski · Shift — cały blok · Esc — wyjście" },
  };
  const t = () => TEXT[document.documentElement.lang] || TEXT.uk;

  // Never movable: the header and everything in it.
  const FIXED = "header, .header";
  // Photos and buttons (whole wrappers first, so their children don't split them).
  const WHOLE = ".hero__avatar-wrap, .case__cover, .btn";
  const ITEM = "button, img, input, textarea, select";
  // What Shift + drag picks up. Text inside a block travels with it.
  const BLOCK = ".case, .service, .hero__profile, .hero__actions, .contact__form";

  const css = document.createElement("style");
  css.textContent = `
    .pg-ui { position: fixed; left: 1.25rem; bottom: 1.25rem; z-index: 9999;
      display: flex; align-items: center; gap: .5rem; font-family: var(--font-mono, monospace);
      font-size: .75rem; text-transform: uppercase; letter-spacing: .04em; }
    .pg-ui button { cursor: pointer; border: 1px solid var(--border, #333); border-radius: 999px;
      background: var(--surface, #121212); color: var(--text, #fff); padding: .6rem 1rem;
      font: inherit; text-transform: inherit; letter-spacing: inherit; }
    .pg-ui button:hover { border-color: var(--accent, #ff7a45); color: var(--accent, #ff7a45); }
    .pg-ui .pg-toggle[aria-pressed="true"] { background: var(--accent, #ff7a45); color: #0a0a0a;
      border-color: var(--accent, #ff7a45); }
    .pg-ui .pg-hint { color: var(--muted, #999); display: none; }
    .pg-on .pg-ui .pg-hint, .pg-on .pg-ui .pg-reset { display: inline-block; }
    .pg-ui .pg-reset { display: none; }
    .pg-on, .pg-on * { user-select: none; }
    .pg-on .pg-hover { outline: 1px dashed var(--accent, #ff7a45); outline-offset: 3px; cursor: grab; }
    .pg-on .pg-dragging { cursor: grabbing; outline-style: solid; z-index: 9000; }
    .pg-moved { position: relative; z-index: 5; }
    @media (max-width: 1023px), (pointer: coarse) { .pg-ui { display: none; } }
  `;
  document.head.appendChild(css);

  const ui = document.createElement("div");
  ui.className = "pg-ui";
  ui.innerHTML = `<button type="button" class="pg-toggle" aria-pressed="false"></button>
    <button type="button" class="pg-reset"></button><span class="pg-hint"></span>`;
  document.body.appendChild(ui);
  const toggleBtn = ui.querySelector(".pg-toggle");
  const resetBtn = ui.querySelector(".pg-reset");
  const hint = ui.querySelector(".pg-hint");

  const moved = new Set();
  let on = false, drag = null, hovered = null, suppressClick = false;

  function label() {
    const s = t();
    toggleBtn.textContent = on ? s.off : s.on;
    resetBtn.textContent = s.reset;
    hint.textContent = s.hint;
  }

  function pick(target, wholeBlock) {
    if (!(target instanceof Element) || ui.contains(target)) return null;
    if (target.closest(".case-modal") || target.closest(FIXED)) return null;
    const el = wholeBlock ? target.closest(BLOCK) : target.closest(WHOLE) || target.closest(ITEM);
    return el && el !== document.body ? el : null;
  }

  function setOn(value) {
    on = value && desktop.matches;
    document.documentElement.classList.toggle("pg-on", on);
    toggleBtn.setAttribute("aria-pressed", String(on));
    if (!on && hovered) { hovered.classList.remove("pg-hover"); hovered = null; }
    label();
  }

  function reset() {
    moved.forEach((el) => { el.style.translate = ""; el.classList.remove("pg-moved"); delete el.dataset.pgX; delete el.dataset.pgY; });
    moved.clear();
  }

  toggleBtn.addEventListener("click", () => setOn(!on));
  resetBtn.addEventListener("click", reset);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && on) setOn(false); });
  desktop.addEventListener("change", () => { if (!desktop.matches) { setOn(false); reset(); } });

  document.addEventListener("pointerover", (e) => {
    if (!on || drag) return;
    const el = pick(e.target, e.shiftKey);
    if (el === hovered) return;
    hovered?.classList.remove("pg-hover");
    hovered = el;
    hovered?.classList.add("pg-hover");
  });

  document.addEventListener("pointerdown", (e) => {
    if (!on || e.button !== 0) return;
    const el = pick(e.target, e.shiftKey);
    if (!el) return;
    drag = { el, startX: e.clientX, startY: e.clientY,
             baseX: +el.dataset.pgX || 0, baseY: +el.dataset.pgY || 0, active: false };
  }, true);

  document.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
    if (!drag.active) {
      if (Math.hypot(dx, dy) < 5) return;          // tiny moves still count as clicks
      drag.active = true;
      drag.el.classList.add("pg-dragging", "pg-moved");
      moved.add(drag.el);
    }
    e.preventDefault();
    const x = drag.baseX + dx, y = drag.baseY + dy;
    drag.el.dataset.pgX = x; drag.el.dataset.pgY = y;
    drag.el.style.translate = `${x}px ${y}px`;
  }, true);

  document.addEventListener("pointerup", () => {
    if (!drag) return;
    if (drag.active) { drag.el.classList.remove("pg-dragging"); suppressClick = true; }
    drag = null;
  }, true);

  // A drag must not also open a link, a case or submit the form.
  document.addEventListener("click", (e) => {
    if (suppressClick) { e.preventDefault(); e.stopPropagation(); suppressClick = false; }
  }, true);
  document.addEventListener("dragstart", (e) => { if (on) e.preventDefault(); }, true);

  // Re-label when the site language changes.
  new MutationObserver(label).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  label();
})();
