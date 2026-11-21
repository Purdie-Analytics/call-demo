"""Turn the raw Talkmap telecom transcripts into dashboard-ready JSON.

Source: https://huggingface.co/datasets/talkmap/telecom-conversation-corpus (MIT)
The raw corpus is turn-level (conversation_id, speaker, date_time, text) with no labels,
so every metric below is derived here:

  - duration / turns / talk share      -> from timestamps and word counts
  - topic                              -> keyword scoring on the caller's opening turns
  - sentiment (start, end, per turn)   -> VADER compound score on caller turns
  - outcome                            -> phrase rules on the agent/caller turns
  - flags                              -> phrase rules (repeat contact, asked for human, ...)

Usage:
  scripts/.venv/bin/python scripts/build_data.py data/raw/telecom_part.csv public/data
"""

import csv
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

VADER = SentimentIntensityAnalyzer()

# Topic keyword sets. Scored by match count over the caller's first two turns;
# ties go to the earlier entry, so the more specific topics come first.
TOPICS = [
    ("Cancellation", r"\bcancel"),
    ("International & roaming", r"international|roaming|abroad|travel(l)?ing|overseas"),
    ("SIM, activation & porting", r"\bsim\b|esim|activat|\bport(ing)?\b|transfer my number|new line"),
    ("Billing & payments", r"\bbill|charge|refund|credit|invoice|\bfee|payment|autopay|\bpay\b|overcharg|discount"),
    ("Account & security", r"password|\bpin\b|security|privacy|fraud|hack|compromis|identity|stolen|\blost\b|account access|locked"),
    ("Network & coverage", r"coverage|signal|dropp|reception|\b5g\b|\b4g\b|\blte\b|network|outage|speed|hotspot|connectivity|wi-?fi"),
    ("Plans & upgrades", r"\bplan\b|plans|upgrade|add-on|bundle|unlimited|data usage|promotion|\bdeal|limit"),
    ("Device & apps", r"device|smartphone|phone.s|battery|bluetooth|\bapps?\b|screen|update|sync|camera|storage|backup|accessor|freez|vpn|settings"),
]

ESCALATE = re.compile(
    r"escalat|supervisor|transfer(red)? you|transferring you|specialist|technician|technical (support )?team"
    r"|higher.level|tier 2|bring your device|visit (one of )?our store|schedule an appointment",
    re.I,
)
FOLLOW_UP = re.compile(
    r"ticket|case number|reference number|follow.up|call you back|keep you (updated|posted|informed)"
    r"|within \d+|\d+.?\d* (business )?(hours|days)|working on (it|a fix|the issue|a patch)|investigat",
    re.I,
)
UNRESOLVED = re.compile(
    r"still (not|doesn't|isn't|won't)|didn't (help|work)|not (satisfied|happy)|unacceptable|waste of"
    r"|not resolved|this is ridiculous|disappoint",
    re.I,
)
CANCEL_DONE = re.compile(
    r"(processed|processing|completed|go ahead (and|with)) (your |the )?cancel|cancell?ation (has been|is) (processed|complete|confirmed)"
    r"|sorry to see you go|service (has been|will be) (cancell?ed|terminated|disconnected)",
    re.I,
)
REPEAT = re.compile(r"called (about this |about it )?(before|earlier|last week|yesterday|several times|multiple times)|calling again|(second|third) time", re.I)
WANTS_HUMAN = re.compile(r"supervisor|\bmanager\b|real person|speak (to|with) (a |someone )?human", re.I)

NAME_AFTER_COMMA = re.compile(r",\s+([A-Z][a-z]{2,})[.!?,]")
AGENT_NAME = re.compile(r"(?i:my name is|this is|i'm|i am) ([A-Z][a-z]{2,})")
NOT_NAMES = {"Union", "Mobile", "Thank", "Thanks", "Great", "Sure", "Okay", "Absolutely", "Alright", "Yes", "Sorry",
             "Please", "Hello", "Welcome", "Perfect", "Wonderful", "Certainly", "Goodbye", "Bye", "Again", "Today"}


def sentiment_label(score: float) -> str:
    if score >= 0.3:
        return "positive"
    if score <= -0.05:
        return "negative"
    return "neutral"


def classify_topic(text: str) -> str:
    best, best_score = "Other", 0
    for name, pat in TOPICS:
        score = len(re.findall(pat, text, re.I))
        if score > best_score:
            best, best_score = name, score
    return best


def mean(xs):
    return sum(xs) / len(xs) if xs else 0.0


