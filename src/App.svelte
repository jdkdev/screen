<script>
  import { onMount } from 'svelte'

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

  function handleStop(e) {
    const blob = new Blob(chunks, { type: 'video/mp4' })
    chunks = []

    downloadButton.href = URL.createObjectURL(blob)
    downloadButton.download = 'video.mp4'
    downloadButton.disabled = false

    recordedVideo.src = URL.createObjectURL(blob)
    recordedVideo.load()
    recordedVideo.onloadeddata = function () {
      const rc = document.querySelector('.recorded-video-wrap')
      rc.classList.remove('hidden')
      rc.scrollIntoView({ behavior: 'smooth', block: 'start' })

      recordedVideo.play()
    }

    stream.getTracks().forEach((track) => track.stop())
    audio.getTracks().forEach((track) => track.stop())

    console.log('Recording stopped')
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
      <h1 class="text-2xl font-bold uppercase">Screen Recorder</h1>
    </div>
  </div>
</header>

<main class="overflow-hidden">
  <div class="container mx-auto py-8 px-4">
    <h2 class="text-xl text-gray-500 uppercase font-light mb-4">Video recorder</h2>

    <div class="flex flex-wrap -mx-4 mb-8">
      <button
        bind:this={startButton}
        on:click={startRecording}
        class="start-recording mx-4 flex-1 bg-gradient-to-br from-purple-500 to to-pink-500 p-4 uppercase text-lg font-bold transition-all duration-300 hover:opacity-90 disabled:opacity-50">
        Record Screen (Ctrl + j)
      </button>
      <button
			bind:this={stopButton}
        on:click={stopRecording}
        class="stop-recording mx-4 flex-1 p-4 uppercase text-lg font-bold transition-all duration-300 hover:opacity-90 disabled:opacity-50"
        disabled>
        Stop Recording (Ctrl + k)
      </button>
    </div>

    <details>
			<summary>Current Stream</summary>
			<video src="" autplay class="video-feedback bg-black w-full h-auto mb-4"></video>
		</details>

    <div class="recorded-video-wrap hidden">
      <h2 class="text-xl text-gray-500 uppercase font-light mb-4">Recorded video</h2>

      <div class="flex flex-wrap -mx-4">
        <a
					bind:this={downloadButton}
          class="download-video text-center mx-4 flex-1 bg-gradient-to-br from-purple-500 to to-pink-500 p-4 uppercase text-lg font-bold transition-all duration-300 hover:opacity-90 disabled:opacity-50"
          disabled>
          Download
        </a>
      </div>
      <details open>
				<summary>Recorded video</summary>
				<video bind:this={recordedVideo} src="" class="recorded-video bg-black w-full h-auto mb-8"></video>
			</details>
    </div>
  </div>
</main>
