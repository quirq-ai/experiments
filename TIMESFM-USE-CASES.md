# TimesFM: Google’s time-series foundation model (one pager)

**What it is:** TimesFM is Google Research’s pretrained **decoder-only** model for **zero-shot forecasting**. Give it a history of numbers over time; it predicts the next stretch, often with confidence bands, **without training a model on your data**.

Think of it as “GPT for time series”: it learned general patterns (trend, seasonality, spikes) from a huge corpus (on the order of **100B+ real-world time-points**, including signals like Google Trends and Wikipedia pageviews), then applies that to new series it has never seen.

**Paper:** [A decoder-only foundation model for time-series forecasting](https://arxiv.org/abs/2310.10688) (ICML 2024)  
**Open model:** [github.com/google-research/timesfm](https://github.com/google-research/timesfm) (TimesFM 2.5 is current)  
**Where Google ships it:** BigQuery ML (`AI.FORECAST`), AlloyDB, Connected Sheets, Vertex Model Garden

---

## Why it matters in the real world

Most businesses already have time series (sales, trips, sensors, spend). Classical and deep models usually need **per-series training, tuning, and maintenance**. TimesFM’s pitch is: **decent forecasts out of the box**, so teams spend time on decisions (inventory, staffing, cash) instead of model ops.

Google’s own framing: better demand forecasts in retail can cut inventory cost and lift revenue; TimesFM is meant to get you to usable forecasts fast across domains.

---

## Real-world use cases

### 1. Retail & e-commerce demand
- Forecast units or revenue by SKU, store, channel, or product.
- Plan replenishment and promotions around expected demand.
- **Example path:** GA4 / ecommerce tables in BigQuery → `AI.FORECAST` on daily purchase quantity per product.

### 2. Inventory & supply chain
- Predict what will sell next week so warehouses and suppliers can stock ahead.
- Scale to **many series at once** (millions of univariate series in BigQuery in minutes, per Google Cloud).
- AlloyDB pitch: sales / stock / price already in the DB → forecast next week’s demand **without exporting data**.

### 3. Sales planning & revenue ops
- Next-week / next-month sales from last period’s history.
- Baseline forecasts for planning meetings; refine later with domain rules (holidays, promos) if needed.

### 4. Fintech & payments
- Daily transaction volume by channel (app, QR, SMS, etc.).
- Supports **liquidity planning**, capacity, and fraud ops that depend on “normal” volume.
- (Community / Cloud examples use multi-series `id_cols` so each channel gets its own forecast in one query.)

### 5. Operations & capacity
- Call volume, ticket inflow, bike-share / ride demand, API or DB load.
- Google’s public demo: **SF Bay Area bike-share trips** forecast by hour (and by subscriber type) with `AI.FORECAST`.
- Staffing and fleet sizing from expected peaks.

### 6. Anomaly detection (ops / risk)
- Use forecast bands as a “what’s normal” envelope; points outside the interval are unusual.
- In BigQuery: `AI.DETECT_ANOMALIES` on top of TimesFM.
- Useful for sudden drops in sales, spikes in errors, or odd traffic.

### 7. Energy, IoT & sensors
- Load, consumption, temperature, machine readings.
- Same zero-shot path: long history in, horizon out, optional quantile intervals for planning buffers.

### 8. Healthcare & scientific series (where appropriate)
- Vitals, lab trends, experimental measurements over time (univariate).
- Research / Monash-style benchmarks cover traffic, weather, demand, and related domains; production use still needs domain validation and compliance.

### 9. Marketing & interest signals
- Pretraining used interest-like series (Trends, pageviews); useful for forecasting **attention / traffic / engagement** curves when you only have a single metric over time.

### 10. Spreadsheet & analyst workflows
- Connected Sheets / BigQuery: analysts forecast without standing up ML infra.
- Fast baselines for “what does next month look like?” before a specialist builds a tuned model.

### 11. Agent-driven analytics
- Google wires TimesFM into agent tooling (ADK BigQuery forecast tool, MCP toolbox, Gemini CLI for Data Cloud): ask in natural language, get a forecast from warehouse data.

---

## Where it shows up in Google’s stack

| Surface | What you do |
|---------|-------------|
| **BigQuery ML** | `AI.FORECAST` / evaluate / detect anomalies in SQL; no model to train or host |
| **AlloyDB** | Forecast on operational tables (sales, inventory, load) in place |
| **Sheets** | Forecast from connected warehouse data |
| **Vertex Model Garden** | Dockerized endpoint for apps / agents |
| **Open source** | `pip install timesfm[torch]` and run locally or in your own service |

---

## When to use it vs when not to

**Use TimesFM when you want:**
- Quick baselines or production forecasts with **no training loop**
- Many independent series (SKU × store, channel × day, sensor × site)
- Probabilistic intervals for planning under uncertainty
- Analysts or agents hitting forecasts via SQL / API

**Prefer classical / tuned models (e.g. ARIMA_PLUS, XReg, custom DL) when you need:**
- Explicit holiday / promo / price covariates as first-class drivers (BigQuery’s built-in TimesFM path is largely univariate; open TimesFM 2.5 adds XReg separately)
- Strong **explainability** (coefficients, decompositions)
- Heavy multivariate structure (true VAR-style systems)
- Maximum accuracy on one critical series after careful tuning

---

## Bottom line

TimesFM is Google’s bet that **forecasting should be a foundation capability**, not a custom science project every time. Real-world value clusters around **demand, inventory, volume, load, and anomaly envelopes**: anywhere a business already has a timestamp and a metric and needs “what next?” without waiting for a model training cycle.

**Sources:** [Google Research blog](https://research.google/blog/a-decoder-only-foundation-model-for-time-series-forecasting/), [BigQuery TimesFM docs](https://cloud.google.com/bigquery/docs/timesfm-model), [BigQuery / AlloyDB announcement](https://cloud.google.com/blog/products/data-analytics/timesfm-models-in-bigquery-and-alloydb), [open repo](https://github.com/google-research/timesfm).
