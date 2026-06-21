/* ===========================================================================
   Teloquent docs — shell partagé multi-pages (header, sidebar, TOC, thème...).
   Chaque page ne contient que son <main>. Ce script construit le reste.
   =========================================================================== */
(function () {
  "use strict";

  const NAV = [
    {
      title: "Démarrage",
      items: [
        { href: "index.html", label: "Introduction" },
        { href: "installation.html", label: "Installation" },
        { href: "connexions.html", label: "Connexions" },
        { href: "modeles.html", label: "Définir un modèle" },
      ],
    },
    {
      title: "Requêtes",
      items: [
        { href: "crud.html", label: "CRUD" },
        { href: "query-builder.html", label: "Query Builder" },
        { href: "relations.html", label: "Relations" },
        { href: "eager-loading.html", label: "Eager loading & withCount" },
      ],
    },
    {
      title: "Fonctionnalités",
      items: [
        { href: "soft-deletes.html", label: "Soft deletes" },
        { href: "scopes.html", label: "Scopes" },
        { href: "pagination.html", label: "Pagination" },
        { href: "helpers.html", label: "Helpers CRUD" },
        { href: "serialisation.html", label: "Sérialisation" },
        { href: "collections.html", label: "Collections" },
      ],
    },
    {
      title: "Base de données",
      items: [
        { href: "schema.html", label: "Schéma" },
        { href: "migrations.html", label: "Migrations" },
        { href: "evenements.html", label: "Événements" },
        { href: "multi-sgbd.html", label: "Multi-SGBD" },
      ],
    },
    { title: "Aller plus loin", items: [{ href: "deploiement.html", label: "Déployer la doc" }] },
  ];

  const flat = NAV.flatMap((g) => g.items);
  const current = location.pathname.split("/").pop() || "index.html";

  // ----- Thème
  const root = document.documentElement;
  if (!root.getAttribute("data-theme")) {
    const saved = localStorage.getItem("teloquent-theme");
    root.setAttribute(
      "data-theme",
      saved || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    );
  }

  // ----- Header
  const header = document.createElement("header");
  header.className = "topbar";
  header.innerHTML =
    '<button class="icon-btn" id="menuToggle" aria-label="Menu">☰</button>' +
    '<a class="brand" href="index.html"><span class="logo">T</span> Teloquent <span class="ver">v1</span></a>' +
    '<div class="spacer"></div>' +
    '<div class="search-wrap"><input id="search" type="text" placeholder="Rechercher…  ( / )" autocomplete="off"></div>' +
    '<button class="icon-btn" id="themeToggle" aria-label="Thème">☾</button>';
  document.body.prepend(header);

  const backdrop = document.createElement("div");
  backdrop.className = "backdrop";
  document.body.appendChild(backdrop);

  // ----- Layout : on enveloppe le <main> existant
  const main = document.querySelector("main");
  const layout = document.createElement("div");
  layout.className = "layout";
  main.parentNode.insertBefore(layout, main);

  const sidebar = document.createElement("nav");
  sidebar.className = "sidebar";
  let navHtml = '<div class="no-results">Aucun résultat.</div>';
  for (const group of NAV) {
    navHtml += "<h4>" + group.title + "</h4>";
    for (const it of group.items) {
      const active = it.href === current ? ' class="active"' : "";
      navHtml += '<a href="' + it.href + '"' + active + ">" + it.label + "</a>";
    }
  }
  sidebar.innerHTML = navHtml;

  const toc = document.createElement("aside");
  toc.className = "toc";

  layout.appendChild(sidebar);
  layout.appendChild(main);
  layout.appendChild(toc);

  // ----- Prev / Next
  const idx = flat.findIndex((i) => i.href === current);
  if (idx !== -1) {
    const prev = flat[idx - 1];
    const next = flat[idx + 1];
    const pn = document.createElement("div");
    pn.className = "prevnext";
    pn.innerHTML =
      (prev ? '<a class="pn prev" href="' + prev.href + '"><span>← Précédent</span><b>' + prev.label + "</b></a>" : "<span></span>") +
      (next ? '<a class="pn next" href="' + next.href + '"><span>Suivant →</span><b>' + next.label + "</b></a>" : "<span></span>");
    main.appendChild(pn);
  }

  // ----- Footer
  const footer = document.createElement("footer");
  footer.innerHTML =
    'Teloquent v1 — ORM TypeScript inspiré de Laravel Eloquent · Licence MIT · ' +
    '<a href="https://www.npmjs.com/package/teloquent">npm</a>';
  document.body.appendChild(footer);

  // ----- TOC auto (à partir des h2/h3 du main)
  const slug = (s) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const headings = main.querySelectorAll("h2, h3");
  if (headings.length) {
    let tocHtml = "<strong>Sur cette page</strong>";
    headings.forEach((h) => {
      if (!h.id) h.id = slug(h.textContent);
      const cls = h.tagName === "H3" ? ' class="lvl3"' : "";
      tocHtml += '<a href="#' + h.id + '"' + cls + ">" + h.textContent + "</a>";
    });
    toc.innerHTML = tocHtml;
  }

  // ----- Thème toggle
  const themeBtn = document.getElementById("themeToggle");
  const syncIcon = () => (themeBtn.textContent = root.getAttribute("data-theme") === "dark" ? "☀" : "☾");
  syncIcon();
  themeBtn.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem("teloquent-theme", next);
    syncIcon();
  });

  // ----- Menu mobile
  document.getElementById("menuToggle").addEventListener("click", () =>
    document.body.classList.toggle("nav-open")
  );
  backdrop.addEventListener("click", () => document.body.classList.remove("nav-open"));

  // ----- Recherche (filtre la sidebar)
  const search = document.getElementById("search");
  const noResults = sidebar.querySelector(".no-results");
  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    let visible = 0;
    sidebar.querySelectorAll("a[href]").forEach((a) => {
      const match = a.textContent.toLowerCase().includes(q);
      a.classList.toggle("hidden", q && !match);
      if (!q || match) visible++;
    });
    sidebar.querySelectorAll("h4").forEach((h) => (h.style.display = q ? "none" : ""));
    noResults.style.display = q && visible === 0 ? "block" : "none";
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== search) {
      e.preventDefault();
      search.focus();
    }
  });

  // ----- Coloration syntaxique (highlight.js via CDN, chargé dynamiquement)
  function addScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = res;
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  const HLJS = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/";
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = HLJS + "styles/github-dark.min.css";
  document.head.appendChild(css);

  function enhanceCode() {
    document.querySelectorAll(".code-block").forEach((block) => {
      if (block.querySelector(".copy-btn")) return;
      const btn = document.createElement("button");
      btn.className = "copy-btn";
      btn.textContent = "Copier";
      btn.addEventListener("click", () => {
        navigator.clipboard.writeText(block.querySelector("code").innerText).then(() => {
          btn.textContent = "Copié ✓";
          btn.classList.add("copied");
          setTimeout(() => {
            btn.textContent = "Copier";
            btn.classList.remove("copied");
          }, 1500);
        });
      });
      block.appendChild(btn);
    });
  }

  addScript(HLJS + "highlight.min.js")
    .then(() => addScript(HLJS + "languages/typescript.min.js").catch(() => {}))
    .then(() => {
      if (window.hljs) document.querySelectorAll("pre code").forEach((el) => window.hljs.highlightElement(el));
    })
    .catch(() => {})
    .finally(enhanceCode);
  enhanceCode();

  // ----- Scrollspy pour la TOC
  const tocLinks = Array.from(toc.querySelectorAll("a"));
  if (tocLinks.length) {
    const byId = new Map(tocLinks.map((a) => [a.getAttribute("href").slice(1), a]));
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            tocLinks.forEach((a) => a.classList.remove("active"));
            const a = byId.get(e.target.id);
            if (a) a.classList.add("active");
          }
        });
      },
      { rootMargin: "-80px 0px -70% 0px" }
    );
    headings.forEach((h) => obs.observe(h));
  }
})();
