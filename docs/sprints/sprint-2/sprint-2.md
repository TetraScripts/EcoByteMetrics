# 📄 Sprint Review — Sprint 2

## Projeto: EcoByteMetrics (GreenER) | Período: 20/10/2026 a 09/11/2026

## 🎥 1. Demonstração em Vídeo & Evidências Principais

<table>
  <tr>
    <td width="50%" align="center" valign="middle">
      <!-- target="_blank" garante a abertura em nova guia no navegador -->
      <a href="https://www.youtube.com/watch?v=I2eUKGZDlMA" target="_blank">
        <img src="https://img.youtube.com/vi/I2eUKGZDlMA/mqdefault.jpg" 
             alt="Prévia do Vídeo da Sprint Review" 
             width="100%" />
      </a>
    </td>
    <td width="60%" valign="top">
      <h4>🎬 Demonstração Prática — Sprint Review 2</h4>
      <p>Neste vídeo, a equipe apresenta o incremento funcional desenvolvido durante a primeira Sprint do <b>EcoByteMetrics (GreenER)</b>:</p>
      <ul>
        <li><b>Orquestração Docker:</b> Subida unificada do ambiente containerizado (Frontend, Backend e PostgreSQL).</li>
        <li><b>Persistência Nativa:</b> Execução dos scripts <code>database/ddl.sql</code> diretamente no PostgreSQL sem o uso de ORM.</li>
      </ul>
    </td>
  </tr>
</table>

---

## 🎯  2. Objetivo da Sprint

Desenvolver e consolidar a inteligência de negócios, a persistência histórica e a resiliência do sistema, construindo a interface do Dashboard Operacional e Tabela de Ranking de Impacto (US03), o Motor de Cálculos Ambientais (kWh e gCO_2e) com armazenamento temporal no PostgreSQL via SQL nativo (US04), os mecanismos de resiliência e tratamento de exceções contra quedas ou falhas em APIs externas (US05) e a segurança de rotas por autenticação JWT (US06)

---

## 📊 3. Resumo de Entregas (US03, US04, US05, US06 & Refatoração)

| User Story / Frente | Sub-issues Concluídas | Requisitos Cobertos |
| :--- | :--- | :--- |
| **US03 (#5)** — Dashboard & Ranking de Impacto | `#01` (Dashboard/Serviços), `#02` (Ranking/Filtros), `#03` (Polling/Mobile) | RF09, RF14, RNF01, RNF02, RNF03, RP01 |
| **US04 (#6)** — Motor Ambiental & Histórico | `#33` (Variação de Métricas & Inserção 1, 2), Sub-issues de Cálculo ((kWh)/(gCO_2e)) | RF07, RF08, RF10, RP03, BD02, BD04 |
| **US05 (#7)** — Resiliência & Tolerância a Falhas | `#33` (Variação), `#34` (Indisponibilidade), `#35` (Ausência de Métricas), `#36` (Middleware Exceções) | RF04, RF05, RF06, RNF04, TP03 |
| **US06 (#8)** — Autenticação JWT na Configuração | Módulo de Auth/Login, Middleware de Proteção Bearer Token JWT | RP06, DW06 |
| **Docs (#93)** — Refatoração da Documentação | Atualização do `README.md`, `schema.sql`, `docs/api.md`, `docs/calculos.md` e `docs/plano-de-entregas.md` | RNF05, RP07 |

<details>
<summary><b>🔍 Clique aqui para expandir a lista simplificada de tarefas entregues na Sprint 2</b></summary>

* **US03 — Dashboard Operacional e Ranking (#5):** Interface responsiva em React (`#01`), Tabela interativa com ordenação por consumo ou emissão (`#02`) e Polling com atualização contínua sem reload manual (`#03`).
* **US04 — Motor Ambiental e Banco de Dados (#6):** Inserção temporal parametrizada no PostgreSQL sem ORM (`#33`), cálculo automático de potência instantânea, (kWh) e (gCO_2e) com agregação por período.
* **US05 — Resiliência e Tratamento de Erros (#7):** Leitura dinâmica de variações de hardware (`#33`), timeouts de 5s para detecção de serviços `OFFLINE` (`#34`), identificação de respostas nulas/sem telemetria `NO_METRICS` (`#35`) e Middleware global no Express com status 503 e fallback em APIs de carbono (`#36`).
* **US06 — Autenticação JWT (#8):** Cadastro/login de usuários no PostgreSQL, geração de token JWT e interceptador Bearer Token em rotas protegidas no backend.
* **Task #93 — Refatoração de Documentação:** Correção de tabelas DDL (`schema.sql`), especificação de rotas ativas/planejadas (`docs/api.md`), alinhamento do plano de entregas (`docs/plano-de-entregas.md`) e inclusão de atalhos de Dailies e comandos Docker no `README.md`.

</details>

---

## 📈 3.1. Gráfico de Burndown da Sprint 2

<div align="center">
  <img src="../sprint-2/burndown.png" alt="Gráfico de Burndown da Sprint 2" width="85%" />
  <p><i>Acompanhamento da evolução diária dos 62 Story Points planejados e entregues na Sprint 2.</i></p>
</div>

---

## 📝 4. Avaliação Geral da Sprint 2 & Pontos de Atenção para a Sprint 3

* **O que funcionou bem:** A comunicação fluida da equipe, a evolução consistente na camada de resiliência e no backend Node.js, e o cumprimento das restrições de persistência nativa em PostgreSQL via SQL parametrizado sem ORM (RP03).
* **O que precisa melhorar / Pontos de atenção para a Sprint 3:** 
  * **Ainda será discutido:** 