// Status Mix page (Totals + Cohorts in COUNTS only)
// Filters: searchable dropdowns (Country, Agency/Operator), like timeline

(async function () {
  const DATA_URL = "data/clean_leo_satellites.csv";
  const raw = await d3.csv(DATA_URL, d3.autoType);

  // ---------- Helpers ----------
  const uniq = (arr) => Array.from(new Set(arr)).sort((a,b)=> (a>b?1:a<b?-1:0));
  const fmt = d3.format(",");
  const pct = d3.format(".0%");

  function inferOperator(name = "") {
    const n = String(name).toUpperCase();
    if (n.includes("STARLINK")) return "SpaceX / Starlink";
    if (n.includes("ONEWEB")) return "OneWeb";
    if (n.includes("IRIDIUM")) return "Iridium";
    if (n.includes("PLANET") || n.includes("FLOCK") || n.includes("DOVE")) return "Planet";
    if (n.includes("GPS") || n.includes("NAVSTAR")) return "USAF / GPS";
    if (n.includes("GLONASS")) return "Roscosmos / GLONASS";
    if (n.includes("GALILEO")) return "EU / Galileo";
    if (n.includes("BEIDOU") || n.includes("BDS")) return "China / BeiDou";
    if (n.includes("YAOGAN")) return "China / Yaogan";
    if (n.includes("GAOFEN")) return "China / Gaofen";
    if (n.includes("COSMOS") || n.includes("KOSMOS")) return "Russia / Cosmos";
    if (n.includes("SHIJIAN") || n.includes("SJ-")) return "China / Shijian";
    return "Other / Misc";
  }

  // Normalize
  const rows = raw.map(d => ({
    year: +d.launch_year,
    country: d.owner_clean || "Unknown",
    type: d.object_type || "UNK", // DEB, PAY, R/B, UNK
    status: (d.status || "Other").toLowerCase(), // active/inactive/debris/rocket body/other
    name: (d.name || "").toString(),
    operator: inferOperator(d.name)
  })).filter(d => !Number.isNaN(d.year));

  // ---------- Filter state (dropdowns like timeline) ----------
  const countryRoot = document.getElementById("countryFilter");
  const agencyRoot  = document.getElementById("agencyFilter");
  const countrySummaryEl = document.getElementById("countrySummary");
  const agencySummaryEl  = document.getElementById("agencySummary");
  const clearBtn = document.getElementById("clearFilters");

  const allCountries = uniq(rows.map(d => d.country));
  const allOperators = uniq(rows.map(d => d.operator));

  const selCountries = new Set(); // empty => All
  const selOperators = new Set(); // empty => All

  function setupSearchableDropdown(rootEl, allValues, selectedSet, summaryEl, labelKey) {
    const btn = rootEl.querySelector("[data-toggle='panel']");
    const panel = rootEl.querySelector("[data-panel]");
    const search = panel.querySelector("[data-search]");
    const optionsWrap = panel.querySelector("[data-options]");
    const clear = panel.querySelector("[data-clear]");
    const selectAll = panel.querySelector("[data-selectall]");

    function updateSummary() {
      if (!selectedSet.size) summaryEl.textContent = "(All)";
      else if (selectedSet.size <= 3) summaryEl.textContent = `(${Array.from(selectedSet).join(", ")})`;
      else summaryEl.textContent = `(${selectedSet.size} selected)`;
    }

    function renderOptions(q = "") {
      const ql = q.trim().toLowerCase();
      const list = allValues.filter(v => v.toLowerCase().includes(ql));
      optionsWrap.innerHTML = "";
      list.forEach(v => {
        const id = `${labelKey}-${v}`.replace(/\s+/g,"_");
        const row = document.createElement("label");
        row.className = "flex items-center gap-2 text-sm text-gray-200";
        row.innerHTML = `
          <input type="checkbox" class="accent-white/90 bg-black/60 rounded" id="${id}" ${selectedSet.has(v)?"checked":""}/>
          <span>${v}</span>
        `;
        row.querySelector("input").addEventListener("change", e => {
          if (e.target.checked) selectedSet.add(v); else selectedSet.delete(v);
          updateSummary(); renderAll();
        });
        optionsWrap.appendChild(row);
      });
      if (!list.length) {
        const em = document.createElement("div");
        em.className = "text-xs text-gray-400";
        em.textContent = "No matches";
        optionsWrap.appendChild(em);
      }
    }

    btn.addEventListener("click", e => {
      e.stopPropagation();
      const hidden = panel.classList.contains("hidden");
      document.querySelectorAll("[data-panel]").forEach(p => p.classList.add("hidden"));
      if (hidden) {
        panel.classList.remove("hidden");
        search.value = "";
        renderOptions("");
        setTimeout(() => search.focus(), 0);
      } else panel.classList.add("hidden");
    });

    search.addEventListener("input", () => renderOptions(search.value));
    clear.addEventListener("click", () => { selectedSet.clear(); updateSummary(); renderOptions(search.value); renderAll(); });
    selectAll.addEventListener("click", () => { allValues.forEach(v => selectedSet.add(v)); updateSummary(); renderOptions(search.value); renderAll(); });
    document.addEventListener("click", e => { if (!rootEl.contains(e.target)) panel.classList.add("hidden"); });

    // init
    updateSummary(); renderOptions("");
    return { updateSummary, renderOptions };
  }

  const ddCountry = setupSearchableDropdown(countryRoot, allCountries, selCountries, countrySummaryEl, "country");
  const ddAgency  = setupSearchableDropdown(agencyRoot,  allOperators, selOperators, agencySummaryEl, "operator");

  clearBtn.addEventListener("click", () => {
    selCountries.clear(); selOperators.clear();
    ddCountry.updateSummary(); ddAgency.updateSummary();
    renderAll();
  });

  function applyFilters(src = rows) {
    let out = src;
    if (selCountries.size) out = out.filter(r => selCountries.has(r.country));
    if (selOperators.size) out = out.filter(r => selOperators.has(r.operator));
    return out;
  }

  // ---------- Section A: TOTAL Donut (no overlap) ----------
  const donutSel = d3.select("#donutChart");
  const legendEl = document.getElementById("donutLegend");
  const kpiActive = document.getElementById("kpiActive");
  const kpiInactive = document.getElementById("kpiInactive");
  const kpiDebris = document.getElementById("kpiDebris");
  const kpiRB = document.getElementById("kpiRB");
  const ratioDebrisActive = document.getElementById("ratioDebrisActive");
  const ratioInactiveActive = document.getElementById("ratioInactiveActive");

  function computeTotalSlices(data) {
    // Across ALL years in current filters
    const active   = data.filter(d => d.type === "PAY" && d.status === "active").length;
    const inactive = data.filter(d => d.type === "PAY" && d.status === "inactive").length;
    const debris   = data.filter(d => d.type === "DEB" || d.status === "debris").length;
    const rb       = data.filter(d => d.type === "R/B" || d.status.startsWith("rocket")).length;
    const total = active + inactive + debris + rb;
    return { active, inactive, debris, rb, total };
  }

  function renderDonut() {
    donutSel.selectAll("*").remove();
    legendEl.innerHTML = "";

    const data = applyFilters(rows);
    const { active, inactive, debris, rb, total } = computeTotalSlices(data);

    // KPIs + ratios
    kpiActive.textContent = fmt(active);
    kpiInactive.textContent = fmt(inactive);
    kpiDebris.textContent = fmt(debris);
    kpiRB.textContent = fmt(rb);
    ratioDebrisActive.textContent = active ? d3.format(".1f")(debris / active * 100) + "%" : "—";
    ratioInactiveActive.textContent = active ? d3.format(".1f")(inactive / active * 100) + "%" : "—";

    // Donut (no arc labels → no overlap)
    const width = 340, height = 340, r = Math.min(width, height) / 2;
    const innerR = r * 0.62;

    const svg = donutSel.append("svg").attr("width", width).attr("height", height);
    const g = svg.append("g").attr("transform", `translate(${width/2},${height/2})`);

    const entries = [
      { key: "Active", value: active, color: "#7aa7ff" },
      { key: "Inactive", value: inactive, color: "#b3f0ff" },
      { key: "Debris", value: debris, color: "#ffb36b" },
      { key: "Rocket bodies", value: rb, color: "#ffd86b" },
    ].filter(d => d.value > 0);

    if (!total) {
      g.append("text").attr("fill","#9aa0a6").attr("text-anchor","middle").attr("y",4).text("No data");
      return;
    }

    const pie = d3.pie().value(d => d.value).sort(null);
    const arc = d3.arc().innerRadius(innerR).outerRadius(r);

    g.selectAll("path")
      .data(pie(entries))
      .join("path")
      .attr("d", arc)
      .attr("fill", d => d.data.color)
      .attr("stroke", "rgba(255,255,255,.15)").attr("stroke-width", 1);

    // Center big total
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("y", -4)
      .attr("font-size", 22)
      .attr("font-weight", 700)
      .text(fmt(total));
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("y", 16)
      .attr("fill", "#9aa0a6")
      .attr("font-size", 11)
      .text("Total in current filters");

    // Legend list (counts + %)
    entries.forEach(e => {
      const li = document.createElement("li");
      const share = total ? e.value / total : 0;
      li.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="inline-block w-3 h-3 rounded" style="background:${e.color}"></span>
          <span>${e.key}: <span class="font-semibold">${fmt(e.value)}</span> <span class="text-gray-400">(${pct(share)})</span></span>
        </div>`;
      legendEl.appendChild(li);
    });
  }

  // ---------- Section B: Cohorts (Counts only) ----------
  const cohortSel = d3.select("#cohortChart");
  const cohortPanel = document.getElementById("cohortPanel");
  const cohortTitle = document.getElementById("cohortTitle");
  const cohortTopOps = document.getElementById("cohortTopOps");
  let lockedYear = null;

  function buildCohortData() {
    const data = applyFilters(rows).filter(d => d.type === "PAY"); // satellites only
    const years = uniq(data.map(d => d.year)).map(Number).sort((a,b)=>a-b);
    return years.map(y => {
      const yr = data.filter(d => d.year === y);
      const active = yr.filter(d => d.status === "active").length;
      const inactive = yr.filter(d => d.status === "inactive").length;
      const total = active + inactive;
      return { year: y, active, inactive, total, rows: yr };
    });
  }

  function topOperatorsForYear(rows, k=3) {
    return d3.rollups(rows, v => v.length, d => d.operator)
      .sort((a,b) => d3.descending(a[1], b[1]))
      .slice(0,k);
  }

  function renderCohorts() {
    cohortSel.selectAll("*").remove();

    const data = buildCohortData();
    const width = Math.min(980, cohortSel.node().clientWidth || 980);
    const height = 380;
    const margin = { top: 16, right: 16, bottom: 42, left: 64 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = cohortSel.append("svg").attr("width", width).attr("height", height);
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand().domain(data.map(d => d.year)).range([0, innerW]).padding(0.15);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.total) || 1]).nice().range([innerH, 0]);

    const xAxis = d3.axisBottom(x).tickValues(data.map(d=>d.year).filter((_,i)=>!(i%Math.ceil(data.length/12))));
    const yAxis = d3.axisLeft(y).ticks(6).tickFormat(d3.format(","));
    g.append("g").attr("transform", `translate(0,${innerH})`).attr("class","text-gray-300").call(xAxis)
      .call(s => s.selectAll("text").style("font-size","10px"));
    g.append("g").attr("class","text-gray-300").call(yAxis)
      .call(s => s.selectAll("text").style("font-size","10px"));

    const tip = g.append("g").style("display","none").style("pointer-events","none");
    const tipBg = tip.append("rect").attr("fill","rgba(0,0,0,.85)").attr("stroke","rgba(255,255,255,.25)").attr("rx",6);
    const tipTx = tip.append("text").attr("fill","#fff").attr("font-size",12).attr("x",8).attr("y",16);

    function showTip(ev, d) {
      const topOps = topOperatorsForYear(d.rows, 1);
      const topLine = topOps.length ? `Top operator: ${topOps[0][0]} (${fmt(topOps[0][1])})` : "Top operator: —";
      const txt = [`${d.year}`, `Active ${fmt(d.active)} • Inactive ${fmt(d.inactive)}`, topLine].join("\n");
      tip.style("display","block");
      tipTx.selectAll("tspan").remove();
      txt.split("\n").forEach((line, i) => tipTx.append("tspan").attr("x",8).attr("dy", i ? 14 : 0).text(line));
      const bb = tipTx.node().getBBox();
      tipBg.attr("x", bb.x-6).attr("y", bb.y-6).attr("width", bb.width+12).attr("height", bb.height+12);
      const [mx, my] = d3.pointer(ev, g.node());
      tip.attr("transform", `translate(${Math.min(mx, innerW - bb.width - 20)}, ${Math.max(0, my - 40)})`);
    }
    function hideTip(){ tip.style("display","none"); }

    function lockYear(d) {
      lockedYear = (lockedYear === d.year) ? null : d.year;
      // Fill mini panel
      if (lockedYear === null) {
        cohortPanel.classList.add("hidden");
        cohortTopOps.innerHTML = "";
        cohortTitle.textContent = "Year — details";
      } else {
        cohortPanel.classList.remove("hidden");
        cohortTitle.textContent = `${d.year} — Top operators`;
        cohortTopOps.innerHTML = "";
        topOperatorsForYear(d.rows, 3).forEach(([op, count]) => {
          const li = document.createElement("li");
          li.textContent = `${op}: ${fmt(count)}`;
          cohortTopOps.appendChild(li);
        });
        cohortPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      renderCohorts(); // redraw to show outline
    }

    // Draw stacked bars (Inactive bottom, Active top)
    const bar = g.selectAll(".cohort")
      .data(data)
      .join("g")
      .attr("class","cohort")
      .attr("transform", d => `translate(${x(d.year)},0)`);

    bar.append("rect")
      .attr("x",0)
      .attr("y", d => y(d.inactive))
      .attr("width", x.bandwidth())
      .attr("height", d => innerH - y(d.inactive))
      .attr("fill", "#b3f0ff")
      .attr("opacity", 0.9)
      .style("cursor","pointer")
      .on("mousemove", (ev,d) => showTip(ev,d)).on("mouseleave", hideTip).on("click", (ev,d) => lockYear(d));

    bar.append("rect")
      .attr("x",0)
      .attr("y", d => y(d.inactive + d.active))
      .attr("width", x.bandwidth())
      .attr("height", d => innerH - y(d.active))
      .attr("fill", "#7aa7ff")
      .attr("opacity", 0.95)
      .style("cursor","pointer")
      .on("mousemove", (ev,d) => showTip(ev,d)).on("mouseleave", hideTip).on("click", (ev,d) => lockYear(d));

    // Highlight locked year
    if (lockedYear !== null) {
      const dL = data.find(xd => xd.year === lockedYear);
      if (dL) {
        g.append("rect")
          .attr("x", x(dL.year) - 2)
          .attr("y", 0)
          .attr("width", x.bandwidth() + 4)
          .attr("height", innerH)
          .attr("fill", "none")
          .attr("stroke", "#fff")
          .attr("stroke-width", 1.2)
          .attr("pointer-events", "none");
      }
    }
  }

  // ---------- Render all ----------
  function renderAll() {
    renderDonut();
    renderCohorts();
  }

  // Initial
  renderAll();
  window.addEventListener("resize", renderAll);
})();