# Integração de IA no Aura Almoxarifado

Este módulo implementa inteligência artificial para gerar relatórios estratégicos e insights de estoque, utilizando modelos compatíveis com a OpenAI API (como GPT-4 ou modelos Open Source via OpenRouter).

## 🤖 O que a IA faz
- **Analisa dados**: Recebe um JSON estruturado com KPIs, alertas de ruptura/excesso e curva ABC.
- **Gera texto**: Produz um relatório em Markdown com linguagem natural, explicando os números.
- **Sugere ações**: Recomenda estratégias para compras e gestão baseadas nos dados fornecidos.

## 🚫 O que a IA NÃO faz (Regra de Ouro)
- **NÃO calcula**: A IA não soma valores, não projeta médias e não inventa números.
- **NÃO acessa banco**: A IA não tem acesso direto ao banco de dados; ela recebe apenas o que o backend envia.
- **NÃO toma decisões**: Ela apenas sugere; a decisão final é do usuário.

## 🛠️ Configuração Técnica

### Variáveis de Ambiente
Crie um arquivo `.env.local` na raiz (baseado no `.env.example`):

```env
VITE_OPENAI_API_KEY="sua-chave-aqui"
VITE_AI_MODEL="gpt-oss-120b" # ou gpt-4o, etc.
```

### Arquitetura
1. **Frontend/Service (`AiReportService.ts`)**:
   - Busca dados brutos do Supabase.
   - Executa cálculos determinísticos (Curva ABC, projeção de ruptura).
   - Monta o payload JSON.
   - Envia para a API da IA via SDK OpenAI.
2. **Componente (`AiReports.tsx`)**:
   - Exibe interface de geração.
   - Renderiza o Markdown retornado.

## 🚀 Como Adicionar Novos Relatórios
1. **Defina o Payload**: Adicione novos campos em `AiReportPayload` em `types.ts`.
2. **Implemente o Cálculo**: Edite `buildRelatorioPayload` em `AiReportService.ts` para calcular os novos dados.
3. **Ajuste o Prompt**: Atualize o `systemPrompt` em `generateAiReport` para instruir a IA sobre como usar os novos dados.

## 🔒 Checklist de Segurança
- [x] **Chave de API**: Nunca commitar chaves reais. Use `.env`.
- [x] **PII (Dados Pessoais)**: O payload não envia nomes de clientes finais ou dados sensíveis de usuários, apenas métricas de produtos.
- [x] **Logs**: O sistema loga apenas sucesso/erro, nunca o conteúdo completo do relatório em produção.
- [x] **Custos**: O uso é sob demanda (botão "Gerar Relatório"), evitando chamadas automáticas excessivas.

## 🔄 Rotação de Chaves
Caso a chave da API vaze:
1. Revogue a chave imediatamente no painel do provedor (OpenAI/OpenRouter).
2. Gere uma nova chave.
3. Atualize o `.env.local` de todos os desenvolvedores/ambientes.
