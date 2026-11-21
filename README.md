# Call Insights

A dashboard where a business can review the calls its AI voice agent handled: headline metrics, trends, topic
breakdowns, and a searchable call log with a full transcript and analysis for every call.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

## Pages

- **Overview**: calls handled, containment rate, escalation rate, average handle time and share of callers ending
  positive, each compared with the previous period. Below that: call volume, outcome mix, containment trend,
  caller sentiment at the start vs the end of calls, a topic table, and a weekday-by-hour heatmap. Clicking an
  outcome or a topic opens the matching calls.
- **Calls**: filter by date range, topic, outcome, sentiment or flagged calls. You can also search, sort, page
  through results and export to CSV.
- **Call detail**: the transcript with timestamps and per-turn caller sentiment, a sentiment-over-time chart
  (click a point to jump to that turn), the outcome, topic and flags. Use ← and → to step through the filtered list.

Filters are kept in the URL, so any view can be bookmarked or shared.

## Data

Source: [talkmap/telecom-conversation-corpus](https://huggingface.co/datasets/talkmap/telecom-conversation-corpus)
(MIT). These are synthetic customer-service calls for a fictional carrier, "Union Mobile", with per-turn
timestamps. This project uses the first ~9,000 conversations (Sep to Dec 2023).

The corpus has no labels, so `scripts/build_data.py` derives them from each transcript:

| Field | How it is derived |
|---|---|
| Duration, turns, AI talk share | Turn timestamps and word counts |
| Topic | Keyword scoring on the caller's first two turns |
| Sentiment (start / end / per turn) | [VADER](https://github.com/cjhutto/vaderSentiment) compound score on caller turns |
| Outcome | Phrase rules: escalation and hand-off, follow-up or ticket, unhappy ending, cancellation done or retained |
| Flags | Repeat contact, asked for a human, sentiment dropped, needs review |

These labels are heuristics. They are good enough for a demo but not ground truth. For production you would get
these fields from your voice-agent platform or classify calls with an LLM.

To rebuild the data:

```bash
python3 -m venv scripts/.venv && scripts/.venv/bin/pip install vaderSentiment
mkdir -p data/raw
# first ~30 MB of the corpus (~9k calls); drop the -r flag for all 200k
curl -L -r 0-30000000 -o data/raw/telecom_part.csv \
  https://huggingface.co/datasets/talkmap/telecom-conversation-corpus/resolve/main/telecom_200k.csv
scripts/.venv/bin/python scripts/build_data.py data/raw/telecom_part.csv public/data
```

The output goes to `public/data/calls.json`, which holds one summary row per call. Transcripts are written to
`public/data/transcripts/<first two id chars>.json`, sharded so the detail page loads only about 90 KB.

## Using your own calls

Write the same two JSON shapes (see `src/lib/types.ts`) from your call platform's export or API, and the UI works
unchanged. To serve live data, replace the two `fetch` calls in `src/lib/data.ts` with your API endpoints.
