"""Simple hello-world graph: passes a message through an OpenAI LLM and returns the response."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List

from langchain_core.messages import AnyMessage, HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph


@dataclass
class State:
    """Graph state holding the conversation messages."""

    messages: List[AnyMessage] = field(default_factory=list)


llm = ChatOpenAI(model="gpt-4o-mini")


async def call_model(state: State) -> Dict[str, Any]:
    """Pass the messages through the LLM and append the response."""
    response = await llm.ainvoke(state.messages)
    return {"messages": state.messages + [response]}


# Define the graph
graph = (
    StateGraph(State)
    .add_node(call_model)
    .add_edge("__start__", "call_model")
    .compile(name="Hello World Graph")
)
