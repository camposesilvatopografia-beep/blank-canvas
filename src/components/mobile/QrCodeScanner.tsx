import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, X, Loader2 } from 'lucide-react';

interface QrCodeScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
}

export default function QrCodeScanner({ onScan, onClose }: QrCodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const mountId = 'qr-reader-region';

  useEffect(() => {
    const scanner = new Html5Qrcode(mountId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          scanner.stop().catch(() => {});
          onScan(decodedText);
        },
        () => {}
      )
      .then(() => setStarting(false))
      .catch((err) => {
        setStarting(false);
        setError('Não foi possível acessar a câmera. Verifique as permissões.');
        console.error('QR Scanner error:', err);
      });

    return () => {
      scanner.stop().catch(() => {});
    };
  }, [onScan]);

  return (
    <Card className="bg-gray-900 border-2 border-blue-400 p-4 rounded-2xl shadow-lg relative">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-white">
          <Camera className="w-5 h-5" />
          <span className="font-bold text-lg">Scanner QR Code</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-white/20 h-10 w-10"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {starting && (
        <div className="flex items-center justify-center py-8 text-white gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Abrindo câmera...</span>
        </div>
      )}

      <div id={mountId} className="rounded-xl overflow-hidden" />

      {error && (
        <p className="text-red-400 text-center mt-3 text-sm">{error}</p>
      )}

      <p className="text-gray-400 text-center text-sm mt-3">
        Aponte a câmera para o QR Code do veículo
      </p>
    </Card>
  );
}
