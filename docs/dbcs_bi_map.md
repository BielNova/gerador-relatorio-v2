# Mapa Inicial do DBCS para BI e Relatórios com IA

Origem analisada:

- `C:\Users\letic\Downloads\DBCS.rar`
- Extraído em `C:\Users\letic\Downloads\gerador-relatorio-v2\_dbcs_html`

Leitura consolidada:

- 23 arquivos HTML
- 339 tabelas documentadas
- 1093 visualizações SQL documentadas
- `d*.html` documenta tabelas
- `r*.html` documenta visualizações e consultas SQL

## Domínios do banco

| Domínio | Estrutura | Visualizações | Leitura funcional |
| --- | ---: | ---: | --- |
| `AE` | 26 | 169 | Acadêmico: classes, cursos, séries, matrículas, notas, histórico escolar |
| `CF` | 13 | 27 | Peça piloto, oficinas, piloteiros, inventário ligado à confecção |
| `CT` | 28 | 35 | Contábil: plano de contas, lançamentos, balanço, DRE, centros de custo |
| `CV` | 53 | 394 | Comercial: clientes, contratos, pedidos, faturamento, campanhas, aprovação |
| `EF` | 13 | 12 | Fiscal: fatura, apuração, inventário fiscal, ECF, redução Z |
| `ES` | 41 | 89 | Estoque/produto: cadastro de produto, grupo, marca, estoque, movimento, preço |
| `EX` | 19 | 0 | Cadastros corporativos e parâmetros globais: empresa, município, perfis |
| `FN` | 45 | 195 | Financeiro: títulos, boletos, recebimentos, pagamentos, bancos, cartões |
| `FO` | 8 | 16 | Serviços/autônomos/projetos/RPA |
| `FP` | 60 | 105 | RH/Folha: funcionário, salário, eventos, lançamentos, afastamentos |
| `PR` | 21 | 38 | Produção: engenharia, ordem de produção, PCP, itens, operadores |
| `ST` | 12 | 13 | Base compartilhada: pessoa, endereço, estado, país, CFOP, ocorrências |

## Entidades centrais para o BI

As visualizações existentes mostram quais tabelas são os hubs reais do sistema. As mais reutilizadas são:

- `DST.STPESS`: cadastro unificado de pessoas físicas e jurídicas
- `DST.STENDER`, `DST.STESTADO`, `DST.STPAIS`: endereço e geografia
- `DES.ESPROD`: produto
- `DCV.CVCLIFOR`: cliente/fornecedor
- `DCV.CVPEDIDO` e `DCV.CVPEDIT`: pedido e item de pedido
- `DCV.CVFATURA` e `DCV.CVFATIT`: faturamento
- `DFN.FNTITUL`, `DFN.FNRECEB`, `DFN.FNPAGAM`, `DFN.FNPAGTO`: financeiro
- `DAE.AEMATRIC`, `DAE.AEMATCLA`, `DAE.AECLASSE`, `DAE.AECURSO`, `DAE.AESERIE`: acadêmico
- `DFP.FPFUNC`, `DFP.FPSALAR`, `DFP.FPLANCT`, `DFP.FPLANC`, `DFP.FPEVENT`: folha
- `DPR.PRORDEM`, `DPR.PRORDIT`, `DPR.PRORDPRD`, `DPR.PRORDMVT`: produção
- `DCT.CTPCONTA`, `DCT.CTLANCTO`, `DCT.CTCUSTO`, `DCT.CTPCUSTO`: contábil

## O que isso indica para o projeto

O banco já tem uma camada rica de SQL pronto nas visualizações `r*.html`. Isso é valioso por três motivos:

1. Os joins já aparecem validados pelo sistema legado.
2. As regras de negócio já estão embutidas em filtros, parâmetros e relacionamentos.
3. Essa camada pode virar a base de uma engine de relatórios com IA, usando as visualizações como conhecimento confiável para geração de consultas.

## Marts iniciais recomendados

Se o objetivo for um dashboard BI mais útil logo no início, os melhores recortes para começar são:

1. Comercial e faturamento
   Base principal: `DCV` + `DES` + `DST` + `DFN`
2. Financeiro
   Base principal: `DFN` + `DST` + `DCV`
3. Acadêmico
   Base principal: `DAE` + `DST` + `DFN`
4. RH/Folha
   Base principal: `DFP` + `DST`
5. Produção e estoque
   Base principal: `DPR` + `DES` + `DST`

## Leitura prática dos HTMLs

Resumo do que ficou claro na análise:

- `DCV` é o domínio mais rico em visualizações e parece ser um dos melhores candidatos para o primeiro dashboard operacional.
- `DFN` é forte para contas a receber, boletos, pagamentos e inadimplência.
- `DES` concentra produto, estoque, movimentos e preço, o que fecha bem com comercial e produção.
- `DST` é a camada mestre compartilhada; quase todo BI vai depender dela.
- `DAE` mostra que o ERP também cobre gestão escolar/acadêmica.
- `R*` não é apenas documentação; é praticamente um catálogo de consultas prontas do sistema.

## Próximo passo sugerido

Para a fase de produto, o caminho mais sólido é:

1. escolher um primeiro domínio de negócio;
2. transformar as visualizações principais desse domínio em uma camada semântica;
3. modelar um backend que exponha indicadores prontos e consultas assistidas por IA;
4. só depois abrir geração livre de relatórios, sempre limitada ao catálogo conhecido de tabelas, joins e métricas.
