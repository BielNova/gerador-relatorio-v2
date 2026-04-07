SELECT
  trim(p.pr_codigo) AS codigo_produto_acabado,
  trim(p.pr_descr) AS descricao_produto_acabado,
  trim(COALESCE(g.gr_descr, '')) AS grupo,
  trim(COALESCE(c.cl_cl_fisc, '')) AS ncm,
  c.cl_icms AS aliquota_icms,
  c.cl_ipi AS aliquota_ipi,
  c.cl_pis AS aliquota_pis,
  c.cl_cofins AS aliquota_cofins
FROM emp0001.esprod AS p
LEFT JOIN emp0001.esgrupo AS g
  ON g.gr_codigo = p.pr_grupo
LEFT JOIN emp0001.esclassf AS c
  ON c.cl_codigo = p.pr_classf
WHERE p.pr_tipo = 1
  AND COALESCE(p.pr_inativ, FALSE) = FALSE
  AND p.pr_it_prd = TRUE
  AND trim(p.pr_codigo) <> ''
ORDER BY
  trim(COALESCE(g.gr_descr, '')),
  trim(p.pr_descr),
  trim(p.pr_codigo);
