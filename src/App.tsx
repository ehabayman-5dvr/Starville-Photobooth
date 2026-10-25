import { useCallback, useEffect, useRef, useState } from 'react';
import { advanceVariation, nextVariation, type Mode } from './variation';

type Screen = 'start' | 'modes' | 'capture' | 'preview' | 'loading' | 'result';
type Portrait = { id: string; image: string; hostedUrl: string | null; preview: boolean; archiveFailed: boolean };
const asset = (file: string) => `/Assets/${file}`;

function ArtButton({ src, label, className = '', onClick, disabled = false }: { src: string; label: string; className?: string; onClick: () => void; disabled?: boolean }) {
  return <button className={`art-button ${className}`} aria-label={label} onClick={onClick} disabled={disabled}><img src={asset(src)} alt={label} draggable={false} /></button>;
}

function LoopVideo({ src, poster }: { src: string; poster?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  return <><video ref={ref} className="backdrop" src={asset(src)} poster={poster} autoPlay loop muted playsInline preload="auto" onError={() => setFailed(true)} onLoadedData={() => { ref.current?.play().catch(() => setFailed(true)); }} />{failed && <div className="video-fallback" aria-hidden="true" />}</>;
}

function Camera({ onCapture, onBack }: { onCapture: (image: string) => void; onBack: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const shutterLock = useRef(false);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let disposed = false;
    setReady(false); setError(''); setCount(null); shutterLock.current = false;
    const connect = async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('secure');
        const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (disposed) { media.getTracks().forEach(track => track.stop()); return; }
        stream.current = media;
        if (video.current) { video.current.srcObject = media; await video.current.play(); }
      } catch (e) {
        if (disposed) return;
        const name = e instanceof Error ? e.name : '';
        setError(name === 'NotAllowedError' ? 'Allow camera access in your browser settings, then try again.' : name === 'NotFoundError' ? 'We couldn’t find a camera on this device.' : 'Your camera couldn’t start. Close other apps using it and try again. Use HTTPS or localhost to open the booth.');
      }
    };
    void connect();
    return () => { disposed = true; stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; };
  }, [facing, attempt]);

  useEffect(() => {
    if (count === null) return;
    if (count === 0) {
      const source = video.current;
      if (!source?.videoWidth || source.readyState < 2) { setError('The camera paused. Please try again.'); setCount(null); shutterLock.current = false; return; }
      const canvas = document.createElement('canvas');
      canvas.width = 720; canvas.height = 1280;
      const ctx = canvas.getContext('2d')!;
      // Match the cover crop and selfie mirroring shown in the live preview.
      const scale = Math.max(canvas.width / source.videoWidth, canvas.height / source.videoHeight);
      const width = source.videoWidth * scale, height = source.videoHeight * scale;
      if (facing === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
      ctx.drawImage(source, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
      onCapture(canvas.toDataURL('image/jpeg', 0.9));
      return;
    }
    const timer = window.setTimeout(() => setCount(count - 1), 1000);
    return () => clearTimeout(timer);
  }, [count, facing, onCapture]);

  return <section className="screen camera-screen" aria-label="Take your selfie">
    <video ref={video} className={`camera-feed ${facing === 'user' ? 'mirrored' : ''}`} autoPlay playsInline muted onLoadedData={() => setReady(true)} />
    <div className="camera-shade" />
    <button className="utility back" onClick={onBack} aria-label="Back to modes">‹</button>
    <button className="utility flip" onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')} disabled={count !== null} aria-label="Switch camera">↻</button>
    <img className="selfie-title" src={asset('Camera-Capture/Take-Your-Selfie.png')} alt="Take Your Selfie" />
    {!ready && !error && <p className="camera-message">Opening your camera…</p>}
    {error && <div className="camera-error" role="alert"><p>{error}</p><button className="pill" onClick={() => { setAttempt(attempt + 1); }}>Try camera again</button><button className="text-button" onClick={onBack}>Back to modes</button></div>}
    {count !== null && count > 0 && <div className="capture-countdown" role="status" aria-live="assertive"><img className="timer-ring" src={asset('Camera-Capture/Timer-Container.png')} alt="" /><img className="count-digit" key={count} src={asset(`Camera-Capture/${count}.png`)} alt={String(count)} /></div>}
    <ArtButton className="shutter" src="Camera-Capture/Camera-Capture-Btn.png" label="Take photo" disabled={!ready || count !== null || !!error} onClick={() => { if (!shutterLock.current) { shutterLock.current = true; setCount(3); } }} />
    <p className="camera-hint">{count !== null ? 'Your future is looking bright ✦' : 'Find your light. Make it yours.'}</p>
  </section>;
}

function Preview({ image, onRetake, onProceed }: { image: string; onRetake: () => void; onProceed: () => void }) {
  const [remaining, setRemaining] = useState(5);
  useEffect(() => {
    const end = Date.now() + 5000;
    const timer = setInterval(() => {
      const seconds = Math.max(0, (end - Date.now()) / 1000);
      setRemaining(seconds);
      if (seconds === 0) { clearInterval(timer); onProceed(); }
    }, 100);
    return () => clearInterval(timer);
  }, [onProceed]);
  return <section className="screen preview-screen" aria-label="Review your selfie">
    <img className="camera-feed" src={image} alt="Your captured selfie" />
    <div className="preview-shade" />
    <p className="preview-note">A glimpse of what’s next.</p>
    <div className="preview-actions">
      <ArtButton src="Retake-Screen/Retake.png" label="Retake" onClick={onRetake} />
        <div className="preview-progress" role="progressbar" aria-label="Time until portrait creation" aria-valuemin={0} aria-valuemax={5} aria-valuenow={Number((5 - remaining).toFixed(1))} aria-valuetext={`Creating your portrait in ${Math.ceil(remaining)} seconds`}>
          <span style={{ width: `${(1 - remaining / 5) * 100}%` }} />
        </div>
    </div>
      <p className="auto-proceed" role="status">Creating your portrait in {Math.ceil(remaining)}s</p>
  </section>;
}

function Loading({ error, onRetry, onRetake }: { error: string; onRetry: () => void; onRetake: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => { const timer = setInterval(() => setElapsed(t => t + 1), 1000); return () => clearInterval(timer); }, []);
  const status = elapsed < 8 ? 'Finding your future vibe…' : elapsed < 25 ? 'Creating your new world…' : elapsed < 55 ? 'Bringing your portrait to life…' : 'A little more magic. Almost there…';
  return <section className="screen loading-screen" aria-label="Creating your portrait" aria-busy={!error}>
    <LoopVideo src="Loading-Screen/Loading.mp4" />
    {!error && <div className="loading-status" role="status"><span className="sparkle">✦</span><p>{status}</p><div className="loading-line"><span /></div></div>}
    {error && <div className="error-card" role="alert"><span className="sparkle">✦</span><h1>Let’s try that again</h1><p>{error}</p><button className="pill" onClick={onRetry}>Try again</button><button className="text-button" onClick={onRetake}>Take a new selfie</button></div>}
  </section>;
}

function Result({ portrait, onExplore }: { portrait: Portrait; onExplore: () => void }) {
  const [message, setMessage] = useState('');
  const [sharing, setSharing] = useState(false);
  const file = useRef<File | null>(null);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    const bytes = Uint8Array.from(atob(portrait.image.split(',')[1]), c => c.charCodeAt(0));
    file.current = new File([bytes], `StarVille-${portrait.id}.jpg`, { type: 'image/jpeg' });
    setCanShare(!!navigator.canShare?.({ files: [file.current] }));
  }, [portrait]);
  function download() {
    const link = document.createElement('a');
    link.href = portrait.image; link.download = `StarVille-${portrait.id}.jpg`;
    document.body.appendChild(link); link.click(); link.remove();
    setMessage('Your StarVille portrait is ready to save.');
  }
  async function share() {
    if (!file.current || sharing) return;
    setSharing(true); setMessage('');
    try { await navigator.share({ files: [file.current], title: 'My StarVille Future Self' }); }
    catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) setMessage('Sharing is unavailable. Use Download to save your portrait.'); }
    finally { setSharing(false); }
  }
  return <section className="screen result-screen" aria-label="Your future looks bright">
    <img className="backdrop" src={asset('Result-Screen/image 36.png')} alt="" />
    <h1 className="sr-only">Your Future Looks Bright. Your vibe. Your story. Your moment.</h1>
    <div className="portrait-frame"><img src={portrait.image} alt="Your generated StarVille future-self portrait with the StarVille logo" /></div>
    {portrait.preview && <div className="preview-badge">Design preview · sample portrait</div>}
    <div className="result-actions"><ArtButton src="Result-Screen/button_explore_again 1.png" label="Explore Again" onClick={onExplore} /><ArtButton src="Result-Screen/button_download 1.png" label="Download" onClick={download} /></div>
    {canShare && <button className="share-button" onClick={share} disabled={sharing}>↗ {sharing ? 'Opening share…' : 'Share your future'}</button>}
    <p className="result-message" role="status">{message || (portrait.archiveFailed ? 'Your portrait is ready. Download it to keep a copy.' : '')}</p>
  </section>;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('start');
  const [mode, setMode] = useState<Mode>('boss');
  const [capture, setCapture] = useState('');
  const [portrait, setPortrait] = useState<Portrait | null>(null);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const requestVersion = useRef(0);
  useEffect(() => () => controller.current?.abort(), []);

  const captured = useCallback((image: string) => { setCapture(image); setScreen('preview'); }, []);
  const reset = useCallback(() => {
    requestVersion.current++; controller.current?.abort(); controller.current = null; busy.current = false;
    setCapture(''); setPortrait(null); setError(''); setScreen('modes');
  }, []);
  const generate = useCallback(async () => {
    if (busy.current || !capture) return;
    busy.current = true; setError(''); setScreen('loading');
    const version = ++requestVersion.current;
    const abort = new AbortController(); controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 290_000);
    const variation = nextVariation(mode);
    try {
      const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, variation, image: capture }), signal: abort.signal });
      const result = await response.json().catch(() => { throw new Error('The connection was interrupted. Please try again.'); });
      if (!response.ok) throw new Error(result.error || 'We couldn’t create your portrait. Please try again.');
      if (version !== requestVersion.current) return;
      if (typeof result.image !== 'string' || !result.image.startsWith('data:image/jpeg;base64,')) throw new Error('The portrait could not be opened. Please try again.');
      if (!result.preview) advanceVariation(mode, variation);
      setPortrait(result); setCapture(''); setScreen('result');
    } catch (e) {
      if (version !== requestVersion.current) return;
      setError(abort.signal.aborted ? 'This portrait took too long. Please try again when you are ready.' : e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally { clearTimeout(timeout); if (version === requestVersion.current) busy.current = false; }
  }, [capture, mode]);

  return <main className="booth-shell"><div className={`stage stage-${screen}`}>
    {screen === 'start' && <section className="screen start-screen" aria-label="StarVille. See Your Future Self">
      <LoopVideo src="Start-Screen/start.mp4" poster="/Screens-References/Start-Screen.png" />
      <h1 className="sr-only">StarVille · See Your Future Self</h1>
      <ArtButton className="start-button" src="Start-Screen/Start-Btn.png" label="Tap to start" onClick={() => setScreen('modes')} />
    </section>}
    {screen === 'modes' && <section className="screen mode-screen" aria-label="Pick Your Future Vibe">
      <img className="backdrop" src={asset('Era-Mode-Screen/Era-Mood-Screen-Background.png')} alt="" />
      <h1 className="sr-only">Pick Your Future Vibe</h1>
      <div className="mode-cards"><ArtButton src="Era-Mode-Screen/Boss-Mode.png" label="The Boss. Confident, ambitious, unstoppable." onClick={() => { setMode('boss'); setScreen('capture'); }} /><ArtButton src="Era-Mode-Screen/Explorer-Mode.png" label="The Explorer. Curious, bold, limitless." onClick={() => { setMode('explorer'); setScreen('capture'); }} /></div>
      <p className="data-note">Your selfie is used to create your portrait with AI.<br />Your finished portrait is saved to StarVille’s photo gallery.</p>
    </section>}
    {screen === 'capture' && <Camera onCapture={captured} onBack={reset} />}
    {screen === 'preview' && <Preview image={capture} onRetake={() => { setCapture(''); setScreen('capture'); }} onProceed={generate} />}
    {screen === 'loading' && <Loading error={error} onRetry={generate} onRetake={() => { setError(''); setCapture(''); setScreen('capture'); }} />}
    {screen === 'result' && portrait && <Result portrait={portrait} onExplore={reset} />}
  </div></main>;
}
