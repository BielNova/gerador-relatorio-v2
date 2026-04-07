# Arquimedes BI

MVP interno para visualizar indicadores fiscais do Arquimedes com API FastAPI, frontend React/Vite e relatorios assistidos por IA.

## Estrutura

- `backend/`: API FastAPI que le o Postgres ao vivo e centraliza os exports `.xlsx`.
- `frontend/`: interface React/Vite para dashboard, filtros, ordenacao, navegacao e IA assistida.
- `sql/`: SQLs de referencia dos relatorios fiscais.
- `reports/`: exports gerados anteriormente para conferencia.

## Funcionalidades

- `Dashboard`: rota inicial com mapa geral separado por area: Comercial, Financeiro, Estoque, Fiscal, Producao, RH/Folha, Contabil, Academico, Base Compartilhada, Servicos/Projetos e Confeccao.
- `Fiscal em foco`: primeiro modulo detalhado, com indicadores de produto, NCM, aliquotas e pendencias cadastrais.
- `Produtos Acabados`: lista produto, descricao, grupo, NCM e aliquotas ICMS/IPI/PIS/COFINS pela classificacao fiscal do produto.
- `NCM e Aliquotas`: lista combinacoes distintas de NCM + aliquotas e destaca NCMs com variacao.
- `Relatorios com IA`: classifica pedidos em intents permitidas e executa filtros seguros no backend, sem SQL livre.
- Exports Excel: gerados no backend por endpoints `.xlsx`, incluindo os filtros aplicados na tela.

## Variaveis de ambiente

O arquivo `.env` na raiz deve conter:

```env
DATABASE_URL=postgresql://postgres:senha@localhost:5432/banco
GROQ_API_KEY=sua_chave_groq
GROQ_MODEL=llama-3.1-8b-instant
```

`GROQ_API_KEY` e obrigatoria somente ao usar `/api/ai/report-assistant`. `GROQ_MODEL` e opcional; se ausente, a API usa `llama-3.1-8b-instant`. A chave que apareceu no chat deve ser rotacionada antes de uso real.

## Rodando a API

Na raiz do projeto:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --reload
```

Se voce ja estiver dentro de `backend/`:

```powershell
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

API em `http://127.0.0.1:8000`.

Endpoints principais:

- `GET /api/companies`
- `GET /api/dashboard/overview?company=emp0001`
- `GET /api/dashboard/fiscal?company=emp0001`
- `GET /api/reports/products-finished?company=emp0001`
- `GET /api/reports/ncm-tax-rates?company=emp0001`
- `GET /api/reports/products-finished/export.xlsx?company=emp0001`
- `GET /api/reports/ncm-tax-rates/export.xlsx?company=emp0001`
- `POST /api/ai/report-assistant`

## Rodando o frontend

Em outro terminal:

```powershell
cd frontend
npm install
npm run dev
```

Frontend em `http://127.0.0.1:5173`.

## Testes

Backend:

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests
```

Frontend:

```powershell
cd frontend
npm test -- --run
npm run lint
npm run build
npm audit
```
