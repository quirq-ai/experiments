"""01: the smallest Jev call. One yes/no question in, one probability out. No text comes back.

    uv run 01_hello.py
    uv run 01_hello.py "your text" "your yes/no question?"
"""

import sys
import time

from typesafe_sdk import Noul

import jev

state = sys.argv[1] if len(sys.argv) > 1 else "Hi, I was charged twice for order A-104. Can you refund the duplicate?"
question = sys.argv[2] if len(sys.argv) > 2 else "Is the customer asking for a refund?"

client = jev.client()

started = time.perf_counter()
response = client.system_one(
    state=state,  # what to judge: a string, or any JSON object or array
    questions={"answer": Noul(instructions=question)},  # Noul = a yes/no question
)
ms = (time.perf_counter() - started) * 1000

p = response.answers["answer"].noul  # a float from 0 to 1: the probability that the answer is yes
print(f"state:     {state}")
print(f"question:  {question}")
print(f"P(yes):    {p:.2f}  {jev.bar(p)}  ({ms:.0f} ms, {response.model})")

# Your code decides what the number means. The middle band is Jev saying "not sure".
if p > 0.8:
    print("decision:  yes, act on it")
elif p < 0.2:
    print("decision:  no")
else:
    print("decision:  unsure, ask a person")
