/* BINHI published-site runtime: scroll-triggered entrance animations only.
   No tracking, no network calls. Honors prefers-reduced-motion. */
(function () {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.querySelectorAll(".b-anim").forEach(function (el) { el.classList.add("b-in"); });
    return;
  }
  var els = document.querySelectorAll(".b-anim:not(.b-anim-load)");
  if (!("IntersectionObserver" in window)) { els.forEach(function (el) { el.classList.add("b-in"); }); return; }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("b-in"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -10% 0px" });
  els.forEach(function (el) { io.observe(el); });
})();
