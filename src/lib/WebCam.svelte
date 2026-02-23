<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte'

  // ── Props ──────────────────────────────────────────────
  export let isRecording = false   // drives the red ring pulse

  // ── Internals ─────────────────────────────────────────
  const dispatch = createEventDispatcher()

  let videoEl
  let webcamStream = null
  let error = null

  // Controls
  let mirrored = true
  let shape = 'circle'             // 'circle' | 'rounded'
  let size = 'md'                  // 'sm' | 'md' | 'lg'
  let showControls = false
  let hoverTimeout

  const sizes = { sm: 140, md: 200, lg: 280 }
  $: px = sizes[size]

  // ── Drag + corner snap ─────────────────────────────────
  let pipEl
  let dragging = false
  let ox = 0, oy = 0

  // Corner: 'br' | 'bl' | 'tr' | 'tl'  (default bottom-right)
  let corner = 'br'
  const MARGIN = 24

  // During drag we use free x/y; at rest we use corner CSS
  let freeX = null
  let freeY = null
  let isDragged = false   // true once the user has manually moved it

  function onMousedown(e) {
    // if (e.target.closest('.pip-controls')) return
    dragging = true
    isDragged = true
    const rect = pipEl.getBoundingClientRect()
    ox = e.clientX - rect.left
    oy = e.clientY - rect.top
    freeX = rect.left
    freeY = rect.top
    window.addEventListener('mousemove', onMousemove)
    window.addEventListener('mouseup', onMouseup)
  }

  function onMousemove(e) {
    if (!dragging) return
    freeX = e.clientX - ox
    freeY = e.clientY - oy
  }

  function onMouseup(e) {
    dragging = false
    window.removeEventListener('mousemove', onMousemove)
    window.removeEventListener('mouseup', onMouseup)

    // Snap: determine which corner the element is closest to
    const cx = freeX + px / 2
    const cy = freeY + px / 2
    const midX = window.innerWidth / 2
    const midY = window.innerHeight / 2
    corner = `${cy < midY ? 't' : 'b'}${cx < midX ? 'l' : 'r'}`
    freeX = null
    freeY = null
  }

  // Build position style
  $: posStyle = (() => {
    if (freeX !== null) {
      return `left:${freeX}px; top:${freeY}px; right:auto; bottom:auto;`
    }
    const m = `${MARGIN}px`
    const map = {
      br: `right:${m}; bottom:${m}; left:auto; top:auto;`,
      bl: `left:${m}; bottom:${m}; right:auto; top:auto;`,
      tr: `right:${m}; top:${m}; left:auto; bottom:auto;`,
      tl: `left:${m}; top:${m}; right:auto; bottom:auto;`,
    }
    return map[corner]
  })()

  // ── Webcam ────────────────────────────────────────────
  onMount(async () => {
    try {
      webcamStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false
      })
      if (videoEl) {
        videoEl.srcObject = webcamStream
        videoEl.play()
      }
      dispatch('stream', webcamStream)
    } catch (err) {
      error = 'Camera access denied'
      console.error(err)
    }
  })

  onDestroy(() => {
    webcamStream?.getTracks().forEach(t => t.stop())
  })

  export function getStream() {
    return webcamStream
  }

  // ── Hover controls ─────────────────────────────────────
  function onMouseenter() {
    clearTimeout(hoverTimeout)
    showControls = true
  }

  function onMouseleave() {
    hoverTimeout = setTimeout(() => { showControls = false }, 600)
  }

  function cycleSize() {
    size = size === 'sm' ? 'md' : size === 'md' ? 'lg' : 'sm'
  }

  function close() {
    webcamStream?.getTracks().forEach(t => t.stop())
    dispatch('close')
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="pip-wrap"
  class:recording={isRecording}
  class:dragging
  class:circle={shape === 'circle'}
  class:mirrored
  style="{posStyle} --px:{px}px;"
  bind:this={pipEl}
  on:mousedown={onMousedown}
  on:mouseenter={onMouseenter}
  on:mouseleave={onMouseleave}
>
  <!-- Recording ring (outer glow layer, CSS animated) -->
  {#if isRecording}
    <span class="rec-ring"></span>
  {/if}

  <!-- Video -->
  {#if error}
    <div class="pip-error">{error}</div>
  {:else}
    <video bind:this={videoEl} muted playsinline class="pip-video"></video>
  {/if}

  <!-- Hover controls -->
  <div class="pip-controls" class:visible={showControls}>
    <!-- Mirror -->
    <button class="ctrl-btn" title="Flip" on:click={() => mirrored = !mirrored}>
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
        <path d="M8 2v12M3 5l-2 3 2 3M13 5l2 3-2 3"/>
      </svg>
    </button>

    <!-- Shape toggle -->
    <button class="ctrl-btn" title="Toggle shape" on:click={() => shape = shape === 'circle' ? 'rounded' : 'circle'}>
      {#if shape === 'circle'}
        <!-- Square icon -->
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
          <rect x="2.5" y="2.5" width="11" height="11" rx="2.5"/>
        </svg>
      {:else}
        <!-- Circle icon -->
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
          <circle cx="8" cy="8" r="5.5"/>
        </svg>
      {/if}
    </button>

    <!-- Size cycle -->
    <button class="ctrl-btn" title="Resize" on:click={cycleSize}>
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
        <path d="M2 14l4-4M14 2l-4 4M2 14h4v-4M14 2h-4v4"/>
      </svg>
    </button>

    <!-- Close -->
    <button class="ctrl-btn ctrl-btn-close" title="Close webcam" on:click={close}>
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M4 4l8 8M12 4l-8 8"/>
      </svg>
    </button>
  </div>

  <!-- Drag cursor hint -->
  <div class="drag-zone"></div>
</div>

<style>
  .pip-wrap {
    position: fixed;
    z-index: 10000;
    width: var(--px);
    height: var(--px);

    border-radius: 18px;
    overflow: hidden;

    box-shadow:
      0 8px 40px rgba(0,0,0,0.55),
      0 0 0 2px rgba(255,255,255,0.1);

    cursor: grab;
    transition:
      width 0.3s cubic-bezier(.34,1.56,.64,1),
      height 0.3s cubic-bezier(.34,1.56,.64,1),
      border-radius 0.3s ease,
      box-shadow 0.25s ease;

    /* Entry animation */
    animation: pip-enter 0.35s cubic-bezier(.34,1.4,.64,1) both;
  }

  @keyframes pip-enter {
    from { opacity: 0; transform: scale(0.6); }
    to   { opacity: 1; transform: scale(1); }
  }

  .pip-wrap.circle {
    border-radius: 50%;
  }

  .pip-wrap.dragging {
    cursor: grabbing;
    box-shadow:
      0 20px 60px rgba(0,0,0,0.7),
      0 0 0 2px rgba(255,255,255,0.18);
    transform: scale(1.03);
    transition: transform 0.1s ease, box-shadow 0.1s ease;
  }

  /* Recording ring */
  .rec-ring {
    position: absolute;
    inset: -4px;
    border-radius: inherit;
    border: 3px solid #ef4444;
    z-index: 2;
    pointer-events: none;
    animation: rec-pulse 1.8s ease-in-out infinite;
  }

  @keyframes rec-pulse {
    0%, 100% { opacity: 1;   box-shadow: 0 0 0 0   rgba(239,68,68,0.5); }
    50%       { opacity: 0.7; box-shadow: 0 0 0 8px rgba(239,68,68,0);   }
  }

  /* Video */
  .pip-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    background: #0a0a0f;
  }

  .pip-wrap.mirrored .pip-video {
    transform: scaleX(-1);
  }

  /* Error state */
  .pip-error {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(15,15,25,0.92);
    color: #94a3b8;
    font-size: 0.75rem;
    font-family: 'JetBrains Mono', monospace;
    text-align: center;
    padding: 1rem;
  }

  /* Controls overlay */
  .pip-controls {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    background: rgba(0,0,0,0.52);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    z-index: 3;
    border-radius: inherit;

    opacity: 0;
    pointer-events: none;
    transition: opacity 0.18s ease;
  }

  .pip-controls.visible {
    opacity: 1;
    pointer-events: all;
  }

  .ctrl-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.15);
    background: rgba(255,255,255,0.1);
    color: #e2e8f0;
    cursor: pointer;
    transition: all 0.15s ease;
    padding: 0;
    flex-shrink: 0;
  }

  .ctrl-btn svg {
    width: 15px;
    height: 15px;
    pointer-events: none;
  }

  .ctrl-btn:hover {
    background: rgba(255,255,255,0.22);
    border-color: rgba(255,255,255,0.3);
    transform: scale(1.1);
  }

  .ctrl-btn:active {
    transform: scale(0.93);
  }

  .ctrl-btn-close {
    border-color: rgba(239,68,68,0.35);
    background: rgba(239,68,68,0.15);
    color: #fca5a5;
  }

  .ctrl-btn-close:hover {
    background: rgba(239,68,68,0.35);
    border-color: rgba(239,68,68,0.6);
    color: #fff;
  }

  /* Invisible drag zone sits below controls */
  .drag-zone {
    position: absolute;
    inset: 0;
    z-index: 1;
    cursor: grab;
  }
</style>