// main.js — shared site-wide small behaviors

// Highlight the active page in the nav
(function () {
    const path = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll("nav a").forEach((a) => {
      const href = a.getAttribute("href");
      if (href && path.endsWith(href)) {
        a.style.color = "#fff";
        a.style.fontWeight = "600";
        a.style.textDecoration = "underline";
      }
    });
  })();
  
  // Smooth scroll to anchors (if any on a page)
  (function () {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener("click", function (e) {
        const targetId = this.getAttribute("href").slice(1);
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          e.preventDefault();
          window.scrollTo({
            top: targetEl.offsetTop - 60,
            behavior: "smooth",
          });
        }
      });
    });
  })();
  
  // Optional "Fun Mode" toggle for landing page
  (function () {
    const btn = document.getElementById("funToggle");
    if (!btn) return;
  
    let active = false;
    btn.addEventListener("click", () => {
      active = !active;
      btn.classList.toggle("btn-ghost");
      btn.setAttribute("aria-pressed", String(active));
      btn.textContent = active ? "✨ Fun Mode: ON" : "✨ Fun Mode: OFF";
  
      // Dispatch custom event (Three.js script listens)
      window.dispatchEvent(new CustomEvent("funToggle", { detail: { active } }));
    });
  })();
  
  // Mobile nav collapse (optional)
  (function () {
    const nav = document.querySelector("header nav");
    if (!nav) return;
    // If you later add a hamburger button, you can hook toggle behavior here.
  })();
  