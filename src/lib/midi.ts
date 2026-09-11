"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { getSettings, updateSettings } from "@/lib/settings";

/**
 * MIDI keyboard input (Web MIDI).
 *
 * Until now the app could only see what you clicked on screen. With a
 * keyboard plugged in — USB or Bluetooth — it sees what you actually play,
 * which is what turns a reading exercise into a playing one.
 *
 * One place holds the connection for the whole app: opening MIDI asks for a
 * permission, and asking once per exercise would be unbearable. Whoever wants
 * the notes subscribes with `useMidiNotes`; whoever wants the state of the
 * connection reads `useMidi`.
 *
 * Not every browser has it (Chrome, Edge and Opera do; Safari and Firefox
 * don't), so everything here is an extra: with no keyboard, or no Web MIDI,
 * every exercise still works as it did.
 */

export interface MidiDevice {
  id: string;
  name: string;
}

export interface MidiState {
  /** The browser knows about Web MIDI at all. */
  supported: boolean;
  status: "off" | "asking" | "on" | "error";
  devices: MidiDevice[];
  /** Chosen port; null = listen to every one of them. */
  deviceId: string | null;
  error: string | null;
  /** Keys held down right now, low to high. */
  active: number[];
}

export interface MidiNoteEvent {
  midi: number;
  /** 0-1; 0 on release. */
  velocity: number;
  on: boolean;
}

const OFF: MidiState = { supported: false, status: "off", devices: [], deviceId: null, error: null, active: [] };

let state: MidiState = OFF;
let access: MIDIAccess | null = null;
const held = new Set<number>();
const stateListeners = new Set<() => void>();
const noteListeners = new Set<(e: MidiNoteEvent) => void>();

function setState(patch: Partial<MidiState>) {
  state = { ...state, ...patch };
  stateListeners.forEach((l) => l());
}

export function midiSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.requestMIDIAccess === "function";
}

function emit(event: MidiNoteEvent) {
  if (event.on) held.add(event.midi);
  else held.delete(event.midi);
  setState({ active: [...held].sort((a, b) => a - b) });
  noteListeners.forEach((l) => l(event));
}

function handleMessage(event: MIDIMessageEvent) {
  const data = event.data;
  if (!data || data.length < 2) return;
  const command = data[0] & 0xf0;
  const note = data[1];
  const velocity = (data[2] ?? 0) / 127;
  // A note off is also a note on with velocity 0: half the keyboards out
  // there send it that way.
  if (command === 0x90 && velocity > 0) emit({ midi: note, velocity, on: true });
  else if (command === 0x80 || command === 0x90) emit({ midi: note, velocity: 0, on: false });
  else if (command === 0xb0 && (note === 120 || note === 123)) {
    // all notes / all sound off: the panic button of any keyboard
    for (const midi of [...held]) emit({ midi, velocity: 0, on: false });
  }
}

function devicesOf(midi: MIDIAccess): MidiDevice[] {
  const devices: MidiDevice[] = [];
  midi.inputs.forEach((input) => devices.push({ id: input.id, name: input.name || input.manufacturer || "Teclado MIDI" }));
  return devices;
}

/** Listens to the chosen port, or to all of them when none is chosen. */
function listen() {
  if (!access) return;
  access.inputs.forEach((input) => {
    input.onmidimessage = !state.deviceId || state.deviceId === input.id ? handleMessage : null;
  });
}

function refresh() {
  if (!access) return;
  const devices = devicesOf(access);
  // a port that has been unplugged stops being the chosen one
  const deviceId = state.deviceId && devices.some((d) => d.id === state.deviceId) ? state.deviceId : null;
  setState({ devices, deviceId });
  listen();
}

export async function connectMidi(): Promise<boolean> {
  if (!midiSupported()) {
    setState({ supported: false, status: "error", error: "Este navegador no admite teclados MIDI." });
    return false;
  }
  if (access) return true;
  setState({ supported: true, status: "asking", error: null });
  try {
    access = await navigator.requestMIDIAccess();
  } catch {
    setState({ status: "error", error: "No se pudo acceder al teclado MIDI. Revisa el permiso del navegador." });
    return false;
  }
  access.onstatechange = refresh;
  setState({ status: "on", error: null, deviceId: getSettings().midiDevice });
  refresh();
  updateSettings({ midi: true });
  return true;
}

export function disconnectMidi() {
  if (access) {
    access.inputs.forEach((input) => (input.onmidimessage = null));
    access.onstatechange = null;
    access = null;
  }
  held.clear();
  state = { ...OFF, supported: midiSupported() };
  stateListeners.forEach((l) => l());
  updateSettings({ midi: false });
}

/** null = every port. */
export function setMidiDevice(deviceId: string | null) {
  setState({ deviceId });
  updateSettings({ midiDevice: deviceId });
  listen();
}

export function onMidiNote(listener: (e: MidiNoteEvent) => void): () => void {
  noteListeners.add(listener);
  return () => {
    noteListeners.delete(listener);
  };
}

function subscribe(listener: () => void) {
  stateListeners.add(listener);
  return () => {
    stateListeners.delete(listener);
  };
}

/**
 * State of the connection. With `auto`, reconnects on its own if the user
 * had it on: the permission is already granted, so nothing is asked again.
 */
export function useMidi(auto = false): MidiState {
  const midi = useSyncExternalStore(subscribe, () => state, () => OFF);
  useEffect(() => {
    if (!state.supported && midiSupported()) setState({ supported: true });
    if (auto && !access && getSettings().midi) void connectMidi();
  }, [auto]);
  return midi;
}

/**
 * Notes as they're played. The handler is read from a ref, so an inline
 * arrow function doesn't resubscribe on every render.
 */
export function useMidiNotes(handler: (e: MidiNoteEvent) => void, enabled = true) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    if (!enabled) return;
    return onMidiNote((e) => ref.current(e));
  }, [enabled]);
}
