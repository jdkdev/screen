<script>
  import { onDestroy } from 'svelte'

  // ── Props ──────────────────────────────────────────────
  export let recorder = null       // MediaRecorder instance
  export let onStop = () => {}     // called when user hits Stop in HUD

  // ── State ─────────────────────────────────────────────
  let isPaused = false
  let elapsed = 0                  // seconds
  let intervalId = null

  // ── Timer ──────────────────────────────────────────────
  // Start ticking as soon as the HUD mounts (recording already running)
  intervalId = setInterval(() => {
    if (!isPaused) elapsed++
  }, 1000)

  onDestroy(() => clearInterval(intervalId))

  function formatTime(s) {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  // ── Controls ───────────────────────────────────────────
  function togglePause() {
    if (!recorder) return
    if (isPaused) {
      recorder.resume()
      isPaused = false
    } else {
      recorder.pause()
      isPaused = true
    }
  }

  function stopRecording() {
    clearInterval(intervalId)
    onStop()
  }

  // ── Drag ───────────────────────────────────────────────
  let hudEl
  let dragging = false
  let ox = 0, oy = 0   // offset within element on mousedown

  // Initial position: bottom-centre-ish, users can drag anywhere
  let x = null
  let y = null

  function onMousedown(e) {
    // Ignore clicks on buttons
    if (e.target.closest('button')) return
    dragging = true
    const rect = hudEl.getBoundingClientRect()
    ox = e.clientX - rect.left
    oy = e.clientY - rect.top
    window.addEventListener('mousemove', onMousemove)
    window.addEventListener('mouseup', onMouseup)
  }

  function onMousemove(e) {
    if (!dragging) return
    x = e.clientX - ox
    y = e.clientY - oy
  }

  function onMouseup() {
    dragging = false
    window.removeEventListener('mousemove', onMousemove)
    window.removeEventListener('mouseup', onMouseup)
  }

  $: posStyle = x !== null
    ? `left:${x}px; top:${y}px; bottom:auto; right:auto;`
    : ''
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="hud"
  class:paused={isPaused}
  class:dragging
  style={posStyle}
  bind:this={hudEl}
  on:mousedown={onMousedown}
>
  <!-- Status dot -->
  <span class="dot" class:dot-paused={isPaused}></span>

  <!-- Timer -->
  <span class="timer">{formatTime(elapsed)}</span>

  <!-- Divider -->
  <span class="divider"></span>

  <!-- Pause / Resume -->
  <button class="hud-btn" title={isPaused ? 'Resume' : 'Pause'} on:click={togglePause}>
    {#if isPaused}
      <!-- Play icon -->
      <svg viewBox="0 0 16 16" fill="currentColor"><path d="M3 2.5l10 5.5-10 5.5V2.5z"/></svg>
    {:else}
      <!-- Pause icon -->
      <svg viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2" width="4" height="12" rx="1"/><rect x="9" y="2" width="4" height="12" rx="1"/></svg>
    {/if}
  </button>

  <!-- Stop -->
  <button class="hud-btn hud-btn-stop" title="Stop recording" on:click={stopRecording}>
    <svg viewBox="0 0 16 16" fill="currentColor"><rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/></svg>
  </button>

  <!-- Drag handle hint -->
  <span class="drag-hint" title="Drag to move">
    <svg viewBox="0 0 16 16" fill="currentColor" opacity=".45"><circle cx="5.5" cy="5" r="1.2"/><circle cx="10.5" cy="5" r="1.2"/><circle cx="5.5" cy="11" r="1.2"/><circle cx="10.5" cy="11" r="1.2"/><circle cx="5.5" cy="8" r="1.2"/><circle cx="10.5" cy="8" r="1.2"/></svg>
  </span>
</div>

<style>
  /* ── Positioning ── */
  .hud {
    position: fixed;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;

    /* Layout */
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.875rem 0.5rem 0.75rem;

    /* Glass pill */
    background: rgba(10, 10, 18, 0.82);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 999px;
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.55),
      0 1px 0 rgba(255,255,255,0.06) inset,
      0 0 0 1px rgba(239, 68, 68, 0.15);

    /* Type */
    font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
    font-size: 0.8125rem;
    color: #e2e8f0;
    user-select: none;

    cursor: grab;
    transition:
      box-shadow 0.25s ease,
      border-color 0.25s ease,
      transform 0.15s ease;
  }

  /* Override transform when user has dragged */
  .hud[style] {
    transform: none;
  }

  .hud:hover {
    border-color: rgba(255, 255, 255, 0.18);
    box-shadow:
      0 12px 40px rgba(0, 0, 0, 0.65),
      0 1px 0 rgba(255,255,255,0.08) inset,
      0 0 0 1px rgba(239, 68, 68, 0.25);
  }

  .hud.dragging {
    cursor: grabbing;
    box-shadow:
      0 20px 60px rgba(0, 0, 0, 0.75),
      0 0 0 1px rgba(239, 68, 68, 0.4);
    transform: scale(1.02);
  }

  /* Paused state — whole pill shifts to amber */
  .hud.paused {
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.55),
      0 1px 0 rgba(255,255,255,0.06) inset,
      0 0 0 1px rgba(251, 191, 36, 0.25);
  }

  /* ── Status dot ── */
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ef4444;
    flex-shrink: 0;
    animation: pulse-dot 1.4s ease-in-out infinite;
    box-shadow: 0 0 6px rgba(239, 68, 68, 0.7);
  }

  .dot.dot-paused {
    background: #fbbf24;
    box-shadow: 0 0 6px rgba(251, 191, 36, 0.7);
    animation: none;
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1;   transform: scale(1); }
    50%       { opacity: 0.4; transform: scale(0.8); }
  }

  /* ── Timer ── */
  .timer {
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.04em;
    font-weight: 500;
    color: #f1f5f9;
    min-width: 3ch;  /* prevents layout shift */
  }

  /* ── Divider ── */
  .divider {
    width: 1px;
    height: 16px;
    background: rgba(255, 255, 255, 0.12);
    flex-shrink: 0;
    margin: 0 0.125rem;
  }

  /* ── Buttons ── */
  .hud-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.06);
    color: #cbd5e1;
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
    padding: 0;
  }

  .hud-btn svg {
    width: 13px;
    height: 13px;
    pointer-events: none;
  }

  .hud-btn:hover {
    background: rgba(255, 255, 255, 0.14);
    color: #fff;
    border-color: rgba(255, 255, 255, 0.22);
    transform: scale(1.08);
  }

  .hud-btn:active {
    transform: scale(0.94);
  }

  /* Stop button — red tint */
  .hud-btn-stop {
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.12);
    color: #fca5a5;
  }

  .hud-btn-stop:hover {
    background: rgba(239, 68, 68, 0.28);
    border-color: rgba(239, 68, 68, 0.55);
    color: #fff;
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.3);
  }

  /* ── Drag handle ── */
  .drag-hint {
    display: flex;
    align-items: center;
    width: 12px;
    flex-shrink: 0;
    margin-left: 0.1rem;
  }

  .drag-hint svg {
    width: 12px;
    height: 12px;
  }
</style>