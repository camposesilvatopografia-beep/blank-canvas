DROP POLICY "Authenticated can delete evolucao_obra_execucoes" ON public.evolucao_obra_execucoes;
CREATE POLICY "Authenticated can delete evolucao_obra_execucoes"
ON public.evolucao_obra_execucoes
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);