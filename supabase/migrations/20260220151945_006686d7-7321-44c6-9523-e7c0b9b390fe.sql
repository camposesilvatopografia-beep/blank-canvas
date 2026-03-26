-- Adicionar campos à tabela rdo_obras (dados fixos da obra/contrato)
ALTER TABLE public.rdo_obras
  ADD COLUMN IF NOT EXISTS objeto TEXT,
  ADD COLUMN IF NOT EXISTS licenca_ambiental DATE,
  ADD COLUMN IF NOT EXISTS outorgas_agua TEXT,
  ADD COLUMN IF NOT EXISTS dias_aditados INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dias_paralisados INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_inicio_contrato DATE,
  ADD COLUMN IF NOT EXISTS prazo_contratual_dias INTEGER,
  ADD COLUMN IF NOT EXISTS data_prazo_contratual DATE,
  ADD COLUMN IF NOT EXISTS vigencia_inicial DATE,
  ADD COLUMN IF NOT EXISTS vigencia_final DATE,
  ADD COLUMN IF NOT EXISTS usina_cbuq BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS usina_solos BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS usina_concreto BOOLEAN DEFAULT FALSE;

-- Adicionar campos à tabela rdos (dados variáveis por dia)
ALTER TABLE public.rdos
  ADD COLUMN IF NOT EXISTS precipitacao_acumulada_mes NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prazo_decorrido INTEGER,
  ADD COLUMN IF NOT EXISTS prazo_restante INTEGER,
  ADD COLUMN IF NOT EXISTS prazo_restante_vigencia INTEGER,
  ADD COLUMN IF NOT EXISTS novo_prazo_contratual DATE;
