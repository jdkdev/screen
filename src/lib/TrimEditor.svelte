<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte'
  import { FFmpeg } from '@ffmpeg/ffmpeg'
  import { fetchFile, toBlobURL } from '@ffmpeg/util'

  // ── Props ──────────────────────────────────────────────
  export let blob = null   // the recorded Blob (webm)

  const dispatch = createEventDispatcher()

  // ── Video / duration ───────────────────────────────────
  let videoEl
  let duration = 0
  let currentTime = 0
  let isPlaying = false

  // ── Trim handles (0–1 normalised) ─────────────────────
  let inPoint  = 0
  let outPoint = 1

  $: inSec  = inPoint  * duration
  $: outSec = outPoint * duration
  $: trimDuration = outSec - inSec

  // ── Timeline DOM ───────────────────────────────────────
  let timelineEl
  let thumbnails = []       // array of dataURLs
  const THUMB_COUNT = 10

  // ── Playhead (0–1 normalised) ─────────────────────────
  $: playhead = duration ? currentTime / duration : 0

  // ── FFmpeg state ──────────────────────────────────────
  let ffmpeg = null
  let ffmpegReady = false
  let ffmpegLoading = false
  let isTrimming = false
  let trimProgress = 0       // 0–100
  let trimError = null

  // ── Drag state ────────────────────────────────────────
  let dragging = null        // 'in' | 'out' | 'playhead' | null

  // ── Object URL for the blob ───────────────────────────
  let blobUrl = null

  onMount(async () => {
    if (!blob) return
    blobUrl = URL.createObjectURL(blob)
    videoEl.src = blobUrl
    videoEl.load()
  })

  onDestroy(() => {
    if (blobUrl) URL.revokeObjectURL(blobUrl)
  })

  // ─────────────────────────────────────────────────────
  // Video events
  // ─────────────────────────────────────────────────────
  function onMetadata() {
    duration = videoEl.duration
    outPoint = 1
    generateThumbnails()
  }

  function onTimeUpdate() {
    currentTime = videoEl.currentTime
    // Stop at outPoint during trim preview
    if (isPlaying && currentTime >= outSec) {
      videoEl.pause()
      isPlaying = false
    }
  }

  function togglePlay() {
    if (isPlaying) {
      videoEl.pause()
      isPlaying = false
    } else {
      // If at or past outPoint, restart from inPoint
      if (videoEl.currentTime >= outSec || videoEl.currentTime < inSec) {
        videoEl.currentTime = inSec
      }
      videoEl.play()
      isPlaying = true
    }
  }

  // ─────────────────────────────────────────────────────
  // Thumbnails
  // ─────────────────────────────────────────────────────
  async function generateThumbnails() {
    thumbnails = []
    const canvas = document.createElement('canvas')
    canvas.width  = 160
    canvas.height = 90
    const ctx = canvas.getContext('2d')
    const tmp = document.createElement('video')
    tmp.src = blobUrl
    tmp.muted = true
    await new Promise(r => { tmp.onloadedmetadata = r })

    for (let i = 0; i < THUMB_COUNT; i++) {
      const t = (i / (THUMB_COUNT - 1)) * duration
      tmp.currentTime = t
      await new Promise(r => { tmp.onseeked = r })
      ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height)
      thumbnails = [...thumbnails, canvas.toDataURL('image/jpeg', 0.6)]
    }
    tmp.src = ''
  }

  // ─────────────────────────────────────────────────────
  // Timeline drag
  // ─────────────────────────────────────────────────────
  function getTimelineRatio(clientX) {
    const rect = timelineEl.getBoundingClientRect()
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }

  function startDragIn(e)       { dragging = 'in';       window.addEventListener('mousemove', onDrag); window.addEventListener('mouseup', stopDrag) }
  function startDragOut(e)      { dragging = 'out';      window.addEventListener('mousemove', onDrag); window.addEventListener('mouseup', stopDrag) }
  function startDragPlayhead(e) { dragging = 'playhead'; window.addEventListener('mousemove', onDrag); window.addEventListener('mouseup', stopDrag) }

  function onDrag(e) {
    if (!dragging || !timelineEl) return
    const r = getTimelineRatio(e.clientX)
    if (dragging === 'in') {
      inPoint = Math.min(r, outPoint - 0.01)
      videoEl.currentTime = inSec
    } else if (dragging === 'out') {
      outPoint = Math.max(r, inPoint + 0.01)
      videoEl.currentTime = outSec
    } else if (dragging === 'playhead') {
      videoEl.currentTime = r * duration
    }
  }

  function stopDrag() {
    dragging = null
    window.removeEventListener('mousemove', onDrag)
    window.removeEventListener('mouseup', stopDrag)
  }

  function onTimelineClick(e) {
    if (dragging) return
    const r = getTimelineRatio(e.clientX)
    videoEl.currentTime = r * duration
  }

  // ─────────────────────────────────────────────────────
  // FFmpeg load (lazy — only when user hits Apply)
  // ─────────────────────────────────────────────────────
  async function loadFFmpeg() {
    if (ffmpegReady) return
    ffmpegLoading = true
    ffmpeg = new FFmpeg()
    ffmpeg.on('progress', ({ progress }) => {
      trimProgress = Math.round(progress * 100)
    })
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
    await ffmpeg.load({
      coreURL:   await toBlobURL(`${baseURL}/ffmpeg-core.js`,   'text/javascript'),
      wasmURL:   await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    ffmpegReady = true
    ffmpegLoading = false
  }

  // ─────────────────────────────────────────────────────
  // Apply trim
  // ─────────────────────────────────────────────────────
  async function applyTrim() {
    trimError = null
    isTrimming = true
    trimProgress = 0

    try {
      await loadFFmpeg()

      const inputData = await fetchFile(blob)
      await ffmpeg.writeFile('input.webm', inputData)

      const startArg = inSec.toFixed(3)
      const durationArg = trimDuration.toFixed(3)

      await ffmpeg.exec([
        '-ss', startArg,
        '-i', 'input.webm',
        '-t', durationArg,
        '-c', 'copy',
        'output.webm'
      ])

      const outputData = await ffmpeg.readFile('output.webm')
      const trimmedBlob = new Blob([outputData], { type: 'video/webm' })

      dispatch('trimmed', trimmedBlob)
    } catch (err) {
      console.error(err)
      trimError = 'Trim failed — see console for details.'
    } finally {
      isTrimming = false
    }
  }

  // ─────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────
  function fmt(s) {
    if (!isFinite(s)) return '0:00.0'
    const m   = Math.floor(s / 60)
    const sec = (s % 60).toFixed(1).padStart(4, '0')
    return `${m}:${sec}`
  }
</script>

<div class="trim-editor">

  <!-- ── Video preview ── -->
  <div class="video-preview">
    <video
      bind:this={videoEl}
      on:loadedmetadata={onMetadata}
      on:timeupdate={onTimeUpdate}
      on:ended={() => isPlaying = false}
      class="preview-video"
      playsinline
    ></video>
  </div>

  <!-- ── Timeline ── -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="timeline-wrap">

    <!-- Timecode bar -->
    <div class="timecodes">
      <span class="tc in-tc">{fmt(inSec)}</span>
      <span class="tc current-tc">{fmt(currentTime)}</span>
      <span class="tc dur-tc">–{fmt(trimDuration)}</span>
      <span class="tc out-tc">{fmt(outSec)}</span>
    </div>

    <!-- Main timeline track -->
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div
      class="timeline"
      bind:this={timelineEl}
      on:click={onTimelineClick}
    >
      <!-- Thumbnail strip -->
      <div class="thumb-strip">
        {#each thumbnails as src}
          <img {src} alt="" class="thumb" draggable="false" />
        {/each}
        {#if thumbnails.length === 0}
          <div class="thumb-loading">
            {#each Array(THUMB_COUNT) as _}
              <div class="thumb-placeholder"></div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Cut-out overlays (dark regions outside selection) -->
      <div class="cutout cutout-left"  style="width:{inPoint * 100}%"></div>
      <div class="cutout cutout-right" style="width:{(1 - outPoint) * 100}%"></div>

      <!-- Selection bracket -->
      <div
        class="selection"
        style="left:{inPoint * 100}%; width:{(outPoint - inPoint) * 100}%"
      ></div>

      <!-- In handle -->
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <div
        class="handle handle-in"
        style="left:{inPoint * 100}%"
        on:mousedown|stopPropagation={startDragIn}
      >
        <div class="handle-grip">
          <span></span><span></span><span></span>
        </div>
      </div>

      <!-- Out handle -->
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <div
        class="handle handle-out"
        style="left:{outPoint * 100}%"
        on:mousedown|stopPropagation={startDragOut}
      >
        <div class="handle-grip">
          <span></span><span></span><span></span>
        </div>
      </div>

      <!-- Playhead -->
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <div
        class="playhead"
        style="left:{playhead * 100}%"
        on:mousedown|stopPropagation={startDragPlayhead}
      >
        <div class="playhead-head"></div>
        <div class="playhead-line"></div>
      </div>
    </div>
  </div>

  <!-- ── Controls ── -->
  <div class="controls-row">
    <div class="left-controls">
      <!-- Play/Pause -->
      <button class="ctrl-btn play-btn" on:click={togglePlay} title={isPlaying ? 'Pause' : 'Play trim preview'}>
        {#if isPlaying}
          <svg viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2" width="4" height="12" rx="1"/><rect x="9" y="2" width="4" height="12" rx="1"/></svg>
        {:else}
          <svg viewBox="0 0 16 16" fill="currentColor"><path d="M3 2.5l10 5.5-10 5.5V2.5z"/></svg>
        {/if}
      </button>

      <!-- Reset handles -->
      <button class="ctrl-btn reset-btn" on:click={() => { inPoint = 0; outPoint = 1 }} title="Reset trim">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M2 8a6 6 0 1 0 1.5-3.9M2 4v4h4"/>
        </svg>
      </button>
    </div>

    <div class="right-controls">
      {#if trimError}
        <span class="error-msg">{trimError}</span>
      {/if}

      {#if isTrimming}
        <div class="progress-wrap">
          <div class="progress-bar" style="width:{trimProgress}%"></div>
          <span class="progress-label">{trimProgress}%</span>
        </div>
      {:else if ffmpegLoading}
        <span class="loading-msg">Loading ffmpeg...</span>
      {:else}
        <button class="apply-btn" on:click={applyTrim} disabled={trimDuration <= 0}>
          Apply Trim
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M2 8h9M8 4l5 4-5 4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  /* ── Fonts ── */
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap');

  /* ── Container ── */
  .trim-editor {
    background: #0d0d14;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 16px;
    overflow: hidden;
    font-family: 'IBM Plex Sans', sans-serif;
    color: #e2e8f0;
    user-select: none;
  }

  /* ── Video preview ── */
  .video-preview {
    background: #000;
    aspect-ratio: 16 / 9;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .preview-video {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }

  /* ── Timeline wrapper ── */
  .timeline-wrap {
    padding: 1rem 1.25rem 0.5rem;
    background: #0a0a10;
  }

  /* ── Timecodes ── */
  .timecodes {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.7rem;
    letter-spacing: 0.03em;
  }

  .tc { color: #475569; }
  .in-tc  { color: #f59e0b; }
  .out-tc { color: #f59e0b; }
  .current-tc { color: #94a3b8; }
  .dur-tc { color: #64748b; }

  /* ── Timeline track ── */
  .timeline {
    position: relative;
    height: 52px;
    border-radius: 6px;
    overflow: hidden;
    cursor: crosshair;
    margin-bottom: 0.625rem;
    isolation: isolate;
  }

  /* ── Thumbnail strip ── */
  .thumb-strip {
    position: absolute;
    inset: 0;
    display: flex;
    border-radius: 6px;
    overflow: hidden;
  }

  .thumb {
    flex: 1;
    min-width: 0;
    height: 100%;
    object-fit: cover;
    object-position: center;
    display: block;
    pointer-events: none;
    filter: brightness(0.75);
  }

  .thumb-loading {
    display: flex;
    width: 100%;
    gap: 1px;
  }

  .thumb-placeholder {
    flex: 1;
    background: linear-gradient(
      90deg,
      rgba(255,255,255,0.04) 25%,
      rgba(255,255,255,0.08) 50%,
      rgba(255,255,255,0.04) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
  }

  @keyframes shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* ── Cut overlays ── */
  .cutout {
    position: absolute;
    top: 0;
    bottom: 0;
    background: rgba(0,0,0,0.72);
    z-index: 1;
    pointer-events: none;
  }

  .cutout-left  { left: 0; }
  .cutout-right { right: 0; }

  /* ── Selection bracket ── */
  .selection {
    position: absolute;
    top: 0;
    bottom: 0;
    border-top: 2px solid #f59e0b;
    border-bottom: 2px solid #f59e0b;
    background: rgba(245, 158, 11, 0.08);
    z-index: 2;
    pointer-events: none;
  }

  /* ── Handles ── */
  .handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 14px;
    z-index: 4;
    cursor: ew-resize;
    transform: translateX(-50%);
  }

  .handle-in  { border-left:  3px solid #f59e0b; border-radius: 3px 0 0 3px; }
  .handle-out { border-right: 3px solid #f59e0b; border-radius: 0 3px 3px 0; }

  .handle-grip {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    gap: 2.5px;
  }

  .handle-grip span {
    display: block;
    width: 2px;
    height: 2px;
    border-radius: 50%;
    background: #f59e0b;
    opacity: 0.9;
  }

  /* ── Playhead ── */
  .playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    z-index: 5;
    transform: translateX(-50%);
    cursor: col-resize;
  }

  .playhead-head {
    position: absolute;
    top: -2px;
    left: 50%;
    transform: translateX(-50%);
    width: 10px;
    height: 10px;
    background: #fff;
    border-radius: 50%;
    box-shadow: 0 0 6px rgba(255,255,255,0.6);
  }

  .playhead-line {
    position: absolute;
    top: 8px;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 1.5px;
    background: rgba(255,255,255,0.75);
  }

  /* ── Controls row ── */
  .controls-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.25rem 1rem;
    background: #0a0a10;
    gap: 1rem;
  }

  .left-controls,
  .right-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* ── Icon buttons ── */
  .ctrl-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.06);
    color: #cbd5e1;
    cursor: pointer;
    transition: all 0.15s ease;
    padding: 0;
    flex-shrink: 0;
  }

  .ctrl-btn svg {
    width: 14px;
    height: 14px;
    pointer-events: none;
  }

  .ctrl-btn:hover {
    background: rgba(255,255,255,0.13);
    color: #fff;
    border-color: rgba(255,255,255,0.2);
  }

  .ctrl-btn:active { transform: scale(0.93); }

  .play-btn {
    background: rgba(245,158,11,0.12);
    border-color: rgba(245,158,11,0.3);
    color: #fcd34d;
  }

  .play-btn:hover {
    background: rgba(245,158,11,0.25);
    border-color: rgba(245,158,11,0.55);
    color: #fff;
  }

  /* ── Apply button ── */
  .apply-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1.125rem;
    border-radius: 8px;
    border: 1px solid rgba(245,158,11,0.4);
    background: rgba(245,158,11,0.14);
    color: #fcd34d;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .apply-btn svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  .apply-btn:hover:not(:disabled) {
    background: rgba(245,158,11,0.26);
    border-color: rgba(245,158,11,0.65);
    color: #fff;
    box-shadow: 0 0 16px rgba(245,158,11,0.2);
  }

  .apply-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  /* ── Progress ── */
  .progress-wrap {
    position: relative;
    width: 160px;
    height: 6px;
    background: rgba(255,255,255,0.07);
    border-radius: 999px;
    overflow: hidden;
    display: flex;
    align-items: center;
  }

  .progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #f59e0b, #fbbf24);
    border-radius: 999px;
    transition: width 0.1s linear;
  }

  .progress-label {
    position: absolute;
    right: -32px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.7rem;
    color: #94a3b8;
    white-space: nowrap;
  }

  /* ── Status text ── */
  .loading-msg {
    font-size: 0.8rem;
    color: #64748b;
    font-family: 'IBM Plex Mono', monospace;
  }

  .error-msg {
    font-size: 0.8rem;
    color: #f87171;
    font-family: 'IBM Plex Mono', monospace;
  }
</style>