// Sistema de Conquistas (Achievements)

export interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: 'patrimony' | 'machines' | 'time' | 'special' | 'mastery' | 'daily';
    requirement: {
        type: 'patrimony' | 'machines_count' | 'days_active' | 'total_yield' | 'level' | 'single_machine_value' | 'custom';
        value: number;
        customCheck?: (data: any) => boolean;
    };
    reward: {
        title?: string;
    };
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
    unlocked: boolean;
    unlockedAt?: string;
    notified?: boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
    // PATRIMÔNIO
    {
        id: 'first_thousand',
        name: 'Primeiro Extrato K',
        description: 'Alcançou a marca histórica de R$ 1.000 em custódia total.',
        icon: '💼',
        category: 'patrimony',
        requirement: { type: 'patrimony', value: 1000 },
        reward: {},
        rarity: 'common',
        unlocked: false
    },
    {
        id: 'five_k',
        name: 'Base de Capital',
        description: 'Patrimônio líquido consolidado atingiu R$ 5.000.',
        icon: '🏛️',
        category: 'patrimony',
        requirement: { type: 'patrimony', value: 5000 },
        reward: {},
        rarity: 'common',
        unlocked: false
    },
    {
        id: 'ten_k',
        name: 'Investidor Qualificado',
        description: 'Patrimônio total superou a barreira dos R$ 10.000.',
        icon: '📊',
        category: 'patrimony',
        requirement: { type: 'patrimony', value: 10000 },
        reward: {},
        rarity: 'rare',
        unlocked: false
    },
    {
        id: 'twenty_k',
        name: 'Fundo de Segurança',
        description: 'Reserva financeira total atingiu R$ 20.000.',
        icon: '🛡️',
        category: 'patrimony',
        requirement: { type: 'patrimony', value: 20000 },
        reward: {},
        rarity: 'rare',
        unlocked: false
    },
    {
        id: 'fifty_k',
        name: 'Capital Estratégico',
        description: 'Gestão de ativos alcançou R$ 50.000 em posição de mercado.',
        icon: '🎯',
        category: 'patrimony',
        requirement: { type: 'patrimony', value: 50000 },
        reward: { title: 'ESTRATEGISTA' },
        rarity: 'epic',
        unlocked: false
    },
    {
        id: 'hundred_k',
        name: 'Patrimônio de Seis Dígitos',
        description: 'Posição financeira consolidada acima de R$ 100.000.',
        icon: '💎',
        category: 'patrimony',
        requirement: { type: 'patrimony', value: 100000 },
        reward: { title: 'INVESTIDOR DE ELITE' },
        rarity: 'legendary',
        unlocked: false
    },

    // MÁQUINAS
    {
        id: 'first_machine',
        name: 'Ativo Operacional',
        description: 'Primeira alocação de capital em máquina geradora de rendimento.',
        icon: '⚙️',
        category: 'machines',
        requirement: { type: 'machines_count', value: 1 },
        reward: {},
        rarity: 'common',
        unlocked: false
    },
    {
        id: 'three_machines',
        name: 'Diversificação Setorial',
        description: 'Portfólio com 3 frentes distintas de geração de liquidez.',
        icon: '🔧',
        category: 'machines',
        requirement: { type: 'machines_count', value: 3 },
        reward: {},
        rarity: 'common',
        unlocked: false
    },
    {
        id: 'five_machines',
        name: 'Balanceamento de Carteira',
        description: 'Gestão simultânea de 5 ativos financeiros ativos.',
        icon: '🏭',
        category: 'machines',
        requirement: { type: 'machines_count', value: 5 },
        reward: {},
        rarity: 'rare',
        unlocked: false
    },
    {
        id: 'ten_machines',
        name: 'Arquitetura de Capital',
        description: 'Ecossistema complexo com 10 máquinas de rendimento composto.',
        icon: '🏢',
        category: 'machines',
        requirement: { type: 'machines_count', value: 10 },
        reward: { title: 'DIVERSIFICADOR' },
        rarity: 'epic',
        unlocked: false
    },
    {
        id: 'big_machine_10k',
        name: 'Posição Institucional',
        description: 'Alocação individual em um único ativo superior a R$ 10.000.',
        icon: '🚢',
        category: 'machines',
        requirement: { type: 'single_machine_value', value: 10000 },
        reward: {},
        rarity: 'rare',
        unlocked: false
    },
    {
        id: 'big_machine_50k',
        name: 'Âncora Financeira',
        description: 'Alocação massiva em um ativo singular superando R$ 50.000.',
        icon: '🐳',
        category: 'machines',
        requirement: { type: 'single_machine_value', value: 50000 },
        reward: {},
        rarity: 'epic',
        unlocked: false
    },

    // TEMPO
    {
        id: 'first_week',
        name: 'Maturação Inicial',
        description: 'Ciclo operacional de 7 dias concluído com sucesso.',
        icon: '⏲️',
        category: 'time',
        requirement: { type: 'days_active', value: 7 },
        reward: {},
        rarity: 'common',
        unlocked: false
    },
    {
        id: 'first_month',
        name: 'Ciclo Mensal Consolidado',
        description: 'Manutenção de posição e liquidez por 30 dias ininterruptos.',
        icon: '🗓️',
        category: 'time',
        requirement: { type: 'days_active', value: 30 },
        reward: {},
        rarity: 'rare',
        unlocked: false
    },
    {
        id: 'three_months',
        name: 'Relatório Trimestral',
        description: 'Estabilidade financeira demonstrada ao longo de 90 dias.',
        icon: '📉',
        category: 'time',
        requirement: { type: 'days_active', value: 90 },
        reward: { title: 'PERSISTENTE' },
        rarity: 'epic',
        unlocked: false
    },
    {
        id: 'hundred_days',
        name: 'Marco de Transparência',
        description: 'Operação financeira ativa e saudável por 100 dias.',
        icon: '🏛️',
        category: 'time',
        requirement: { type: 'days_active', value: 100 },
        reward: { title: 'INVESTIDOR DISCIPLINADO' },
        rarity: 'legendary',
        unlocked: false
    },

    // RENDIMENTO
    {
        id: 'first_profit_50',
        name: 'Fluxo de Caixa Positivo',
        description: 'Acúmulo de R$ 50 em rendimentos líquidos diretos.',
        icon: '💸',
        category: 'mastery',
        requirement: { type: 'total_yield', value: 50 },
        reward: {},
        rarity: 'common',
        unlocked: false
    },
    {
        id: 'first_profit_100',
        name: 'Eficiência de Capital',
        description: 'Retorno sobre investimento (ROI) atingiu R$ 100 acumulados.',
        icon: '📈',
        category: 'mastery',
        requirement: { type: 'total_yield', value: 100 },
        reward: {},
        rarity: 'common',
        unlocked: false
    },
    {
        id: 'profit_500',
        name: 'Geração de Valor',
        description: 'Rendimento total superou a marca de R$ 500 reais.',
        icon: '💰',
        category: 'mastery',
        requirement: { type: 'total_yield', value: 500 },
        reward: {},
        rarity: 'rare',
        unlocked: false
    },
    {
        id: 'thousand_profit',
        name: 'Independência Parcial',
        description: 'Rendimento passivo acumulado superou R$ 1.000.',
        icon: '🏦',
        category: 'mastery',
        requirement: { type: 'total_yield', value: 1000 },
        reward: { title: 'GERADOR DE RENDA' },
        rarity: 'epic',
        unlocked: false
    },

    // NÍVEIS
    {
        id: 'level_3',
        name: 'Analista Júnior',
        description: 'Experiência de mercado nível 3.',
        icon: '👔',
        category: 'mastery',
        requirement: { type: 'level', value: 3 },
        reward: {},
        rarity: 'common',
        unlocked: false
    },
    {
        id: 'level_5',
        name: 'Estrategista de Portfolio',
        description: 'Experiência de mercado nível 5.',
        icon: '📐',
        category: 'mastery',
        requirement: { type: 'level', value: 5 },
        reward: {},
        rarity: 'common',
        unlocked: false
    },
    {
        id: 'level_10',
        name: 'Gestor de Ativos',
        description: 'Experiência de mercado nível 10.',
        icon: '💼',
        category: 'mastery',
        requirement: { type: 'level', value: 10 },
        reward: {},
        rarity: 'rare',
        unlocked: false
    },
    {
        id: 'level_20',
        name: 'Managing Director',
        description: 'Experiência de mercado nível 20.',
        icon: '🏦',
        category: 'mastery',
        requirement: { type: 'level', value: 20 },
        reward: { title: 'MESTRE DOS JUROS' },
        rarity: 'epic',
        unlocked: false
    },
    {
        id: 'level_30',
        name: 'Board Member',
        description: 'Experiência de mercado nível 30.',
        icon: '🕴️',
        category: 'mastery',
        requirement: { type: 'level', value: 30 },
        reward: { title: 'LENDA DOS INVESTIMENTOS' },
        rarity: 'legendary',
        unlocked: false
    },

    // ESPECIAIS
    {
        id: 'perfect_cdi',
        name: 'Benchmarks de Indexação',
        description: 'Ativo alinhado com 100% da Taxa DI.',
        icon: '🎯',
        category: 'special',
        requirement: {
            type: 'custom',
            value: 0,
            customCheck: (data) => data.machines?.some((m: any) => m.cdi_quota >= 100)
        },
        reward: {},
        rarity: 'rare',
        unlocked: false
    },
    {
        id: 'super_cdi',
        name: 'Alta Performance',
        description: 'Ativo superando o benchmark principal (>110% CDI).',
        icon: '🚀',
        category: 'special',
        requirement: {
            type: 'custom',
            value: 0,
            customCheck: (data) => data.machines?.some((m: any) => m.cdi_quota > 110)
        },
        reward: {},
        rarity: 'epic',
        unlocked: false
    },
    // CONQUISTAS DIÁRIAS (RESETAM À MEIA-NOITE)
    {
        id: 'daily_saver',
        name: 'Hábito de Poupador',
        description: 'Mantenha a constância: deposite R$ 0,50 hoje.',
        icon: '💰',
        category: 'daily',
        requirement: {
            type: 'custom',
            value: 0.50,
            customCheck: (data) => (data.lastDepositValue || 0) >= 0.50
        },
        reward: {},
        rarity: 'common',
        unlocked: false
    },
    {
        id: 'daily_active_portfolio',
        name: 'Parque Industrial',
        description: 'Mantenha 4 ou mais máquinas produzindo simultaneamente.',
        icon: '🏭',
        category: 'daily',
        requirement: { type: 'machines_count', value: 4 },
        reward: {},
        rarity: 'common',
        unlocked: false
    },
    {
        id: 'early_bird_daily',
        name: 'O Despertar do Gestor',
        description: 'Acesse e gerencie seus ativos antes das 09h.',
        icon: '☕',
        category: 'daily',
        requirement: {
            type: 'custom',
            value: 0,
            customCheck: () => new Date().getHours() < 9
        },
        reward: {},
        rarity: 'rare',
        unlocked: false
    },
    {
        id: 'night_owl_daily',
        name: 'Vigilante do Mercado',
        description: 'Gerencie sua carteira após as 23h.',
        icon: '🦉',
        category: 'daily',
        requirement: {
            type: 'custom',
            value: 0,
            customCheck: () => new Date().getHours() >= 23
        },
        reward: {},
        rarity: 'rare',
        unlocked: false
    },
    {
        id: 'global_investor_daily',
        name: 'Cidadão do Mundo',
        description: 'Tenha pelo menos $ 5,00 (USD) investidos.',
        icon: '🗽',
        category: 'daily',
        requirement: {
            type: 'custom',
            value: 5,
            customCheck: (data) => (data.usdBalance || 0) >= 5
        },
        reward: {},
        rarity: 'rare',
        unlocked: false
    },
    {
        id: 'multi_currency_daily',
        name: 'Trindade Cambial',
        description: 'Possua saldo em BRL, USD e JPY simultaneamente.',
        icon: '🏦',
        category: 'daily',
        requirement: {
            type: 'custom',
            value: 0,
            customCheck: (data) => data.patrimony > 0 && data.usdBalance > 0 && data.jpyBalance > 0
        },
        reward: {},
        rarity: 'epic',
        unlocked: false
    },
    {
        id: 'yield_milestone_daily',
        name: 'Lucro de Ouro',
        description: 'Ganhe R$ 5,00 em rendimentos hoje (Histórico)',
        icon: '✨',
        category: 'daily',
        requirement: {
            type: 'custom',
            value: 5,
            customCheck: (data) => (data.totalYieldToday || 0) >= 5
        },
        reward: {},
        rarity: 'epic',
        unlocked: false
    },
    {
        id: 'high_cdi_daily',
        name: 'Caçador de Prêmios',
        description: 'Tenha uma máquina rendendo 120% CDI ou mais.',
        icon: '🏹',
        category: 'daily',
        requirement: {
            type: 'custom',
            value: 120,
            customCheck: (data) => data.machines?.some((m: any) => m.cdi_quota >= 120)
        },
        reward: {},
        rarity: 'rare',
        unlocked: false
    },
    {
        id: 'diversification_king_daily',
        name: 'Rei da Diversificação',
        description: 'Tenha investimentos em 3 categorias (CDI, FII, Câmbio).',
        icon: '👑',
        category: 'daily',
        requirement: {
            type: 'custom',
            value: 2,
            customCheck: (data) => {
                let cats = 0;
                if (data.machines?.length > 0) cats++;
                if (data.usdBalance > 0 || data.jpyBalance > 0) cats++;
                return cats >= 2;
            }
        },
        reward: {},
        rarity: 'legendary',
        unlocked: false
    }
];

