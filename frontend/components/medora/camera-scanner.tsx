'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  RefreshCw,
  Upload,
  AlertTriangle,
  CheckCircle2,
  X,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  QrCode
} from 'lucide-react';
import { toast } from 'sonner';

let jsQRInstance: any = null;
async function getJsQR() {
  if (jsQRInstance) return jsQRInstance;
  const mod = await import('jsqr');
  jsQRInstance = mod.default || mod;
  return jsQRInstance;
}

interface CameraScannerProps {
  onScan: (token: string) => void;
  active?: boolean;
}

export function CameraScanner({ onScan, active = false }: CameraScannerProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isScanning, setIsScanning] = useState(active);
  const [permissionStatus, setPermissionStatus] = useState<
    'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported'
  >('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [detectedToken, setDetectedToken] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const playSuccessChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    } catch {
      // Audio not permitted or supported
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([40, 50, 40]);
      }
    } catch {
      // Haptics optional
    }
  };

  const parseToken = (raw: string): string => {
    let clean = raw.trim();
    if (clean.includes('token=')) {
      try {
        const url = new URL(clean, window.location.origin);
        clean = url.searchParams.get('token') || clean;
      } catch {
        clean = clean.split('token=')[1]?.split('&')[0] || clean;
      }
    }
    return clean;
  };

  const handleScanSuccess = useCallback(
    (rawData: string) => {
      const token = parseToken(rawData);
      if (!token) return;

      playSuccessChime();
      setDetectedToken(token);
      toast.success('Patient Quick-Pass QR code scanned successfully!');

      // Stop camera stream immediately
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setIsScanning(false);
      setPermissionStatus('idle');

      // Hand off to parent callback
      onScan(token);
    },
    [onScan]
  );

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
    setPermissionStatus('idle');
  }, []);

  // Frame processing loop
  const scanLoop = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(scanLoop);
      return;
    }

    // 1. Try Native BarcodeDetector (Chrome, Edge, Android)
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const BarcodeDetectorClass = (window as any).BarcodeDetector;
        const detector = new BarcodeDetectorClass({ formats: ['qr_code'] });
        detector
          .detect(video)
          .then((barcodes: any[]) => {
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              handleScanSuccess(barcodes[0].rawValue);
              return;
            }
            animFrameRef.current = requestAnimationFrame(scanLoop);
          })
          .catch(() => {
            // Fallback to jsQR on detection error
            decodeWithJsQR();
          });
        return;
      } catch {
        // Fallback to jsQR
      }
    }

    decodeWithJsQR();

    async function decodeWithJsQR() {
      if (!canvasRef.current || !video) {
        animFrameRef.current = requestAnimationFrame(scanLoop);
        return;
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        animFrameRef.current = requestAnimationFrame(scanLoop);
        return;
      }

      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w === 0 || h === 0) {
        animFrameRef.current = requestAnimationFrame(scanLoop);
        return;
      }

      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(video, 0, 0, w, h);

      try {
        const jsQR = await getJsQR();
        const imageData = ctx.getImageData(0, 0, w, h);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (code && code.data) {
          handleScanSuccess(code.data);
          return;
        }
      } catch {
        // Read attempt skipped
      }

      animFrameRef.current = requestAnimationFrame(scanLoop);
    }
  }, [handleScanSuccess]);

  const startCamera = async (deviceId?: string) => {
    setErrorMessage('');
    setPermissionStatus('requesting');
    setIsScanning(true);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPermissionStatus('unsupported');
      setErrorMessage(
        'Camera scanning is not supported by this browser. Please enter the pass token manually or upload a QR image.'
      );
      return;
    }

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // essential for iOS
        await videoRef.current.play();
      }

      setPermissionStatus('granted');

      // Discover video input devices for camera switching
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = allDevices.filter((d) => d.kind === 'videoinput');
        setDevices(videoInputs);
        if (!selectedDeviceId && videoInputs[0]) {
          setSelectedDeviceId(videoInputs[0].deviceId);
        }
      } catch {
        // Device listing optional
      }

      // Start scanning loop
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(scanLoop);
    } catch (err: unknown) {
      const errorObj = err as Error;
      console.warn('Camera access denied or error:', errorObj);
      if (
        errorObj.name === 'NotAllowedError' ||
        errorObj.name === 'PermissionDeniedError' ||
        errorObj.message.includes('denied')
      ) {
        setPermissionStatus('denied');
        setErrorMessage(
          'Camera access was denied. Please allow camera permissions in your browser address bar, or upload an image of the QR code.'
        );
      } else if (errorObj.name === 'NotFoundError' || errorObj.name === 'DevicesNotFoundError') {
        setPermissionStatus('denied');
        setErrorMessage('No camera found on this device. Please enter the token or upload a QR image.');
      } else {
        setPermissionStatus('denied');
        setErrorMessage(`Unable to access camera: ${errorObj.message || 'Unknown error'}`);
      }
      setIsScanning(false);
    }
  };

  const handleSwitchCamera = () => {
    if (devices.length < 2) {
      toast.info('Only one camera is available on this device.');
      return;
    }
    const currentIndex = devices.findIndex((d) => d.deviceId === selectedDeviceId);
    const nextIndex = (currentIndex + 1) % devices.length;
    const nextDevice = devices[nextIndex];
    setSelectedDeviceId(nextDevice.deviceId);
    void startCamera(nextDevice.deviceId);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        try {
          const jsQR = await getJsQR();
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            handleScanSuccess(code.data);
          } else {
            toast.error('No readable QR code found in this image. Please try another photo.');
          }
        } catch {
          toast.error('Could not process QR code image.');
        }
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      toast.error('Failed to load image file.');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  // Cleanup on unmount
  useEffect(() => {
    setIsMounted(true);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  if (!isMounted) {
    return (
      <div
        style={{
          borderRadius: 16,
          border: '1px solid var(--border)',
          background: 'var(--card)',
          padding: '36px 20px',
          textAlign: 'center',
          marginBottom: 24,
          boxShadow: '0 4px 20px -4px rgba(36, 91, 232, 0.08)'
        }}
      >
        <div
          style={{
            margin: '0 auto 12px',
            width: 50,
            height: 50,
            borderRadius: 12,
            background: '#eff6ff',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Camera size={26} />
        </div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#334155' }}>
          Loading Optical Scanner Engine...
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '22px',
        boxShadow: '0 4px 20px -4px rgba(36, 91, 232, 0.08)',
        marginBottom: 24,
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* Top Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            className="icon-box blue"
            style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0 }}
          >
            <Camera size={19} />
          </span>
          <div>
            <strong style={{ fontSize: 15, display: 'block', color: 'var(--foreground)' }}>
              Live Camera Scanner
            </strong>
            <small className="muted" style={{ fontSize: 11.5 }}>
              Hardware-accelerated QR Quick-Pass scanner
            </small>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isScanning && (
            <span
              className="badge green"
              style={{ gap: 5, fontSize: 11, animation: 'pulse 2s infinite' }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#10b981',
                  display: 'inline-block'
                }}
              />
              Camera Active
            </span>
          )}

          <button
            type="button"
            className="btn secondary"
            style={{ fontSize: 12, height: 34, gap: 5, padding: '0 12px' }}
            onClick={() => fileInputRef.current?.click()}
            title="Scan QR from a saved photo or screenshot"
          >
            <Upload size={13} /> Upload Image
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />
        </div>
      </div>

      {/* Main Viewfinder / State Container */}
      {!isScanning && permissionStatus !== 'denied' && permissionStatus !== 'requesting' && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(36, 91, 232, 0.04) 0%, rgba(32, 169, 145, 0.04) 100%)',
            border: '1.5px dashed var(--border)',
            borderRadius: 14,
            padding: '36px 20px',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(36, 91, 232, 0.12) 0%, rgba(32, 169, 145, 0.12) 100%)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px'
            }}
          >
            <Camera size={28} />
          </div>

          <h4 style={{ fontSize: 17, fontWeight: 650, color: 'var(--foreground)', margin: '0 0 6px' }}>
            Point Camera at Patient Emergency Pass
          </h4>

          <p
            className="muted small-text"
            style={{ maxWidth: 440, margin: '0 auto 20px', lineHeight: 1.7, fontSize: 12.5 }}
          >
            Medora requires camera allowance to scan and verify patient passes in real time. Your browser will prompt you to allow access.
          </p>

          <button
            type="button"
            className="btn primary"
            onClick={() => void startCamera()}
            style={{ gap: 8, height: 44, padding: '0 24px', fontSize: 13.5, fontWeight: 600 }}
          >
            <Camera size={16} /> Allow Camera & Start Scanner
          </button>
        </div>
      )}

      {/* State: Requesting Allowance */}
      {permissionStatus === 'requesting' && (
        <div
          style={{
            background: 'var(--muted)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: '36px 20px',
            textAlign: 'center'
          }}
        >
          <RefreshCw
            className="animate-spin"
            size={32}
            style={{ color: 'var(--primary)', margin: '0 auto 14px' }}
          />
          <h4 style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>
            Requesting Camera Allowance…
          </h4>
          <p className="muted small-text" style={{ maxWidth: 400, margin: '8px auto 0', lineHeight: 1.7 }}>
            Please click <strong>&quot;Allow&quot;</strong> in your browser&apos;s camera permission prompt to activate the live scanner.
          </p>
        </div>
      )}

      {/* State: Permission Denied */}
      {permissionStatus === 'denied' && (
        <div
          style={{
            background: '#fff2f4',
            border: '1px solid #facbd1',
            borderRadius: 14,
            padding: '24px 20px',
            textAlign: 'center'
          }}
        >
          <span
            className="icon-box pink"
            style={{ width: 48, height: 48, margin: '0 auto 12px', background: '#ffe4e8' }}
          >
            <CameraOff size={24} style={{ color: '#b72641' }} />
          </span>
          <h4 style={{ fontSize: 16, fontWeight: 650, color: '#b72641', margin: '0 0 6px' }}>
            Camera Allowance Needed
          </h4>
          <p
            style={{
              color: '#9f1239',
              fontSize: 12.5,
              lineHeight: 1.7,
              maxWidth: 460,
              margin: '0 auto 16px'
            }}
          >
            {errorMessage ||
              'Camera access was blocked by your browser. To allow camera access, click the lock/settings icon next to the address bar, toggle Camera to Allow, and retry.'}
          </p>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn primary"
              style={{ fontSize: 12.5, height: 38 }}
              onClick={() => void startCamera()}
            >
              <RefreshCw size={14} /> Request Camera Access Again
            </button>
            <button
              type="button"
              className="btn secondary"
              style={{ fontSize: 12.5, height: 38 }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} /> Upload QR Photo
            </button>
          </div>
        </div>
      )}

      {/* State: Active Video Scanner Viewfinder */}
      {isScanning && permissionStatus === 'granted' && (
        <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', background: '#000000' }}>
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            style={{
              width: '100%',
              height: '340px',
              objectFit: 'cover',
              display: 'block'
            }}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Futuristic Targeting Viewfinder Overlay */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none'
            }}
          >
            {/* Viewfinder Target Box */}
            <div
              style={{
                width: '240px',
                height: '240px',
                position: 'relative',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
                borderRadius: '16px'
              }}
            >
              {/* Corner Reticles */}
              <div
                style={{
                  position: 'absolute',
                  top: -2,
                  left: -2,
                  width: 24,
                  height: 24,
                  borderTop: '4px solid #10b981',
                  borderLeft: '4px solid #10b981',
                  borderTopLeftRadius: 10
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  width: 24,
                  height: 24,
                  borderTop: '4px solid #10b981',
                  borderRight: '4px solid #10b981',
                  borderTopRightRadius: 10
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: -2,
                  left: -2,
                  width: 24,
                  height: 24,
                  borderBottom: '4px solid #10b981',
                  borderLeft: '4px solid #10b981',
                  borderBottomLeftRadius: 10
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 24,
                  height: 24,
                  borderBottom: '4px solid #10b981',
                  borderRight: '4px solid #10b981',
                  borderBottomRightRadius: 10
                }}
              />

              {/* Animated Laser Sweep Line */}
              <div
                style={{
                  position: 'absolute',
                  left: '6px',
                  right: '6px',
                  height: '2px',
                  background: 'linear-gradient(90deg, transparent, #10b981 50%, transparent)',
                  boxShadow: '0 0 8px 1px #10b981',
                  animation: 'laserSweep 2.2s ease-in-out infinite'
                }}
              />
            </div>

            {/* Instruction Tag */}
            <span
              style={{
                marginTop: 16,
                padding: '5px 12px',
                borderRadius: 20,
                background: 'rgba(0, 0, 0, 0.7)',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: '0.2px',
                backdropFilter: 'blur(4px)'
              }}
            >
              Align Patient QR Pass within the square
            </span>
          </div>

          {/* Bottom Floating Control Bar */}
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              left: 12,
              right: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              zIndex: 10
            }}
          >
            {devices.length > 1 ? (
              <button
                type="button"
                className="btn secondary"
                onClick={handleSwitchCamera}
                style={{
                  fontSize: 11.5,
                  height: 34,
                  gap: 5,
                  background: 'rgba(255, 255, 255, 0.88)',
                  backdropFilter: 'blur(8px)'
                }}
              >
                <RefreshCw size={13} /> Switch Camera
              </button>
            ) : (
              <div />
            )}

            <button
              type="button"
              className="btn danger"
              onClick={stopCamera}
              style={{
                fontSize: 11.5,
                height: 34,
                gap: 5,
                background: '#c5344b',
                color: '#ffffff',
                borderColor: '#c5344b'
              }}
            >
              <X size={13} /> Close Camera
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
