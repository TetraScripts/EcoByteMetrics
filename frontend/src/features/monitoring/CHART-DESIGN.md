# Apresentação da evolução

Referências visuais consultadas em 31/10/2026:
- shadcn/ui, área em degraus: https://ui.shadcn.com/view/new-york-v4/chart-area-step
- shadcn/ui, barras interativas: https://ui.shadcn.com/view/new-york-v4/chart-bar-interactive
- Tremor, área temporal: https://www.tremor.so/docs/visualizations/area-chart

Implementação própria sobre o Recharts já instalado, sem dependências adicionais. A apresentação usa cartão com hierarquia clara, preenchimentos suaves, escalas arredondadas e tooltip com valor em destaque.

O acumulado usa área em degraus, interrompida por valores nulos e pausas reais. Pontos isolados continuam visíveis. Barras mostram totais por intervalo; valores zero não recebem altura artificial. A escala horizontal mantém o tempo real: pausas não são comprimidas nem preenchidas. Regiões sem registros usam textura neutra e rótulo, sem inferir que o backend estava desligado. Dados parciais permanecem no popup e em Dados incompletos, acessível pelo aviso compacto.

Cálculos, agrupamentos, filtros e dados do banco permanecem iguais. Os mesmos gráficos são usados na evolução do ambiente e da aplicação. A tabela Valores continua disponível, e o componente respeita o teclado sem animação contínua.
