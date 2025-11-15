// predictive.js (CUMULATIVE VERSION)
document.addEventListener("DOMContentLoaded", async () => {
  const DATA_URL = "data/clean_leo_satellites.csv";

  const chartDiv = d3.select("#predictive-chart");
  const scenarioSelect = document.getElementById("scenario-select");

  const panelTitle = document.getElementById("pred-title");
  const panelSummary = document.getElementById("pred-summary");
  const panelKPIs = document.getElementById("pred-kpis");

  // Colors
  const satColor = "#7aa7ff";
  const debrisColor = "#fb923c";

  // SVG Setup
  const width = (chartDiv.node()?.clientWidth || 760) - 60;
  const height = 360;
  const margin = { top: 35, right: 70, bottom: 50, left: 60 };

  const svg = chartDiv.append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const x = d3.scaleLinear().range([0, innerWidth]);
  const y = d3.scaleLinear().range([innerHeight, 0]);

  const xAxisG = g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .attr("class", "debris-chart-axis");

  const yAxisG = g.append("g")
    .attr("class", "debris-chart-axis");

  const satLine = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.cumulativeSat))
    .curve(d3.curveMonotoneX);

  const debrisLine = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.cumulativeDebris))
    .curve(d3.curveMonotoneX);

  const satPath = g.append("path")
    .attr("fill", "none")
    .attr("stroke", satColor)
    .attr("stroke-width", 2);

  const debrisPath = g.append("path")
    .attr("fill", "none")
    .attr("stroke", debrisColor)
    .attr("stroke-width", 2);

  // Tooltip
  const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

  const hoverLine = g.append("line")
    .attr("stroke", "rgba(255,255,255,0.35)")
    .attr("y1", 0)
    .attr("y2", innerHeight)
    .style("opacity", 0);

  const hoverCircleSat = g.append("circle")
    .attr("r", 3)
    .attr("fill", satColor)
    .style("opacity", 0);

  const hoverCircleDebris = g.append("circle")
    .attr("r", 3)
    .attr("fill", debrisColor)
    .style("opacity", 0);

  const hoverRect = g.append("rect")
    .attr("pointer-events", "all")
    .attr("fill", "transparent")
    .attr("width", innerWidth)
    .attr("height", innerHeight);

  // Load dataset
  const raw = await d3.csv(DATA_URL);

  // Aggregate historical counts
  const yearly = d3.rollups(
    raw,
    v => ({
      satellites: v.length,
      debris: v.filter(
        d =>
          (d.object_type || "").includes("DEB") ||
          (d.status || "").includes("DEBRIS")
      ).length
    }),
    d => +d.launch_year
  )
    .map(([year, vals]) => ({ year, ...vals }))
    .filter(d => d.year >= 1980 && d.year <= 2023)
    .sort((a, b) => a.year - b.year);

  // Convert to cumulative
  let runningSat = 0, runningDeb = 0;
  yearly.forEach(y => {
    runningSat += y.satellites;
    runningDeb += y.debris;
    y.cumulativeSat = runningSat;
    y.cumulativeDebris = runningDeb;
  });

  const baseLast = yearly[yearly.length - 1];

  // Scenario projection logic
  function projectScenario(type) {
    const known = yearly.map(d => ({ ...d }));
    let cumSat = baseLast.cumulativeSat;
    let cumDeb = baseLast.cumulativeDebris;

    let satGrowth, debGrowth;
    if (type === "baseline") {
      satGrowth = 1.10;
      debGrowth = 1.08;
    } else if (type === "accelerated") {
      satGrowth = 1.18;
      debGrowth = 1.15;
    } else {
      satGrowth = 1.05;
      debGrowth = 1.04;
    }

    const future = [];
    for (let year = 2024; year <= 2035; year++) {
      cumSat = Math.round(cumSat * satGrowth);
      cumDeb = Math.round(cumDeb * debGrowth);
      future.push({ year, cumulativeSat: cumSat, cumulativeDebris: cumDeb });
    }

    return [...known, ...future];
  }

  function updateChart() {
    const scenario = scenarioSelect.value;
    const data = projectScenario(scenario);

    x.domain(d3.extent(data, d => d.year));
    y.domain([
      0,
      d3.max(data, d => Math.max(d.cumulativeSat, d.cumulativeDebris)) * 1.1
    ]);

    xAxisG.call(d3.axisBottom(x).ticks(8).tickFormat(d3.format("d")));
    yAxisG.call(d3.axisLeft(y).ticks(6));

    satPath.datum(data).attr("d", satLine);
    debrisPath.datum(data).attr("d", debrisLine);

    setupHover(data);
    resetPanel();
  }

  function setupHover(data) {
    hoverRect
      .on("mousemove", ev => {
        const [mx] = d3.pointer(ev);
        const year = Math.round(x.invert(mx));
        const d = data.find(p => p.year === year);
        if (!d) return;

        const xPos = x(d.year);

        hoverLine.attr("x1", xPos).attr("x2", xPos).style("opacity", 1);

        hoverCircleSat
          .attr("cx", xPos)
          .attr("cy", y(d.cumulativeSat))
          .style("opacity", 1);

        hoverCircleDebris
          .attr("cx", xPos)
          .attr("cy", y(d.cumulativeDebris))
          .style("opacity", 1);

        tooltip
          .style("opacity", 1)
          .html(`
            <strong>${d.year}</strong><br>
            <span style="color:${satColor}">Satellites:</span> ${d.cumulativeSat.toLocaleString()}<br>
            <span style="color:${debrisColor}">Debris:</span> ${d.cumulativeDebris.toLocaleString()}
          `)
          .style("left", ev.pageX + 10 + "px")
          .style("top", ev.pageY - 34 + "px");
      })
      .on("mouseleave", () => {
        hoverLine.style("opacity", 0);
        tooltip.style("opacity", 0);
        hoverCircleSat.style("opacity", 0);
        hoverCircleDebris.style("opacity", 0);
      })
      .on("click", ev => {
        const [mx] = d3.pointer(ev);
        const year = Math.round(x.invert(mx));
        updatePanel(year, projectScenario(scenarioSelect.value));
      });
  }

  function resetPanel() {
    panelTitle.textContent = "Click any year to explore predicted congestion";
    panelSummary.textContent =
      "This panel highlights cumulative satellite & debris growth under each scenario.";
    panelKPIs.innerHTML = "";
  }

  function updatePanel(year, data) {
    const d = data.find(p => p.year === year);
    if (!d) return resetPanel();

    panelTitle.textContent = `Projection for ${year}`;
    panelSummary.textContent =
      "Cumulative object counts and predicted congestion level.";

    panelKPIs.innerHTML = `
      <div class="event-kpi-card launches">
        <div class="event-kpi-label">Total Satellites</div>
        <div class="event-kpi-value">${d.cumulativeSat.toLocaleString()}</div>
        <div class="event-kpi-note">All LEO satellites accumulated</div>
      </div>

      <div class="event-kpi-card debris-year">
        <div class="event-kpi-label">Total Debris</div>
        <div class="event-kpi-value">${d.cumulativeDebris.toLocaleString()}</div>
        <div class="event-kpi-note">Tracked LEO debris objects</div>
      </div>

      <div class="event-kpi-card debris-total">
        <div class="event-kpi-label">Congestion Index</div>
        <div class="event-kpi-value">${
          Math.round((d.cumulativeDebris / d.cumulativeSat) * 100)
        }</div>
        <div class="event-kpi-note">Higher = more severe</div>
      </div>
    `;
  }

  scenarioSelect.addEventListener("change", updateChart);

  updateChart();
});
