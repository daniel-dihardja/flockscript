"""FastAPI server exposing the hello-world LangGraph agent."""

from __future__ import annotations

import json
import os
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from langchain_core.messages import AnyMessage, HumanMessage
from pydantic import BaseModel

load_dotenv()

from agent.graph import graph  # noqa: E402 — import after dotenv load

app = FastAPI(title="Hello World Agent")


class InvokeRequest(BaseModel):
    message: str


class MessageOut(BaseModel):
    role: str
    content: str


class InvokeResponse(BaseModel):
    messages: List[MessageOut]


@app.post("/invoke", response_model=InvokeResponse)
async def invoke(request: InvokeRequest) -> InvokeResponse:
    """Invoke the agent with a user message and return all messages."""
    result = await graph.ainvoke({"messages": [HumanMessage(content=request.message)]})
    messages = [
        MessageOut(
            role=getattr(msg, "type", type(msg).__name__),
            content=str(msg.content),
        )
        for msg in result["messages"]
    ]
    return InvokeResponse(messages=messages)


def _coerce_patch_output(output: object) -> str:
    """Extract a JSON string from a LangChain ToolMessage or raw value."""
    if output is None:
        return ""
    content = getattr(output, "content", output)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and isinstance(item.get("text"), str):
                parts.append(item["text"])
        return "".join(parts) if parts else json.dumps(content, default=str)
    if isinstance(content, dict):
        return json.dumps(content, default=str)
    return str(content)


@app.post("/stream")
async def stream(request: InvokeRequest) -> StreamingResponse:
    """Stream token chunks from the agent as Server-Sent Events."""

    async def event_generator():
        async for event in graph.astream_events(
            {"messages": [HumanMessage(content=request.message)]},
            version="v2",
        ):
            if (
                event["event"] == "on_chat_model_stream"
                and event["data"]["chunk"].content
            ):
                token = event["data"]["chunk"].content
                yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"
            elif event["event"] == "on_tool_end" and event["name"] == "create_patch":
                raw_output = event.get("data", {}).get("output", "")
                patch_json = _coerce_patch_output(raw_output)
                yield f"data: {json.dumps({'type': 'patch', 'data': patch_json})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
