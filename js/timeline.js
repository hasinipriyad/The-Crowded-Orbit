// Timeline with searchable dropdown filters + persistent bottom context panel
// Data columns used: launch_year, owner_clean, object_type, status, name

(async function () {
  const DATA_URL = "data/clean_leo_satellites.csv";
  const raw = await d3.csv(DATA_URL, d3.autoType);

  // Normalize rows
  const rows = raw
    .filter(d => d.launch_year != null)
    .map(d => ({
      year: +d.launch_year,
      country: d.owner_clean || "Unknown",
      type: d.object_type || "UNK", // 'PAY','R/B','DEB','UNK'
      status: d.status || "Other",
      name: (d.name || "").toString(),
    }));

  // ====== Elements
  const chartWrap   = d3.select("#chart");
  const modeBtns    = Array.from(document.querySelectorAll(".mode-btn"));
  const clearBtn    = document.getElementById("clearFilters");

  // Filter component roots
  const countryRoot = document.getElementById("countryFilter");
  const typeRoot    = document.getElementById("typeFilter");
  const countrySummaryEl = document.getElementById("countrySummary");
  const typeSummaryEl    = document.getElementById("typeSummary");

  // Context panel elements
  const ctxTitle   = document.getElementById("ctxTitle");
  const ctxSummary = document.getElementById("ctxSummary");
  const ctxImg     = document.getElementById("ctxImg");
  const ctxDriverList = document.getElementById("ctxDriverList");

  // ====== State
  let mode = "yearly";
  const uniq = arr => Array.from(new Set(arr)).sort((a,b)=> (a>b?1:a<b?-1:0));
  const allCountries = uniq(rows.map(d => d.country));
  const allTypes     = uniq(rows.map(d => d.type));
  const allYears     = uniq(rows.map(d => d.year)).map(Number).sort((a,b)=>a-b);

  const selectedCountries = new Set();        // empty => all
  const selectedTypes     = new Set(["PAY"]); // default to payloads

  // ====== Searchable Dropdown Component
  function setupSearchableDropdown(rootEl, allValues, selectedSet, summaryEl, placeholderLabel) {
    const btn = rootEl.querySelector("[data-toggle='panel']");
    const panel = rootEl.querySelector("[data-panel]");
    const search = panel.querySelector("[data-search]");
    const optionsWrap = panel.querySelector("[data-options]");
    const clear = panel.querySelector("[data-clear]");
    const selectAll = panel.querySelector("[data-selectall]");

    function renderOptions(filterText = "") {
      const q = filterText.trim().toLowerCase();
      const values = allValues.filter(v => v.toLowerCase().includes(q));
      optionsWrap.innerHTML = "";

      values.forEach(v => {
        const id = `${placeholderLabel}-${v}`.replace(/\s+/g, "_");
        const row = document.createElement("label");
        row.className = "flex items-center gap-2 text-sm text-gray-200";
        row.innerHTML = `
          <input type="checkbox" class="accent-white/90 bg-black/60 rounded" id="${id}" ${selectedSet.has(v) ? "checked": ""}/>
          <span>${v}</span>
        `;
        row.querySelector("input").addEventListener("change", (e) => {
          if (e.target.checked) selectedSet.add(v);
          else selectedSet.delete(v);
          updateSummary();
          render(); // re-draw chart as filters change
        });
        optionsWrap.appendChild(row);
      });

      if (values.length === 0) {
        const empty = document.createElement("div");
        empty.className = "text-xs text-gray-400";
        empty.textContent = "No matches";
        optionsWrap.appendChild(empty);
      }
    }

    function updateSummary() {
      if (selectedSet.size === 0) {
        summaryEl.textContent = "(All)";
      } else if (selectedSet.size <= 3) {
        summaryEl.textContent = `(${Array.from(selectedSet).join(", ")})`;
      } else {
        summaryEl.textContent = `(${selectedSet.size} selected)`;
      }
    }

    // initial render
    updateSummary();
    renderOptions("");

    // toggle panel
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = panel.classList.contains("hidden");
      document.querySelectorAll("[data-panel]").forEach(p => p.classList.add("hidden"));
      if (isHidden) {
        panel.classList.remove("hidden");
        search.value = "";
        renderOptions("");
        setTimeout(() => search.focus(), 0);
      } else {
        panel.classList.add("hidden");
      }
    });

    // search filter
    search.addEventListener("input", () => renderOptions(search.value));

    // clear and select all
    clear.addEventListener("click", () => {
      selectedSet.clear();
      updateSummary();
      renderOptions(search.value);
      render();
    });

    selectAll.addEventListener("click", () => {
      allValues.forEach(v => selectedSet.add(v));
      updateSummary();
      renderOptions(search.value);
      render();
    });

    // click outside closes
    document.addEventListener("click", (e) => {
      if (!rootEl.contains(e.target)) {
        panel.classList.add("hidden");
      }
    });

    return { updateSummary, renderOptions };
  }

  const countryDD = setupSearchableDropdown(
    countryRoot, allCountries, selectedCountries, countrySummaryEl, "country"
  );
  const typeDD = setupSearchableDropdown(
    typeRoot, allTypes, selectedTypes, typeSummaryEl, "type"
  );

  // ====== Mode toggle
  function setMode(next) {
    mode = next;
    modeBtns.forEach(b => {
      if (b.dataset.mode === mode) b.classList.add("bg-white/10");
      else b.classList.remove("bg-white/10");
    });
    render();
  }
  modeBtns.forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));

  // ====== Clear filters
  clearBtn.addEventListener("click", () => {
    selectedCountries.clear();
    selectedTypes.clear(); selectedTypes.add("PAY");
    countryDD.updateSummary();
    typeDD.updateSummary();
    render();
  });

  // ====== Data helpers
  function inferDriver(name) {
    const n = name.toUpperCase();
    if (n.includes("STARLINK")) return "Starlink";
    if (n.includes("ONEWEB")) return "OneWeb";
    if (n.includes("IRIDIUM")) return "Iridium";
    if (n.includes("GPS")) return "GPS";
    if (n.includes("GLONASS")) return "GLONASS";
    if (n.includes("GALILEO")) return "Galileo";
    if (n.includes("BEIDOU") || n.includes("BDS")) return "BeiDou";
    if (n.includes("PLANET") || n.includes("FLOCK") || n.includes("DOVE")) return "Planet";
    if (/\bCUBE[-\s]?SAT\b/.test(n) || n.includes("CUBESAT")) return "CubeSat";
    return "Other";
  }

  function filteredRows() {
    const byCountry = (selectedCountries.size === 0)
      ? rows
      : rows.filter(r => selectedCountries.has(r.country));
    const byType = (selectedTypes.size === 0)
      ? byCountry
      : byCountry.filter(r => selectedTypes.has(r.type));
    return byType;
  }

  function yearlySeries(data) {
    const map = d3.rollup(data, v => v.length, d => d.year);
    return allYears.map(y => ({ year: y, value: map.get(y) || 0 }));
  }
  function cumulativeSeries(yearly) {
    let acc = 0;
    return yearly.map(d => ({ year: d.year, value: (acc += d.value) }));
  }

  // ====== Chart render
  const margin = { top: 18, right: 24, bottom: 42, left: 64 };
  const height = 440;

  function render() {
    chartWrap.selectAll("svg").remove();
    const width = Math.min(980, chartWrap.node().clientWidth || 980);
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = chartWrap.append("svg")
      .attr("width", width)
      .attr("height", height);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const data = filteredRows();
    const yearly = yearlySeries(data);
    const cum = cumulativeSeries(yearly);

    const x = d3.scaleBand()
      .domain(yearly.map(d => d.year))
      .range([0, innerW]).padding(0.18);

    const yMax = d3.max((mode === "yearly" ? yearly : cum), d => d.value) || 1;
    const y = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0]);

    // Axes
    const xAxis = d3.axisBottom(x).tickValues(yearly.map(d => d.year).filter((_,i)=>!(i%Math.ceil(yearly.length/10))));
    const yAxis = d3.axisLeft(y).ticks(6);

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .attr("class", "text-gray-300")
      .call(xAxis)
      .call(g => g.selectAll("text").style("font-size","10px"));

    g.append("g")
      .attr("class", "text-gray-300")
      .call(yAxis)
      .call(g => g.selectAll("text").style("font-size","10px"));

    // Yearly bars
    if (mode === "yearly") {
      g.selectAll(".bar")
        .data(yearly)
        .join("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.year))
        .attr("y", d => y(d.value))
        .attr("width", x.bandwidth())
        .attr("height", d => innerH - y(d.value))
        .attr("fill", "#7aa7ff")
        .attr("opacity", 0.9)
        .style("cursor","pointer")
        .on("click", (ev, d) => updateContext(d.year, data));
    }

    // Cumulative line
    if (mode === "cumulative") {
      const line = d3.line()
        .x(d => x(d.year) + x.bandwidth() / 2)
        .y(d => y(d.value));

      g.append("path")
        .datum(cum)
        .attr("fill", "none")
        .attr("stroke", "#b3f0ff")
        .attr("stroke-width", 2)
        .attr("d", line);

      g.selectAll(".dot")
        .data(cum)
        .join("circle")
        .attr("class", "dot")
        .attr("cx", d => x(d.year) + x.bandwidth() / 2)
        .attr("cy", d => y(d.value))
        .attr("r", 4)
        .attr("fill", "#b3f0ff")
        .style("cursor","pointer")
        .on("click", (ev, d) => updateContext(d.year, data));
    }

    // Tooltip
    const tip = g.append("g").style("pointer-events","none").style("display","none");
    const tipBg = tip.append("rect").attr("fill","rgba(0,0,0,.8)").attr("stroke","rgba(255,255,255,.2)").attr("rx",6);
    const tipTx = tip.append("text").attr("fill","#fff").attr("font-size",12).attr("x",8).attr("y",16);

    svg.on("mousemove", function (event) {
      const [mx, my] = d3.pointer(event, g.node());
      let label = null;
      if (mode === "yearly") {
        const yr = x.domain().find(yv => mx >= x(yv) && mx <= x(yv) + x.bandwidth());
        if (yr != null) {
          const d = yearly.find(v => v.year === yr);
          label = `${yr}: ${d.value}`;
        }
      } else {
        const nearest = cum.reduce((acc, d) => {
          const dx = Math.abs(mx - (x(d.year) + x.bandwidth() / 2));
          return dx < acc.dx ? { d, dx } : acc;
        }, { d: null, dx: Infinity }).d;
        if (nearest) label = `${nearest.year}: ${nearest.value}`;
      }
      if (!label) { tip.style("display","none"); return; }
      tip.style("display","block");
      tipTx.text(label);
      const bb = tipTx.node().getBBox();
      tipBg.attr("x", bb.x-6).attr("y", bb.y-6).attr("width", bb.width+12).attr("height", bb.height+12);
      tip.attr("transform", `translate(${Math.min(mx, innerW - bb.width - 20)}, ${Math.max(0, my - 30)})`);
    }).on("mouseleave", () => tip.style("display","none"));
  }

  // ====== Context panel updater (replaces drawer)
  async function updateContext(year, currentFilteredRows) {
    // Title
    ctxTitle.textContent = `${year} — context`;

    // Reset UI
    ctxSummary.textContent = "Loading Wikipedia summary…";
    ctxImg.classList.add("hidden");
    ctxDriverList.innerHTML = "";

    // Wikipedia summary: "YYYY in spaceflight"
    const title = `${year} in spaceflight`;
    try {
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
      if (!res.ok) throw new Error("Wiki fetch failed");
      const json = await res.json();
      ctxSummary.textContent = json.extract || "No summary available.";
      const img = json.thumbnail?.source || json.originalimage?.source;
      if (img) {
        ctxImg.src = img;
        ctxImg.alt = json.title || title;
        ctxImg.classList.remove("hidden");
      }
    } catch {
      ctxSummary.textContent = "Could not fetch Wikipedia summary right now.";
    }

    // Top 3 drivers under current filters for this year
    const yearRows = currentFilteredRows.filter(r => r.year === year);
    const driverCounts = d3.rollups(
      yearRows,
      v => v.length,
      r => inferDriver(r.name)
    ).sort((a,b) => d3.descending(a[1], b[1]));

    driverCounts.slice(0,3).forEach(([driver, total]) => {
      const li = document.createElement("li");
      li.textContent = `${driver}: ${total}`;
      ctxDriverList.appendChild(li);
    });

    // Optional: scroll into view on small screens
    document.getElementById("contextPanel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // Helper
  function inferDriver(name) {
    const n = name.toUpperCase();
    if (n.includes("STARLINK")) return "Starlink";
    if (n.includes("ONEWEB")) return "OneWeb";
    if (n.includes("IRIDIUM")) return "Iridium";
    if (n.includes("GPS")) return "GPS";
    if (n.includes("GLONASS")) return "GLONASS";
    if (n.includes("GALILEO")) return "Galileo";
    if (n.includes("BEIDOU") || n.includes("BDS")) return "BeiDou";
    if (n.includes("PLANET") || n.includes("FLOCK") || n.includes("DOVE")) return "Planet";
    if (/\bCUBE[-\s]?SAT\b/.test(n) || n.includes("CUBESAT")) return "CubeSat";
    return "Other";
  }

  // Initial draw
  render();

  // Re-render on resize
  window.addEventListener("resize", render);
})();
