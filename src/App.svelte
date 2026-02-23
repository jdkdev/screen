<script context="module">
  import { fixWebmDuration } from "@fix-webm-duration/fix"

  const CLOUDINARY_CLOUD_NAME = 'knightworks'
  const CLOUDINARY_UPLOAD_PRESET = 'screen_recordings'

  // -----------------------------
  // FUNCTIONS THAT CAN BE MODULE
  // -----------------------------

  export async function setupStream() {
    let stream, audio
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      audio = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 }
      })
    } catch (err) {
      console.error(err)
    }
    return { stream, audio }
  }

  export function setupVideoFeedback(stream, videoEl) {
    if (stream && videoEl) {
      videoEl.srcObject = stream
      videoEl.play()
    } else {
      console.warn('No stream or video element available')
    }
  }

  export function handleDataAvailable(chunks, e) {
    chunks.push(e.data)
  }

  export async function handleStop(chunks, startTime, recordedVideo, downloadButton, stream, audio) {
    const blob = new Blob(chunks, { type: 'video/webm' })
    chunks.length = 0
    const duration = Date.now() - startTime
    const recordedBlob = await fixWebmDuration(blob, duration)

    if (downloadButton) {
      downloadButton.href = URL.createObjectURL(recordedBlob)
      downloadButton.download = `screen-recording-${Date.now()}.webm`
      downloadButton.disabled = false
    }

    if (recordedVideo) {
      recordedVideo.src = URL.createObjectURL(recordedBlob)
      recordedVideo.load()
      recordedVideo.onloadeddata = () => {
        const rc = document.querySelector('.recorded-video-wrap')
        rc?.classList.remove('hidden')
        rc?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        recordedVideo.play()
      }
    }

    stream?.getTracks().forEach(track => track.stop())
    audio?.getTracks().forEach(track => track.stop())

    return recordedBlob
  }

  export async function uploadToCloudinary(blob) {
    if (!blob) return null
    const formData = new FormData()
    formData.append('file', blob)
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)
    formData.append('resource_type', 'video')

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`,
        { method: 'POST', body: formData }
      )
      if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`)
      const data = await response.json()
      return data.secure_url
    } catch (err) {
      console.error('Upload failed:', err)
      return null
    }
  }

  export async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text)
      alert('Share link copied to clipboard!')
    } catch (err) {
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      alert('Share link copied to clipboard!')
    }
  }
</script>

<script>
  import RecordingHUD from './lib/HUD.svelte'
  import WebcamPiP from './lib/WebCam.svelte'
  import TrimEditor from './lib/TrimEditor.svelte'
  import Mp4Converter from './lib/Mp4Converter.svelte'

  let stream = null
  let audio = null
  let mixedStream = null
  let chunks = []
  let recorder = null

  let startButton, stopButton, downloadButton, recordedVideo

  let recordedBlob = null
  let showUploadOption = false
  let shareUrl = ''
  let isUploading = false
  let startTime
  let isRecording = false
  let showWebcam = false
  let showTrimEditor = false
  let showMp4Converter = false

  function onTrimmed(e) {
    const trimmedBlob = e.detail
    // Replace the recorded blob with the trimmed version
    recordedBlob = trimmedBlob
    // Update the download link
    if (downloadButton) {
      downloadButton.href = URL.createObjectURL(trimmedBlob)
      downloadButton.download = `screen-recording-trimmed-${Date.now()}.webm`
    }
    // Update the video preview
    if (recordedVideo) {
      recordedVideo.src = URL.createObjectURL(trimmedBlob)
      recordedVideo.load()
    }
    showTrimEditor = false
  }

  async function startRecording() {
    const res = await setupStream()
    stream = res.stream
    audio = res.audio

    if (stream && audio) {
      mixedStream = new MediaStream([...stream.getTracks(), ...audio.getTracks()])
      recorder = new MediaRecorder(mixedStream)
      recorder.ondataavailable = (e) => handleDataAvailable(chunks, e)
      recorder.onstop = async () => {
        recordedBlob = await handleStop(
          chunks,
          startTime,
          recordedVideo,
          downloadButton,
          stream,
          audio
        )
        isRecording = false
        showUploadOption = true
      }
      recorder.start(200)
      startTime = Date.now()
      isRecording = true
      setupVideoFeedback(stream, document.querySelector('.video-feedback'))
      startButton.disabled = true
      stopButton.disabled = false
    }
  }

  function stopRecording() {
    recorder?.stop()
    isRecording = false
    startButton.disabled = false
    stopButton.disabled = true
  }

  async function uploadVideo() {
    if (!recordedBlob) return
    isUploading = true
    const uploadedUrl = await uploadToCloudinary(recordedBlob)
    if (uploadedUrl) {
      shareUrl = uploadedUrl.replace(
        'https://res.cloudinary.com/knightworks/video/upload/',
        'https://videos.frontierjs.com/'
      )
      showUploadOption = false
      copyToClipboard(shareUrl)
    }
    isUploading = false
  }

  function handleKeydown(event) {
    if (event.ctrlKey && event.key === 'j') startRecording()
    if (event.ctrlKey && event.key === 'k') stopRecording()
    if (event.ctrlKey && event.key === 'd') downloadButton?.click()
  }

