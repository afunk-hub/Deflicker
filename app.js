import { FFmpeg } from "./vendor/ffmpeg/esm/index.js";
import { toBlobURL } from "./vendor/util/esm/index.js";

const $ = (id) => document.getElementById(id);
const els = {
  input: $("videoInput"), drop: $("dropZone"), prompt: $("filePrompt"), subtext: $("fileSubtext"),
  details: $("fileDetails"), previewWrap: $("inputPreviewWrap"), preview: $("inputPreview"),
  strength: $("strength"), strengthLabel: $("strengthLabel"), smoothColor: $("smoothColor"),
  keepAudio: $("keepAudio"), quality: $("quality"), outputName: $("outputName"),
  process: $("processBtn"), progressPanel: $("progressPanel"), progressTitle: $("progressTitle"),
  percent: $("progressPercent"), bar: $("progressBar"), message: $("progressMessage"),
  cancel: $("cancelBtn"), resultPanel: $("resultPanel"), output: $("outputPreview"),
  stats: $("resultStats"), download: $("downloadBtn"), reset: $("resetBtn"),
  errorPanel: $("errorPanel"), errorMessage: $("errorMessage"), dismissError: $("dismissError")
};

let selectedFile = null;
let ffmpeg = null;
let engineLoaded = false;
let processing = false;
let cancelRequested = false;
let outputUrl = null;
let inputUrl = null;
let runStartedAt = 0;

const strengthSettings = {
  1: { size: 5, label: "Gentle" },
  2: { size: 10, label: "Balanced" },
  3: { size: 15, label: "Strong" }
};

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "Unknown size";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = bytes, i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
function safeBaseName(name) {
  return (name || "video").replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 65) || "video";
}
function setProgress(p, message) {
  const val = Math.max(0, Math.min(100, Math.round(p)));
  els.percent.textContent = `${val}%`;
  els.bar.style.width = `${val}%`;
  if (message) els.message.textContent = message;
}
function showError(message) {
  els.errorMessage.textContent = message;
  els.errorPanel.classList.remove("hidden");
}
function clearError() { els.errorPanel.classList.add("hidden"); }
function resetProgress() {
  els.progressPanel.classList.add("hidden");
  els.resultPanel.classList.add("hidden");
  els.process.disabled = !selectedFile;
  els.process.innerHTML = "<span>✦</span> Correct flicker";
}
function setSelectedFile(file) {
  if (!file) return;
  if (processing) return;
  clearError();
  if (outputUrl) { URL.revokeObjectURL(outputUrl); outputUrl = null; }
  selectedFile = file;
  if (inputUrl) URL.revokeObjectURL(inputUrl);
  inputUrl = URL.createObjectURL(file);
  els.prompt.textContent = file.name;
  els.subtext.textContent = "Selected and ready to process";
  els.details.classList.remove("hidden");
  els.details.innerHTML = "";
  const name = document.createElement("span"); name.textContent = file.name;
  const size = document.createElement("strong"); size.textContent = formatBytes(file.size);
  els.details.append(name, size);
  els.preview.src = inputUrl;
  els.previewWrap.classList.remove("hidden");
  els.outputName.value = `${safeBaseName(file.name)}-deflickered.mp4`;
  els.process.disabled = false;
  els.resultPanel.classList.add("hidden");
  els.progressPanel.classList.add("hidden");
  if (file.size > 500 * 1024 * 1024) {
    showError("This file is larger than 500 MB. The app will still let you try, but memory requirements may be too high for your phone.");
  }
}
els.input.addEventListener("change", (e) => setSelectedFile(e.target.files?.[0]));
els.drop.addEventListener("dragover", e => { e.preventDefault(); els.drop.classList.add("dragging"); });
els.drop.addEventListener("dragleave", () => els.drop.classList.remove("dragging"));
els.drop.addEventListener("drop", e => { e.preventDefault(); els.drop.classList.remove("dragging"); setSelectedFile(e.dataTransfer?.files?.[0]); });
els.strength.addEventListener("input", () => { els.strengthLabel.textContent = strengthSettings[els.strength.value].label; });

async function ensureEngine() {
  if (engineLoaded && ffmpeg) return;
  setProgress(2, "Loading the local video engine. The first load needs an internet connection…");
  ffmpeg = new FFmpeg();
  ffmpeg.on("log", ({ message }) => {
    if (!message) return;
    const match = message.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (match && processing) {
      const elapsed = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
      if (selectedFile?.duration && Number.isFinite(selectedFile.duration)) {
        setProgress(Math.min(94, Math.max(8, elapsed / selectedFile.duration * 90)), "Correcting frames locally…");
      } else {
        els.message.textContent = "Correcting frames locally… FFmpeg is processing the video.";
      }
    }
  });
  ffmpeg.on("progress", ({ progress }) => {
    if (processing && Number.isFinite(progress)) setProgress(8 + Math.max(0, Math.min(0.88, progress)) * 85, "Correcting frames locally…");
  });
  const corePath = new URL("./vendor/core/ffmpeg-core.js", import.meta.url).href;
  const wasmPath = new URL("./vendor/core/ffmpeg-core.wasm", import.meta.url).href;
  const coreURL = await toBlobURL(corePath, "text/javascript");
  const wasmURL = await toBlobURL(wasmPath, "application/wasm");
  await ffmpeg.load({ coreURL, wasmURL });
  engineLoaded = true;
}

