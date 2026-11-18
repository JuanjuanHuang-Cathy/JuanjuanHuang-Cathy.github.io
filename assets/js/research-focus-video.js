(() => {
  const video = document.getElementById("sargent-dxas");
  const toggle = document.getElementById("sargent-playback");
  if (!video || !toggle || !("IntersectionObserver" in window)) return;

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let wantsPlayback = !motion.matches;
  let inView = false;

  function showState() {
    const label = video.paused ? "Play the time series" : "Pause the time series";
    toggle.setAttribute("aria-label", label);
    toggle.title = label;
    toggle.toggleAttribute("data-playing", !video.paused);
  }

  function updatePlayback() {
    if (!inView || document.hidden || !wantsPlayback) {
      video.pause();
    } else {
      video.play().catch(showState);
    }
  }

  function togglePlayback() {
    wantsPlayback = video.paused;
    updatePlayback();
  }

  video.controls = false;
  toggle.hidden = false;
  showState();
  video.addEventListener("play", showState);
  video.addEventListener("pause", showState);
  toggle.addEventListener("click", togglePlayback);
  video.addEventListener("click", togglePlayback);
  new IntersectionObserver(([entry]) => {
    inView = entry.intersectionRatio >= 0.25;
    updatePlayback();
  }, { threshold: [0, 0.25] }).observe(video);
  document.addEventListener("visibilitychange", updatePlayback);
  motion.addEventListener("change", () => {
    wantsPlayback = !motion.matches;
    updatePlayback();
  });
})();
