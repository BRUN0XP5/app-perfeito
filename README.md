# 🚀 CDI Tycoon v0.43.0 - O Simulador Definitivo de Magnata

![Version](https://img.shields.io/badge/version-0.43.0-blue?style=for-the-badge)
![License](https://img.shields.io/badge/license-Proprietary-red?style=for-the-badge)
![React](https://img.shields.io/badge/React-19.2.0-61dafb?style=for-the-badge&logo=react)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Ready-orange?style=for-the-badge)

**🎮 CDI Tycoon** não é apenas um simulador financeiro; é a sua jornada de Bronze a Magnata Lendário. Misturando matemática real de investimentos com mecânicas de RPG e Tycoon, aqui seu patrimônio gera XP, desbloqueia tecnologias e define seu status no mercado.

---

## 🆕 O que chegou na v0.43.0? (Mercado de Capitais & Realismo)

### 📈 Integração Real-Time com a B3 (Powered by IA)
*   **Dados Reais em Tempo de Execução:** O simulador agora se conecta a metadados do **Yahoo Finance** para buscar cotações de Ações e FIIs brasileiros.
*   **Inteligência Artificial:** A IA atua como seu corretor pessoal, sugerindo tickers e atualizando os preços da sua carteira com um simples comando "Atualizar Bolsa".
*   **Frequência de Proventos:** Configure se o papel paga Dividendos Mensais, Trimestrais ou Anuais para uma projeção de fluxo de caixa precisa.

### 💰 Sistema de Gestão de Ativos (Liquidez)
*   **Venda por Cotas Inteiras:** Realize lucro (ou prejuízo) instantaneamente. O sistema agora exige a venda de unidades inteiras de Ações e FIIs, refletindo o mercado real.
*   **Resgate Inteligente de Renda Fixa:** Ao tentar resgatar CDBs ou LCIs, o sistema agora exibe um painel de impacto detalhando perdas de rendimento e impostos incidentes.

### 🧮 Hub de Investimento 2.0
*   **Investimento por Unidade:** Não compre apenas por valor financeiro. Informe o preço do papel e a quantidade de cotas; o sistema faz o cálculo do aporte total, valida seu saldo e trava para números inteiros.
*   **Projeção Reativa em Tempo Real:** Ao digitar o valor de resgate ou aporte, o painel de projeção atualiza instantaneamente para mostrar como seu lucro diário será afetado.

### 💎 Projeção de Dividendos Separada
*   **Dashboard de Bolsa:** Uma nova métrica no painel de projeções mostra quanto você ganha exclusivamente em dividendos, permitindo separar sua estratégia de acumulação (Renda Fixa) da estratégia de renda passiva (Bolsa).

---

## 🆕 O que chegou na v0.42.0? (Independência & Estratégia)

### 🧘 Modo Foco (Zen Mode)
*   **Aparência Ultra-Premium:** Uma interface minimalista inspirada em dashboards de alto luxo.
*   **Otimização Mobile:** Totalmente responsivo para telas verticais (celular) e horizontais (tablet/desktop), garantindo que você possa acompanhar seu patrimônio de qualquer lugar.
*   **Foco na Renda:** Exibe apenas o Patrimônio Total Bruto e os rendimentos acumulados por Hora e por Dia.

### ⏳ Widget "Dia da Liberdade" (Independência Financeira)
*   **O Santo Graal das Finanças:** O sistema calcula automaticamente quando sua renda passiva mensal (Renda Fixa + Dividendos) iguala ou supera seu salário declarado. 
*   **Percentual de Liberdade:** Uma barra de progresso visual que mostra quão perto você está de poder "se aposentar" no simulador.

### ⚔️ Simulador Dívida vs. Investimento (Batalha Financeira)
*   **Decisor Estratégico:** Uma ferramenta onde você insere o valor e o juro de uma dívida e o sistema compara contra o rendimento do seu melhor investimento atual.
*   **O Veredito da IA:** O app te diz matematicamente se é melhor quitar a dívida agora ou deixar o dinheiro rendendo, considerando impostos e taxas.

### 📈 Corretor de Inflação (Poder de Compra)
*   **Lucro Real vs. Lucro Nominal:** Um botão de alternância na projeção permite descontar a inflação média (IPCA) do seu lucro, revelando o aumento real do seu poder de compra.

---

## 🆕 O que chegou na v0.41.0? (Estabilidade & Transparência)

### 📉 Resgate Estratégico (Novo Pop-up)
*   **Transparência Total:** Agora, ao tentar resgatar, você vê exatamente o quanto vai perder em rendimento diário e semanal (informação inversa ao aporte).
*   **Detector de Impostos:** O sistema agora avisa se o ativo ainda está sob incidência de **IOF** ou qual a alíquota atual de **IR**, ajudando na tomada de decisão.
*   **Cálculo de Perda:** Exibição em tempo real da porcentagem de queda no lucro líquido baseada no valor do resgate.

### 💎 Identidade Visual Unificada (Cristal Cube)
*   **Novo Ícone Oficial:** Uma nova logo premium (Cubo de Cristal com Gráficos 3D) foi implementada em todo o ecossistema (PWA, Favicon do PC, Mobile e Splash Screen).
*   **Limpeza de Assets:** Removidos ícones antigos e logos padrão (Vite/React) para uma experiência 100% personalizada e profissional.

### 📈 Controle de Ativos
*   **Data de Aplicação:** Defina a data exata de criação do ativo para migrar investimentos reais sem resetar cronômetros de impostos.
*   **Estabilidade de Sessão:** Melhorias na persistência de Streaks e Missões no Supabase.

---

## 🆕 O que chegou na v0.40.0 Beta?

### ✨ Sistema de Estilo & Skins
*   **Aparência Única:** Ganhe skins raras através de aportes ou conquistas.
*   **Customização de Perfil:** Escolha auras de poder, cores de nome (Dourado, Neon, Diamante) e fundos de tela exclusivos.

### 🔒 Progressão de Carreira (Level Gates)
*   **Nível 2:** Desbloqueia o **Mercado de Câmbio (USD/JPY)** e a **Análise de Alocação**.
*   **Nível 3:** Desbloqueia a **Calculadora de Juros Compostos** avançada.

### 💳 Gestão de Dívidas 2.0
*   **Categorias Personalizadas:** Crie suas próprias categorias com nomes e emojis (ex: 🍔 Lanche, 🚀 Foguete).
*   **Saúde Financeira:** Visualize o cálculo em tempo real: `(Patrimônio + Salário) - Dívidas`.
*   **Confirmação de Segurança:** Botão de exclusão com confirmação para evitar erros.

### 📂 Backup e Sincronização
*   **Exportação .TXT:** Backup completo, legível e formatado de todo o seu progresso.
*   **Reset Diário Local:** Sistema reescrito para respeitar o fuso horário do seu dispositivo, corrigindo o reset inesperado de conquistas.

---

## 🔥 Funcionalidades Completas (Tudo o que o App faz)

### 📊 Investimentos em Tempo Real
*   **Mineração de CDI:** Ativos rendem a cada 10 segundos baseados em taxas reais.
*   **Diversidade de Papéis:** CDB, IPCA+, LCI e LCA (com isenção de IR).
*   **Regras Reais:** Cálculo de **IOF (30 dias)** e **IR Regressivo** automático.
*   **Liquidez Estratégica:** Escolha entre D+0, D+30 ou D+365 (FGC Max) para multiplicar seus ganhos.

### 🌍 Ecossistema Global (Wise Engine)
*   **Cotações Reais:** Preços de Dólar e Iene via AwesomeAPI.
*   **Conversão Inteligente:** Sistema de câmbio simulando taxas da Wise (Spread e IOF).
*   **Rendimento em Moeda Forte:** Saldo em USD rende dividendos offline (Wise Rende+).

### 🕹️ Gamificação & RPG
*   **XP por Real:** Cada R$ 1,00 investido equivale a 1 XP.
*   **Árvore de Habilidades:** Desbloqueie gráficos de 10 anos, monitores de eficiência e calculadoras financeiras conforme sobe de nível.
*   **Missões & Conquistas:** Mais de 20 conquistas com recompensas visuais e bônus.

### 💻 Tecnologia & UX
*   **Offline Gold:** O juro composto continua trabalhando mesmo quando você fecha o app.
*   **Cloud Sync:** Seus dados são salvos instantaneamente via **Supabase**.
*   **PWA:** Instale no seu celular ou desktop como um app nativo. No iPhone, use "Adicionar à Tela de Início" pelo Safari; no Android/Chrome, clique em "Instalar".

---

## 🔗 Comece a investir agora: https://app-perfeito.vercel.app

---
🚀 Por que usar o CDI Tycoon?
Se você ainda tá na dúvida se vale a pena gastar seu XP aqui, se liga na visão:

🎮 1. O Jogo é a Melhor Escola
Aprender sobre IOF, IR Regressivo e CDI lendo livro é um tédio. No CDI Tycoon, você aprende errando (e acertando) no jogo. É muito melhor perder "dinheiro de mentira" no simulador enquanto aprende a estratégia certa, do que perder dinheiro de verdade na corretora por falta de treino.

🧠 2. Treino de Mentalidade (Mindset)
O maior inimigo do investidor é a ansiedade. No app, você vê o poder dos juros compostos agindo em tempo real. Você começa a entender que resgatar dinheiro pra comprar bobeira hoje mata o seu eu rico de amanhã. É um treino de paciência digno de um mestre.

🛡️ 3. Simulador de Crise e 
Oportunidade
O dólar subiu? O CDI caiu? No app, você testa essas variações sem risco. Você entende como o câmbio afeta seu patrimônio e aprende a diversificar pra não ficar refém de uma moeda só.

🏆 4. Gamificação que Dá Lucro
A gente transformou o tédio das planilhas em um RPG. Ganhar skins, subir de nível e desbloquear ferramentas novas faz com que você queira estudar finanças todo dia. Quando você perceber, o hábito de investir já tá no seu sangue.

💻 5. De Dev para Dev (Open Source)
O app é feito por quem entende de código. É liso, é rápido e agora é Open Source. Você pode ver como as contas são feitas, sugerir melhorias e entender a lógica por trás de cada rendimento.

💡 Em resumo:
O CDI Tycoon é onde você treina para ser o mestre do seu próprio destino financeiro. É a ponte entre o "não sei o que fazer com meu dinheiro" e o "estou construindo meu império".

🧑‍💻 Autor: BRUN0XP5
"Codificando a riqueza, o resto é só lag."


*Se o app te ajudou a evoluir, deixe uma ⭐ no repositório!*
