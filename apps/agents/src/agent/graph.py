"""Agent graph: passes messages through an OpenAI LLM with tool support."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Annotated, Any, Dict, List

from dotenv import load_dotenv

load_dotenv()

from langchain_core.messages import AnyMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from agent.patch import create_patch

SYSTEM_PROMPT = """You are an audio synthesis assistant that helps users design audio patches.

When a user asks you to create, build, or design an audio patch, oscillator setup, or signal routing,
you MUST call the `create_patch` tool with the appropriate devices and routes.

Patch rules:
- Every patch needs at least one source device (type: "osc") and one sink (type: "output").
- Routes connect devices using the format "<id>.out" -> "<id>.in".
- Valid waveforms: sine, square, saw, sawtooth, triangle, noise.
- Frequency range: 0.01–20000 Hz (0.01–20 Hz for LFOs, 20–20000 Hz for oscillators). Gain range: 0–1.

LFO rules:
- Use type: "lfo" to modulate parameters of other devices over time.
- LFO params: frequency (0.01–20 Hz), wave (any waveform), depth (0–1 modulation intensity).
- Connect an LFO with signal: "mod" and to: "<deviceId>.<param>" e.g. "osc1.frequency".
- Only "frequency" is a valid mod target for now.
- Use an LFO when the user asks for vibrato, wobble, tremolo, pulsing, or animated/moving sound.
- Depth guide: 0.05–0.1 = subtle, 0.3–0.5 = noticeable, 0.8–1.0 = extreme.

For all other questions, respond conversationally without calling any tool.

After calling `create_patch`, always follow up with a brief, friendly description of the patch you just created — what it does, what devices are used, and how they are connected."""


@dataclass
class State:
    """Graph state holding the conversation messages."""

    messages: Annotated[List[AnyMessage], add_messages] = field(default_factory=list)


tools = [create_patch]
llm = ChatOpenAI(model="gpt-4o-mini")
llm_with_tools = llm.bind_tools(tools)


async def call_model(state: State) -> Dict[str, Any]:
    """Pass the messages through the LLM and append the response."""
    messages = [SystemMessage(content=SYSTEM_PROMPT)] + state.messages
    response = await llm_with_tools.ainvoke(messages)
    return {"messages": [response]}


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
    .add_edge("tools", "call_model")
    .compile(name="Patch Agent Graph")
)
