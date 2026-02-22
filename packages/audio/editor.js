/**
 * CodeMirror Editor Setup
 */

import { EditorView, basicSetup } from "codemirror";
import { EditorState, StateField, StateEffect } from "@codemirror/state";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import { linter, lintGutter } from "@codemirror/lint";
import { keymap, Decoration } from "@codemirror/view";

const defaultPatch = `{
  "oscillators": [
    { "id": "bass", "freq": 220, "gain": 0.3, "type": "sawtooth" }
  ],
  "modulators": [
    { "type": "lfo", "id": "qmod", "rate": 3, "depth": 8, "wave": "sine" }
  ],
  "effects": [
    { "type": "filter", "id": "filt", "filterType": "lowpass", "freq": 800, "q": 5 }
  ],
  "routing": [
    { "from": "qmod", "to": "filt", "param": "q" }
  ]
}`;

/**
 * Find all JSON value positions (numbers, strings, booleans)
 */
function findJsonValues(text) {
  const values = [];
  // Match numbers, strings (in quotes), true, false, null
  const valueRegex = /:\s*("(?:[^"\\]|\\.)*"|-?\d+\.?\d*|true|false|null)/g;
  let match;

  while ((match = valueRegex.exec(text)) !== null) {
    const valueStart = match.index + match[0].indexOf(match[1]);
    const valueEnd = valueStart + match[1].length;
    values.push({ from: valueStart, to: valueEnd });
  }

  return values;
}

/**
 * Custom theme for highlighted value and property colors
 */
const highlightTheme = EditorView.baseTheme({
  ".cm-highlighted-value": {
    backgroundColor: "#00ff0040",
    outline: "2px solid #00ff00",
    outlineOffset: "1px",
    borderRadius: "3px",
    padding: "2px 4px",
    margin: "0 -4px",
  },
  ".cm-property-oscillators": {
    color: "#00ff00 !important",
    fontWeight: "bold",
  },
  ".cm-property-noise": {
    color: "#ffff00 !important",
    fontWeight: "bold",
  },
  ".cm-property-modulators": {
    color: "#ff00ff !important",
    fontWeight: "bold",
  },
  ".cm-property-routing": {
    color: "#00ffff !important",
    fontWeight: "bold",
  },
  ".cm-property-effects": {
    color: "#ff8800 !important",
    fontWeight: "bold",
  },
});

/**
 * State effect for setting highlights
 */
const setHighlight = StateEffect.define();

/**
 * State field to manage highlight decorations
 */
const highlightField = StateField.define({
  create() {
    return Decoration.none;
  },
  update(highlights, tr) {
    highlights = highlights.map(tr.changes);
    for (let effect of tr.effects) {
      if (effect.is(setHighlight)) {
        highlights = effect.value;
      }
    }
    return highlights;
  },
  provide: (f) => EditorView.decorations.from(f),
});

/**
 * Find and decorate property names with colors
 */
function colorPropertyNames(state) {
  const text = state.doc.toString();
  const decorations = [];

  // Property patterns with their corresponding classes
  const properties = [
    { name: "oscillators", class: "cm-property-oscillators" },
    { name: "noise", class: "cm-property-noise" },
    { name: "modulators", class: "cm-property-modulators" },
    { name: "routing", class: "cm-property-routing" },
    { name: "effects", class: "cm-property-effects" },
  ];

  properties.forEach(({ name, class: className }) => {
    // Match property name in quotes
    const regex = new RegExp(`"(${name})"\\s*:`, "g");
    let match;
    while ((match = regex.exec(text)) !== null) {
      const propStart = match.index + 1; // Skip opening quote
      const propEnd = propStart + name.length;
      decorations.push(
        Decoration.mark({ class: className }).range(propStart, propEnd),
      );
    }
  });

  return Decoration.set(decorations, true);
}

/**
 * State field for property name colors
 */
const propertyColorField = StateField.define({
  create(state) {
    return colorPropertyNames(state);
  },
  update(colors, tr) {
    if (tr.docChanged) {
      return colorPropertyNames(tr.state);
    }
    return colors.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

/**
 * Jump to next value and select it
 */
function jumpToNextValue(view) {
  const text = view.state.doc.toString();
  const currentPos = view.state.selection.main.head;
  const values = findJsonValues(text);

  // Find next value after current position
  const nextValue = values.find((v) => v.from > currentPos);

  if (nextValue) {
    const decoration = Decoration.mark({
      class: "cm-highlighted-value",
    }).range(nextValue.from, nextValue.to);

    view.dispatch({
      selection: { anchor: nextValue.from, head: nextValue.to },
      effects: setHighlight.of(Decoration.set([decoration])),
      scrollIntoView: true,
    });
  } else if (values.length > 0) {
    // Loop back to first value
    const decoration = Decoration.mark({
      class: "cm-highlighted-value",
    }).range(values[0].from, values[0].to);

    view.dispatch({
      selection: { anchor: values[0].from, head: values[0].to },
      effects: setHighlight.of(Decoration.set([decoration])),
      scrollIntoView: true,
    });
  }

  return true;
}

/**
 * Jump to previous value and select it
 */
function jumpToPrevValue(view) {
  const text = view.state.doc.toString();
  const currentPos = view.state.selection.main.from;
  const values = findJsonValues(text);

  // Find previous value before current position
  const prevValues = values.filter((v) => v.to < currentPos);
  const prevValue = prevValues[prevValues.length - 1];

  if (prevValue) {
    const decoration = Decoration.mark({
      class: "cm-highlighted-value",
    }).range(prevValue.from, prevValue.to);

    view.dispatch({
      selection: { anchor: prevValue.from, head: prevValue.to },
      effects: setHighlight.of(Decoration.set([decoration])),
      scrollIntoView: true,
    });
  } else if (values.length > 0) {
    // Loop to last value
    const lastValue = values[values.length - 1];
    const decoration = Decoration.mark({
      class: "cm-highlighted-value",
    }).range(lastValue.from, lastValue.to);

    view.dispatch({
      selection: { anchor: lastValue.from, head: lastValue.to },
      effects: setHighlight.of(Decoration.set([decoration])),
      scrollIntoView: true,
    });
  }

  return true;
}

/**
 * Custom keyboard shortcuts
 */
const customKeymap = keymap.of([
  {
    key: "Tab",
    preventDefault: true,
    run: jumpToNextValue,
  },
  {
    key: "Shift-Tab",
    preventDefault: true,
    run: jumpToPrevValue,
  },
]);

/**
 * Create and initialize CodeMirror editor
 */
export function createEditor(parent, onChange) {
  const startState = EditorState.create({
    doc: defaultPatch,
    extensions: [
      basicSetup,
      json(),
      linter(jsonParseLinter()),
      lintGutter(),
      oneDark,
      highlightTheme,
      highlightField,
      propertyColorField,
      EditorView.lineWrapping,
      customKeymap,
      EditorView.updateListener.of((update) => {
        if (update.docChanged && onChange) {
          onChange(update.state.doc.toString());
        }
      }),
    ],
  });

  const view = new EditorView({
    state: startState,
    parent,
  });

  return view;
}

export { defaultPatch };
