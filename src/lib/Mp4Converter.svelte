<script>
  import { createEventDispatcher, onDestroy } from 'svelte'
  import { FFmpeg } from '@ffmpeg/ffmpeg'
  import { fetchFile, toBlobURL } from '@ffmpeg/util'

  export let blob = null
  export let filename = `recording-${Date.now()}`

  const dispatch = createEventDispatcher()

  // ── State ─────────────────────────────────────────────
  let phase = 'idle'   // idle | loading | converting | done | error
  let progress = 0
  let errorMsg = ''
  let mp4Url = null
  let mp4Blob = null
  let mp4Size = ''

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  $: sourceSize = blob ? formatBytes(blob.size) : ''
  $: circumference = 2 * Math.PI * 28
  $: dashOffset = circumference * (1 - progress / 100)

  // ── ffmpeg singleton ──────────────────────────────────
  let ffmpeg
  let loaded = false
  let logs = []

  async function ensureFFmpeg() {
    if (loaded) return
    phase = 'loading'
    ffmpeg = new FFmpeg()
    ffmpeg.on('progress', ({ progress: p }) => {
      progress = Math.min(99, Math.round(p * 100))
    })
    ffmpeg.on('log', ({ message }) => {
      logs.push(message)
      console.debug('[ffmpeg]', message)
    })
    const base = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm'
    await ffmpeg.load({
      coreURL:   await toBlobURL(`${base}/ffmpeg-core.js`,        'text/javascript'),
      wasmURL:   await toBlobURL(`${base}/ffmpeg-core.wasm`,      'application/wasm'),
      workerURL: await toBlobURL(`${base}/ffmpeg-core.worker.js`, 'text/javascript')
    })
    loaded = true
  }

  // ── Convert ───────────────────────────────────────────
  async function convert() {
    if (!blob) return
    progress = 0
    errorMsg = ''
    logs = []

    try {
      await ensureFFmpeg()
      phase = 'converting'

      await ffmpeg.writeFile('input.webm', await fetchFile(blob))

      // -fflags +genpts+igndts: MediaRecorder WebM files have broken/missing
      // timestamp metadata — this tells ffmpeg to ignore them and regenerate
      // pts from scratch, which fixes the "first frame only" problem.
      const exit = await ffmpeg.exec([
        '-fflags',   '+genpts+igndts',
        '-i',        'input.webm',
        '-c:v',      'mpeg4',          // universally supported, in base wasm build
        '-q:v',      '2',              // quality (1=best, 31=worst)
        '-c:a',      'aac',
        '-b:a',      '128k',
        '-pix_fmt',  'yuv420p',        // required for broad player compat
        '-movflags', '+faststart',
        'output.mp4'
      ])

      if (exit !== 0) {
        throw new Error(
          logs.filter(l => /error|invalid|failed|unknown/i.test(l))
              .slice(-6).join(' | ') || `ffmpeg exited ${exit}`
        )
      }

      const data = await ffmpeg.readFile('output.mp4')
      if (!data?.length) throw new Error('Empty output file')

      mp4Blob = new Blob([data], { type: 'video/mp4' })
      mp4Url  = URL.createObjectURL(mp4Blob)
      mp4Size = formatBytes(mp4Blob.size)
      progress = 100
      phase = 'done'

      dispatch('converted', { blob: mp4Blob, url: mp4Url })
    } catch (err) {
      console.error('[Converter]', err)
      errorMsg = (err?.message || 'Conversion failed').slice(0, 140)
      phase = 'error'
    }
  }

  function download() {
    if (!mp4Url) return
    const a = document.createElement('a')
    a.href = mp4Url
    a.download = `${filename}.mp4`
    a.click()
  }

  function reset() {
    phase = 'idle'
    progress = 0
    errorMsg = ''
    logs = []
    if (mp4Url) { URL.revokeObjectURL(mp4Url); mp4Url = null }
  }

  onDestroy(() => {
    if (mp4Url) URL.revokeObjectURL(mp4Url)
  })
</script>

