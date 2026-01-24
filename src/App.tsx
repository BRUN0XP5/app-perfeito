import { useEffect, useState, useMemo, useRef, type ReactNode } from 'react'
import { createClient } from '@supabase/supabase-js'
import './App.css'
import { SUPABASE_URL, SUPABASE_KEY, DEFAULT_SELIC } from './constants'
import { AreaChart, Area, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import {
  getTaxMultipliers,
  calculateProjection,
  getInvestorTitle,
  generateStaticPixPayload
} from './utils'
import {
  ACHIEVEMENTS,
  isRequirementMet,
  getRarityColor,
  getRarityGlow,
  type Achievement
} from './achievements'
import {
  calculateBenchmarkComparison,
  getBenchmarkStats,
  BENCHMARKS
} from './benchmarks'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

interface Machine {
  id: any;
  user_id: any;
  nome: string;
  valor: number;
  cdi_quota: number;
  vencimento: string | null;
  rendimento_dia: number;
  created_at?: string;
  skin?: string;
  liquidity_type?: 'daily' | 'locked_30' | 'locked_365';
  locked_until?: string;
  max_capacity?: number;
}

const AnimatedNumber = ({ value, format }: { value: number, format: (n: number) => ReactNode }) => {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    // Se a diferença for muito pequena, atualiza direto
    if (Math.abs(value - displayValue) < 0.01) {
      setDisplayValue(value);
      return;
    }

    const steps = 20; // Frames da animação
    const diff = value - displayValue;
    const stepValue = diff / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(prev => prev + stepValue);
      }
    }, 16); // ~60fps

    return () => clearInterval(timer);
  }, [value]);

  return <>{format(displayValue)}</>;
};