export const checkAchievements = (
    achievements: Achievement[],
    data: {
        patrimony: number;
        machinesCount: number;
        daysActive: number;
        totalYield: number;
        level: number;
        machines: any[];
        lastDepositValue: number;
        totalYieldToday: number;
        usdBalance: number;
        jpyBalance: number;
    }
): { newlyUnlocked: Achievement[], updated: Achievement[] } => {
    const newlyUnlocked: Achievement[] = [];
    const updated = achievements.map(achievement => {
        let isMet = false;

        switch (achievement.requirement.type) {
            case 'patrimony':
                isMet = data.patrimony >= achievement.requirement.value;
                break;
            case 'machines_count':
                isMet = data.machinesCount >= achievement.requirement.value;
                break;
            case 'days_active':
                isMet = data.daysActive >= achievement.requirement.value;
                break;
            case 'total_yield':
                isMet = data.totalYield >= achievement.requirement.value;
                break;
            case 'level':
                isMet = data.level >= achievement.requirement.value;
                break;
            case 'single_machine_value':
                isMet = data.machines.some(m => m.valor >= achievement.requirement.value);
                break;
            case 'custom':
                isMet = achievement.requirement.customCheck?.(data) || false;
                break;
        }

        // Se a condição é atendida e estava bloqueado
        if (isMet && !achievement.unlocked) {
            const wasEverUnlocked = !!achievement.unlockedAt;
            const unlocked = {
                ...achievement,
                unlocked: true,
                unlockedAt: achievement.unlockedAt || new Date().toISOString()
            };

            // Só adiciona para exibir o pop-up se for a PRIMEIRA vez na história
            if (!wasEverUnlocked) {
                newlyUnlocked.push(unlocked);
            }
            return unlocked;
        }

        // Se a condição NÃO é atendida mas estava desbloqueado, BLOQUEIA NOVAMENTE (volta a ser cinza)
        if (!isMet && achievement.unlocked) {
            return {
                ...achievement,
                unlocked: false
                // Note: Keep unlockedAt to remember it was once unlocked
            };
        }

        return achievement;
    });

    return { newlyUnlocked, updated };
};