function makeFilter() {
  const strength = strengthSettings[els.strength.value];
  const filters = [`deflicker=size=${strength.size}:mode=am`];
  if (els.smoothColor.checked) {
    // Deliberately mild frame blending; this is optional because moving subjects can ghost.
    filters.push("tmix=frames=3:weights='1 2 1'");
  }
  return filters.join(",");
}

async function processVideo() {
  if (!selectedFile || processing) return;
  processing = true;
  cancelRequested = false;
  clearError();
  els.process.disabled = true;
  els.cancel.disabled = false;
  els.progressPanel.classList.remove("hidden");
  els.resultPanel.classList.add("hidden");
  els.progressTitle.textContent = "Processing video";
  setProgress(0, "Preparing local processing engine…");
  runStartedAt = Date.now();
  const inputName = `input-${Date.now()}.${(selectedFile.name.split(".").pop() || "mp4").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8)}`;
  let outputName = (els.outputName.value.trim() || "prairie-preludes-deflickered.mp4").replace(/[^a-zA-Z0-9._-]/g, "-");
  if (!outputName.toLowerCase().endsWith(".mp4")) outputName += ".mp4";
  outputName = `out-${Date.now()}.mp4`;
  try {
    await ensureEngine();
    if (cancelRequested) throw new Error("Processing stopped.");
    setProgress(5, "Reading the selected video into local processing memory…");
    const bytes = new Uint8Array(await selectedFile.arrayBuffer());
    if (cancelRequested) throw new Error("Processing stopped.");
    await ffmpeg.writeFile(inputName, bytes);
    // Let go of the JS-side reference as soon as FFmpeg has its own copy.
    bytes.fill(0);
    const args = ["-hide_banner", "-y", "-i", inputName, "-vf", makeFilter(), "-c:v", "libx264", "-preset", "ultrafast", "-crf", els.quality.value, "-pix_fmt", "yuv420p", "-movflags", "+faststart"];
    if (els.keepAudio.checked) args.push("-c:a", "aac", "-b:a", "192k");
    else args.push("-an");
    args.push(outputName);
    setProgress(8, "Correcting frames locally…");
    await ffmpeg.exec(args);
    if (cancelRequested) throw new Error("Processing stopped.");
    setProgress(96, "Preparing the corrected video for download…");
    const outputData = await ffmpeg.readFile(outputName);
    const blob = new Blob([outputData], { type: "video/mp4" });
    outputUrl = URL.createObjectURL(blob);
    els.output.src = outputUrl;
    els.download.href = outputUrl;
    const requested = (els.outputName.value.trim() || "prairie-preludes-deflickered.mp4").replace(/[^a-zA-Z0-9._-]/g, "-");
    els.download.download = requested.toLowerCase().endsWith(".mp4") ? requested : `${requested}.mp4`;
    els.stats.textContent = `${formatBytes(selectedFile.size)} original · ${formatBytes(blob.size)} corrected · ${((Date.now() - runStartedAt) / 1000 / 60).toFixed(1)} min elapsed`;
    els.resultPanel.classList.remove("hidden");
    setProgress(100, "Finished. Preview the result before saving.");
    els.progressTitle.textContent = "Correction complete";
    els.cancel.classList.add("hidden");
    els.process.disabled = false;
    els.process.textContent = "Correct again";
    // Keep virtual filesystem tidy.
    try { await ffmpeg.deleteFile(inputName); } catch {}
    try { await ffmpeg.deleteFile(outputName); } catch {}
  } catch (err) {
    console.error(err);
    const msg = String(err?.message || err);
    showError(msg.includes("memory") || msg.includes("OOM") || msg.includes("allocation")
      ? "The phone or browser ran out of memory. This can happen with large video files. Try a shorter or lower-resolution copy, close other apps, and retry."
      : msg.includes("stopped") ? "Processing was stopped. Your original video has not been changed."
      : `The video could not be processed. ${msg.slice(0, 260)}. Try an MP4/H.264 source, or a shorter clip.`);
    els.progressTitle.textContent = "Processing stopped";
    setProgress(0, "No corrected file was created.");
  } finally {
    processing = false;
    els.cancel.disabled = false;
    els.process.disabled = !selectedFile;
    els.process.innerHTML = "<span>✦</span> Correct flicker";
  }
}
els.process.addEventListener("click", processVideo);
els.cancel.addEventListener("click", async () => {
  if (!processing) return;
  cancelRequested = true;
  els.cancel.disabled = true;
  els.message.textContent = "Stopping at the next safe point…";
  // Terminating FFmpeg is immediate but requires reloading its engine next time.
  if (ffmpeg) {
    try { ffmpeg.terminate(); } catch {}
    ffmpeg = null;
    engineLoaded = false;
  }
});
els.dismissError.addEventListener("click", clearError);
els.reset.addEventListener("click", () => {
  if (outputUrl) URL.revokeObjectURL(outputUrl);
  outputUrl = null;
  selectedFile = null;
  els.input.value = "";
  els.prompt.textContent = "Tap to select a time-lapse";
  els.subtext.textContent = "Choose a video from your phone or files";
  els.details.classList.add("hidden");
  els.previewWrap.classList.add("hidden");
  els.preview.removeAttribute("src");
  els.output.removeAttribute("src");
  els.resultPanel.classList.add("hidden");
  els.progressPanel.classList.add("hidden");
  els.process.disabled = true;
  els.process.innerHTML = "<span>✦</span> Correct flicker";
  clearError();
  els.cancel.classList.remove("hidden");
  if (inputUrl) URL.revokeObjectURL(inputUrl);
  inputUrl = null;
});
