<script>
  import { onMount } from 'svelte'
  import { fixWebmDuration } from "@fix-webm-duration/fix"

  let stream = null
  let audio = null
  let mixedStream = null
  let chunks = []
  let recorder = null

  let startButton = null
  let stopButton = null
  let downloadButton = null
  let recordedVideo = null

  let screenshotPath = ''
  let isUploading = false
  let shareUrl = ''
  let uploadProgress = 0
  let recordedBlob = null
  let showUploadOption = false
  let startTime = undefined

  // Cloudinary config - Replace these with your actual values
  const CLOUDINARY_CLOUD_NAME = 'knightworks'
  const CLOUDINARY_UPLOAD_PRESET = 'screen_recordings'

  async function setupStream() {
    console.log('setup streaming')
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true
      })

      audio = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      })

      setupVideoFeedback()
    } catch (err) {
      console.error(err)
    }
  }

  function setupVideoFeedback() {
    if (stream) {
      const video = document.querySelector('.video-feedback')
      video.srcObject = stream
      video.play()
    } else {
      console.warn('No stream available')
    }
  }

  async function startRecording() {
    console.log('start recording')
    await setupStream()

    if (stream && audio) {
      mixedStream = new MediaStream([...stream.getTracks(), ...audio.getTracks()])
      recorder = new MediaRecorder(mixedStream)
      recorder.ondataavailable = handleDataAvailable
      recorder.onstop = handleStop
      recorder.start(1000)
      startTime = Date.now() + 1000

      startButton.disabled = true
      stopButton.disabled = false

      console.log('Recording started')
    } else {
      console.warn('No stream available.')
    }
  }

  function stopRecording() {
    recorder.stop()

    startButton.disabled = false
    stopButton.disabled = true
  }

  function handleDataAvailable(e) {
    chunks.push(e.data)
  }

  async function uploadToCloudinary(blob) {
    const formData = new FormData()
    formData.append('file', blob)
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)
    formData.append('resource_type', 'video')

    try {
      isUploading = true
      uploadProgress = 0

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`,
        {
          method: 'POST',
          body: formData
        }
      )

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      const data = await response.json()
      return data.secure_url
    } catch (error) {
      console.error('Upload failed:', error)
      alert('Upload failed. Please check your Cloudinary configuration.')
      return null
    } finally {
      isUploading = false
      uploadProgress = 0
    }
  }

  async function handleStop(e) {
    const blob = new Blob(chunks, { type: 'video/mp4' })
    chunks = []
    const duration = Date.now - startTime
    // const buggyBlob = blob
    recordedBlob = await fixWebmDuration(blob, duration)


    downloadButton.href = URL.createObjectURL(blob)
    downloadButton.download = `screen-recording-${Date.now()}.mp4`
    downloadButton.disabled = false

    recordedVideo.src = URL.createObjectURL(blob)
    recordedVideo.load()
    recordedVideo.onloadeddata = function () {
      const rc = document.querySelector('.recorded-video-wrap')
      rc.classList.remove('hidden')
      rc.scrollIntoView({ behavior: 'smooth', block: 'start' })

      recordedVideo.play()
    }

    // Show upload option if Cloudinary is configured
    if (CLOUDINARY_CLOUD_NAME !== 'your_cloud_name' && CLOUDINARY_UPLOAD_PRESET !== 'your_upload_preset') {
      showUploadOption = true
    }

    stream.getTracks().forEach((track) => track.stop())
    audio.getTracks().forEach((track) => track.stop())

    console.log('Recording stopped')
  }

  async function uploadVideo() {
    if (recordedBlob) {
      const uploadedUrl = await uploadToCloudinary(recordedBlob)
      if (uploadedUrl) {
        shareUrl = uploadedUrl
        showUploadOption = false // Hide the upload button after successful upload
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl)
      alert('Share link copied to clipboard!')
    } catch (err) {
      console.error('Failed to copy: ', err)
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = shareUrl
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      alert('Share link copied to clipboard!')
    }
  }

  function handleKeydown(event) {
    if (event.ctrlKey && event.key === 'j') {
      event.preventDefault()
      startRecording()
    }
    if (event.ctrlKey && event.key === 'k') {
      event.preventDefault()
      stopRecording()
    }
    if (event.ctrlKey && event.key === 'd') {
      event.preventDefault()
      downloadButton.click()
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<header class="bg-gray-900">
  <div class="container mx-auto">
    <div class="flex justify-center items-center py-4">
      <h1 class="text-2xl font-bold uppercase text-white">Screen Recorder</h1>
    </div>
  </div>
</header>

<main class="overflow-hidden bg-gray-100 min-h-screen">
  <div class="container mx-auto py-8 px-4">
    <h2 class="text-xl text-gray-500 uppercase font-light mb-4">Video recorder</h2>

    <!-- Setup Notice -->
    {#if CLOUDINARY_CLOUD_NAME === 'your_cloud_name'}
      <div class="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
        <strong>Setup Required:</strong> Please configure your Cloudinary settings in the code to enable sharing.
      </div>
    {/if}

    <div class="flex flex-wrap -mx-4 mb-8">
      <button
        bind:this={startButton}
        on:click={startRecording}
        class="start-recording mx-4 flex-1 bg-gradient-to-br from-purple-500 to-pink-500 text-white p-4 uppercase text-lg font-bold transition-all duration-300 hover:opacity-90 disabled:opacity-50 rounded">
        Record Screen (Ctrl + j)
      </button>
      <button
        bind:this={stopButton}
        on:click={stopRecording}
        class="stop-recording mx-4 flex-1 bg-red-500 text-white p-4 uppercase text-lg font-bold transition-all duration-300 hover:opacity-90 disabled:opacity-50 rounded"
        disabled>
        Stop Recording (Ctrl + k)
      </button>
    </div>

    <details class="mb-8">
      <summary class="cursor-pointer text-lg font-medium mb-2">Current Stream</summary>
      <video src="" autoplay class="video-feedback bg-black w-full h-auto rounded shadow-lg"></video>
    </details>

    <div class="recorded-video-wrap hidden">
      <h2 class="text-xl text-gray-500 uppercase font-light mb-4">Recorded video</h2>

      <div class="flex flex-wrap -mx-4 mb-4">
        <a
          bind:this={downloadButton}
          class="download-video text-center mx-4 flex-1 bg-gradient-to-br from-green-500 to-blue-500 text-white p-4 uppercase text-lg font-bold transition-all duration-300 hover:opacity-90 disabled:opacity-50 rounded"
          disabled>
          Download (Ctrl + d)
        </a>

        {#if showUploadOption}
          <button
            on:click={uploadVideo}
            disabled={isUploading}
            class="upload-video mx-4 flex-1 bg-gradient-to-br from-purple-500 to-pink-500 text-white p-4 uppercase text-lg font-bold transition-all duration-300 hover:opacity-90 disabled:opacity-50 rounded">
            {isUploading ? 'Uploading...' : 'Upload & Share'}
          </button>
        {/if}
      </div>

      <!-- Upload Status -->
      {#if isUploading}
        <div class="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4">
          <div class="flex items-center">
            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700 mr-2"></div>
            Uploading to cloud...
          </div>
        </div>
      {/if}

      <!-- Share Section -->
      {#if shareUrl}
        <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          <h3 class="font-bold mb-2">✅ Video uploaded successfully!</h3>
          <div class="flex items-center space-x-2">
            <input
              type="text"
              value={shareUrl}
              readonly
              class="flex-1 p-2 border rounded bg-white text-gray-800"
            >
            <button
              on:click={copyToClipboard}
              class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded transition-colors">
              Copy Link
            </button>
            <a
              href={shareUrl}
              target="_blank"
              class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors">
              Open
            </a>
          </div>
        </div>
      {/if}

      <details open>
        <summary class="cursor-pointer text-lg font-medium mb-2">Recorded video</summary>
        <video bind:this={recordedVideo} src="" controls class="recorded-video bg-black w-full h-auto rounded shadow-lg"></video>
      </details>
    </div>
  </div>
</main>

<style>
  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
</style>