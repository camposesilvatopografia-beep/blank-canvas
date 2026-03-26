-- Remove duplicate trechos, keeping only the one with the lowest ordem per estaca_inicial + faixa + obra_id combo
DELETE FROM trechos_retigrafico
WHERE id NOT IN (
  SELECT DISTINCT ON (obra_id, estaca_inicial, COALESCE(faixa, ''), COALESCE(secao, '')) id
  FROM trechos_retigrafico
  ORDER BY obra_id, estaca_inicial, COALESCE(faixa, ''), COALESCE(secao, ''), ordem ASC
);

-- Also remove old trechos without faixa that have a newer version with faixa
DELETE FROM trechos_retigrafico
WHERE faixa IS NULL
AND EXISTS (
  SELECT 1 FROM trechos_retigrafico t2
  WHERE t2.obra_id = trechos_retigrafico.obra_id
  AND t2.estaca_inicial = trechos_retigrafico.estaca_inicial
  AND t2.faixa IS NOT NULL
);