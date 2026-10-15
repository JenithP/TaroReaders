const deck = document.getElementById("deck");
const slides = [...document.querySelectorAll(".slide")];
const progress = document.getElementById("progress");
const rail = document.getElementById("rail");
const starsLayer = document.getElementById("starsLayer");
const goodsPopup = document.getElementById("goodsPopup");
let step = 0;
let screenshotZoom = null;
const last = slides.length - 1;

function getScreenshotZoomGeometry(imageWidth, imageHeight, imageRect, stageRect, crop) {
  const [cropX, cropY, cropWidth, cropHeight] = crop;
  const sourceScale = Math.min(imageRect.width / imageWidth, imageRect.height / imageHeight);
  const sourceLeft = imageRect.left - stageRect.left + (imageRect.width - imageWidth * sourceScale) / 2 + cropX * sourceScale;
  const sourceTop = imageRect.top - stageRect.top + (imageRect.height - imageHeight * sourceScale) / 2 + cropY * sourceScale;
  const targetScale = Math.min(stageRect.width * .92 / cropWidth, stageRect.height * .9 / cropHeight);
  const width = cropWidth * targetScale;
  const height = cropHeight * targetScale;
  const left = (stageRect.width - width) / 2;
  const top = (stageRect.height - height) / 2;
  return { left, top, width, height, x: sourceLeft - left, y: sourceTop - top, scale: sourceScale / targetScale };
}

function closeScreenshotZoom(immediate = false) {
  const state = screenshotZoom;
  if (!state) return;
  if (state.closing && !immediate) return;
  cancelAnimationFrame(state.frame);
  clearTimeout(state.timer);
  state.closing = true;
  state.overlay.classList.remove("open");
  const finish = () => {
    state.overlay.remove();
    state.source.setAttribute("aria-expanded", "false");
    if (screenshotZoom === state) screenshotZoom = null;
    if (state.source.closest(".slide.active")) state.source.focus({ preventScroll: true });
  };
  if (immediate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) finish();
  else state.timer = window.setTimeout(finish, 670);
}

function openScreenshotZoom(source) {
  const original = source.querySelector("img");
  if (!original?.naturalWidth || !original.naturalHeight) return;
  closeScreenshotZoom(true);
  const crop = source.dataset.zoomCrop
    ? source.dataset.zoomCrop.split(",").map(Number)
    : [0, 0, original.naturalWidth, original.naturalHeight];
  const geometry = getScreenshotZoomGeometry(original.naturalWidth, original.naturalHeight, original.getBoundingClientRect(), deck.getBoundingClientRect(), crop);
  const overlay = document.createElement("div");
  overlay.className = "seminar-zoom";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", original.alt + " 확대 보기");
  const zoomButton = document.createElement("button");
  zoomButton.type = "button";
  zoomButton.className = "seminar-zoom-image";
  zoomButton.setAttribute("aria-label", "다시 클릭하여 원래 크기로 축소");
  for (const name of ["left", "top", "width", "height"]) {
    zoomButton.style.setProperty(`--zoom-${name}`, `${geometry[name]}px`);
  }
  zoomButton.style.setProperty("--shot-transform", `translate3d(${geometry.x}px, ${geometry.y}px, 0) scale(${geometry.scale})`);
  const image = document.createElement("img");
  image.src = original.currentSrc || original.src;
  image.alt = original.alt;
  image.draggable = false;
  image.style.width = `${original.naturalWidth / crop[2] * 100}%`;
  image.style.height = `${original.naturalHeight / crop[3] * 100}%`;
  image.style.left = `${-crop[0] / crop[2] * 100}%`;
  image.style.top = `${-crop[1] / crop[3] * 100}%`;
  zoomButton.appendChild(image);
  overlay.appendChild(zoomButton);
  overlay.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!screenshotZoom?.closing) closeScreenshotZoom();
  });
  deck.appendChild(overlay);
  source.setAttribute("aria-expanded", "true");
  const state = { overlay, source, button: zoomButton, closing: false, frame: 0, timer: 0 };
  screenshotZoom = state;
  zoomButton.getBoundingClientRect();
  state.frame = requestAnimationFrame(() => {
    if (screenshotZoom !== state || state.closing) return;
    overlay.classList.add("open");
    zoomButton.focus({ preventScroll: true });
  });
}