def enrich(conv_id: str, turns: list[dict]):
    times = [datetime.fromisoformat(t["date_time"]) for t in turns]
    start = min(times)
    duration = (max(times) - start).total_seconds()
    # Last turn has no end time in the source; add a short reading allowance so 2-turn calls aren't 0s.
    duration += max(4.0, len(turns[-1]["text"].split()) / 2.6)

    client = [t for t in turns if t["speaker"] == "client"]
    agent = [t for t in turns if t["speaker"] == "agent"]
    if len(client) < 2 or len(agent) < 2:
        return None

    scored = []
    for t, ts in zip(turns, times):
        s = VADER.polarity_scores(t["text"])["compound"]
        scored.append({
            "s": "a" if t["speaker"] == "agent" else "c",
            "t": round((ts - start).total_seconds(), 1),
            "x": t["text"].strip(),
            "v": round(s, 3),
        })
    client_scores = [x["v"] for x in scored if x["s"] == "c"]
    sent_start = mean(client_scores[:2])
    sent_end = mean(client_scores[-2:])
    # Mood during the call: leave out the caller's final turn, which is almost always a polite sign-off.
    sent_avg = mean(client_scores[:-1] if len(client_scores) > 2 else client_scores)

    agent_words = sum(len(t["text"].split()) for t in agent)
    client_words = sum(len(t["text"].split()) for t in client)

    opening = " ".join(t["text"] for t in client[:2])
    topic = classify_topic(opening)

    agent_text = " ".join(t["text"] for t in agent)
    client_text = " ".join(t["text"] for t in client)
    tail_client = " ".join(t["text"] for t in client[-2:])

    if topic == "Cancellation":
        outcome = "Cancelled" if CANCEL_DONE.search(agent_text) else "Retained"
    elif ESCALATE.search(agent_text):
        outcome = "Escalated"
    elif UNRESOLVED.search(tail_client) or sent_end <= -0.3:
        outcome = "Unresolved"
    elif FOLLOW_UP.search(agent_text):
        outcome = "Follow-up"
    else:
        outcome = "Resolved"

    m = AGENT_NAME.search(agent[0]["text"])
    agent_name = m.group(1) if m else None
    if not agent_name:
        # Callers usually greet the agent by name: "Hi Lakesha, I'm calling about..."
        m = re.match(r"(?:Hi|Hello|Hey)(?: there)?,? ([A-Z][a-z]{2,})\b", client[0]["text"])
        agent_name = m.group(1) if m and m.group(1) not in NOT_NAMES else None
    names = Counter(n for t in agent for n in NAME_AFTER_COMMA.findall(t["text"]) if n not in NOT_NAMES and n != agent_name)
    customer_name = names.most_common(1)[0][0] if names else None

    flags = []
    if REPEAT.search(client_text):
        flags.append("Repeat contact")
    if WANTS_HUMAN.search(client_text):
        flags.append("Asked for a human")
    if sent_end - sent_start <= -0.4:
        flags.append("Sentiment dropped")
    if outcome in ("Unresolved", "Escalated") and sent_end < 0:
        flags.append("Needs review")

    summary = {
        "id": conv_id[:12],
        "start": start.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "dur": round(duration),
        "turns": len(turns),
        "topic": topic,
        "outcome": outcome,
        "sent": sentiment_label(sent_avg),
        "sAvg": round(sent_avg, 3),
        "sStart": round(sent_start, 3),
        "sEnd": round(sent_end, 3),
        "agentShare": round(agent_words / max(1, agent_words + client_words), 3),
        "agent": agent_name,
        "customer": customer_name,
        "reason": client[0]["text"].strip()[:220],
        "flags": flags,
    }
    return summary, scored


def main(src: str, out_dir: str):
    convs = defaultdict(list)
    with open(src, newline="", encoding="utf-8", errors="ignore") as f:
        reader = csv.reader(f)
        next(reader)
        for row in reader:
            if len(row) != 4 or not row[3].strip():
                continue
            cid, speaker, date_time, text = row
            try:
                datetime.fromisoformat(date_time)
            except ValueError:
                continue  # truncated final line of a partial download
            convs[cid].append({"speaker": speaker, "date_time": date_time, "text": text})

    # The partial download may cut the last conversation mid-way; drop it.
    if convs:
        convs.pop(list(convs)[-1])

    out = Path(out_dir)
    (out / "transcripts").mkdir(parents=True, exist_ok=True)
    calls, shards = [], defaultdict(dict)
    for cid, turns in convs.items():
        turns.sort(key=lambda t: t["date_time"])
        res = enrich(cid, turns)
        if not res:
            continue
        summary, scored = res
        calls.append(summary)
        shards[summary["id"][:2]][summary["id"]] = scored

    calls.sort(key=lambda c: c["start"], reverse=True)
    meta = {
        "company": "Union Mobile",
        "source": "talkmap/telecom-conversation-corpus (MIT), synthetic telecom support calls",
        "count": len(calls),
        "from": calls[-1]["start"],
        "to": calls[0]["start"],
    }
    (out / "calls.json").write_text(json.dumps({"meta": meta, "calls": calls}, separators=(",", ":")))
    for key, data in shards.items():
        (out / "transcripts" / f"{key}.json").write_text(json.dumps(data, separators=(",", ":")))

    print(f"{len(calls)} calls -> {out}")
    for field in ("topic", "outcome", "sent"):
        print(field, Counter(c[field] for c in calls).most_common())
    print("flags", Counter(f for c in calls for f in c["flags"]).most_common())
    print("named customers", sum(1 for c in calls if c["customer"]), "named agents", sum(1 for c in calls if c["agent"]))
    print("days", Counter(c["start"][:7] for c in calls).most_common())


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
