<p align="center">
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/SQLAlchemy-D71F00?style=for-the-badge&logo=sqlalchemy&logoColor=white" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
</p>

<h1 align="center">Orquestrador de Projetos</h1>

<p align="center">
  <strong>Plataforma completa de gestão e orquestração de projetos</strong><br/>
  <sub>Rastreamento de etapas, tarefas, colaboradores, apontamento de horas e integração GLPI</sub>
</p>

<p align="center">
  <a href="#-funcionalidades">Funcionalidades</a> •
  <a href="#-stack-tecnológica">Stack</a> •
  <a href="#-início-rápido">Início Rápido</a> •
  <a href="#-estrutura-do-projeto">Estrutura</a> •
  <a href="#-segurança">Segurança</a> •
  <a href="#-api-endpoints">API</a>
</p>

---

## Funcionalidades

### Gestão de Projetos
- **Projetos** com classificação por complexidade, criticidade e escopo
- **Etapas & Tarefas** em hierarquia (Projeto → Etapas → Tarefas → Subtarefas)
- **Dependências** entre tarefas com cálculo de caminho crítico
- **Baselines** manuais e automáticas para controle de replanejamento
- **Sprints** para organização ágil por projeto
- **Templates** para replicar estruturas de projetos

### Apontamento de Horas
- Registro de horas por **projetos** (etapa/tarefa) e por **chamados GLPI**
- Widget de lançamento rápido de horas
- Visualização unificada de horas (projetos + chamados)
- Exportação para **Excel** com múltiplas abas e formatação Minerva

### Dashboards & Relatórios
- **Dashboard Executivo** com indicadores SPI, CPI e análise de risco
- **Visão do Time** com distribuição de horas, aderência e métricas por colaborador
- **Gráfico de Evolução** (Curva S) com linhas de planejado, executado e replanejado
- **Cronograma Gantt** interativo com barras de previsto e real
- **Carga de Trabalho** semanal por colaborador

### Colaboradores & Perfil
- Integração com **Active Directory** (autenticação LDAP)
- Perfil pessoal editável (foto, bio, telefone, link)
- Controle de papéis: Admin, Analyst, Manager, Viewer
- Fluxo de aprovação de novos usuários

### Integrações
- **GLPI** — busca e vinculação de chamados com preenchimento automático
- **Active Directory** — sincronização de dados organizacionais no login

---

## Stack Tecnológica

| Camada       | Tecnologia                                      |
|--------------|------------------------------------------------|
| **Backend**  | Python 3.12 · FastAPI · SQLAlchemy · Pydantic  |
| **Frontend** | React 19 · TypeScript · Vite                   |
| **UI**       | Tailwind CSS v4 · Lucide Icons · Recharts      |
| **Auth**     | LDAP/AD · JWT · Cookies httpOnly               |
| **Banco**    | SQLite (dev) · PostgreSQL (prod)               |
| **Deploy**   | Docker · Docker Compose · Nginx                |

---

## Início Rápido

### Com Docker (recomendado)

```bash
git clone https://github.com/LeviCury/Orquestrador-de-Projetos.git
cd Orquestrador-de-Projetos
docker compose up --build
```

| Serviço      | URL                              |
|-------------|----------------------------------|
| Frontend    | http://localhost:3000             |
| Backend API | http://localhost:8000/docs        |
| PostgreSQL  | localhost:5432                    |

### Desenvolvimento Local

#### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/Mac
pip install -r requirements.txt

# Copiar e configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais

uvicorn app.main:app --reload
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

O frontend roda em `http://localhost:5173` com proxy automático para o backend.

---

## Configuração

Crie o arquivo `backend/.env` baseado no `.env.example`:

```env
# LDAP / Active Directory
LDAP_SERVER=ldap://seu-servidor-ad:389
LDAP_BASE_DN=OU=SuaOrg,DC=exemplo,DC=local
LDAP_SVC_USER=conta_servico
LDAP_SVC_PASSWORD=

# JWT
JWT_SECRET=gere-um-segredo-forte-aqui

# GLPI API
GLPI_BASE_URL=https://seu-glpi.com/apirest.php
GLPI_APP_TOKEN=
GLPI_AUTH_BASIC=

# CORS
CORS_ORIGINS=http://localhost:5173
```

---

## Estrutura do Projeto