export const isRequirementMet = (achievement: Achievement, data: any): boolean => {
    switch (achievement.requirement.type) {
        case 'patrimony':
            return data.patrimony >= achievement.requirement.value;
        case 'machines_count':
            return data.machinesCount >= achievement.requirement.value;
        case 'days_active':
            return data.daysActive >= achievement.requirement.value;
        case 'total_yield':
            return data.totalYield >= achievement.requirement.value;
        case 'level':
            return data.level >= achievement.requirement.value;
        case 'single_machine_value':
            return data.machines.some((m: any) => m.valor >= achievement.requirement.value);
        case 'custom':
            return achievement.requirement.customCheck?.(data) || false;
        default:
            return false;
    }
};

export const getRarityColor = (rarity: Achievement['rarity']) => {
    switch (rarity) {
        case 'common': return '#B0BEC5';
        case 'rare': return '#42A5F5';
        case 'epic': return '#AB47BC';
        case 'legendary': return '#FFD700';
        default: return '#FFF';
    }
};

export const getRarityGlow = (rarity: Achievement['rarity']) => {
    switch (rarity) {
        case 'common': return '0 0 10px rgba(176, 190, 197, 0.3)';
        case 'rare': return '0 0 20px rgba(66, 165, 245, 0.5)';
        case 'epic': return '0 0 30px rgba(171, 71, 188, 0.6)';
        case 'legendary': return '0 0 40px rgba(255, 215, 0, 0.8)';
        default: return 'none';
    }
};

