"""Agent graph: passes messages through an OpenAI LLM with tool support."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List

from dotenv import load_dotenv

load_dotenv()

from langchain_core.messages import AnyMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph
from langgraph.prebuilt import ToolNode

from agent.patch import create_patch

SYSTEM_PROMPT = """You are an audio synthesis assistant that helps users design audio patches.

When a user asks you to create, build, or design an audio patch, oscillator setup, or signal routing,
you MUST call the `create_patch` tool with the appropriate devices and routes.

Patch rules:
- Every patch needs at least one source device (type: "osc") and one sink (type: "output").
- Routes connect devices using the format "<id>.out" -> "<id>.in".
- Valid waveforms: sine, square, saw, sawtooth, triangle, noise.
- Frequency range: 20–20000 Hz. Gain range: 0–1.

For all other questions, respond conversationally without calling any tool."""


@dataclass
class State:
    """Graph state holding the conversation messages."""

    messages: List[AnyMessage] = field(default_factory=list)


tools = [create_patch]
llm = ChatOpenAI(model="gpt-4o-mini")
llm_with_tools = llm.bind_tools(tools)


async def call_model(state: State) -> Dict[str, Any]:
    """Pass the messages through the LLM and append the response."""
    messages = [SystemMessage(content=SYSTEM_PROMPT)] + state.messages
    response = await llm_with_tools.ainvoke(messages)
    return {"messages": state.messages + [response]}


def should_use_tools(state: State) -> str:
    """Route to tool node if the last message has tool calls."""
    last = state.messages[-1]
    if hasattr(last, "tool_calls") and last.tool_calls:
        return "tools"
    return "__end__"


# Define the graph
graph = (
    StateGraph(State)
    .add_node("call_model", call_model)
    .add_node("tools", ToolNode(tools))
    .add_edge("__start__", "call_model")
    .add_conditional_edges("call_model", should_use_tools)
    .add_edge("tools", "__end__")
    .compile(name="Patch Agent Graph")
)
