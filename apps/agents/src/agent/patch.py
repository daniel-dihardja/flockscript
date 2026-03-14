"""Pydantic models and LangChain tool for creating audio patches."""

from __future__ import annotations

from typing import Annotated, List, Literal, Optional, Union

from langchain_core.tools import tool
from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Per-type params models
# ---------------------------------------------------------------------------


class OscParams(BaseModel):
    wave: Optional[
        Literal["sine", "square", "saw", "sawtooth", "triangle", "noise"]
    ] = None
    frequency: Optional[float] = Field(
        default=None, description="Frequency in Hz (20–20000)"
    )
    gain: Optional[float] = Field(default=None, description="Linear gain (0–1)")


class LfoParams(BaseModel):
    wave: Optional[
        Literal["sine", "square", "saw", "sawtooth", "triangle", "noise"]
    ] = None
    frequency: Optional[float] = Field(
        default=None, description="LFO rate in Hz (0.01–20)"
    )
    depth: Optional[float] = Field(default=None, description="Modulation depth (0–1)")


class FilterParams(BaseModel):
    cutoff: Optional[float] = Field(
        default=None, description="Cutoff frequency in Hz (20–20000)"
    )
    q: Optional[float] = Field(default=None, description="Resonance/Q factor (0.1–20)")
    mode: Optional[float] = Field(
        default=None,
        description="Filter character: 0.0=lowpass, 1.0=highpass, 0.5=blend",
    )


class EqParams(BaseModel):
    lowFreq: Optional[float] = Field(
        default=None, description="Low shelf frequency in Hz (20–500)"
    )
    lowGain: Optional[float] = Field(
        default=None, description="Low shelf gain in dB (-20 to +20)"
    )
    midFreq: Optional[float] = Field(
        default=None, description="Mid peaking frequency in Hz (200–8000)"
    )
    midGain: Optional[float] = Field(
        default=None, description="Mid peaking gain in dB (-20 to +20)"
    )
    midQ: Optional[float] = Field(
        default=None, description="Mid band Q / bandwidth (0.1–10)"
    )
    highFreq: Optional[float] = Field(
        default=None, description="High shelf frequency in Hz (2000–20000)"
    )
    highGain: Optional[float] = Field(
        default=None, description="High shelf gain in dB (-20 to +20)"
    )


class EnvelopeParams(BaseModel):
    attack: Optional[float] = Field(
        default=None, description="Attack time in seconds (0–5)"
    )
    decay: Optional[float] = Field(
        default=None, description="Decay time in seconds (0–5)"
    )
    sustain: Optional[float] = Field(default=None, description="Sustain level (0–1)")
    release: Optional[float] = Field(
        default=None, description="Release time in seconds (0–10)"
    )


class SequencerParams(BaseModel):
    steps: Optional[List[float]] = Field(
        default=None,
        description=(
            "Step frequencies in Hz. The value is ignored when routed to 'gate' — "
            "it acts as a pure trigger for an envelope."
        ),
    )
    rate: Optional[float] = Field(
        default=None, description="Step rate in steps per second (0.01–)"
    )


class OutputParams(BaseModel):
    gain: Optional[float] = Field(default=None, description="Linear gain (0–1)")


class ChannelParams(BaseModel):
    gain: Optional[float] = Field(default=None, description="Channel bus gain (0–1)")
    pan: Optional[float] = Field(
        default=None, description="Pan position (-1 left to 1 right, default 0)"
    )


# ---------------------------------------------------------------------------
# Per-type device models (discriminated union on 'type')
# ---------------------------------------------------------------------------


class OscDevice(BaseModel):
    id: Optional[str] = None
    type: Literal["osc"]
    params: Optional[OscParams] = None


class LfoDevice(BaseModel):
    id: Optional[str] = None
    type: Literal["lfo"]
    params: Optional[LfoParams] = None


class FilterDevice(BaseModel):
    id: Optional[str] = None
    type: Literal["filter"]
    params: Optional[FilterParams] = None


class EqDevice(BaseModel):
    id: Optional[str] = None
    type: Literal["eq"]
    params: Optional[EqParams] = None


class EnvelopeDevice(BaseModel):
    id: Optional[str] = None
    type: Literal["envelope"]
    params: Optional[EnvelopeParams] = None


class SequencerDevice(BaseModel):
    id: Optional[str] = None
    type: Literal["sequencer"]
    params: Optional[SequencerParams] = None


class OutputDevice(BaseModel):
    id: Optional[str] = None
    type: Literal["output"]
    params: Optional[OutputParams] = None


class ChannelDevice(BaseModel):
    id: Optional[str] = None
    type: Literal["channel"]
    params: Optional[ChannelParams] = None


Device = Annotated[
    Union[
        OscDevice,
        LfoDevice,
        FilterDevice,
        EqDevice,
        EnvelopeDevice,
        SequencerDevice,
        OutputDevice,
        ChannelDevice,
    ],
    Field(discriminator="type"),
]


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
    """Create or update an audio patch with devices and signal routes.

    Use this tool whenever the user asks to create, build, design, or modify an audio
    patch — including requests to add, remove, or change any device (e.g. 'add a filter',
    'add eq', 'remove the LFO', 'change the cutoff'). Always emit the complete patch with
    ALL devices and routes, even when only a small change was requested.
    """
    return patch.model_dump_json(by_alias=True)
