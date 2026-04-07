from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class BusinessAreaConfig:
    id: str
    label: str
    description: str
    tables: tuple[str, ...]
    entryPath: str | None = None


BUSINESS_AREAS: tuple[BusinessAreaConfig, ...] = (
    BusinessAreaConfig(
        id="comercial",
        label="Comercial",
        description="Clientes, pedidos, itens, faturamento e carteira comercial.",
        tables=("cvclifor", "cvpedido", "cvpedit", "cvfatura", "cvfatit"),
    ),
    BusinessAreaConfig(
        id="financeiro",
        label="Financeiro",
        description="Titulos, boletos, recebimentos, pagamentos e caixa/bancos.",
        tables=("fntitul", "fnreceb", "fnpagam", "fnpagto", "fnboleto"),
        entryPath="/finance",
    ),
    BusinessAreaConfig(
        id="estoque",
        label="Estoque e Produto",
        description="Produtos, grupos, saldo, movimentos, marcas e estrutura de estoque.",
        tables=("esprod", "esestoq", "esmovim", "esgrupo", "esmarca"),
        entryPath="/products",
    ),
    BusinessAreaConfig(
        id="fiscal",
        label="Fiscal",
        description="Classificacao fiscal, NCM, aliquotas, faturas fiscais e apuracao.",
        tables=("esclassf", "effatura", "efapur", "efinvent", "stcfop"),
        entryPath="/ncm-tax-rates",
    ),
    BusinessAreaConfig(
        id="producao",
        label="Producao",
        description="Ordens de producao, itens, produtos da ordem, processos e operadores.",
        tables=("prordem", "prordit", "prordprd", "prproces", "properad"),
    ),
    BusinessAreaConfig(
        id="rh_folha",
        label="RH e Folha",
        description="Funcionarios, salarios, eventos, lancamentos e movimentos de folha.",
        tables=("fpfunc", "fpsalar", "fplanct", "fplanc", "fpevent"),
    ),
    BusinessAreaConfig(
        id="contabil",
        label="Contabil",
        description="Plano de contas, lancamentos, centro de custo, DRE e balanco.",
        tables=("ctpconta", "ctlancto", "ctcusto", "ctdre", "ctbalan"),
    ),
    BusinessAreaConfig(
        id="academico",
        label="Academico",
        description="Cursos, series, classes, matriculas e vinculos academicos.",
        tables=("aematric", "aematcla", "aeclasse", "aecurso", "aeserie"),
    ),
    BusinessAreaConfig(
        id="base",
        label="Base Compartilhada",
        description="Pessoas, enderecos, estados, paises, CFOP e cadastros comuns.",
        tables=("stpess", "stender", "stestado", "stpais", "stcfop"),
    ),
    BusinessAreaConfig(
        id="servicos",
        label="Servicos e Projetos",
        description="Autonomos, contratos, projetos, RPA, servicos e referencias.",
        tables=("foauton", "focontr", "foproj", "forpa", "foserv"),
    ),
    BusinessAreaConfig(
        id="confeccao",
        label="Confeccao",
        description="Peca piloto, oficinas, piloteiros, inventario e movimentos de confeccao.",
        tables=("cfpeca", "cfpilot", "cfpiloto", "cfoficin", "cfinvent"),
    ),
)


COMPANY_HEALTH_TABLES = (
    "stpess",
    "cvpedido",
    "fntitul",
    "esprod",
    "esclassf",
    "prordem",
    "fpfunc",
    "ctlancto",
    "aematric",
)