</script>

<svelte:window on:keydown={handleKeydown} />

{#if isRecording}
  <RecordingHUD {recorder} onStop={stopRecording} />
{/if}

{#if showWebcam}
  <WebcamPiP {isRecording} on:close={() => showWebcam = false} />
{/if}

<header>
  <div class="container">
    <div class="header-inner">
      <h1>Screen Recorder</h1>
    </div>
  </div>
</header>

<main>
  <div class="container main-container">
    <h2>Video recorder</h2>

    {#if CLOUDINARY_CLOUD_NAME === 'your_cloud_name'}
      <div class="notice">
        <strong>Setup Required:</strong> Please configure your Cloudinary settings in the code to enable sharing.
      </div>
    {/if}

    <div class="buttons-row">
      <button bind:this={startButton} on:click={startRecording} class="btn start-btn">Record Screen (Ctrl + j)</button>
      <button bind:this={stopButton} on:click={stopRecording} class="btn stop-btn" disabled>Stop Recording (Ctrl + k)</button>
      <button on:click={() => showWebcam = !showWebcam} class="btn webcam-btn" class:active={showWebcam}>
        {showWebcam ? 'Hide Webcam' : 'Show Webcam'}
      </button>
    </div>

    <details>
      <summary>Current Stream</summary>
      <video src="" class="video-feedback"></video>
    </details>

    <div class="recorded-video-wrap hidden">
      <h2>Recorded video</h2>
      <div class="buttons-row">
        <a bind:this={downloadButton} class="btn download-btn" disabled>Download (Ctrl + d)</a>
        {#if showUploadOption}
          <button on:click={uploadVideo} disabled={isUploading} class="btn upload-btn">
            {isUploading ? 'Uploading...' : 'Upload & Share'}
          </button>
        {/if}
        {#if recordedBlob}
          <button on:click={() => showTrimEditor = !showTrimEditor} class="btn trim-btn" class:active={showTrimEditor}>
            {showTrimEditor ? 'Close Trim' : 'Trim'}
          </button>
          <!-- <button on:click={() => showMp4Converter = !showMp4Converter} class="btn mp4-btn" class:active={showMp4Converter}>
            Convert to MP4
          </button> -->
        {/if}
      </div>

      {#if showTrimEditor && recordedBlob}
        <div class="trim-wrap">
          <TrimEditor blob={recordedBlob} on:trimmed={onTrimmed} />
        </div>
      {/if}

      {#if showMp4Converter && recordedBlob}
        <div class="trim-wrap">
          <Mp4Converter blob={recordedBlob} filename="screen-recording-{Date.now()}" />
        </div>
      {/if}

      {#if isUploading}
        <div class="upload-status">Uploading to cloud...</div>
      {/if}

      {#if shareUrl}
        <div class="share-section">
          <h3>✅ Video uploaded successfully!</h3>
          <div class="share-actions">
            <input type="text" value={shareUrl} readonly>
            <button on:click={() => copyToClipboard(shareUrl)}>Copy Link</button>
            <a href={shareUrl} target="_blank">Open</a>
          </div>
        </div>
      {/if}

      <details open>
        <summary>Recorded video</summary>
        <video bind:this={recordedVideo} src="" controls class="recorded-video"></video>
      </details>
    </div>
  </div>
</main>


<style>
  :global(*, *::before, *::after) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :global(body) {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #0a0a0f;
    color: #e2e8f0;
    min-height: 100vh;
  }

  /* ── Layout ── */
  .container {
    max-width: 860px;
    margin: 0 auto;
    padding: 0 1.5rem;
  }

  /* ── Header ── */
  header {
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    padding: 1.25rem 0;
    position: sticky;
    top: 0;
    z-index: 10;
    backdrop-filter: blur(12px);
  }

  .header-inner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .header-inner h1 {
    font-size: 1.25rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .header-inner h1::before {
    content: '⏺';
    display: inline-block;
    margin-right: 0.5rem;
    -webkit-text-fill-color: #ef4444;
    animation: pulse 2s ease-in-out infinite;
  }

  /* ── Main ── */
  main {
    padding: 3rem 0 5rem;
  }

  .main-container > h2 {
    font-size: 1.75rem;
    font-weight: 700;
    letter-spacing: -0.03em;
    margin-bottom: 1.75rem;
  }

  /* ── Notice ── */
  .notice {
    background: rgba(234, 179, 8, 0.1);
    border: 1px solid rgba(234, 179, 8, 0.3);
    border-radius: 10px;
    padding: 0.875rem 1.25rem;
    font-size: 0.875rem;
    color: #fde68a;
    margin-bottom: 1.75rem;
  }

  /* ── Buttons row ── */
  .buttons-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 1.75rem;
  }

  /* ── Base button ── */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    border-radius: 8px;
    border: 1px solid transparent;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    text-decoration: none;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    pointer-events: none;
  }

  /* Start */
  .start-btn {
    background: #ef4444;
    color: #fff;
    border-color: #ef4444;
  }

  .start-btn:hover:not(:disabled) {
    background: #dc2626;
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.25);
  }

  /* Stop */
  .stop-btn {
    background: transparent;
    color: #94a3b8;
    border-color: rgba(255, 255, 255, 0.12);
  }

  .stop-btn:not(:disabled) {
    color: #e2e8f0;
    border-color: rgba(255, 255, 255, 0.2);
  }

  .stop-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.06);
  }

  /* Download */
  .download-btn {
    background: rgba(99, 102, 241, 0.15);
    color: #a5b4fc;
    border-color: rgba(99, 102, 241, 0.35);
  }

  .download-btn:hover:not([disabled]) {
    background: rgba(99, 102, 241, 0.25);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
  }

  /* Upload */
  .upload-btn {
    background: rgba(16, 185, 129, 0.15);
    color: #6ee7b7;
    border-color: rgba(16, 185, 129, 0.35);
  }

  .upload-btn:hover:not(:disabled) {
    background: rgba(16, 185, 129, 0.25);
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
  }

  /* Webcam */
  .webcam-btn {
    background: rgba(56, 189, 248, 0.12);
    color: #7dd3fc;
    border-color: rgba(56, 189, 248, 0.3);
  }

  .webcam-btn:hover {
    background: rgba(56, 189, 248, 0.22);
    box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15);
  }

  .webcam-btn.active {
    background: rgba(56, 189, 248, 0.25);
    border-color: rgba(56, 189, 248, 0.55);
    color: #e0f2fe;
  }

  /* Trim */
  .trim-btn {
    background: rgba(245, 158, 11, 0.12);
    color: #fcd34d;
    border-color: rgba(245, 158, 11, 0.3);
  }

  .trim-btn:hover {
    background: rgba(245, 158, 11, 0.22);
    box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15);
  }

  .trim-btn.active {
    background: rgba(245, 158, 11, 0.25);
    border-color: rgba(245, 158, 11, 0.55);
    color: #fff;
  }

  /* MP4 */
  .mp4-btn {
    background: rgba(99, 102, 241, 0.12);
    color: #a5b4fc;
    border-color: rgba(99, 102, 241, 0.3);
  }

  .mp4-btn:hover {
    background: rgba(99, 102, 241, 0.22);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  }

  .mp4-btn.active {
    background: rgba(99, 102, 241, 0.25);
    border-color: rgba(99, 102, 241, 0.55);
    color: #fff;
  }

  .trim-wrap {
    margin-bottom: 1.5rem;
  }

  /* ── Details / summary ── */
  details {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 1.5rem;
  }

  summary {
    padding: 0.875rem 1.25rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #94a3b8;
    cursor: pointer;
    user-select: none;
    list-style: none;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: color 0.15s;
  }

  summary::-webkit-details-marker { display: none; }

  summary::before {
    content: '▶';
    font-size: 0.625rem;
    transition: transform 0.2s ease;
  }

  details[open] summary::before {
    transform: rotate(90deg);
  }

  details[open] summary {
    color: #e2e8f0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  /* ── Videos ── */
  .video-feedback,
  .recorded-video {
    width: 100%;
    display: block;
    background: #000;
    aspect-ratio: 16 / 9;
    object-fit: contain;
  }

  /* ── Recorded section ── */
  .recorded-video-wrap {
    margin-top: 2.5rem;
  }

  .recorded-video-wrap h2 {
    font-size: 1.25rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    margin-bottom: 1.25rem;
    color: #e2e8f0;
  }

  .recorded-video-wrap.hidden {
    display: none;
  }

  /* ── Upload status ── */
  .upload-status {
    font-size: 0.875rem;
    color: #6ee7b7;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .upload-status::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #10b981;
    animation: pulse 1s ease-in-out infinite;
    flex-shrink: 0;
  }

  /* ── Share section ── */
  .share-section {
    background: rgba(16, 185, 129, 0.07);
    border: 1px solid rgba(16, 185, 129, 0.2);
    border-radius: 12px;
    padding: 1.25rem;
    margin-bottom: 1.5rem;
  }

  .share-section h3 {
    font-size: 0.9375rem;
    font-weight: 600;
    margin-bottom: 0.875rem;
    color: #6ee7b7;
  }

  .share-actions {
    display: flex;
    gap: 0.625rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .share-actions input {
    flex: 1;
    min-width: 200px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 7px;
    padding: 0.5rem 0.875rem;
    font-size: 0.8125rem;
    color: #cbd5e1;
    outline: none;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
  }

  .share-actions button {
    padding: 0.5rem 1rem;
    border-radius: 7px;
    border: 1px solid rgba(16, 185, 129, 0.4);
    background: rgba(16, 185, 129, 0.15);
    color: #6ee7b7;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .share-actions button:hover {
    background: rgba(16, 185, 129, 0.28);
  }

  .share-actions a {
    padding: 0.5rem 1rem;
    border-radius: 7px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: transparent;
    color: #94a3b8;
    font-size: 0.8125rem;
    font-weight: 500;
    text-decoration: none;
    transition: all 0.15s;
  }

  .share-actions a:hover {
    color: #e2e8f0;
    background: rgba(255, 255, 255, 0.06);
  }

  /* ── Animation ── */
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
</style>