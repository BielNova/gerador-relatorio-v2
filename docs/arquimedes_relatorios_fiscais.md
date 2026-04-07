# Relatórios fiscais para o Arquimedes

## Origem dos campos

### Relatório 1: produtos acabados

- `ESPROD.PR_CODIGO`: código do produto acabado
- `ESPROD.PR_DESCR`: descrição do produto acabado
- `ESGRUPO.GR_DESCR`: descrição do grupo
- `ESCLASSF.CL_CL_FISC`: NCM
- `ESCLASSF.CL_ICMS`: aliquota de ICMS vinculada ao produto
- `ESCLASSF.CL_IPI`: aliquota de IPI vinculada ao produto
- `ESCLASSF.CL_PIS`: aliquota de PIS vinculada ao produto
- `ESCLASSF.CL_COFINS`: aliquota de COFINS vinculada ao produto

Join principal:

```sql
ESPROD.PR_GRUPO  -> ESGRUPO.GR_CODIGO
ESPROD.PR_CLASSF -> ESCLASSF.CL_CODIGO
```

Filtro aplicado para "produto acabado":

```sql
ESPROD.PR_TIPO = 1
AND ESPROD.PR_IT_PRD = TRUE
AND COALESCE(ESPROD.PR_INATIV, FALSE) = FALSE
```

### Relatório 2: NCM e alíquotas

- `ESCLASSF.CL_CL_FISC`: NCM
- `ESCLASSF.CL_ICMS`: alíquota de ICMS
- `ESCLASSF.CL_IPI`: alíquota de IPI
- `ESCLASSF.CL_PIS`: alíquota de PIS
- `ESCLASSF.CL_COFINS`: alíquota de COFINS

## Arquivos gerados

- `sql/arquimedes_relatorio_produtos_acabados.sql`
- `sql/arquimedes_relatorio_ncm_aliquotas.sql`
- `scripts/export_arquimedes_fiscal_reports.py`
- `reports/arquimedes_relatorio_produtos_acabados.csv`
- `reports/arquimedes_relatorio_ncm_aliquotas.csv`

## Validação no banco atual

- `3390` linhas no relatório de produtos acabados
- `1197` linhas no relatório de NCM e alíquotas
- `684` NCMs distintos no cadastro fiscal
- `293` produtos acabados ativos estão sem NCM preenchido

## Observação importante

O cadastro fiscal permite que o mesmo `NCM` apareça em mais de uma classificação fiscal com alíquotas diferentes. Por isso, o segundo relatório foi exportado com uma linha por combinação distinta de:

- `NCM`
- `Alíquota ICMS`
- `Alíquota IPI`
- `Alíquota PIS`
- `Alíquota COFINS`

Se você precisar obrigatoriamente de uma única linha por `NCM`, será necessário definir a regra de consolidação.
