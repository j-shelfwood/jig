// scenes.ts: plays each landing scene once when it scrolls into view, and replays it on request.
//
// The resting state of every scene is its final frame (src/styles/scenes.css), so this script only adds
// motion: it is skipped entirely under prefers-reduced-motion (the inline script in index.astro then never
// sets html.motion). The hero ring loops, and is paused while off screen.
const scenes = document.querySelectorAll<HTMLElement>("[data-scene]");
const motion = document.documentElement.classList.contains("motion");

function play(el: HTMLElement) {
  el.classList.add("is-reset");
  void el.offsetWidth; // restart CSS animations
  el.classList.remove("is-reset");
  el.classList.add("is-playing");
}

if (motion && "IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const el = (e.target as HTMLElement).closest<HTMLElement>("[data-scene]")!;
        if (el.hasAttribute("data-loop")) el.classList.toggle("is-playing", e.isIntersecting);
        else if (e.isIntersecting && !el.classList.contains("is-playing")) {
          play(el);
          io.unobserve(e.target);
        }
      }
    },
    // A scene plays when the top of its stage passes the lower quarter of the viewport. A ratio threshold
    // would never fire for a stage taller than the viewport (the record scene on a phone).
    { rootMargin: "0px 0px -25% 0px", threshold: 0 },
  );
  scenes.forEach((s) => io.observe(s.querySelector(".scene__stage") ?? s));
} else {
  scenes.forEach((s) => s.classList.add("is-playing"));
}

document.querySelectorAll<HTMLButtonElement>("[data-replay]").forEach((b) =>
  b.addEventListener("click", () => {
    const scene = b.closest<HTMLElement>("[data-scene]");
    if (scene) play(scene);
  }),
);

// Architecture diagram: a tab list over the layers (arrow keys move between nodes).
document.querySelectorAll<HTMLElement>("[data-arch]").forEach((root) => {
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const select = (t: HTMLButtonElement, focus = false) => {
    for (const x of tabs) {
      const on = x === t;
      x.setAttribute("aria-selected", String(on));
      x.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(x.getAttribute("aria-controls")!);
      if (panel) panel.hidden = !on;
    }
    root.dataset.active = t.dataset.node;
    if (focus) t.focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => select(t));
    t.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (e.key === "Home") select(tabs[0]!, true);
      else if (e.key === "End") select(tabs[tabs.length - 1]!, true);
      else if (d) select(tabs[(i + d + tabs.length) % tabs.length]!, true);
      else return;
      e.preventDefault();
    });
  });
});
