# Jyoshitha Yannam — Portfolio

Personal portfolio site for Jyoshitha Yannam, Systems & Data Analyst.

A static site (HTML, CSS, vanilla JS) with no build step needed to view it. Open `index.html` or serve the folder from GitHub Pages.

## Highlights
- **Fitbit Activity Explorer**: an interactive dashboard built from the [Scalable Fitness Data Exploration](https://github.com/jyoshithay/scalable-fitness-data-exploration) project (Azure Data Factory → Databricks/PySpark → Power BI), drawn as plain SVG with no chart libraries.
- **Validation workflow**: a data-quality audit of the same 940 Fitbit records.
- Light/dark theme, responsive layout, accessible markup.

## Structure
```
index.html
assets/css/styles.css
assets/js/app.js                 theme + navigation
assets/js/fitness-dashboard.js   dashboard rendering
assets/js/fitness-data.js        cleaned Fitbit daily activity data
assets/img/headshot.jpg
```

## Optional minified build
`npm install && npm run build` writes `styles.min.css` and `app.min.js`.
