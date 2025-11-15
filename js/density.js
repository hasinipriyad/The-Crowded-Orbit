// density.js
// Orbit Density — simple histogram: satellite distribution by altitude (LEO)
// Filters: Country/Agency, Status, Object Type

document.addEventListener("DOMContentLoaded", function () {
  const DATA_URL = "data/clean_leo_satellites.csv";
  const LEO_MAX = 2000; // show only 0–2000 km on the x-axis

  // Match Status Mix colors:
  // Active: blue, Inactive: light blue, Debris: orange
  const statusColors = d3
    .scaleOrdinal()
    .domain(["Active", "Inactive", "Debris"])
    .range(["#7aa7ff", "#b3f0ff", "#f9a23f"]);

  const tooltip = d3
    .select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

  let rawData = [];
  let filteredData = [];
  let bins = [];
  let selectedBinIndex = null;

  // DOM elements (3 filters + chart container + info box)
  const countrySelect = document.getElementById("country-filter");
  const statusSelect = document.getElementById("status-filter");
  const purposeSelect = document.getElementById("purpose-filter");

  const histContainer = d3.select("#density-histogram");

  const bandSummary = document.getElementById("band-summary");
  const bandMetrics = document.getElementById("band-metrics");

  // SVG + layout
  const width = 700;
  const histHeight = 320;
  const histMargin = { top: 20, right: 20, bottom: 40, left: 55 };

  const histSvg = histContainer
    .append("svg")
    .attr("width", width)
    .attr("height", histHeight);

  const histInnerWidth = width - histMargin.left - histMargin.right;
  const histInnerHeight = histHeight - histMargin.top - histMargin.bottom;

  const histG = histSvg
    .append("g")
    .attr("transform", `translate(${histMargin.left},${histMargin.top})`);

  const xHist = d3.scaleLinear().range([0, histInnerWidth]);
  const yHist = d3.scaleLinear().range([histInnerHeight, 0]);

  const xHistAxis = histG
    .append("g")
    .attr("class", "axis axis--x")
    .attr("transform", `translate(0,${histInnerHeight})`);

  const yHistAxis = histG
    .append("g")
    .attr("class", "axis axis--y");

  // Axis labels
  histSvg
    .append("text")
    .attr("x", histMargin.left + histInnerWidth / 2)
    .attr("y", histHeight - 6)
    .attr("text-anchor", "middle")
    .attr("font-size", 11)
    .attr("fill", "#9aa0a6")
    .text("Altitude (km)");

  histSvg
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -histHeight / 2)
    .attr("y", 16)
    .attr("text-anchor", "middle")
    .attr("font-size", 11)
    .attr("fill", "#9aa0a6")
    .text("Number of objects");

  // Load CSV
  d3.csv(DATA_URL).then(
    rows => {
      rawData = rows.map(d => {
        const perigee = +d.perigee_km || 0;
        const apogee = +d.apogee_km || perigee;
        const altitude = (perigee + apogee) / 2; // simple mean shell altitude

        return {
          altitude,
          inclination: +d.inclination_deg || 0,
          status: cleanStatus(d.status),
          country: d.owner_clean || "Unknown",
          purpose: d.object_type || "Other",
          name: d.name || "",
          norad_id: d.norad_id || ""
        };
      });

      // Restrict to LEO
      rawData = rawData.filter(d => d.altitude >= 0 && d.altitude <= LEO_MAX);

      setupFilters();
      applyFiltersAndUpdate();
    },
    err => {
      console.error("Error loading CSV:", err);
    }
  );

  function cleanStatus(s) {
    if (!s) return "Inactive";
    const t = String(s).toLowerCase();
    if (t.includes("active")) return "Active";
    if (t.includes("debris")) return "Debris";
    if (t.includes("rocket")) return "Debris"; // treat rocket bodies as debris
    if (t.includes("dead") || t.includes("inactive") || t.includes("decay")) {
      return "Inactive";
    }
    return "Inactive";
  }

  function setupFilters() {
    // Country/Agency
    const countrySet = new Set(rawData.map(d => d.country));
    countrySelect.innerHTML = '<option value="All">All Countries</option>';
    Array.from(countrySet)
      .sort()
      .forEach(c => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        countrySelect.appendChild(opt);
      });

    // Status
    statusSelect.innerHTML = `
      <option value="All">All Statuses</option>
      <option value="Active">Active</option>
      <option value="Inactive">Inactive</option>
      <option value="Debris">Debris</option>
    `;

    // Purpose (object_type)
    const purposeSet = new Set(rawData.map(d => d.purpose));
    purposeSelect.innerHTML = '<option value="All">All Types</option>';
    Array.from(purposeSet)
      .sort()
      .forEach(p => {
        const opt = document.createElement("option");
        opt.value = p;
        opt.textContent = p;
        purposeSelect.appendChild(opt);
      });

    // Listeners
    countrySelect.addEventListener("change", applyFiltersAndUpdate);
    statusSelect.addEventListener("change", applyFiltersAndUpdate);
    purposeSelect.addEventListener("change", applyFiltersAndUpdate);
  }

  function applyFiltersAndUpdate() {
    const countryVal = countrySelect.value;
    const statusVal = statusSelect.value;
    const purposeVal = purposeSelect.value;

    filteredData = rawData.filter(d => {
      if (countryVal !== "All" && d.country !== countryVal) return false;
      if (statusVal !== "All" && d.status !== statusVal) return false;
      if (purposeVal !== "All" && d.purpose !== purposeVal) return false;
      return true;
    });

    selectedBinIndex = null;
    resetInfoBox();
    updateHistogram();
  }

  // =============== HISTOGRAM ===============
  function updateHistogram() {
    histG.selectAll(".bar-group").remove();

    if (!filteredData.length) {
      xHist.domain([0, LEO_MAX]);
      yHist.domain([0, 1]);
      xHistAxis.call(d3.axisBottom(xHist).ticks(6));
      yHistAxis.call(d3.axisLeft(yHist).ticks(4));
      return;
    }

    // Fixed domain for LEO view
    xHist.domain([0, LEO_MAX]);

    const binGen = d3
      .bin()
      .domain(xHist.domain())
      .value(d => d.altitude)
      .thresholds(25); // 25 bins between 0–2000 km

    bins = binGen(filteredData);

    // Build stacked counts per status for each bin
    const stackedBins = bins.map(bin => {
      const counts = { Active: 0, Inactive: 0, Debris: 0, total: bin.length };
      bin.forEach(d => {
        if (d.status === "Active") counts.Active++;
        else if (d.status === "Debris") counts.Debris++;
        else counts.Inactive++;
      });
      counts.x0 = bin.x0;
      counts.x1 = bin.x1;
      return counts;
    });

    const maxCount = d3.max(stackedBins, d => d.total) || 1;
    yHist.domain([0, maxCount]);

    xHistAxis.call(d3.axisBottom(xHist).ticks(6));
    yHistAxis.call(d3.axisLeft(yHist).ticks(5));

    const barWidth =
      bins.length > 0 ? Math.max(2, histInnerWidth / bins.length - 2) : 10;

    const groups = histG
      .selectAll(".bar-group")
      .data(stackedBins)
      .enter()
      .append("g")
      .attr("class", "bar-group")
      .attr(
        "transform",
        d => `translate(${xHist((d.x0 + d.x1) / 2) - barWidth / 2},0)`
      )
      .on("click", (_, d, i) => {
        selectedBinIndex = i;
        highlightSelectedBin();
        updateInfoBox(d); // update info box when a band is clicked
      });

    // stacked rectangles inside each bar
    groups.each(function (d) {
      let yOffset = histInnerHeight;
      const self = d3.select(this);
      const segments = [
        { key: "Active", color: statusColors("Active") },
        { key: "Inactive", color: statusColors("Inactive") },
        { key: "Debris", color: statusColors("Debris") }
      ];

      segments.forEach(seg => {
        const count = d[seg.key];
        if (!count) return;
        const h = histInnerHeight - yHist(count);
        yOffset -= h;

        self
          .append("rect")
          .attr("class", "bar-rect")
          .attr("x", 0)
          .attr("y", yOffset)
          .attr("width", barWidth)
          .attr("height", h)
          .attr("fill", seg.color)
          .on("mousemove", (event) => {
            tooltip
              .style("opacity", 1)
              .html(makeBinTooltip(d))
              .style("left", event.pageX + 10 + "px")
              .style("top", event.pageY - 28 + "px");
          })
          .on("mouseleave", () => {
            tooltip.style("opacity", 0);
          });
      });
    });

    highlightSelectedBin();
  }

  function makeBinTooltip(d) {
    const total = d.total || 0;
    const band = `${Math.round(d.x0)}–${Math.round(d.x1)} km`;
    return `
      <div><strong>Altitude band:</strong> ${band}</div>
      <div><strong>Total objects:</strong> ${total}</div>
      <div>Active: ${d.Active || 0}</div>
      <div>Inactive: ${d.Inactive || 0}</div>
      <div>Debris: ${d.Debris || 0}</div>
    `;
  }

  function highlightSelectedBin() {
    histG.selectAll(".bar-rect").classed("selected", false);

    if (selectedBinIndex == null || !bins.length) return;

    histG
      .selectAll(".bar-group")
      .filter((_, i) => i === selectedBinIndex)
      .selectAll(".bar-rect")
      .classed("selected", true);
  }

  // =============== INFO BOX ===============
  function resetInfoBox() {
    if (!bandSummary || !bandMetrics) return;
    bandSummary.textContent =
      "Click an altitude band in the histogram to see its congestion profile.";
    bandMetrics.innerHTML = "";
  }

  function updateInfoBox(d) {
    if (!bandSummary || !bandMetrics) return;

    const totalInBand = d.total || 0;
    const active = d.Active || 0;
    const inactive = d.Inactive || 0;
    const debris = d.Debris || 0;
    const totalLEO = filteredData.length || 1;
    const share = (totalInBand / totalLEO) * 100;
    const ratio = active > 0 ? (debris / active) : null;

    const bandLabel = `${Math.round(d.x0)}–${Math.round(d.x1)} km`;

    bandSummary.innerHTML = `
      Altitude band <strong>${bandLabel}</strong> currently contains
      <strong>${totalInBand}</strong> objects under your filters
      (~${share.toFixed(1)}% of LEO objects shown).
    `;

    bandMetrics.innerHTML = `
      <ul class="space-y-1">
        <li>Active: <strong>${active}</strong></li>
        <li>Inactive: <strong>${inactive}</strong></li>
        <li>Debris: <strong>${debris}</strong></li>
        ${
          ratio !== null
            ? `<li>Debris / Active ratio: <strong>${ratio.toFixed(2)} : 1</strong></li>`
            : ""
        }
      </ul>
    `;
  }
});
