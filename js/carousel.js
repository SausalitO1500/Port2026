(function () {
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function init(root) {
    var viewport = root.querySelector("[data-carousel-viewport]");
    var track = root.querySelector("[data-carousel-track]");
    var prev = root.querySelector("[data-carousel-prev]");
    var next = root.querySelector("[data-carousel-next]");
    var count = root.querySelector("[data-carousel-count]");
    var status = root.querySelector("[data-carousel-status]");
    if (!viewport || !track || !prev || !next || !count) return;

    var slides = Array.prototype.slice.call(track.children).filter(function (slide) {
      return slide.classList.contains("carousel__slide");
    });
    if (!slides.length) return;

    var label = root.getAttribute("data-carousel-label") || "items";
    var looping = root.hasAttribute("data-carousel-loop") && slides.length > 1;
    var index = 0;
    var gesture = null;
    var suppressClick = false;
    var settleTimer = 0;

    if (!viewport.id) {
      viewport.id = "carousel-" + Math.random().toString(36).slice(2, 8);
    }
    prev.setAttribute("aria-controls", viewport.id);
    next.setAttribute("aria-controls", viewport.id);

    slides.forEach(function (slide, slideIndex) {
      slide.setAttribute("data-carousel-index", String(slideIndex));
      slide.setAttribute("aria-roledescription", "slide");
    });

    function perView() {
      var value = parseInt(getComputedStyle(root).getPropertyValue("--carousel-per-view"), 10);
      if (!value || value < 1) value = 1;
      return Math.min(value, slides.length);
    }

    function gapSize() {
      var gap = parseFloat(getComputedStyle(track).columnGap);
      return isNaN(gap) ? 0 : gap;
    }

    function singularLabel() {
      return label.replace(/s$/, "");
    }

    function makeClone(slide) {
      var clone = slide.cloneNode(true);
      clone.setAttribute("data-carousel-clone", "");
      clone.setAttribute("aria-hidden", "true");
      clone.setAttribute("inert", "");
      clone.querySelectorAll("[id]").forEach(function (node) {
        node.removeAttribute("id");
      });
      return clone;
    }

    function rebuild() {
      track.querySelectorAll("[data-carousel-clone]").forEach(function (clone) {
        clone.remove();
      });
      if (!looping) return;

      var before = document.createDocumentFragment();
      var after = document.createDocumentFragment();
      slides.forEach(function (slide) {
        before.appendChild(makeClone(slide));
        after.appendChild(makeClone(slide));
      });
      slides.forEach(function (slide) {
        track.appendChild(slide);
      });
      track.insertBefore(before, track.firstChild);
      track.appendChild(after);
    }

    function applyTransform(instant) {
      var snap = Boolean(instant) || reduceMotion.matches;
      track.classList.toggle("is-instant", snap);
      var width = slides[0].getBoundingClientRect().width;
      var offset = index * (width + gapSize());
      track.style.transform = "translate3d(" + -offset + "px, 0, 0)";
      if (snap && !reduceMotion.matches) {
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            track.classList.remove("is-instant");
          });
        });
      }
    }

    function currentSlide() {
      return track.children[index] || slides[0];
    }

    function updateSlides(view) {
      Array.prototype.forEach.call(track.children, function (slide, slideIndex) {
        var visible = slideIndex >= index && slideIndex < index + view;
        var clone = slide.hasAttribute("data-carousel-clone");
        if (visible && !clone) {
          slide.removeAttribute("aria-hidden");
          slide.removeAttribute("inert");
        } else if (visible && clone) {
          slide.removeAttribute("inert");
          slide.setAttribute("aria-hidden", "true");
        } else {
          slide.setAttribute("aria-hidden", "true");
          slide.setAttribute("inert", "");
        }
      });
    }

    function statusText(view) {
      var names = [];
      for (var i = 0; i < view; i += 1) {
        var slide = track.children[index + i];
        var heading = slide && slide.querySelector("h3");
        if (heading) names.push(heading.textContent.replace(/\s+/g, " ").trim());
      }
      var position = parseInt(currentSlide().getAttribute("data-carousel-index"), 10) + 1;
      var place = "Project " + position + " of " + slides.length;
      if (!names.length || view === 1) return "Showing " + place.toLowerCase();
      return names.join(", ") + ". " + place;
    }

    function updateUI(fromUser) {
      var view = perView();
      var position = parseInt(currentSlide().getAttribute("data-carousel-index"), 10);
      if (isNaN(position)) position = 0;

      if (looping) {
        prev.disabled = false;
        next.disabled = false;
        count.textContent = position + 1 + " / " + slides.length;
      } else {
        var max = Math.max(0, slides.length - view);
        prev.disabled = index <= 0;
        next.disabled = index >= max;
        count.textContent = index + 1 + " / " + (max + 1);
      }

      var noun = view > 1 ? label : singularLabel();
      prev.setAttribute("aria-label", "Previous " + noun);
      next.setAttribute("aria-label", "Next " + noun);
      updateSlides(view);
      if (fromUser && status) status.textContent = statusText(view);
    }

    function settle() {
      if (!looping) return;
      var total = slides.length;
      var shift = index - total;
      shift = ((shift % total) + total) % total;
      if (shift === 0 && index === total) return;
      if (shift !== 0) {
        slides.push.apply(slides, slides.splice(0, shift));
      }
      index = total;
      rebuild();
      applyTransform(true);
      updateUI(false);
    }

    function scheduleSettle() {
      window.clearTimeout(settleTimer);
      if (!looping) return;
      if (reduceMotion.matches) {
        settle();
        return;
      }
      settleTimer = window.setTimeout(settle, 560);
    }

    function go(delta, fromUser, instant) {
      var view = perView();
      if (looping) {
        var dest = index + delta;
        if (dest < slides.length || dest >= slides.length * 2) settle();
        index += delta;
      } else {
        var max = Math.max(0, slides.length - view);
        var target = Math.max(0, Math.min(max, index + delta));
        if (fromUser && target === index) return;
        index = target;
      }

      applyTransform(instant);
      updateUI(fromUser);
      if (looping) {
        if (instant || reduceMotion.matches) settle();
        else scheduleSettle();
      }
    }

    function onResize() {
      applyTransform(true);
      updateUI(false);
    }

    prev.addEventListener("click", function () {
      go(-1, true);
    });

    next.addEventListener("click", function () {
      go(1, true);
    });

    root.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
      var tag = event.target && event.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      event.preventDefault();
      go(event.key === "ArrowRight" ? 1 : -1, true);
    });

    track.addEventListener("transitionend", function (event) {
      if (event.target !== track || event.propertyName !== "transform") return;
      window.clearTimeout(settleTimer);
      settle();
    });

    viewport.addEventListener("pointerdown", function (event) {
      if (event.pointerType !== "touch" || event.button !== 0) return;
      gesture = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        locked: false,
      };
    });

    viewport.addEventListener(
      "pointermove",
      function (event) {
        if (!gesture || event.pointerId !== gesture.id) return;
        var dx = event.clientX - gesture.x;
        var dy = event.clientY - gesture.y;
        if (!gesture.locked) {
          if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
          if (Math.abs(dy) > Math.abs(dx)) {
            gesture = null;
            return;
          }
          gesture.locked = true;
          try {
            viewport.setPointerCapture(event.pointerId);
          } catch (error) {}
        }
        event.preventDefault();
      },
      { passive: false }
    );

    function endGesture(event) {
      if (!gesture || event.pointerId !== gesture.id) return;
      var dx = event.clientX - gesture.x;
      var locked = gesture.locked;
      gesture = null;
      if (!locked || Math.abs(dx) < 48) return;
      suppressClick = true;
      go(dx < 0 ? 1 : -1, true);
    }

    viewport.addEventListener("pointerup", endGesture);
    viewport.addEventListener("pointercancel", function (event) {
      if (gesture && event.pointerId === gesture.id) gesture = null;
    });

    viewport.addEventListener(
      "click",
      function (event) {
        if (!suppressClick) return;
        suppressClick = false;
        event.preventDefault();
        event.stopPropagation();
      },
      true
    );

    if (looping) {
      rebuild();
      index = slides.length;
    }

    if (window.ResizeObserver) {
      new ResizeObserver(onResize).observe(viewport);
    } else {
      window.addEventListener("resize", onResize);
    }

    reduceMotion.addEventListener("change", onResize);
    applyTransform(true);
    updateUI(false);
  }

  document.querySelectorAll("[data-carousel]").forEach(init);
})();
