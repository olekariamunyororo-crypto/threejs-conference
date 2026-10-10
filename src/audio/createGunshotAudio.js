/**
 * M4 gunshot one-shots from public/m4.wav (or short mp3 clips).
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

const POOL_SIZE = 6;
const VOLUME_SCALE = 0.85;
const LONG_CLIP_DURATION = 0.32;

export async function createGunshotAudio({ listener, camera } = {}) {
  let activeListener = listener;

  if (!activeListener && camera) {
    activeListener = new THREE.AudioListener();
    camera.add(activeListener);
  }

  if (!activeListener) {
    return createHtmlFallback();
  }

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
      /* try next */
    }
  }

  const shortOnly = buffers.filter((b) => !b.long);
  const useList = shortOnly.length > 0 ? shortOnly : buffers;

  if (useList.length === 0) {
    console.warn(
      "[audio] No gunshot files found. Add public/m4.wav or public/m4-shot.mp3",
    );
    return createHtmlFallback();
  }

  console.info(
    "[audio] Gunshots loaded:",
    useList.map((b) => b.url).join(", "),
  );

  const sounds = Array.from(
    { length: POOL_SIZE },
    () => new THREE.Audio(activeListener),
  );

  let poolIndex = 0;
  let shotIndex = 0;
  let enabled = true;
  let volume = getAudioVolume();

  const unsub = subscribe(({ audioVolume }) => {
    volume = audioVolume;
  });

  function play() {
    if (!enabled) return;

    const entry = useList[shotIndex++ % useList.length];
    const sound = sounds[poolIndex++ % POOL_SIZE];

    if (sound.isPlaying) sound.stop();

    sound.setBuffer(entry.buffer);
    sound.setPlaybackRate(0.92 + Math.random() * 0.16);
    sound.setVolume(volume * VOLUME_SCALE);

    if (entry.long) {
      sound.play();
      window.setTimeout(() => {
        if (sound.isPlaying) sound.stop();
      }, LONG_CLIP_DURATION * 1000);
    } else {
      sound.play();
    }
  }

  function setEnabled(v) {
    enabled = Boolean(v);
  }

  function dispose() {
    unsub?.();
    for (const s of sounds) {
      if (s.isPlaying) s.stop();
      s.disconnect();
    }
  }

  return { play, setEnabled, dispose };
}

function createHtmlFallback() {
  const urls = ["/m4-shot.mp3", "/m4-shot-01.mp3", "/m4.wav"];
  const pool = [];
  let idx = 0;
  let volume = getAudioVolume();

  for (const url of urls) {
    const a = new Audio(url);
    a.preload = "auto";
    pool.push(a);
  }

  subscribe(({ audioVolume }) => {
    volume = audioVolume;
  });

  function play() {
    const base = pool[idx++ % pool.length];
    if (!base) return;
    try {
      const a = base.cloneNode();
      a.volume = Math.min(1, volume * VOLUME_SCALE);
      a.playbackRate = 0.92 + Math.random() * 0.16;
      a.addEventListener(
        "loadedmetadata",
        () => {
          if (a.duration > 1) {
            window.setTimeout(() => a.pause(), LONG_CLIP_DURATION * 1000);
          }
        },
        { once: true },
      );
      void a.play().catch(() => {});
    } catch {
      /* autoplay */
    }
  }

  return { play, setEnabled() {}, dispose() {} };
}