function App() {
  const [session, setSession] = useState<any>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [error, setError] = useState('')
  const [notification, setNotification] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'mobile' | 'pc'>('mobile')

  const [balance, setBalance] = useState(0)
  const [salary, setSalary] = useState(0)
  const [salaryDay, setSalaryDay] = useState(5)
  const [usdBalance, setUsdBalance] = useState(0)
  const [jpyBalance, setJpyBalance] = useState(0)
  const [cumulativeDeposits, setCumulativeDeposits] = useState(0)
  const [machines, setMachines] = useState<Machine[]>([])
  const totalInvested = useMemo(() => machines.reduce((sum, m) => sum + m.valor, 0), [machines]);
  const xp = totalInvested; // Reflexão direta do saldo das máquinas
  const currentLevel = useMemo(() => Math.floor(xp / 1000), [xp]);
  const [lastLeveledUp, setLastLeveledUp] = useState(0);
  const [confetti, setConfetti] = useState<any[]>([]);
  const [showLevelBurst, setShowLevelBurst] = useState(false);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [levelUpData, setLevelUpData] = useState({ old: 0, new: 0 });

  // REALISMO FINANCEIRO: TRACKING DE "DINHEIRO DO BOLSO" (PRINCIPAL)
  const [totalPrincipalInvested, setTotalPrincipalInvested] = useState(0);

  const [showStairwayChart, setShowStairwayChart] = useState(false);

  const [isLoadingData, setIsLoadingData] = useState(false)

  const [newMachineName, setNewMachineName] = useState('')
  const [newMachineValue, setNewMachineValue] = useState('')

  const [selectedLiquidity, setSelectedLiquidity] = useState<'daily' | 'locked_30' | 'locked_365'>('daily');

  // MANUAL CONTROLS
  const [newMachineCDI, setNewMachineCDI] = useState('100');
  const [newMachineDate, setNewMachineDate] = useState('');
  const [newMachineLimit, setNewMachineLimit] = useState('');

  // PRESETS POPULATE MANUAL FIELDS
  const applyPreset = (type: 'daily' | 'locked_30' | 'locked_365') => {
    setSelectedLiquidity(type);
    const now = new Date();

    if (type === 'daily') {
      setNewMachineCDI('100');
      setNewMachineDate(''); // No lock
      setNewMachineLimit(''); // No limit
    } else if (type === 'locked_30') {
      setNewMachineCDI('105');
      const d = new Date(); d.setDate(now.getDate() + 30);
      setNewMachineDate(d.toISOString().split('T')[0]);
      setNewMachineLimit('5000');
    } else if (type === 'locked_365') {
      setNewMachineCDI('120');
      const d = new Date(); d.setDate(now.getDate() + 365);
      setNewMachineDate(d.toISOString().split('T')[0]);
      setNewMachineLimit('10000');
    }
  }




  const [currentDate, setCurrentDate] = useState(new Date())
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [isAchievementSystemReady, setIsAchievementSystemReady] = useState(false);
  const lastClosedNotifyTime = useRef(0)
  const [selicRate] = useState(DEFAULT_SELIC)

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  // DOPAMINE: Confetti on Level Up
  useEffect(() => {
    if (currentLevel > lastLeveledUp && lastLeveledUp > 0) {
      triggerLevelUpCelebration();
    }
    setLastLeveledUp(currentLevel);
  }, [currentLevel]);

  const triggerLevelUpCelebration = () => {
    // Level burst text
    setShowLevelBurst(true);
    setTimeout(() => setShowLevelBurst(false), 2000);

    // Confetti explosion
    const confettiCount = 50;
    const newConfetti = Array.from({ length: confettiCount }).map((_, i) => ({
      id: Math.random(),
      left: Math.random() * 100,
      animationDelay: `${i * 0.02}s`
    }));
    setConfetti(newConfetti);
    setTimeout(() => setConfetti([]), 3000);
  };

  const cdiAnual = useMemo(() => selicRate - 0.0010, [selicRate])
  const isBusinessDay = useMemo(() => {
    const day = currentDate.getDay();
    return day !== 0 && day !== 6;
  }, [currentDate])

  const isMarketOpen = isBusinessDay;

  const timeUntilMarketOpen = useMemo(() => {
    if (isMarketOpen) return null;

    let target = new Date(currentDate);
    target.setHours(0, 0, 0, 0);

    // Se não é dia útil, procuramos o próximo dia útil (Segunda-feira) às 00:00
    if (!isBusinessDay) {
      // Começamos procurando a partir de amanhã
      target.setDate(target.getDate() + 1);
      // Pula dias que não são úteis (Sábado e Domingo)
      while (target.getDay() === 0 || target.getDay() === 6) {
        target.setDate(target.getDate() + 1);
      }
      target.setHours(0, 0, 0, 0);
    }

    const diff = target.getTime() - currentDate.getTime();
    if (diff <= 0) return "00:00:00";

    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, [currentDate, isMarketOpen, isBusinessDay]);

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedMachine, setSelectedMachine] = useState<any>(null)
  const [aporteValue, setAporteValue] = useState('')
  const [showAporteModal, setShowAporteModal] = useState(false)
  const [showConfirmResgate, setShowConfirmResgate] = useState<any>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingMachine, setEditingMachine] = useState<any>(null)
  const [editName, setEditName] = useState('')
  const [editCDI, setEditCDI] = useState('')
  const [editValue, setEditValue] = useState('')
  const [editDate, setEditDate] = useState('')
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [historyData, setHistoryData] = useState<any[]>([])

  // SIMULATION CALCULATOR STATE
  const [simInitial, setSimInitial] = useState(0);
  const [simMonthly, setSimMonthly] = useState(0);
  const [simRate, setSimRate] = useState(0);
  ;

  const [showCurrencyModal, setShowCurrencyModal] = useState(false)
  const [currencyConfig, setCurrencyConfig] = useState<any>({ type: 'WISE', target: 'USD', amount: '', direction: 'BRL_TO_FOREIGN' })
  const [apiRates, setApiRates] = useState({ USD: 5.37, JPY: 0.035 }) // Default fallbacks
  const fetchExchangeRates = async () => {
    try {
      const res = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL,JPY-BRL');
      const data = await res.json();
      if (data) {
        setApiRates({
          USD: parseFloat(data.USDBRL.ask),
          JPY: parseFloat(data.JPYBRL.ask)
        });
      }
    } catch (e) { console.error('Erro API Cambio:', e) }
  };

  useEffect(() => {
    fetchExchangeRates();
  }, []);

  const [pixKey, setPixKey] = useState('')
  const [showPixConfig, setShowPixConfig] = useState(false)
  const [showPixDeposit, setShowPixDeposit] = useState(false)
  const [depositValue, setDepositValue] = useState('')
  const [depositStep, setDepositStep] = useState(1) // 1: value, 2: QR
  const [pixPayload, setPixPayload] = useState('')
  const [showImpulseModal, setShowImpulseModal] = useState(false)
  const [impulseValue, setImpulseValue] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const [payoutCountdown, setPayoutCountdown] = useState(10) // Novo contador de 10s
  const [coins, setCoins] = useState<{ id: number, x: number, y: number }[]>([])
  const [showMissions, setShowMissions] = useState(false)
  const [newMission, setNewMission] = useState({ label: '', desc: '', target: '' })
  const [missions, setMissions] = useState([
    { id: 1, label: 'CONSTRUINDO A BASE', desc: 'Alcançar R$ 5.000,00 de patrimônio total', target: 5000, claimed: false },
    { id: 2, label: 'RESERVA DE EMERGÊNCIA', desc: 'Alcançar R$ 20.000,00 de patrimônio total', target: 20000, claimed: false },
    { id: 3, label: 'INVESTIDOR ESTRATEGISTA', desc: 'Alcançar R$ 50.000,00 de patrimônio total', target: 50000, claimed: false },
    { id: 4, label: 'RUMO AOS SEIS DÍGITOS', desc: 'Alcançar R$ 100.000,00 de patrimônio total', target: 100000, claimed: false },
    { id: 5, label: 'LIBERDADE GEOGRÁFICA', desc: 'Alcançar R$ 250.000,00 de patrimônio total', target: 250000, claimed: false },
    { id: 6, label: 'INDEPENDÊNCIA FINANCEIRA', desc: 'Alcançar R$ 500.000,00 de patrimônio total', target: 500000, claimed: false },
  ])

  const [celebratingMission, setCelebratingMission] = useState<any>(null)

  const [levelUpPhrase, setLevelUpPhrase] = useState('O passado foi queimado. O futuro é brilhante.')

  const LEVEL_UP_PHRASES = [
    "O passado foi queimado. O futuro é brilhante.",
    "Sua mentalidade evoluiu. Seu patrimônio agradece.",
    "Um novo patamar de riqueza desbloqueado.",
    "A disciplina é a ponte entre metas e realizações.",
    "Cada centavo investido é um soldado trabalhando por você.",
    "O topo é apenas o começo da próxima montanha.",
    "Seus ativos estão trabalhando enquanto você dorme.",
    "A liberdade financeira está cada vez mais próxima.",
    "Você não está gastando, está construindo um império.",
    "Pequenos aportes constantes geram grandes fortunas.",
    "Sua visão de longo prazo está pagando dividendos.",
    "O juro composto é a oitava maravilha do mundo.",
    "Você é o CEO da sua própria vida financeira.",
    "Riqueza não é ter dinheiro, é ter tempo.",
    "Seu eu do futuro agradecerá por este momento.",
    "A consistência vence a intensidade no longo prazo.",
    "Você acaba de subir um degrau na escada do sucesso.",
    "Transforme renda ativa em renda passiva.",
    "O dinheiro é um excelente servo, mas um péssimo mestre.",
    "Continue plantando hoje para colher amanhã."
  ];

  // SKIN SYSTEM STATE (Counters)
  const [skinCounts, setSkinCounts] = useState<any>({
    carbon: 0, vaporwave: 0, glitch: 0, royal: 0, ghost: 0,
    cyber: 0, forest: 0, magma: 0, ice: 0, neon_pink: 0,
    gold_black: 0, sunset: 0, space: 0, emerald: 0, hacker: 0,
    plasma: 0, pixel_art: 0, aurora: 0, obsidian: 0, quantum: 0
  });
  const [equippedItems, setEquippedItems] = useState<any>({ aura: '', nickColor: '', background: '', machineSkin: '' });

  // SKILLS SHOP STATE
  const [showSkillsModal, setShowSkillsModal] = useState(false);
  const [survivalCost, setSurvivalCost] = useState('');

  // ACHIEVEMENTS STATE
  const [persistedAchievements, setPersistedAchievements] = useState<Record<string, { unlockedAt: string, unlocked: boolean, notified: boolean }>>({});
  const [showAchievementsModal, setShowAchievementsModal] = useState(false);
  const [achievementQueue, setAchievementQueue] = useState<Achievement[]>([]);
  const [showAchievementUnlock, setShowAchievementUnlock] = useState(false);
  const [accountCreatedAt, setAccountCreatedAt] = useState(new Date().toISOString());

  // New Action Success UI State
  const [actionPopup, setActionPopup] = useState<{ title: string, msg: string, icon: string } | null>(null);
  const triggerSuccess = (title: string, msg: string, icon: string = '✅') => {
    setActionPopup({ title, msg, icon });
    setTimeout(() => setActionPopup(null), 3000);
  }

  const achievementStats = useMemo(() => {
    const daysActive = Math.floor(
      (new Date().getTime() - new Date(accountCreatedAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    const totalYield = historyData.reduce((sum, h) => sum + (h.total || 0), 0);

    return {
      patrimony: balance + totalInvested,
      machinesCount: machines.length,
      daysActive,
      totalYield,
      level: currentLevel,
      machines
    };
  }, [balance, totalInvested, machines, accountCreatedAt, historyData, currentLevel]);

  const processedAchievements = useMemo(() => {
    return ACHIEVEMENTS.map(ach => {
      const p = persistedAchievements[ach.id];
      const isMet = isRequirementMet(ach, achievementStats);
      return {
        ...ach,
        unlocked: isMet,
        unlockedAt: p?.unlockedAt || (isMet ? new Date().toISOString() : undefined),
        notified: p?.notified || false
      };
    });
  }, [persistedAchievements, achievementStats]);

  // BENCHMARKS STATE
  const [showBenchmarksModal, setShowBenchmarksModal] = useState(false);
  const [showSalaryProjectionModal, setShowSalaryProjectionModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [editSkin, setEditSkin] = useState('');



  // IMOVEIS (FIIs) STATE
  const [showFiiModal, setShowFiiModal] = useState(false);
  const [showPortfolioChart, setShowPortfolioChart] = useState(false);
  const [fiiPortfolio, setFiiPortfolio] = useState<any[]>([]);
  const [fiiMarketData, setFiiMarketData] = useState<any[]>([
    { ticker: 'KNIP11', name: 'Kinea Índice de Preços', sector: 'Papel', price: 91.31, yield: 11.15, change: 0.25, icon: '📄' },
    { ticker: 'HGCR11', name: 'CSHG Recebíveis', sector: 'Papel', price: 97.96, yield: 12.71, change: -0.60, icon: '📝' },
    { ticker: 'HGLG11', name: 'PÁTRIA LOG (HGLG)', sector: 'Tijolo', price: 156.92, yield: 8.41, change: -0.05, icon: '🏭' },
    { ticker: 'XPML11', name: 'XP Malls', sector: 'Tijolo', price: 109.10, yield: 10.12, change: -0.18, icon: '🛍️' }
  ]);

  // DIVIDAS (DEBTS) STATE
  const [showDebtsModal, setShowDebtsModal] = useState(false);
  const [debts, setDebts] = useState<any[]>([]);
  const totalDebts = useMemo(() => debts.reduce((sum, d) => sum + d.valor, 0), [debts]);
  const [newDebt, setNewDebt] = useState({ nome: '', valor: '', categoria: 'cartao' });
  const [confirmPayDebt, setConfirmPayDebt] = useState<any>(null);

  // CÁLCULO DE PATRIMÔNIO TOTAL
  const totalPatrimony = useMemo(() => {
    return balance + xp + (usdBalance * apiRates.USD) + (jpyBalance * apiRates.JPY) + (fiiPortfolio || []).reduce((sum, f) => sum + (f.quantidade * (f.preco_atual || f.preco_pago || 0)), 0);
  }, [balance, xp, usdBalance, jpyBalance, apiRates, fiiPortfolio]);

  const syncFiiMarketData = async () => {
    try {
      // Usando API da MFinance para dados REAIS da B3 (Sem necessidade de token)
      const fetchFii = async (ticker: string) => {
        try {
          const res = await fetch(`https://mfinance.com.br/api/v1/fiis/${ticker}`);
          if (!res.ok) return null;
          return await res.json();
        } catch { return null; }
      };

      const results = await Promise.all(fiiMarketData.map(f => fetchFii(f.ticker)));

      setFiiMarketData(prev => prev.map((f, index) => {
        const real = results[index];
        if (real) {
          return {
            ...f,
            price: real.lastPrice || real.closingPrice || f.price,
            change: real.change || 0,
            yield: real.dividendYield ? (real.dividendYield / 12) : f.yield // Ajusta yield mensal pro jogo
          };
        }
        return f;
      }));
    } catch (e) {
      console.error('Erro ao sincronizar FIIs:', e);
    }
  };

  useEffect(() => {
    if (session) {
      syncFiiMarketData();
      const interval = setInterval(syncFiiMarketData, 30 * 60 * 1000); // Atualiza a cada 30 min (limite plano free)
      return () => clearInterval(interval);
    }
  }, [session]);
  // Achievement Checker - monitors transitions to show popups
  useEffect(() => {
    if (!session || !isInitialLoadComplete || !isAchievementSystemReady) return;

    // We check processedAchievements to see if any just got an 'unlockedAt' that isn't in 'persistedAchievements'
    const newlyUnlocked = processedAchievements.filter(ach => {
      const isMet = ach.unlocked;
      const wasEverUnlocked = !!persistedAchievements[ach.id];
      return isMet && !wasEverUnlocked;
    });

    if (newlyUnlocked.length > 0) {
      // Update persisted state (silent save)
      const newPersisted = { ...persistedAchievements };
      newlyUnlocked.forEach(ach => {
        newPersisted[ach.id] = {
          unlockedAt: ach.unlockedAt || new Date().toISOString(),
          unlocked: true,
          notified: false // Stay false until Resgate
        };
      });
      setPersistedAchievements(newPersisted);
    }

    // Also handle re-locking in persisted state if needed (optional based on preference, 
    // but the requirement says 're-lock' should keep it in DB)
    const needsStatusUpdate = processedAchievements.some(ach => {
      const p = persistedAchievements[ach.id];
      return p && p.unlocked !== ach.unlocked;
    });

    if (needsStatusUpdate) {
      const updatedPersisted = { ...persistedAchievements };
      processedAchievements.forEach(ach => {
        if (updatedPersisted[ach.id]) {
          updatedPersisted[ach.id].unlocked = ach.unlocked;
        }
      });
      setPersistedAchievements(updatedPersisted);
    }
  }, [processedAchievements, session, isInitialLoadComplete]);

  // Popup Queue Consumer
  useEffect(() => {
    if (achievementQueue.length > 0 && !showAchievementUnlock) {
      setShowAchievementUnlock(true);
    }
  }, [achievementQueue, showAchievementUnlock]);

  // Auto-save Missões no Supabase
  useEffect(() => {
    if (!session) return;
    const saveMissions = async () => {
      // Deletar missões antigas e inserir novas
      await supabase.from('user_missions').delete().eq('user_id', session.id);
      if (missions.length > 0) {
        const missionsToSave = missions.map(m => ({
          user_id: session.id,
          mission_id: m.id,
          label: m.label,
          description: m.desc,
          target: m.target,
          claimed: m.claimed
        }));
        await supabase.from('user_missions').insert(missionsToSave);
      }
    };
    saveMissions();
  }, [missions, session]);



  // Auto-save Itens Equipados no Supabase
  useEffect(() => {
    if (!session) return;
    const saveEquipped = async () => {
      await supabase.from('user_equipped_items').upsert({
        user_id: session.id,
        aura: equippedItems.aura || '',
        nick_color: equippedItems.nickColor || '',
        background: equippedItems.background || '',
        updated_at: new Date().toISOString()
      });
    };
    saveEquipped();
  }, [equippedItems, session]);

  // Auto-save Conquistas no Supabase
  useEffect(() => {
    if (!session || !isInitialLoadComplete) return;
    const saveAchievements = async () => {
      const achievementsToSave = Object.entries(persistedAchievements).map(([id, data]) => ({
        user_id: session.id,
        achievement_id: id,
        unlocked: data.unlocked,
        unlocked_at: data.unlockedAt,
        notified: data.notified
      }));

      if (achievementsToSave.length > 0) {
        const { error } = await supabase
          .from('user_achievements')
          .upsert(achievementsToSave, { onConflict: 'user_id, achievement_id' });

        if (error) console.error('Erro ao salvar conquistas:', error.message);
      }
    };
    saveAchievements();
  }, [persistedAchievements, session, isInitialLoadComplete]);













  const handleCreateMission = () => {
    if (!newMission.label || !newMission.target) return setNotification('PREENCHA O NOME E A META')
    const mission = {
      id: Date.now(),
      label: newMission.label.toUpperCase(),
      desc: newMission.desc || `Alcançar R$ ${parseFloat(newMission.target).toFixed(2)} de patrimônio`,
      target: parseFloat(newMission.target),
      claimed: false
    }
    setMissions([...missions, mission])
    setNewMission({ label: '', desc: '', target: '' })
    setNotification('MISSÃO CRIADA')
  }

  const handleClaimMission = (id: number) => {
    const m = missions.find((x: any) => x.id === id);
    if (!m) return;

    setNotification('MISSÃO CONCLUÍDA! PROCESSANDO RECOMPENSA...');

    // Pequeno delay para "sentir" o clique antes da explosão de parabéns
    setTimeout(() => {
      setCelebratingMission(m);
      setMissions((prev: any[]) => prev.map((mx: any) => mx.id === id ? { ...mx, claimed: true } : mx));
      setNotification('CONQUISTA RESGATADA! 🏆');
    }, 800);
  }

  const handleDeleteMission = (id: number) => {
    setMissions(missions.filter((m: any) => m.id !== id));
    setNotification('MISSÃO REMOVIDA');
  }

  const handleClaimAchievement = (achievement: Achievement) => {
    // Adiciona ao popup queue
    setAchievementQueue(prev => [...prev, achievement]);

    // Atualiza estado local e marca como notificado
    const newPersisted = { ...persistedAchievements };
    newPersisted[achievement.id] = {
      ...newPersisted[achievement.id],
      notified: true
    };
    setPersistedAchievements(newPersisted);

    setNotification(`🏆 REIVINDICADO: ${achievement.name.toUpperCase()}!`);
  }

  const formatBRLWithPrecision = (value: number) => {
    const parts = value.toFixed(12).split('.');
    const integerPart = parseInt(parts[0]).toLocaleString('pt-BR');
    const decimals = parts[1];
    const cents = decimals.substring(0, 2);
    const microCents = decimals.substring(2);

    return (
      <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
        R$ {integerPart},{cents}
        <span style={{
          fontSize: '0.55em',
          opacity: 0.5,
          marginLeft: '2px',
          display: 'inline-block',
          transform: 'translateY(-1px)'
        }}>
          {microCents}
        </span>
      </span>
    );
  };

  useEffect(() => {
    // RESET TOTAL DO ESTADO AO TROCAR DE SESSÃO
    // Isso evita que dados de um usuário vazem para o próximo (Bug de migração bruno03 -> bruno01)
    setBalance(0)
    setUsdBalance(0)
    setJpyBalance(0)
    setCumulativeDeposits(0)
    setMachines([])
    setHistoryData([])
    setSkinCounts({
      carbon: 0, vaporwave: 0, glitch: 0, royal: 0, ghost: 0,
      cyber: 0, forest: 0, magma: 0, ice: 0, neon_pink: 0,
      gold_black: 0, sunset: 0, space: 0, emerald: 0, hacker: 0
    })
    setEquippedItems({ aura: '', nickColor: '', background: '', machineSkin: '' })
    setPersistedAchievements({})
    setMissions([
      { id: 1, label: 'CONSTRUINDO A BASE', desc: 'Alcançar R$ 5.000,00 de patrimônio total', target: 5000, claimed: false },
      { id: 2, label: 'RESERVA DE EMERGÊNCIA', desc: 'Alcançar R$ 20.000,00 de patrimônio total', target: 20000, claimed: false },
      { id: 3, label: 'INVESTIDOR ESTRATEGISTA', desc: 'Alcançar R$ 50.000,00 de patrimônio total', target: 50000, claimed: false },
      { id: 4, label: 'RUMO AOS SEIS DÍGITOS', desc: 'Alcançar R$ 100.000,00 de patrimônio total', target: 100000, claimed: false },
      { id: 5, label: 'LIBERDADE GEOGRÁFICA', desc: 'Alcançar R$ 250.000,00 de patrimônio total', target: 250000, claimed: false },
      { id: 6, label: 'INDEPENDÊNCIA FINANCEIRA', desc: 'Alcançar R$ 500.000,00 de patrimônio total', target: 500000, claimed: false },
    ])
    setIsInitialLoadComplete(false)
    setIsAchievementSystemReady(false)

    if (session) {
      loadPlayerData()
    }
  }, [session])

  async function loadPlayerData() {
    try {
      setIsLoadingData(true)
      const { data: stats, error: statsError } = await supabase.from('user_stats').select('*').eq('user_id', session.id).single()

      if (statsError) {
        console.warn('Erro ao carregar stats:', statsError.message);
      } else if (stats) {
        setBalance(stats.balance || 0)
        setSalary(stats.salary || 0)
        setSalaryDay(stats.salary_day || 5)
        if (stats.pix_key) setPixKey(stats.pix_key)
        if (stats.account_created_at) setAccountCreatedAt(stats.account_created_at)

        // Carregar contadores de skins
        setSkinCounts({
          carbon: stats.skin_carbon || 0,
          vaporwave: stats.skin_vaporwave || 0,
          glitch: stats.skin_glitch || 0,
          royal: stats.skin_royal || 0,
          ghost: stats.skin_ghost || 0,
          cyber: stats.skin_cyber || 0,
          forest: stats.skin_forest || 0,
          magma: stats.skin_magma || 0,
          ice: stats.skin_ice || 0,
          neon_pink: stats.skin_neon_pink || 0,
          gold_black: stats.skin_gold_black || 0,
          sunset: stats.skin_sunset || 0,
          space: stats.skin_space || 0,
          emerald: stats.skin_emerald || 0,
          hacker: stats.skin_hacker || 0,
          plasma: stats.skin_plasma || 0,
          pixel_art: stats.skin_pixel_art || 0,
          aurora: stats.skin_aurora || 0,
          obsidian: stats.skin_obsidian || 0,
          quantum: stats.skin_quantum || 0
        });

        setUsdBalance(stats.usd_balance || 0);
        setJpyBalance(stats.jpy_balance || 0);
        setCumulativeDeposits(stats.cumulative_deposits || 0);
        setTotalPrincipalInvested(stats.total_principal_invested || 0);
      }

      // Carregar Missões
      const { data: missionsData } = await supabase
        .from('user_missions')
        .select('*')
        .eq('user_id', session.id)
        .order('mission_id', { ascending: true });

      if (missionsData && missionsData.length > 0) {
        setMissions(missionsData.map(m => ({
          id: m.mission_id,
          label: m.label,
          desc: m.description || '',
          target: m.target,
          claimed: m.claimed
        })));
      }



      // Carregar Itens Equipados
      const { data: equippedData } = await supabase
        .from('user_equipped_items')
        .select('*')
        .eq('user_id', session.id)
        .single();

      if (equippedData) {
        setEquippedItems({
          aura: equippedData.aura || '',
          nickColor: equippedData.nick_color || '',
          background: equippedData.background || ''
        });
      }





      const currentSelic = await fetchSelicRate()
      const currentCDI = currentSelic - 0.0010
      // Limpeza de histórico antigo (> 3 dias) para manter performance e realismo
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      await supabase.from('mining_history').delete().eq('user_id', session.id).lt('date', threeDaysAgo.toISOString());

      const { data: machs, error: machsError } = await supabase.from('maquinas').select('*').eq('user_id', session.id)
      if (machsError) {
        console.warn('Erro ao carregar máquinas:', machsError.message);
      } else if (machs) {
        if (stats?.last_payout) {
          // Passamos o CDI atualizado para o cálculo offline ser preciso
          const recoveredMachines = await checkMissingPayouts(stats.last_payout, machs, currentCDI);
          setMachines(recoveredMachines);
        } else {
          setMachines(machs);
          try {
            await supabase.from('user_stats').update({ last_payout: new Date().toISOString() }).eq('user_id', session.id);
          } catch (e) { console.error('Falha ao resetar payout:', e) }
        }
      }

      // Load History dos últimos 3 dias
      try {
        const { data: history } = await supabase.from('mining_history')
          .select('*')
          .eq('user_id', session.id)
          .gte('date', threeDaysAgo.toISOString())
          .order('date', { ascending: false });

        if (history) {
          setHistoryData(history.map(h => ({
            date: h.date,
            total: h.total_profit || 0,
            machines: h.details || []
          })))
        }
      } catch (e) { console.error('Falha ao carregar histórico:', e) }

      // 7. Carregar Conquistas
      const { data: achievementsData } = await supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', session.id);

      if (achievementsData && achievementsData.length > 0) {
        const persisted: Record<string, { unlockedAt: string, unlocked: boolean, notified: boolean }> = {};
        achievementsData.forEach(ua => {
          persisted[ua.achievement_id] = {
            unlockedAt: ua.unlocked_at,
            unlocked: ua.unlocked,
            notified: ua.notified || false
          };
        });
        setPersistedAchievements(persisted);
      }

      // 8. Carregar Dívidas
      const { data: debtsData } = await supabase
        .from('dividas')
        .select('*')
        .eq('user_id', session.id)
        .eq('paga', false)
        .order('created_at', { ascending: false });

      if (debtsData) {
        setDebts(debtsData);
      }
    } catch (globalError) {
      console.error('Erro crítico no carregamento:', globalError);
      setNotification('ERRO DE CONEXÃO COM O SERVIDOR');
    } finally {
      setIsLoadingData(false)
      setIsInitialLoadComplete(true)

      // A ativação das conquistas deve ser o passo final para evitar pop-ups no login
      setTimeout(() => {
        setIsAchievementSystemReady(true);
      }, 1000);
    }
  }

  const checkMissingPayouts = async (lastPayoutStr: string, currentMachines: any[], activeCDI: number) => {
    const lastPayout = new Date(lastPayoutStr);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - lastPayout.getTime()) / 1000);

    // Se passou menos de um ciclo (10s), retorna as máquinas originais
    if (diffSeconds < 10) return currentMachines;

    const cyclesMissed = Math.floor(diffSeconds / 10);
    // Calculamos o tempo exato consumido pelos ciclos para atualizar o last_payout de forma justa
    // Sem perder os segundos "quebrados" (< 10s)
    const consumedTime = cyclesMissed * 10000;
    const nextPayoutDate = new Date(lastPayout.getTime() + consumedTime);

    let totalEarned = 0;

    // Verificamos se 'lastPayout' era dia útil.
    const isNowUseful = now.getDay() !== 0 && now.getDay() !== 6;

    if (!isNowUseful) {
      // Se estamos no fim de semana, apenas atualiza timestamp sem dar lucro
      await supabase.from('user_stats').update({ last_payout: now.toISOString() }).eq('user_id', session.id);
      return currentMachines;
    }

    // Calcula quantos segundos de final de semana existem no intervalo para descontar
    let weekendSeconds = 0;
    let checkDate = new Date(lastPayout);
    while (checkDate < now) {
      if (checkDate.getDay() === 0 || checkDate.getDay() === 6) {
        weekendSeconds += 10; // Incremento de 10s para precisão de ciclos
      }
      checkDate.setTime(checkDate.getTime() + 10000);
    }

    const effectiveDiffSeconds = Math.max(0, diffSeconds - weekendSeconds);
    const effectiveCycles = Math.floor(effectiveDiffSeconds / 10);

    const machineState = currentMachines.map(m => {
      const { iofFactor, irFactor } = getTaxMultipliers(m.created_at, false, now);
      const dailyGross = (m.valor * (m.cdi_quota / 100) * activeCDI) / 252;
      const dailyNet = dailyGross * irFactor * iofFactor;
      const profit = dailyNet * (effectiveCycles / 8640);

      const newVal = m.valor + profit;
      totalEarned += profit;

      const isNewDay = lastPayout.toDateString() !== now.toDateString();
      const dailyYield = isNewDay ? profit : (m.rendimento_dia || 0) + profit;

      return { ...m, valor: newVal, rendimento_dia: dailyYield };
    });

    // Rendimento Offline para Saldo USD (Wise Rende+)
    let usdProfitBRL = 0;
    if (usdBalance > 0) {
      const usdInterest = (usdBalance * WISE_USD_APY) / 365 * (effectiveDiffSeconds / 86400);
      usdProfitBRL = usdInterest * apiRates.USD;
      totalEarned += usdProfitBRL;

      const newUsdBalance = usdBalance + usdInterest;
      setUsdBalance(newUsdBalance);
      await supabase.from('user_stats').update({ usd_balance: newUsdBalance }).eq('user_id', session.id);
    }

    if (totalEarned > 0.0001) {
      // Otimização: Upsert em lote em vez de loop
      const updates = machineState.map(m => ({
        id: m.id,
        user_id: session.id,
        valor: m.valor,
        rendimento_dia: m.rendimento_dia,
        nome: m.nome,
        cdi_quota: m.cdi_quota,
        vencimento: m.vencimento,
        created_at: m.created_at
      }));

      await supabase.from('maquinas').upsert(updates);

      // Registrar o lucro offline no histórico consolidado do dia
      const historyDetails = [
        ...machineState.map(m => ({
          nome: m.nome,
          valor: m.valor,
          yield: m.valor - (currentMachines.find(ox => ox.id === m.id)?.valor || 0),
          offline: true
        }))
      ];

      if (usdProfitBRL > 0) {
        historyDetails.push({
          nome: 'WISE RENDE+ (USD)',
          valor: usdBalance,
          yield: usdProfitBRL,
          offline: true
        } as any);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dayKey = today.toISOString();

      const { data: existing } = await supabase.from('mining_history')
        .select('*')
        .eq('user_id', session.id)
        .eq('date', dayKey)
        .maybeSingle();

      if (existing) {
        await supabase.from('mining_history').update({
          total_profit: (existing.total_profit || 0) + totalEarned,
          details: [
            ...(existing.details || []),
            ...historyDetails
          ]
        }).eq('id', existing.id);
      } else {
        await supabase.from('mining_history').insert([{
          user_id: session.id,
          date: dayKey,
          total_profit: totalEarned,
          details: historyDetails,
          total_patrimony_snapshot: balance + xp + (usdBalance * apiRates.USD) + (jpyBalance * apiRates.JPY),
          total_invested_snapshot: totalPrincipalInvested
        }]);
      }

      setNotification(`SISTEMA RECONECTADO: +R$ ${totalEarned.toFixed(12)} ACUMULADOS!`);
    }

    // SEMPRE ATUALIZA O TIMESTAMP AO FINAL PARA EVITAR LOOP DE LOGIN/LOGOUT
    await supabase.from('user_stats').update({ last_payout: nextPayoutDate.toISOString() }).eq('user_id', session.id);

    return machineState;
  }

  async function fetchSelicRate() {
    try {
      const response = await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.1178/dados/ultimos/1?formato=json')
      const data = await response.json()
      if (data && data[0]) {
        // A série 1178 (SELIC Over) traz a taxa real, mas mantemos a meta de 15% para a simulação
        const valorString = data[0].valor.replace(',', '.');
        const ratePercent = parseFloat(valorString);
        const annualDecimal = ratePercent / 100;

        // Apenas retornamos para uso futuro, sem sobrescrever o estado da simulação de 2026
        return annualDecimal;
      }
    } catch (e) { console.error('Falha ao buscar SELIC:', e) }
    return DEFAULT_SELIC
  }

  /* -------------------------------------------------------------------------- */
  /*                            WISE RENDE+ (INTEREST)                          */
  /* -------------------------------------------------------------------------- */
  const WISE_USD_APY = 0.035; // 3.5% APY conforme Wise Interest BlackRock

  const yields = useMemo(() => {
    let totalD = 0;
    let totalH = 0;
    let totalDProjected = 0; // Para cálculos de semana e mês, ignoramos IOF momentâneo

    machines.forEach((m: any) => {
      const { iofFactor, irFactor } = getTaxMultipliers(m.created_at, false, currentDate);
      const { irFactor: irFactorProj } = getTaxMultipliers(m.created_at, true, currentDate); // Ignora IOF

      const dailyGross = (m.valor * (m.cdi_quota / 100) * cdiAnual) / 252;

      const dailyNet = dailyGross * irFactor * iofFactor;
      const dailyNetProjected = dailyGross * irFactorProj; // Sem IOF

      const yield10s = dailyNet / 8640;
      const hourlyNet = yield10s * 360;

      totalD += dailyNet;
      totalH += hourlyNet;
      totalDProjected += dailyNetProjected;
    });

    // Adiciona o rendimento do saldo USD (Wise Rende+)
    if (usdBalance > 0) {
      const usdDailyRate = WISE_USD_APY / 365;
      const usdDailyYieldInBRL = (usdBalance * usdDailyRate) * apiRates.USD;
      totalD += usdDailyYieldInBRL;
      totalH += (usdDailyYieldInBRL / 24);
      totalDProjected += usdDailyYieldInBRL;
    }

    // Adiciona rendimento de FIIs
    let fiiDailyTotal = 0;
    fiiPortfolio.forEach(f => {
      const marketAsset = fiiMarketData.find(m => m.ticker === f.ticker);
      if (marketAsset && f.quantidade > 0) {
        const dailyYieldFii = (f.quantidade * marketAsset.price * (marketAsset.yield / 100)) / 21;
        fiiDailyTotal += dailyYieldFii;
      }
    });

    totalD += fiiDailyTotal;
    totalH += (fiiDailyTotal / 24);
    totalDProjected += fiiDailyTotal;

    return {
      hourlyYield: totalH,
      dailyYield: totalD,
      weeklyYield: totalDProjected * 5,
      monthlyYield: totalDProjected * 21
    }
  }, [machines, cdiAnual, currentDate, usdBalance, apiRates.USD, fiiPortfolio, fiiMarketData])

  const timeToYield = useMemo(() => {
    return `00:00:${payoutCountdown.toString().padStart(2, '0')}`;
  }, [payoutCountdown]);

  // Detector de Level Up
  useEffect(() => {
    if (lastLeveledUp === 0) {
      setLastLeveledUp(currentLevel);
      return;
    }
    if (currentLevel > lastLeveledUp) {
      setLevelUpData({ old: lastLeveledUp, new: currentLevel });

      // Random Phrase Selection
      const randomPhrase = LEVEL_UP_PHRASES[Math.floor(Math.random() * LEVEL_UP_PHRASES.length)];
      setLevelUpPhrase(randomPhrase);

      setShowLevelUpModal(true);
      setLastLeveledUp(currentLevel);
    } else if (currentLevel < lastLeveledUp) {
      setLastLeveledUp(currentLevel);
    }
  }, [currentLevel, lastLeveledUp]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();

      setCurrentDate(prevDate => {
        // Detecção de mudança de dia para reset de rendimento diário
        if (prevDate && prevDate.getDate() !== now.getDate()) {
          setMachines(prev => prev.map(m => ({ ...m, rendimento_dia: 0 })));
          setNotification('NOVO DIA INICIADO: RENDIMENTOS ZERADOS');
        }
        return now;
      });

      setPayoutCountdown(prev => {
        if (prev <= 1) {
          if (machines.length > 0) {
            processYieldCycle();
          }
          return 10;
        }
        return prev - 1;
      });
    }, 1000)
    return () => clearInterval(timer)
  }, [machines, session, usdBalance, jpyBalance, fiiPortfolio, fiiMarketData, cdiAnual, currentDate, apiRates])


  const historyStats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

    let totalToday = 0;
    let total24h = 0;

    historyData.forEach(h => {
      const hDate = new Date(h.date);
      if (hDate >= startOfToday) totalToday += h.total;
      if (hDate >= twentyFourHoursAgo) total24h += h.total;
    });

    return { totalToday, total24h };
  }, [historyData, currentDate]);

  const groupedHistory = useMemo(() => {
    const groups: { [key: string]: any } = {};
    historyData.forEach(h => {
      const date = new Date(h.date);
      const dateKey = date.toLocaleDateString('pt-BR');
      if (!groups[dateKey]) {
        groups[dateKey] = { dateStr: dateKey, total: 0, machines: {}, rawDate: date };
      }
      groups[dateKey].total += h.total;

      // Agrega por máquina para o resumo do dia
      if (h.machines) {
        h.machines.forEach((m: any) => {
          if (!groups[dateKey].machines[m.nome]) {
            groups[dateKey].machines[m.nome] = 0;
          }
          groups[dateKey].machines[m.nome] += (m.yield || 0);
        });
      }
    });

    return Object.values(groups)
      .sort((a: any, b: any) => b.rawDate.getTime() - a.rawDate.getTime())
      .slice(0, 3)
      .map((g: any) => ({
        date: g.dateStr,
        total: g.total,
        machines: Object.entries(g.machines).map(([nome, yieldVal]) => ({
          nome,
          yield: yieldVal
        }))
      }));
  }, [historyData]);

  const processYieldCycle = async () => {
    // Rendimento só ocorre em dias úteis (Regra dos 252 dias)
    if (!isBusinessDay) {
      const now = Date.now();
      // Notifica apenas 1 vez a cada minuto para não poluir a tela
      if (now - lastClosedNotifyTime.current >= 60000) {
        setNotification('VALORES ESTÁTICOS: MERCADO FINANCEIRO FECHADO HOJE');
        lastClosedNotifyTime.current = now;
      }
      return;
    }

    if (!session) return;

    let cycleTotalProfit = 0;
    // SEGURANÇA: Filtramos máquinas que não pertencem à sessão atual para evitar cross-account leak
    const validMachines = machines.filter((m: any) => m.user_id === session.id);

    if (validMachines.length === 0 && machines.length > 0) {
      console.warn('Detectada inconsistência de sessão nas máquinas. Abortando ciclo.');
      return;
    }

    const updatedMachines = validMachines.map((m: any) => {
      const { iofFactor, irFactor } = getTaxMultipliers(m.created_at, false, currentDate);
      const dailyGross = (m.valor * (m.cdi_quota / 100) * cdiAnual) / 252;
      const dailyNet = dailyGross * irFactor * iofFactor;
      const yield10s = dailyNet / 8640;

      cycleTotalProfit += yield10s;

      const dailyYield = (m.rendimento_dia || 0) + yield10s;
      return { ...m, valor: m.valor + yield10s, rendimento_dia: dailyYield };
    });

    let usdInterestCycle = 0;
    if (usdBalance > 0) {
      // Rendimento anual / dias no ano / ciclos de 10s no dia (8640)
      usdInterestCycle = (usdBalance * WISE_USD_APY) / 365 / 8640;
      const newUsdBalance = usdBalance + usdInterestCycle;
      setUsdBalance(newUsdBalance);
      // Persistimos o balance dólar atualizado
      await supabase.from('user_stats').update({ usd_balance: newUsdBalance }).eq('user_id', session.id);
    }

    setMachines(updatedMachines);

    // Trigger Coin Animation
    // Trigger Coin Animation (Dynamic: Coins for small yield, Money Bags for big yield)
    if (cycleTotalProfit > 0) {
      const isBigWin = cycleTotalProfit > 50; // Threshold for bag animation
      const particlesCount = isBigWin ? 3 : 5;

      const newCoins = Array.from({ length: particlesCount }).map(() => ({
        id: Math.random(),
        x: 30 + Math.random() * 40,
        y: 70 + Math.random() * 10,
        type: isBigWin ? 'bag' : 'coin'
      }));
      setCoins((prev: any) => [...prev, ...newCoins]);
      setTimeout(() => setCoins((prev: any) => prev.filter((c: any) => !newCoins.includes(c))), 2000);
    }

    // Otimização: Consolida as atualizações das máquinas em um único comando Supabase
    const machineUpdates = updatedMachines.map(m => ({
      id: m.id,
      user_id: session.id,
      valor: m.valor,
      rendimento_dia: m.rendimento_dia,
      nome: m.nome,
      cdi_quota: m.cdi_quota,
      vencimento: m.vencimento,
      created_at: m.created_at
    }));

    await supabase.from('maquinas').upsert(machineUpdates);

    // O histórico agora funciona a cada 24h: mantemos um único registro por dia detalhando o lucro acumulado
    if (cycleTotalProfit > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dayKey = today.toISOString();

      // Buscamos se já existe um registro de histórico para hoje
      const { data: existing } = await supabase.from('mining_history')
        .select('*')
        .eq('user_id', session.id)
        .eq('date', dayKey)
        .maybeSingle();

      const usdInterestBRL = usdInterestCycle * apiRates.USD;

      let fiiProfitCycle = 0;
      fiiPortfolio.forEach(f => {
        const marketAsset = fiiMarketData.find(m => m.ticker === f.ticker);
        if (marketAsset && f.quantidade > 0) {
          const yieldPerCycle = (f.quantidade * marketAsset.price * (marketAsset.yield / 100)) / 21 / 8640;
          fiiProfitCycle += yieldPerCycle;
        }
      });

      const dailyTotalProfit = updatedMachines.reduce((sum, m) => sum + (m.rendimento_dia || 0), 0) + usdInterestBRL + (fiiProfitCycle * 8640);

      const dailyDetails = [
        ...updatedMachines.map(m => ({
          nome: m.nome,
          valor: m.valor,
          yield: m.rendimento_dia || 0
        }))
      ];

      if (usdInterestBRL > 0) {
        dailyDetails.push({
          nome: 'WISE RENDE+ (USD)',
          valor: usdBalance,
          yield: usdInterestBRL
        } as any);
      }

      if (fiiProfitCycle > 0) {
        dailyDetails.push({
          nome: 'IMÓVEIS (FIIs)',
          valor: fiiPortfolio.reduce((s, f) => s + (f.quantidade * (f.preco_atual || f.preco_pago || 100)), 0),
          yield: fiiProfitCycle * 8640
        } as any);
      }

      const snapshot = {
        date: dayKey,
        total: dailyTotalProfit,
        machines: dailyDetails
      };

      if (existing) {
        await supabase.from('mining_history').update({
          total_profit: dailyTotalProfit,
          details: dailyDetails
        }).eq('id', existing.id);
      } else {
        await supabase.from('mining_history').insert([{
          user_id: session.id,
          date: dayKey,
          total_profit: dailyTotalProfit,
          details: dailyDetails
        }]);
      }

      // Atualiza o estado local para refletir a consolidação diária em tempo real
      setHistoryData(prev => {
        const otherDays = prev.filter(h => new Date(h.date).toDateString() !== today.toDateString());
        return [snapshot, ...otherDays];
      });
    }

    await supabase.from('user_stats').update({ last_payout: new Date().toISOString() }).eq('user_id', session.id);
  }

  const handleAporte = async () => {
    const valor = parseFloat(aporteValue)
    if (valor > balance) return setNotification('CAPITAL INSUFICIENTE')
    const novoValor = selectedMachine.valor + valor
    const { error } = await supabase.from('maquinas').update({ valor: novoValor }).eq('id', selectedMachine.id)
    if (!error) {
      setMachines(machines.map(m => m.id === selectedMachine.id ? { ...m, valor: novoValor } : m))
      const newBalance = balance - valor
      setBalance(newBalance)
      await supabase.from('user_stats').upsert({ user_id: session.id, balance: newBalance })
      setShowAporteModal(false)
      setAporteValue('')
      triggerSuccess('APORTE REALIZADO', `Capital aplicado com sucesso em ${selectedMachine.nome}`, '💵');
    }
  }

  const handleResgate = async () => {
    const { error } = await supabase.from('maquinas').delete().eq('id', showConfirmResgate.id)
    if (!error) {
      const newBalance = balance + showConfirmResgate.valor
      setBalance(newBalance)
      setMachines(machines.filter(m => m.id !== showConfirmResgate.id))
      await supabase.from('user_stats').upsert({ user_id: session.id, balance: newBalance })
      setShowConfirmResgate(null)
      triggerSuccess('RESGATE CONCLUÍDO', 'O capital retornou ao saldo líquido.', '💰');

      // Revelação de Conquistas Pendentes
      const pendingToNotify = processedAchievements.filter(ach => {
        const p = persistedAchievements[ach.id];
        return ach.unlocked && (!p || !p.notified);
      });

      if (pendingToNotify.length > 0) {
        setTimeout(() => {
          setAchievementQueue(prev => [...prev, ...pendingToNotify]);
          const newPersisted = { ...persistedAchievements };
          pendingToNotify.forEach(ach => {
            newPersisted[ach.id] = { ...newPersisted[ach.id], notified: true };
          });
          setPersistedAchievements(newPersisted);
        }, 1500);
      }
    }
  }

  const createMachine = async () => {
    const valor = parseFloat(newMachineValue)
    if (valor > balance) return setNotification('CAPITAL INSUFICIENTE')
    const newMachine = {
      user_id: session.id,
      nome: newMachineName.toUpperCase(),
      valor,
      cdi_quota: parseFloat(newMachineCDI),
      vencimento: newMachineDate || null,
      rendimento_dia: 0,
      skin: 'none',
      liquidity_type: selectedLiquidity,
      locked_until: newMachineDate || null,
      max_capacity: newMachineLimit ? parseFloat(newMachineLimit) : null,
      created_at: new Date().toISOString()
    }
    const { data, error } = await supabase.from('maquinas').insert([newMachine]).select().single()
    if (!error && data) {
      setMachines([...machines, data])
      const newBalance = balance - valor
      setBalance(newBalance)
      await supabase.from('user_stats').upsert({ user_id: session.id, balance: newBalance })
      triggerSuccess('NOVO ATIVO ADQUIRIDO', `${newMachineName.toUpperCase()} já está minerando CDI!`, '🏗️');
      setShowCreateModal(false)
    } else if (error) {
      setNotification(`ERRO: ${error.message}`)
    }
  }

  const updateMachine = async () => {
    if (!editingMachine) return
    const updatedFields = {
      nome: editName,
      valor: parseFloat(editValue),
      cdi_quota: parseFloat(editCDI),
      vencimento: editDate || null,
      skin: editSkin ? String(editSkin) : 'none'
    }
    const { error } = await supabase.from('maquinas').update(updatedFields).eq('id', editingMachine.id)
    if (!error) {
      setMachines(machines.map(m => m.id === editingMachine.id ? { ...m, ...updatedFields } as Machine : m))
      triggerSuccess('CONFIGURAÇÕES SALVAS', 'As alterações foram sincronizadas na rede.', '🛠️');
      setShowEditModal(false)
    } else {
      setNotification(`ERRO: ${error.message}`)
    }
  }


  const savePixKey = async () => {
    if (!session) return;
    const { error } = await supabase
      .from('user_stats')
      .upsert({
        user_id: session.id,
        pix_key: pixKey,
        balance: balance
      });

    if (!error) {
      setNotification('CHAVE PIX SINCRONIZADA');
      setShowPixConfig(false);
    } else {
      setNotification(`ERRO: ${error.message}`);
      console.error('Erro Supabase:', error);
    }
  }


  const handlePixDeposit = async () => {
    const value = parseFloat(depositValue);
    if (isNaN(value) || value <= 0) return setNotification('VALOR INVÁLIDO');

    // Se não houver chave Pix, avisamos mas permitimos gerar um Pix de teste
    if (!pixKey) {
      setNotification('AVISO: CHAVE PIX NÃO CONFIGURADA. USANDO CHAVE DE TESTE.');
    }

    const effectivePixKey = pixKey || '000.000.000-00';
    const payload = generateStaticPixPayload(effectivePixKey, value, 'CDI TYCOON', 'BRASILIA');
    setPixPayload(payload);
    setDepositStep(2);
  }

  const createDebt = async () => {
    const valor = parseFloat(newDebt.valor);
    if (!newDebt.nome || isNaN(valor) || valor <= 0) return setNotification('PREENCHA OS DADOS CORRETAMENTE');

    const debtData = {
      user_id: session.id,
      nome: newDebt.nome.toUpperCase(),
      valor,
      categoria: newDebt.categoria,
      paga: false,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('dividas').insert([debtData]).select().single();
    if (!error && data) {
      setDebts([data, ...debts]);
      setNewDebt({ nome: '', valor: '', categoria: 'cartao' });

      // AUTO-UPDATE SALARY: Deduct debt value from monthly capacity
      const updatedSalary = salary - valor;
      updateSalary(updatedSalary);

      triggerSuccess('DÍVIDA REGISTRADA', `${debtData.nome} registrada e descontada do salário.`, '💸');
    } else {
      setNotification(`ERRO AO CRIAR DÍVIDA: ${error?.message}`);
    }
  }

  const payDebt = async (debt: any) => {
    if (balance < debt.valor) return setNotification('CAPITAL LÍQUIDO INSUFICIENTE');

    const { error } = await supabase.from('dividas').update({ paga: true }).eq('id', debt.id);
    if (!error) {
      const newBalance = balance - debt.valor;
      setBalance(newBalance);
      setDebts(debts.filter(d => d.id !== debt.id));
      await supabase.from('user_stats').upsert({ user_id: session.id, balance: newBalance });
      setConfirmPayDebt(null);
      triggerSuccess('DÍVIDA PAGA', `Débito de ${debt.nome} liquidado com sucesso!`, '🧾');
    } else {
      setNotification(`ERRO AO PAGAR: ${error.message}`);
    }
  }

  const updateSalary = async (val: number) => {
    setSalary(val);
    if (!session) return;
    const { error } = await supabase.from('user_stats').update({ salary: val }).eq('user_id', session.id);
    if (error) console.error('Erro ao salvar salário:', error.message);
  }

  const updateSalaryDay = async (day: number) => {
    setSalaryDay(day);
    if (!session) return;
    const { error } = await supabase.from('user_stats').update({ salary_day: day }).eq('user_id', session.id);
    if (error) console.error('Erro ao salvar dia do salário:', error.message);
  }

  const confirmPixPayment = async () => {
    const value = parseFloat(depositValue)
    const newBalance = balance + value
    const newPrincipal = totalPrincipalInvested + value

    const { error } = await supabase.from('user_stats').upsert({
      user_id: session.id,
      balance: newBalance,
      total_principal_invested: newPrincipal
    })

    if (!error) {
      setBalance(newBalance)
      setTotalPrincipalInvested(newPrincipal)

      const totalAcc = cumulativeDeposits + value;
      const skinsToAward = Math.floor(totalAcc / 1000);
      const remainder = totalAcc % 1000;
      setCumulativeDeposits(remainder);

      if (skinsToAward > 0) {

        const newCounts = { ...skinCounts };
        let awardedList: string[] = [];

        for (let i = 0; i < skinsToAward; i++) {
          const rand = Math.random();
          let picked = 'carbon';

          if (rand > 0.99) picked = 'quantum';
          else if (rand > 0.98) picked = 'hacker';
          else if (rand > 0.96) picked = 'obsidian';
          else if (rand > 0.94) picked = 'ghost';
          else if (rand > 0.92) picked = 'aurora';
          else if (rand > 0.90) picked = 'space';
          else if (rand > 0.86) picked = 'royal';
          else if (rand > 0.82) picked = 'emerald';
          else if (rand > 0.78) picked = 'magma';
          else if (rand > 0.74) picked = 'cyber';
          else if (rand > 0.70) picked = 'glitch';
          else if (rand > 0.65) picked = 'plasma';
          else if (rand > 0.60) picked = 'neon_pink';
          else if (rand > 0.55) picked = 'pixel_art';
          else if (rand > 0.50) picked = 'gold_black';
          else if (rand > 0.40) picked = 'sunset';
          else if (rand > 0.30) picked = 'ice';
          else if (rand > 0.15) picked = 'vaporwave';
          else picked = Math.random() > 0.5 ? 'carbon' : 'forest';

          newCounts[picked] = (newCounts[picked] || 0) + 1;
          awardedList.push(picked.toUpperCase());
        }

        setSkinCounts(newCounts);

        await supabase.from('user_stats').upsert({
          user_id: session.id,
          cumulative_deposits: remainder,
          skin_carbon: newCounts.carbon,
          skin_vaporwave: newCounts.vaporwave,
          skin_glitch: newCounts.glitch,
          skin_royal: newCounts.royal,
          skin_ghost: newCounts.ghost,
          skin_cyber: newCounts.cyber,
          skin_forest: newCounts.forest,
          skin_magma: newCounts.magma,
          skin_ice: newCounts.ice,
          skin_neon_pink: newCounts.neon_pink,
          skin_gold_black: newCounts.gold_black,
          skin_sunset: newCounts.sunset,
          skin_space: newCounts.space,
          skin_emerald: newCounts.emerald,
          skin_hacker: newCounts.hacker,
          skin_plasma: newCounts.plasma,
          skin_pixel_art: newCounts.pixel_art,
          skin_aurora: newCounts.aurora,
          skin_obsidian: newCounts.obsidian,
          skin_quantum: newCounts.quantum
        });

        triggerSuccess('DEPÓSITO CONFIRMADO', `Recebido: R$ ${value.toFixed(2)}. +${skinsToAward} Skins desbloqueadas!`, '✨');
      } else {
        await supabase.from('user_stats').upsert({
          user_id: session.id,
          cumulative_deposits: remainder
        });
        triggerSuccess('DEPÓSITO CONFIRMADO', `Capital de R$ ${value.toFixed(2)} injetado no sistema.`, '🏦');
      }

      setShowPixDeposit(false)
      setDepositStep(1)
      setDepositValue('')
    } else {
      setNotification(`ERRO NO DEPÓSITO: ${error.message}`)
      console.error('Erro Supabase:', error)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setNotification('COPIADO PARA ÁREA DE TRANSFERÊNCIA')
  }

  const handleWithdraw = async () => {
    if (balance <= 0) return setNotification('SEU SALDO JÁ ESTÁ ZERADO');

    const amountRemoved = balance;
    // Remove apenas do saldo líquido (user_stats), não toca nas máquinas (investimentos)
    const { error } = await supabase
      .from('user_stats')
      .update({ balance: 0 })
      .eq('user_id', session.id);

    if (!error) {
      setBalance(0);
      triggerSuccess('SISTEMA RESETADO', `${amountRemoved.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} removidos do saldo.`, '💳');
    } else {
      setNotification(`FALHA AO ZERAR: ${error.message}`);
    }
  }

  const handleImpulseInvest = async () => {
    const val = parseFloat(impulseValue);
    if (!val || val <= 0) return;

    const newBalance = balance + val;
    // Opcional: Criar um registro histórico específico "Economia de Impulso"

    // Atualiza saldo
    const { error } = await supabase.from('user_stats').upsert({
      user_id: session.id,
      balance: newBalance
    });

    if (!error) {
      setBalance(newBalance);
      triggerSuccess('ECONOMIA INTELIGENTE', `+R$ ${val.toFixed(2)} salvos pela sua disciplina!`, '🧠');
      setShowImpulseModal(false);
      setImpulseValue('');

      // Easter egg visual 
      const newCoins = Array.from({ length: 8 }).map(() => ({
        id: Math.random(),
        x: 50,
        y: 50
      }));
      setCoins((prev: any) => [...prev, ...newCoins]);
      setTimeout(() => setCoins((prev: any) => prev.filter((c: any) => !newCoins.includes(c))), 1200);

    } else {
      setNotification('ERRO AO PROCESSAR ECONOMIA');
    }
  }

  const handleExportBackup = () => {
    const backupData = {
      timestamp: new Date().toISOString(),
      username: session.username,
      machines,
      history: historyData,
      usdBalance,
      jpyBalance
    }
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${session.username}_${new Date().getTime()}.json`;
    a.click();
    setNotification('BACKUP EXPORTADO COM SUCESSO');
  }

  const handleCurrencyExchange = async (fromAmount: number, toAmount: number, target: 'USD' | 'JPY', direction: 'BRL_TO_FOREIGN' | 'FOREIGN_TO_BRL' = 'BRL_TO_FOREIGN') => {
    let newBrlBalance = balance;
    let newUsdBalance = usdBalance;
    let newJpyBalance = jpyBalance;

    if (direction === 'BRL_TO_FOREIGN') {
      if (balance < fromAmount) return setNotification('SALDO INSUFICIENTE');
      newBrlBalance = balance - fromAmount;
      if (target === 'USD') newUsdBalance = usdBalance + toAmount;
      else if (target === 'JPY') newJpyBalance = jpyBalance + toAmount;
    } else {
      const foreignBalance = target === 'USD' ? usdBalance : jpyBalance;
      if (foreignBalance < fromAmount) return setNotification('SALDO INSUFICIENTE');

      if (target === 'USD') newUsdBalance = usdBalance - fromAmount;
      else if (target === 'JPY') newJpyBalance = jpyBalance - fromAmount;
      newBrlBalance = balance + toAmount;
    }

    const { error } = await supabase.from('user_stats').update({
      balance: newBrlBalance,
      usd_balance: newUsdBalance,
      jpy_balance: newJpyBalance
    }).eq('user_id', session.id);

    if (!error) {
      setBalance(newBrlBalance);
      setUsdBalance(newUsdBalance);
      setJpyBalance(newJpyBalance);
      triggerSuccess('CÂMBIO CONCLUÍDO', `Conversão ${direction === 'BRL_TO_FOREIGN' ? 'para' : 'de'} ${target} realizada via Wise.`, '💱');
      setShowCurrencyModal(false);
    } else {
      setNotification('ERRO AO PROCESSAR CÂMBIO');
    }
  }

  const handleBuyFii = async (ticker: string, quantity: number, price: number) => {
    const cost = price * quantity;
    if (balance < cost) return setNotification('SALDO INSUFICIENTE_PARA_COMPRA');

    const newBalance = balance - cost;
    const existing = fiiPortfolio.find(f => f.ticker === ticker);
    let updatedPortfolio = [];

    if (existing) {
      const totalQty = existing.quantidade + quantity;
      const avgPrice = ((existing.quantidade * (existing.preco_medio || existing.preco_pago || 100)) + (quantity * price)) / totalQty;
      updatedPortfolio = fiiPortfolio.map(f => f.ticker === ticker ? { ...f, quantidade: totalQty, preco_medio: avgPrice } : f);
    } else {
      updatedPortfolio = [...fiiPortfolio, { ticker, quantidade: quantity, preco_medio: price, preco_pago: price }];
    }

    setBalance(newBalance);
    setFiiPortfolio(updatedPortfolio);

    localStorage.setItem(`fii_${session.id}`, JSON.stringify(updatedPortfolio));
    await supabase.from('user_stats').update({ balance: newBalance }).eq('user_id', session.id);

    triggerSuccess('TOKEN IMOBILIÁRIO', `${quantity} cotas de ${ticker} registradas com sucesso.`, '🏛️');
  };

  useEffect(() => {
    if (session) {
      const saved = localStorage.getItem(`fii_${session.id}`);
      if (saved) setFiiPortfolio(JSON.parse(saved));
    }
  }, [session]);

  const chartData = useMemo(() => {
    const investedFII = fiiPortfolio.reduce((sum, f) => sum + (f.quantidade * (f.preco_atual || f.preco_pago || 0)), 0);
    const usdVal = usdBalance * apiRates.USD;
    const jpyVal = jpyBalance * apiRates.JPY;
    const total = balance + xp + usdVal + jpyVal + investedFII;

    if (total === 0) return [];

    return [
      { name: 'SALDO BRL', value: balance, color: '#00A3FF' },
      { name: 'CDI (MÁQS)', value: xp, color: '#00E676' },
      { name: 'IMÓVEIS', value: investedFII, color: '#FFD700' },
      { name: 'DÓLAR (USD)', value: usdVal, color: '#FF4D4D' },
      { name: 'IENE (JPY)', value: jpyVal, color: '#C0C0C0' }
    ].filter(item => item.value > 0);
  }, [balance, xp, fiiPortfolio, usdBalance, jpyBalance, apiRates]);



  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isRegistering) {
      const { data, error } = await supabase.from('usuarios').insert([{ username, password }]).select().single()
      if (!error) {
        setIsRegistering(false)
        await supabase.from('user_stats').insert([{ user_id: data.id, balance: 0 }])
        setNotification('PERSONAGEM CRIADO')
      } else { setError(error.message) }
    } else {
      const { data, error } = await supabase.from('usuarios').select('*').eq('username', username).eq('password', password).single()
      if (!error && data) { setSession(data) } else { setError('ACESSO NEGADO') }
    }
  }

  const renderContent = () => {
    if (!session) {
      return (
        <div className="login-screen">
          <div className="data-stream-bg">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="data-column" style={{
                left: `${i * 5}%`,
                animationDelay: `${Math.random() * 10}s`,
                animationDuration: `${10 + Math.random() * 20}s`
              }}>
                {Array.from({ length: 20 }).map(() => ['R$', 'CDI', 'SELIC', '100%', 'NET'][Math.floor(Math.random() * 5)]).join(' ')}
              </div>
            ))}
          </div>
          <div className="glass-panel login-card">
            <h1 className="title">CDI_TYCOON</h1>
            <form onSubmit={handleAuth}>
              <div className="input-group">
                <label htmlFor="login-user">NOME_PLAYER</label>
                <input id="login-user" title="Nome do Jogador" placeholder="Seu apelido" type="text" value={username} onChange={e => setUsername(e.target.value)} required />
              </div>
              <div className="input-group" style={{ marginTop: '1rem' }}>
                <label htmlFor="login-pass">SENHA</label>
                <input id="login-pass" title="Senha de Acesso" placeholder="Sua senha" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              {error && <div style={{ color: '#FF4D4D', fontSize: '0.7rem', marginTop: '1rem' }}>{error}</div>}
              <button type="submit" className="primary-btn" style={{ marginTop: '2rem' }}>ENTRAR</button>
            </form>
            <button className="text-link" style={{ background: 'none', border: 'none', color: '#fff', marginTop: '1rem', width: '100%', cursor: 'pointer', opacity: 0.6 }} onClick={() => setIsRegistering(!isRegistering)}>
              {isRegistering ? 'VOLTAR' : 'CRIAR PERSONAGEM'}
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className={`container mode-${viewMode} ${equippedItems?.background || ''} ${equippedItems?.background === 'light' ? 'light-mode' : ''}`}>
        <div className="data-stream-bg">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="data-column" style={{
              left: `${i * 5}%`,
              animationDelay: `${Math.random() * 10}s`,
              animationDuration: `${15 + Math.random() * 25}s`
            }}>
              {Array.from({ length: 15 }).map(() => ['R$', 'CDI', 'SELIC', '+0.01%', 'LÍQUIDO'][Math.floor(Math.random() * 5)]).join(' ')}
            </div>
          ))}
        </div>

        {/* DOPAMINE: Confetti Particles */}
        {confetti.map((c: any) => (
          <div
            key={c.id}
            className="confetti-particle"
            style={{ left: `${c.left}%`, animationDelay: c.animationDelay }}
          />
        ))}

        {/* DOPAMINE: Level Up Burst */}
        {showLevelBurst && (
          <div className="level-up-burst">
            NÍVEL {currentLevel}! 🎉
          </div>
        )}

        {coins.map((c: any) => (
          <div
            key={c.id}
            className={`coin-particle ${c.type === 'bag' ? 'bag' : ''}`}
            style={{ left: `${c.x}%`, top: `${c.y}%` }}
          >
            {c.type === 'bag' ? '💰' : '💵'}
          </div>
        ))}        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: viewMode === 'mobile' ? '1rem 1.2rem 0.5rem 1.2rem' : '0 0.5rem 1.5rem 0.5rem' }}>
          <div>
            <div style={{ opacity: 0.4, fontSize: '0.6rem', letterSpacing: '1px' }}>PLAYER: <span className={equippedItems?.nickColor || ''}>{(session?.username || 'USUÁRIO').toUpperCase()}</span></div>

            {/* Time with seconds */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px' }}>
              <div style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 800 }}>
                {(currentDate || new Date()).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).toUpperCase()} | {(currentDate || new Date()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).toUpperCase()}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '6px',
                padding: '4px 8px',
                borderRadius: '6px',
                background: isMarketOpen ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 77, 77, 0.1)',
                border: `1px solid ${isMarketOpen ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 77, 77, 0.2)'}`
              }}>
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: isMarketOpen ? '#00E676' : '#FF4D4D',
                  boxShadow: `0 0 10px ${isMarketOpen ? '#00E676' : '#FF4D4D'}`
                }}></div>
                <span style={{
                  fontSize: '0.55rem',
                  fontWeight: 900,
                  color: isMarketOpen ? '#00E676' : '#FF4D4D',
                  letterSpacing: '1px'
                }}>
                  {isMarketOpen ? 'MERCADO_ABERTO' : 'MERCADO_FECHADO'}
                </span>
              </div>
              {timeUntilMarketOpen && (
                <div style={{
                  fontSize: '0.55rem',
                  color: '#FF4D4D',
                  marginTop: '4px',
                  fontWeight: 900,
                  letterSpacing: '0.5px',
                  opacity: 0.8,
                  paddingLeft: '4px'
                }}>
                  ABRE EM: {timeUntilMarketOpen}
                </div>
              )}
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <div
              className="icon-btn-small"
              style={{ position: 'relative', fontSize: '1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px' }}
              onClick={() => setShowMenu(!showMenu)}
            >
              ☰
              {(missions.some((m: any) => (xp + balance) >= m.target && !m.claimed) || processedAchievements.some(a => a.unlocked && !a.notified)) && (
                <div className="notification-dot" style={{ top: '8px', right: '8px' }}></div>
              )}
            </div>

            {showMenu && (
              <>
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} onClick={() => setShowMenu(false)} />
                <div className="hamburger-menu">
                  <div className="menu-item" onClick={() => { setShowPixDeposit(true); setShowMenu(false); }}>🏦 NOVO APORTE</div>
                  <div className="menu-item" onClick={() => { setShowCurrencyModal(true); setShowMenu(false); }}>🌎 CÂMBIO INTERNACIONAL</div>
                  <div className="menu-item" onClick={() => { setShowSalaryProjectionModal(true); setShowMenu(false); }}>📊 PROJEÇÃO DE RENDIMENTOS</div>
                  <div className="menu-item" onClick={() => { setShowDebtsModal(true); setShowMenu(false); }}>💳 GESTÃO DE PASSIVOS</div>

                  <div className="menu-item" onClick={() => { setShowMissions(true); setShowMenu(false); }} style={{ position: 'relative' }}>
                    🎯 METAS & OBJETIVOS
                    {missions.some((m: any) => (xp + balance) >= m.target && !m.claimed) && (
                      <div className="notification-dot"></div>
                    )}
                  </div>
                  <div className="menu-item" onClick={() => { setShowAchievementsModal(true); setShowMenu(false); }} style={{ position: 'relative' }}>
                    🏆 MARCOS DE CARREIRA ({processedAchievements.filter(a => a.unlocked).length}/{processedAchievements.length})
                    {processedAchievements.some(a => a.unlocked && !a.notified) && (
                      <div className="notification-dot"></div>
                    )}
                  </div>
                  <div className="menu-item" onClick={() => { setShowSkillsModal(true); setShowMenu(false); }}>🧠 SKILLS & UPGRADES</div>

                  <div className="menu-item" onClick={() => { setShowPortfolioChart(true); setShowMenu(false); }}>🥧 ALOCAÇÃO DE ATIVOS</div>
                  <div className="menu-item" onClick={() => { setShowBenchmarksModal(true); setShowMenu(false); }}>📈 BENCHMARK DE MERCADO</div>
                  <div className="menu-item" onClick={() => {
                    setSimInitial(balance + xp + (usdBalance * apiRates.USD) + (jpyBalance * apiRates.JPY));
                    setSimMonthly(1000);
                    setSimRate(cdiAnual * 100);
                    setShowStairwayChart(true);
                    setShowMenu(false);
                  }}>📅 PLANEJAMENTO FUTURO</div>

                  <div className="menu-item" onClick={() => { setViewMode(viewMode === 'mobile' ? 'pc' : 'mobile'); setShowMenu(false); }}>
                    {viewMode === 'mobile' ? '💻 LAYOUT DESKTOP' : '📱 LAYOUT MOBILE'}
                  </div>
                  <div className="menu-item" onClick={() => { setShowHelpModal(true); setShowMenu(false); }}>❓ CENTRAL DE AJUDA</div>
                  <div className="menu-item" onClick={() => { setShowPixConfig(true); setShowMenu(false); }}>⚙️ AJUSTES DO SISTEMA</div>
                  <div className="menu-item danger" onClick={() => { setSession(null); setShowMenu(false); }}>DESCONECTAR</div>
                </div>
              </>
            )}
          </div>
        </header>

        <div className="glass-panel" style={{ position: 'relative' }}>
          {isLoadingData && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '32px', backdropFilter: 'blur(5px)' }}>
              <span style={{ fontSize: '0.6rem', fontWeight: 900, letterSpacing: '2px', color: '#00A3FF' }}>CARREGANDO_DADOS...</span>
            </div>
          )}
          <div className="xp-container" style={{ marginBottom: '1.5rem', background: 'rgba(0,163,255,0.03)', padding: '12px', borderRadius: '16px', border: '1px solid rgba(0,163,255,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', alignItems: 'flex-end' }}>
              <div>
                <span style={{ fontSize: '0.55rem', fontWeight: 900, color: '#00A3FF', letterSpacing: '1px', display: 'block' }}>RANKING_ATUAL</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#fff' }}>NÍVEL {currentLevel}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.5rem', fontWeight: 800, opacity: 0.5, display: 'block' }}>PRÓXIMO NÍVEL</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#00E676' }}>{(Math.floor(xp % 1000)).toLocaleString('pt-BR')} / 1.000 XP</span>
              </div>
            </div>

            <div style={{ fontSize: '0.5rem', fontWeight: 900, color: '#00E676', marginBottom: '8px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
              ⚡ {getInvestorTitle(currentLevel)}
            </div>

            <div className="xp-bar-bg" style={{ height: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
              <div
                className="xp-bar-fill"
                style={{
                  height: '100%',
                  width: `${((xp || 0) % 1000) / 10}%`,
                  background: 'linear-gradient(90deg, #00A3FF, #00E676, #00A3FF)',
                  backgroundSize: '200% 100%',
                  animation: 'xpGradient 3s linear infinite',
                  boxShadow: '0 0 15px rgba(0, 163, 255, 0.4)',
                  transition: 'width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
              />
              <div className="xp-shimmer" style={{
                position: 'absolute',
                top: 0,
                left: '-100%',
                width: '50%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                animation: 'shimmer 2s infinite'
              }} />
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p className="balance-title" style={{ color: '#FFD700', fontSize: '0.65rem', marginBottom: '4px' }}>PATRIMÔNIO_TOTAL (BRUTO)</p>
              <h1 className="balance-value" style={{ fontSize: '2.2rem', color: '#fff', textShadow: '0 0 20px rgba(255,215,0,0.2)' }}>
                <AnimatedNumber value={totalPatrimony} format={(v) => formatBRLWithPrecision(v)} />
              </h1>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p className="balance-title">Capital_Líquido (Disponível)</p>
              <h2 className="balance-value" style={{ fontSize: '1.6rem', opacity: 0.9 }}>
                <AnimatedNumber value={balance} format={(v) => formatBRLWithPrecision(v)} />
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'right' }}>
              {usdBalance > 0 && (
                <div>
                  <p className="balance-title" style={{ color: '#00A3FF', opacity: 0.8 }}>Carteira_Dólar (USD)</p>
                  <h3 style={{ fontSize: '1.6rem', color: '#00A3FF', margin: 0, fontWeight: 800 }}>
                    $ {usdBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h3>
                  <div style={{ fontSize: '0.65rem', color: '#00A3FF', opacity: 0.8, fontWeight: 900 }}>
                    R$ {(usdBalance * apiRates.USD).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              )}
              {jpyBalance > 0 && (
                <div>
                  <p className="balance-title" style={{ color: '#FFD700', opacity: 0.8 }}>Carteira_Iene (JPY)</p>
                  <h3 style={{ fontSize: '1.6rem', color: '#FFD700', margin: 0, fontWeight: 800 }}>
                    ¥ {jpyBalance.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </h3>
                  <div style={{ fontSize: '0.65rem', color: '#FFD700', opacity: 0.8, fontWeight: 900 }}>
                    R$ {(jpyBalance * apiRates.JPY).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: '0.8rem', padding: '0.6rem 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="balance-title" style={{ color: '#00E676', opacity: 0.8 }}>Total_Investido (Em Operação)</p>
            <h3 style={{ fontSize: '1.4rem', color: '#00E676', margin: 0, fontWeight: 800 }}>
              {formatBRLWithPrecision(xp)}
            </h3>
          </div>




          <div className="yield-grid-main">
            <div className="mini-stat"><span className="label">HORA</span><span className="val" style={{ color: '#00E676' }}>R$ {(yields?.hourlyYield || 0).toFixed(2)}</span></div>
            <div className="mini-stat"><span className="label">DIA</span><span className="val" style={{ color: '#00E676' }}>R$ {(yields?.dailyYield || 0).toFixed(2)}</span></div>
            <div className="mini-stat"><span className="label">SEMANA</span><span className="val" style={{ color: '#00E676' }}>R$ {(yields?.weeklyYield || 0).toFixed(2)}</span></div>
            <div className="mini-stat"><span className="label">MÊS</span><span className="val" style={{ color: '#00E676' }}>R$ {(yields?.monthlyYield || 0).toFixed(2)}</span></div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button className="primary-btn" style={{ flex: 1.2 }} onClick={() => setShowCreateModal(true)}>+ INVESTIR CDI</button>
            <button
              className="primary-btn"
              style={{ flex: 1, background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', color: '#000', fontWeight: 900 }}
              onClick={() => setShowFiiModal(true)}
            >
              🏛️ IMÓVEIS
            </button>
          </div>
        </div >

        <div className="glass-panel machine-panel-full">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ fontSize: '0.7rem', color: '#00A3FF', margin: 0 }}>ATIVOS_CONECTADOS [{machines.length}]</h3>
              <button
                className="icon-btn-small"
                style={{ width: '20px', height: '20px', fontSize: '0.5rem' }}
                onClick={() => setShowHistoryModal(true)}
                title="Histórico de Rendimentos"
              >
                🕒
              </button>

            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 215, 0, 0.1)', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255, 215, 0, 0.2)' }}>
              <span style={{ fontSize: '0.5rem', color: '#FFD700', opacity: 0.6, fontWeight: 800 }}>PRÓXIMO_PAGAMENTO</span>
              <span style={{ fontSize: '0.65rem', color: '#FFD700', fontWeight: 900, fontFamily: 'JetBrains Mono', letterSpacing: '1px' }}>{timeToYield}</span>
            </div>
          </div>
          <div className="machine-list">
            {machines.map((m, i) => {
              return (
                <div key={i} className={`machine-card ${isBusinessDay ? 'active-working' : ''} ${m.skin === 'none' ? '' : (m.skin || equippedItems.machineSkin || '')}`}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div className="engine-core" style={{ transform: 'scale(0.8)', margin: '-5px' }}>
                      <div className="fan-frame"><div className="fan-blades"></div></div>
                      <div className="status-leds">
                        <div className={`led green ${isBusinessDay ? 'active' : ''}`}></div>
                        <div className={`led blue ${isBusinessDay ? 'active' : ''}`} style={{ animationDelay: '0.2s' }}></div>
                        <div className={`led amber ${isBusinessDay ? 'active' : ''}`} style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h4 style={{ margin: 0, fontSize: '0.75rem', color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>{(m.nome || 'ATIVO SEM NOME').toUpperCase()}</h4>
                          <span
                            style={{ cursor: 'pointer', fontSize: '0.6rem', opacity: 0.5 }}
                            onClick={() => {
                              setEditingMachine(m);
                              setEditName(m.nome);
                              setEditValue(m.valor.toString());
                              setEditCDI(m.cdi_quota.toString());
                              setEditDate(m.vencimento || '');
                              setEditSkin(m.skin || '');
                              setShowEditModal(true);
                            }}
                            title="Editar Ativo"
                          >
                            ✏️
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          <span style={{ fontSize: '0.6rem', color: '#00A3FF', fontWeight: 900, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>{m.cdi_quota}% CDI</span>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {getTaxMultipliers(m.created_at, false, currentDate).iofApplied && (
                              <span style={{ fontSize: '0.45rem', padding: '1px 3px', background: 'rgba(255, 77, 77, 0.2)', color: '#FF4D4D', borderRadius: '3px', fontWeight: 900 }}>
                                IOF ({getTaxMultipliers(m.created_at, false, currentDate).daysUntilIofZero}d)
                              </span>
                            )}
                            <span style={{ fontSize: '0.45rem', padding: '1px 3px', background: 'rgba(0, 163, 255, 0.2)', color: '#00A3FF', borderRadius: '3px', fontWeight: 900 }}>IR: {getTaxMultipliers(m.created_at, false, currentDate).irRateLabel}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        {m.liquidity_type === 'locked_30' && <span style={{ fontSize: '0.5rem', background: 'rgba(255, 215, 0, 0.2)', color: '#FFD700', padding: '2px 6px', borderRadius: '4px', fontWeight: 900 }}>🚀 TURBO D+30</span>}
                        {m.liquidity_type === 'locked_365' && <span style={{ fontSize: '0.5rem', background: 'rgba(255, 77, 77, 0.2)', color: '#FF4D4D', padding: '2px 6px', borderRadius: '4px', fontWeight: 900 }}>🔒 FGC MAX</span>}
                        {(!m.liquidity_type || m.liquidity_type === 'daily') && <span style={{ fontSize: '0.5rem', background: 'rgba(0, 230, 118, 0.2)', color: '#00E676', padding: '2px 6px', borderRadius: '4px', fontWeight: 900 }}>✅ D+0</span>}
                      </div>
                      <p style={{ margin: '2px 0', fontSize: '1rem', color: isBusinessDay ? '#00E676' : '#FF4D4D', fontWeight: 900, fontFamily: 'JetBrains Mono', textShadow: '0 1px 8px rgba(0,0,0,0.3)' }}>
                        {(m.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      </div>
                      {m.vencimento && (
                        <div style={{ fontSize: '0.5rem', color: new Date(m.vencimento) <= currentDate ? '#00E676' : '#FFD700', fontWeight: 900 }}>
                          {(m.vencimento && new Date(m.vencimento) <= currentDate) ? 'DISPONÍVEL' : (m.vencimento ? `LIBERA: ${new Date(m.vencimento).toLocaleDateString('pt-BR')}` : 'SEM PRAZO')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                    <button className="action-btn aporte" style={{ flex: 2, padding: '10px 8px', fontSize: '0.7rem' }} onClick={() => { setSelectedMachine(m); setShowAporteModal(true); setAporteValue(''); }}>APORTE</button>
                    {(m.vencimento && new Date(m.vencimento) <= currentDate) ? (
                      <button className="action-btn vender-solid" style={{ flex: 1, padding: '10px 8px', fontSize: '0.65rem' }} onClick={() => setShowConfirmResgate(m)}>VENDER</button>
                    ) : (
                      <button className="action-btn" disabled style={{ flex: 1, padding: '10px 8px', fontSize: '0.55rem', opacity: 0.5, cursor: 'not-allowed', background: '#333' }}>BLOQUEADO</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {notification && <div className="notification-toast"><div className="toast-content">{notification}</div></div>}

        {
          showConfirmResgate && (
            <div className="modal-overlay">
              <div className="glass-panel modal-content">
                <h3>VENDER ATIVO?</h3>
                <p style={{ fontSize: '0.7rem', opacity: 0.7 }}>{(showConfirmResgate?.nome || 'ATIVO').toUpperCase()} - {(showConfirmResgate?.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                  <button className="action-btn" style={{ flex: 1 }} onClick={() => setShowConfirmResgate(null)}>CANCELAR</button>
                  <button className="primary-btn" style={{ flex: 1, background: '#FF4D4D' }} onClick={handleResgate}>VENDER</button>
                </div>
              </div>
            </div>
          )
        }

        {
          showAporteModal && (
            <div className="modal-overlay" onClick={() => setShowAporteModal(false)}>
              <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', padding: '0', overflow: 'hidden', borderRadius: '24px', border: 'none' }}>
                <div style={{ background: 'linear-gradient(135deg, #00A3FF 0%, #0066FF 100%)', padding: '1.5rem', textAlign: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '0.9rem', letterSpacing: '2px', fontWeight: 900, color: '#fff' }}>APORTE_ESTRATÉGICO</h3>
                  <p style={{ margin: '5px 0 0 0', fontSize: '0.65rem', opacity: 0.8, color: '#fff', fontWeight: 700 }}>{selectedMachine?.nome.toUpperCase()}</p>
                </div>

                <div style={{ padding: '1.5rem' }}>
                  <div className="input-group">
                    <label htmlFor="aporte-input" style={{ fontSize: '0.55rem', color: '#00A3FF', fontWeight: 900, marginBottom: '8px', display: 'block', letterSpacing: '1px' }}>VALOR DO INVESTIMENTO ADICIONAL (R$)</label>
                    <input
                      id="aporte-input"
                      title="Valor do Aporte"
                      autoFocus
                      type="number"
                      placeholder="0,00"
                      value={aporteValue}
                      onChange={e => setAporteValue(e.target.value)}
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,163,255,0.2)', color: '#fff', padding: '15px', borderRadius: '14px', width: '100%', fontSize: '1.3rem', fontWeight: 800, outline: 'none' }}
                    />
                  </div>

                  <div style={{ marginTop: '1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                      {/* ATUAL */}
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontSize: '0.45rem', color: '#aaa', fontWeight: 900, marginBottom: '8px', letterSpacing: '1px' }}>RENDIMENTO ATUAL</div>
                        {(() => {
                          const current = calculateProjection(selectedMachine?.valor || 0, '0', selectedMachine?.cdi_quota || 0, cdiAnual, selectedMachine?.created_at, currentDate);
                          return (
                            <>
                              <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#fff' }}>R$ {current.day.toFixed(2)}<span style={{ fontSize: '0.6rem', opacity: 0.5 }}>/dia</span></div>
                              <div style={{ fontSize: '0.65rem', opacity: 0.4, fontWeight: 700, marginTop: '2px' }}>R$ {current.month.toFixed(2)}/mês</div>
                            </>
                          );
                        })()}
                      </div>

                      {/* ESTIMADO (DEPOIS) */}
                      <div style={{ background: 'rgba(0, 230, 118, 0.05)', padding: '12px', borderRadius: '16px', border: '1px solid rgba(0, 230, 118, 0.2)' }}>
                        <div style={{ fontSize: '0.45rem', color: '#00E676', fontWeight: 900, marginBottom: '8px', letterSpacing: '1px' }}>PROJEÇÃO PÓS-APORTE</div>
                        {(() => {
                          const next = calculateProjection(selectedMachine?.valor || 0, aporteValue, selectedMachine?.cdi_quota || 0, cdiAnual, selectedMachine?.created_at, currentDate);
                          return (
                            <>
                              <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#00E676' }}>R$ {next.day.toFixed(2)}<span style={{ fontSize: '0.6rem', opacity: 0.7 }}>/dia</span></div>
                              <div style={{ fontSize: '0.65rem', color: '#00E676', opacity: 0.6, fontWeight: 700, marginTop: '2px' }}>R$ {next.month.toFixed(2)}/mês</div>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    {aporteValue && !isNaN(parseFloat(aporteValue)) && parseFloat(aporteValue) > 0 && (
                      <div style={{ marginTop: '18px', textAlign: 'center', animation: 'fadeIn 0.3s ease-out' }}>
                        <span style={{ fontSize: '0.55rem', color: '#00E676', fontWeight: 900, background: 'rgba(0,230,118,0.1)', padding: '6px 14px', borderRadius: '20px', letterSpacing: '0.5px' }}>
                          🚀 +{((calculateProjection(selectedMachine?.valor || 0, aporteValue, selectedMachine?.cdi_quota || 0, cdiAnual, selectedMachine?.created_at, currentDate).day / (calculateProjection(selectedMachine?.valor || 0, '0', selectedMachine?.cdi_quota || 0, cdiAnual, selectedMachine?.created_at, currentDate).day || 0.00000001) - 1) * 100).toFixed(1)}% DE AUMENTO NO LUCRO LÍQUIDO
                        </span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '2rem' }}>
                    <button className="action-btn" style={{ flex: 1, padding: '15px', borderRadius: '14px', fontSize: '0.7rem', fontWeight: 800 }} onClick={() => setShowAporteModal(false)}>VOLTAR</button>
                    <button
                      className="primary-btn"
                      style={{
                        flex: 1.5,
                        background: '#00E676',
                        color: '#000',
                        padding: '15px',
                        borderRadius: '14px',
                        fontSize: '0.7rem',
                        fontWeight: 900,
                        boxShadow: '0 8px 20px rgba(0, 230, 118, 0.2)'
                      }}
                      onClick={handleAporte}
                    >
                      CONFIRMAR APORTE
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        }


        {
          showStairwayChart && (
            <div className="modal-overlay" onClick={() => setShowStairwayChart(false)}>
              <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
                <h3 style={{ marginBottom: '10px', color: '#00E676', textAlign: 'center' }}>SIMULADOR DE JUROS COMPOSTOS</h3>
                <p style={{ textAlign: 'center', fontSize: '0.65rem', opacity: 0.6, marginBottom: '20px' }}>PROJEÇÃO DE 12 MESES (APORTE DIA 5)</p>

                {/* INPUTS DE EDIÇÃO */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ fontSize: '0.5rem', color: '#aaa', fontWeight: 800, marginBottom: '4px', display: 'block' }}>INICIAL (R$)</label>
                    <input type="number" value={simInitial} onChange={e => setSimInitial(parseFloat(e.target.value))}
                      style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.9rem', fontWeight: 700 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.5rem', color: '#aaa', fontWeight: 800, marginBottom: '4px', display: 'block' }}>MENSAL (R$)</label>
                    <input type="number" value={simMonthly} onChange={e => setSimMonthly(parseFloat(e.target.value))}
                      style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.9rem', fontWeight: 700 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.5rem', color: '#aaa', fontWeight: 800, marginBottom: '4px', display: 'block' }}>TAXA ANUAL (%)</label>
                    <input type="number" value={simRate} onChange={e => setSimRate(parseFloat(e.target.value))}
                      style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.9rem', fontWeight: 700 }} />
                  </div>
                </div>

                <div style={{ width: '100%', height: '250px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={(() => {
                      // CALCULATION LOGIC ON THE FLY
                      const data = [];
                      let currentBalance = simInitial || 0;
                      const monthlyRate = Math.pow(1 + ((simRate || 0) / 100), 1 / 12) - 1;
                      let totalPrincipal = simInitial || 0;

                      // Start Today
                      data.push({ month: 'HOJE', balance: currentBalance, principal: totalPrincipal, interest: 0 });

                      for (let i = 1; i <= 12; i++) {
                        // 1. Add Monthly Contribution (Simulating Day 5 deposit)
                        currentBalance += (simMonthly || 0);
                        totalPrincipal += (simMonthly || 0);

                        // 2. Apply Interest
                        const interest = currentBalance * monthlyRate;
                        currentBalance += interest;

                        data.push({
                          month: `Mês ${i}`,
                          balance: currentBalance,
                          principal: totalPrincipal,
                          interest: currentBalance - totalPrincipal
                        });
                      }
                      return data;
                    })()}>
                      <defs>
                        <linearGradient id="colorSimBalance" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00E676" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#00E676" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                        itemStyle={{ fontSize: '0.8rem' }}
                        formatter={(value: any) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      />
                      <Area type="monotone" dataKey="balance" stroke="#00E676" fill="url(#colorSimBalance)" name="Patrimônio Projetado" strokeWidth={3} />
                      <Area type="monotone" dataKey="principal" stroke="#FFFFFF" fill="none" strokeDasharray="5 5" name="Total Aportado" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', textAlign: 'center' }}>
                  {(() => {
                    const monthlyRate = Math.pow(1 + ((simRate || 0) / 100), 1 / 12) - 1;
                    let finalBalance = simInitial || 0;
                    let totalDep = simInitial || 0;
                    for (let i = 0; i < 12; i++) {
                      finalBalance += (simMonthly || 0);
                      totalDep += (simMonthly || 0);
                      finalBalance += finalBalance * monthlyRate;
                    }
                    const profit = finalBalance - totalDep;

                    return (
                      <>
                        <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>EM 12 MESES VOCÊ TERÁ</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#00E676', margin: '5px 0' }}>
                          {finalBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#FFD700', fontWeight: 900 }}>
                          LUCRO DE JUROS: + {profit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                      </>
                    )
                  })()}
                </div>

                <button className="action-btn" style={{ width: '100%', marginTop: '20px' }} onClick={() => setShowStairwayChart(false)}>FECHAR SIMULADOR</button>
              </div>
            </div>
          )
        }

        {
          showCreateModal && (
            <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
              <div
                className="glass-panel modal-content"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '420px', width: '95%', padding: '0', overflow: 'hidden', border: 'none', borderRadius: '24px' }}
              >
                <div style={{ background: '#1A1A1A', padding: '1.5rem', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', letterSpacing: '1px', color: '#fff' }}>NOVA CAIXINHA</h3>
                  <p style={{ margin: '5px 0 0 0', fontSize: '0.65rem', opacity: 0.6 }}>Escolha uma estratégia para seu dinheiro</p>
                </div>

                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>

                  {/* OPÇÃO D+0 */}
                  <div
                    onClick={() => applyPreset('daily')}
                    style={{
                      background: selectedLiquidity === 'daily' ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255,255,255,0.03)',
                      border: selectedLiquidity === 'daily' ? '1px solid #00E676' : '1px solid rgba(255,255,255,0.05)',
                      padding: '12px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.2s'
                    }}>
                    <div style={{ fontSize: '1.5rem' }}>✅</div>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: '0.8rem', color: selectedLiquidity === 'daily' ? '#00E676' : '#fff' }}>CAIXINHA RESERVA (D+0)</div>
                      <div style={{ fontSize: '0.6rem', opacity: 0.6 }}>Liquidez Imediata • 100% do CDI</div>
                    </div>
                  </div>

                  {/* OPÇÃO D+30 */}
                  <div
                    onClick={() => applyPreset('locked_30')}
                    style={{
                      background: selectedLiquidity === 'locked_30' ? 'rgba(255, 215, 0, 0.15)' : 'rgba(255,255,255,0.03)',
                      border: selectedLiquidity === 'locked_30' ? '1px solid #FFD700' : '1px solid rgba(255,255,255,0.05)',
                      padding: '12px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.2s'
                    }}>
                    <div style={{ fontSize: '1.5rem' }}>🚀</div>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: '0.8rem', color: selectedLiquidity === 'locked_30' ? '#FFD700' : '#fff' }}>CAIXINHA TURBO (D+30)</div>
                      <div style={{ fontSize: '0.6rem', opacity: 0.6 }}>Resgate em 30 dias • <span style={{ color: '#FFD700', fontWeight: 900 }}>105% do CDI</span></div>
                    </div>
                  </div>

                  {/* OPÇÃO D+365 */}
                  <div
                    onClick={() => applyPreset('locked_365')}
                    style={{
                      background: selectedLiquidity === 'locked_365' ? 'rgba(255, 77, 77, 0.15)' : 'rgba(255,255,255,0.03)',
                      border: selectedLiquidity === 'locked_365' ? '1px solid #FF4D4D' : '1px solid rgba(255,255,255,0.05)',
                      padding: '12px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.2s'
                    }}>
                    <div style={{ fontSize: '1.5rem' }}>🔒</div>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: '0.8rem', color: selectedLiquidity === 'locked_365' ? '#FF4D4D' : '#fff' }}>LCI FGC MAX (D+365)</div>
                      <div style={{ fontSize: '0.6rem', opacity: 0.6 }}>Travado por 1 ano • <span style={{ color: '#FF4D4D', fontWeight: 900 }}>120% do CDI</span> • Isento IR</div>
                    </div>
                  </div>

                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '8px 0' }}></div>

                  {/* MANUAL INPUTS */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                    <div>
                      <label style={{ fontSize: '0.5rem', color: '#aaa', fontWeight: 800, marginBottom: '4px', display: 'block' }}>CDI (%)</label>
                      <input type="number" value={newMachineCDI} onChange={e => setNewMachineCDI(e.target.value)}
                        style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.8rem', fontWeight: 700 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.5rem', color: '#aaa', fontWeight: 800, marginBottom: '4px', display: 'block' }}>VENCIMENTO</label>
                      <input type="date" value={newMachineDate} onChange={e => setNewMachineDate(e.target.value)}
                        style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.8rem', fontWeight: 700 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.5rem', color: '#aaa', fontWeight: 800, marginBottom: '4px', display: 'block' }}>LIMITE (R$)</label>
                      <input type="number" placeholder="∞" value={newMachineLimit} onChange={e => setNewMachineLimit(e.target.value)}
                        style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.8rem', fontWeight: 700 }} />
                    </div>
                  </div>

                  <div className="input-group">
                    <label style={{ fontSize: '0.55rem', color: '#00A3FF', fontWeight: 800, marginBottom: '6px', display: 'block' }}>NOME DA CAIXINHA</label>
                    <input autoFocus title="Nome da Caixinha" placeholder="Ex: Minha Aposentadoria" value={newMachineName} onChange={e => setNewMachineName(e.target.value)}
                      style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.9rem' }}
                    />
                  </div>

                  <div className="input-group">
                    <label style={{ fontSize: '0.55rem', color: '#00A3FF', fontWeight: 800, marginBottom: '6px', display: 'block' }}>VALOR INICIAL (R$)</label>
                    <input type="number" title="Valor Inicial" placeholder="0,00" value={newMachineValue} onChange={e => setNewMachineValue(e.target.value)}
                      style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '1.1rem', fontWeight: 800 }}
                    />
                    <div style={{ textAlign: 'right', fontSize: '0.55rem', opacity: 0.5, marginTop: '4px' }}>Disponível: {balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                  </div>

                  <button
                    className="primary-btn"
                    onClick={createMachine}
                    disabled={!newMachineValue || parseFloat(newMachineValue) <= 0 || !newMachineName}
                    style={{ marginTop: '10px', padding: '14px', fontSize: '0.8rem', fontWeight: 900 }}
                  >
                    CONFIRMAR CRIAÇÃO
                  </button>

                  <button className="text-link" style={{ width: '100%', padding: '10px', background: 'none', border: 'none', color: '#fff', opacity: 0.4, cursor: 'pointer' }} onClick={() => setShowCreateModal(false)}>
                    CANCELAR
                  </button>

                </div>
              </div>
            </div>
          )
        }

        {
          showEditModal && (
            <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
              <div className="glass-panel modal-content" onClick={e => e.stopPropagation()}>
                <h3>EDITAR ATIVO</h3>
                <input id="edit-mach-name" title="Nome do Ativo" placeholder="Nome do Ativo" value={editName} onChange={e => setEditName(e.target.value)} style={{ marginBottom: '10px' }} />
                <input id="edit-mach-val" title="Valor do Ativo" placeholder="Valor R$" type="number" value={editValue} onChange={e => setEditValue(e.target.value)} style={{ marginBottom: '10px' }} />
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="edit-mach-cdi" style={{ fontSize: '0.55rem', color: '#00A3FF', fontWeight: 800, display: 'block', marginBottom: '4px' }}>% DO CDI</label>
                    <input id="edit-mach-cdi" title="Porcentagem do CDI" type="number" value={editCDI} onChange={e => setEditCDI(e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="edit-mach-date" style={{ fontSize: '0.55rem', color: '#00A3FF', fontWeight: 800, display: 'block', marginBottom: '4px' }}>VENCIMENTO</label>
                    <input id="edit-mach-date" title="Data de Vencimento" type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
                  </div>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ fontSize: '0.55rem', color: '#00A3FF', fontWeight: 800, display: 'block', marginBottom: '4px' }}>SKIN VISUAL</label>
                  <select
                    title="Seletor de Skin"
                    value={editSkin || 'none'}
                    onChange={e => setEditSkin(e.target.value)}
                    style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0, 163, 255, 0.3)', color: '#fff', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 800 }}
                  >
                    <option value="none">VISUAL ORIGINAL (PADRÃO)</option>
                    {[
                      { key: 'carbon', name: 'CARBON FIBER', cssClass: 'skin-carbon' },
                      { key: 'vaporwave', name: 'VAPORWAVE', cssClass: 'skin-vaporwave' },
                      { key: 'glitch', name: 'GLITCH EFFECT', cssClass: 'skin-glitch' },
                      { key: 'royal', name: 'ROYAL MARBLE', cssClass: 'skin-royal' },
                      { key: 'ghost', name: 'GHOST FORM', cssClass: 'skin-ghost' },
                      { key: 'cyber', name: 'CYBERPUNK NEON', cssClass: 'skin-cyber' },
                      { key: 'forest', name: 'DEEP FOREST', cssClass: 'skin-forest' },
                      { key: 'magma', name: 'VOLCANIC MAGMA', cssClass: 'skin-magma' },
                      { key: 'ice', name: 'FROZEN ICE', cssClass: 'skin-ice' },
                      { key: 'neon_pink', name: 'NEON PINK', cssClass: 'skin-neon-pink' },
                      { key: 'gold_black', name: 'GOLD & BLACK', cssClass: 'skin-gold-black' },
                      { key: 'sunset', name: 'SUMMER SUNSET', cssClass: 'skin-sunset' },
                      { key: 'space', name: 'DEEP SPACE', cssClass: 'skin-space' },
                      { key: 'emerald', name: 'EMERALD CRYSTAL', cssClass: 'skin-emerald' },
                      { key: 'hacker', name: 'TERMINAL HACKER', cssClass: 'skin-hacker' },
                      { key: 'plasma', name: 'PLASMA ENERGY', cssClass: 'skin-plasma' },
                      { key: 'pixel_art', name: 'RETRO PIXEL', cssClass: 'skin-pixel_art' },
                      { key: 'aurora', name: 'AURORA BOREALIS', cssClass: 'skin-aurora' },
                      { key: 'obsidian', name: 'DARK OBSIDIAN', cssClass: 'skin-obsidian' },
                      { key: 'quantum', name: 'QUANTUM FIELD', cssClass: 'skin-quantum' }
                    ].map(skinKind => {
                      // Calcular disponibilidade
                      const owned = skinCounts[skinKind.key] || 0;
                      const equippedOnOthers = machines.filter(m => m.id !== editingMachine?.id && m.skin === skinKind.cssClass).length;
                      const available = owned - equippedOnOthers;

                      if (available <= 0 && editingMachine?.skin !== skinKind.cssClass) return null;

                      return (
                        <option key={skinKind.key} value={skinKind.cssClass}>
                          {skinKind.name} — {available > 0 ? `${available} DISP.` : 'EM USO NESSA MÁQUINA'}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                  <button className="action-btn" style={{ flex: 1 }} onClick={() => setShowEditModal(false)}>CANCELAR</button>
                  <button className="primary-btn" style={{ flex: 1 }} onClick={updateMachine}>SALVAR ALTERAÇÕES</button>
                </div>
              </div>
            </div>
          )
        }

        {
          showPixConfig && (
            <div className="modal-overlay" onClick={() => setShowPixConfig(false)}>
              <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <h3 style={{ marginBottom: '1.5rem', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>⚙️ CONFIGURAÇÕES</h3>

                {/* 1. APARÊNCIA */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '0.6rem', color: '#00A3FF', fontWeight: 900, marginBottom: '10px', display: 'block', letterSpacing: '1px' }}>APARÊNCIA</label>
                  <div
                    onClick={async () => {
                      const newMode = equippedItems?.background === 'light' ? 'dark' : 'light';
                      setEquippedItems({ ...equippedItems, background: newMode });
                      // Salvar preferência (opcional, ou podemos salvar no user_stats)
                      await supabase.from('user_stats').update({ equipped_background: newMode }).eq('user_id', session.id);
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      padding: '12px',
                      borderRadius: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                    <span style={{ fontWeight: 700 }}>Modo Claro</span>
                    <div style={{
                      width: '40px',
                      height: '20px',
                      background: equippedItems?.background === 'light' ? '#00E676' : '#333',
                      borderRadius: '20px',
                      position: 'relative',
                      transition: 'all 0.3s'
                    }}>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        background: '#fff',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '2px',
                        left: equippedItems?.background === 'light' ? '22px' : '2px',
                        transition: 'all 0.3s'
                      }} />
                    </div>
                  </div>
                </div>

                {/* 2. FINANCEIRO (PIX) */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '0.6rem', color: '#00A3FF', fontWeight: 900, marginBottom: '10px', display: 'block', letterSpacing: '1px' }}>FINANCEIRO</label>
                  <input
                    placeholder="Sua Chave PIX (CPF, Email...)"
                    value={pixKey}
                    onChange={e => setPixKey(e.target.value)}
                    style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                  />
                  <button className="primary-btn" style={{ marginTop: '8px', padding: '8px', fontSize: '0.7rem' }} onClick={savePixKey}>SALVAR CHAVE</button>
                </div>

                {/* 3. DADOS */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.6rem', color: '#FF4D4D', fontWeight: 900, marginBottom: '10px', display: 'block', letterSpacing: '1px' }}>DADOS & PERIGO</label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button
                      className="action-btn"
                      onClick={handleExportBackup}
                      style={{ fontSize: '0.7rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', padding: '15px' }}
                    >
                      <span>💾</span>
                      BACKUP
                    </button>

                    <button
                      className="action-btn"
                      onClick={() => {
                        if (confirm('TEM CERTEZA? ISSO IRÁ ZERAR SEU SALDO PARA R$ 0,00!')) {
                          handleWithdraw();
                        }
                      }}
                      style={{ fontSize: '0.7rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', padding: '15px', borderColor: '#FF4D4D', color: '#FF4D4D' }}
                    >
                      <span>🗑️</span>
                      ZERAR SALDO
                    </button>
                  </div>
                </div>

                <button className="text-link" style={{ width: '100%', padding: '12px', marginTop: '10px', opacity: 0.6 }} onClick={() => setShowPixConfig(false)}>FECHAR</button>
              </div>
            </div>
          )
        }


        {
          showPixDeposit && (
            <div className="modal-overlay" onClick={() => { setShowPixDeposit(false); setDepositStep(1); }}>
              <div className="glass-panel modal-content" onClick={e => e.stopPropagation()}>
                <div className="pix-steps">
                  <div className={`pix-step ${depositStep === 1 ? 'active' : ''}`}>1. VALOR</div>
                  <div className={`pix-step ${depositStep === 2 ? 'active' : ''}`}>2. PAGAMENTO</div>
                </div>

                {depositStep === 1 ? (
                  <>
                    <h3>DEPOSITAR VIA PIX</h3>
                    <p style={{ fontSize: '0.6rem', opacity: 0.6, marginBottom: '0.2rem' }}>Sua chave atual: <span style={{ color: '#00A3FF' }}>{pixKey || 'NÃO CONFIGURADA'}</span></p>

                    <div style={{ background: 'rgba(0,163,255,0.05)', padding: '10px', borderRadius: '12px', marginBottom: '1rem', border: '1px solid rgba(0,163,255,0.1)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.55rem', fontWeight: 900, marginBottom: '4px' }}>
                        <span style={{ color: '#00A3FF' }}>PROGRESSO_SKIN_LENDÁRIA</span>
                        <span style={{ color: '#00E676' }}>FALTAM R$ {(1000 - cumulativeDeposits).toLocaleString('pt-BR')}</span>
                      </div>
                      <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(cumulativeDeposits / 1000) * 100}%`, background: 'linear-gradient(90deg, #00A3FF, #00E676)', boxShadow: '0 0 10px rgba(0,163,255,0.5)' }}></div>
                      </div>
                    </div>

                    <input placeholder="Valor do Depósito R$" type="number" value={depositValue} onChange={e => setDepositValue(e.target.value)} />
                    <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                      <button className="action-btn" style={{ flex: 1 }} onClick={() => setShowPixDeposit(false)}>CANCELAR</button>
                      <button className="primary-btn" style={{ flex: 1 }} onClick={handlePixDeposit}>GERAR PIX</button>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <h3 style={{ color: '#00E676' }}>PAGAMENTO PENDENTE</h3>
                    <p style={{ fontSize: '0.6rem', opacity: 0.7 }}>Escaneie o QR Code ou use o Copia e Cola</p>

                    <div className="qr-container">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(pixPayload)}`}
                        alt="PIX QR Code"
                        style={{ width: '150px', height: '150px' }}
                      />
                    </div>

                    <div className="copy-cola-box" onClick={() => copyToClipboard(pixPayload)}>
                      {pixPayload.substring(0, 30)}... [CLIQUE PARA COPIAR]
                    </div>

                    <p style={{ fontSize: '0.55rem', color: '#FFD700', marginBottom: '1.5rem' }}>
                      Valor: R$ {parseFloat(depositValue).toFixed(2)}
                    </p>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button className="action-btn" style={{ flex: 1 }} onClick={() => setDepositStep(1)}>VOLTAR</button>
                      <button className="primary-btn" style={{ flex: 1, background: '#00E676', color: '#000' }} onClick={confirmPixPayment}>CONFIRMAR DEPÓSITO</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        }

        {
          showHistoryModal && (
            <div className="modal-overlay" style={{ zIndex: 3000 }} onClick={() => setShowHistoryModal(false)}>
              <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxHeight: '80vh', overflowY: 'auto', position: 'relative' }}>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  style={{
                    position: 'absolute',
                    right: '15px',
                    top: '15px',
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    fontSize: '1rem',
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
                <h3 style={{ color: '#00A3FF', marginBottom: '1.2rem' }}>📊 HISTÓRICO_TERMINAL</h3>

                {/* Sumário do Dia Atual */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  marginBottom: '1.5rem'
                }}>
                  <div style={{
                    background: 'rgba(0, 230, 118, 0.1)',
                    padding: '1.2rem',
                    borderRadius: '12px',
                    border: '1px solid rgba(0, 230, 118, 0.2)',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '0.45rem', color: '#00E676', fontWeight: 900, letterSpacing: '2.5px', marginBottom: '4px' }}>LUCRO HOJE</div>
                    <div style={{ fontSize: '1rem', fontWeight: 900, color: '#fff', fontFamily: 'JetBrains Mono' }}>
                      {formatBRLWithPrecision(historyStats.totalToday)}
                    </div>
                  </div>
                  <div style={{
                    background: 'rgba(0, 163, 255, 0.1)',
                    padding: '1.2rem',
                    borderRadius: '12px',
                    border: '1px solid rgba(0, 163, 255, 0.2)',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '0.45rem', color: '#00A3FF', fontWeight: 900, letterSpacing: '2.5px', marginBottom: '4px' }}>ÚLTIMAS 24H</div>
                    <div style={{ fontSize: '1rem', fontWeight: 900, color: '#fff', fontFamily: 'JetBrains Mono' }}>
                      {formatBRLWithPrecision(historyStats.total24h)}
                    </div>
                  </div>
                </div>

                {groupedHistory.length === 0 ? (
                  <p style={{ opacity: 0.5, fontSize: '0.7rem', textAlign: 'center' }}>Nenhum registro de ciclo ainda...</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ fontSize: '0.6rem', opacity: 0.4, fontWeight: 900, marginBottom: '5px' }}>FECHAMENTO DOS ÚLTIMOS 3 DIAS:</div>
                    {groupedHistory.map((day, idx) => (
                      <div key={idx} style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
                          <span style={{ fontSize: '0.6rem', opacity: 0.7, fontWeight: 800 }}>{day.date}</span>
                          <span style={{ fontSize: '0.7rem', color: '#00E676', fontWeight: 900 }}>+{formatBRLWithPrecision(day.total)}</span>
                        </div>
                        {day.machines.map((m: any, mi: number) => (
                          <div key={mi} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.55rem', opacity: 0.8 }}>
                            <span>{m.nome}</span>
                            <span style={{ fontFamily: 'monospace' }}>R$ {m.yield.toFixed(4)}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        }

        {
          showMissions && (
            <div className="modal-overlay" onClick={() => setShowMissions(false)}>
              <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%' }}>
                <h3 style={{ fontSize: '1.2rem', color: '#00A3FF', marginBottom: '1.2rem', letterSpacing: '2px' }}>📋 MISSÕES_DO_INVESTIDOR</h3>
                <p style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '1.5rem', lineHeight: '1.5' }}>
                  Simulação de vida real: Cumpra as metas patrimoniais para evoluir seu perfil de investidor.
                </p>
                <div style={{ marginBottom: '1.5rem', padding: '16px', background: 'rgba(0, 163, 255, 0.05)', borderRadius: '12px', border: '1px solid rgba(0, 163, 255, 0.1)' }}>
                  <h4 style={{ fontSize: '0.9rem', color: '#00A3FF', marginTop: 0, marginBottom: '12px' }}>+ NOVA_MISSÃO_PERSONALIZADA</h4>
                  <input
                    placeholder="Nome da Missão"
                    style={{ fontSize: '0.85rem', marginBottom: '10px', padding: '10px' }}
                    value={newMission.label}
                    onChange={e => setNewMission({ ...newMission, label: e.target.value })}
                  />
                  <input
                    placeholder="Descrição (Opcional)"
                    style={{ fontSize: '0.85rem', marginBottom: '10px', padding: '10px' }}
                    value={newMission.desc}
                    onChange={e => setNewMission({ ...newMission, desc: e.target.value })}
                  />
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      placeholder="Meta R$"
                      type="number"
                      style={{ fontSize: '0.85rem', padding: '10px' }}
                      value={newMission.target}
                      onChange={e => setNewMission({ ...newMission, target: e.target.value })}
                    />
                    <button
                      className="primary-btn"
                      style={{ padding: '0 25px', fontSize: '0.85rem' }}
                      onClick={handleCreateMission}
                    >
                      CRIAR
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '45vh', overflowY: 'auto', paddingRight: '8px' }}>
                  {missions.map((m: any, idx: number) => {
                    const isDone = (xp + balance) >= m.target;
                    return (
                      <div
                        key={m.id}
                        className={`mission-card ${isDone ? 'completed' : ''}`}
                        style={{
                          padding: '16px',
                          borderRadius: '12px',
                          transition: 'all 0.3s',
                          position: 'relative',
                          marginBottom: '8px',
                          animationDelay: `${idx * 0.1}s`
                        }}
                      >
                        <button
                          onClick={() => handleDeleteMission(m.id)}
                          style={{ position: 'absolute', right: '10px', top: '10px', background: 'transparent', border: 'none', color: '#FF4D4D', fontSize: '1rem', cursor: 'pointer', opacity: 0.6, zIndex: 10 }}
                        >
                          🗑️
                        </button>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, paddingRight: '30px' }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: isDone ? '#00E676' : '#fff', marginBottom: '6px', textShadow: isDone ? '0 0 10px rgba(0,230,118,0.3)' : 'none' }}>
                              {m.label}
                            </div>
                            <div style={{ fontSize: '0.9rem', opacity: 0.7, lineHeight: '1.4' }}>{m.desc}</div>
                          </div>
                          <div style={{ textAlign: 'right', minWidth: '100px' }}>
                            {isDone && !m.claimed ? (
                              <button
                                className="primary-btn"
                                style={{
                                  padding: '10px 15px',
                                  fontSize: '0.8rem',
                                  background: '#00E676',
                                  color: '#000',
                                  boxShadow: '0 0 20px rgba(0, 230, 118, 0.5)',
                                  animation: 'pulse 1.5s infinite',
                                  borderRadius: '8px'
                                }}
                                onClick={() => handleClaimMission(m.id)}
                              >
                                RESGATAR
                              </button>
                            ) : (
                              <span style={{
                                fontSize: '0.75rem',
                                fontWeight: 900,
                                color: isDone ? '#00E676' : '#FFD700',
                                padding: '5px 10px',
                                background: isDone ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 215, 0, 0.1)',
                                borderRadius: '6px',
                                border: isDone ? '1px solid rgba(0,230,118,0.2)' : '1px solid rgba(255,215,0,0.1)'
                              }}>
                                {m.claimed ? 'RESGATADO' : isDone ? 'BATIDA' : 'EM CURSO'}
                              </span>
                            )}
                          </div>
                        </div>
                        {!isDone && (
                          <div className="progress-bar-container" style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', marginTop: '15px', borderRadius: '4px' }}>
                            <div style={{ width: `${Math.min(((totalInvested + balance) / m.target) * 100, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #FFD700, #FFA500)', transition: 'width 0.5s' }} />
                            <div className="progress-glow-tracer" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        }

        {
          showHelpModal && (
            <div className="modal-overlay" style={{ zIndex: 5000 }} onClick={() => setShowHelpModal(false)}>
              <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '95%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#00A3FF', fontWeight: 900 }}>❓ GUIA COMPLETO DO JOGO</h2>
                    <p style={{ margin: 0, fontSize: '0.6rem', opacity: 0.5, letterSpacing: '1px' }}>APRENDA A DOMINAR SUAS FINANÇAS</p>
                  </div>
                  <button onClick={() => setShowHelpModal(false)} className="icon-btn-small">✕</button>
                </div>

                <div className="help-section" style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: '12px' }}>

                  {/* CONCEITOS BÁSICOS */}
                  <div style={{ marginBottom: '2rem' }}>
                    <h4 style={{ color: '#FFD700', fontSize: '0.8rem', marginBottom: '10px', borderLeft: '3px solid #FFD700', paddingLeft: '8px' }}>💎 CONCEITOS BÁSICOS</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>Patrimônio Total (Bruto)</p>
                        <p style={{ fontSize: '0.7rem', opacity: 0.7, lineHeight: '1.4' }}>A soma de tudo que você possui: saldo disponível, investimentos em CDI, Imóveis e moedas estrangeiras convertidas.</p>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>Capital Líquido</p>
                        <p style={{ fontSize: '0.7rem', opacity: 0.7, lineHeight: '1.4' }}>Dinheiro "na mão" para usar em novos investimentos ou conversões.</p>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>Ranking e XP</p>
                        <p style={{ fontSize: '0.7rem', opacity: 0.7, lineHeight: '1.4' }}>Seu nível sobe conforme seu <strong>Total Investido</strong>. R$ 1,00 investido = 1 XP. Suba de nível para ganhar Títulos e Skins exclusivas!</p>
                      </div>
                    </div>
                  </div>

                  {/* BOTÕES PRINCIPAIS */}
                  <div style={{ marginBottom: '2rem' }}>
                    <h4 style={{ color: '#00E676', fontSize: '0.8rem', marginBottom: '10px', borderLeft: '3px solid #00E676', paddingLeft: '8px' }}>🎮 BOTÕES DE AÇÃO</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <p style={{ fontSize: '0.7rem', color: '#00E676', fontWeight: 900 }}>+ INVESTIR CDI</p>
                        <p style={{ fontSize: '0.7rem', opacity: 0.7, lineHeight: '1.4' }}>Cria máquinas de rendimento automático. Escolha entre Liquidez Diária (100% CDI) ou Prazos Longos (até 120% CDI).</p>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.7rem', color: '#FFD700', fontWeight: 900 }}>🏛️ IMÓVEIS (FIIs)</p>
                        <p style={{ fontSize: '0.7rem', opacity: 0.7, lineHeight: '1.4' }}>Compre cotas de fundos imobiliários reais da B3. Eles pagam dividendos mensais baseados no mercado real.</p>
                      </div>
                    </div>
                  </div>

                  {/* MENU HAMBÚRGUER */}
                  <div style={{ marginBottom: '2rem' }}>
                    <h4 style={{ color: '#00A3FF', fontSize: '0.8rem', marginBottom: '10px', borderLeft: '3px solid #00A3FF', paddingLeft: '8px' }}>🍔 MENU HAMBÚRGUER</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <p style={{ fontSize: '0.7rem', opacity: 0.7 }}>Aqui você encontra o "Coração" da gestão avançada:</p>
                      <ul style={{ fontSize: '0.7rem', opacity: 0.8, paddingLeft: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <li><strong>💸 DEPOSITAR:</strong> Adicione saldo via Pix Simulado para começar sua jornada.</li>
                        <li><strong>🌎 CÂMBIO WORLD:</strong> Converta Reais para Dólar (USD) ou Iene (JPY). Ótimo para proteger seu capital contra a inflação.</li>
                        <li><strong>💰 PROJEÇÃO SALARIAL:</strong> Confira quanto você vai receber no próximo dia de pagamento e veja seu patrimônio futuro.</li>
                        <li><strong>💳 DÍVIDAS:</strong> Registre seus gastos. Mantenha as contas limpas para não perder progresso!</li>
                        <li><strong>📋 MISSÕES:</strong> Objetivos de curto prazo. Complete para ganhar bônus instantâneos de saldo.</li>
                        <li><strong>🏆 CONQUISTAS:</strong> Marcos da sua carreira. Desbloqueie todas para se tornar um Mestre das Finanças.</li>
                        <li><strong>🧠 HABILIDADES:</strong> Use seu nível para "comprar" upgrades visuais (Skins, Cores e Auras).</li>
                        <li><strong>📊 ANÁLISES & GRÁFICOS:</strong> Veja a composição da sua carteira e compare sua performance com o mercado real.</li>
                      </ul>
                    </div>
                  </div>

                  {/* DICAS */}
                  <div style={{ background: 'rgba(0,163,255,0.1)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(0,163,255,0.2)' }}>
                    <h4 style={{ fontSize: '0.65rem', marginBottom: '8px', color: '#00A3FF', fontWeight: 900 }}>💡 DICAS DE MESTRE</h4>
                    <ul style={{ fontSize: '0.65rem', opacity: 0.9, paddingLeft: '15px', lineHeight: '1.5' }}>
                      <li>O mercado abre e fecha em horários reais. Fique atento para operar FIIs!</li>
                      <li>Clique em uma Máquina de CDI para fazer novos aportes e aumentar o lucro dela.</li>
                      <li>Skins lendárias como "QUANTUM" são liberadas apenas em níveis altíssimos. Continue investindo!</li>
                    </ul>
                  </div>
                  {/* SUPORTE E DOAÇÃO */}
                  <div style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
                    <h4 style={{ color: '#E91E63', fontSize: '0.8rem', marginBottom: '12px', borderLeft: '3px solid #E91E63', paddingLeft: '8px' }}>💬 CONTATO & APOIO</h4>
                    <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                      <button
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '12px', borderRadius: '12px', cursor: 'not-allowed', fontSize: '0.7rem', fontWeight: 800, textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px', opacity: 0.5 }}
                      >
                        <span>🛠️</span> SUPORTE (EM BREVE)
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText('7a9d849a-a3ee-4c9c-bef5-a42d448b954b');
                          triggerSuccess('PIX COPIADO', 'Chave Pix copiada com sucesso!', '❤️');
                        }}
                        style={{ background: 'rgba(233, 30, 99, 0.1)', border: '1px solid rgba(233, 30, 99, 0.2)', color: '#FF4081', padding: '12px', borderRadius: '12px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 900, textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }}
                      >
                        <span>☕</span> APOIAR DESENVOLVIMENTO (DOAR)
                      </button>
                    </div>
                    <div style={{ marginTop: '1rem', fontSize: '0.55rem', opacity: 0.3, textAlign: 'center', fontWeight: 800 }}>
                      VERSION v0.37.0
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                  <button className="primary-btn" style={{ flex: 1 }} onClick={() => setShowHelpModal(false)}>ENTENDI TUDO!</button>
                </div>
              </div>
            </div>
          )
        }


        {
          showSalaryProjectionModal && (
            <div className="modal-overlay" style={{ zIndex: 4000 }} onClick={() => setShowSalaryProjectionModal(false)}>
              <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                  <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#00A3FF', fontWeight: 900 }}>📊 PROJEÇÃO SALARIAL</h2>
                  <button onClick={() => setShowSalaryProjectionModal(false)} className="icon-btn-small">✕</button>
                </div>

                <div style={{ background: 'rgba(0,163,255,0.05)', padding: '1.5rem', borderRadius: '24px', border: '1px solid rgba(0,163,255,0.1)', marginBottom: '1.5rem' }}>
                  <p className="balance-title" style={{ color: '#00A3FF', marginBottom: '8px' }}>VALOR DO SALÁRIO</p>
                  <h2 style={{ fontSize: '1.8rem', color: '#fff', margin: 0, fontWeight: 900 }}>
                    <AnimatedNumber value={salary} format={(v) => formatBRLWithPrecision(v)} />
                  </h2>
                  <div style={{ fontSize: '0.7rem', color: '#00A3FF', fontWeight: 800, marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {(() => {
                      const today = new Date().getDate();
                      if (today === salaryDay) return '💰 SALÁRIO CAI HOJE!';
                      const remaining = today < salaryDay ? (salaryDay - today) : (new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - today + salaryDay);
                      return <><span>📅</span><span>DIA {salaryDay} ({remaining} dias restantes)</span></>;
                    })()}
                  </div>
                </div>

                <div style={{ padding: '1rem 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
                    <div>
                      <p className="balance-title" style={{ fontSize: '0.55rem', opacity: 0.6 }}>PATRIMÔNIO ATUAL</p>
                      <p style={{ fontWeight: 800, fontSize: '0.9rem' }}>{formatBRLWithPrecision(totalPatrimony)}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p className="balance-title" style={{ fontSize: '0.55rem', opacity: 0.6 }}>+ SALÁRIO</p>
                      <p style={{ fontWeight: 800, fontSize: '0.9rem', color: '#00E676' }}>+ {formatBRLWithPrecision(salary)}</p>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(0, 230, 118, 0.1)', padding: '1.2rem', borderRadius: '18px', border: '1px solid rgba(0, 230, 118, 0.2)' }}>
                    <p className="balance-title" style={{ color: '#00E676', fontSize: '0.6rem', marginBottom: '4px' }}>PATRIMÔNIO ESTIMADO APÓS SALÁRIO</p>
                    <h3 style={{ fontSize: '1.4rem', color: '#00E676', margin: 0, fontWeight: 950 }}>
                      <AnimatedNumber value={totalPatrimony + salary} format={(v) => formatBRLWithPrecision(v)} />
                    </h3>
                  </div>
                </div>

                {totalDebts > 0 && (
                  <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(255, 77, 77, 0.1)', borderRadius: '16px', border: '1px solid rgba(255, 77, 77, 0.2)', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                    <div>
                      <p style={{ fontSize: '0.7rem', color: '#FF4D4D', fontWeight: 900, margin: 0 }}>DÍVIDAS PENDENTES</p>
                      <p style={{ fontSize: '0.6rem', opacity: 0.7, margin: '2px 0 0 0' }}>Você possui {formatBRLWithPrecision(totalDebts)} em dívidas registradas.</p>
                    </div>
                  </div>
                )}

                <button className="primary-btn" style={{ marginTop: '2rem' }} onClick={() => setShowSalaryProjectionModal(false)}>FECHAR</button>
              </div>
            </div>
          )
        }

        {/* IMPULSE MODAL */}

        {
          showImpulseModal && (
            <div className="modal-overlay" onClick={() => setShowImpulseModal(false)}>
              <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px' }}>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🍔🚫</div>
                  <h2 className="title" style={{ fontSize: '1.4rem', marginBottom: '0.5rem', textAlign: 'center' }}>ECONOMIA DE IMPULSO</h2>
                  <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Não comprou aquele lanche ou supérfluo?</p>
                </div>

                <div className="input-group">
                  <label>VALOR ECONOMIZADO (R$)</label>
                  <input
                    type="number"
                    placeholder="Ex: 30.00"
                    value={impulseValue}
                    onChange={e => setImpulseValue(e.target.value)}
                    autoFocus
                  />
                </div>

                {impulseValue && !isNaN(parseFloat(impulseValue)) && (
                  <div className="impulse-projection-box">
                    <div className="impulse-sim-line">
                      <span>HOJE</span>
                      <span className="val-now">R$ {parseFloat(impulseValue).toFixed(2)}</span>
                    </div>
                    <div className="impulse-arrow">⬇ EM 10 ANOS (Juros Compostos) ⬇</div>
                    <div className="impulse-sim-result">
                      R$ {(parseFloat(impulseValue) * (Math.pow(1 + 0.15, 10))).toFixed(2)}
                    </div>
                    <div className="impulse-note">
                      Isso é o que você teria se investisse esse valor hoje.
                    </div>
                  </div>
                )}

                <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                  <button className="primary-btn" onClick={handleImpulseInvest}
                    disabled={!impulseValue || isNaN(parseFloat(impulseValue))}
                    style={{ background: 'linear-gradient(135deg, #00E676 0%, #00C853 100%)', boxShadow: '0 10px 30px rgba(0, 230, 118, 0.3)' }}>
                    INVESTIR AGORA
                  </button>
                  <button className="text-link" style={{ marginTop: '1rem', width: '100%', border: 'none', background: 'none', color: '#fff', opacity: 0.5, cursor: 'pointer' }} onClick={() => setShowImpulseModal(false)}>
                    CANCELAR
                  </button>
                </div>
              </div>
            </div>
          )
        }




        {
          showCurrencyModal && (
            <div className="modal-overlay" style={{ zIndex: 4000 }} onClick={() => setShowCurrencyModal(false)}>
              <div
                className="glass-panel wise-modal-container"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '420px', width: '95%', padding: '0', borderRadius: '24px', overflow: 'hidden', border: 'none' }}
              >
                <div className="wise-header" style={{ background: '#00b9ff', padding: '1.2rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="wise-brand" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff', fontWeight: 900 }}>
                    <div className="wise-logo-circle" style={{ background: '#fff', color: '#00b9ff', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>W</div>
                    <span>World</span>
                  </div>
                  <button onClick={() => setShowCurrencyModal(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 800 }}>✕</button>
                </div>

                <div className="wise-body" style={{ padding: '1.5rem' }}>
                  {(() => {
                    const isToBrl = currencyConfig.direction === 'FOREIGN_TO_BRL';
                    const targetCurrency = currencyConfig.target;
                    const maxFrom = isToBrl
                      ? (targetCurrency === 'USD' ? usdBalance : jpyBalance)
                      : balance;

                    const sendVal = parseFloat(currencyConfig.amount) || 0;
                    const isWise = currencyConfig.type === 'WISE';
                    const spread = isWise ? 0 : 0.02;
                    const marketRate = targetCurrency === 'USD' ? apiRates.USD : apiRates.JPY;

                    const feeRate = isWise ? 0.006 : 0;
                    const iofRate = 0.011;

                    let finalAmount = 0;
                    let fee = 0;
                    let iof = 0;
                    let convertedBase = 0;
                    let effectiveRate = marketRate;

                    if (!isToBrl) {
                      // BRL -> Foreign
                      fee = sendVal * feeRate;
                      iof = sendVal * iofRate;
                      convertedBase = sendVal - fee - iof;
                      effectiveRate = marketRate * (1 + spread);
                      finalAmount = Math.max(0, convertedBase / effectiveRate);
                    } else {
                      // Foreign -> BRL
                      effectiveRate = marketRate * (1 - spread);
                      const grossBrl = sendVal * effectiveRate;
                      fee = grossBrl * feeRate;
                      iof = grossBrl * iofRate;
                      convertedBase = grossBrl;
                      finalAmount = Math.max(0, grossBrl - fee - iof);
                    }

                    return (
                      <>
                        {/* INPUT "DE" */}
                        <div style={{ marginBottom: '8px', position: 'relative' }}>
                          <label style={{ fontSize: '0.65rem', fontWeight: 700, opacity: 0.6, textTransform: 'uppercase', marginBottom: '8px', display: 'block', color: '#fff' }}>Você envia</label>
                          <div className="wise-input-row" style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                            <input
                              className="wise-input-field"
                              title="Valor de Envio"
                              type="number"
                              placeholder="0,00"
                              value={currencyConfig.amount}
                              onChange={(e) => setCurrencyConfig({ ...currencyConfig, amount: e.target.value })}
                              style={{ flex: 1, background: 'transparent', border: 'none', padding: '15px', color: '#fff', fontSize: '1.2rem', fontWeight: 800, outline: 'none' }}
                            />
                            <div className="wise-currency-select"
                              onClick={() => setCurrencyConfig({ ...currencyConfig, amount: maxFrom.toString() })}
                              style={{ padding: '0 15px', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', borderLeft: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
                              <span>{isToBrl ? (targetCurrency === 'USD' ? '🇺🇸' : '🇯🇵') : '🇧🇷'}</span>
                              <span style={{ fontWeight: 800 }}>{isToBrl ? targetCurrency : 'BRL'}</span>
                            </div>
                          </div>
                          <div style={{ fontSize: '0.55rem', opacity: 0.5, marginTop: '4px', textAlign: 'right' }}>
                            Disponível: {isToBrl ? (targetCurrency === 'USD' ? `$ ${usdBalance.toFixed(2)}` : `¥ ${jpyBalance.toFixed(0)}`) : `R$ ${balance.toFixed(2)}`}
                          </div>
                        </div>

                        {/* SWAP BUTTON */}
                        <div style={{ display: 'flex', justifyContent: 'center', margin: '-10px 0', position: 'relative', zIndex: 10 }}>
                          <button
                            onClick={() => {
                              setCurrencyConfig({
                                ...currencyConfig,
                                direction: isToBrl ? 'BRL_TO_FOREIGN' : 'FOREIGN_TO_BRL',
                                amount: finalAmount > 0 ? finalAmount.toFixed(2) : ''
                              });
                            }}
                            style={{
                              background: '#fff', color: '#00b9ff', border: '1px solid #00b9ff',
                              width: '32px', height: '32px', borderRadius: '50%', display: 'flex',
                              alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.2)', fontSize: '1rem'
                            }}
                          >
                            ⇅
                          </button>
                        </div>

                        {/* INPUT "PARA" (RECEBE) */}
                        <div style={{ marginBottom: '1.5rem', marginTop: '8px' }}>
                          <label style={{ fontSize: '0.65rem', fontWeight: 700, opacity: 0.6, textTransform: 'uppercase', marginBottom: '8px', display: 'block', color: '#fff' }}>Você recebe</label>
                          <div className="wise-input-row" style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                            <div style={{ flex: 1, padding: '15px', color: '#00E676', fontSize: '1.2rem', fontWeight: 800 }}>
                              {finalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="wise-currency-select"
                              onClick={() => setCurrencyConfig({ ...currencyConfig, target: targetCurrency === 'USD' ? 'JPY' : 'USD' })}
                              style={{ padding: '0 15px', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', borderLeft: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
                              <span>{!isToBrl ? (targetCurrency === 'USD' ? '🇺🇸' : '🇯🇵') : '🇧🇷'}</span>
                              <span style={{ fontWeight: 800 }}>{!isToBrl ? targetCurrency : 'BRL'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="wise-calc-details" style={{ fontSize: '0.7rem', color: '#fff' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', opacity: 0.7 }}>
                            <span>Tarifa da Wise (0.6%)</span>
                            <span>{fee.toFixed(2)} BRL</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', opacity: 0.7 }}>
                            <span>IOF (1.1%)</span>
                            <span>{iof.toFixed(2)} BRL</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontWeight: 800, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px' }}>
                            <span>Total que será convertido</span>
                            <span>{(isToBrl ? convertedBase : (sendVal - fee - iof)).toFixed(2)} BRL</span>
                          </div>

                          <div style={{ background: 'rgba(0, 185, 255, 0.1)', padding: '10px', borderRadius: '12px', textAlign: 'center', fontSize: '0.65rem', marginBottom: '1.5rem' }}>
                            Câmbio Comercial: 1 {targetCurrency} = R$ {marketRate.toFixed(4)}
                            {spread > 0 && <span style={{ display: 'block', opacity: 0.6, fontSize: '0.55rem' }}>Inclui spread de 2% (Modo Normal)</span>}
                          </div>
                        </div>

                        <button
                          className="wise-continue-btn"
                          onClick={() => handleCurrencyExchange(sendVal, finalAmount, targetCurrency as 'USD' | 'JPY', currencyConfig.direction)}
                          style={{
                            width: '100%', padding: '15px', borderRadius: '12px',
                            background: maxFrom >= sendVal && sendVal > 0 ? '#00b9ff' : '#333',
                            color: '#fff', border: 'none', fontWeight: 900, fontSize: '0.9rem',
                            cursor: maxFrom >= sendVal && sendVal > 0 ? 'pointer' : 'not-allowed',
                            boxShadow: maxFrom >= sendVal && sendVal > 0 ? '0 4px 15px rgba(0,185,255,0.3)' : 'none'
                          }}
                          disabled={maxFrom < sendVal || sendVal <= 0}
                        >
                          {maxFrom >= sendVal ? 'Confirmar Câmbio' : 'Saldo Insuficiente'}
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )
        }

        {
          celebratingMission && (
            <div className="celebration-overlay" onClick={() => setCelebratingMission(null)}>
              <div className="celeb-bg-flash"></div>
              <div className="celeb-card" onClick={e => e.stopPropagation()}>
                <div className="confetti-container">
                  {Array.from({ length: 40 }).map((_, i) => (
                    <div key={i} className="confetti-piece" style={{
                      left: `${Math.random() * 100}%`,
                      background: ['#00A3FF', '#00E676', '#FFD700', '#FF4D4D'][Math.floor(Math.random() * 4)],
                      animationDelay: `${Math.random() * 2}s`,
                      animationDuration: `${2 + Math.random() * 2}s`
                    }}></div>
                  ))}
                </div>
                <div className="trophy-glow">🏆</div>
                <h2 className="title" style={{ textAlign: 'center', margin: '1rem 0', fontSize: '2rem' }}>MISSÃO CONCLUÍDA!</h2>
                <p className="balance-title" style={{ fontSize: '0.8rem', opacity: 1, color: '#FFD700', textAlign: 'center' }}>{celebratingMission.label}</p>
                <div className="mission-details-card">
                  <p style={{ opacity: 0.8, fontSize: '0.9rem', lineHeight: '1.6' }}>{celebratingMission.desc}</p>
                  <div style={{ marginTop: '1.5rem', color: '#00E676', fontWeight: 900, fontSize: '1.2rem' }}>+ RECOMPENSA_ESTATÍSTICA</div>
                </div>
                <button className="primary-btn" style={{ marginTop: '1rem' }} onClick={() => setCelebratingMission(null)}>COLETAR_GLÓRIA</button>
              </div>
            </div>
          )
        }

        {
          showLevelUpModal && (
            <div className="level-up-overlay" onClick={() => setShowLevelUpModal(false)}>
              <div className="confetti-container">
                {Array.from({ length: 50 }).map((_, i) => (
                  <div key={i} className="confetti-piece" style={{
                    left: `${Math.random() * 100}%`,
                    background: ['#00A3FF', '#0066FF', '#FFFFFF'][i % 3],
                    animationDelay: `${Math.random() * 2}s`,
                    width: `${8 + Math.random() * 8}px`,
                    height: `${8 + Math.random() * 8}px`,
                    animationDuration: `${2 + Math.random() * 3}s`
                  }}></div>
                ))}
              </div>

              <div className="level-up-card" onClick={e => e.stopPropagation()}>
                {/* RANK TRANSITION ANIMATION */}
                <div className="rank-transition-container">
                  <div className="rank-old">{getInvestorTitle(levelUpData.old)}</div>
                  <div className="rank-new-wrapper">
                    <div className="rank-new">{getInvestorTitle(levelUpData.new)}</div>
                  </div>
                </div>

                <div className="level-badge-container">
                  <div className="level-badge-anim">{levelUpData.new}</div>
                </div>
                <div className="level-up-title">NOVO NÍVEL ALCANÇADO</div>
                <h1 className="level-up-header">PARABÉNS!</h1>
                <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '2rem', fontSize: '0.9rem' }}>
                  {levelUpPhrase}
                </p>
                <button className="glow-btn" onClick={() => setShowLevelUpModal(false)}>CONTINUAR</button>
              </div>
            </div>
          )
        }

        {/* IMPULSE MODAL */}
        {
          showImpulseModal && (
            <div className="modal-overlay" onClick={() => setShowImpulseModal(false)}>
              <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px' }}>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🍔🚫</div>
                  <h2 className="title" style={{ fontSize: '1.4rem', marginBottom: '0.5rem', textAlign: 'center' }}>ECONOMIA DE IMPULSO</h2>
                  <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Não comprou aquele lanche ou supérfluo?</p>
                </div>

                <div className="input-group">
                  <label>VALOR ECONOMIZADO (R$)</label>
                  <input
                    type="number"
                    placeholder="Ex: 30.00"
                    value={impulseValue}
                    onChange={e => setImpulseValue(e.target.value)}
                    autoFocus
                  />
                </div>

                {impulseValue && !isNaN(parseFloat(impulseValue)) && (
                  <div className="impulse-projection-box">
                    <div className="impulse-sim-line">
                      <span>HOJE</span>
                      <span className="val-now">R$ {parseFloat(impulseValue).toFixed(2)}</span>
                    </div>
                    <div className="impulse-arrow">⬇ EM 10 ANOS (Juros Compostos) ⬇</div>
                    <div className="impulse-sim-result">
                      R$ {(parseFloat(impulseValue) * (Math.pow(1 + 0.15, 10))).toFixed(2)}
                    </div>
                    <div className="impulse-note">
                      Isso é o que você teria se investisse esse valor hoje.
                    </div>
                  </div>
                )}

                <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                  <button className="primary-btn" onClick={handleImpulseInvest}
                    disabled={!impulseValue || isNaN(parseFloat(impulseValue))}
                    style={{ background: 'linear-gradient(135deg, #00E676 0%, #00C853 100%)', boxShadow: '0 10px 30px rgba(0, 230, 118, 0.3)' }}>
                    INVESTIR AGORA
                  </button>
                  <button className="text-link" style={{ marginTop: '1rem', width: '100%', border: 'none', background: 'none', color: '#fff', opacity: 0.5, cursor: 'pointer' }} onClick={() => setShowImpulseModal(false)}>
                    CANCELAR
                  </button>
                </div>
              </div>
            </div>
          )
        }

        {/* SKILLS MODAL */}
        {
          showSkillsModal && (
            <div className="modal-overlay" onClick={() => setShowSkillsModal(false)}>
              <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                <h2 style={{ color: '#C0C0C0', textShadow: '0 0 10px rgba(192,192,192,0.5)', textAlign: 'center', marginBottom: '1.5rem' }}>LOJA DE HABILIDADES</h2>
                <p style={{ textAlign: 'center', fontSize: '0.8rem', opacity: 0.7, marginBottom: '2rem' }}>
                  Seu Nível é seu Poder. Desbloqueie ferramentas avançadas evoluindo seu perfil.
                </p>

                {/* SKILL 1: VISÃO DE ÁGUIA (LVL 5) */}
                <div className={`skill-card ${currentLevel >= 5 ? 'unlocked' : 'locked'}`} style={{
                  background: currentLevel >= 5 ? 'rgba(0, 163, 255, 0.1)' : 'rgba(0,0,0,0.3)',
                  border: currentLevel >= 5 ? '1px solid #00A3FF' : '1px solid rgba(255,255,255,0.1)',
                  padding: '15px', borderRadius: '12px', marginBottom: '1.5rem',
                  opacity: currentLevel >= 5 ? 1 : 0.6
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', color: currentLevel >= 5 ? '#00A3FF' : '#aaa' }}>
                      🦅 VISÃO DE ÁGUIA
                      {currentLevel < 5 && <span style={{ fontSize: '0.6rem', marginLeft: '8px', background: '#333', padding: '2px 6px', borderRadius: '4px' }}>REQ: LVL 5</span>}
                    </h3>
                    {currentLevel >= 5 && <span style={{ fontSize: '1.2rem' }}>🔓</span>}
                  </div>

                  {currentLevel < 5 ? (
                    <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>Desbloqueia um gráfico de projeção de patrimônio para os próximos 10 anos.</p>
                  ) : (
                    <div style={{ height: '150px', width: '100%', marginTop: '10px' }}>
                      <p style={{ fontSize: '0.7rem', color: '#00A3FF', marginBottom: '5px' }}>PROJEÇÃO DE 10 ANOS (Cenário Constante)</p>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={Array.from({ length: 11 }).map((_, i) => {
                          // FV = PV * (1 + r)^n
                          // Using simplified net annual rate of 85% of CDI
                          const rate = cdiAnual * 0.85;
                          const val = totalInvested * Math.pow(1 + rate, i);
                          return { name: `Ano ${i}`, value: val };
                        })}>
                          <defs>
                            <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#00A3FF" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="#00A3FF" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <Area type="monotone" dataKey="value" stroke="#00A3FF" fillOpacity={1} fill="url(#colorVal)" />
                          <Tooltip
                            contentStyle={{ background: '#0f0f1a', border: '1px solid #333', fontSize: '0.7rem' }}
                            formatter={(val: any) => `R$ ${val?.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`}
                            labelStyle={{ color: '#aaa' }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* SKILL 2: ALQUIMIA FINANCEIRA (LVL 10) */}
                <div className={`skill-card ${currentLevel >= 10 ? 'unlocked' : 'locked'}`} style={{
                  background: currentLevel >= 10 ? 'rgba(255, 215, 0, 0.1)' : 'rgba(0,0,0,0.3)',
                  border: currentLevel >= 10 ? '1px solid #FFD700' : '1px solid rgba(255,255,255,0.1)',
                  padding: '15px', borderRadius: '12px', marginBottom: '1.5rem',
                  opacity: currentLevel >= 10 ? 1 : 0.6
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', color: currentLevel >= 10 ? '#FFD700' : '#aaa' }}>
                      ⚗️ ALQUIMIA FINANCEIRA
                      {currentLevel < 10 && <span style={{ fontSize: '0.6rem', marginLeft: '8px', background: '#333', padding: '2px 6px', borderRadius: '4px' }}>REQ: LVL 10</span>}
                    </h3>
                    {currentLevel >= 10 && <span style={{ fontSize: '1.2rem' }}>🔓</span>}
                  </div>

                  {currentLevel < 10 ? (
                    <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>Desbloqueia a Calculadora de Liberdade para saber quanto tempo você vive de renda.</p>
                  ) : (
                    <div>
                      <div className="input-group" style={{ marginBottom: '10px' }}>
                        <label style={{ fontSize: '0.7rem' }}>CUSTO DE VIDA MENSAL (R$)</label>
                        <input
                          type="number"
                          placeholder="Ex: 5000"
                          value={survivalCost}
                          onChange={(e) => setSurvivalCost(e.target.value)}
                          style={{ padding: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid #444', color: '#fff', borderRadius: '4px', width: '100%' }}
                        />
                      </div>
                      {survivalCost && parseFloat(survivalCost) > 0 && (
                        <div style={{ background: 'rgba(255, 215, 0, 0.15)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                          <span style={{ display: 'block', fontSize: '0.7rem', color: '#FFD700' }}>VOCÊ SOBREVIVERIA:</span>
                          <strong style={{ fontSize: '1.2rem', color: '#fff' }}>
                            {Math.floor(balance / parseFloat(survivalCost))} MESES
                          </strong>
                          <span style={{ display: 'block', fontSize: '0.6rem', opacity: 0.6 }}>
                            ({(balance / parseFloat(survivalCost) / 12).toFixed(1)} ANOS)
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* SKILL 3: ESCUDO FISCAL (LVL 25) */}
                <div className={`skill-card ${currentLevel >= 25 ? 'unlocked' : 'locked'}`} style={{
                  background: currentLevel >= 25 ? 'rgba(0, 230, 118, 0.1)' : 'rgba(0,0,0,0.3)',
                  border: currentLevel >= 25 ? '1px solid #00E676' : '1px solid rgba(255,255,255,0.1)',
                  padding: '15px', borderRadius: '12px', marginBottom: '1.5rem',
                  opacity: currentLevel >= 25 ? 1 : 0.6
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', color: currentLevel >= 25 ? '#00E676' : '#aaa' }}>
                      🛡️ ESCUDO FISCAL
                      {currentLevel < 25 && <span style={{ fontSize: '0.6rem', marginLeft: '8px', background: '#333', padding: '2px 6px', borderRadius: '4px' }}>REQ: LVL 25</span>}
                    </h3>
                    {currentLevel >= 25 && <span style={{ fontSize: '1.2rem' }}>🔓</span>}
                  </div>

                  {currentLevel < 25 ? (
                    <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>Desbloqueia o monitor avançado de eficiência tributária.</p>
                  ) : (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                        <div style={{ background: 'rgba(255, 77, 77, 0.2)', padding: '8px', borderRadius: '6px' }}>
                          <span style={{ fontSize: '0.6rem', display: 'block' }}>ALIQ. MÉDIA ATUAL</span>
                          <strong style={{ color: '#FF4D4D' }}>
                            {(() => {
                              const avgRate = machines.length > 0 ? machines.reduce((acc, m) => {
                                const { irFactor } = getTaxMultipliers(m.created_at, false, currentDate);
                                return acc + (1 - irFactor);
                              }, 0) / machines.length : 0.225;
                              return (avgRate * 100).toFixed(1) + '%';
                            })()}
                          </strong>
                        </div>
                        <div style={{ background: 'rgba(0, 230, 118, 0.2)', padding: '8px', borderRadius: '6px' }}>
                          <span style={{ fontSize: '0.6rem', display: 'block' }}>META (MIN)</span>
                          <strong style={{ color: '#00E676' }}>15.0%</strong>
                        </div>
                      </div>
                      <p style={{ fontSize: '0.7rem', color: '#aaa' }}>Segurar seus ativos até o vencimento garante a alíquota mínima de 15% de IR, maximizando seu retorno líquido.</p>
                    </div>
                  )}
                </div>

                <button className="action-btn" onClick={() => setShowSkillsModal(false)} style={{ width: '100%', padding: '12px' }}>FECHAR LOJA</button>
              </div>
            </div>
          )
        }

        {/* LEVEL UP MODAL */}


        {/* ACHIEVEMENTS MODAL */}
        {
          showAchievementsModal && (
            <div className="modal-overlay" onClick={() => setShowAchievementsModal(false)}>
              <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', maxHeight: '80vh', overflow: 'auto' }}>
                <h2 style={{ color: '#FFD700', textAlign: 'center', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  🏆 CONQUISTAS
                  <span style={{ fontSize: '0.8rem', background: 'rgba(255,215,0,0.2)', padding: '4px 8px', borderRadius: '6px' }}>
                    {processedAchievements.filter(a => a.unlocked).length}/{processedAchievements.length}
                  </span>
                </h2>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {['all', 'patrimony', 'machines', 'time', 'mastery', 'special'].map(cat => (
                    <button
                      key={cat}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: 'rgba(255,255,255,0.05)',
                        color: '#fff',
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        textTransform: 'uppercase'
                      }}
                    >
                      {cat === 'all' ? 'Todas' : cat}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'grid', gap: '12px' }}>
                  {processedAchievements.map((ach: Achievement) => (
                    <div
                      key={ach.id}
                      style={{
                        background: ach.unlocked ? `linear-gradient(135deg, ${getRarityColor(ach.rarity)}15 0%, rgba(0,0,0,0.3) 100%)` : 'rgba(0,0,0,0.2)',
                        border: `2px solid ${ach.unlocked ? getRarityColor(ach.rarity) : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: '12px',
                        padding: '15px',
                        opacity: ach.unlocked ? 1 : 0.5,
                        boxShadow: ach.unlocked ? getRarityGlow(ach.rarity) : 'none',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <div style={{ fontSize: '2rem', filter: ach.unlocked ? 'none' : 'grayscale(100%)' }}>
                          {ach.icon}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <h4 style={{ margin: 0, fontSize: '0.9rem', color: ach.unlocked ? '#fff' : '#888' }}>
                              {ach.name}
                            </h4>
                            {ach.unlocked && (
                              <span style={{ fontSize: '0.6rem', background: getRarityColor(ach.rarity), color: '#000', padding: '2px 6px', borderRadius: '4px', fontWeight: 900 }}>
                                {ach.rarity.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <p style={{ margin: '4px 0', fontSize: '0.75rem', opacity: 0.7 }}>
                            {ach.description}
                          </p>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                            {ach.reward.title && (
                              <span style={{ fontSize: '0.65rem', background: 'rgba(0,230,118,0.2)', color: '#00E676', padding: '3px 6px', borderRadius: '4px' }}>
                                Título: {ach.reward.title}
                              </span>
                            )}
                          </div>
                          {ach.unlocked && ach.unlockedAt && (
                            <div style={{ fontSize: '0.6rem', opacity: 0.5, marginTop: '6px' }}>
                              Desbloqueado em: {new Date(ach.unlockedAt).toLocaleDateString('pt-BR')}
                            </div>
                          )}

                          {ach.unlocked && !ach.notified && (
                            <button
                              className="primary-btn"
                              onClick={() => handleClaimAchievement(ach)}
                              style={{
                                marginTop: '12px',
                                padding: '8px 15px',
                                fontSize: '0.7rem',
                                background: '#FFD700',
                                color: '#000',
                                fontWeight: 900,
                                width: 'auto'
                              }}
                            >
                              RESGATAR CONQUISTA
                            </button>
                          )}

                          {ach.notified && (
                            <div style={{ marginTop: '10px', color: '#00E676', fontSize: '0.65rem', fontWeight: 800 }}>
                              ✓ RECOMPENSA REIVINDICADA
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button className="primary-btn" onClick={() => setShowAchievementsModal(false)} style={{ width: '100%', marginTop: '1.5rem' }}>
                  FECHAR
                </button>
              </div>
            </div>
          )
        }

        {
          showAchievementUnlock && achievementQueue.length > 0 && (
            <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.9)' }}>
              <div className="achievement-unlock-animation" style={{
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                border: `3px solid ${getRarityColor(achievementQueue[0].rarity)}`,
                borderRadius: '20px',
                padding: '40px',
                textAlign: 'center',
                maxWidth: '400px',
                boxShadow: `0 0 50px ${getRarityColor(achievementQueue[0].rarity)}80`,
                animation: 'achievementPop 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)'
              }}>
                <div style={{ fontSize: '4rem', marginBottom: '20px', animation: 'bounce 1s infinite' }}>
                  {achievementQueue[0].icon}
                </div>
                <div style={{ fontSize: '0.8rem', color: getRarityColor(achievementQueue[0].rarity), fontWeight: 900, letterSpacing: '2px', marginBottom: '10px' }}>
                  {achievementQueue[0].rarity.toUpperCase()} ACHIEVEMENT
                </div>
                <h2 style={{ fontSize: '1.8rem', color: '#fff', marginBottom: '10px' }}>
                  {achievementQueue[0].name}
                </h2>
                <p style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '20px' }}>
                  {achievementQueue[0].description}
                </p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
                </div>
                <button
                  className="glow-btn"
                  onClick={() => {
                    setAchievementQueue(prev => prev.slice(1));
                    setShowAchievementUnlock(false);
                  }}
                  style={{ background: `linear-gradient(135deg, ${getRarityColor(achievementQueue[0].rarity)} 0%, ${getRarityColor(achievementQueue[0].rarity)}80 100%)` }}
                >
                  CONTINUAR
                </button>
              </div>
            </div>
          )
        }

        {/* BENCHMARKS MODAL */}
        {
          showBenchmarksModal && (
            <div className="modal-overlay" onClick={() => setShowBenchmarksModal(false)}>
              <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px', maxHeight: '85vh', overflow: 'auto' }}>
                <h2 style={{ color: '#00A3FF', textAlign: 'center', marginBottom: '0.5rem' }}>
                  📊 COMPARAÇÃO DE PERFORMANCE
                </h2>
                <p style={{ textAlign: 'center', fontSize: '0.75rem', opacity: 0.6, marginBottom: '2rem' }}>
                  Veja como seu portfólio se compara com os principais benchmarks do mercado
                </p>

                {(() => {
                  const avgCDIQuota = machines.length > 0
                    ? machines.reduce((sum, m) => sum + (m.valor * m.cdi_quota), 0) / totalInvested
                    : 100;

                  const avgIRFactor = 0.775; // Média simplificada
                  const comparisons = calculateBenchmarkComparison(totalInvested, avgCDIQuota, cdiAnual, 'month', avgIRFactor);
                  const stats = getBenchmarkStats(totalInvested, avgCDIQuota, cdiAnual);

                  return (
                    <>
                      {/* Monthly Comparison */}
                      <div style={{ marginBottom: '2rem' }}>
                        <h3 style={{ fontSize: '0.9rem', color: '#FFD700', marginBottom: '1rem' }}>RENDIMENTO MENSAL LÍQUIDO</h3>
                        {comparisons.map(comp => {
                          const benchmark = BENCHMARKS.find(b => b.name === comp.benchmark)!;
                          return (
                            <div key={comp.benchmark} style={{
                              background: comp.beating ? 'rgba(0,230,118,0.1)' : 'rgba(255,77,77,0.1)',
                              border: `1px solid ${comp.beating ? '#00E676' : '#FF4D4D'}`,
                              borderRadius: '12px',
                              padding: '15px',
                              marginBottom: '12px'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '1.5rem' }}>{benchmark.icon}</span>
                                  <div>
                                    <div style={{ fontWeight: 900, fontSize: '0.9rem' }}>{benchmark.name}</div>
                                    <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>{benchmark.description}</div>
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>Taxa Anual</div>
                                  <div style={{ fontSize: '0.85rem', fontWeight: 900, color: benchmark.color }}>
                                    {(benchmark.annualRate * 100).toFixed(2)}%
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '12px' }}>
                                <div style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: '0.6rem', opacity: 0.6 }}>SEU RENDIMENTO</div>
                                  <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#00E676' }}>
                                    R$ {comp.yourYield.toFixed(2)}
                                  </div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: '0.6rem', opacity: 0.6 }}>{benchmark.name.toUpperCase()}</div>
                                  <div style={{ fontSize: '0.85rem', fontWeight: 900, color: benchmark.color }}>
                                    R$ {comp.benchmarkYield.toFixed(2)}
                                  </div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: '0.6rem', opacity: 0.6 }}>DIFERENÇA</div>
                                  <div style={{ fontSize: '0.85rem', fontWeight: 900, color: comp.beating ? '#00E676' : '#FF4D4D' }}>
                                    {comp.beating ? '+' : ''}{comp.percentageDiff.toFixed(1)}%
                                  </div>
                                </div>
                              </div>

                              {comp.beating && (
                                <div style={{ marginTop: '10px', fontSize: '0.7rem', color: '#00E676', textAlign: 'center', fontWeight: 800 }}>
                                  ✓ Você está ganhando R$ {Math.abs(comp.difference).toFixed(2)} a mais por mês!
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Long-term Stats */}
                      <div style={{ background: 'rgba(0,163,255,0.1)', border: '1px solid rgba(0,163,255,0.3)', borderRadius: '12px', padding: '20px' }}>
                        <h3 style={{ fontSize: '0.9rem', color: '#00A3FF', marginBottom: '1.5rem', textAlign: 'center' }}>
                          PROJEÇÃO DE LONGO PRAZO
                        </h3>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.65rem', opacity: 0.6, marginBottom: '5px' }}>DOBRAR SEU DINHEIRO</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#00E676' }}>
                              {stats.doublingTimeUser.toFixed(1)} anos
                            </div>
                            <div style={{ fontSize: '0.6rem', opacity: 0.5, marginTop: '3px' }}>
                              (Poupança: {stats.doublingTimePoupanca.toFixed(1)} anos)
                            </div>
                          </div>

                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.65rem', opacity: 0.6, marginBottom: '5px' }}>RETORNO REAL</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: stats.beatingInflation ? '#00E676' : '#FF4D4D' }}>
                              {(stats.realReturn * 100).toFixed(2)}%
                            </div>
                            <div style={{ fontSize: '0.6rem', opacity: 0.5, marginTop: '3px' }}>
                              {stats.beatingInflation ? '✓ Acima da inflação' : '✗ Abaixo da inflação'}
                            </div>
                          </div>

                          <div style={{ gridColumn: '1/-1', textAlign: 'center', marginTop: '10px' }}>
                            <div style={{ fontSize: '0.65rem', opacity: 0.6, marginBottom: '5px' }}>EM 10 ANOS VOCÊ TERÁ</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#FFD700' }}>
                              {stats.futureValue10Years.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#00E676', marginTop: '5px', fontWeight: 800 }}>
                              {stats.advantage10Years.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} a mais que a Poupança!
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}

                <button className="primary-btn" onClick={() => setShowBenchmarksModal(false)} style={{ width: '100%', marginTop: '1.5rem' }}>
                  FECHAR
                </button>
              </div>
            </div>
          )
        }



        {/* MODAL IMÓVEIS (FIIs) */}
        {
          showFiiModal && (
            <div className="modal-overlay" onClick={() => setShowFiiModal(false)}>
              <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                  <h3 style={{ color: '#FFD700', margin: 0 }}>🏛️ SETOR IMOBILIÁRIO (TOKENIZADO)</h3>
                  <button onClick={() => setShowFiiModal(false)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                </div>

                <div style={{ background: 'rgba(255, 215, 0, 0.05)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(255, 215, 0, 0.1)', marginBottom: '1.5rem' }}>
                  <p style={{ fontSize: '0.75rem', margin: 0, opacity: 0.8 }}>Fundos imobiliários pagam "dividendos" mensais. No Tycoon, o rendimento é acumulado diariamente baseado no dividend yield anual.</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {fiiMarketData.map(f => {
                    const owned = fiiPortfolio.find(p => p.ticker === f.ticker);
                    return (
                      <div key={f.ticker} className="glass-panel" style={{ padding: '15px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <div>
                            <span style={{ fontSize: '1.2rem', marginRight: '8px' }}>{f.icon}</span>
                            <span style={{ fontWeight: 800, color: '#FFD700' }}>{f.ticker}</span>
                            <span style={{ fontSize: '0.6rem', opacity: 0.5, marginLeft: '8px' }}>{f.sector}</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 900 }}>{formatBRLWithPrecision(f.price)}</div>
                            <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.55rem', fontWeight: 900, color: f.change >= 0 ? '#00E676' : '#FF4D4D' }}>
                                {f.change >= 0 ? '▲' : '▼'} {Math.abs(f.change).toFixed(2)}%
                              </span>
                              <span style={{ fontSize: '0.65rem', color: '#00E676', fontWeight: 900 }}>DY: {f.yield}%</span>
                            </div>
                          </div>
                        </div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.7, marginBottom: '12px', fontStyle: 'italic' }}>{f.name}</div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: '0.65rem' }}>
                            {owned ? (
                              <span style={{ color: '#00A3FF', fontWeight: 900 }}>POSSUO: {owned.quantidade} COTAS</span>
                            ) : (
                              <span style={{ opacity: 0.3 }}>NENHUMA COTA</span>
                            )}
                          </div>
                          <button
                            className="primary-btn"
                            style={{ padding: '8px 20px', fontSize: '0.75rem', background: balance >= f.price ? '#FFD700' : '#333', color: '#000', borderRadius: '8px' }}
                            onClick={() => handleBuyFii(f.ticker, 1, f.price)}
                            disabled={balance < f.price}
                          >
                            {balance >= f.price ? 'ADQUIRIR TOKEN' : 'SALDO INSUF.'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )
        }

        {/* MODAL GRÁFICO DE PIZZA (CARTEIRA) */}
        {
          showPortfolioChart && (
            <div className="modal-overlay" onClick={() => setShowPortfolioChart(false)}>
              <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ color: '#00A3FF', margin: 0 }}>🥧 COMPOSIÇÃO_DA_CARTEIRA</h3>
                  <button onClick={() => setShowPortfolioChart(false)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                </div>

                <div style={{ height: '300px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="none"
                        isAnimationActive={true}
                        animationDuration={1000}
                        animationBegin={0}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }}
                        itemStyle={{ padding: '2px 0', color: '#fff' }}
                        formatter={(val: any) => formatBRLWithPrecision(Number(val) || 0)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {chartData.map((item, idx) => {
                    const total = chartData.reduce((s, i) => s + i.value, 0);
                    const perc = ((item.value / total) * 100).toFixed(1);
                    return (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '10px 15px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ color: item.color, fontWeight: 900 }}>● {item.name}</span>
                        <span style={{ fontWeight: 800 }}>{formatBRLWithPrecision(item.value)} ({perc}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )
        }

        {/* Global Action Success Popup */}
        {/* DEBTS MODAL */}
        {showDebtsModal && (
          <div className="modal-overlay" onClick={() => setShowDebtsModal(false)}>
            <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', maxHeight: '85vh', overflow: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ color: '#FF4D4D', margin: 0 }}>📉 DÍVIDAS & DÉBITOS</h2>
                <button className="action-btn" onClick={() => setShowDebtsModal(false)} style={{ padding: '4px 8px' }}>X</button>
              </div>

              {/* SALARY SETUP */}
              <div style={{ background: 'rgba(0, 163, 255, 0.05)', padding: '15px', borderRadius: '12px', marginBottom: '1rem', border: '1px solid rgba(0, 163, 255, 0.2)' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.7rem', color: '#00A3FF' }}>CONFIGURAR SALÁRIO MENSAL</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignItems: 'center' }}>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.6rem', color: '#00A3FF', fontWeight: 900 }}>R$</span>
                    <input
                      type="number"
                      placeholder="SALÁRIO"
                      value={salary || ''}
                      onChange={e => updateSalary(parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', background: '#000', border: '1px solid #00A3FF33', padding: '10px 10px 10px 25px', color: '#fff', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 900 }}
                    />
                  </div>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.6rem', color: '#00A3FF', fontWeight: 900 }}>DIA</span>
                    <input
                      type="number"
                      placeholder="DIA"
                      min="1"
                      max="31"
                      value={salaryDay || ''}
                      onChange={e => updateSalaryDay(parseInt(e.target.value) || 1)}
                      style={{ width: '100%', background: '#000', border: '1px solid #00A3FF33', padding: '10px 10px 10px 35px', color: '#fff', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 900 }}
                    />
                  </div>
                </div>
                <p style={{ fontSize: '0.55rem', color: '#aaa', marginTop: '8px' }}>Seu salário cai todo dia {salaryDay}. Usamos isso para projetar seu aumento de capital.</p>
              </div>

              {/* CREATE DEBT FORM */}
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.7rem', color: '#aaa' }}>REGISTRAR NOVA DÍVIDA</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    placeholder="NOME DA DÍVIDA"
                    value={newDebt.nome}
                    onChange={e => setNewDebt({ ...newDebt, nome: e.target.value })}
                    style={{ background: '#000', border: '1px solid #333', padding: '8px', color: '#fff', borderRadius: '6px', fontSize: '0.7rem' }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="number"
                      placeholder="VALOR (R$)"
                      value={newDebt.valor}
                      onChange={e => setNewDebt({ ...newDebt, valor: e.target.value })}
                      style={{ flex: 1, background: '#000', border: '1px solid #333', padding: '8px', color: '#fff', borderRadius: '6px', fontSize: '0.7rem' }}
                    />
                    <select
                      value={newDebt.categoria}
                      onChange={e => setNewDebt({ ...newDebt, categoria: e.target.value })}
                      style={{ background: '#000', border: '1px solid #333', padding: '8px', color: '#fff', borderRadius: '6px', fontSize: '0.7rem' }}
                    >
                      <option value="cartao">💳 CARTÃO</option>
                      <option value="emprestimo">🏦 EMPRÉSTIMO</option>
                    </select>
                  </div>
                  <button className="action-btn" onClick={createDebt} style={{ background: '#FF4D4D', color: '#fff', border: 'none', padding: '10px', fontWeight: 900 }}>ADICIONAR DÍVIDA</button>
                </div>
              </div>

              {/* DEBT LIST */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#aaa', padding: '0 5px' }}>
                  <span>DÍVIDAS ATIVAS</span>
                  <span>TOTAL: R$ {debts.reduce((s, d) => s + d.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                {debts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', opacity: 0.5, border: '1px dashed #333', borderRadius: '12px' }}>
                    NENHUMA DÍVIDA PENDENTE. BOM TRABALHO!
                  </div>
                ) : (
                  debts.map(d => (
                    <div key={d.id} style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.55rem', opacity: 0.6, textTransform: 'uppercase' }}>{d.categoria === 'cartao' ? '💳 CARTÃO' : '🏦 EMPRÉSTIMO'}</div>
                        <div style={{ fontWeight: 900, fontSize: '0.85rem', color: '#fff' }}>{d.nome}</div>
                        <div style={{ fontWeight: 800, fontSize: '0.8rem', color: '#FF4D4D' }}>R$ {d.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                      </div>
                      <button
                        onClick={() => setConfirmPayDebt(d)}
                        className="action-btn"
                        style={{ padding: '6px 12px', fontSize: '0.65rem', background: 'rgba(0, 230, 118, 0.1)', border: '1px solid #00E676', color: '#00E676' }}
                      >
                        PAGAR
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* CONFIRM PAY DEBT MODAL */}
        {confirmPayDebt && (
          <div className="modal-overlay" style={{ zIndex: 3000 }}>
            <div className="glass-panel modal-content" style={{ maxWidth: '350px', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💸</div>
              <h3>CONFIRMAR PAGAMENTO</h3>
              <p style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                Deseja pagar a dívida <strong>{confirmPayDebt.nome}</strong> no valor de <strong>R$ {confirmPayDebt.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>?
              </p>
              <div style={{ background: 'rgba(0,230,118,0.1)', padding: '10px', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.75rem' }}>
                O valor será deduzido do seu CAPITAL LÍQUIDO.
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="action-btn" onClick={() => setConfirmPayDebt(null)} style={{ flex: 1 }}>CANCELAR</button>
                <button
                  className="action-btn"
                  onClick={() => payDebt(confirmPayDebt)}
                  style={{ flex: 1, background: '#00E676', color: '#000', border: 'none', fontWeight: 900 }}
                >
                  CONFIRMAR
                </button>
              </div>
            </div>
          </div>
        )}

        {
          actionPopup && (
            <div className="action-success-overlay">
              <div className="action-success-card">
                <span className="success-icon-anim">{actionPopup.icon}</span>
                <h3 className="success-title">{actionPopup.title}</h3>
                <p className="success-msg">{actionPopup.msg}</p>
              </div>
            </div>
          )
        }

        {notification && <div className="notification-toast"><div className="toast-content">{notification}</div></div>}

        {/* CSS INJECTION FOR EQUIPPED ITEMS */}
        <div className={equippedItems.background ? `container-bg-override ${equippedItems.background}` : ''} style={{ display: 'none' }}></div>

      </div >
    );
  };

  return renderContent();
}

export default App;