document.querySelectorAll(".seminar-site-shot, .admin-shot[data-zoom-crop]").forEach((source) => {
  source.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openScreenshotZoom(source);
  });
});
window.addEventListener("resize", () => closeScreenshotZoom(true));

function makeStars() {
  const count = 120;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i += 1) {
    const star = document.createElement("i");
    star.className = "star-dot";
    star.style.setProperty("--x", `${Math.random() * 100}%`);
    star.style.setProperty("--y", `${Math.random() * 100}%`);
    star.style.setProperty("--s", `${1 + Math.random() * 2.8}px`);
    star.style.setProperty("--d", `${1.7 + Math.random() * 3.2}s`);
    star.style.setProperty("--delay", `${Math.random() * -4}s`);
    frag.appendChild(star);
  }
  starsLayer.appendChild(frag);
}

function tryNextImage(img) {
  const candidates = (img.dataset.candidates || "").split("|").filter(Boolean);
  const index = Number(img.dataset.candidateIndex || 0);
  if (index < candidates.length) {
    img.dataset.candidateIndex = String(index + 1);
    img.src = candidates[index];
    return;
  }
  img.classList.add("missing");
}

document.querySelectorAll("img[data-candidates]").forEach((img) => {
  img.addEventListener("error", () => tryNextImage(img));
});

function pauseInactiveVideos() {
  document.querySelectorAll(".reels-video").forEach((video) => {
    if (!video.closest(".slide.active")) {
      video.pause();
      video.currentTime = 0;
      video.classList.remove("playing");
    }
  });
  document.querySelectorAll(".stardust-video").forEach((video) => {
    if (!video.closest(".slide.active")) {
      video.pause();
      try {
        video.currentTime = 0;
      } catch {
        // Some browsers defer seeking until video metadata is ready.
      }
    }
  });
}

function playActiveStardustVideos() {
  document.querySelectorAll(".slide.active .stardust-video").forEach((video) => {
    const speed = Number(video.dataset.speed || 4);
    video.playbackRate = speed;
    video.defaultPlaybackRate = speed;
    try {
      video.currentTime = 0;
    } catch {
      // Metadata may not be available on the first paint; autoplay still starts from the beginning.
    }
    const promise = video.play();
    if (promise?.catch) promise.catch(() => {});
  });
}

function setInstagramCarouselState(carousel, index) {
  const shots = [...carousel.querySelectorAll(".ig-shot")];
  const dots = [...carousel.querySelectorAll(".ig-dots i")];
  const video = carousel.querySelector(".reels-video");
  const nextIndex = Math.max(0, Math.min(index, shots.length - 1));
  carousel.dataset.carouselIndex = String(nextIndex);
  video?.pause();
  if (video) video.currentTime = 0;
  video?.classList.remove("playing");
  shots.forEach((shot, shotIndex) => shot.classList.toggle("active", shotIndex === nextIndex));
  dots.forEach((dot, dotIndex) => dot.classList.toggle("active", dotIndex === nextIndex));
}

function resetInactiveInstagramCarousels() {
  document.querySelectorAll(".instagram-carousel").forEach((carousel) => {
    if (!carousel.closest(".slide.active")) {
      setInstagramCarouselState(carousel, 0);
      carousel.classList.remove("swiping");
    }
  });
}

function updateRail() {
  rail.classList.toggle("visible", step >= 2 && step <= 39);
  document.querySelectorAll("[data-chip]").forEach((chip) => {
    const n = Number(chip.dataset.chip);
    chip.classList.toggle("on",
      (n === 1 && step >= 2 && step <= 8) ||
      (n === 2 && step >= 9 && step <= 13) ||
      (n === 3 && step >= 14 && step <= 16) ||
      (n === 4 && step >= 17 && step <= 20) ||
      (n === 5 && step >= 21 && step <= 32) ||
      (n === 6 && step >= 33 && step <= 39)
    );
  });
}

