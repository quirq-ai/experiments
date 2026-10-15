"""02: the three question types, asked together in one call.

    Noul    Is this true?               P(yes)
    Choice  Which of these options?     choice + probabilities + confidence
    Score   Where on this scale?        score (can land between levels) + probabilities + confidence

Every question sees the same state and they run in parallel, so three cost about the time of one.

    uv run 02_three_questions.py
    uv run 02_three_questions.py "your own support message"
"""

import sys
import time

from typesafe_sdk import Choice, Noul, Score

import jev

ticket = sys.argv[1] if len(sys.argv) > 1 else (
    "Hi, I've been trying to connect my Stripe account for 3 days and the integration keeps failing. "
    "I'm losing sales. Please help ASAP."
)

client = jev.client()

started = time.perf_counter()
response = client.system_one(
    state=ticket,
    questions={
        "department": Choice(
            instructions="Which team should handle this?",
            criteria={
                "billing": "Payment or subscription issues",
                "technical": "Bugs or integration problems",
                "sales": "Pricing or account questions",
            },
        ),
        "frustration": Score(
            instructions="How frustrated does the customer appear?",
            criteria=[
                "Calm, just stating facts",
                "Frustrated but civil",
                "Very angry, strong language",
            ],
        ),
        "is_urgent": Noul(instructions="Does the message convey urgency or time pressure?"),
    },
)
ms = (time.perf_counter() - started) * 1000

print(f"state: {ticket}\n")
jev.show(response, ms)

# The answers are typed values, not text to parse. Read them like any other object.
department = response.choices["department"]
urgent = response.nouls["is_urgent"].noul > 0.8
print(f"\nroute to the {department.choice} team" + (", flagged urgent" if urgent else ""))