<div class="converter" class:done={phase === 'done'} class:error={phase === 'error'}>

  <!-- ── Left: icon / progress ring ── -->
  <div class="ring-wrap">
    {#if phase === 'idle' || phase === 'error'}
      <!-- MP4 badge -->
      <div class="badge" class:badge-error={phase === 'error'}>
        <span>MP4</span>
      </div>

    {:else if phase === 'loading'}
      <!-- Spinner -->
      <svg class="spinner" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="4"/>
        <circle cx="32" cy="32" r="28" fill="none" stroke="#6366f1" stroke-width="4"
          stroke-dasharray="44 132" stroke-linecap="round">
          <animateTransform attributeName="transform" type="rotate"
            from="0 32 32" to="360 32 32" dur="0.9s" repeatCount="indefinite"/>
        </circle>
      </svg>

    {:else if phase === 'converting'}
      <!-- Progress arc -->
      <svg class="ring-svg" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="4"/>
        <circle
          cx="32" cy="32" r="28"
          fill="none"
          stroke="url(#arc-grad)"
          stroke-width="4"
          stroke-linecap="round"
          stroke-dasharray={circumference}
          stroke-dashoffset={dashOffset}
          transform="rotate(-90 32 32)"
          style="transition: stroke-dashoffset 0.3s ease"
        />
        <defs>
          <linearGradient id="arc-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stop-color="#6366f1"/>
            <stop offset="100%" stop-color="#a78bfa"/>
          </linearGradient>
        </defs>
        <text x="32" y="37" text-anchor="middle"
          font-family="'JetBrains Mono', monospace"
          font-size="12" font-weight="500" fill="#e2e8f0">
          {progress}%
        </text>
      </svg>

    {:else if phase === 'done'}
      <!-- Checkmark -->
      <div class="badge badge-done">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <path d="M4 10l4.5 4.5L16 6"/>
        </svg>
      </div>
    {/if}
  </div>

  <!-- ── Centre: info ── -->
  <div class="info">
    {#if phase === 'idle'}
      <p class="title">Convert to MP4</p>
      <p class="sub">WebM → H.264 + AAC · works everywhere</p>
      {#if sourceSize}
        <p class="meta">Source: <span>{sourceSize} .webm</span></p>
      {/if}

    {:else if phase === 'loading'}
      <p class="title">Loading encoder…</p>
      <p class="sub">Fetching ffmpeg.wasm (~10 MB, once)</p>

    {:else if phase === 'converting'}
      <p class="title">Converting…</p>
      <p class="sub">Re-encoding with libx264 · please wait</p>
      <div class="progress-bar-wrap">
        <div class="progress-bar" style="width:{progress}%"></div>
      </div>

    {:else if phase === 'done'}
      <p class="title">Ready to download</p>
      <p class="meta done-meta">
        <span class="chip webm-chip">.webm {sourceSize}</span>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" width="12">
          <path d="M3 8h10M9 4l4 4-4 4"/>
        </svg>
        <span class="chip mp4-chip">.mp4 {mp4Size}</span>
      </p>

    {:else if phase === 'error'}
      <p class="title error-title">Conversion failed</p>
      <p class="sub error-sub">{errorMsg}</p>
    {/if}
  </div>

  <!-- ── Right: action ── -->
  <div class="actions">
    {#if phase === 'idle'}
      <button class="action-btn convert-btn" on:click={convert}>
        Convert
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" width="14">
          <path d="M2 8h9M8 4l5 4-5 4" stroke-linecap="round"/>
        </svg>
      </button>

    {:else if phase === 'converting' || phase === 'loading'}
      <button class="action-btn cancel-btn" on:click={reset}>Cancel</button>

    {:else if phase === 'done'}
      <button class="action-btn download-btn" on:click={download}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" width="14">
          <path d="M8 2v8M4 7l4 4 4-4" stroke-linecap="round"/>
          <path d="M2 13h12" stroke-linecap="round"/>
        </svg>
        Download
      </button>
      <button class="action-btn reset-btn" on:click={reset} title="Convert again">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" width="13">
          <path d="M2 8a6 6 0 1 0 1.5-3.9M2 4v4h4" stroke-linecap="round"/>
        </svg>
      </button>

    {:else if phase === 'error'}
      <button class="action-btn retry-btn" on:click={convert}>Retry</button>
    {/if}
  </div>
</div>

<style>
  .converter {
    display: flex;
    align-items: center;
    gap: 1.125rem;
    padding: 1rem 1.25rem;
    background: rgba(99, 102, 241, 0.07);
    border: 1px solid rgba(99, 102, 241, 0.2);
    border-radius: 14px;
    transition: border-color 0.25s, background 0.25s;
  }

  .converter.done {
    background: rgba(16, 185, 129, 0.07);
    border-color: rgba(16, 185, 129, 0.25);
  }

  .converter.error {
    background: rgba(239, 68, 68, 0.07);
    border-color: rgba(239, 68, 68, 0.25);
  }

  /* ── Ring area ── */
  .ring-wrap {
    flex-shrink: 0;
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ring-svg,
  .spinner {
    width: 56px;
    height: 56px;
  }

  /* MP4 / done badge */
  .badge {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #a5b4fc;
  }

  .badge span {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
  }

  .badge svg {
    width: 22px;
    height: 22px;
  }

  .badge-done {
    background: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.35);
    color: #6ee7b7;
  }

  .badge-error {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.35);
    color: #fca5a5;
  }

  /* ── Info ── */
  .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #e2e8f0;
    letter-spacing: -0.01em;
  }

  .sub {
    font-size: 0.775rem;
    color: #64748b;
  }

  .meta {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    color: #475569;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
    margin-top: 0.15rem;
  }

  .meta span { color: #94a3b8; }

  .done-meta { margin-top: 0.25rem; }

  .chip {
    padding: 0.15rem 0.45rem;
    border-radius: 4px;
    font-size: 0.7rem;
  }

  .webm-chip {
    background: rgba(255,255,255,0.06);
    color: #64748b;
    border: 1px solid rgba(255,255,255,0.08);
  }

  .mp4-chip {
    background: rgba(16, 185, 129, 0.12);
    color: #6ee7b7;
    border: 1px solid rgba(16, 185, 129, 0.25);
  }

  /* Inline progress bar */
  .progress-bar-wrap {
    margin-top: 0.4rem;
    height: 3px;
    background: rgba(255,255,255,0.07);
    border-radius: 999px;
    overflow: hidden;
  }

  .progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #6366f1, #a78bfa);
    border-radius: 999px;
    transition: width 0.3s ease;
  }

  .error-title { color: #fca5a5; }
  .error-sub   { color: #ef4444; }

  /* ── Actions ── */
  .actions {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: 1px solid transparent;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
    font-family: inherit;
  }

  .convert-btn {
    background: rgba(99, 102, 241, 0.18);
    border-color: rgba(99, 102, 241, 0.4);
    color: #a5b4fc;
  }

  .convert-btn:hover {
    background: rgba(99, 102, 241, 0.3);
    border-color: rgba(99, 102, 241, 0.65);
    color: #fff;
    box-shadow: 0 0 14px rgba(99, 102, 241, 0.25);
  }

  .download-btn {
    background: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.4);
    color: #6ee7b7;
  }

  .download-btn:hover {
    background: rgba(16, 185, 129, 0.28);
    border-color: rgba(16, 185, 129, 0.65);
    color: #fff;
    box-shadow: 0 0 14px rgba(16, 185, 129, 0.2);
  }

  .cancel-btn, .reset-btn {
    background: rgba(255,255,255,0.05);
    border-color: rgba(255,255,255,0.1);
    color: #64748b;
  }

  .cancel-btn:hover, .reset-btn:hover {
    background: rgba(255,255,255,0.1);
    color: #94a3b8;
  }

  /* square icon-only reset btn */
  .reset-btn {
    padding: 0.5rem;
    border-radius: 7px;
  }

  .retry-btn {
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(239, 68, 68, 0.35);
    color: #fca5a5;
  }

  .retry-btn:hover {
    background: rgba(239, 68, 68, 0.25);
    color: #fff;
  }
</style>