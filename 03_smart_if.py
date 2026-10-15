"""03: Jev as a smart if-statement.

Code owns the workflow. Jev supplies the judgment. Each message gets one call with two
questions, and plain Python turns the typed answers into an action. The confidence bar
rises with the stakes: looking up an order needs less certainty than moving money.

    uv run 03_smart_if.py
"""

from typesafe_sdk import Choice, ChoiceAnswer, Noul

import jev

MESSAGES = [
    "Where is my order A-104? It was supposed to arrive Monday.",
    "I was charged twice for order A-104. Please refund the duplicate charge.",
    "Cancel my subscription.",
    "Can I talk to an actual person? The bot keeps sending me in circles.",
    "hmm, not sure this is working out",
    "What's the weather like in Lisbon this weekend?",
]

QUESTIONS = {
    "intent": Choice(
        instructions="What does the customer want?",
        criteria={
            "order_status": "Where an order is, or when it will arrive",
            "refund": "Money back for a charge or an order",
            "cancel": "Stop a subscription or cancel an order",
            "other": "Anything else, or not clear",
        },
    ),
    "wants_human": Noul(instructions="Is the customer asking to speak with a human?"),
}


def decide(intent: ChoiceAnswer, wants_human: float) -> str:
    if wants_human > 0.8:
        return "hand off to a person"
    if intent.confidence < 0.5:
        return "ask a clarifying question"  # Jev is saying "I'm not sure". Don't guess.
    if intent.choice == "order_status":
        return "look up tracking"  # low stakes: a wrong screen is easy to recover from
    if intent.choice == "refund":
        # money moves: demand more certainty before acting alone
        return "issue the refund" if intent.confidence > 0.9 else "draft a refund for review"
    if intent.choice == "cancel":
        return "confirm, then cancel"
    return "send to the general inbox"


client = jev.client()
for message in MESSAGES:
    response = client.system_one(state=message, questions=QUESTIONS)
    intent = response.choices["intent"]
    wants_human = response.nouls["wants_human"].noul
    print(message)
    print(
        f"    intent={intent.choice} (confidence {intent.confidence:.2f})  "
        f"wants_human={wants_human:.2f}  ->  {decide(intent, wants_human)}\n"
    )
