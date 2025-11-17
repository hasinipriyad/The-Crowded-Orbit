// debris.js
document.addEventListener("DOMContentLoaded", function () {
  const DATA_URL = "data/clean_leo_satellites.csv";

  const debrisColor = "#f97373";
  const launchColor = "#7aa7ff";
  const eventDotColor = "#fde047";

  const countrySelect = document.getElementById("debris-country-filter");
  const eventTitle = document.getElementById("event-title");
  const eventSummary = document.getElementById("event-summary");
  const eventMetrics = document.getElementById("event-metrics");

  const chartContainer = d3.select("#debris-chart");

  // Responsive width
  const containerWidth = chartContainer.node()?.clientWidth || 760;
  const width = Math.max(600, containerWidth - 60);
  const height = 380;
  const margin = { top: 40, right: 70, bottom: 50, left: 65 };

  const svg = chartContainer
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("display", "block");

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().range([0, innerWidth]);
  const yDebris = d3.scaleLinear().range([innerHeight, 0]);
  const yLaunch = d3.scaleLinear().range([innerHeight, 0]);

  const xAxisG = g
    .append("g")
    .attr("class", "debris-chart-axis axis--x")
    .attr("transform", `translate(0,${innerHeight})`);

  const yLeftG = g.append("g").attr("class", "debris-chart-axis axis--y-left");
  const yRightG = g
    .append("g")
    .attr("class", "debris-chart-axis axis--y-right")
    .attr("transform", `translate(${innerWidth},0)`);

  const debrisLine = d3
    .line()
    .x((d) => x(d.year))
    .y((d) => yDebris(d.cumDebris))
    .curve(d3.curveMonotoneX);

  const launchLine = d3
    .line()
    .x((d) => x(d.year))
    .y((d) => yLaunch(d.launchCount))
    .curve(d3.curveMonotoneX);

  const debrisPath = g
    .append("path")
    .attr("fill", "none")
    .attr("stroke", debrisColor)
    .attr("stroke-width", 2);

  const launchPath = g
    .append("path")
    .attr("fill", "none")
    .attr("stroke", launchColor)
    .attr("stroke-width", 2);

  // Tooltip
  const tooltip = d3
    .select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

  const hoverLine = g
    .append("line")
    .attr("stroke", "rgba(255,255,255,0.5)")
    .attr("stroke-width", 1)
    .attr("y1", 0)
    .attr("y2", innerHeight)
    .style("opacity", 0);

  const hoverCircleDebris = g
    .append("circle")
    .attr("r", 3)
    .attr("fill", debrisColor)
    .style("opacity", 0);

  const hoverCircleLaunch = g
    .append("circle")
    .attr("r", 3)
    .attr("fill", launchColor)
    .style("opacity", 0);

  const hoverRect = g
    .append("rect")
    .attr("fill", "transparent")
    .attr("pointer-events", "all")
    .attr("width", innerWidth)
    .attr("height", innerHeight);

  // Key events
  const keyEvents = [
    {
      year: 2007,
      label: "China ASAT",
      description:
        "Chinese anti-satellite test destroyed Fengyun-1C, creating long-lived debris."
    },
    {
      year: 2009,
      label: "Iridium–Cosmos",
      description:
        "Collision between Iridium 33 and Kosmos 2251 produced a large debris cloud."
    },
    {
      year: 2021,
      label: "Russia ASAT",
      description:
        "Russian ASAT test against Cosmos 1408 generated thousands of fragments."
    }
  ];

  const eventsByYear = new Map(keyEvents.map((e) => [e.year, e]));

  let yearlyData = [];
  let currentSeries = [];
  let years = [];

  // Load CSV
  d3.csv(DATA_URL).then((rows) => {
    const parsed = rows
      .map((d) => {
        const year = +d.launch_year;
        if (!year || year < 1957) return null;

        const objectType = (d.object_type || "").toUpperCase();
        const status = (d.status || "").toUpperCase();
        const owner = d.owner_clean || "Unknown";

        const isDebris =
          objectType.includes("DEB") ||
          objectType.includes("FRAG") ||
          status.includes("DEBRIS");

        const isRocketBody =
          objectType.includes("R/B") || objectType.includes("R/BODY");

        const isPayload = !isDebris && !isRocketBody;

        return { year, owner, isDebris, isPayload };
      })
      .filter(Boolean);

    const byYear = d3.rollup(
      parsed,
      (arr) => {
        const debrisCount = arr.filter((d) => d.isDebris).length;
        const launchCountAll = arr.filter((d) => d.isPayload).length;
        const launchesByOwner = d3.rollup(
          arr.filter((d) => d.isPayload),
          (a) => a.length,
          (d) => d.owner
        );
        return { debrisCount, launchCountAll, launchesByOwner };
      },
      (d) => d.year
    );

    years = Array.from(byYear.keys()).sort((a, b) => a - b);

    let runningDebris = 0;

    yearlyData = years.map((y) => {
      const v = byYear.get(y);
      runningDebris += v.debrisCount;
      return {
        year: y,
        debrisCount: v.debrisCount,
        cumDebris: runningDebris,
        launchCountAll: v.launchCountAll,
        launchesByOwner: v.launchesByOwner
      };
    });

    setupCountryFilter(parsed);
    updateChart();
  });

  function setupCountryFilter(rows) {
    const ownerSet = new Set(rows.map((d) => d.owner));
    countrySelect.innerHTML = '<option value="All">All Countries</option>';

    [...ownerSet].sort().forEach((o) => {
      const opt = document.createElement("option");
      opt.value = o;
      opt.textContent = o;
      countrySelect.appendChild(opt);
    });

    countrySelect.addEventListener("change", updateChart);
  }

  function updateChart() {
    const selected = countrySelect.value || "All";

    currentSeries = yearlyData.map((d) => {
      let lc = d.launchCountAll;
      if (selected !== "All") lc = d.launchesByOwner.get(selected) || 0;

      return {
        year: d.year,
        debrisCount: d.debrisCount,
        cumDebris: d.cumDebris,
        launchCount: lc
      };
    });

    const minYear = d3.min(currentSeries, (d) => d.year);
    const maxYear = d3.max(currentSeries, (d) => d.year);

    x.domain([minYear, maxYear]);
    yDebris.domain([0, d3.max(currentSeries, (d) => d.cumDebris) * 1.05]);
    yLaunch.domain([0, d3.max(currentSeries, (d) => d.launchCount) * 1.1]);

    xAxisG.call(d3.axisBottom(x).ticks(8).tickFormat(d3.format("d")));
    yLeftG.call(d3.axisLeft(yDebris).ticks(5));
    yRightG.call(d3.axisRight(yLaunch).ticks(5));

    debrisPath.datum(currentSeries).attr("d", debrisLine);
    launchPath.datum(currentSeries).attr("d", launchLine);

    drawEventDots();
    setupHover();
    resetEventPanel();
  }

  // Draw event dots (NO LABELS ON CHART)
  function drawEventDots() {
    g.selectAll(".event-dot").remove();

    const pts = currentSeries.filter((d) => eventsByYear.has(d.year));

    g
      .selectAll(".event-dot")
      .data(pts)
      .enter()
      .append("circle")
      .attr("class", "event-dot")
      .attr("r", 4)
      .attr("fill", eventDotColor)
      .attr("stroke", "#000")
      .attr("stroke-width", 0.8)
      .attr("cx", (d) => x(d.year))
      .attr("cy", (d) => yDebris(d.cumDebris))
      .style("cursor", "pointer")
      .on("mousemove", (event, d) => {
        const e = eventsByYear.get(d.year);
        tooltip
          .style("opacity", 1)
          .html(`
            <div><strong>${d.year} – ${e.label}</strong></div>
            <div>Cumulative debris: ${d.cumDebris.toLocaleString()}</div>
            <div>Debris added: ${d.debrisCount.toLocaleString()}</div>
            <div>Launches: ${d.launchCount.toLocaleString()}</div>
          `)
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY - 30 + "px");
      })
      .on("mouseleave", () => tooltip.style("opacity", 0))
      .on("click", (_, d) => updateEventPanel(d.year));
  }

  // Hover vertical line + circles
  function setupHover() {
    hoverRect
      .on("mousemove", (event) => {
        const [mx] = d3.pointer(event, hoverRect.node());
        const yearRaw = x.invert(mx);
        const year = Math.round(yearRaw);

        const d = currentSeries.find((p) => p.year === year);
        if (!d) return;

        const xPos = x(d.year);

        hoverLine.attr("x1", xPos).attr("x2", xPos).style("opacity", 1);
        hoverCircleDebris
          .attr("cx", xPos)
          .attr("cy", yDebris(d.cumDebris))
          .style("opacity", 1);

        hoverCircleLaunch
          .attr("cx", xPos)
          .attr("cy", yLaunch(d.launchCount))
          .style("opacity", 1);

        tooltip
          .style("opacity", 1)
          .html(`
            <div><strong>${d.year}</strong></div>
            <div style="color:${debrisColor}">
              Cumulative debris: ${d.cumDebris.toLocaleString()}
            </div>
            <div>Debris added: ${d.debrisCount.toLocaleString()}</div>
            <div style="color:${launchColor}">
              Launches: ${d.launchCount.toLocaleString()}
            </div>
          `)
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY - 34 + "px");
      })
      .on("mouseleave", () => {
        hoverLine.style("opacity", 0);
        hoverCircleDebris.style("opacity", 0);
        hoverCircleLaunch.style("opacity", 0);
        tooltip.style("opacity", 0);
      })
      .on("click", (event) => {
        const [mx] = d3.pointer(event, hoverRect.node());
        const year = Math.round(x.invert(mx));
        updateEventPanel(year);
      });
  }

  //
  // Event Panel — KPIs (Color-coded)
  //
  function resetEventPanel() {
    eventTitle.textContent = "Click a year or event dot to see significant events";
    eventSummary.textContent =
      "This panel highlights debris growth, launch surges, and major collision / ASAT events.";
    eventMetrics.innerHTML = "";
  }

  function updateEventPanel(year) {
    const d = currentSeries.find((p) => p.year === year);
    if (!d) return resetEventPanel();

    const evt = eventsByYear.get(year);

    eventTitle.textContent = `Significant activity in ${year}`;
    eventSummary.textContent =
      evt?.description ||
      "No major named event, but these metrics show activity.";

    eventMetrics.innerHTML = `
      <div class="event-kpi-grid">

        <!-- Cumulative debris -->
        <div class="event-kpi-card kpi-red-border">
          <div class="event-kpi-label kpi-red">CUMULATIVE DEBRIS</div>
          <div class="event-kpi-value kpi-red">${d.cumDebris.toLocaleString()}</div>
          <div class="event-kpi-note">Objects tracked up to ${year}</div>
        </div>

        <!-- Debris added -->
        <div class="event-kpi-card kpi-orange-border">
          <div class="event-kpi-label kpi-orange">DEBRIS ADDED</div>
          <div class="event-kpi-value kpi-orange">${d.debrisCount.toLocaleString()}</div>
          <div class="event-kpi-note">New fragments in ${year}</div>
        </div>

        <!-- Launches -->
        <div class="event-kpi-card kpi-blue-border">
          <div class="event-kpi-label kpi-blue">
            LAUNCHES${
              countrySelect.value !== "All" ? " (" + countrySelect.value + ")" : ""
            }
          </div>
          <div class="event-kpi-value kpi-blue">${d.launchCount.toLocaleString()}</div>
          <div class="event-kpi-note">Payload launches</div>
        </div>

      </div>

      ${
        evt
          ? `<p class="event-kpi-note mt-3">Known event: <strong>${evt.label}</strong></p>`
          : ""
      }
    `;
  }
});
