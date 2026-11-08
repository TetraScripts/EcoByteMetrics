# Metodologia de Estimativa de Emissões de Carbono

## 1. Visão geral

Este documento descreve a metodologia adotada pelo projeto para estimar as emissões de CO₂ equivalente (CO₂e) associadas à execução das aplicações monitoradas.

A proposta consiste em combinar indicadores de utilização de recursos computacionais com a intensidade de carbono da região de hospedagem, gerando um indicador ambiental que permita analisar o comportamento dos serviços ao longo do tempo.

Por se tratar de um modelo simplificado, os resultados não correspondem a medições diretas do consumo elétrico de servidores. Sua finalidade é estabelecer uma base de comparação consistente entre aplicações, ambientes e períodos de monitoramento.

## 2. Metodologia de cálculo

O cálculo é realizado em três etapas:

1. **Estimativa de potência:** cálculo de um valor de potência de referência a partir dos recursos computacionais utilizados.
2. **Estimativa de energia:** conversão da potência estimada em energia, considerando a duração do monitoramento.
3. **Estimativa de emissões:** aplicação do fator de intensidade de carbono correspondente à região analisada.

O fluxo de cálculo é representado por:

```text
Recursos computacionais
        ↓
Potência estimada (W)
        ↓
Energia estimada (kWh)
        ↓
Intensidade de carbono regional
        ↓
Emissões estimadas (gCO₂e)
```

## 3. Cálculo da potência estimada

A potência de referência é obtida pela soma das parcelas atribuídas aos principais recursos monitorados: processamento, memória, armazenamento e comunicação de rede.

```text
P_total = P_cpu + P_memoria + P_disco + P_rede
```

Cada parcela é calculada conforme os indicadores disponíveis e os respectivos fatores de consumo adotados pelo projeto.

### 3.1. Processamento

A implementação utiliza potência máxima de referência de **120 W**, conforme o exemplo metodológico deste documento.

A parcela referente à CPU considera a taxa de utilização do processador em relação à sua potência máxima de referência.

```text
P_cpu = (CPU_percentual / 100) × CPU_max_watts
```

### 3.2. Memória

A contribuição da memória é estimada proporcionalmente à quantidade de RAM utilizada.

```text
P_memoria = RAM_GB × RAM_watts_por_GB
```

### 3.3. Armazenamento

A parcela de armazenamento utiliza a métrica de disco definida na implementação e um fator de consumo correspondente.

```text
P_disco = DISK_GB × DISK_watts_por_GB
```

### 3.4. Comunicação de rede

O componente de rede considera o volume de tráfego contabilizado pelo monitoramento e o fator de consumo configurado.

```text
P_rede = NETWORK_GB × NETWORK_watts_por_GB
```

**Nota de implementação:** os fatores aplicados ao disco e à rede devem ser compatíveis com a natureza das métricas coletadas. Como volumes em GB não representam potência diretamente, esses fatores precisam ser definidos e documentados de modo que o resultado seja interpretado corretamente como uma estimativa do modelo.

## 4. Conversão de potência em energia

Após a composição das parcelas, a potência estimada é convertida em energia considerando o tempo durante o qual o serviço foi monitorado.

```text
Energia_kWh = P_total × Tempo_horas / 1000
```

Quando a duração estiver expressa em segundos, deve ser convertida para horas:

```text
Tempo_horas = Tempo_segundos / 3600
```

Essa conversão permite comparar intervalos de coleta com durações diferentes, desde que as métricas e as premissas do modelo sejam aplicadas de maneira consistente.

## 5. Estimativa das emissões

A estimativa final é obtida pela multiplicação da energia calculada pela intensidade de carbono associada à região de hospedagem.

```text
CO2e_g = Energia_kWh × Intensidade_Carbono
```

A intensidade de carbono é expressa em `gCO₂e/kWh`, enquanto o resultado final é apresentado em `gCO₂e`.

Para facilitar a implementação, o cálculo consolidado pode ser expresso da seguinte maneira:

```text
CO2e_g = (
    (
        (CPU_percentual / 100 × CPU_max_watts) +
        (RAM_GB × RAM_watts_por_GB) +
        (DISK_GB × DISK_watts_por_GB) +
        (NETWORK_GB × NETWORK_watts_por_GB)
    ) × Tempo_horas / 1000
) × Intensidade_Carbono
```