function setActive() {
  slides.forEach((slide, index) => slide.classList.toggle("active", index === step));
  closeScreenshotZoom(true);
  progress.style.setProperty("--progress", `${(step / last) * 100}%`);
  updateRail();
  pauseInactiveVideos();
  resetInactiveInstagramCarousels();
  playActiveStardustVideos();
  if (goodsPopup) goodsPopup.classList.remove("open");
}

function next() {
  step = Math.min(last, step + 1);
  setActive();
}

function prev() {
  step = Math.max(0, step - 1);
  setActive();
}

function setSiteDemoState(phone, index) {
  phone.dataset.demoIndex = String(index);
  phone.querySelectorAll(".phone-panel").forEach((panel, panelIndex) => {
    panel.classList.toggle("active", panelIndex === index);
  });
}

document.querySelectorAll(".site-demo").forEach((phone) => {
  phone.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const panels = [...phone.querySelectorAll(".phone-panel")];
    const current = Number(phone.dataset.demoIndex || 0);
    const nextIndex = Math.min(panels.length - 1, current + 1);
    setSiteDemoState(phone, nextIndex);
  });
});

document.querySelectorAll(".instagram-hotspot").forEach((button) => {
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const carousel = button.closest(".instagram-carousel");
    if (!carousel) return;
    const shots = [...carousel.querySelectorAll(".ig-shot")];
    const current = Number(carousel.dataset.carouselIndex || 0);
    const video = carousel.querySelector(".reels-video");
    if (current >= shots.length - 1 && video) {
      try {
        if (video.classList.contains("playing")) {
          video.pause();
          video.classList.remove("playing");
        } else {
          await video.play();
          video.classList.add("playing");
        }
      } catch {
        video.classList.remove("playing");
      }
      return;
    }
    const nextIndex = current + 1;
    carousel.classList.add("swiping");
    setInstagramCarouselState(carousel, nextIndex);
    window.setTimeout(() => carousel.classList.remove("swiping"), 240);
  });
});

document.querySelectorAll(".video-hotspot").forEach((button) => {
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const video = button.parentElement.querySelector(".reels-video");
    if (!video) return;
    try {
      if (video.classList.contains("playing")) {
        video.pause();
        video.classList.remove("playing");
        return;
      }
      await video.play();
      video.classList.add("playing");
    } catch {
      video.classList.remove("playing");
    }
  });
});

document.querySelectorAll(".seminar-go").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    next();
  });
});

document.querySelectorAll(".marketing-card").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    goodsPopup?.classList.toggle("open");
  });
});

goodsPopup?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  goodsPopup.classList.remove("open");
});

deck.addEventListener("click", (event) => {
  if (goodsPopup?.classList.contains("open")) {
    goodsPopup.classList.remove("open");
    return;
  }
  if (event.target.closest("button, a, video")) return;
  next();
});

window.addEventListener("keydown", (event) => {
  if (screenshotZoom) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeScreenshotZoom();
    } else if (event.key === "Tab") {
      event.preventDefault();
      screenshotZoom.button.focus({ preventScroll: true });
    }
    return;
  }
  if ((event.key === " " || event.key === "Enter") && event.target.closest?.(".seminar-site-shot, .admin-shot")) return;
  if (event.key === "ArrowRight" || event.key === " " || event.key === "PageDown") {
    event.preventDefault();
    next();
  }
  if (event.key === "ArrowLeft" || event.key === "PageUp" || event.key === "Backspace") {
    event.preventDefault();
    prev();
  }
  if (event.key.toLowerCase() === "f") {
    if (!document.fullscreenElement) deck.requestFullscreen?.();
    else document.exitFullscreen?.();
  }
  if (event.key === "Home") {
    step = 0;
    setActive();
  }
  if (event.key === "End") {
    step = last;
    setActive();
  }
});

makeStars();
setActive();
