import { useCallback, useEffect, useRef, useState } from 'react'

export type RecorderState = 'idle' | 'recording' | 'paused' | 'stopped'

export function useRecorder() {
  const [state, setState] = useState<RecorderState>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)
  const tickRef = useRef<number | null>(null)

  const clearTick = () => {
    if (tickRef.current) window.clearInterval(tickRef.current)
    tickRef.current = null
  }

  const start = useCallback(async () => {
    setError(null)
    setBlob(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const merged = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        setBlob(merged)
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      startedAtRef.current = Date.now()
      setElapsedMs(0)
      clearTick()
      tickRef.current = window.setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current)
      }, 250)
      setState('recording')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not access the microphone. Check browser/site permissions.',
      )
      setState('idle')
    }
  }, [])

  const stop = useCallback(() => {
    mediaRecorderRef.current?.stop()
    clearTick()
    setState('stopped')
  }, [])

  const reset = useCallback(() => {
    clearTick()
    setState('idle')
    setElapsedMs(0)
    setBlob(null)
    setError(null)
  }, [])

  // Without this, navigating away (or the back button) mid-recording never
  // calls stop()/reset() — the 250ms tick interval and the live mic stream
  // both keep running after the component using this hook is gone, quietly
  // draining battery and leaving the mic indicator on in the background.
  useEffect(() => {
    return () => {
      clearTick()
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop()
        } catch {
          // already stopped/inactive — fall through to the direct track stop below
        }
      }
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  return { state, elapsedMs, blob, error, start, stop, reset }
}
