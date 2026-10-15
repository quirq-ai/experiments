"""04: speculative fan-out. Ask everything you might need, in one call.

Jev reads the state once and answers every question in parallel, so 25 questions take about
as long as 1, and each extra question costs only its own input tokens. Most of the questions
below only matter for some messages. Ask them anyway and let your code use what applies.

This script times three ways of getting answers about the same message:

    1 question in 1 call
    25 questions in 1 call
    25 questions in 25 calls, one after another (a chain of prompts, the LLM habit)

    uv run 04_fan_out.py
"""

import time

from typesafe_sdk import Choice, Noul, Score

import jev

STATE = {
    "customer": {"plan": "pro", "channel": "email"},
    "message": (
        "This is the third time I'm writing about order A-104. I was charged twice, the package "
        "never arrived, and your chat bot keeps closing my ticket. If this isn't fixed by Friday "
        "I'm switching to your competitor. Can someone real please call me?"
    ),
}

FIRST = {"wants_human": Noul(instructions="Does `message` ask to speak with a human?")}

REST = {
    "wants_refund": Noul(instructions="Does `message` ask for money back?"),
    "mentions_order_id": Noul(instructions="Does `message` mention a specific order number?"),
    "duplicate_charge": Noul(instructions="Does `message` report being charged more than once?"),
    "not_delivered": Noul(instructions="Does `message` report that a package never arrived?"),
    "repeat_contact": Noul(instructions="Has the customer contacted support about this before?"),
    "has_deadline": Noul(instructions="Does `message` set a deadline?"),
    "churn_threat": Noul(instructions="Does the customer threaten to switch to a competitor?"),
    "bot_complaint": Noul(instructions="Does `message` complain about a chat bot?"),
    "wants_callback": Noul(instructions="Does `message` ask for a phone call?"),
    "is_abusive": Noul(instructions="Is `message` abusive or insulting toward staff?"),
    "legal_threat": Noul(instructions="Does `message` threaten legal action?"),
    "asks_for_discount": Noul(instructions="Does `message` ask for a discount?"),
    "praises_product": Noul(instructions="Does `message` praise the product?"),
    "is_spam": Noul(instructions="Is `message` spam or unrelated marketing?"),
    "is_english": Noul(instructions="Is `message` written in English?"),
    "contains_pii": Noul(instructions="Does `message` contain personal data such as a phone number, address, or card number?"),
    "paid_plan": Noul(instructions="Is the customer on a paid plan, according to `customer.plan`?"),
    "intent": Choice(
        instructions="What is the main request in `message`?",
        criteria={"refund": None, "delivery": None, "cancel": None, "account": None, "other": None},
    ),
    "department": Choice(
        instructions="Which team should own this?",
        criteria={"billing": None, "shipping": None, "tech_support": None, "retention": None},
    ),
    "sentiment": Choice(
        instructions="What is the overall sentiment of `message`?",
        criteria={"positive": None, "neutral": None, "negative": None},
    ),
    "frustration": Score(
        instructions="How frustrated is the customer?",
        criteria=["Calm", "Mildly annoyed", "Frustrated", "Furious"],
    ),
    "urgency": Score(
        instructions="How urgent is this for the business?",
        criteria=["Can wait a week", "Handle this week", "Handle today", "Drop everything"],
    ),
    "churn_risk": Score(
        instructions="How likely is this customer to leave?",
        criteria=["Unlikely to leave", "Might leave", "Likely to leave", "Already leaving"],
    ),
    "clarity": Score(
        instructions="How clearly does `message` describe the problem?",
        criteria=["Unclear", "Partly clear", "Clear and actionable"],
    ),
}

ALL = FIRST | REST


def best_of(questions, runs=3):
    """The fastest of `runs` identical calls (network jitter is noisy), and its response."""
    fastest, response = float("inf"), None
    for _ in range(runs):
        started = time.perf_counter()
        response = client.system_one(state=STATE, questions=questions)
        fastest = min(fastest, (time.perf_counter() - started) * 1000)
    return fastest, response


def row(label, ms, tokens):
    dollars = tokens * jev.PRICE_PER_INPUT_TOKEN
    return f"{label:<26}{ms:>9,.0f} ms{tokens:>10,} tokens   ${dollars:.7f}"


client = jev.client()
client.system_one(state="warm up", questions=FIRST)  # the first call pays for the TLS handshake; don't time it

one_ms, one = best_of(FIRST)
all_ms, everything = best_of(ALL)

print(f"timing {len(ALL)} separate calls, one after another...\n", flush=True)
started = time.perf_counter()
separate_tokens = 0
for qid, question in ALL.items():
    separate_tokens += client.system_one(state=STATE, questions={qid: question}).usage.input_tokens or 0
separate_ms = (time.perf_counter() - started) * 1000

print(f"{'':<26}{'time':>12}{'input':>17}   cost at list price")
print(row("1 question, 1 call", one_ms, one.usage.input_tokens or 0))
print(row(f"{len(ALL)} questions, 1 call", all_ms, everything.usage.input_tokens or 0))
print(row(f"{len(ALL)} questions, {len(ALL)} calls", separate_ms, separate_tokens))

print(f"\n{len(ALL)}x the questions in one call took {all_ms / one_ms:.1f}x the time of one question.")
print(f"One call per question took {separate_ms / all_ms:.0f}x longer and sent the state {len(ALL)} times.")

alone, together = one.nouls["wants_human"].noul, everything.nouls["wants_human"].noul
print(f"wants_human asked alone: {alone:.2f}. Asked next to {len(REST)} others: {together:.2f}. Each question is judged on its own.")

print(f"\nAll {len(ALL)} answers from the single call ({everything.model}):")
width = max(map(len, everything.answers))
for qid, answer in everything.answers.items():
    print(f"  {qid:<{width}}  {jev.brief(answer)}")
