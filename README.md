# Στατιστικά Super League

Στατικό site στατιστικών για την ελληνική Super League: βαθμολογία, πρόγραμμα, αποτελέσματα, σελίδες ομάδων και αγώνων με πιθανότητες.

- `scripts/fetch.mjs` κατεβάζει τα CSV από το football-data.co.uk
- `build.mjs` φτιάχνει τις σελίδες στο `dist/` (μοντέλο στο `src/model.mjs`)
- Το GitHub Actions (`.github/workflows/site.yml`) τρέχει Δευτέρα και Πέμπτη και δημοσιεύει στο GitHub Pages

Για δικό μας domain: ορίστε στο repo τις μεταβλητές `SITE_URL` (π.χ. https://example.gr), `SITE_BASE` (`/`) και `CNAME` (example.gr).
