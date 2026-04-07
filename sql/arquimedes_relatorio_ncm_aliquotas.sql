SELECT DISTINCT
  trim(c.cl_cl_fisc) AS ncm,
  c.cl_icms AS aliquota_icms,
  c.cl_ipi AS aliquota_ipi,
  c.cl_pis AS aliquota_pis,
  c.cl_cofins AS aliquota_cofins
FROM emp0001.esclassf AS c
WHERE trim(c.cl_codigo) <> ''
  AND trim(COALESCE(c.cl_cl_fisc, '')) <> ''
ORDER BY
  trim(c.cl_cl_fisc),
  c.cl_icms,
  c.cl_ipi,
  c.cl_pis,
  c.cl_cofins;
