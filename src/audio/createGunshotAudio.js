/**
 * M4 gunshot one-shots. Prefer HTMLAudio on mobile after touch.
 */

import * as THREE from "three/webgpu";
import { getAudioVolume, subscribe } from "./audioState.js";

const SHOT_URLS = [
  "/m4-shot-01.mp3",
  "/m4-shot-02.mp3",
  "/m4-shot-03.mp3",
  "/m4-shot.mp3",
  "/m4.wav",
];

const VOLUME_SCALE = 1.0;
const LONG_CLIP_DURATION = 0.35;

function isMobileish() {
  return (
    typeof window !== "undefined" &&
    (window.matchMedia?.("(pointer: coarse)")?.matches ||
      /Android|iPhone|iPad/i.test(navigator.userAgent || ""))
  );
}

export async function createGunshotAudio({ listener, camera } = {}) {
  if (isMobileish()) {
    return createHtmlPool();
  }

  let activeListener = listener;
  if (!activeListener && camera) {
    try {
      activeListener = new THREE.AudioListener();
      camera.add(activeListener);
    } catch {
      return createHtmlPool();
    }
  }

  if (!activeListener) return createHtmlPool();

  const loader = new THREE.AudioLoader();
  const buffers = [];
  for (const url of SHOT_URLS) {
    try {
      const buf = await loader.loadAsync(url);
      buffers.push({
        buffer: buf,
        url,
        long: url.endsWith(".wav") && buf.duration > 1,
      });
    } catch {
      /* next */
    }
  }

  const shortOnly = buffers.filter((b) => !b.long);
  const useList = shortOnly.length > 0 ? shortOnly : buffers;
  if (useList.length === 0) return createHtmlPool();

  const sounds = Array.from({ length: 6 }, () => new THREE.Audio(activeListener));
  let poolIndex = 0;
  let shotIndex = 0;
  let volume = getAudioVolume();
  subscribe(({ audioVolume }) => {
    volume = audioVolume;
  });

  function play() {
    const ctx = activeListener.context;
    if (ctx?.state === "suspended") void ctx.resume();
    const entry = useList[shotIndex++ % useList.length];
    const sound = sounds[poolIndex++ % sounds.length];
    if (sound.isPlaying) sound.stop();
    sound.setBuffer(entry.buffer);
    sound.setPlaybackRate(0.92 + Math.random() * 0.16);
    sound.setVolume(Math.max(0.2, volume) * VOLUME_SCALE);
    sound.play();
    if (entry.long) {
      window.setTimeout(() => {
        if (sound.isPlaying) sound.stop();
      }, LONG_CLIP_DURATION * 1000);
    }
  }

  return { play, setEnabled() {}, dispose() {} };
}

function createHtmlPool() {
  const elements = SHOT_URLS.map((url) => {
    const a = new Audio();
    a.preload = "auto";
    a.src = url;
    a.load();
    return a;
  });
  let idx = 0;
  let volume = Math.max(0.4, getAudioVolume());
  let unlocked = false;
  subscribe(({ audioVolume }) => {
    volume = Math.max(0.4, audioVolume);
  });

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    const a = elements[0];
    if (!a) return;
    a.volume = 0.01;
    void a.play().then(() => {
      a.pause();
      a.currentTime = 0;
    }).catch(() => {});
  }

  function play() {
    unlock();
    const base = elements[idx++ % elements.length];
    if (!base) return;
    try {
      const a = base.cloneNode();
      a.src = base.src;
      a.volume = Math.min(1, volume * VOLUME_SCALE);
      a.playbackRate = 0.92 + Math.random() * 0.16;
      a.addEventListener("loadedmetadata", () => {
        if (a.duration > 1) {
          window.setTimeout(() => a.pause(), LONG_CLIP_DURATION * 1000);
        }
      }, { once: true });
      void a.play().catch(() => {});
    } catch {
      /* */
    }
  }

  return { play, setEnabled() {}, dispose() {} };
}
