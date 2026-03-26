import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { useObraConfig } from '@/hooks/useObraConfig';
import { useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RequisicaoData {
  numero_requisicao?: string | null;
  data?: string;
  materialNome?: string;
  materialUnidade?: string;
  quantidade?: number;
  local_uso?: string | null;
  etapa_obra?: string | null;
  equipe?: string | null;
  responsavel?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  data: RequisicaoData | null;
}

export default function AlmRequisicaoPrint({ open, onClose, data }: Props) {
  const { obraConfig } = useObraConfig();
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Requisição ${data?.numero_requisicao}</title>
      <style>body{font-family:Arial,sans-serif;padding:40px;color:#000}
      table{width:100%;border-collapse:collapse;margin:16px 0}
      td,th{border:1px solid #333;padding:8px;text-align:left}
      th{background:#1d3557;color:#fff}
      .sig{margin-top:60px;display:flex;justify-content:space-between;gap:40px}
      .sig-line{flex:1;text-align:center;border-top:1px solid #000;padding-top:8px;font-size:13px}
      h2{text-align:center;color:#1d3557}
      </style></head><body>${content.innerHTML}</body></html>`);
    win.document.close();
    win.print();
  };

  if (!data) return null;

  const dataFormatted = data.data ? format(new Date(data.data + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR }) : '';

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Requisição de Material</DialogTitle></DialogHeader>
        <div ref={printRef}>
          <h2 style={{ textAlign: 'center', color: '#1d3557', margin: '0 0 4px' }}>REQUISIÇÃO DE MATERIAL</h2>
          <p style={{ textAlign: 'center', fontSize: 13, color: '#666' }}>{obraConfig?.nome || 'Obra'}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', margin: '12px 0' }}>
            <tbody>
              <tr><td style={{ border: '1px solid #333', padding: 6, fontWeight: 'bold', width: '40%' }}>Nº Requisição</td><td style={{ border: '1px solid #333', padding: 6 }}>{data.numero_requisicao}</td></tr>
              <tr><td style={{ border: '1px solid #333', padding: 6, fontWeight: 'bold' }}>Data</td><td style={{ border: '1px solid #333', padding: 6 }}>{dataFormatted}</td></tr>
              <tr><td style={{ border: '1px solid #333', padding: 6, fontWeight: 'bold' }}>Material</td><td style={{ border: '1px solid #333', padding: 6 }}>{data.materialNome}</td></tr>
              <tr><td style={{ border: '1px solid #333', padding: 6, fontWeight: 'bold' }}>Quantidade</td><td style={{ border: '1px solid #333', padding: 6 }}>{data.quantidade} {data.materialUnidade}</td></tr>
              <tr><td style={{ border: '1px solid #333', padding: 6, fontWeight: 'bold' }}>Local / Etapa</td><td style={{ border: '1px solid #333', padding: 6 }}>{data.etapa_obra || data.local_uso || '-'}</td></tr>
              <tr><td style={{ border: '1px solid #333', padding: 6, fontWeight: 'bold' }}>Retirado por</td><td style={{ border: '1px solid #333', padding: 6 }}>{data.equipe || '-'}</td></tr>
              <tr><td style={{ border: '1px solid #333', padding: 6, fontWeight: 'bold' }}>Resp. Almoxarifado</td><td style={{ border: '1px solid #333', padding: 6 }}>{data.responsavel || '-'}</td></tr>
            </tbody>
          </table>
          <div style={{ marginTop: 60, display: 'flex', justifyContent: 'space-between', gap: 40 }}>
            <div style={{ flex: 1, textAlign: 'center', borderTop: '1px solid #000', paddingTop: 8, fontSize: 13 }}>Assinatura do funcionário</div>
            <div style={{ flex: 1, textAlign: 'center', borderTop: '1px solid #000', paddingTop: 8, fontSize: 13 }}>Assinatura do responsável</div>
          </div>
        </div>
        <Button onClick={handlePrint} className="w-full mt-2"><Printer className="w-4 h-4 mr-2" /> Imprimir Requisição</Button>
      </DialogContent>
    </Dialog>
  );
}
