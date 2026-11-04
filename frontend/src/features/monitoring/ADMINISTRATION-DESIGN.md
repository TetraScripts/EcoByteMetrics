# Referências da administração

A composição foi adaptada visualmente de dois repositórios, com implementação própria nos componentes e no CSS existentes:

- [Shadcn Admin — Settings](https://github.com/satnaing/shadcn-admin/tree/main/src/features/settings): navegação por categorias, cabeçalho de seção e separação entre menu e conteúdo.
- [shadcn/ui — Field Responsive](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/examples/field-responsive.tsx): campos com rótulo e descrição de um lado, controle do outro e empilhamento em telas estreitas.

A administração apresenta a configuração de coleta; a seção Acesso foi removida. Os filtros do dashboard são preservados ao navegar. O documento pode rolar em telas baixas, sem rolagem vertical dentro do painel.

O intervalo de 30 segundos permanece ilustrativo e desativado. Clicar em Administração sem sessão leva ao login tanto em desenvolvimento quanto em produção. O formulário de login envia credenciais ao backend e o painel apresenta a conta e a ação Sair quando conectado. A validação com conta e banco reais continua pendente. Não há leitura ou escrita de configurações, diagnóstico simulado ou gerenciamento de permissões. Nenhuma dependência foi adicionada.
