// Sistema de Comparação com Benchmarks

export interface BenchmarkData {
    name: string;
    icon: string;
    color: string;
    annualRate: number; // Taxa anual em decimal (ex: 0.15 = 15%)
    description: string;
    taxable: boolean; // Se sofre IR
}

export const BENCHMARKS: BenchmarkData[] = [
    {
        name: 'Poupança',
        icon: '🐷',
        color: '#FF6B6B',
        annualRate: 0.0617, // ~6.17% ao ano (TR + 0.5% ao mês)
        description: 'Rendimento da caderneta de poupança',
        taxable: false
    },
    {
        name: 'CDI',
        icon: '📊',
        color: '#4ECDC4',
        annualRate: 0.1490, // 14.90% (Selic - 0.10%)
        description: 'Certificado de Depósito Interbancário',
        taxable: true
    },
    {
        name: 'IPCA',
        icon: '📈',
        color: '#FFD93D',
        annualRate: 0.0465, // ~4.65% ao ano (meta 2026)
        description: 'Índice de Preços ao Consumidor Amplo',
        taxable: false
    },
    {
        name: 'Selic',
        icon: '🏦',
        color: '#95E1D3',
        annualRate: 0.1500, // 15.00% ao ano
        description: 'Taxa básica de juros da economia',
        taxable: true
    }
];

export interface PerformanceComparison {
    benchmark: string;
    yourYield: number;
    benchmarkYield: number;
    difference: number;
    percentageDiff: number;
    beating: boolean;
}

/**
 * Calcula o rendimento comparativo entre o portfólio do usuário e os benchmarks
 * @param totalInvested - Valor total investido
 * @param averageCDIQuota - Média ponderada do % CDI das máquinas
 * @param cdiRate - Taxa CDI anual atual
 * @param period - Período de comparação ('day' | 'month' | 'year')
 * @param irFactor - Fator de IR médio (ex: 0.775 para 22.5% de IR)
 */
export const calculateBenchmarkComparison = (
    totalInvested: number,
    averageCDIQuota: number,
    cdiRate: number,
    period: 'day' | 'month' | 'year' = 'month',
    irFactor: number = 0.775 // 22.5% IR padrão
): PerformanceComparison[] => {
    // Cálculo do rendimento do usuário
    const userAnnualGross = totalInvested * (averageCDIQuota / 100) * cdiRate;
    const userAnnualNet = userAnnualGross * irFactor;

    let userYield = 0;
    switch (period) {
        case 'day':
            userYield = userAnnualNet / 252; // Dias úteis
            break;
        case 'month':
            userYield = (userAnnualNet / 252) * 21; // 21 dias úteis/mês
            break;
        case 'year':
            userYield = userAnnualNet;
            break;
    }

    return BENCHMARKS.map(benchmark => {
        let benchmarkAnnualNet = totalInvested * benchmark.annualRate;

        // Aplica IR se o benchmark for tributável
        if (benchmark.taxable) {
            benchmarkAnnualNet *= irFactor;
        }

        let benchmarkYield = 0;
        switch (period) {
            case 'day':
                benchmarkYield = benchmarkAnnualNet / 252;
                break;
            case 'month':
                benchmarkYield = (benchmarkAnnualNet / 252) * 21;
                break;
            case 'year':
                benchmarkYield = benchmarkAnnualNet;
                break;
        }

        const difference = userYield - benchmarkYield;
        const percentageDiff = benchmarkYield !== 0
            ? ((difference / benchmarkYield) * 100)
            : 0;

        return {
            benchmark: benchmark.name,
            yourYield: userYield,
            benchmarkYield: benchmarkYield,
            difference,
            percentageDiff,
            beating: difference > 0
        };
    });
};

/**
 * Calcula quanto tempo levaria para dobrar o investimento
 * @param annualRate - Taxa anual em decimal
 */
export const calculateDoublingTime = (annualRate: number): number => {
    // Regra dos 72: tempo aproximado = 72 / taxa percentual
    return 72 / (annualRate * 100);
};

/**
 * Calcula o valor futuro de um investimento
 * @param principal - Valor inicial
 * @param annualRate - Taxa anual
 * @param years - Número de anos
 */
export const calculateFutureValue = (
    principal: number,
    annualRate: number,
    years: number
): number => {
    return principal * Math.pow(1 + annualRate, years);
};

/**
 * Retorna estatísticas comparativas interessantes
 */
export const getBenchmarkStats = (
    totalInvested: number,
    averageCDIQuota: number,
    cdiRate: number
) => {
    const userRate = (averageCDIQuota / 100) * cdiRate;

    const poupanca = BENCHMARKS.find(b => b.name === 'Poupança')!;
    const ipca = BENCHMARKS.find(b => b.name === 'IPCA')!;

    const doublingTimeUser = calculateDoublingTime(userRate);
    const doublingTimePoupanca = calculateDoublingTime(poupanca.annualRate);

    const futureValue10Years = calculateFutureValue(totalInvested, userRate * 0.775, 10);
    const futureValuePoupanca10Years = calculateFutureValue(totalInvested, poupanca.annualRate, 10);

    const realReturn = userRate - ipca.annualRate; // Retorno real (acima da inflação)

    return {
        doublingTimeUser,
        doublingTimePoupanca,
        doublingTimeDifference: doublingTimePoupanca - doublingTimeUser,
        futureValue10Years,
        futureValuePoupanca10Years,
        advantage10Years: futureValue10Years - futureValuePoupanca10Years,
        realReturn,
        beatingInflation: realReturn > 0
    };
};
