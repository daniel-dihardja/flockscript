"""Pydantic models and LangChain tool for creating audio patches."""

from __future__ import annotations

from typing import List, Literal, Optional, Union

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
    filterType: Optional[Literal["lowpass", "highpass"]] = Field(
        default=None, description="Filter mode: lowpass or highpass"
    )
    cutoff: Optional[float] = Field(
        default=None, description="Filter cutoff frequency in Hz (20–20000)"
    )
    q: Optional[float] = Field(
        default=None, description="Filter resonance/Q factor (0.001–30)"
    )
    attack: Optional[float] = Field(
        default=None, description="Envelope attack time in seconds (0–5)"
    )
    decay: Optional[float] = Field(
        default=None, description="Envelope decay time in seconds (0–5)"
    )
    sustain: Optional[float] = Field(
        default=None, description="Envelope sustain level (0–1)"
    )
    release: Optional[float] = Field(
        default=None, description="Envelope release time in seconds (0–10)"
    )
    steps: Optional[List[float]] = Field(
        default=None,
        description=(
            "Sequencer step values. Interpreted as frequencies (Hz) when routed to a "
            "'frequency' param (e.g. osc1.frequency). The value is ignored when routed "
            "to 'gate' — it acts as a pure trigger for an envelope."
        ),
    )
    rate: Optional[float] = Field(
        default=None, description="Sequencer step rate in steps per second (0.01–)"
    )


class Device(BaseModel):
    """A signal generator or sink in the patch."""

    id: Optional[str] = None
    type: Literal["osc", "lfo", "filter", "envelope", "sequencer", "output"]
    params: Optional[Params] = None


class Route(BaseModel):
    """A connection between two devices.

    For audio routes, 'to' is '<id>.in' (e.g. 'out.in').
    For mod routes, 'to' is '<deviceId>.<param>' (e.g. 'osc1.frequency').
    """

    model_config = ConfigDict(populate_by_name=True)

    from_: str = Field(alias="from")
    to: str
    signal: Literal["audio", "mod", "seq"]


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
