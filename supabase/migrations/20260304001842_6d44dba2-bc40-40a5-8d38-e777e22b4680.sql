-- Fix old trechos that have null secao: set based on estaca range
-- E0 to E-3 = STOPWAY, E-3 to E-15 = RESA, rest = PPD
UPDATE trechos_retigrafico 
SET secao = 'PPD' 
WHERE secao IS NULL AND estaca_inicial::int >= 0;

UPDATE trechos_retigrafico 
SET secao = 'STOPWAY' 
WHERE secao IS NULL AND estaca_inicial::int >= -3 AND estaca_inicial::int < 0;

UPDATE trechos_retigrafico 
SET secao = 'RESA' 
WHERE secao IS NULL AND estaca_inicial::int < -3;