# **The Crowded Orbit**

### *Interactive Visual Analytics of Earth’s Satellite & Debris Environment*

<p align="center">
  <img src="assets/satellite.png" width="90" alt="The Crowded Orbit Logo"/>
</p>

<p align="center">
  <strong>An interactive data-driven exploration of satellite activity, orbital debris, altitude congestion, and future LEO scenarios.</strong>
</p>

---

## **Table of Contents**

* [Overview](#overview)
* [Features](#features)
* [Project Structure](#project-structure)
* [Screenshots](#screenshots)
* [Dataset](#dataset)
* [Run Locally](#run-locally)
* [Tech Stack](#tech-stack)
* [Authors](#authors)
* [License](#license)

---

## **Overview**

**The Crowded Orbit** is a multi-page interactive dashboard built to visualize how Low Earth Orbit (LEO) has evolved over time.
It highlights the rapid rise of satellites, orbital debris accumulation, altitude congestion, launch trends, and projected growth scenarios from 1957–2035.

This project combines **D3.js**, **Tailwind CSS**, and a fully custom dark-themed UI to deliver a smooth analytical experience.

---

##  **Features**

### Multi-page D3 Visualizations

* Launch timeline (yearly + cumulative)
* Status composition (active, inactive, debris, rocket bodies)
* Orbit density histogram (0–2000 km)
* Debris vs launches with historic event markers
* Predictive scenario modeling (baseline, accelerated, controlled growth)

### Cohesive UI/UX

* Animated starfield background
* Glassmorphic cards + dark cosmic theme
* Clean typography and accent colors
* Fully responsive layout

### Interactions

* Tooltips
* Click-to-focus panels
* Filters with searchable dropdowns
* KPI cards with highlight colors
* Event annotations

---

##  **Project Structure**

```
The-Crowded-Orbit/
│
├── assets/
│   └── satellite.png          # Favicon/logo
│
├── css/
│   ├── styles.css             # Global theme + all pages
│   └── home.css               # Home page styling
│
├── js/
│   ├── stars-bg.js            # Animated starfield
│   ├── timeline.js            # Timeline visualization
│   ├── status.js              # Status mix donuts/cohorts
│   ├── density.js             # Orbit density histogram
│   ├── debris.js              # Debris vs launches chart
│   └── projections.js         # Predictive modeling
│
├── data/
│   └── clean_leo_satellites.csv   # Cleaned SATCAT dataset
│
├── index.html
├── timeline.html
├── status.html
├── density.html
├── debris.html
└── projections.html
```

---

##  **Dataset**

This project uses a cleaned and preprocessed version of **SATCAT data from CelesTrak**.

Dataset includes:

* normalized launch years
* standardized object types
* flags for debris, rocket bodies, and payloads
* cleaned operator & country fields
* computed midpoint altitudes for density analysis

Dataset file:

```
data/clean_leo_satellites.csv
```

---

## **Run Locally**

Because D3 loads CSV files, use a local server.

### **VS Code Live Server:**

Right-click → *Open with Live Server*

---

##  **Tech Stack**

| Technology           | Purpose                                |
| -------------------- | -------------------------------------- |
| **D3.js**            | Interactive visualizations             |
| **Tailwind CSS**     | Layout + styling                       |
| **HTML / CSS / JS**  | Core architecture                      |
| **CelesTrak SATCAT** | Data source                            |
| **Custom JS**        | Scenario models + filters + animations |

---

##  **Authors**

**Hasini Priya Perepogu**
**Sushmitha Bungatavula**

*CSCE 5320 – Scientific Data Visualization Project*

---

## 📄 **License**

This project is for academic and educational use.

---
