"""Pydantic models and LangChain tool for creating audio patches."""

from __future__ import annotations

from typing import List, Literal, Optional

from langchain_core.tools import tool
from pydantic import BaseModel, ConfigDict, Field


class Params(BaseModel):
    """Device-specific parameters."""

    wave: Optional[
        Literal["sine", "square", "saw", "sawtooth", "triangle", "noise"]
    ] = None
    frequency: Optional[float] = None
    gain: Optional[float] = None
    depth: Optional[float] = Field(
        default=None, description="LFO modulation depth (0–1)"
    )


class Device(BaseModel):
    """A signal generator or sink in the patch."""

    id: Optional[str] = None
    type: Literal["osc", "lfo", "output"]
    params: Optional[Params] = None


class Route(BaseModel):
    """A connection between two devices.

    For audio routes, 'to' is '<id>.in' (e.g. 'out.in').
    For mod routes, 'to' is '<deviceId>.<param>' (e.g. 'osc1.frequency').
    """

    model_config = ConfigDict(populate_by_name=True)

    from_: str = Field(alias="from")
    to: str
    signal: Literal["audio", "mod"]


class Patch(BaseModel):
    """A complete audio patch with devices and routes."""

    devices: List[Device]
    routes: List[Route]


@tool
def create_patch(patch: Patch) -> str:
    """Create an audio patch with devices and signal routes.

    Use this tool whenever the user asks to create, build, or design an audio patch,
    oscillator setup, or signal routing. Provide all required devices and their
    connections as routes.
    """
    return patch.model_dump_json(by_alias=True)