Os nomes utilizados na expressão representam os parâmetros lógicos do modelo. A implementação pode adotar identificadores diferentes, desde que preserve as mesmas operações, unidades e premissas.

## 6. Exemplo de aplicação

O exemplo a seguir apresenta um cenário hipotético com parâmetros diferentes dos utilizados na demonstração inicial. Os valores permitem acompanhar o cálculo da potência, da energia e das emissões, mas não representam medições reais nem fatores universais de consumo.

### Exemplo de cálculo

<table>
<thead>
<tr>
<th width="35%" align="left">Parâmetros</th>
<th width="65%" align="left">Cálculos</th>
</tr>
</thead>
<tbody>
<tr>
<td valign="top">
<strong>CPU</strong>: 35%<br>
<strong>CPU máxima</strong>: 120 W<br>
<strong>RAM</strong>: 3 GB<br>
<strong>Fator RAM</strong>: 0,4 W/GB<br>
<strong>Disco</strong>: 8 GB<br>
<strong>Fator disco</strong>: 0,015 W/GB<br>
<strong>Rede</strong>: 0,5 GB<br>
<strong>Fator rede</strong>: 0,03 W/GB<br>
<strong>Tempo</strong>: 90 s<br>
<strong>Intensidade de carbono</strong>: 120 gCO₂e/kWh
</td>
<td valign="top">
<table>
<tbody>
<tr>
<td valign="top">
<strong>1. CPU</strong><br>
<code>(35 / 100) × 120 = 42 W</code>
<br><br>
<strong>2. Memória</strong><br>
<code>3 × 0,4 = 1,2 W</code>
<br><br>
<strong>3. Disco</strong><br>
<code>8 × 0,015 = 0,12 W</code>
<br><br>
<strong>4. Rede</strong><br>
<code>0,5 × 0,03 = 0,015 W</code>
</td>
<td valign="top">
<strong>5. Potência total</strong><br>
<code>42 + 1,2 + 0,12 + 0,015 = 43,335 W</code>
<br><br>
<strong>6. Tempo em horas</strong><br>
<code>90 / 3600 = 0,025 h</code>
<br><br>
<strong>7. Energia</strong><br>
<code>43,335 × 0,025 / 1000 = 0,001083375 kWh</code>
<br><br>
<strong>8. Emissões</strong><br>
<code>0,001083375 × 120 = 0,130005 gCO₂e</code>
</td>
</tr>
</tbody>
</table>
</td>
</tr>
</tbody>
</table>

### Resultado

Para os parâmetros adotados neste cenário, a emissão estimada durante os 90 segundos de monitoramento é de aproximadamente **0,130 gCO₂e**.

O resultado foi calculado sem arredondar os valores intermediários. Para fins de apresentação, a emissão foi arredondada para três casas decimais.

**Observação:** os fatores de consumo utilizados neste exemplo são hipotéticos. Para aplicações reais, eles devem ser definidos e documentados pelo projeto, de acordo com as premissas adotadas para cada recurso computacional.

## 7. Padronização e interpretação dos resultados

A comparabilidade dos resultados depende da aplicação uniforme da metodologia. Por esse motivo, o projeto adota as seguintes diretrizes:

- **Consistência dos parâmetros:** utilizar os mesmos fatores de referência em todos os grupos e registrar eventuais alterações.
- **Uniformidade das métricas:** manter definições e unidades consistentes para CPU, memória, disco e rede.
- **Precisão numérica:** preservar as casas decimais durante as etapas intermediárias e arredondar apenas para exibição.
- **Contextualização regional:** associar o cálculo à intensidade de carbono correspondente à região e à referência temporal adotadas.
- **Transparência:** identificar os resultados como estimativas e documentar as premissas utilizadas.

## 8. Escopo e limitações

A metodologia prioriza simplicidade, padronização e facilidade de implementação. Por isso, não contempla necessariamente todos os fatores envolvidos no consumo energético de uma infraestrutura real, como refrigeração, perdas de distribuição elétrica, equipamentos compartilhados e particularidades dos servidores físicos.

Consequentemente, os valores produzidos devem ser interpretados como **indicadores estimados para análise comparativa**, e não como uma medição exata das emissões geradas pela infraestrutura.

A validade das comparações depende da manutenção das mesmas premissas metodológicas e da definição explícita dos fatores de consumo utilizados pelo projeto.
