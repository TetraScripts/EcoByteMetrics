import { Activity, Database, Leaf, Zap } from "lucide-react";

const steps = [
  {
    icon: Activity,
    title: "Observar os serviços",
    body: "O ponto de partida são as métricas de CPU, memória, disco e rede de cada serviço. Elas ajudam a descrever a atividade do software durante um intervalo de tempo.",
  },
  {
    icon: Zap,
    title: "Estimar a energia",
    body: "O modelo relaciona a atividade dos recursos à potência estimada. Com a duração do intervalo, essa potência é convertida em consumo de energia, expresso em kWh.",
  },
  {
    icon: Leaf,
    title: "Calcular as emissões",
    body: "A energia estimada é multiplicada pela intensidade de carbono da eletricidade na região de execução. O resultado é uma estimativa de emissões em CO₂ equivalente.",
  },
  {
    icon: Database,
    title: "Acompanhar e comparar",
    body: "A proposta é reunir as coletas em um histórico para visualizar tendências, comparar serviços e identificar onde investigar o consumo com mais atenção.",
  },
];

export function ProjectOverview() {
  return (
    <>
      <section
        className="project-section workflow"
        aria-labelledby="workflow-title"
      >
        <div className="project-heading">
          <span className="project-eyebrow">COMO FUNCIONA</span>
          <h2 id="workflow-title">
            Da atividade do software
            <br />
            <span>ao impacto ambiental.</span>
          </h2>
          <p>
            Um caminho para transformar o uso de recursos em informações que
            ajudam a orientar escolhas mais conscientes.
          </p>
        </div>
        <ol className="workflow-grid">
          {steps.map(({ icon: Icon, title, body }, index) => (
            <li key={title}>
              <div className="workflow-step">
                <span>0{index + 1}</span>
                <Icon size={24} aria-hidden="true" />
              </div>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="project-section calculation"
        id="dados"
        aria-labelledby="calculation-title"
      >
        <div className="project-heading">
          <span className="project-eyebrow">MODELO DE CÁLCULO</span>
          <h2 id="calculation-title">
            Entenda o que está
            <br />
            <span>por trás dos números.</span>
          </h2>
          <p>
            Potência é a taxa de consumo. Energia considera também o tempo. As
            emissões dependem da origem da eletricidade utilizada.
          </p>
          <p className="calculation-note">
            São estimativas: a precisão depende das métricas coletadas, do
            modelo de potência e do fator de carbono adotado.
          </p>
        </div>
        <div className="calculation-model" aria-label="Como o impacto é estimado">
          <span className="project-eyebrow">
            DOS RECURSOS ÀS EMISSÕES
          </span>
          <div className="formula-row">
            <span>Energia estimada</span>
            <h3>Potência × tempo</h3>
            <p>O uso dos recursos ajuda a estimar a potência. A duração da atividade permite estimar a energia consumida.</p>
          </div>
          <div className="formula-row">
            <span>Emissões estimadas</span>
            <h3>Energia × intensidade de carbono</h3>
            <p>A energia é relacionada ao fator de carbono da região onde o serviço é executado.</p>
          </div>
          <p className="model-note">
            O dashboard apresenta os dados disponíveis e suas fontes. A precisão das estimativas depende das métricas e dos fatores regionais utilizados.
          </p>
        </div>
      </section>

      <section
        className="project-section project-about"
        id="projeto"
        aria-labelledby="project-title"
      >
        <div className="project-heading">
          <span className="project-eyebrow">SOBRE O PROJETO</span>
          <h2 id="project-title">
            Mais clareza para
            <br />
            <span>cada escolha.</span>
          </h2>
          <p>
            A EcoByteMetrics é uma plataforma voltada à análise do consumo
            energético e das emissões de softwares. A proposta é conectar
            métricas técnicas ao impacto ambiental das aplicações.
          </p>
        </div>
        <div className="project-details">
          <h3>O que você poderá analisar</h3>
          <p>
            Consumo de energia, emissões por serviço, evolução entre coletas e
            diferenças entre regiões de execução. Essas perspectivas ajudam a
            formular perguntas e a avaliar mudanças no software.
          </p>
        </div>
      </section>
    </>
  );
}
