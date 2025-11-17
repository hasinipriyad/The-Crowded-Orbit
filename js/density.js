// density.js
// Orbit Density — simple histogram: satellite distribution by altitude (LEO)
// Filters: Country/Agency, Status, Object Type

document.addEventListener("DOMContentLoaded", function () {
  const DATA_URL = "data/clean_leo_satellites.csv";
  const LEO_MAX = 2000;

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

  const countrySelect = document.getElementById("country-filter");
  const statusSelect = document.getElementById("status-filter");
  const purposeSelect = document.getElementById("purpose-filter");

  const histContainer = d3.select("#density-histogram");

  const bandSummary = document.getElementById("band-summary");
  const bandMetrics = document.getElementById("band-metrics");

  // ============================
  // ⭐ Responsive width function
  // ============================
  function getChartWidth() {
    return histContainer.node().clientWidth;
  }

  let width = getChartWidth();
  const histHeight = 360;
  const histMargin = { top: 20, right: 45, bottom: 60, left: 75 };

  let histSvg = histContainer
    .append("svg")
    .attr("width", width)
    .attr("height", histHeight)
    .attr("preserveAspectRatio", "xMinYMin meet");

  let histInnerWidth = width - histMargin.left - histMargin.right;
  let histInnerHeight = histHeight - histMargin.top - histMargin.bottom;

  let histG = histSvg
    .append("g")
    .attr("transform", `translate(${histMargin.left},${histMargin.top})`);

  let xHist = d3.scaleLinear().range([0, histInnerWidth]);
  let yHist = d3.scaleLinear().range([histInnerHeight, 0]);

  let xHistAxis = histG
    .append("g")
    .attr("class", "axis axis--x")
    .attr("transform", `translate(0,${histInnerHeight})`);

  let yHistAxis = histG.append("g").attr("class", "axis axis--y");

  // Axis labels
  histSvg
    .append("text")
    .attr("x", histMargin.left + histInnerWidth / 2)
    .attr("y", histHeight - 12)
    .attr("text-anchor", "middle")
    .attr("font-size", 12)
    .attr("fill", "#9aa0a6")
    .text("Altitude (km)");

  histSvg
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -histHeight / 2)
    .attr("y", 16)
    .attr("text-anchor", "middle")
    .attr("font-size", 12)
    .attr("fill", "#9aa0a6")
    .text("Number of objects");


  // =====================================================
  // ⭐ MAIN UPDATE — REBUILD SVG ON WINDOW RESIZE
  // =====================================================
  window.addEventListener("resize", () => {
    refreshChartDimensions();
    updateHistogram();
  });

  function refreshChartDimensions() {
    width = getChartWidth();

    histSvg.attr("width", width);

    histInnerWidth = width - histMargin.left - histMargin.right;
    xHist.range([0, histInnerWidth]);

    xHistAxis.attr("transform", `translate(0,${histInnerHeight})`);

    histSvg.select("text")
      .attr("x", histMargin.left + histInnerWidth / 2);
  }

  // Load CSV
  d3.csv(DATA_URL).then(
    rows => {
      rawData = rows.map(d => {
        const perigee = +d.perigee_km || 0;
        const apogee = +d.apogee_km || perigee;
        const altitude = (perigee + apogee) / 2;

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

      rawData = rawData.filter(d => d.altitude >= 0 && d.altitude <= LEO_MAX);

      setupFilters();
      applyFiltersAndUpdate();
    }
  );

  function cleanStatus(s) {
    if (!s) return "Inactive";
    const t = String(s).toLowerCase();
    if (t.includes("active")) return "Active";
    if (t.includes("debris") || t.includes("rocket")) return "Debris";
    if (t.includes("dead") || t.includes("inactive") || t.includes("decay"))
      return "Inactive";
    return "Inactive";
  }

  function setupFilters() {
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

    statusSelect.innerHTML = `
      <option value="All">All Statuses</option>
      <option value="Active">Active</option>
      <option value="Inactive">Inactive</option>
      <option value="Debris">Debris</option>
    `;

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

    xHist.domain([0, LEO_MAX]);

    const binGen = d3
      .bin()
      .domain(xHist.domain())
      .value(d => d.altitude)
      .thresholds(25);

    bins = binGen(filteredData);

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
        updateInfoBox(d);
      });

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

  // INFO BOX
  function resetInfoBox() {
    bandSummary.textContent =
      "Click an altitude band in the histogram to see its congestion profile.";
    bandMetrics.innerHTML = "";
  }

  function updateInfoBox(d) {
    const totalInBand = d.total;
    const active = d.Active;
    const inactive = d.Inactive;
    const debris = d.Debris;

    const totalLEO = filteredData.length;
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
