import { DEFAULT_SELIC } from './constants';

export const getTaxMultipliers = (createdAtStr?: string, ignoreIof = false, referenceDate: Date = new Date()) => {
    if (!createdAtStr) return { iofFactor: 1, irFactor: 1 - 0.225, irRateLabel: '22.5%', iofApplied: false, daysUntilIofZero: 0 };
    const created = new Date(createdAtStr);
    const now = referenceDate;
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // IOF Regressivo (0 a 29 dias)
    let iofFactor = 1;
    let iofApplied = false;
    let daysUntilIofZero = 0;
    if (diffDays < 30 && !ignoreIof) {
        const iofTable = [96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50, 46, 43, 40, 36, 33, 30, 26, 23, 20, 16, 13, 10, 6, 3, 0];
        const iofPercent = iofTable[diffDays] || 0;
        iofFactor = 1 - (iofPercent / 100);
        iofApplied = iofPercent > 0;
        daysUntilIofZero = 30 - diffDays;
    }

    // IR Regressivo
    let irRate = 0.225;
    let irRateLabel = '22.5%';
    if (diffDays > 720) { irRate = 0.15; irRateLabel = '15%'; }
    else if (diffDays > 360) { irRate = 0.175; irRateLabel = '17.5%'; }
    else if (diffDays > 180) { irRate = 0.20; irRateLabel = '20%'; }

    return { iofFactor, irFactor: 1 - irRate, irRateLabel, iofApplied, daysUntilIofZero };
};

export const calculateProjection = (valorAtual: number, aporte: string, cdi_quota: number, cdiAnual: number, createdAt?: string, referenceDate: Date = new Date()) => {
    const v = valorAtual + (parseFloat(aporte) || 0)
    // Para projeções, sempre ignoramos o IOF pois ele é temporário (30 dias)
    const { irFactor } = getTaxMultipliers(createdAt, true, referenceDate);
    const grossAnnual = v * (cdi_quota / 100) * cdiAnual
    const netAnnual = grossAnnual * irFactor

    // Projeções baseadas em dias úteis (252 ao ano)
    return {
        day: netAnnual / 252,
        week: (netAnnual / 252) * 5,
        month: (netAnnual / 252) * 21
    }
}

export const getInvestorTitle = (lvl: number) => {
    if (lvl <= 5) return 'ESTAGIÁRIO DE FINANÇAS';
    if (lvl <= 10) return 'INVESTIDOR APRENDIZ';
    if (lvl <= 20) return 'ANALISTA DE MERCADO';
    if (lvl <= 35) return 'GERENTE DE PATRIMÔNIO';
    if (lvl <= 50) return 'TUBARÃO DA BOLSA';
    if (lvl <= 75) return 'MAGNATA DO CDI';
    if (lvl <= 100) return 'LENDA DOS JUROS COMPOSTOS';
    if (lvl <= 250) return 'CENTRAL DE INTELIGÊNCIA FINANCEIRA';
    if (lvl <= 500) return 'ORÁCULO DOS INVESTIMENTOS';
    if (lvl <= 1000) return 'DOMINADOR DO MERCADO';
    if (lvl <= 5000) return 'ARQUITETO DA RIQUEZA';
    if (lvl <= 10000) return 'IMPERADOR DO CAPITAL';
    return 'DEUS DA FORTUNA';
}

export const crc16 = (data: string) => {
    let crc = 0xFFFF;
    const polynomial = 0x1021;
    for (let i = 0; i < data.length; i++) {
        let b = data.charCodeAt(i);
        for (let j = 0; j < 8; j++) {
            let bit = ((b >> (7 - j) & 1) === 1);
            let c15 = ((crc >> 15 & 1) === 1);
            crc <<= 1;
            if (c15 !== bit) crc ^= polynomial;
        }
    }
    crc &= 0xFFFF;
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

export const generateStaticPixPayload = (key: string, amount: number, name: string, city: string) => {
    const amountStr = amount.toFixed(2);
    const cleanKey = key.trim();
    const merchantAccount = `0014br.gov.bcb.pix01${cleanKey.length.toString().padStart(2, '0')}${cleanKey}`;

    const payload = [
        '000201',
        `26${merchantAccount.length.toString().padStart(2, '0')}${merchantAccount}`,
        '52040000',
        '5303986',
        `54${amountStr.length.toString().padStart(2, '0')}${amountStr}`,
        '5802BR',
        `59${Math.min(name.length, 25).toString().padStart(2, '0')}${name.substring(0, 25)}`,
        `60${Math.min(city.length, 15).toString().padStart(2, '0')}${city.substring(0, 15)}`,
        '62070503***',
        '6304'
    ].join('');

    return payload + crc16(payload);
}