```
Orquestrador-de-Projetos/
├── backend/
│   ├── app/
│   │   ├── main.py              # App FastAPI + middleware de auth
│   │   ├── auth.py              # JWT, get_current_user
│   │   ├── config.py            # Variáveis de ambiente
│   │   ├── database.py          # Engine SQLAlchemy
│   │   ├── models.py            # Modelos ORM (padrão SQL Minerva)
│   │   ├── schemas.py           # Schemas Pydantic
│   │   ├── automations.py       # Regras de automação de status
│   │   ├── glpi.py              # Cliente REST do GLPI
│   │   ├── utils.py             # Funções auxiliares
│   │   └── routers/
│   │       ├── auth.py          # Login LDAP, perfil, aprovação
│   │       ├── projects.py      # CRUD projetos + baselines
│   │       ├── stages.py        # CRUD etapas
│   │       ├── tasks.py         # CRUD tarefas
│   │       ├── subtasks.py      # CRUD subtarefas
│   │       ├── collaborators.py # CRUD colaboradores
│   │       ├── time_entries.py  # Horas + exportação Excel
│   │       ├── tickets.py       # Horas de chamados GLPI
│   │       ├── dashboard.py     # Dashboards e métricas
│   │       ├── sprints.py       # Sprints ágeis
│   │       ├── dependencies.py  # Dependências + caminho crítico
│   │       ├── templates.py     # Templates de projeto
│   │       ├── attachments.py   # Anexos de arquivos
│   │       ├── notifications.py # Notificações
│   │       ├── activities.py    # Feed de atividades
│   │       ├── search.py        # Busca global
│   │       ├── mywork.py        # "Meu Trabalho"
│   │       └── glpi.py          # Proxy GLPI
│   ├── .env.example
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/client.ts        # Axios client autenticado
│   │   ├── contexts/            # AuthContext (estado global)
│   │   ├── components/          # Layout, Toast, Skeleton, etc.
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx    # Dashboard executivo
│   │   │   ├── Projects.tsx     # Lista de projetos
│   │   │   ├── ProjectDetail.tsx# Detalhe com Gantt e cronograma
│   │   │   ├── Collaborators.tsx# Cards de colaboradores
│   │   │   ├── CollaboratorDetail.tsx
│   │   │   ├── TimeEntries.tsx  # Apontamento unificado
│   │   │   ├── Tickets.tsx      # Horas de chamados
│   │   │   ├── MyWork.tsx       # Meu trabalho
│   │   │   ├── Profile.tsx      # Perfil pessoal
│   │   │   ├── Admin.tsx        # Painel administrativo
│   │   │   ├── Workload.tsx     # Carga de trabalho
│   │   │   ├── Templates.tsx    # Templates de projeto
│   │   │   └── Login.tsx        # Tela de login
│   │   └── types/index.ts       # Tipos TypeScript
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## Segurança

| Medida | Descrição |
|--------|-----------|
| **Autenticação global** | Middleware intercepta todas as rotas `/api/*`, exigindo JWT válido |
| **Cookies httpOnly** | Token armazenado em cookie seguro, mitigando XSS |
| **Rate limiting** | 5 tentativas de login por IP a cada 5 minutos |
| **CORS restrito** | Origens permitidas configuráveis via variável de ambiente |
| **Uploads protegidos** | Arquivos servidos apenas para usuários autenticados |
| **Sem segredos no código** | Credenciais carregadas exclusivamente de `.env` |
| **Controle de papéis** | Viewers bloqueados de escrita; admins com poderes elevados |
| **Validação de input** | Pydantic schemas + regex no login contra injection |

---

## API Endpoints

### Autenticação
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/auth/login` | Login via Active Directory |
| GET | `/api/auth/me` | Usuário autenticado |
| PUT | `/api/auth/me/avatar` | Upload de foto de perfil |
| PUT | `/api/auth/me/profile` | Atualizar bio, telefone, link |

### Projetos
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/projects/` | Listar projetos |
| POST | `/api/projects/` | Criar projeto |
| GET | `/api/projects/{id}` | Detalhe com etapas e baselines |
| PUT | `/api/projects/{id}` | Atualizar projeto |
| DELETE | `/api/projects/{id}` | Remover projeto |
| POST | `/api/projects/{id}/baselines` | Criar baseline |

### Etapas, Tarefas e Subtarefas
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET/POST | `/api/stages/project/{id}` | Listar/criar etapas |
| PUT/DELETE | `/api/stages/{id}` | Atualizar/remover etapa |
| GET/POST | `/api/tasks/stage/{id}` | Listar/criar tarefas |
| PUT/DELETE | `/api/tasks/{id}` | Atualizar/remover tarefa |
| GET/POST | `/api/subtasks/task/{id}` | Listar/criar subtarefas |

### Horas
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET/POST | `/api/time-entries/` | Horas de projeto |
| POST | `/api/time-entries/quick` | Lançamento rápido |
| GET | `/api/time-entries/unified` | Visão unificada |
| GET | `/api/time-entries/export-excel` | Exportar Excel |
| GET/POST | `/api/tickets/hours` | Horas de chamados GLPI |

### Dashboards
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/dashboard/summary` | Resumo geral |
| GET | `/api/dashboard/executive` | Dashboard executivo (SPI/CPI) |
| GET | `/api/dashboard/team-overview` | Visão do time |
| GET | `/api/dashboard/timeline` | Gantt chart |
| GET | `/api/dashboard/workload/{id}` | Carga de trabalho |

---

## Padrões de Código

### Banco de Dados (Padrão Minerva SQL)
- Tabelas: prefixo `tab_` (ex: `tab_project`, `tab_task`)
- Colunas: prefixos semânticos (`id_`, `dt_`, `name_`, `desc_`, `val_`, `ind_`, `txt_`, `json_`)
- Snake_case, lowercase, nomes em inglês
- Mapeamento ORM: atributos Python mantêm nomes limpos via `Column("db_name", ...)`

---

## Licença

Projeto interno — Minerva Foods S.A.
