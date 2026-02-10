import React, { useEffect, useState, useMemo, useCallback, useRef, memo, type ReactNode } from 'react'
import { createClient } from '@supabase/supabase-js'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp,
  Wallet,
  RefreshCw,
  Settings,
  HelpCircle,
  PieChart as PieIcon,
  Calculator,
  Eye,
  EyeOff,
  Menu,
  X,
  ArrowRightLeft,
  Info,
  Moon,
  Sun,
  Zap,
  TrendingDown,
  ShieldCheck,
  LogOut,
  // Sparkles,
  Save,
  Trash2
} from 'lucide-react'
import './App.css'
import { SUPABASE_URL, SUPABASE_KEY, DEFAULT_SELIC, DEFAULT_IPCA } from './constants'
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
  investment_type?: 'CDB' | 'IPCA' | 'LCI' | 'LCA' | 'ACAO' | 'FII';
  yield_mode?: 'PRE' | 'POS';
  paused?: boolean;
  payment_frequency?: 'daily' | 'monthly' | 'quarterly' | 'semiannual' | 'annual';
  stock_quantity?: number;
  stock_purchase_price?: number;
}

interface Activity {
  id: string;
  type: string;
  label: string;
  amount?: number;
  amountRemoved?: number;
  amountAdded?: number;
  currency?: string;
  target?: string;
  details?: string;
  timestamp: string;
  icon: string;
}

const formatBRLWithPrecision = (value: number) => {
  const parts = value.toFixed(2).split('.');
  const integerPart = parseInt(parts[0]).toLocaleString('pt-BR');
  const cents = parts[1];
  return (
    <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
      R$ {integerPart},{cents}
    </span>
  );
};

const formatBRLWithMicroCents = (value: number) => {
  const parts = (value || 0).toFixed(8).split('.');
  const integerPart = parseInt(parts[0]).toLocaleString('pt-BR');
  const allDecimals = parts[1];
  const mainCents = allDecimals.substring(0, 2);
  const microCents = allDecimals.substring(2);
  return (
    <span style={{ fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-1px' }}>
      <span style={{ marginRight: '4px' }}>R$</span>{integerPart},{mainCents}
      <span style={{ fontSize: '0.7em', opacity: 0.5, marginLeft: '1px' }}>{microCents}</span>
    </span>
  );
};


const AnimatedNumber = ({ value, format }: { value: number, format: (n: number) => ReactNode }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const animationRef = useRef<number | null>(null);
  const currentValueRef = useRef(displayValue);

  useEffect(() => {
    const startValue = currentValueRef.current;
    const endValue = value;
    const delta = Math.abs(startValue - endValue);

    // Skip animation for very small changes to save CPU
    if (delta < 0.001) {
      setDisplayValue(endValue);
      currentValueRef.current = endValue;
      return;
    }

    const duration = 500; // ms
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const ease = 1 - Math.pow(1 - progress, 3); // Simpler cubic easing
      const current = startValue + (endValue - startValue) * ease;

      setDisplayValue(current);
      currentValueRef.current = current;

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [value]);

  return <>{format(displayValue)}</>;
};

const LiveClock = memo(() => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 800 }}>
      {now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).toUpperCase()} | {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).toUpperCase()}
    </div>
  );
});


const MachineCard = memo(({ m, i: _i, isBusinessDay, currentDateDayOnly, equippedItems: _equippedItems, onEdit, onAporte, onResgate }: any) => {
  const multipliers = getTaxMultipliers(m.created_at, false, new Date(currentDateDayOnly), m.investment_type);
  const isMatured = m.vencimento && new Date(m.vencimento) <= new Date(currentDateDayOnly);
  const isBolsa = m.investment_type === 'ACAO' || m.investment_type === 'FII' || m.investment_type === 'ETF' || m.investment_type === 'CRYPTO';

  // SKIN PADRÃO BASEADA NO TIPO
  let typeSkin = '';
  if (m.investment_type === 'FII') typeSkin = 'fii-skin';
  else if (m.investment_type === 'ACAO' || m.investment_type === 'ETF') typeSkin = 'acao-skin';
  else if (m.investment_type === 'CRYPTO') typeSkin = 'crypto-skin';

  return (
    <div
      className={`machine-card ${isBusinessDay ? 'active-working' : ''} ${typeSkin}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative accent for Bolsa assets */}
      {isBolsa && <div style={{ position: 'absolute', top: 0, right: 0, width: '40px', height: '40px', background: 'radial-gradient(circle at top right, rgba(155, 93, 229, 0.2), transparent)', pointerEvents: 'none' }} />}

      <div style={{ display: 'flex', gap: '15px' }}>
        {/* Core Engine - Preservation of user's request: DO NOT TOUCH ANIM/LEDS */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div className="engine-core" style={{ padding: '10px', borderRadius: '12px', background: 'rgba(0,0,0,0.5)' }}>
            <div className="fan-frame" style={{ width: '40px', height: '40px' }}>
              <div className="fan-blades" style={{ width: '28px', height: '28px' }}></div>
            </div>
            <div className="status-leds" style={{ marginTop: '8px' }}>
              <div className={`led green ${isBusinessDay ? 'active' : ''} `}></div>
              <div className={`led blue ${isBusinessDay ? 'active' : ''} `} style={{ animationDelay: '0.2s' }}></div>
              <div className={`led amber ${isBusinessDay ? 'active' : ''} `} style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
          <div style={{ fontSize: '0.45rem', fontWeight: 900, color: isBusinessDay ? '#00E676' : '#FF4D4D', letterSpacing: '1px' }}>
            {isBusinessDay ? 'ACTIVE' : 'STANDBY'}
          </div>
        </div>

        {/* Content Section */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h4 style={{
                  margin: 0,
                  fontSize: '0.85rem',
                  color: '#fff',
                  fontWeight: 900,
                  letterSpacing: '0.5px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {(m.nome || 'ATIVO').toUpperCase()}
                </h4>
                <button
                  onClick={() => onEdit(m)}
                  style={{ all: 'unset', cursor: 'pointer', opacity: 0.4, color: '#fff', display: 'flex', transition: 'all 0.2s' }}
                  onMouseOver={e => e.currentTarget.style.opacity = '1'}
                  onMouseOut={e => e.currentTarget.style.opacity = '0.4'}
                >
                  <Settings size={12} />
                </button>
              </div>
              <div style={{ fontSize: '0.55rem', color: isBolsa ? '#9B5DE5' : '#00A3FF', fontWeight: 800, letterSpacing: '1px', opacity: 0.8 }}>
                {m.investment_type} | {m.cdi_quota}% {isBolsa ? 'DY' : 'CDI'}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: '0.5rem',
                fontWeight: 900,
                padding: '2px 6px',
                borderRadius: '4px',
                background: isBolsa ? 'rgba(155, 93, 229, 0.15)' : 'rgba(0, 230, 118, 0.15)',
                color: isBolsa ? '#E0AAFF' : '#00E676',
                border: `1px solid ${isBolsa ? 'rgba(155, 93, 229, 0.2)' : 'rgba(0, 230, 118, 0.2)'}`
              }}>
                {isBolsa ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <TrendingUp size={10} /> RENDIMENTO
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    {multipliers.irRateLabel} IR
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '2px' }}>
            <span style={{ fontSize: '0.8rem', color: '#666', fontWeight: 900 }}>BRL</span>
            <p style={{
              margin: 0,
              fontSize: '1.4rem',
              color: '#fff',
              fontWeight: 900,
              fontFamily: 'JetBrains Mono',
              letterSpacing: '-1px'
            }}>
              {(m.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          {/* Quick Stats Row */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
            {(m.investment_type === 'ACAO' || m.investment_type === 'FII' || m.investment_type === 'ETF') ? (
              <span style={{ fontSize: '0.5rem', background: 'rgba(255, 255, 255, 0.05)', color: '#aaa', padding: '2px 6px', borderRadius: '4px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '3px' }}>
                <PieIcon size={10} /> {m.stock_quantity?.toFixed(2)} UNID.
              </span>
            ) : (
              <span style={{
                fontSize: '0.5rem',
                background: multipliers.iofApplied ? 'rgba(255, 77, 77, 0.1)' : 'rgba(0, 230, 118, 0.1)',
                color: multipliers.iofApplied ? '#FF4D4D' : '#00E676',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                border: `1px solid ${multipliers.iofApplied ? 'rgba(255, 77, 77, 0.1)' : 'rgba(0, 230, 118, 0.1)'}`
              }}>
                {multipliers.iofApplied ? <Info size={10} /> : <ShieldCheck size={10} />}
                {multipliers.iofApplied ? `IOF: ${multipliers.daysUntilIofZero}d` : 'ISENTO IOF'}
              </span>
            )}

            <span style={{
              fontSize: '0.5rem',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#aaa',
              padding: '2px 6px',
              borderRadius: '4px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }}>
              <Moon size={10} /> {
                m.payment_frequency === 'daily' ? 'D+0' :
                  m.payment_frequency === 'monthly' ? 'M+1' : 'PERIOD.'
              }
            </span>

            {m.vencimento && (
              <span style={{
                fontSize: '0.5rem',
                background: isMatured ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 215, 0, 0.1)',
                color: isMatured ? '#00E676' : '#FFD700',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: 800,
                border: `1px solid ${isMatured ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 215, 0, 0.1)'}`
              }}>
                {isMatured ? 'LIQUIDEZ IMEDIATA' : `VENC: ${new Date(m.vencimento).toLocaleDateString('pt-BR')}`}
              </span>
            )}
          </div>

          {/* Progress Bar for Goals */}
          {m.max_capacity && m.max_capacity > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.45rem', fontWeight: 900, marginBottom: '4px' }}>
                <span style={{ color: '#00A3FF', letterSpacing: '1px' }}>META DE PATRIMÔNIO</span>
                <span style={{ color: (m.valor / m.max_capacity) >= 1 ? '#00E676' : '#888' }}>
                  {Math.min(100, (m.valor / m.max_capacity) * 100).toFixed(0)}%
                </span>
              </div>
              <div style={{ height: '3px', background: 'rgba(255,255,255,0.03)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, (m.valor / m.max_capacity) * 100)}% `,
                  background: (m.valor / m.max_capacity) >= 1 ? '#00E676' : 'linear-gradient(90deg, #00A3FF, #00E676)',
                  boxShadow: (m.valor / m.max_capacity) >= 1 ? '0 0 10px rgba(0, 230, 118, 0.4)' : 'none',
                  transition: 'width 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}></div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '15px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
        <button
          className="action-btn-new"
          style={{
            flex: 1.5,
            padding: '8px',
            background: 'rgba(0, 230, 118, 0.1)',
            color: '#00E676',
            border: '1px solid rgba(0, 230, 118, 0.2)',
            borderRadius: '8px',
            fontSize: '0.65rem',
            fontWeight: 900,
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
          onClick={() => onAporte(m)}
        >
          <Wallet size={12} /> APORTE
        </button>

        {((m.investment_type === 'ACAO' || m.investment_type === 'FII' || m.investment_type === 'ETF' || m.investment_type === 'CRYPTO') || !m.vencimento || isMatured) ? (
          <button
            className="action-btn-new"
            style={{
              flex: 1,
              padding: '8px',
              background: 'rgba(255, 255, 255, 0.03)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              fontSize: '0.65rem',
              fontWeight: 900,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
            onClick={() => onResgate(m)}
          >
            <ArrowRightLeft size={12} /> {isBolsa ? 'VENDER' : 'RESGATAR'}
          </button>
        ) : (
          <button
            disabled
            style={{
              flex: 1,
              padding: '8px',
              background: 'rgba(0,0,0,0.2)',
              color: '#555',
              border: '1px solid rgba(255, 255, 255, 0.02)',
              borderRadius: '8px',
              fontSize: '0.6rem',
              fontWeight: 900,
              cursor: 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <X size={12} /> BLOQUEADO
          </button>
        )}
      </div>
    </div>
  );
});

const YieldCountdown = memo(({ onCycleEnd, variant = 'zen' }: { onCycleEnd: () => void, variant?: 'zen' | 'minimal' }) => {
  const [countdown, setCountdown] = useState(10);
  const [progress, setProgress] = useState(0);
  const callbackRef = useRef(onCycleEnd);

  useEffect(() => {
    callbackRef.current = onCycleEnd;
  }, [onCycleEnd]);

  useEffect(() => {
    let startTime = Date.now();

    const tick = () => {
      const now = Date.now();
      const elapsed = now - startTime;

      if (elapsed >= 10000) {
        callbackRef.current();
        startTime = now; // Reset for next cycle
        setCountdown(10);
        setProgress(0);
      } else {
        const remaining = Math.max(1, 10 - Math.floor(elapsed / 1000));
        setCountdown(remaining);
        setProgress((elapsed / 10000) * 100);
      }
    };

    const interval = setInterval(tick, 50);
    return () => clearInterval(interval);
  }, []);

  if (variant === 'minimal') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{
          fontSize: '0.65rem',
          color: '#fff',
          fontWeight: 900,
          fontFamily: 'JetBrains Mono',
          minWidth: '25px'
        }}>
          {countdown}s
        </span>
        <div style={{ width: '40px', height: '2px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: '#00E676',
              transition: 'width 0.05s linear'
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <div style={{
        fontSize: '1.2rem',
        color: '#FFD700',
        fontWeight: 900,
        fontFamily: 'JetBrains Mono',
        letterSpacing: '2px',
        textShadow: '0 0 10px rgba(255, 215, 0, 0.3)'
      }}>
        00:00:{countdown.toString().padStart(2, '0')}
      </div>
      <div style={{ width: '140px', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.03)' }}>
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #00E676, #00ff84)',
            boxShadow: '0 0 15px rgba(0, 230, 118, 0.5)',
            transition: 'width 0.05s linear'
          }}
        />
      </div>
    </div>
  );
});


function App() {
  const [session, setSession] = useState<any>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [error, setError] = useState('')
  const [notification, setNotification] = useState<string | null>(null)
  const [pixCopied, setPixCopied] = useState(false)
  const [viewMode, setViewMode] = useState<'mobile' | 'pc'>('mobile')

  const [balance, setBalance] = useState(0)
  const achievementsDataLoadedRef = useRef(false);
  const [salary, setSalary] = useState(0)
  const [salaryDay, setSalaryDay] = useState(5)
  const [usdBalance, setUsdBalance] = useState(0)
  const [jpyBalance, setJpyBalance] = useState(0)
  const [cumulativeDeposits, setCumulativeDeposits] = useState(0)
  const [dailyStreak, setDailyStreak] = useState(0);
  const [lastStreakDate, setLastStreakDate] = useState('');
  const [machines, setMachines] = useState<Machine[]>([])

  // Real-time market data state
  const [apiRates, setApiRates] = useState({ USD: 5.37, JPY: 0.035 })

  // PATRIMONY & XP LOGIC
  const totalInvested = useMemo(() => machines.reduce((sum, m) => sum + m.valor, 0), [machines]);

  const totalPatrimony = useMemo(() => {
    return balance + totalInvested + (usdBalance * apiRates.USD) + (jpyBalance * apiRates.JPY);
  }, [balance, totalInvested, usdBalance, jpyBalance, apiRates]);

  const xp = totalPatrimony; // Reflexão direta do PATRIMÔNIO TOTAL BRUTO
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

  const [selectedLiquidity] = useState<'daily' | 'locked_30' | 'locked_365'>('daily');

  // MANUAL CONTROLS
  const [newMachineCDI, setNewMachineCDI] = useState('100');
  const [newMachineDate, setNewMachineDate] = useState('');
  const [newMachineLimit, setNewMachineLimit] = useState('');
  const [newMachineType, setNewMachineType] = useState<'CDB' | 'IPCA' | 'LCI' | 'LCA'>('CDB');
  const [newMachineYieldMode, setNewMachineYieldMode] = useState<'PRE' | 'POS'>('POS');
  const [newMachineCreatedAt, setNewMachineCreatedAt] = useState(new Date().toISOString().split('T')[0]);

  // Compound Interest Simulator Detailed State
  const [simYears, setSimYears] = useState(1);
  const [showPortfolioChart, setShowPortfolioChart] = useState(false);

  // PRESETS POPULATE MANUAL FIELDS
  // const applyPreset = (type: 'daily' | 'locked_30' | 'locked_365') => {
  //   setSelectedLiquidity(type);
  //   const now = new Date();

  //   if (type === 'daily') {
  //     setNewMachineCDI('100');
  //     setNewMachineDate(''); // No lock
  //     setNewMachineLimit(''); // No limit
  //   } else if (type === 'locked_30') {
  //     setNewMachineCDI('105');
  //     const d = new Date(); d.setDate(now.getDate() + 30);
  //     setNewMachineDate(d.toISOString().split('T')[0]);
  //     setNewMachineLimit('5000');
  //   } else if (type === 'locked_365') {
  //     setNewMachineCDI('120');
  //     const d = new Date(); d.setDate(now.getDate() + 365);
  //     setNewMachineDate(d.toISOString().split('T')[0]);
  //     setNewMachineLimit('10000');
  //   }
  // };




  const [currentDate, setCurrentDate] = useState(new Date())
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [isAchievementSystemReady, setIsAchievementSystemReady] = useState(false);
  const lastClosedNotifyTime = useRef(0)
  const lastYieldNotifyTime = useRef(0)
  const accumulatedYieldRef = useRef(0)
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

    // Se não é dia útil, procuramos o próximo dia útil (Segunda-feira) Ã s 00:00
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
  const [aporteQuantity, setAporteQuantity] = useState('')
  const [showAporteModal, setShowAporteModal] = useState(false)
  const [showConfirmResgate, setShowConfirmResgate] = useState<any>(null)
  const [resgateValue, setResgateValue] = useState('')
  const [resgateQuantity, setResgateQuantity] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingMachine, setEditingMachine] = useState<any>(null)
  const [editName, setEditName] = useState('')
  const [editCDI, setEditCDI] = useState('')
  const [editValue, setEditValue] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editLimit, setEditLimit] = useState('')
  const [editFrequency, setEditFrequency] = useState<'daily' | 'monthly' | 'quarterly' | 'semiannual' | 'annual'>('monthly')
  const [editQuantity, setEditQuantity] = useState('')
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [historyData, setHistoryData] = useState<any[]>([])

  // SIMULATION CALCULATOR STATE
  const [simInitial, setSimInitial] = useState(0);
  const [simMonthly, setSimMonthly] = useState(0);
  const [simRate, setSimRate] = useState(0);
  ;

  const [showCurrencyModal, setShowCurrencyModal] = useState(false)
  const [currencyConfig, setCurrencyConfig] = useState<any>({ type: 'WISE', target: 'USD', amount: '', direction: 'BRL_TO_FOREIGN' })

  const simTimeline = useMemo(() => {
    const months = (simYears || 1) * 12;
    const monthlyRate = Math.pow(1 + ((simRate || 0) / 100), 1 / 12) - 1;

    let currentBalance = simInitial || 0;
    let totalInvestedValue = simInitial || 0;
    let totalInterestEarned = 0;

    const timeline: Array<{ month: number, balance: number, totalInvested: number, interest: number }> = [];
    timeline.push({ month: 0, balance: currentBalance, totalInvested: totalInvestedValue, interest: 0 });

    for (let m = 1; m <= months; m++) {
      const monthInterest = currentBalance * monthlyRate;
      currentBalance += monthInterest + (simMonthly || 0);
      totalInvestedValue += (simMonthly || 0);
      totalInterestEarned += monthInterest;
      timeline.push({ month: m, balance: currentBalance, totalInvested: totalInvestedValue, interest: totalInterestEarned });
    }
    return { timeline, finalBalance: currentBalance, totalInvested: totalInvestedValue, months };
  }, [simInitial, simMonthly, simRate, simYears]);

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

  const [coins, setCoins] = useState<{ id: number, x: number, y: number }[]>([])
  const [lastDepositValue, setLastDepositValue] = useState(0);
  const [activities, setActivities] = useState<Activity[]>([])

  const addActivity = (activity: Omit<Activity, 'id' | 'timestamp'>) => {
    const newActivity: Activity = {
      ...activity,
      id: Math.random().toString(36).substring(2, 11),
      timestamp: new Date().toISOString()
    };
    setActivities(prev => {
      const updated = [newActivity, ...prev].slice(0, 50);
      if (session) {
        localStorage.setItem(`activities_${session.id}`, JSON.stringify(updated));
      }
      return updated;
    });
  };

  const [levelUpPhrase, setLevelUpPhrase] = useState('O passado foi queimado. O futuro é brilhante.')

  const LEVEL_UP_PHRASES = [
    "O passado foi queimado. O futuro é brilhante.",
    "Sua mentalidade evoluiu. Seu patrimÃ´nio agradece.",
    "Um novo patamar de riqueza desbloqueado.",
    "A disciplina é a ponte entre metas e realizaçÃµes.",
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
  const [achFilter, setAchFilter] = useState<'all' | 'patrimony' | 'machines' | 'time' | 'mastery' | 'daily' | 'special'>('all');
  const [accountCreatedAt, setAccountCreatedAt] = useState(new Date().toISOString());

  // New Action Success UI State
  const [actionPopup, setActionPopup] = useState<{ title: string, msg: string, icon: string } | null>(null);
  const triggerSuccess = (title: string, msg: string, icon: string = '✅') => {
    setActionPopup({ title, msg, icon });
    setTimeout(() => setActionPopup(null), 3000);
  }

  // TRANSFER/EXPENSE MODAL STATE
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferValue, setTransferValue] = useState('');
  const [transferDescription, setTransferDescription] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'gains' | 'expenses' | 'investments'>('all');
  const [hideValues, setHideValues] = useState(false);


  const achievementStats = useMemo(() => {
    const totalYieldToday = historyData.find(h => new Date(h.date).toDateString() === new Date().toDateString())?.total || 0;
    const daysActive = Math.floor(
      (new Date().getTime() - new Date(accountCreatedAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    const totalYield = historyData.reduce((sum, h) => sum + (h.total || 0), 0);

    return {
      patrimony: totalPatrimony,
      machinesCount: machines.length,
      daysActive,
      totalYield,
      level: currentLevel,
      machines,
      lastDepositValue,
      totalYieldToday,
      usdBalance,
      jpyBalance
    };
  }, [totalPatrimony, machines, accountCreatedAt, historyData, currentLevel, lastDepositValue, usdBalance, jpyBalance]);

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
  const [showSalaryProjectionModal, setShowSalaryProjectionModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [editSkin, setEditSkin] = useState('');

  // DIVIDAS (DEBTS) STATE
  const [showDebtsModal, setShowDebtsModal] = useState(false);
  const [confirmDeleteDebt, setConfirmDeleteDebt] = useState<number | null>(null);
  const [debts, setDebts] = useState<any[]>([]);
  const totalDebts = useMemo(() => debts.reduce((sum, d) => sum + d.valor, 0), [debts]);
  const [newDebt, setNewDebt] = useState({ nome: '', valor: '', yield_type: 'PRE', categoria: 'cartao', customIcon: '💸', customLabel: '' });
  const [confirmPayDebt, setConfirmPayDebt] = useState<any>(null);

  // TERMS & PRIVACY STATE
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // DEBT VS INVEST CALCULATOR STATE
  const [showDebtVsInvestModal, setShowDebtVsInvestModal] = useState(false);
  const [calcAmount, setCalcAmount] = useState('5000');
  const [calcDebtRate, setCalcDebtRate] = useState('3.5');
  const [calcInvestRate, setCalcInvestRate] = useState('1.0');
  const [calcMonths, setCalcMonths] = useState('12');

  const [isZenMode, setIsZenMode] = useState(false);
  const [showRealYield, setShowRealYield] = useState(false);
  const IPCA_ANUAL_MOCK = 0.045; // 4.5% mock
  const [monthlyInvestment, setMonthlyInvestment] = useState(0);
  const [showStockMarketModal, setShowStockMarketModal] = useState(false);
  const [newStockTicker, setNewStockTicker] = useState('');
  const [newStockPrice, setNewStockPrice] = useState('');
  const [newStockDY, setNewStockDY] = useState('');
  const [newStockFrequency, setNewStockFrequency] = useState<'daily' | 'monthly' | 'quarterly' | 'semiannual' | 'annual'>('monthly');
  const [newStockQuantity, setNewStockQuantity] = useState('');
  const [isUpdatingStocks, setIsUpdatingStocks] = useState(false);

  // Zen Mode Stable Configurations
  const zenRings = useMemo(() => {
    return [...Array(10)].map((_, i) => ({
      size: 35 + (i * 12),
      duration: 15 + (Math.random() * 45),
      axisX: Math.random(),
      axisY: Math.random(),
      axisZ: Math.random(),
      direction: Math.random() > 0.5 ? 1 : -1,
      color: i % 3 === 0 ? 'rgba(255, 255, 255, 0.3)' : i % 3 === 1 ? 'rgba(240, 248, 255, 0.25)' : 'rgba(255, 255, 255, 0.2)',
      dash: i % 2 === 0 ? '4, 12' : 'none',
      opacity: 0.4 + (Math.random() * 0.3)
    }));
  }, []);

  const zenStars = useMemo(() => {
    // 300 stars for high intensity
    return [...Array(300)].map((_) => ({
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: Math.random() * 2.5 + 0.5,
      opacity: Math.random() * 0.6 + 0.2,
      duration: Math.random() * 5 + 3,
      delay: Math.random() * -10
    }));
  }, []);

  const zenExplosions = useMemo(() => {
    return [...Array(20)].map((_) => ({
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: Math.random() * 40 + 20, // Smaller size
      duration: Math.random() * 5 + 4,
      delay: Math.random() * -20,
      color: '#00A3FF' // Only blue
    }));
  }, []);

  const zenPlanets = useMemo(() => {
    return [
      { left: 15, top: 20, size: 120, color: 'linear-gradient(135deg, #1e3a8a 0%, #1e1b4b 100%)', atmosphere: 'rgba(0, 163, 255, 0.2)', delay: -5 },
      { left: 75, top: 65, size: 80, color: 'linear-gradient(135deg, #312e81 0%, #1e1b4b 100%)', atmosphere: 'rgba(155, 93, 229, 0.15)', delay: -12 },
      { left: 85, top: 15, size: 40, color: 'linear-gradient(135deg, #4c1d95 0%, #2e1065 100%)', atmosphere: 'rgba(235, 93, 229, 0.1)', delay: -2 },
    ];
  }, []);





  // Achievement Checker - monitors transitions to show popups
  useEffect(() => {
    if (!isAchievementSystemReady || !isInitialLoadComplete) return;

    // Apenas processa se as conquistas persistidas já foram carregadas do DB
    if (Object.keys(persistedAchievements).length === 0 && achievementsDataLoadedRef.current === false) return;

    const newlyFound = ACHIEVEMENTS.filter(ach => {
      const isMet = isRequirementMet(ach, achievementStats);
      const p = persistedAchievements[ach.id];
      const wasUnlocked = p?.unlocked;
      const wasNotified = p?.notified;

      // Só dispara pop-up se for algo novo e que nunca foi notificado
      return isMet && !wasUnlocked && !wasNotified;
    });

    if (newlyFound.length > 0) {
      const newPersisted = { ...persistedAchievements };
      newlyFound.forEach(ach => {
        newPersisted[ach.id] = {
          unlocked: true,
          unlockedAt: new Date().toISOString(),
          notified: false
        };
      });
      setPersistedAchievements(newPersisted);
    }

    // Sincronização de status (unlocked) no estado persistido
    const needsStatusUpdate = ACHIEVEMENTS.some(ach => {
      const p = persistedAchievements[ach.id];
      const isMet = isRequirementMet(ach, achievementStats);
      return p && p.unlocked !== isMet;
    });

    if (needsStatusUpdate) {
      const updatedPersisted = { ...persistedAchievements };
      ACHIEVEMENTS.forEach(ach => {
        if (updatedPersisted[ach.id]) {
          updatedPersisted[ach.id].unlocked = isRequirementMet(ach, achievementStats);
        }
      });
      setPersistedAchievements(updatedPersisted);
    }
  }, [achievementStats, isInitialLoadComplete, isAchievementSystemReady, persistedAchievements]);

  // Popup Queue Consumer
  useEffect(() => {
    if (achievementQueue.length > 0 && !showAchievementUnlock) {
      setShowAchievementUnlock(true);
    }
  }, [achievementQueue, showAchievementUnlock]);




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
        await supabase.from('user_achievements').upsert(achievementsToSave, { onConflict: 'user_id, achievement_id' });
      }
    };
    saveAchievements();
  }, [persistedAchievements, session, isInitialLoadComplete]);

  // Streak reset logic handled inside loadPlayerData for atomicity


  // Auto-save Streak when changed (Debounced effect handled by simple logic)
  useEffect(() => {
    if (!session || !isInitialLoadComplete) return;

    // Agora salvamos mesmo se for 0, para permitir que o reset persista no DB
    const todayKey = new Date(Date.now() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    supabase.from('user_stats').update({
      daily_streak: dailyStreak,
      last_streak_date: lastStreakDate || todayKey
    }).eq('user_id', session.id);
  }, [dailyStreak, session, isInitialLoadComplete]);














  const handleClaimAchievement = async (achievement: Achievement) => {
    // Adiciona ao popup queue
    setAchievementQueue(prev => [...prev, achievement]);

    // Atualiza estado local e marca como notificado
    const newPersisted = { ...persistedAchievements };
    newPersisted[achievement.id] = {
      ...newPersisted[achievement.id],
      notified: true
    };
    setPersistedAchievements(newPersisted);

    // Persistência Imediata para evitar que reapareça no login
    await supabase.from('user_achievements').upsert([{
      user_id: session.id,
      achievement_id: achievement.id,
      unlocked: true,
      unlocked_at: newPersisted[achievement.id].unlockedAt,
      notified: true
    }], { onConflict: 'user_id, achievement_id' });

    // STREAK LOGIC: Trigger precisely on claim if it's a daily
    const todayString = new Date().toISOString().split('T')[0];
    if (achievement.category === 'daily' && lastStreakDate !== todayString) {
      const newStreak = dailyStreak + 1;
      setDailyStreak(newStreak);
      setLastStreakDate(todayString);

      // Persistir no Supabase imediatamente
      await supabase.from('user_stats').update({
        daily_streak: newStreak,
        last_streak_date: todayString
      }).eq('user_id', session.id);

      triggerSuccess('STREAK AUMENTADA!', `Sequência de ${newStreak} dias ativos! 🔥`, '🔥');
    }

    setNotification(`🏆 REIVINDICADO: ${achievement.name.toUpperCase()}!`);
  }


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
      gold_black: 0, sunset: 0, space: 0, emerald: 0, hacker: 0,
      plasma: 0, pixel_art: 0, aurora: 0, obsidian: 0, quantum: 0
    })
    setEquippedItems({ aura: '', nickColor: '', background: '', machineSkin: '' })
    setPersistedAchievements({})
    setActivities([])
    setDailyStreak(0)
    setLastStreakDate('')
    setIsInitialLoadComplete(false)
    setIsAchievementSystemReady(false)
    achievementsDataLoadedRef.current = false;

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
        setLastDepositValue(stats.last_deposit_value || 0);
        setDailyStreak(stats.daily_streak || 0);
        setLastStreakDate(stats.last_streak_date || '');

        // SISTEMA DE RESET DIÁRIO ROBUSTO (Refatorado do Zero)
        const checkAndResetDaily = async (lastResetDate: string, currentStreak: number, lastStreak: string) => {
          const now = new Date();
          const offset = now.getTimezoneOffset() * 60000;
          const localDate = new Date(now.getTime() - offset);
          const todayKey = localDate.toISOString().split('T')[0];

          if (lastResetDate !== todayKey) {

            let newStreak = currentStreak;
            let streakBroken = false;

            // Lógica de Streak (Fogo)
            if (lastStreak) {
              const lastDate = new Date(lastStreak + 'T00:00:00');
              const currentDateOnly = new Date(todayKey + 'T00:00:00');
              const diffTime = Math.abs(currentDateOnly.getTime() - lastDate.getTime());
              const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

              if (diffDays > 1) {
                newStreak = 0;
                streakBroken = true;
              }
            }

            // 1. Resetar TODAS as Conquistas no DB (Zera unlocked, notified e unlocked_at)
            // Agora o reset é global para todas as categorias, não apenas 'daily'
            await supabase.from('user_achievements')
              .update({ unlocked: false, notified: false, unlocked_at: null })
              .eq('user_id', session.id);

            // 2. Atualizar Stats no DB
            await supabase.from('user_stats').update({
              last_daily_reset: todayKey,
              daily_streak: newStreak,
              last_deposit_value: 0
            }).eq('user_id', session.id);

            // 3. Atualizar Estado Local
            setDailyStreak(newStreak);
            if (streakBroken) setNotification('💔 QUE PENA! SUA STREAK FOI ZERADA.');
            else setNotification('☀️ BOM DIA! METAS DIÁRIAS RENOVADAS.');

            return true;
          }
          return false;
        };

        await checkAndResetDaily(stats.last_daily_reset, stats.daily_streak || 0, stats.last_streak_date || '');
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
      achievementsDataLoadedRef.current = true;

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

      // Carregar Histórico de Atividades do LocalStorage (Persistência por Sessão)
      if (session) {
        const savedActivities = localStorage.getItem(`activities_${session.id}`);
        if (savedActivities) {
          try {
            setActivities(JSON.parse(savedActivities));
          } catch (e) {
            console.error('Erro ao ler historico:', e);
          }
        }
      }
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
      const { iofFactor, irFactor } = getTaxMultipliers(m.created_at, false, now, m.investment_type);
      let rate = m.yield_mode === 'PRE' ? (m.cdi_quota / 100) : (m.cdi_quota / 100) * activeCDI;
      if (m.investment_type === 'IPCA') rate += DEFAULT_IPCA;
      const dailyGross = (m.valor * rate) / 252;
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
    let totalDProjected = 0;

    let fixedD = 0;
    let stockD = 0;
    let fixedDProj = 0;
    let stockDProj = 0;

    machines.forEach((m: any) => {
      const { iofFactor, irFactor } = getTaxMultipliers(m.created_at, false, currentDate, m.investment_type);
      const { irFactor: irFactorProj } = getTaxMultipliers(m.created_at, true, currentDate, m.investment_type);

      let rate = m.yield_mode === 'PRE' ? (m.cdi_quota / 100) : (m.cdi_quota / 100) * cdiAnual;
      if (m.investment_type === 'IPCA') rate += DEFAULT_IPCA;
      const dailyGross = (m.valor * rate) / 252;

      const dailyNet = dailyGross * irFactor * iofFactor;
      const dailyNetProjected = dailyGross * irFactorProj;

      const yield10s = dailyNet / 8640;
      const hourlyNet = yield10s * 360;

      totalD += dailyNet;
      totalH += hourlyNet;
      totalDProjected += dailyNetProjected;

      if (m.investment_type === 'ACAO' || m.investment_type === 'FII') {
        stockD += dailyNet;
        stockDProj += dailyNetProjected;
      } else {
        fixedD += dailyNet;
        fixedDProj += dailyNetProjected;
      }
    });

    // Adiciona o rendimento do saldo USD (Wise Rende+) à Renda Fixa
    if (usdBalance > 0) {
      const usdDailyRate = WISE_USD_APY / 365;
      const usdDailyYieldInBRL = (usdBalance * usdDailyRate) * apiRates.USD;
      totalD += usdDailyYieldInBRL;
      totalH += (usdDailyYieldInBRL / 24);
      totalDProjected += usdDailyYieldInBRL;
      fixedD += usdDailyYieldInBRL;
      fixedDProj += usdDailyYieldInBRL;
    }

    return {
      hourlyYield: totalH,
      dailyYield: totalD,
      weeklyYield: totalDProjected * 5,
      monthlyYield: totalDProjected * 21,
      fixedMonthly: fixedDProj * 21,
      stockMonthly: stockDProj * 21
    }
  }, [machines, cdiAnual, currentDate.toDateString(), usdBalance, apiRates.USD])

  const freedomProgress = useMemo(() => {
    if (!salary || salary <= 0) return 0;
    return Math.min(100, (yields.monthlyYield / salary) * 100);
  }, [yields.monthlyYield, salary]);

  const timeToFreedom = useMemo(() => {
    if (!salary || salary <= 0) return { years: 0, months: 0, days: 0, hours: 0, totalDays: 0 };
    if (freedomProgress >= 100) return { years: 0, months: 0, days: 0, hours: 0, totalDays: 0 };

    const monthlyRate = cdiAnual / 12;
    if (monthlyRate <= 0) return { years: 99, months: 0, days: 0, hours: 0, totalDays: 36500 };

    const targetPatrimony = salary / monthlyRate;
    const currentPatrimony = totalPatrimony;
    const pmt = monthlyInvestment;

    // Fixed formula to find n (months): 
    // FV = PV*(1+r)^n + PMT*((1+r)^n - 1)/r
    // Target = PV*(1+r)^n + PMT*(1+r)^n/r - PMT/r
    // Target + PMT/r = (1+r)^n * (PV + PMT/r)
    // (1+r)^n = (Target + PMT/r) / (PV + PMT/r)
    // n = log((Target + PMT/r) / (PV + PMT/r)) / log(1+r)

    let nMonths = 0;
    if (pmt > 0 || (currentPatrimony * monthlyRate > 0)) {
      const logNumerator = targetPatrimony + (pmt / monthlyRate);
      const logDenominator = currentPatrimony + (pmt / monthlyRate);
      if (logNumerator > 0 && logDenominator > 0) {
        nMonths = Math.log(logNumerator / logDenominator) / Math.log(1 + monthlyRate);
      } else {
        nMonths = 999;
      }
    } else {
      nMonths = 999;
    }

    if (nMonths < 0) nMonths = 0;
    if (nMonths > 1200) nMonths = 1200; // Cap at 100 years

    const totalDays = nMonths * 30.4375;
    const years = Math.floor(nMonths / 12);
    const months = Math.floor(nMonths % 12);
    const days = Math.floor((nMonths * 30.4375) % 30.4375);
    const hours = Math.floor((((nMonths * 30.4375) % 30.4375) % 1) * 24);

    return { years, months, days, hours, totalDays };
  }, [salary, totalPatrimony, monthlyInvestment, cdiAnual, freedomProgress]);

  const filteredActivities = useMemo(() => {
    return activities.filter(act => {
      if (historyFilter === 'all') return true;
      if (historyFilter === 'gains') return ['deposit', 'impulse', 'dividend'].includes(act.type);
      if (historyFilter === 'expenses') return ['transfer', 'pay_debt', 'reset_balance'].includes(act.type);
      if (historyFilter === 'investments') return ['create_machine', 'contribution', 'stock_purchase', 'resgate', 'partial_resgate', 'stock_sale', 'exchange'].includes(act.type);
      return true;
    });
  }, [activities, historyFilter]);

  const handleEditMachine = useCallback((machine: any) => {
    setEditingMachine(machine);
    setEditName(machine.nome);
    setEditValue(machine.valor.toString());
    setEditCDI(machine.cdi_quota.toString());
    setEditDate(machine.vencimento || '');
    setEditSkin(machine.skin || '');
    setEditLimit(machine.max_capacity?.toString() || '');
    setEditFrequency(machine.payment_frequency || 'monthly');
    setEditQuantity(machine.stock_quantity?.toString() || '');
    setShowEditModal(true);
  }, []);

  const handleAporteMachine = useCallback((machine: any) => {
    setSelectedMachine(machine);
    setAporteValue('');
    setAporteQuantity('');
    setShowAporteModal(true);
  }, []);

  const handleResgateMachine = useCallback((machine: any) => {
    setShowConfirmResgate(machine);
    setResgateValue('');
    setResgateQuantity('');
  }, []);



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
      setCurrentDate(prev => {
        // Detecção de mudança de dia para reset de rendimento diário 
        // Apenas verificamos uma vez por minuto no App para economizar recursos
        if (prev && prev.getDate() !== now.getDate()) {
          setMachines(prevM => prevM.map(m => ({ ...m, rendimento_dia: 0 })));
          setNotification('NOVO DIA INICIADO: RENDIMENTOS ZERADOS');
          return now;
        }
        if (!prev || prev.getHours() !== now.getHours() || prev.getMinutes() !== now.getMinutes()) return now;
        return prev;
      });
    }, 1000)
    return () => clearInterval(timer)
  }, [])



  const historyStats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    let totalToday = 0;
    let totalYesterday = 0;

    historyData.forEach(h => {
      const hDate = new Date(h.date);
      // Comparação de tempo exata para evitar sobreposição
      if (hDate.getTime() === startOfToday.getTime()) {
        totalToday += h.total;
      } else if (hDate.getTime() === startOfYesterday.getTime()) {
        totalYesterday += h.total;
      }
    });

    return { totalToday, total24h: totalYesterday };
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
    let bolsaDividends = 0;
    // SEGURANÇA: Filtramos máquinas que não pertencem à sessão atual para evitar cross-account leak
    const validMachines = machines.filter((m: any) => m.user_id === session.id);

    if (validMachines.length === 0 && machines.length > 0) {
      console.warn('Detectada inconsistência de sessão nas máquinas. Abortando ciclo.');
      return;
    }

    const updatedMachines = validMachines.map((m: any) => {
      const { iofFactor, irFactor } = getTaxMultipliers(m.created_at, false, currentDate, m.investment_type);
      let rate = m.yield_mode === 'PRE' ? (m.cdi_quota / 100) : (m.cdi_quota / 100) * cdiAnual;
      if (m.investment_type === 'IPCA') rate += DEFAULT_IPCA;
      const dailyGross = (m.valor * rate) / 252;
      const dailyNet = dailyGross * irFactor * iofFactor;
      const yield10s = dailyNet / 8640;

      cycleTotalProfit += yield10s;

      const dailyYield = (m.rendimento_dia || 0) + yield10s;

      // Se for ACAO ou FII, o rendimento vai para o SALDO (Dividendos) em vez de aumentar o valor do ativo
      if (m.investment_type === 'ACAO' || m.investment_type === 'FII') {
        bolsaDividends += yield10s;
        return { ...m, rendimento_dia: dailyYield };
      }

      return { ...m, valor: m.valor + yield10s, rendimento_dia: dailyYield };
    });

    const statsUpdate: any = {};
    if (bolsaDividends > 0) {
      const newBalance = balance + bolsaDividends;
      setBalance(newBalance);
      statsUpdate.balance = newBalance;
    }

    let usdInterestCycle = 0;
    if (usdBalance > 0) {
      usdInterestCycle = (usdBalance * WISE_USD_APY) / 365 / 8640;
      const newUsdBalance = usdBalance + usdInterestCycle;
      setUsdBalance(newUsdBalance);
      statsUpdate.usd_balance = newUsdBalance;
    }

    if (Object.keys(statsUpdate).length > 0) {
      await supabase.from('user_stats').update(statsUpdate).eq('user_id', session.id);
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

      // Acumula o rendimento para a notificação de 1 minuto
      accumulatedYieldRef.current += cycleTotalProfit;

      // Notificação de rendimento para o usuário - Throttle: 1 em 1 minuto (Mostra o valor SOMADO)
      const now = Date.now();
      if (now - lastYieldNotifyTime.current >= 60000) {
        setNotification(`RENDIMENTO ACUMULADO (1m): +R$ ${accumulatedYieldRef.current.toFixed(6).replace('.', ',')}`);
        lastYieldNotifyTime.current = now;
        accumulatedYieldRef.current = 0; // Reseta para o próximo ciclo de 1m
      }
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

      const dailyTotalProfit = updatedMachines.reduce((sum, m) => sum + (m.rendimento_dia || 0), 0) + usdInterestBRL;

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
    const isStock = selectedMachine.investment_type === 'ACAO' || selectedMachine.investment_type === 'FII';
    let valor = 0;
    let qtyToAdd = 0;

    if (isStock) {
      qtyToAdd = Math.floor(parseFloat(aporteQuantity) || 0);
      if (qtyToAdd <= 0) return setNotification('QUANTIDADE INVÁLIDA');

      const pricePerShare = selectedMachine.valor / (selectedMachine.stock_quantity || 1);
      valor = qtyToAdd * pricePerShare;
    } else {
      valor = parseFloat(aporteValue);
    }

    if (isNaN(valor) || valor <= 0) return setNotification('VALOR INVÁLIDO');
    if (valor > balance + 0.01) return setNotification('CAPITAL INSUFICIENTE');

    const novoValor = selectedMachine.valor + valor;
    const novaQty = isStock ? (selectedMachine.stock_quantity || 0) + qtyToAdd : selectedMachine.stock_quantity;

    const updateData: any = { valor: novoValor };
    if (isStock) updateData.stock_quantity = Math.round(novaQty);

    const { error } = await supabase.from('maquinas').update(updateData).eq('id', selectedMachine.id)
    if (!error) {
      setMachines(machines.map(m => m.id === selectedMachine.id ? {
        ...m,
        valor: novoValor,
        stock_quantity: novaQty
      } : m))
      const newBalance = balance - valor
      setBalance(newBalance)
      await supabase.from('user_stats').upsert({ user_id: session.id, balance: newBalance })
      setAporteValue('')
      setAporteQuantity('')
      triggerSuccess(isStock ? 'COMPRA REALIZADA' : 'APORTE REALIZADO', `Sucesso em ${selectedMachine.nome}`, isStock ? '📈' : '💵');
      addActivity({
        type: 'contribution',
        label: isStock ? 'COMPRA DE COTAS' : 'APORTE REALIZADO',
        amount: valor,
        icon: isStock ? '📈' : '💵',
        details: isStock ? `Comprou ${qtyToAdd} cotas de ${selectedMachine.nome}` : `Investimento de R$ ${valor.toFixed(2)} em ${selectedMachine.nome}`
      });
      setShowAporteModal(false);
    } else {
      setNotification(`ERRO NO APORTE: ${error.message}`);
    }
  }

  const deleteDebt = async (debtId: any) => {
    const { error } = await supabase.from('dividas').delete().eq('id', debtId);
    if (!error) {
      setDebts(debts.filter(d => d.id !== debtId));
      setNotification('🗑️ DÍVIDA REMOVIDA DA LISTA');
      setConfirmDeleteDebt(null);
    } else {
      setNotification('ERRO AO REMOVER DÍVIDA');
    }
  }

  const handleResgate = async () => {
    if (!showConfirmResgate) return;

    const isStock = showConfirmResgate.investment_type === 'ACAO' || showConfirmResgate.investment_type === 'FII';
    let amount = 0;
    let qtyToSell = 0;

    if (isStock) {
      qtyToSell = Math.floor(parseFloat(resgateQuantity) || 0);
      if (qtyToSell <= 0) return setNotification('QUANTIDADE INVÁLIDA');
      if (qtyToSell > showConfirmResgate.stock_quantity + 0.0001) return setNotification('QUANTIDADE MAIOR QUE O DISPONÍVEL');

      const pricePerShare = showConfirmResgate.valor / (showConfirmResgate.stock_quantity || 1);
      amount = qtyToSell * pricePerShare;
    } else {
      amount = parseFloat(resgateValue) || showConfirmResgate.valor;
    }

    if (!isStock && amount > showConfirmResgate.valor + 0.0001) {
      return setNotification('VALOR MAIOR QUE O DISPONÍVEL');
    }

    if (amount <= 0) {
      return setNotification('VALOR INVÁLIDO');
    }

    const isTotal = isStock
      ? Math.abs(qtyToSell - showConfirmResgate.stock_quantity) < 0.001
      : Math.abs(amount - showConfirmResgate.valor) < 0.01;

    const remainderValue = showConfirmResgate.valor - amount;
    const remainderQty = isStock ? showConfirmResgate.stock_quantity - qtyToSell : 0;

    // Se não for total e não for bolsa, precisa sobrar pelo menos 1 Real
    if (!isTotal && !isStock && remainderValue < 1.0) {
      return setNotification('DEVE SOBRAR PELO MENOS R$ 1,00 NO ATIVO');
    }

    if (isTotal) {
      const { error } = await supabase.from('maquinas').delete().eq('id', showConfirmResgate.id)
      if (!error) {
        const newBalance = balance + amount
        setBalance(newBalance)
        setMachines(machines.filter(m => m.id !== showConfirmResgate.id))
        await supabase.from('user_stats').upsert({ user_id: session.id, balance: newBalance })
        setShowConfirmResgate(null)
        setResgateValue('')
        setResgateQuantity('')
        triggerSuccess(isStock ? 'VENDA CONCLUÍDA' : 'RESGATE CONCLUÍDO', isStock ? 'As cotas foram vendidas com sucesso.' : 'O capital retornou ao saldo líquido.', '💰');
        addActivity({
          type: 'sell_machine',
          label: isStock ? 'ATIVO VENDIDO' : 'RESGATE TOTAL',
          amount: amount,
          icon: '💰',
          details: isStock ? `Venda de ${qtyToSell} cotas de ${showConfirmResgate.nome}` : `Resgate de ${showConfirmResgate.nome} por R$ ${amount.toFixed(2)}`
        });

        // Revelação de Conquistas Pendentes
        const pendingToNotify = processedAchievements.filter(ach => {
          const p = persistedAchievements[ach.id];
          return ach.unlocked && (!p || !p.notified);
        });

        if (pendingToNotify.length > 0) {
          setTimeout(() => {
            const newPersisted = { ...persistedAchievements };
            pendingToNotify.forEach(ach => {
              newPersisted[ach.id] = { ...newPersisted[ach.id], notified: true };
            });
            setPersistedAchievements(newPersisted);
          }, 1500);
        }
      }
    } else {
      // Resgate Parcial
      const updateData: any = { valor: remainderValue };
      if (isStock) {
        updateData.stock_quantity = remainderQty;
      }

      const { error } = await supabase.from('maquinas').update(updateData).eq('id', showConfirmResgate.id)
      if (!error) {
        const newBalance = balance + amount
        setBalance(newBalance)
        setMachines(machines.map(m => m.id === showConfirmResgate.id ? {
          ...m,
          valor: remainderValue,
          stock_quantity: isStock ? remainderQty : m.stock_quantity
        } : m))
        await supabase.from('user_stats').upsert({ user_id: session.id, balance: newBalance })
        setShowConfirmResgate(null)
        setResgateValue('')
        setResgateQuantity('')
        triggerSuccess(isStock ? 'VENDA PARCIAL' : 'RESGATE PARCIAL', isStock ? 'Cotas vendidas com sucesso.' : 'Capital parcial resgatado com sucesso.', '💸');
        addActivity({
          type: 'partial_resgate',
          label: isStock ? 'VENDA PARCIAL' : 'RESGATE PARCIAL',
          amount: amount,
          icon: '💸',
          details: isStock ? `Venda de ${qtyToSell} cotas de ${showConfirmResgate.nome}` : `Resgate de R$ ${amount.toFixed(2)} de ${showConfirmResgate.nome}`
        });
      } else {
        setNotification(`ERRO NO RESGATE: ${error.message}`);
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
      investment_type: newMachineType,
      yield_mode: newMachineYieldMode,
      created_at: newMachineCreatedAt ? new Date(newMachineCreatedAt + 'T12:00:00').toISOString() : new Date().toISOString()
    }
    const { data, error } = await supabase.from('maquinas').insert([newMachine]).select().single()
    if (!error && data) {
      setMachines([...machines, data])
      const newBalance = balance - valor
      setBalance(newBalance)
      await supabase.from('user_stats').upsert({ user_id: session.id, balance: newBalance })
      triggerSuccess('NOVO ATIVO ADQUIRIDO', `${newMachineName.toUpperCase()} já está minerando CDI!`, '💰');
      addActivity({
        type: 'create_machine',
        label: 'NOVO ATIVO',
        amount: valor,
        icon: '💰',
        details: `Criação de ${newMachineName.toUpperCase()} com R$ ${valor.toFixed(2)}`
      });
      setShowCreateModal(false)
    } else if (error) {
      setNotification(`ERRO: ${error.message}`)
    }
  }

  const createStockMachine = async () => {
    const price = parseFloat(newStockPrice);
    const qty = parseFloat(newStockQuantity);
    const investAmount = price * qty;
    const dy = parseFloat(newStockDY);

    if (!newStockTicker) return setNotification('INFORME O TICKER');
    if (isNaN(price) || price <= 0) return setNotification('PREÇO INVÁLIDO');
    if (isNaN(qty) || qty <= 0) return setNotification('QUANTIDADE INVÁLIDA');
    if (investAmount > balance) return setNotification('CAPITAL INSUFICIENTE');

    // DY é anual, rendimento_dia é DY/252
    const dailyYield = (investAmount * (dy / 100)) / 252;

    const newMachine = {
      user_id: session.id,
      nome: newStockTicker.toUpperCase(),
      valor: investAmount,
      cdi_quota: dy, // Usamos dy no lugar da quota CDI para simplificar
      vencimento: null,
      rendimento_dia: dailyYield,
      investment_type: (newStockTicker.toUpperCase().endsWith('11') || newStockTicker.toUpperCase().includes('FII')) ? 'FII' : 'ACAO',
      created_at: new Date().toISOString(),
      stock_quantity: qty,
      stock_purchase_price: price,
      payment_frequency: newStockFrequency,
      skin: 'none',
      liquidity_type: 'daily',
      yield_mode: 'PRE' // Dividendos são como taxa pré-fixada sobre o valor investido
    };

    const { data, error } = await supabase.from('maquinas').insert([newMachine]).select().single();

    if (!error && data) {
      setMachines([...machines, data]);
      const newBalance = balance - investAmount;
      setBalance(newBalance);
      await supabase.from('user_stats').upsert({ user_id: session.id, balance: newBalance });

      triggerSuccess('ATIVO DA BOLSA CRIADO', `${newStockTicker.toUpperCase()} adicionado à carteira!`, '📈');
      addActivity({
        type: 'create_machine',
        label: 'NOVO ATIVO BOLSA',
        amount: investAmount,
        icon: '📈',
        details: `Comprou ${qty.toFixed(2)} cotas de ${newStockTicker.toUpperCase()}`
      });

      setShowStockMarketModal(false);
      // Reset form
      setNewStockTicker('');
      setNewStockPrice('');
      setNewStockDY('');
      setNewStockQuantity('');
    } else if (error) {
      setNotification(`ERRO: ${error.message}`);
    }
  }

  const updateStockPortfolioWithAI = async () => {
    const stockMachines = machines.filter(m => m.investment_type === 'ACAO' || m.investment_type === 'FII');
    if (stockMachines.length === 0) return setNotification('SEM ATIVOS NA BOLSA');

    setIsUpdatingStocks(true);
    setNotification('🤖 IA ACESSANDO DADOS DO GOOGLE FINANCE...');

    try {
      let totalGainLoss = 0;
      const updatedMachs = [...machines];
      const updatePromises = [];

      // Fazemos a pesquisa individual por ticker para maior precisão (IA style)
      for (const m of stockMachines) {
        try {
          // Yahoo Finance usa .SA para cotações brasileiras
          const ticker = m.nome.toUpperCase().includes('.') ? m.nome.toUpperCase() : `${m.nome.toUpperCase()}.SA`;

          // Usamos um proxy público para evitar erros de CORS no navegador
          const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`)}`;
          const response = await fetch(proxyUrl);
          const proxyData = await response.json();

          if (!proxyData.contents) continue;
          const data = JSON.parse(proxyData.contents);

          if (data && data.chart && data.chart.result && data.chart.result[0]) {
            const currentPrice = data.chart.result[0].meta.regularMarketPrice;
            const purchasePrice = m.stock_purchase_price || (m.valor / (m.stock_quantity || 1));
            const diffPerShare = currentPrice - purchasePrice;
            const totalDiff = diffPerShare * (m.stock_quantity || 0);

            totalGainLoss += totalDiff;

            const machIdx = updatedMachs.findIndex(um => um.id === m.id);
            if (machIdx > -1) {
              const newTotalValue = currentPrice * (m.stock_quantity || 0);
              updatedMachs[machIdx] = {
                ...updatedMachs[machIdx],
                valor: newTotalValue,
                stock_purchase_price: currentPrice
              };

              updatePromises.push(
                supabase.from('maquinas')
                  .update({ valor: newTotalValue, stock_purchase_price: currentPrice })
                  .eq('id', m.id)
              );
            }
          }
        } catch (tickerErr) {
          console.error(`Erro ao atualizar ticker ${m.nome}:`, tickerErr);
        }
      }

      const dbResults = await Promise.all(updatePromises);
      const errorFound = dbResults.some(r => r.error);

      if (!errorFound && updatePromises.length > 0) {
        const newBalance = balance + totalGainLoss;
        setBalance(newBalance);
        setMachines(updatedMachs);
        await supabase.from('user_stats').update({ balance: newBalance }).eq('user_id', session.id);

        triggerSuccess(
          totalGainLoss >= 0 ? 'MERCADO EM ALTA' : 'VALOR AJUSTADO',
          `IA sincronizou sua carteira com o mundo real. Resultado: ${totalGainLoss >= 0 ? '+' : ''} R$ ${totalGainLoss.toFixed(2)}`,
          totalGainLoss >= 0 ? '📈' : '📉'
        );

        addActivity({
          type: 'stock_update',
          label: 'IA: ATUALIZAÇÃO GOOGLE FINANCE',
          amount: Math.abs(totalGainLoss),
          icon: '🤖',
          details: `IA pesquisou e atualizou ${updatePromises.length} ativos da bolsa.`
        });
      } else if (updatePromises.length === 0) {
        setNotification('🤖 IA NÃO ENCONTROU DADOS PARA SEUS TICKERS');
      }
    } catch (err) {
      console.error('Erro na pesquisa IA:', err);
      setNotification('ERRO AO PESQUISAR VALORES NO MERCADO');
    } finally {
      setIsUpdatingStocks(false);
    }
  }

  const updateMachine = async () => {
    if (!editingMachine) return
    const isStock = editingMachine.investment_type === 'ACAO' || editingMachine.investment_type === 'FII';

    // Recalcular rendimento se for bolsa (DY)
    let rendimento_dia = editingMachine.rendimento_dia;
    if (isStock) {
      const val = parseFloat(editValue);
      const dy = parseFloat(editCDI);
      rendimento_dia = (val * (dy / 100)) / 252;
    }

    const updatedFields = {
      nome: editName,
      valor: parseFloat(editValue),
      cdi_quota: parseFloat(editCDI),
      vencimento: editDate || null,
      skin: editSkin ? String(editSkin) : 'none',
      max_capacity: editLimit ? parseFloat(editLimit) : null,
      payment_frequency: isStock ? editFrequency : editingMachine.payment_frequency,
      stock_quantity: isStock ? parseFloat(editQuantity) : editingMachine.stock_quantity,
      rendimento_dia,
      yield_mode: isStock ? 'PRE' : editingMachine.yield_mode
    }
    const { error } = await supabase.from('maquinas').update(updatedFields).eq('id', editingMachine.id)
    if (!error) {
      setMachines(machines.map(m => m.id === editingMachine.id ? { ...m, ...updatedFields } as any : m))
      triggerSuccess('CONFIGURAÇÕES SALVAS', 'As alterações foram sincronizadas na rede.', '⚙️');
      setShowEditModal(false)
    } else {
      setNotification(`ERRO: ${error.message}`)
    }
  }


  /*
  const handleDeleteSkin = async (skinKey: string) => {
    if (!skinCounts[skinKey] || skinCounts[skinKey] <= 0) return;

    const confirmDelete = window.confirm(`Você tem certeza que deseja deletar 1 unidade da skin ${skinKey.toUpperCase()}? Esta ação é permanente.`);
    if (!confirmDelete) return;

    const newCount = skinCounts[skinKey] - 1;
    const dbColumn = `skin_${skinKey}`;

    const { error } = await supabase
      .from('user_stats')
      .update({ [dbColumn]: newCount })
      .eq('user_id', session.id);

    if (!error) {
      setSkinCounts({ ...skinCounts, [skinKey]: newCount });
      triggerSuccess('SKIN DELETADA', `Uma unidade de ${skinKey.toUpperCase()} foi removida.`, '🗑️');
    } else {
      setNotification(`ERRO AO DELETAR: ${error.message}`);
    }
  }
  */

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

    let finalCategory = newDebt.categoria;
    if (newDebt.categoria === 'custom') {
      if (!newDebt.customLabel) return setNotification('INFORME O NOME DA CATEGORIA');
      finalCategory = `CUSTOM:${newDebt.customIcon || '💸'}:${newDebt.customLabel.toUpperCase()}`;
    }

    const debtData = {
      user_id: session.id,
      nome: newDebt.nome.toUpperCase(),
      valor,
      categoria: finalCategory,
      paga: false,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('dividas').insert([debtData]).select().single();
    if (!error && data) {
      setDebts([data, ...debts]);
      setNewDebt({ nome: '', valor: '', yield_type: 'PRE', categoria: 'cartao', customIcon: '💸', customLabel: '' });

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
      triggerSuccess('DÍVIDA PAGA', `Débito de ${debt.nome} liquidado com sucesso!`, '✅');
      addActivity({
        type: 'pay_debt',
        label: 'DÍVIDA PAGA',
        amount: debt.valor,
        icon: '✅',
        details: `Pagamento de ${debt.nome} (R$ ${debt.valor.toFixed(2)})`
      });
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
    if (!isInitialLoadComplete) return setNotification('AGUARDE: CARREGANDO DADOS DO PERFIL...');
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
      setLastDepositValue(value)

      // Persistir o valor do último depósito para controle diário
      await supabase.from('user_stats').update({ last_deposit_value: value }).eq('user_id', session.id);

      // Lógica de Skins removida
      /* 
      const totalAcc = cumulativeDeposits + value;
      const skinsToAward = Math.floor(totalAcc / 1000);
      const remainder = totalAcc % 1000;
      setCumulativeDeposits(remainder); 
      */
      const skinsToAward = 0; // Força zero para não entrar no if
      const remainder = 0; // Previne erro de referência no else

      if (skinsToAward > 0) {
        const newCounts = { ...skinCounts };
        const availableSkins = ['skin_neon', 'skin_stealth', 'skin_gold', 'skin_aurora', 'skin_cyber'];
        let awardedList: string[] = [];

        for (let i = 0; i < skinsToAward; i++) {
          // Sorteio aleatório entre as 5 skins
          const randomSkin = availableSkins[Math.floor(Math.random() * availableSkins.length)];

          // Remove o prefixo 'skin_' para salvar no contador se necessário, ou adapta conforme seu estado
          // Assumindo que o estado usa chaves como 'skin_neon', 'skin_gold' etc.
          // Se o estado usa apenas 'neon', 'gold', ajustar aqui. 
          // Olhando o código anterior, parecia usar 'skin_gold_black'. Vamos padronizar.

          // Vamos usar os nomes exatos das colunas do banco se possível, ou mapear.
          // Simplificação: vou usar os nomes das chaves do objeto newCounts.
          // Se o objeto newCounts tem chaves antigas, vamos adicionar as novas ou reutilizar.

          // Como estamos "refazendo do zero", vou assumir que vamos salvar nessas chaves novas:
          // Mas o banco de dados tem colunas fixas. Vou ter que reusar colunas ou você teria que criar novas.
          // Para não quebrar o banco agora, vou mapear as Novas Skins para as colunas existentes mais próximas:

          // Neon -> skin_neon_pink
          // Stealth -> skin_obsidian
          // Gold -> skin_gold_black
          // Aurora -> skin_aurora
          // Cyber -> skin_cyber

          let dbKey = '';
          let displayName = '';

          if (randomSkin === 'skin_neon') { dbKey = 'skin_neon_pink'; displayName = 'NEON'; }
          else if (randomSkin === 'skin_stealth') { dbKey = 'skin_obsidian'; displayName = 'STEALTH'; }
          else if (randomSkin === 'skin_gold') { dbKey = 'skin_gold_black'; displayName = 'GOLD'; }
          else if (randomSkin === 'skin_aurora') { dbKey = 'skin_aurora'; displayName = 'AURORA'; }
          else if (randomSkin === 'skin_cyber') { dbKey = 'skin_cyber'; displayName = 'CYBER'; }

          newCounts[dbKey] = (newCounts[dbKey] || 0) + 1;
          awardedList.push(displayName);
        }

        setSkinCounts(newCounts);

        // Atualizar no Supabase
        await supabase.from('user_stats').upsert({
          user_id: session.id,
          cumulative_deposits: remainder,
          skin_neon_pink: newCounts.skin_neon_pink,
          skin_obsidian: newCounts.skin_obsidian,
          skin_gold_black: newCounts.skin_gold_black,
          skin_aurora: newCounts.skin_aurora,
          skin_cyber: newCounts.skin_cyber
        });

        triggerSuccess('DEPÓSITO CONFIRMADO', `Recebido: R$ ${value.toFixed(2)}. Ganhou skins: ${awardedList.join(', ')}`, '🎁');
      } else {
        await supabase.from('user_stats').upsert({
          user_id: session.id,
          cumulative_deposits: remainder
        });
        triggerSuccess('DEPÓSITO CONFIRMADO', `Capital de R$ ${value.toFixed(2)} injetado no sistema.`, '💵');
      }

      addActivity({
        type: 'deposit',
        label: 'DEPÓSITO PIX',
        amount: value,
        icon: '💵',
        details: `R$ ${value.toFixed(2)} injetados`
      });

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
      triggerSuccess('SISTEMA RESETADO', `${amountRemoved.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} removidos do saldo.`, '💸');
      addActivity({
        type: 'reset_balance',
        label: 'SALDO ZERADO',
        amount: amountRemoved,
        icon: '🗑️',
        details: `Reset de ${amountRemoved.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
      });
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
      addActivity({
        type: 'impulse',
        label: 'IMPULSO SALVO',
        amount: val,
        icon: '🧠',
        details: `Disciplina financeira: +R$ ${val.toFixed(2)}`
      });
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

  const handleTransfer = async () => {
    const val = parseFloat(transferValue);
    if (!val || val <= 0) {
      setNotification('VALOR INVÁLIDO');
      return;
    }

    if (balance < val) {
      setNotification('SALDO INSUFICIENTE');
      return;
    }

    const newBalance = balance - val;
    const description = transferDescription.trim() || 'Gasto não especificado';

    const { error } = await supabase.from('user_stats').update({
      balance: newBalance
    }).eq('user_id', session.id);

    if (!error) {
      setBalance(newBalance);
      triggerSuccess('TRANSFERÊNCIA REALIZADA', `R$ ${val.toFixed(2)} debitado da conta.`, '💸');
      addActivity({
        type: 'transfer',
        label: 'GASTO REGISTRADO',
        amount: val,
        icon: '💸',
        details: description
      });
      setShowTransferModal(false);
      setTransferValue('');
      setTransferDescription('');
    } else {
      setNotification('ERRO AO PROCESSAR TRANSFERÊNCIA');
    }
  }


  const handleExportBackup = () => {
    const backupData = {
      meta: {
        version: "0.40",
        timestamp: new Date().toISOString(),
        exported_by: session.username
      },
      profile: {
        username: session.username,
        level: currentLevel,
        xp: xp,
        title: getInvestorTitle(balance + totalInvested),
        streak: {
          count: dailyStreak,
          last_date: lastStreakDate
        }
      },
      wealth: {
        brl_liquid: balance,
        brl_invested: totalInvested,
        usd_balance: usdBalance,
        jpy_balance: jpyBalance,
        total_patrimony_brl: totalPatrimony
      },
      portfolio: {
        machines: machines.map(m => ({
          ...m,
          status: m.paused ? 'PAUSED' : 'ACTIVE',
          yield_per_day: m.rendimento_dia
        })),
        machines_count: machines.length
      },
      debts: debts,
      achievements: {
        unlocked_ids: persistedAchievements ? Object.keys(persistedAchievements).filter(k => persistedAchievements[k].unlocked) : [],
        total_unlocked: processedAchievements.filter(a => a.unlocked).length
      },
      cosmetics: {
        equipped: equippedItems,
        // unlocked_skins: ... (se tiver essa info facil)
      }
    };

    const blob = new Blob([JSON.stringify(backupData, null, 4)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CDI_TYCOON_BACKUP_${session.username}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    setNotification('📂 BACKUP COMPLETO EXPORTADO (.TXT)');
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
      addActivity({
        type: 'exchange',
        label: 'CÂMBIO REALIZADO',
        amountRemoved: fromAmount,
        amountAdded: toAmount,
        currency: direction === 'BRL_TO_FOREIGN' ? 'BRL' : target,
        target: direction === 'BRL_TO_FOREIGN' ? target : 'BRL',
        icon: '💱',
        details: `${fromAmount.toFixed(2)} ${direction === 'BRL_TO_FOREIGN' ? 'BRL' : target} ⇄ ${toAmount.toFixed(2)} ${direction === 'BRL_TO_FOREIGN' ? target : 'BRL'}`
      });
      setShowCurrencyModal(false);
    } else {
      setNotification('ERRO AO PROCESSAR CÂMBIO');
    }
  }


  // const chartData = useMemo(() => {
  //   const usdVal = usdBalance * apiRates.USD;
  //   const jpyVal = jpyBalance * apiRates.JPY;
  //   const total = balance + xp + usdVal + jpyVal;

  //   if (total === 0) return [];

  //   return [
  //     { name: 'SALDO BRL', value: balance, color: '#00A3FF' },
  //     { name: 'CDI (MÁQS)', value: xp, color: '#00E676' },
  //     { name: 'DÓLAR (USD)', value: usdVal, color: '#FF4D4D' },
  //     { name: 'IENE (JPY)', value: jpyVal, color: '#C0C0C0' }
  //   ].filter(item => item.value > 0);
  // }, [balance, xp, usdBalance, jpyBalance, apiRates]);



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
        <div className={`login-screen ${isRegistering ? 'registration-mode-active' : ''}`}>
          <div className="glass-panel login-card">
            {/* AMBIENT LIGHTING */}
            <div className={`ambient-light ${isRegistering ? 'green' : 'blue'}`} />

            {/* DATA STREAM DECORATION (Subtle) */}
            <div className="data-stream-decoration" style={{ color: isRegistering ? '#00e676' : '#00a3ff' }}>
              {isRegistering ? 'REGISTRO_SISTEMA_v0.42_ATIVO' : 'CONEXÃO_SEGURA_ESTÁVEL'}
            </div>

            <div className="login-header-section">
              <div style={{ fontSize: '0.65rem', color: isRegistering ? '#00E676' : '#00A3FF', fontWeight: 900, letterSpacing: '6px', marginBottom: '15px', opacity: 0.8, transition: 'all 0.5s' }}>
                {isRegistering ? 'INICIALIZANDO ESCANEAMENTO DE DNA' : 'IDENTIFICAÇÃO DO SISTEMA'}
              </div>
              <h1 className="title" style={{ margin: 0, textAlign: 'center', fontSize: '2.8rem', letterSpacing: '-3px', textShadow: isRegistering ? '0 0 40px rgba(0, 230, 118, 0.6)' : '0 0 40px rgba(0, 163, 255, 0.6)', transition: 'all 0.5s' }}>
                {isRegistering ? 'NOVO PLAYER' : 'CDI_TYCOON'}
              </h1>
            </div>

            <div className="login-form-section">
              <form onSubmit={handleAuth}>
                <div className="premium-input-wrapper">
                  <label htmlFor="login-user" style={{ color: isRegistering ? '#00E676' : '#00A3FF', transition: 'all 0.5s' }}>IDENTIDADE_PLAYER</label>
                  <input
                    id="login-user"
                    placeholder={isRegistering ? "ESCOLHA SEU APELIDO" : "SUA IDENTIDADE"}
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="premium-input-wrapper" style={{ marginTop: '1.5rem' }}>
                  <label htmlFor="login-pass" style={{ color: isRegistering ? '#00E676' : '#00A3FF', transition: 'all 0.5s' }}>CHAVE_DE_ACESSO</label>
                  <input
                    id="login-pass"
                    placeholder="••••••••"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <div style={{
                    color: '#FF4D4D',
                    fontSize: '0.7rem',
                    marginBottom: '1.5rem',
                    background: 'rgba(255, 77, 77, 0.1)',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 77, 77, 0.3)',
                    textAlign: 'center',
                    fontWeight: 900,
                    animation: 'shake 0.5s ease'
                  }}>
                    {error.toUpperCase()}
                  </div>
                )}

                <div className="foda-btn-container" onClick={() => (document.querySelector('.submit-hidden') as any)?.click()}>
                  <div className="foda-btn-inner">
                    {isRegistering ? 'CRIAR PERSONAGEM' : 'ENTRAR NO SISTEMA'}
                  </div>
                  <button type="submit" className="submit-hidden" style={{ display: 'none' }} title="ENTRAR" aria-label="Entrar" />
                </div>
              </form>

              <button
                className="login-back-btn"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setError('');
                }}
              >
                {isRegistering ? '← JÁ POSSUO CADASTRO' : 'SOLICITAR NOVO ACESSO'}
              </button>
            </div>

            {/* SCANLINE DECORATION */}
            {isRegistering && (
              <div style={{ height: '3px', background: '#00E676', width: '100%', position: 'absolute', top: '0', left: '0', opacity: 0.2, animation: 'scanlineMove 3s linear infinite', boxShadow: '0 0 15px #00E676' }} />
            )}
          </div>
        </div>
      )
    }

    return (
      <>
        <AnimatePresence mode="wait">
          {isZenMode ? (
            <motion.div
              key="zen"
              initial={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.9, filter: 'blur(20px)' }}
              transition={{ duration: 0.8, ease: 'circOut' }}
              className="zen-mode-screen"
              style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'radial-gradient(circle at center, #02040a 0%, #000 100%)',
                zIndex: 10000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '20px',
                boxSizing: 'border-box',
                overflow: 'auto',
                fontFamily: "'Outfit', sans-serif"
              }}
            >
              <div style={{ position: 'absolute', inset: -50, background: 'radial-gradient(circle at center, #02040a 0%, #000 100%)', zIndex: -1 }}></div>

              {/* DEPTH LAYERS: NEBULA & STARS */}
              <div style={{ position: 'absolute', width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none' }}>
                {/* EXPLODING STARS (Supernovas) - BEHIND STARS/RINGS BUT ABOVE VOID */}
                <div className="explosions-container" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
                  {zenExplosions.map((exp, i) => (
                    <div key={i} className="star-explosion" style={{
                      left: `${exp.left}%`,
                      top: `${exp.top}%`,
                      width: `${exp.size}px`,
                      height: `${exp.size}px`,
                      '--duration': `${exp.duration}s`,
                      '--delay': `${exp.delay}s`,
                      '--color': exp.color
                    } as any} />
                  ))}
                </div>

                <div className="zen-nebula-blue" style={{
                  position: 'absolute', width: '100%', height: '100%',
                  background: 'radial-gradient(circle at 20% 40%, rgba(0, 163, 255, 0.05) 0%, transparent 40%)',
                  filter: 'blur(60px)', animation: 'pulseNebula 20s ease-in-out infinite'
                }} />
                <div className="zen-nebula-purple" style={{
                  position: 'absolute', width: '100%', height: '100%',
                  background: 'radial-gradient(circle at 80% 60%, rgba(155, 93, 229, 0.05) 0%, transparent 40%)',
                  filter: 'blur(60px)', animation: 'pulseNebula 25s ease-in-out infinite reverse'
                }} />

                {/* STARS LAYER - STABLE HIGH DENSITY */}
                <div className="stars-layer" style={{ position: 'absolute', inset: -100, opacity: 0.7 }}>
                  {zenStars.map((star, i) => (
                    <div key={i} style={{
                      position: 'absolute',
                      width: `${star.size}px`,
                      height: `${star.size}px`,
                      background: '#fff',
                      top: `${star.top}%`,
                      left: `${star.left}%`,
                      borderRadius: '50%',
                      opacity: star.opacity,
                      filter: 'blur(0.5px)',
                      animation: `twinkle ${star.duration}s infinite alternate`,
                      animationDelay: `${star.delay}s`
                    }} />
                  ))}
                </div>

                {/* PLANETS LAYER */}
                <div className="planets-layer" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                  {zenPlanets.map((p, i) => (
                    <div key={i} className="zen-planet" style={{
                      left: `${p.left}%`,
                      top: `${p.top}%`,
                      width: `${p.size}px`,
                      height: `${p.size}px`,
                      background: p.color,
                      boxShadow: `0 0 40px ${p.atmosphere}, inset -20px -20px 50px rgba(0,0,0,0.8)`,
                      animationDelay: `${p.delay}s`
                    }} />
                  ))}
                </div>

                {/* ZEN RINGS (TRUE 3D STABLE CHAOS) */}
                <div className="zen-rings-container" style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  pointerEvents: 'none', perspective: '1200px'
                }}>
                  {zenRings.map((ring, i) => (
                    <div key={`ring-${i}`} className="zen-ring" style={{
                      width: `${ring.size}vmin`,
                      height: `${ring.size}vmin`,
                      border: ring.dash !== 'none' ? `${1}px dashed ${ring.color}` : `${1}px solid ${ring.color}`,
                      position: 'absolute',
                      borderRadius: '50%',
                      opacity: ring.opacity,
                      '--duration': `${ring.duration}s`,
                      '--axis-x': ring.axisX,
                      '--axis-y': ring.axisY,
                      '--axis-z': ring.axisZ,
                      '--direction': ring.direction,
                    } as any} />
                  ))}
                </div>

                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.01) 1px, rgba(255,255,255,0.01) 2px)',
                  backgroundSize: '100% 4px', pointerEvents: 'none', opacity: 0.5
                }} />
              </div>

              <motion.div
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                style={{ textAlign: 'center', zIndex: 10, position: 'relative' }}
              >
                <div style={{ marginBottom: '2rem' }}>
                  <motion.div
                    animate={{ letterSpacing: '10px', opacity: 0.9 }}
                    transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse', ease: 'linear' }}
                    style={{
                      fontFamily: 'JetBrains Mono', fontSize: '0.65rem', color: '#00A3FF',
                      fontWeight: 900, marginBottom: '1rem'
                    }}
                  >
                    SINCRONIZANDO DADOS
                  </motion.div>

                  <h1 className="zen-main-value" style={{
                    fontSize: '4.5rem', fontWeight: 900, color: '#fff', margin: 0,
                    letterSpacing: '-2px', textShadow: '0 0 50px rgba(255,255,255,0.2)'
                  }}>
                    <AnimatedNumber value={totalPatrimony} format={(v) => formatBRLWithMicroCents(v)} />
                  </h1>
                </div>

                {/* DETALHES MINIMALISTAS (SEM CARDS) */}
                <div className="zen-stats-row" style={{
                  marginTop: '1.5rem',
                  display: 'flex',
                  gap: '2.5rem',
                  flexWrap: 'nowrap',
                  justifyContent: 'center',
                  alignItems: 'center',
                  opacity: 0.9,
                  width: '100%',
                  maxWidth: '800px',
                  margin: '0 auto'
                }}>
                  {/* Linha decorativa vertical REMOVIDA */}

                  <div style={{ textAlign: 'center' }}>
                    <motion.div
                      animate={{ opacity: 1, y: 0 }}
                      style={{ fontSize: '0.55rem', color: '#00A3FF', fontWeight: 900, letterSpacing: '3px', marginBottom: '8px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <Zap size={10} /> Provisão Diária
                    </motion.div>
                    <motion.div
                      animate={{ opacity: 1, scale: 1 }}
                      style={{ fontSize: '1.5rem', fontFamily: 'JetBrains Mono', fontWeight: 500, color: '#fff', textShadow: '0 0 20px rgba(0,163,255,0.4)' }}>
                      +R$ {(yields.dailyYield || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </motion.div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <motion.div
                      animate={{ opacity: 1, y: 0 }}
                      style={{ fontSize: '0.55rem', color: '#00E676', fontWeight: 900, letterSpacing: '3px', marginBottom: '8px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <TrendingUp size={10} /> Projetado Mês
                    </motion.div>
                    <motion.div
                      animate={{ opacity: 1, scale: 1 }}
                      style={{ fontSize: '1.5rem', fontFamily: 'JetBrains Mono', fontWeight: 500, color: '#fff', textShadow: '0 0 20px rgba(0,230,118,0.4)' }}>
                      +R$ {(yields.monthlyYield || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </motion.div>
                  </div>
                </div>

                {/* CONTADOR DE RENDIMENTO (10s) */}
                <motion.div
                  animate={{ opacity: 1 }}
                  style={{ marginTop: '1.5rem', textAlign: 'center' }}>

                  <div style={{
                    fontSize: '0.6rem', color: '#888', letterSpacing: '4px', fontWeight: 900,
                    marginBottom: '10px', textTransform: 'uppercase',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                  }}>
                    <TrendingUp size={12} /> PRÓXIMO PAGAMENTO
                  </div>

                  {/* Visualização de Cronômetro (Timer) */}
                  <div style={{
                    fontSize: '2.5rem', fontFamily: 'JetBrains Mono', fontWeight: 900, color: '#fff',
                    textShadow: '0 0 20px rgba(0, 230, 118, 0.4)', letterSpacing: '2px'
                  }}>
                    <YieldCountdown onCycleEnd={processYieldCycle} variant="zen" />
                  </div>

                </motion.div>

              </motion.div>

              <motion.button
                whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.1)' }}
                whileTap={{ scale: 0.95 }}
                className="zen-back-btn"
                onClick={() => setIsZenMode(false)}
                style={{
                  position: 'absolute', top: '20px', right: '20px', border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(0,0,0,0.4)', color: 'rgba(255,255,255,0.6)', padding: '10px 20px',
                  borderRadius: '10px', cursor: 'pointer', fontSize: '0.55rem', fontWeight: 900,
                  letterSpacing: '2px', transition: 'all 0.4s', backdropFilter: 'blur(10px)',
                  zIndex: 20000
                }}
              >
                VOLTAR AO TERMINAL
              </motion.button>

              <style>{`
                /* ZEN RINGS 3D ANIMATION */
                .zen-ring {
                  animation: rotate-3d var(--duration) linear infinite;
                  box-shadow: 0 0 15px rgba(0, 163, 255, 0.05); /* Faint glow */
                }
                @keyframes rotate-3d {
                  0% { transform: rotate3d(var(--axis-x), var(--axis-y), var(--axis-z), 0deg); }
                  100% { transform: rotate3d(var(--axis-x), var(--axis-y), var(--axis-z), calc(360deg * var(--direction))); }
                }
                
                /* STAR EXPLOSIONS (SUPERNOVAS) */
                .star-explosion {
                  position: absolute;
                  border-radius: 50%;
                  background: radial-gradient(circle, var(--color) 0%, transparent 70%);
                  opacity: 0;
                  animation: superNova var(--duration) linear infinite;
                  animation-delay: var(--delay);
                  transform: translate(-50%, -50%);
                }

                @keyframes superNova {
                  0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
                  5% { transform: translate(-50%, -50%) scale(0.1); opacity: 1; }
                  15% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.8; }
                  100% { transform: translate(-50%, -50%) scale(4); opacity: 0; }
                }

                /* ZEN PLANETS */
                .zen-planet {
                  position: absolute;
                  border-radius: 50%;
                  animation: planetFloat 30s ease-in-out infinite;
                  opacity: 0.8;
                }

                @keyframes planetFloat {
                  0%, 100% { transform: translateY(0) translateX(0) rotate(0deg); }
                  33% { transform: translateY(-20px) translateX(10px) rotate(2deg); }
                  66% { transform: translateY(10px) translateX(-15px) rotate(-1deg); }
                }
              `}</style>



              <style>{`
              @keyframes pulseNebula {
                0%, 100% { transform: scale(1); opacity: 0.5; }
                50% { transform: scale(1.2); opacity: 0.8; }
              }
              @keyframes twinkle {
                from { opacity: 0.2; transform: scale(0.8); }
                to { opacity: 0.7; transform: scale(1.1); }
              }
             `}</style>
            </motion.div>
          ) : (
            <motion.div
              key="main"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`container mode-${viewMode} ${equippedItems?.background || ''} ${equippedItems?.background === 'light' ? 'light-mode' : ''}`}
            >

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
              ))}
              <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: viewMode === 'mobile' ? '1rem 1.2rem 0.5rem 1.2rem' : '0 0.5rem 1.5rem 0.5rem' }}>
                <div>
                  <div style={{ opacity: 0.4, fontSize: '0.6rem', letterSpacing: '1px' }}>PLAYER: <span className={equippedItems?.nickColor || ''}>{(session?.username || 'USUÁRIO').toUpperCase()}</span></div>

                  {/* Time with seconds - Isolated Component for Optimization */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px' }}>
                    <LiveClock />
                  </div>


                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      <button
                        onClick={() => setHideValues(!hideValues)}
                        title={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          transition: 'all 0.2s'
                        }}
                      >
                        {hideValues ? <EyeOff size={14} color="#00A3FF" /> : <Eye size={14} color="#00A3FF" />}
                      </button>

                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: isMarketOpen ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 77, 77, 0.1)',
                        border: `1px solid ${isMarketOpen ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 77, 77, 0.2)'} `
                      }}>
                        <div style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: isMarketOpen ? '#00E676' : '#FF4D4D',
                          boxShadow: `0 0 10px ${isMarketOpen ? '#00E676' : '#FF4D4D'} `
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

                      <div
                        className="streak-badge"
                        title={lastStreakDate === new Date().toISOString().split('T')[0] ? "Meta de hoje concluída!" : "Conclua uma meta diária para manter o fogo!"}
                        style={{
                          background: dailyStreak > 0 ? 'rgba(255, 69, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          border: dailyStreak > 0 ? '1px solid rgba(255, 69, 0, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          opacity: dailyStreak > 0 ? 1 : 0.6,
                          filter: dailyStreak > 0 ? 'none' : 'grayscale(1)',
                          transition: 'all 0.3s'
                        }}
                      >
                        <Zap size={14} fill={dailyStreak > 0 ? "#FF4500" : "#aaa"} stroke="none" />
                        <span style={{ fontSize: '0.65rem', fontWeight: 900, color: dailyStreak > 0 ? '#FF4500' : '#fff', letterSpacing: '2px' }}>{dailyStreak}D</span>
                      </div>
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
                    style={{ position: 'relative', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px' }}
                    onClick={() => setShowMenu(!showMenu)}
                  >
                    {showMenu ? <X size={24} /> : <Menu size={24} />}
                  </div>

                  <AnimatePresence>
                    {showMenu && (
                      <div key="hamburger-portal">
                        <motion.div
                          key="overlay"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setShowMenu(false)}
                          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(2px)', zIndex: 9000 }}
                        />
                        <motion.div
                          key="panel"
                          initial={{ x: '100%' }}
                          animate={{ x: 0 }}
                          exit={{ x: '100%' }}
                          transition={{ ease: 'easeInOut', duration: 0.3 }}
                          style={{
                            position: 'fixed',
                            top: 0, right: 0, bottom: 0,
                            width: '320px',
                            background: '#0d0d0d',
                            zIndex: 9001,
                            padding: '2rem',
                            boxShadow: '-5px 0 15px rgba(0,0,0,0.5)',
                            display: 'flex', flexDirection: 'column'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff', letterSpacing: '2px', borderBottom: '2px solid #00A3FF', paddingBottom: '5px' }}>PAINEL_MENU</h2>
                            <button title="Fechar Menu" className="icon-btn-small" onClick={() => setShowMenu(false)}><X size={20} /></button>
                          </div>

                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div className="menu-item" onClick={() => { setShowPixDeposit(true); setShowMenu(false); }}>
                              <Wallet size={16} style={{ marginRight: '10px', color: '#00E676' }} /> NOVO APORTE
                            </div>
                            <div className="menu-item" onClick={() => { setShowTransferModal(true); setShowMenu(false); }}>
                              <ArrowRightLeft size={16} style={{ marginRight: '10px', color: '#FF4D4D' }} /> TRANSFERIR CAPITAL
                            </div>
                            <div className="menu-item" onClick={() => {
                              if (currentLevel < 2) {
                                setNotification("🔒 REQUER NÍVEL 2!");
                                setShowMenu(false);
                                return;
                              }
                              setShowCurrencyModal(true);
                              setShowMenu(false);
                            }}>
                              <TrendingUp size={16} style={{ marginRight: '10px', color: '#00A3FF' }} /> CÂMBIO INTERNACIONAL {currentLevel < 2 && '🔒'}
                            </div>

                            <div className="menu-item" onClick={() => { setShowDebtsModal(true); setShowMenu(false); }}>
                              <TrendingDown size={16} style={{ marginRight: '10px', color: '#FF4D4D' }} /> DÍVIDAS & DÉBITOS
                            </div>

                            <div className="menu-item" onClick={() => {
                              if (currentLevel < 2) {
                                setNotification("🔒 REQUER NÍVEL 2!");
                                setShowMenu(false);
                                return;
                              }
                              setShowPortfolioChart(true);
                              setShowMenu(false);
                            }}>
                              <PieIcon size={16} style={{ marginRight: '10px', color: '#9B5DE5' }} /> ALOCAÇÃO DE ATIVOS {currentLevel < 2 && '🔒'}
                            </div>

                            <div className="menu-item" onClick={() => {
                              if (currentLevel < 3) {
                                setNotification("🔒 REQUER NÍVEL 3!");
                                setShowMenu(false);
                                return;
                              }
                              setSimInitial(0);
                              setSimMonthly(0);
                              setSimRate(0);
                              setSimYears(1);
                              setShowStairwayChart(true);
                              setShowMenu(false);
                            }}>
                              <Calculator size={16} style={{ marginRight: '10px', color: '#FFD700' }} /> CALCULADORA DE JUROS {currentLevel < 3 && '🔒'}
                            </div>

                            <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '10px 0' }}></div>

                            <div className="menu-item" onClick={() => { setViewMode(viewMode === 'mobile' ? 'pc' : 'mobile'); setShowMenu(false); }}>
                              {viewMode === 'mobile' ? <Settings size={16} style={{ marginRight: '10px' }} /> : <Eye size={16} style={{ marginRight: '10px' }} />}
                              {viewMode === 'mobile' ? 'LAYOUT DESKTOP' : 'LAYOUT MOBILE'}
                            </div>
                            <div className="menu-item" onClick={() => { setIsZenMode(true); setShowMenu(false); }}>
                              <Moon size={16} style={{ marginRight: '10px', color: '#00A3FF' }} /> MODO FOCO (ZEN)
                            </div>
                            <div className="menu-item" onClick={() => { setShowHelpModal(true); setShowMenu(false); }}>
                              <HelpCircle size={16} style={{ marginRight: '10px', color: '#00A3FF' }} /> CENTRAL DE AJUDA
                            </div>
                            <div className="menu-item" onClick={() => { setShowPixConfig(true); setShowMenu(false); }}>
                              <Settings size={16} style={{ marginRight: '10px' }} /> AJUSTES DO SISTEMA
                            </div>

                            <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '10px 0' }}></div>

                            <div className="menu-item danger" onClick={() => { setSession(null); setShowMenu(false); }} style={{ color: '#FF4D4D', background: 'rgba(255, 77, 77, 0.05)' }}>
                              <LogOut size={16} style={{ marginRight: '10px' }} /> DESCONECTAR SISTEMA
                            </div>
                          </div>

                          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <span style={{ fontSize: '0.45rem', opacity: 0.3, fontWeight: 900, letterSpacing: '2px' }}>CDI_TYCOON MODO_ALPHA 0.46.0</span>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>

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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.55rem', fontWeight: 900, color: '#00A3FF', letterSpacing: '1px' }}>RANKING_ATUAL</span>
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
                        width: `${((xp || 0) % 1000) / 10}% `,
                        background: 'linear-gradient(90deg, #00A3FF, #00E676, #00A3FF)',
                        backgroundSize: '200% 100%',
                        animation: 'xpGradient 3s linear infinite',
                        boxShadow: '0 0 15px rgba(0, 163, 255, 0.4)',
                        transition: 'width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)'
                      }}
                    />
                  </div>
                </div>


                <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  {/* PATRIMÔNIO TOTAL */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <p className="balance-title" style={{ color: '#FFD700', fontSize: '0.6rem', marginBottom: '6px', letterSpacing: '1.5px' }}>PATRIMÔNIO TOTAL</p>
                    <h1 className="balance-value" style={{ fontSize: '2.5rem', color: '#fff', textShadow: '0 0 20px rgba(255,215,0,0.2)', margin: 0 }}>
                      {hideValues ? '•••••' : <AnimatedNumber value={totalPatrimony} format={(v) => formatBRLWithPrecision(v)} />}
                    </h1>
                  </div>

                  {/* SALDOS DETALHADOS */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '1.5rem' }}>
                    {/* CAPITAL DISPONÍVEL */}
                    <div style={{ background: 'rgba(0, 230, 118, 0.05)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(0, 230, 118, 0.15)' }}>
                      <p style={{ fontSize: '0.5rem', color: '#00E676', fontWeight: 900, marginBottom: '6px', letterSpacing: '1px' }}>DISPONÍVEL</p>
                      <h3 style={{ fontSize: '1.1rem', color: '#00E676', margin: 0, fontWeight: 900 }}>
                        {hideValues ? '•••••' : <AnimatedNumber value={balance} format={(v) => formatBRLWithPrecision(v)} />}
                      </h3>
                    </div>

                    {/* TOTAL INVESTIDO */}
                    <div style={{ background: 'rgba(0, 163, 255, 0.05)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(0, 163, 255, 0.15)' }}>
                      <p style={{ fontSize: '0.5rem', color: '#00A3FF', fontWeight: 900, marginBottom: '6px', letterSpacing: '1px' }}>INVESTIDO</p>
                      <h3 style={{ fontSize: '1.1rem', color: '#00A3FF', margin: 0, fontWeight: 900 }}>
                        {hideValues ? '•••••' : <AnimatedNumber value={totalInvested} format={(v) => formatBRLWithPrecision(v)} />}
                      </h3>
                    </div>
                  </div>

                  {/* MOEDAS ESTRANGEIRAS (se houver) */}
                  {(usdBalance > 0 || jpyBalance > 0) && (
                    <div style={{ display: 'grid', gridTemplateColumns: usdBalance > 0 && jpyBalance > 0 ? '1fr 1fr' : '1fr', gap: '15px', marginTop: '15px' }}>
                      {usdBalance > 0 && (
                        <div style={{ background: 'rgba(0, 163, 255, 0.03)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(0, 163, 255, 0.1)' }}>
                          <p style={{ fontSize: '0.45rem', color: '#00A3FF', fontWeight: 900, marginBottom: '4px', letterSpacing: '1px' }}>USD</p>
                          <h4 style={{ fontSize: '0.9rem', color: '#00A3FF', margin: 0, fontWeight: 800 }}>
                            $ {usdBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </h4>
                          <div style={{ fontSize: '0.5rem', color: '#00A3FF', opacity: 0.6, fontWeight: 700, marginTop: '2px' }}>
                            ≈ {formatBRLWithPrecision(usdBalance * apiRates.USD)}
                          </div>
                        </div>
                      )}
                      {jpyBalance > 0 && (
                        <div style={{ background: 'rgba(255, 215, 0, 0.03)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(255, 215, 0, 0.1)' }}>
                          <p style={{ fontSize: '0.45rem', color: '#FFD700', fontWeight: 900, marginBottom: '4px', letterSpacing: '1px' }}>JPY</p>
                          <h4 style={{ fontSize: '0.9rem', color: '#FFD700', margin: 0, fontWeight: 800 }}>
                            ¥ {jpyBalance.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </h4>
                          <div style={{ fontSize: '0.5rem', color: '#FFD700', opacity: 0.6, fontWeight: 700, marginTop: '2px' }}>
                            ≈ {formatBRLWithPrecision(jpyBalance * apiRates.JPY)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* BOTÃO TRANSFERIR/REGISTRAR GASTOS */}


                <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                  <div style={{
                    background: 'linear-gradient(160deg, rgba(30, 20, 50, 0.6) 0%, rgba(10, 10, 10, 0.8) 100%)',
                    border: '1px solid rgba(155, 93, 229, 0.3)',
                    borderRadius: '24px',
                    padding: '20px',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
                  }}>
                    {/* Decorative Elements */}
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(90deg, #9B5DE5, #F15BB5, #00F5D4)' }}></div>
                    <div style={{ position: 'absolute', top: '15px', right: '15px', display: 'flex', gap: '5px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#9B5DE5', animation: 'pulse 2s infinite' }}></div>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#F15BB5', opacity: 0.5 }}></div>
                    </div>

                    {/* Header & Balance */}
                    <div style={{ marginBottom: '15px', cursor: 'pointer' }} onClick={() => setShowStockMarketModal(true)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.2rem' }}>📈</span>
                          <p className="balance-title" style={{ color: '#E0AAFF', fontSize: '0.7rem', margin: 0, letterSpacing: '2px', fontWeight: 800 }}>B3 / CRIPTO (RV)</p>
                        </div>
                        <span style={{ fontSize: '1rem', color: '#9B5DE5', opacity: 0.7 }}>⌄</span>
                      </div>
                      <h2 className="balance-value" style={{ fontSize: '2rem', opacity: 1, color: '#fff', textShadow: '0 0 15px rgba(155, 93, 229, 0.4)', margin: 0 }}>
                        <AnimatedNumber value={machines.filter(m => ['FII', 'ACAO', 'ETF', 'CRYPTO'].includes(m.investment_type as string)).reduce((acc, m) => acc + m.valor, 0)} format={(v) => formatBRLWithPrecision(v)} />
                      </h2>
                      <p style={{ fontSize: '0.55rem', color: '#9B5DE5', margin: '4px 0 0 0', fontWeight: 700 }}>
                        POSIÇÃO CUSTODIADA • RENDA VARIÁVEL • CLIQUE PARA INVESTIR
                      </p>
                    </div>

                    {/* Ticker / Asset List */}
                    <div style={{
                      display: 'flex',
                      gap: '10px',
                      overflowX: 'auto',
                      paddingBottom: '5px',
                      marginTop: '15px',
                      maskImage: 'linear-gradient(to right, black 90%, transparent 100%)',
                      WebkitMaskImage: 'linear-gradient(to right, black 90%, transparent 100%)'
                    }} className="custom-scrollbar">
                      {machines.filter(m => ['FII', 'ACAO', 'ETF', 'CRYPTO'].includes(m.investment_type as string)).length > 0 ? (
                        machines.filter(m => ['FII', 'ACAO', 'ETF', 'CRYPTO'].includes(m.investment_type as string)).map((m, i) => (
                          <div key={i} style={{
                            minWidth: '110px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            borderRadius: '12px',
                            padding: '10px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            flexShrink: 0
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 900, color: '#fff', background: '#333', padding: '2px 6px', borderRadius: '4px' }}>
                                {m.nome.substring(0, 5).toUpperCase()}
                              </span>
                              <span style={{ fontSize: '0.6rem', color: '#00E676' }}>▲</span>
                            </div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#ddd' }}>
                              {(m.valor).toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })}
                            </div>
                            <div style={{ fontSize: '0.55rem', color: '#aaa', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}>
                              <span>DY: {m.cdi_quota}%</span>
                              {m.stock_quantity && <span style={{ opacity: 0.6 }}>{m.stock_quantity.toFixed(1)} qte</span>}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ width: '100%', textAlign: 'center', padding: '15px', color: '#aaa', fontSize: '0.7rem', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px' }}>
                          Nenhum ativo de Renda Variável na carteira.
                        </div>
                      )}
                      {/* Add fake market noise if some items exist */}
                      {machines.filter(m => ['FII', 'ACAO', 'ETF', 'CRYPTO'].includes(m.investment_type as string)).length > 0 && (
                        <div style={{
                          minWidth: '100px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(0, 230, 118, 0.05)', borderRadius: '12px', border: '1px solid rgba(0, 230, 118, 0.1)'
                        }}>
                          <span style={{ fontSize: '0.6rem', color: '#00E676', textAlign: 'center', fontWeight: 900 }}>
                            IBOV<br />
                            +1.2%
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowCreateModal(true); }}
                        style={{
                          flex: 1,
                          background: 'linear-gradient(135deg, #00A3FF 0%, #0066FF 100%)',
                          border: 'none',
                          color: '#fff',
                          padding: '12px',
                          borderRadius: '12px',
                          fontSize: '0.7rem',
                          fontWeight: 900,
                          cursor: 'pointer',
                          letterSpacing: '1px',
                          boxShadow: '0 4px 15px rgba(0, 163, 255, 0.3)',
                          transition: 'all 0.2s'
                        }}
                      >
                        🏦 RENDA FIXA
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowStockMarketModal(true); }}
                        style={{
                          flex: 1,
                          background: 'rgba(155, 93, 229, 0.15)',
                          border: '1px solid rgba(155, 93, 229, 0.4)',
                          color: '#E0AAFF',
                          padding: '12px',
                          borderRadius: '12px',
                          fontSize: '0.7rem',
                          fontWeight: 900,
                          cursor: 'pointer',
                          letterSpacing: '1px',
                          transition: 'all 0.2s'
                        }}
                      >
                        📈 BOLSA
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', marginBottom: '0.8rem' }}>
                  <p className="balance-title" style={{ margin: 0 }}>PROJEÇÃO DE RENDIMENTOS</p>
                  <button
                    onClick={() => setShowRealYield(!showRealYield)}
                    style={{
                      background: showRealYield ? 'rgba(0, 163, 255, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      border: showRealYield ? '1px solid #00A3FF' : '1px solid rgba(255, 255, 255, 0.1)',
                      color: showRealYield ? '#00A3FF' : '#aaa',
                      fontSize: '0.55rem',
                      fontWeight: 900,
                      padding: '4px 10px',
                      borderRadius: '50px',
                      cursor: 'pointer',
                      transition: 'all 0.3s'
                    }}
                  >
                    {showRealYield ? '📈 MOSTRANDO GANHO REAL (PÓS-INFLAÇÃO)' : '📉 MOSTRAR GANHO REAL (IPCA)'}
                  </button>
                </div>

                <div className="yield-grid-main">
                  {(() => {
                    const monthlyInf = (totalPatrimony * IPCA_ANUAL_MOCK) / 12;
                    const dailyInf = monthlyInf / 30;
                    const hYield = showRealYield ? Math.max(0, yields.hourlyYield - (dailyInf / 24)) : yields.hourlyYield;
                    const dYield = showRealYield ? Math.max(0, yields.dailyYield - dailyInf) : yields.dailyYield;
                    const wYield = showRealYield ? Math.max(0, yields.weeklyYield - (dailyInf * 7)) : yields.weeklyYield;
                    const mYield = showRealYield ? Math.max(0, yields.monthlyYield - monthlyInf) : yields.monthlyYield;

                    return (
                      <>
                        <div className="mini-stat"><span className="label">HORA</span><span className="val" style={{ color: showRealYield ? '#00A3FF' : '#00E676' }}>R$ {hYield.toFixed(2)}</span></div>
                        <div className="mini-stat"><span className="label">DIA</span><span className="val" style={{ color: showRealYield ? '#00A3FF' : '#00E676' }}>R$ {dYield.toFixed(2)}</span></div>
                        <div className="mini-stat"><span className="label">SEMANA</span><span className="val" style={{ color: showRealYield ? '#00A3FF' : '#00E676' }}>R$ {wYield.toFixed(2)}</span></div>
                        <div className="mini-stat"><span className="label">MÊS</span><span className="val" style={{ color: showRealYield ? '#00A3FF' : '#00E676' }}>R$ {mYield.toFixed(2)}</span></div>

                        <div style={{
                          gridColumn: 'span 4',
                          marginTop: '12px',
                          padding: '16px',
                          background: 'rgba(255, 255, 255, 0.03)',
                          borderRadius: '16px',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.75rem' }}>
                            <span style={{ color: '#aaa', fontWeight: 700 }}>📊 RENDA FIXA (MÊS)</span>
                            <span style={{ color: '#fff', fontWeight: 900 }}>R$ {yields.fixedMonthly.toFixed(2)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                            <span style={{ color: '#E0AAFF', fontWeight: 700 }}>💰 DIVIDENDOS (MÊS)</span>
                            <span style={{ color: '#E0AAFF', fontWeight: 900 }}>R$ {yields.stockMonthly.toFixed(2)}</span>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>


              </div >

              <div className="glass-panel machine-panel-full">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ fontSize: '0.7rem', color: '#00A3FF', margin: 0 }}>ATIVOS_CONECTADOS [{machines.length}]</h3>
                    <button
                      className="icon-btn-small"
                      style={{ width: '24px', height: '24px', fontSize: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onClick={() => setShowHistoryModal(true)}
                      title="Histórico de Rendimentos"
                    >
                      <RefreshCw size={12} />
                    </button>

                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 215, 0, 0.1)', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255, 215, 0, 0.2)' }}>
                    <span style={{ fontSize: '0.5rem', color: '#FFD700', opacity: 0.6, fontWeight: 800 }}>PRÓXIMO_PAGAMENTO</span>
                    <YieldCountdown onCycleEnd={() => machines.length > 0 && processYieldCycle()} variant="minimal" />
                  </div>
                </div>
                <div className="machine-list">
                  {machines.map((m, i) => (
                    <MachineCard
                      key={m.id || i}
                      m={m}
                      i={i}
                      isBusinessDay={isBusinessDay}
                      currentDateDayOnly={currentDate.toDateString()}
                      equippedItems={equippedItems}
                      onEdit={handleEditMachine}
                      onAporte={handleAporteMachine}
                      onResgate={handleResgateMachine}
                    />
                  ))}

                </div>
              </div>

              {/* HISTÓRICO DE ATIVIDADES RECENTES */}
              <div className="glass-panel" style={{ marginTop: '1rem', padding: '1.2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '0.7rem', color: '#00A3FF', margin: 0 }}>HISTÓRICO_DE_ATIVIDADES</h3>
                  {/* FILTROS DE HISTÓRICO */}
                  <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '8px' }}>
                    <button
                      onClick={() => setHistoryFilter('all')}
                      style={{
                        background: historyFilter === 'all' ? 'rgba(255,255,255,0.1)' : 'transparent',
                        color: historyFilter === 'all' ? '#fff' : '#aaa',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '0.5rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}>TODOS</button>
                    <button
                      onClick={() => setHistoryFilter('gains')}
                      style={{
                        background: historyFilter === 'gains' ? 'rgba(0, 230, 118, 0.1)' : 'transparent',
                        color: historyFilter === 'gains' ? '#00E676' : '#aaa',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '0.5rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}>GANHOS</button>
                    <button
                      onClick={() => setHistoryFilter('expenses')}
                      style={{
                        background: historyFilter === 'expenses' ? 'rgba(255, 77, 77, 0.1)' : 'transparent',
                        color: historyFilter === 'expenses' ? '#FF4D4D' : '#aaa',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '0.5rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}>GASTOS</button>
                    <button
                      onClick={() => setHistoryFilter('investments')}
                      style={{
                        background: historyFilter === 'investments' ? 'rgba(0, 163, 255, 0.1)' : 'transparent',
                        color: historyFilter === 'investments' ? '#00A3FF' : '#aaa',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '0.5rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}>INVEST.</button>
                  </div>
                </div>

                <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'scroll', paddingRight: '4px' }}>
                  {activities.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                      <p style={{ fontSize: '0.65rem', opacity: 0.5, margin: 0, fontWeight: 700 }}>NENHUMA ATIVIDADE REGISTRADA AINDA.</p>
                    </div>
                  ) : (
                    filteredActivities.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '20px', color: '#aaa', fontSize: '0.6rem' }}>Nenhuma atividade encontrada neste filtro.</div>
                    ) : filteredActivities.map((act) => (


                      <div key={act.id} style={{
                        background: 'rgba(255,255,255,0.03)',
                        padding: '10px 12px',
                        borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        animation: 'fadeIn 0.3s ease-out'
                      }}>
                        <div style={{ fontSize: '1.2rem', width: '30px', textAlign: 'center' }}>{act.icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 900, color: '#fff', letterSpacing: '0.5px' }}>{act.label}</span>
                            <span style={{ fontSize: '0.5rem', opacity: 0.4, fontWeight: 800 }}>
                              {new Date(act.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '2px', gap: '8px' }}>
                            <div style={{ fontSize: '0.6rem', opacity: 0.6, fontWeight: 700, flex: 1, marginTop: '2px' }}>{act.details}</div>

                            {/* LÓGICA DE EXIBIÇÃO DE VALORES (CÂMBIO OU SIMPLES) */}
                            {(act.amountRemoved || act.amountAdded) ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                {act.amountRemoved && (
                                  <div style={{ fontSize: '0.6rem', color: '#FF4D4D', fontWeight: 900, fontFamily: 'JetBrains Mono' }}>
                                    - {act.currency === 'USD' ? '$' : act.currency === 'JPY' ? '¥' : 'R$'} {act.amountRemoved.toLocaleString('pt-BR', { minimumFractionDigits: act.currency === 'JPY' ? 0 : 2, maximumFractionDigits: 2 })}
                                  </div>
                                )}
                                {act.amountAdded && (
                                  <div style={{ fontSize: '0.6rem', color: '#00E676', fontWeight: 900, fontFamily: 'JetBrains Mono' }}>
                                    + {act.target === 'USD' ? '$' : act.target === 'JPY' ? '¥' : 'R$'} {act.amountAdded.toLocaleString('pt-BR', { minimumFractionDigits: act.target === 'JPY' ? 0 : 2, maximumFractionDigits: 2 })}
                                  </div>
                                )}
                              </div>
                            ) : (
                              act.amount && (
                                <div style={{
                                  fontSize: '0.65rem',
                                  fontWeight: 900,
                                  color: (() => {
                                    // GANHOS REAIS (Entrada de dinheiro)
                                    if (['deposit', 'impulse', 'dividend'].includes(act.type)) return '#00E676';
                                    // GASTOS / SAÍDAS (Perda de dinheiro)
                                    if (['transfer', 'pay_debt', 'reset_balance'].includes(act.type)) return '#FF4D4D';
                                    // MOVIMENTAÇÕES (Alocação/Desalocação - Saldo <-> Investimento)
                                    return '#00A3FF';
                                  })(),
                                  fontFamily: 'JetBrains Mono',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {(() => {
                                    if (['deposit', 'impulse', 'dividend'].includes(act.type)) return '+';
                                    if (['transfer', 'pay_debt', 'reset_balance'].includes(act.type)) return '-';
                                    if (['create_machine', 'contribution'].includes(act.type)) return '➡️'; // Indo para investimento
                                    if (['resgate', 'partial_resgate', 'stock_sale'].includes(act.type)) return '⬅️'; // Voltando para saldo
                                    return '';
                                  })()} R$ {act.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              )
                            )}
                          </div>

                        </div>
                      </div>
                    ))

                  )}
                </div>
              </div>

              {
                showConfirmResgate && (
                  <div className="modal-overlay" onClick={() => setShowConfirmResgate(null)}>
                    <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', padding: '0', overflow: 'hidden', borderRadius: '24px', border: 'none', position: 'relative' }}>
                      <button onClick={() => setShowConfirmResgate(null)} style={{ position: 'absolute', right: '15px', top: '15px', background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer', zIndex: 10 }}>✖</button>
                      <div style={{ background: (showConfirmResgate?.investment_type === 'ACAO' || showConfirmResgate?.investment_type === 'FII') ? 'linear-gradient(135deg, #9B5DE5 0%, #7B2CBF 100%)' : 'linear-gradient(135deg, #FF4D4D 0%, #D32F2F 100%)', padding: '1.5rem', textAlign: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '0.9rem', letterSpacing: '2px', fontWeight: 900, color: '#fff' }}>{(showConfirmResgate?.investment_type === 'ACAO' || showConfirmResgate?.investment_type === 'FII') ? 'ORDEM_DE_VENDA' : 'RESGATE_DE_CAPITAL'}</h3>
                        <p style={{ margin: '5px 0 0 0', fontSize: '0.65rem', opacity: 0.8, color: '#fff', fontWeight: 700 }}>{showConfirmResgate?.nome.toUpperCase()}</p>
                      </div>

                      <div style={{ padding: '1.5rem' }}>
                        <div className="input-group">
                          <label htmlFor="resgate-input" style={{ fontSize: '0.55rem', color: (showConfirmResgate?.investment_type === 'ACAO' || showConfirmResgate?.investment_type === 'FII') ? '#9B5DE5' : '#FF4D4D', fontWeight: 900, marginBottom: '8px', display: 'block', letterSpacing: '1px' }}>
                            {(showConfirmResgate?.investment_type === 'ACAO' || showConfirmResgate?.investment_type === 'FII') ? 'QUANTIDADE PARA VENDA' : 'VALOR PARA RESGATE (R$)'}
                          </label>
                          <div style={{ position: 'relative' }}>
                            <input
                              id="resgate-input"
                              title={(showConfirmResgate?.investment_type === 'ACAO' || showConfirmResgate?.investment_type === 'FII') ? "Quantidade de Cotas" : "Valor do Resgate"}
                              autoFocus
                              type="number"
                              step={(showConfirmResgate?.investment_type === 'ACAO' || showConfirmResgate?.investment_type === 'FII') ? "1" : "0.01"}
                              placeholder={(showConfirmResgate?.investment_type === 'ACAO' || showConfirmResgate?.investment_type === 'FII') ? showConfirmResgate.stock_quantity.toString() : showConfirmResgate.valor.toFixed(2)}
                              value={(showConfirmResgate?.investment_type === 'ACAO' || showConfirmResgate?.investment_type === 'FII') ? resgateQuantity : resgateValue}
                              onChange={e => {
                                const val = e.target.value;
                                if (showConfirmResgate?.investment_type === 'ACAO' || showConfirmResgate?.investment_type === 'FII') {
                                  setResgateQuantity(val ? Math.floor(parseFloat(val)).toString() : '');
                                } else {
                                  setResgateValue(val);
                                }
                              }}
                              style={{ background: 'rgba(255,255,255,0.05)', border: (showConfirmResgate?.investment_type === 'ACAO' || showConfirmResgate?.investment_type === 'FII') ? '1px solid rgba(155, 93, 229, 0.4)' : '1px solid rgba(255, 77, 77, 0.2)', color: '#fff', padding: '15px', borderRadius: '14px', width: '100%', fontSize: '1.3rem', fontWeight: 800, outline: 'none' }}
                            />
                            <button
                              onClick={() => (showConfirmResgate?.investment_type === 'ACAO' || showConfirmResgate?.investment_type === 'FII') ? setResgateQuantity(showConfirmResgate.stock_quantity.toString()) : setResgateValue(showConfirmResgate.valor.toString())}
                              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: (showConfirmResgate?.investment_type === 'ACAO' || showConfirmResgate?.investment_type === 'FII') ? 'rgba(155, 93, 229, 0.2)' : 'rgba(255, 77, 77, 0.2)', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '6px', fontSize: '0.55rem', fontWeight: 900, cursor: 'pointer' }}
                            >
                              TUDO
                            </button>
                          </div>
                        </div>

                        <div style={{ marginTop: '1.2rem', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', fontSize: '0.6rem', opacity: 0.6, textAlign: 'center' }}>
                          {(showConfirmResgate?.investment_type === 'ACAO' || showConfirmResgate?.investment_type === 'FII') ? (
                            <>
                              Total em carteira: <span style={{ color: '#fff', fontWeight: 800 }}>{showConfirmResgate.stock_quantity} cotas</span>
                              {resgateQuantity && !isNaN(parseFloat(resgateQuantity)) && (
                                <div style={{ marginTop: '5px', color: '#9B5DE5', fontWeight: 900, fontSize: '0.7rem' }}>
                                  ESTIMATIVA DE VENDA: {formatBRLWithPrecision(parseFloat(resgateQuantity) * (showConfirmResgate.valor / showConfirmResgate.stock_quantity))}
                                </div>
                              )}
                            </>
                          ) : (
                            <>Saldo disponível para resgate: <span style={{ color: '#fff', fontWeight: 800 }}>{formatBRLWithPrecision(showConfirmResgate.valor)}</span></>
                          )}
                        </div>

                        {((resgateValue && !isNaN(parseFloat(resgateValue))) || (resgateQuantity && !isNaN(parseFloat(resgateQuantity)))) && (
                          <div style={{ marginTop: '1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                              {/* ATUAL */}
                              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ fontSize: '0.45rem', color: '#aaa', fontWeight: 900, marginBottom: '8px', letterSpacing: '1px' }}>RENDIMENTO ATUAL</div>
                                {(() => {
                                  const current = calculateProjection(showConfirmResgate?.valor || 0, '0', showConfirmResgate?.cdi_quota || 0, cdiAnual, showConfirmResgate?.created_at, currentDate, showConfirmResgate?.investment_type, showConfirmResgate?.yield_mode);
                                  return (
                                    <>
                                      <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#fff' }}>R$ {current.day.toFixed(2)}<span style={{ fontSize: '0.6rem', opacity: 0.5 }}>/dia</span></div>
                                      <div style={{ fontSize: '0.65rem', opacity: 0.4, fontWeight: 700, marginTop: '2px' }}>R$ {current.week.toFixed(2)}/sem</div>
                                    </>
                                  );
                                })()}
                              </div>

                              {/* PÓS-RESGATE */}
                              <div style={{ background: (showConfirmResgate?.investment_type === 'ACAO' || showConfirmResgate?.investment_type === 'FII') ? 'rgba(155, 93, 229, 0.05)' : 'rgba(255, 77, 77, 0.05)', padding: '12px', borderRadius: '16px', border: (showConfirmResgate?.investment_type === 'ACAO' || showConfirmResgate?.investment_type === 'FII') ? '1px solid rgba(155, 93, 229, 0.2)' : '1px solid rgba(255, 77, 77, 0.2)' }}>
                                <div style={{ fontSize: '0.45rem', color: (showConfirmResgate?.investment_type === 'ACAO' || showConfirmResgate?.investment_type === 'FII') ? '#9B5DE5' : '#FF4D4D', fontWeight: 900, marginBottom: '8px', letterSpacing: '1px' }}>{(showConfirmResgate?.investment_type === 'ACAO' || showConfirmResgate?.investment_type === 'FII') ? 'PROJEÇÃO PÓS-VENDA' : 'PROJEÇÃO PÓS-RESGATE'}</div>
                                {(() => {
                                  const isStock = showConfirmResgate?.investment_type === 'ACAO' || showConfirmResgate?.investment_type === 'FII';
                                  const valToMinus = isStock
                                    ? ((parseFloat(resgateQuantity) || 0) * (showConfirmResgate.valor / (showConfirmResgate.stock_quantity || 1)))
                                    : (parseFloat(resgateValue) || 0);

                                  const next = calculateProjection(showConfirmResgate?.valor || 0, `-${valToMinus}`, showConfirmResgate?.cdi_quota || 0, cdiAnual, showConfirmResgate?.created_at, currentDate, showConfirmResgate?.investment_type, showConfirmResgate?.yield_mode);
                                  return (
                                    <>
                                      <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#FF4D4D' }}>R$ {next.day.toFixed(2)}<span style={{ fontSize: '0.6rem', opacity: 0.7 }}>/dia</span></div>
                                      <div style={{ fontSize: '0.65rem', color: '#FF4D4D', opacity: 0.6, fontWeight: 700, marginTop: '2px' }}>R$ {next.week.toFixed(2)}/sem</div>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>

                            <div style={{ marginTop: '12px', textAlign: 'center' }}>
                              <span style={{ fontSize: '0.55rem', color: '#FF4D4D', fontWeight: 900, background: 'rgba(255,77,77,0.1)', padding: '6px 14px', borderRadius: '20px', letterSpacing: '0.5px' }}>
                                {(() => {
                                  const isStock = showConfirmResgate?.investment_type === 'ACAO' || showConfirmResgate?.investment_type === 'FII';
                                  const valToMinus = isStock
                                    ? (parseFloat(resgateQuantity || '0') * (showConfirmResgate.valor / (showConfirmResgate.stock_quantity || 1)))
                                    : parseFloat(resgateValue || '0');
                                  const currentDay = calculateProjection(showConfirmResgate?.valor || 0, '0', showConfirmResgate?.cdi_quota || 0, cdiAnual, showConfirmResgate?.created_at, currentDate, showConfirmResgate?.investment_type, showConfirmResgate?.yield_mode).day;
                                  const nextDay = calculateProjection(showConfirmResgate?.valor || 0, `-${valToMinus}`, showConfirmResgate?.cdi_quota || 0, cdiAnual, showConfirmResgate?.created_at, currentDate, showConfirmResgate?.investment_type, showConfirmResgate?.yield_mode).day;
                                  const loss = ((1 - (nextDay / (currentDay || 0.00000001))) * 100).toFixed(1);
                                  return `📉 -${loss}% DE PERDA NO RENDIMENTO`;
                                })()}
                              </span>
                            </div>

                            <div style={{ marginTop: '15px', padding: '12px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ fontSize: '0.55rem', fontWeight: 800, opacity: 0.6 }}>IMPOSTO DE RENDA (IR):</span>
                                <span style={{ fontSize: '0.55rem', fontWeight: 900, color: '#fff' }}>{getTaxMultipliers(showConfirmResgate?.created_at, false, currentDate, showConfirmResgate?.investment_type).irRateLabel}</span>
                              </div>
                              {getTaxMultipliers(showConfirmResgate?.created_at, false, currentDate, showConfirmResgate?.investment_type).iofApplied && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                  <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#FFB300' }}>MULTA IOF ATIVA:</span>
                                  <span style={{ fontSize: '0.55rem', fontWeight: 900, color: '#FFB300' }}>-{((1 - getTaxMultipliers(showConfirmResgate?.created_at, false, currentDate, showConfirmResgate?.investment_type).iofFactor) * 100).toFixed(0)}% DO LUCRO</span>
                                </div>
                              )}
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                {(() => {
                                  const isStock = showConfirmResgate?.investment_type === 'ACAO' || showConfirmResgate?.investment_type === 'FII';
                                  const valToMinus = isStock
                                    ? (parseFloat(resgateQuantity) * (showConfirmResgate.valor / (showConfirmResgate.stock_quantity || 1)))
                                    : parseFloat(resgateValue);
                                  const remaining = showConfirmResgate.valor - (valToMinus || 0);

                                  return (
                                    <>
                                      <span style={{ fontSize: '0.55rem', fontWeight: 800, opacity: 0.6 }}>REMANESCENTE NO ATIVO:</span>
                                      <span style={{ fontSize: '0.55rem', fontWeight: 900, color: remaining >= 1 ? '#00E676' : '#FF4D4D' }}>
                                        {formatBRLWithPrecision(Math.max(0, remaining))}
                                      </span>
                                    </>
                                  );
                                })()}
                              </div>
                              {(() => {
                                const isStock = showConfirmResgate?.investment_type === 'ACAO' || showConfirmResgate?.investment_type === 'FII';
                                const valToMinus = isStock
                                  ? (parseFloat(resgateQuantity) * (showConfirmResgate.valor / (showConfirmResgate.stock_quantity || 1)))
                                  : parseFloat(resgateValue);
                                const remaining = showConfirmResgate.valor - (valToMinus || 0);

                                if (!isStock && remaining < 1 && Math.abs(remaining) > 0.001) {
                                  return <div style={{ fontSize: '0.5rem', color: '#FF4D4D', fontWeight: 800, marginTop: '6px', textAlign: 'center' }}>⚠️ MÍNIMO DE R$ 1,00 PARA MANTER O ATIVO.</div>;
                                }
                                return null;
                              })()}
                            </div>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px', marginTop: '1.5rem' }}>
                          <button className="action-btn" style={{ flex: 1, padding: '15px', borderRadius: '14px', fontSize: '0.7rem', fontWeight: 800 }} onClick={() => setShowConfirmResgate(null)}>CANCELAR</button>
                          <button
                            className="primary-btn"
                            style={{
                              flex: 1.5,
                              background: (showConfirmResgate?.investment_type === 'ACAO' || showConfirmResgate?.investment_type === 'FII') ? '#9B5DE5' : '#FF4D4D',
                              color: '#fff',
                              padding: '15px',
                              borderRadius: '14px',
                              fontSize: '0.7rem',
                              fontWeight: 900,
                              cursor: 'pointer',
                              boxShadow: (showConfirmResgate?.investment_type === 'ACAO' || showConfirmResgate?.investment_type === 'FII') ? '0 10px 20px rgba(155, 93, 229, 0.2)' : '0 10px 20px rgba(255, 77, 77, 0.2)'
                            }}
                            onClick={handleResgate}
                          >
                            {(showConfirmResgate?.investment_type === 'ACAO' || showConfirmResgate?.investment_type === 'FII') ? 'CONFIRMAR VENDA' : 'CONFIRMAR RESGATE'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              }

              {
                showAporteModal && (
                  <div className="modal-overlay" onClick={() => setShowAporteModal(false)}>
                    <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', padding: '0', overflow: 'hidden', borderRadius: '24px', border: 'none', position: 'relative' }}>
                      <button onClick={() => setShowAporteModal(false)} style={{ position: 'absolute', right: '15px', top: '15px', background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer', zIndex: 10 }}><X size={20} /></button>
                      <div style={{ background: 'linear-gradient(135deg, #00A3FF 0%, #0066FF 100%)', padding: '1.5rem', textAlign: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '0.9rem', letterSpacing: '2px', fontWeight: 900, color: '#fff' }}>APORTE_ESTRATÉGICO</h3>
                        <p style={{ margin: '5px 0 0 0', fontSize: '0.65rem', opacity: 0.8, color: '#fff', fontWeight: 700 }}>{selectedMachine?.nome.toUpperCase()}</p>
                      </div>

                      <div style={{ padding: '1.5rem' }}>
                        <div className="input-group">
                          <label htmlFor="aporte-input" style={{ fontSize: '0.55rem', color: (selectedMachine?.investment_type === 'ACAO' || selectedMachine?.investment_type === 'FII') ? '#9B5DE5' : '#00A3FF', fontWeight: 900, marginBottom: '8px', display: 'block', letterSpacing: '1px' }}>
                            {(selectedMachine?.investment_type === 'ACAO' || selectedMachine?.investment_type === 'FII') ? 'QUANTIDADE DE COTAS PARA COMPRAR' : 'VALOR DO INVESTIMENTO ADICIONAL (R$)'}
                          </label>
                          <div style={{ position: 'relative' }}>
                            <input
                              id="aporte-input"
                              title={(selectedMachine?.investment_type === 'ACAO' || selectedMachine?.investment_type === 'FII') ? "Quantidade de Cotas" : "Valor do Aporte"}
                              autoFocus
                              type="number"
                              step={(selectedMachine?.investment_type === 'ACAO' || selectedMachine?.investment_type === 'FII') ? "1" : "0.01"}
                              placeholder="0,00"
                              value={(selectedMachine?.investment_type === 'ACAO' || selectedMachine?.investment_type === 'FII') ? aporteQuantity : aporteValue}
                              onChange={e => {
                                const val = e.target.value;
                                if (selectedMachine?.investment_type === 'ACAO' || selectedMachine?.investment_type === 'FII') {
                                  setAporteQuantity(val ? Math.floor(parseFloat(val)).toString() : '');
                                } else {
                                  setAporteValue(val);
                                }
                              }}
                              style={{ background: 'rgba(255,255,255,0.05)', border: (selectedMachine?.investment_type === 'ACAO' || selectedMachine?.investment_type === 'FII') ? '1px solid rgba(155, 93, 229, 0.4)' : '1px solid rgba(0,163,255,0.2)', color: '#fff', padding: '15px', borderRadius: '14px', width: '100%', fontSize: '1.3rem', fontWeight: 800, outline: 'none' }}
                            />
                          </div>
                          {(selectedMachine?.investment_type === 'ACAO' || selectedMachine?.investment_type === 'FII') && aporteQuantity && !isNaN(parseFloat(aporteQuantity)) && (
                            <div style={{ marginTop: '10px', fontSize: '0.7rem', color: '#9B5DE5', fontWeight: 900, textAlign: 'center', background: 'rgba(155, 93, 229, 0.1)', padding: '8px', borderRadius: '10px' }}>
                              CUSTO ESTIMADO: {formatBRLWithPrecision(parseFloat(aporteQuantity) * (selectedMachine.valor / (selectedMachine.stock_quantity || 1)))}
                            </div>
                          )}
                        </div>

                        <div style={{ marginTop: '1.5rem' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            {/* ATUAL */}
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                              <div style={{ fontSize: '0.45rem', color: '#aaa', fontWeight: 900, marginBottom: '8px', letterSpacing: '1px' }}>RENDIMENTO ATUAL</div>
                              {(() => {
                                const current = calculateProjection(selectedMachine?.valor || 0, '0', selectedMachine?.cdi_quota || 0, cdiAnual, selectedMachine?.created_at, currentDate, selectedMachine?.investment_type, selectedMachine?.yield_mode);
                                return (
                                  <>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#fff' }}>R$ {current.day.toFixed(2)}<span style={{ fontSize: '0.6rem', opacity: 0.5 }}>/dia</span></div>
                                    <div style={{ fontSize: '0.65rem', opacity: 0.4, fontWeight: 700, marginTop: '2px' }}>R$ {current.week.toFixed(2)}/semana</div>
                                    <div style={{ fontSize: '0.65rem', opacity: 0.4, fontWeight: 700, marginTop: '2px' }}>R$ {current.month.toFixed(2)}/mês</div>
                                  </>
                                );
                              })()}
                            </div>

                            {/* ESTIMADO (DEPOIS) */}
                            <div style={{ background: 'rgba(0, 230, 118, 0.05)', padding: '12px', borderRadius: '16px', border: '1px solid rgba(0, 230, 118, 0.2)' }}>
                              <div style={{ fontSize: '0.45rem', color: '#00E676', fontWeight: 900, marginBottom: '8px', letterSpacing: '1px' }}>PROJEÇÃO PÓS-APORTE</div>
                              {(() => {
                                const isStock = selectedMachine?.investment_type === 'ACAO' || selectedMachine?.investment_type === 'FII';
                                const valToAdd = isStock
                                  ? ((parseFloat(aporteQuantity) || 0) * (selectedMachine.valor / (selectedMachine.stock_quantity || 1)))
                                  : (parseFloat(aporteValue) || 0);

                                const next = calculateProjection(selectedMachine?.valor || 0, valToAdd.toString(), selectedMachine?.cdi_quota || 0, cdiAnual, selectedMachine?.created_at, currentDate, selectedMachine?.investment_type, selectedMachine?.yield_mode);
                                return (
                                  <>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#00E676' }}>R$ {next.day.toFixed(2)}<span style={{ fontSize: '0.6rem', opacity: 0.7 }}>/dia</span></div>
                                    <div style={{ fontSize: '0.65rem', color: '#00E676', opacity: 0.6, fontWeight: 700, marginTop: '2px' }}>R$ {next.week.toFixed(2)}/semana</div>
                                    <div style={{ fontSize: '0.65rem', color: '#00E676', opacity: 0.6, fontWeight: 700, marginTop: '2px' }}>R$ {next.month.toFixed(2)}/mês</div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>

                          {((aporteValue && !isNaN(parseFloat(aporteValue))) || (aporteQuantity && !isNaN(parseFloat(aporteQuantity)))) && (
                            <div style={{ marginTop: '18px', textAlign: 'center', animation: 'fadeIn 0.3s ease-out' }}>
                              <span style={{ fontSize: '0.55rem', color: '#00E676', fontWeight: 900, background: 'rgba(0,230,118,0.1)', padding: '6px 14px', borderRadius: '20px', letterSpacing: '0.5px' }}>
                                {(() => {
                                  const isStock = selectedMachine?.investment_type === 'ACAO' || selectedMachine?.investment_type === 'FII';
                                  const valToAdd = isStock
                                    ? ((parseFloat(aporteQuantity) || 0) * (selectedMachine.valor / (selectedMachine.stock_quantity || 1)))
                                    : (parseFloat(aporteValue) || 0);
                                  const nextDay = calculateProjection(selectedMachine?.valor || 0, valToAdd.toString(), selectedMachine?.cdi_quota || 0, cdiAnual, selectedMachine?.created_at, currentDate, selectedMachine?.investment_type, selectedMachine?.yield_mode).day;
                                  const currentDay = calculateProjection(selectedMachine?.valor || 0, '0', selectedMachine?.cdi_quota || 0, cdiAnual, selectedMachine?.created_at, currentDate, selectedMachine?.investment_type, selectedMachine?.yield_mode).day;
                                  const increase = ((nextDay / (currentDay || 0.00000001) - 1) * 100).toFixed(1);
                                  return `🚀 +${increase}% DE AUMENTO NO LUCRO LÍQUIDO`;
                                })()}
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

              <AnimatePresence>
                {showStairwayChart && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="modal-overlay"
                    style={{ zIndex: 6000 }}
                    onClick={() => setShowStairwayChart(false)}
                  >
                    <motion.div
                      initial={{ scale: 0.9, y: 20, opacity: 0 }}
                      animate={{ scale: 1, y: 0, opacity: 1 }}
                      exit={{ scale: 0.9, y: 20, opacity: 0 }}
                      className="glass-panel modal-content"
                      onClick={e => e.stopPropagation()}
                      style={{
                        maxWidth: '850px',
                        width: '98%',
                        maxHeight: '92vh',
                        overflowX: 'hidden',
                        overflowY: 'auto',
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '15px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <TrendingUp size={24} color="#00E676" />
                          <div>
                            <h3 style={{ margin: 0, color: '#00E676', letterSpacing: '1px', fontSize: '1rem' }}>PLANEJADOR DE RIQUEZA PRO</h3>
                            <span style={{ fontSize: '0.55rem', opacity: 0.5, fontWeight: 900 }}>SIMULAÇÃO DE LONGO PRAZO AUTOMATIZADA</span>
                          </div>
                        </div>
                        <button title="Fechar Planejador" onClick={() => setShowStairwayChart(false)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
                      </div>

                      {/* PAINEL DE CONTROLES VERTICAL */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '15px',
                        background: 'rgba(0,0,0,0.2)',
                        padding: '20px',
                        borderRadius: '16px',
                        border: '1px solid rgba(255,255,255,0.05)'
                      }}>
                        <div>
                          <label htmlFor="sim-initial" style={{ fontSize: '0.55rem', color: '#00A3FF', fontWeight: 900, marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '1px' }}>Investimento Inicial (R$)</label>
                          <input
                            id="sim-initial"
                            type="number"
                            placeholder="0,00"
                            value={simInitial === 0 ? '' : simInitial}
                            onChange={e => setSimInitial(parseFloat(e.target.value) || 0)}
                            style={{
                              width: '100%',
                              padding: '14px',
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '12px',
                              color: '#fff',
                              fontSize: '1rem',
                              fontWeight: 700,
                              outline: 'none'
                            }}
                          />
                        </div>
                        <div>
                          <label htmlFor="sim-monthly" style={{ fontSize: '0.55rem', color: '#00E676', fontWeight: 900, marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '1px' }}>Aporte Mensal (R$)</label>
                          <input
                            id="sim-monthly"
                            type="number"
                            placeholder="0,00"
                            value={simMonthly === 0 ? '' : simMonthly}
                            onChange={e => setSimMonthly(parseFloat(e.target.value) || 0)}
                            style={{
                              width: '100%',
                              padding: '14px',
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '12px',
                              color: '#fff',
                              fontSize: '1rem',
                              fontWeight: 700,
                              outline: 'none'
                            }}
                          />
                        </div>
                        <div>
                          <label htmlFor="sim-rate" style={{ fontSize: '0.55rem', color: '#FFD700', fontWeight: 900, marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '1px' }}>Taxa Anual (%)</label>
                          <input
                            id="sim-rate"
                            type="number"
                            placeholder="Ex: 12.5"
                            value={simRate === 0 ? '' : simRate}
                            onChange={e => setSimRate(parseFloat(e.target.value) || 0)}
                            style={{
                              width: '100%',
                              padding: '14px',
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '12px',
                              color: '#fff',
                              fontSize: '1rem',
                              fontWeight: 700,
                              outline: 'none'
                            }}
                          />
                        </div>
                        <div>
                          <label htmlFor="sim-years" style={{ fontSize: '0.55rem', color: '#9B5DE5', fontWeight: 900, marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '1px' }}>Tempo (Anos)</label>
                          <input
                            id="sim-years"
                            type="number"
                            placeholder="1"
                            value={simYears === 0 ? '' : simYears}
                            onChange={e => {
                              const val = parseInt(e.target.value);
                              setSimYears(isNaN(val) ? 0 : Math.min(val, 50));
                            }}
                            style={{
                              width: '100%',
                              padding: '14px',
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '12px',
                              color: '#fff',
                              fontSize: '1rem',
                              fontWeight: 700,
                              outline: 'none'
                            }}
                          />
                        </div>
                      </div>

                      {(() => {
                        const { timeline, finalBalance, totalInvested: totalInvestedValue, months } = simTimeline;

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
                                <span style={{ fontSize: '0.5rem', color: '#aaa', display: 'block', fontWeight: 800 }}>INVESTIDO</span>
                                <strong style={{ fontSize: '1rem', color: '#fff' }}>{formatBRLWithPrecision(totalInvestedValue)}</strong>
                              </div>
                              <div style={{ background: 'rgba(255, 215, 0, 0.05)', padding: '12px', borderRadius: '12px', borderBottom: '2px solid #FFD700' }}>
                                <span style={{ fontSize: '0.5rem', color: '#FFD700', display: 'block', fontWeight: 800 }}>LUCRO ESTIMADO</span>
                                <strong style={{ fontSize: '1rem', color: '#FFD700' }}>+{formatBRLWithPrecision(finalBalance - totalInvestedValue)}</strong>
                              </div>
                              <div style={{ background: 'rgba(0, 230, 118, 0.05)', padding: '12px', borderRadius: '12px', borderBottom: '2px solid #00E676' }}>
                                <span style={{ fontSize: '0.5rem', color: '#00E676', display: 'block', fontWeight: 800 }}>TOTAL BRUTO</span>
                                <strong style={{ fontSize: '1.2rem', color: '#00E676' }}>{formatBRLWithPrecision(finalBalance)}</strong>
                              </div>
                            </div>

                            {/* GRÁFICO DE CRESCIMENTO (AREA STYLE) */}
                            <div style={{ width: '100%', height: '180px', minHeight: '180px', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', padding: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={timeline.filter((_, idx) => months > 36 ? idx % Math.ceil(months / 36) === 0 : true)}>
                                  <defs>
                                    <linearGradient id="simGradient" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#00E676" stopOpacity={0.3} />
                                      <stop offset="95%" stopColor="#00E676" stopOpacity={0} />
                                    </linearGradient>
                                  </defs>
                                  <Tooltip
                                    contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', fontSize: '0.7rem' }}
                                    labelFormatter={(m: any) => `Mês ${m} `}
                                    formatter={(v: any) => formatBRLWithPrecision(v)}
                                  />
                                  <Area type="monotone" dataKey="balance" stroke="#00E676" strokeWidth={3} fill="url(#simGradient)" name="Patrimônio" animationDuration={1000} />
                                  <Area type="monotone" dataKey="totalInvested" stroke="rgba(255,255,255,0.4)" strokeDasharray="4 4" fill="none" name="Investimento" />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>

                            <div style={{
                              background: 'rgba(0,0,0,0.4)',
                              borderRadius: '16px',
                              border: '1px solid rgba(255,255,255,0.08)',
                              display: 'flex',
                              flexDirection: 'column'
                            }}>
                              <div style={{ padding: '12px 20px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#00A3FF' }}>FLUXO DE CAIXA MENSAL</span>
                                <span style={{ fontSize: '0.55rem', opacity: 0.5 }}>{months} períodos</span>
                              </div>

                              <div className="custom-scrollbar" style={{ padding: '0' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                  <thead style={{ position: 'sticky', top: 0, background: '#121212', zIndex: 10, boxShadow: '0 2px 5px rgba(0,0,0,0.5)' }}>
                                    <tr>
                                      <th style={{ textAlign: 'left', padding: '8px 4px', fontSize: '0.55rem', color: '#aaa' }}>TEMPO</th>
                                      <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: '0.55rem', color: '#aaa' }}>JUROS/MÊS</th>
                                      <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: '0.55rem', color: '#aaa' }}>REND. ACUM.</th>
                                      <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: '0.55rem', color: '#aaa' }}>TOTAL</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {timeline.map((row, idx) => {
                                      if (idx === 0) return null;
                                      const isYear = row.month % 12 === 0;
                                      const prevBalance = timeline[idx - 1]?.balance || 0;
                                      const monthInt = row.balance - prevBalance - (simMonthly || 0);

                                      return (
                                        <tr key={idx} style={{
                                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                                          background: isYear ? 'rgba(0, 230, 118, 0.08)' : 'transparent'
                                        }}>
                                          <td style={{ padding: '8px 4px', fontSize: '0.6rem', fontWeight: isYear ? 900 : 500, color: isYear ? '#00E676' : '#fff' }}>
                                            {isYear ? `ANO ${row.month / 12} ` : `Mês ${row.month} `}
                                          </td>
                                          <td style={{ padding: '8px 4px', textAlign: 'right', fontSize: '0.6rem', color: '#00E676', whiteSpace: 'nowrap' }}>
                                            {formatBRLWithPrecision(monthInt)}
                                          </td>
                                          <td style={{ padding: '8px 4px', textAlign: 'right', fontSize: '0.6rem', color: '#FFD700', whiteSpace: 'nowrap' }}>
                                            {formatBRLWithPrecision(row.interest)}
                                          </td>
                                          <td style={{ padding: '8px 4px', textAlign: 'right', fontSize: '0.65rem', fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>
                                            {formatBRLWithPrecision(row.balance)}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {showCreateModal && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="modal-overlay"
                    style={{ zIndex: 10000 }}
                    onClick={() => setShowCreateModal(false)}
                  >
                    <motion.div
                      initial={{ scale: 0.9, y: 20, opacity: 0 }}
                      animate={{ scale: 1, y: 0, opacity: 1 }}
                      exit={{ scale: 0.9, y: 20, opacity: 0 }}
                      className="glass-panel modal-content"
                      onClick={e => e.stopPropagation()}
                      style={{ maxWidth: '420px', width: '95%', padding: '0', overflow: 'hidden', border: 'none', borderRadius: '24px', position: 'relative' }}
                    >
                      <button title="Fechar Criação" onClick={() => setShowCreateModal(false)} style={{ position: 'absolute', right: '15px', top: '15px', background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer', zIndex: 10 }}><X size={20} /></button>
                      <div style={{ background: '#1A1A1A', padding: '1.5rem', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', letterSpacing: '1px', color: '#fff' }}>NOVA CAIXINHA</h3>
                        <p style={{ margin: '5px 0 0 0', fontSize: '0.65rem', opacity: 0.6 }}>Escolha uma estratégia para seu dinheiro</p>
                      </div>

                      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '8px 0' }}></div>

                        {/* SELECTOR: TIPO DE ATIVO */}
                        <div>
                          <label style={{ fontSize: '0.55rem', color: '#00A3FF', fontWeight: 800, marginBottom: '8px', display: 'block' }}>TIPO DE INVESTIMENTO</label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px' }}>
                            {['CDB', 'IPCA', 'LCI', 'LCA'].map(t => (
                              <div
                                key={t}
                                onClick={() => setNewMachineType(t as any)}
                                style={{
                                  padding: '10px 5px',
                                  textAlign: 'center',
                                  borderRadius: '8px',
                                  fontSize: '0.7rem',
                                  fontWeight: 900,
                                  cursor: 'pointer',
                                  background: newMachineType === t ? '#00A3FF' : 'rgba(255,255,255,0.05)',
                                  color: newMachineType === t ? '#000' : '#fff',
                                  transition: 'all 0.2s'
                                }}
                              >
                                {t}{t === 'IPCA' ? '+' : ''}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* SELECTOR: MODO DE RENDIMENTO */}
                        <div>
                          <label style={{ fontSize: '0.55rem', color: '#00A3FF', fontWeight: 800, marginBottom: '8px', display: 'block' }}>RENTABILIDADE</label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                            {[
                              { id: 'POS', label: 'PÓS-FIXADO (CDI)' },
                              { id: 'PRE', label: 'PRÉ-FIXADO (%)' }
                            ].map(m => (
                              <div
                                key={m.id}
                                onClick={() => setNewMachineYieldMode(m.id as any)}
                                style={{
                                  padding: '10px',
                                  textAlign: 'center',
                                  borderRadius: '8px',
                                  fontSize: '0.65rem',
                                  fontWeight: 900,
                                  cursor: 'pointer',
                                  background: newMachineYieldMode === m.id ? '#00E676' : 'rgba(255,255,255,0.05)',
                                  color: newMachineYieldMode === m.id ? '#000' : '#fff',
                                  transition: 'all 0.2s'
                                }}
                              >
                                {m.label}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '8px 0' }}></div>

                        {/* MANUAL INPUTS */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                          <div>
                            <label htmlFor="new-cdi" style={{ fontSize: '0.5rem', color: '#aaa', fontWeight: 800, marginBottom: '4px', display: 'block' }}>CDI (%)</label>
                            <input id="new-cdi" title="Porcentagem do CDI" type="number" value={newMachineCDI} onChange={e => setNewMachineCDI(e.target.value)}
                              style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.8rem', fontWeight: 700 }} />
                          </div>
                          <div>
                            <label htmlFor="new-date" style={{ fontSize: '0.5rem', color: '#aaa', fontWeight: 800, marginBottom: '4px', display: 'block' }}>VENCIMENTO</label>
                            <input id="new-date" title="Data de Vencimento" type="date" value={newMachineDate} onChange={e => setNewMachineDate(e.target.value)}
                              style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.8rem', fontWeight: 700 }} />
                          </div>
                          <div>
                            <label htmlFor="new-limit" style={{ fontSize: '0.5rem', color: '#aaa', fontWeight: 800, marginBottom: '4px', display: 'block' }}>META (R$)</label>
                            <input id="new-limit" title="Meta Financeira" type="number" placeholder="∞" value={newMachineLimit} onChange={e => setNewMachineLimit(e.target.value)}
                              style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.8rem', fontWeight: 700 }} />
                          </div>
                        </div>

                        <div style={{ marginBottom: '10px' }}>
                          <label style={{ fontSize: '0.55rem', color: '#00A3FF', fontWeight: 800, marginBottom: '6px', display: 'block' }}>DATA DE APLICAÇÃO (INÍCIO)</label>
                          <input aria-label="Data de Aplicação" type="date" value={newMachineCreatedAt} onChange={e => setNewMachineCreatedAt(e.target.value)}
                            style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.85rem' }} />
                          <div style={{ fontSize: '0.5rem', color: '#aaa', marginTop: '4px' }}>* Ajuste para evitar reset do IOF em ativos já existentes.</div>
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

                        <button title="Cancelar Criação" className="text-link" style={{ width: '100%', padding: '10px', background: 'none', border: 'none', color: '#fff', opacity: 0.4, cursor: 'pointer' }} onClick={() => setShowCreateModal(false)}>
                          CANCELAR
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {showEditModal && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="modal-overlay"
                    style={{ zIndex: 10000 }}
                    onClick={() => setShowEditModal(false)}
                  >
                    <motion.div
                      initial={{ scale: 0.9, y: 20, opacity: 0 }}
                      animate={{ scale: 1, y: 0, opacity: 1 }}
                      exit={{ scale: 0.9, y: 20, opacity: 0 }}
                      className="glass-panel modal-content"
                      onClick={e => e.stopPropagation()}
                      style={{ position: 'relative' }}
                    >
                      <button title="Fechar Edição" onClick={() => setShowEditModal(false)} style={{ position: 'absolute', right: '15px', top: '15px', background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer', zIndex: 10 }}><X size={20} /></button>
                      <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', fontWeight: 900, color: '#00A3FF' }}>
                        <Settings size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                        EDITAR {editingMachine?.investment_type === 'ACAO' || editingMachine?.investment_type === 'FII' ? 'ATIVO BOLSA' : 'ATIVO RENDA FIXA'}
                      </h3>
                      <div style={{ marginBottom: '10px' }}>
                        <label htmlFor="edit-mach-name" style={{ fontSize: '0.55rem', color: '#00A3FF', fontWeight: 800, display: 'block', marginBottom: '4px' }}>TICKER / NOME</label>
                        <input id="edit-mach-name" title="Nome do Ativo" placeholder="Nome do Ativo" value={editName} onChange={e => setEditName(e.target.value)} />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                        <div>
                          <label htmlFor="edit-mach-val" style={{ fontSize: '0.55rem', color: '#00A3FF', fontWeight: 800, display: 'block', marginBottom: '4px' }}>VALOR TOTAL (R$)</label>
                          <input id="edit-mach-val" title="Valor do Ativo" placeholder="Valor R$" type="number" value={editValue} onChange={e => setEditValue(e.target.value)} />
                        </div>
                        {(editingMachine?.investment_type === 'ACAO' || editingMachine?.investment_type === 'FII') && (
                          <div>
                            <label htmlFor="edit-mach-qty" style={{ fontSize: '0.55rem', color: '#00A3FF', fontWeight: 800, display: 'block', marginBottom: '4px' }}>QUANTIDADE (COTA)</label>
                            <input id="edit-mach-qty" title="Quantidade de Cotas" type="number" value={editQuantity} onChange={e => setEditQuantity(e.target.value)} />
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                        <div style={{ flex: 1 }}>
                          <label htmlFor="edit-mach-cdi" style={{ fontSize: '0.55rem', color: '#00A3FF', fontWeight: 800, display: 'block', marginBottom: '4px' }}>{editingMachine?.investment_type === 'ACAO' || editingMachine?.investment_type === 'FII' ? '% DY ANUAL' : '% DO CDI'}</label>
                          <input id="edit-mach-cdi" title="Rentabilidade" type="number" value={editCDI} onChange={e => setEditCDI(e.target.value)} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label htmlFor="edit-mach-date" style={{ fontSize: '0.55rem', color: '#00A3FF', fontWeight: 800, display: 'block', marginBottom: '4px' }}>VENCIMENTO</label>
                          <input id="edit-mach-date" title="Data de Vencimento" type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
                        </div>
                      </div>

                      {(editingMachine?.investment_type === 'ACAO' || editingMachine?.investment_type === 'FII') && (
                        <div style={{ marginBottom: '10px' }}>
                          <label htmlFor="edit-mach-freq" style={{ fontSize: '0.55rem', color: '#00A3FF', fontWeight: 800, display: 'block', marginBottom: '4px' }}>FREQUÊNCIA DE PAGAMENTO</label>
                          <select
                            id="edit-mach-freq"
                            title="Frequência de Pagamento"
                            value={editFrequency}
                            onChange={e => setEditFrequency(e.target.value as any)}
                            style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0, 163, 255, 0.3)', color: '#fff', padding: '10px', borderRadius: '8px', fontSize: '0.8rem' }}
                          >
                            <option value="daily">DIÁRIO (TESTE/SIMULAÇÃO)</option>
                            <option value="monthly">MENSAL (FIIs / ALGUMAS AÇÕES)</option>
                            <option value="quarterly">TRIMESTRAL</option>
                            <option value="semiannual">SEMESTRAL</option>
                            <option value="annual">ANUAL</option>
                          </select>
                        </div>
                      )}

                      <div style={{ marginBottom: '10px' }}>
                        <label htmlFor="edit-mach-limit" style={{ fontSize: '0.55rem', color: '#00A3FF', fontWeight: 800, display: 'block', marginBottom: '4px' }}>META FINANCEIRA (R$)</label>
                        <input id="edit-mach-limit" title="Meta Financeira" type="number" placeholder="∞" value={editLimit} onChange={e => setEditLimit(e.target.value)} />
                      </div>

                      <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                        <button className="action-btn" style={{ flex: 1 }} onClick={() => setShowEditModal(false)}>CANCELAR</button>
                        <button className="primary-btn" style={{ flex: 1 }} onClick={updateMachine}>SALVAR ALTERAÇÕES</button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {showPixConfig && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="modal-overlay"
                    onClick={() => setShowPixConfig(false)}
                    style={{ backdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.85)', zIndex: 10000 }}
                  >
                    <motion.div
                      initial={{ scale: 0.9, y: 20, opacity: 0 }}
                      animate={{ scale: 1, y: 0, opacity: 1 }}
                      exit={{ scale: 0.9, y: 20, opacity: 0 }}
                      className="glass-panel modal-content"
                      onClick={e => e.stopPropagation()}
                      style={{
                        padding: '0',
                        background: 'linear-gradient(160deg, #121212 0%, #080808 100%)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '32px',
                        boxShadow: '0 40px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1)',
                        maxWidth: '420px',
                        width: '95%',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Header */}
                      <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                        <div>
                          <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem', letterSpacing: '1px', fontWeight: 900, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>CONFIGURAÇÕES</h3>
                          <div style={{ fontSize: '0.65rem', color: '#888', marginTop: '4px', letterSpacing: '1px', fontWeight: 600 }}>PREFERÊNCIAS DO SISTEMA</div>
                        </div>
                        <button
                          title="Fechar Configurações"
                          onClick={() => setShowPixConfig(false)}
                          style={{
                            background: 'rgba(255,255,255,0.08)',
                            border: 'none',
                            color: '#fff',
                            width: '36px',
                            height: '36px',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s'
                          }}><X size={20} /></button>
                      </div>

                      <div style={{ padding: '28px' }}>
                        {/* 1. APARÊNCIA */}
                        <div style={{ marginBottom: '24px' }}>
                          <label style={{ fontSize: '0.65rem', color: '#00A3FF', fontWeight: 800, marginBottom: '12px', display: 'block', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Visual & Interface</label>
                          <div
                            onClick={async () => {
                              const newMode = equippedItems?.background === 'light' ? 'dark' : 'light';
                              setEquippedItems({ ...equippedItems, background: newMode });
                              await supabase.from('user_stats').update({ equipped_background: newMode }).eq('user_id', session.id);
                            }}
                            style={{
                              background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                              padding: '16px',
                              borderRadius: '16px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              cursor: 'pointer',
                              border: '1px solid rgba(255,255,255,0.05)',
                              transition: 'all 0.2s'
                            }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ fontSize: '1.2rem' }}>{equippedItems?.background === 'light' ? <Sun size={20} /> : <Moon size={20} />}</div>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem' }}>Modo {equippedItems?.background === 'light' ? 'Claro' : 'Escuro'}</span>
                                <span style={{ fontSize: '0.65rem', color: '#666' }}>Alternar tema do aplicativo</span>
                              </div>
                            </div>
                            <div style={{ width: '44px', height: '24px', background: equippedItems?.background === 'light' ? '#00E676' : '#222', borderRadius: '20px', position: 'relative', transition: 'all 0.3s', border: '1px solid rgba(255,255,255,0.1)' }}>
                              <motion.div
                                animate={{ left: equippedItems?.background === 'light' ? '22px' : '2px' }}
                                style={{ width: '18px', height: '18px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', boxShadow: '0 2px 5px rgba(0,0,0,0.3)' }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* 2. FINANCEIRO (PIX) */}
                        <div style={{ marginBottom: '24px' }}>
                          <label style={{ fontSize: '0.65rem', color: '#00E676', fontWeight: 800, marginBottom: '12px', display: 'block', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Dados Financeiros</label>
                          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <label style={{ fontSize: '0.7rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Chave PIX (Para Recebimento)</label>
                            <input placeholder="CPF, E-mail ou Aleatória..." value={pixKey} onChange={e => setPixKey(e.target.value)}
                              style={{ width: '100%', padding: '14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', fontSize: '0.9rem' }} />
                            <button className="primary-btn" style={{ width: '100%', marginTop: '12px', padding: '12px', fontSize: '0.8rem', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onClick={savePixKey}>
                              <Save size={14} /> SALVAR ALTERAÇÕES
                            </button>
                          </div>
                        </div>



                        {/* 4. DADOS */}
                        <div>
                          <label style={{ fontSize: '0.65rem', color: '#FF4D4D', fontWeight: 800, marginBottom: '12px', display: 'block', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Zona de Perigo</label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <button onClick={handleExportBackup} style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s' }}>
                              <Save size={20} /> BACKUP DADOS
                            </button>
                            <button onClick={() => { if (confirm('TEM CERTEZA? ISSO IRÁ ZERAR SEU SALDO PARA R$ 0,00!')) handleWithdraw(); }} style={{ fontSize: '0.75rem', fontWeight: 700, color: '#FF4D4D', background: 'rgba(255, 77, 77, 0.05)', border: '1px solid rgba(255, 77, 77, 0.2)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s' }}>
                              <Trash2 size={20} /> ZERAR CONTA
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>


              <AnimatePresence>
                {showPixDeposit && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="modal-overlay"
                    onClick={() => { setShowPixDeposit(false); setDepositStep(1); }}
                    style={{ zIndex: 10000 }}
                  >
                    <motion.div
                      initial={{ scale: 0.9, y: 20, opacity: 0 }}
                      animate={{ scale: 1, y: 0, opacity: 1 }}
                      exit={{ scale: 0.9, y: 20, opacity: 0 }}
                      className="glass-panel modal-content"
                      onClick={e => e.stopPropagation()}
                      style={{ position: 'relative' }}
                    >
                      <button title="Fechar Depósito" onClick={() => { setShowPixDeposit(false); setDepositStep(1); }} style={{ position: 'absolute', right: '15px', top: '15px', background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer', zIndex: 10 }}><X size={20} /></button>
                      <div className="pix-steps">
                        <div className={`pix - step ${depositStep === 1 ? 'active' : ''} `}>1. VALOR</div>
                        <div className={`pix - step ${depositStep === 2 ? 'active' : ''} `}>2. PAGAMENTO</div>
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
                              <div style={{ height: '100%', width: `${(cumulativeDeposits / 1000) * 100}% `, background: 'linear-gradient(90deg, #00A3FF, #00E676)', boxShadow: '0 0 10px rgba(0,163,255,0.5)' }}></div>
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
                              style={{ width: '150px', height: '150px' }
                              }
                            />
                          </div >

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
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

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
                        ✖
                      </button>
                      <h3 style={{ color: '#00A3FF', marginBottom: '1.2rem' }}>📈 HISTÓRICO_TERMINAL</h3>

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
                          <div style={{ fontSize: '0.45rem', color: '#00A3FF', fontWeight: 900, letterSpacing: '2.5px', marginBottom: '4px' }}>LUCRO ONTEM</div>
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
                showTermsModal && (
                  <div className="modal-overlay" style={{ zIndex: 11000 }} onClick={() => setShowTermsModal(false)}>
                    <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '95%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
                        <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#00A3FF', fontWeight: 900 }}>📝 TERMOS DE USO</h2>
                        <button onClick={() => setShowTermsModal(false)} className="icon-btn-small">✖</button>
                      </div>
                      <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '12px', fontSize: '0.75rem', lineHeight: '1.6', color: '#fff', opacity: 0.9 }}>
                        <p><strong>1. Natureza do Serviço:</strong> O CDI Tycoon é uma ferramenta de simulação educacional e entretenimento. Nenhum valor ou rendimento exibido representa dinheiro real.</p>
                        <p><strong>2. Precisão:</strong> Embora utilizemos taxas reais (Selic, CDI, IPCA), os cálculos podem sofrer variações em relação ao mercado real devido a latências.</p>
                        <p><strong>3. Responsabilidade:</strong> As decisões financeiras tomadas pelo usuário fora do app são de sua inteira responsabilidade. Consulte profissionais certificados.</p>
                        <p><strong>4. Propriedade:</strong> Todo o código e design pertencem ao autor (BRUN0XP5).</p>
                        <p><strong>5. Conduta:</strong> Não é permitido o uso de scripts ou automações para ganho artificial de patrimônio.</p>
                      </div>
                      <button className="primary-btn" style={{ marginTop: '1.5rem', width: '100%' }} onClick={() => setShowTermsModal(false)}>FECHAR</button>
                    </div>
                  </div>
                )
              }

              {
                showPrivacyModal && (
                  <div className="modal-overlay" style={{ zIndex: 11000 }} onClick={() => setShowPrivacyModal(false)}>
                    <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '95%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
                        <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#00A3FF', fontWeight: 900 }}>🛡️ PRIVACIDADE</h2>
                        <button onClick={() => setShowPrivacyModal(false)} className="icon-btn-small">✖</button>
                      </div>
                      <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '12px', fontSize: '0.75rem', lineHeight: '1.6', color: '#fff', opacity: 0.9 }}>
                        <p><strong>1. Coleta:</strong> Coletamos apenas dados para o funcionamento da simulação (username, senha criptografada e progresso).</p>
                        <p><strong>2. Armazenamento:</strong> Os dados são sincronizados via Supabase e salvos localmente para manter a sessão.</p>
                        <p><strong>3. Terceiros:</strong> Usamos APIs públicas para cotações. Nenhuma informação pessoal sua é enviada a esses serviços.</p>
                        <p><strong>4. Segurança:</strong> Seus dados não são vendidos ou compartilhados. O foco é educação e entretenimento.</p>
                      </div>
                      <button className="primary-btn" style={{ marginTop: '1.5rem', width: '100%' }} onClick={() => setShowPrivacyModal(false)}>FECHAR</button>
                    </div>
                  </div>
                )
              }


              {
                showSalaryProjectionModal && (
                  <div className="modal-overlay" style={{ zIndex: 4000 }} onClick={() => setShowSalaryProjectionModal(false)}>
                    <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#00A3FF', fontWeight: 900 }}>📈 PROJEÇÃO SALARIAL</h2>
                        <button onClick={() => setShowSalaryProjectionModal(false)} className="icon-btn-small">✖</button>
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
                            return <><span>🗓️</span><span>DIA {salaryDay} ({remaining} dias restantes)</span></>;
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

                      <div style={{ marginBottom: '1.5rem' }}>
                        <label htmlFor="salary-invest" style={{ fontSize: '0.6rem', color: '#aaa', fontWeight: 900, marginBottom: '8px', display: 'block' }}>INVESTIMENTO MENSAL ADICIONAL (R$)</label>
                        <input
                          id="salary-invest"
                          title="Investimento Mensal Adicional"
                          type="number"
                          value={monthlyInvestment === 0 ? '' : monthlyInvestment}
                          onChange={(e) => setMonthlyInvestment(parseFloat(e.target.value) || 0)}
                          placeholder="Quanto você aporta por mês?"
                          style={{
                            width: '100%',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(0, 163, 255, 0.2)',
                            padding: '12px',
                            borderRadius: '12px',
                            color: '#fff',
                            fontSize: '1rem',
                            fontWeight: 800,
                            outline: 'none'
                          }}
                        />
                      </div>

                      {freedomProgress < 100 && (
                        <div style={{ background: 'rgba(255, 215, 0, 0.05)', padding: '1.2rem', borderRadius: '18px', border: '1px solid rgba(255, 215, 0, 0.2)', marginBottom: '1.5rem' }}>
                          <p className="balance-title" style={{ color: '#FFD700', fontSize: '0.6rem', marginBottom: '8px' }}>TEMPO ESTIMADO ATÉ A LIBERDADE</p>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '5px' }}>
                            <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '10px' }}>
                              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff' }}>{timeToFreedom.years}</div>
                              <div style={{ fontSize: '0.45rem', opacity: 0.5 }}>ANOS</div>
                            </div>
                            <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '10px' }}>
                              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff' }}>{timeToFreedom.months}</div>
                              <div style={{ fontSize: '0.45rem', opacity: 0.5 }}>MESES</div>
                            </div>
                            <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '10px' }}>
                              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff' }}>{timeToFreedom.days}</div>
                              <div style={{ fontSize: '0.45rem', opacity: 0.5 }}>DIAS</div>
                            </div>
                            <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '10px' }}>
                              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff' }}>{timeToFreedom.hours}</div>
                              <div style={{ fontSize: '0.45rem', opacity: 0.5 }}>HORAS</div>
                            </div>
                          </div>
                        </div>
                      )}

                      <button className="primary-btn" style={{ marginTop: '1rem' }} onClick={() => setShowSalaryProjectionModal(false)}>FECHAR</button>
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
                        <button onClick={() => setShowCurrencyModal(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 800 }}>✖</button>
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
                                  ⇄
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

                    <div className="level-up-card" onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
                      <button onClick={() => setShowLevelUpModal(false)} style={{ position: 'absolute', right: '15px', top: '15px', background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer', zIndex: 10 }}>✖</button>
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
                    <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px', position: 'relative' }}>
                      <button onClick={() => setShowImpulseModal(false)} style={{ position: 'absolute', right: '15px', top: '15px', background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer', zIndex: 10 }}>✖</button>
                      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🍔🚫</div>
                        <h2 className="title" style={{ fontSize: '1.4rem', marginBottom: '0.5rem', textAlign: 'center' }}>ECONOMIA DE IMPULSO</h2>
                        <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Não comprou aquele lanche ou supérfluo?</p>
                      </div>

                      <div className="input-group">
                        <label htmlFor="impulse-value">VALOR ECONOMIZADO (R$)</label>
                        <input
                          id="impulse-value"
                          title="Valor Economizado"
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
                    <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', position: 'relative', overflowX: 'hidden' }}>
                      <button onClick={() => setShowSkillsModal(false)} style={{ position: 'absolute', right: '15px', top: '15px', background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer', zIndex: 10 }}>✖</button>
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
                            ⚖️ ALQUIMIA FINANCEIRA
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
                                      const { irFactor } = getTaxMultipliers(m.created_at, false, currentDate, m.investment_type);
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
                    <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', maxHeight: '80vh', overflow: 'auto', position: 'relative', overflowX: 'hidden' }}>
                      <button onClick={() => setShowAchievementsModal(false)} style={{ position: 'absolute', right: '15px', top: '15px', background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer', zIndex: 10 }}>✖</button>
                      <h2 style={{ color: '#FFD700', textAlign: 'center', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                        🏆 CONQUISTAS
                        <span style={{ fontSize: '0.8rem', background: 'rgba(255,215,0,0.2)', padding: '4px 8px', borderRadius: '6px' }}>
                          {processedAchievements.filter(a => a.unlocked).length}/{processedAchievements.length}
                        </span>
                      </h2>

                      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {['all', 'daily', 'patrimony', 'machines', 'time', 'mastery', 'special'].map(cat => (
                          <button
                            key={cat}
                            onClick={() => setAchFilter(cat as any)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: `1px solid ${achFilter === cat ? getRarityColor('legendary') : 'rgba(255,255,255,0.2)'}`,
                              background: achFilter === cat ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.05)',
                              color: achFilter === cat ? '#FFD700' : '#fff',
                              fontSize: '0.65rem',
                              fontWeight: achFilter === cat ? 900 : 400,
                              cursor: 'pointer',
                              textTransform: 'uppercase'
                            }}
                          >
                            {cat === 'all' ? 'Todas' : cat === 'daily' ? '📅 Diárias' : cat}
                          </button>
                        ))}
                      </div>

                      <div style={{ display: 'grid', gap: '12px' }}>
                        {processedAchievements
                          .filter(ach => achFilter === 'all' || ach.category === achFilter)
                          .map((ach: Achievement) => (
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
                                      ✅ RECOMPENSA REIVINDICADA
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

              {
                showPortfolioChart && (
                  <div className="modal-overlay" onClick={() => setShowPortfolioChart(false)} style={{ backdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.85)' }}>
                    <div
                      className="glass-panel modal-content"
                      onClick={e => e.stopPropagation()}
                      style={{
                        padding: '0',
                        background: 'linear-gradient(160deg, #121212 0%, #080808 100%)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '32px',
                        boxShadow: '0 40px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1)',
                        maxWidth: '420px',
                        width: '95%',
                        overflow: 'hidden'
                      }}
                    >
                      <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                        <div>
                          <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem', letterSpacing: '1px', fontWeight: 900, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>SUA CARTEIRA</h3>
                          <div style={{ fontSize: '0.65rem', color: '#888', marginTop: '4px', letterSpacing: '1px', fontWeight: 600 }}>ANÁLISE DE ALOCAÇÃO</div>
                        </div>
                        <button
                          onClick={() => setShowPortfolioChart(false)}
                          style={{
                            background: 'rgba(255,255,255,0.08)',
                            border: 'none',
                            color: '#fff',
                            width: '36px',
                            height: '36px',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1rem',
                            transition: 'all 0.2s'
                          }}>✖</button>
                      </div>

                      <div style={{ position: 'relative', height: '300px', marginTop: '10px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'CDB', value: machines.filter(m => (!m.investment_type || m.investment_type === 'CDB')).reduce((acc, m) => acc + m.valor, 0), color: '#00F5D4' },
                                { name: 'LCI', value: machines.filter(m => m.investment_type === 'LCI').reduce((acc, m) => acc + m.valor, 0), color: '#2D7DD2' },
                                { name: 'LCA', value: machines.filter(m => m.investment_type === 'LCA').reduce((acc, m) => acc + m.valor, 0), color: '#F4ACB7' },
                                { name: 'IPCA+', value: machines.filter(m => m.investment_type === 'IPCA').reduce((acc, m) => acc + m.valor, 0), color: '#FF6B35' },
                                { name: 'Ações', value: machines.filter(m => m.investment_type === 'ACAO').reduce((acc, m) => acc + m.valor, 0), color: '#FFCA3A' },
                                { name: 'FIIs', value: machines.filter(m => m.investment_type === 'FII').reduce((acc, m) => acc + m.valor, 0), color: '#8AC926' },
                                { name: 'Dólar', value: usdBalance * apiRates.USD, color: '#9B5DE5' },
                                { name: 'Iene', value: jpyBalance * apiRates.JPY, color: '#F15BB5' }
                              ].filter(d => d.value > 0)}
                              cx="50%"
                              cy="50%"
                              innerRadius={80}
                              outerRadius={110}
                              paddingAngle={6}
                              dataKey="value"
                              stroke="none"
                              cornerRadius={6}
                            >
                              {
                                [
                                  { name: 'CDB', value: machines.filter(m => (!m.investment_type || m.investment_type === 'CDB')).reduce((acc, m) => acc + m.valor, 0), color: '#00F5D4' },
                                  { name: 'LCI', value: machines.filter(m => m.investment_type === 'LCI').reduce((acc, m) => acc + m.valor, 0), color: '#2D7DD2' },
                                  { name: 'LCA', value: machines.filter(m => m.investment_type === 'LCA').reduce((acc, m) => acc + m.valor, 0), color: '#F4ACB7' },
                                  { name: 'IPCA+', value: machines.filter(m => m.investment_type === 'IPCA').reduce((acc, m) => acc + m.valor, 0), color: '#FF6B35' },
                                  { name: 'Ações', value: machines.filter(m => m.investment_type === 'ACAO').reduce((acc, m) => acc + m.valor, 0), color: '#FFCA3A' },
                                  { name: 'FIIs', value: machines.filter(m => m.investment_type === 'FII').reduce((acc, m) => acc + m.valor, 0), color: '#8AC926' },
                                  { name: 'Dólar', value: usdBalance * apiRates.USD, color: '#9B5DE5' },
                                  { name: 'Iene', value: jpyBalance * apiRates.JPY, color: '#F15BB5' }
                                ].filter(d => d.value > 0).map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))
                              }
                            </Pie>
                            <Tooltip
                              formatter={(value: number | undefined) => value ? `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ 0,00'}
                              contentStyle={{
                                backgroundColor: 'rgba(20, 20, 20, 0.95)',
                                borderColor: 'rgba(255,255,255,0.1)',
                                borderRadius: '16px',
                                boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
                                padding: '16px',
                                backdropFilter: 'blur(10px)'
                              }}
                              itemStyle={{ color: '#fff', fontWeight: 700, fontFamily: 'Inter', fontSize: '0.9rem' }}
                              cursor={{ fill: 'transparent' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>

                        {/* CENTER LABEL */}
                        <div style={{
                          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                          textAlign: 'center', pointerEvents: 'none', zIndex: 5, width: '100%'
                        }}>
                          <div style={{ fontSize: '0.6rem', color: '#aaa', letterSpacing: '1.5px', marginBottom: '2px', fontWeight: 800, textTransform: 'uppercase' }}>PATRIMÔNIO</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', textShadow: '0 0 20px rgba(255,255,255,0.2)', lineHeight: '1' }}>
                            {formatBRLWithPrecision(totalPatrimony)}
                          </div>
                        </div>
                      </div>

                      <div style={{ padding: '0 28px 36px 28px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {[
                          { name: 'CDB RESERVA', short: 'CDB', value: machines.filter(m => (!m.investment_type || m.investment_type === 'CDB')).reduce((acc, m) => acc + m.valor, 0), color: '#00F5D4', bg: 'rgba(0, 245, 212, 0.15)', icon: '🛡️' },
                          { name: 'LCI IMOBILIÁRIO', short: 'LCI', value: machines.filter(m => m.investment_type === 'LCI').reduce((acc, m) => acc + m.valor, 0), color: '#2D7DD2', bg: 'rgba(45, 125, 210, 0.15)', icon: '🏗️' },
                          { name: 'LCA AGRONEGÓCIO', short: 'LCA', value: machines.filter(m => m.investment_type === 'LCA').reduce((acc, m) => acc + m.valor, 0), color: '#F4ACB7', bg: 'rgba(244, 172, 183, 0.15)', icon: '🚜' },
                          { name: 'TESOURO IPCA+', short: 'IPCA', value: machines.filter(m => m.investment_type === 'IPCA').reduce((acc, m) => acc + m.valor, 0), color: '#FF6B35', bg: 'rgba(255, 107, 53, 0.15)', icon: '📈' },
                          { name: 'AÇÕES BRASIL', short: 'ACAO', value: machines.filter(m => m.investment_type === 'ACAO').reduce((acc, m) => acc + m.valor, 0), color: '#FFCA3A', bg: 'rgba(255, 202, 58, 0.15)', icon: '🏛️' },
                          { name: 'FUNDOS IMOBIL.', short: 'FII', value: machines.filter(m => m.investment_type === 'FII').reduce((acc, m) => acc + m.valor, 0), color: '#8AC926', bg: 'rgba(138, 201, 38, 0.15)', icon: '🏢' },
                          { name: 'DÓLAR AMERICANO', short: 'USD', value: usdBalance * apiRates.USD, color: '#9B5DE5', bg: 'rgba(155, 93, 229, 0.15)', icon: '🇺🇸' },
                          { name: 'IENE JAPONÊS', short: 'JPY', value: jpyBalance * apiRates.JPY, color: '#F15BB5', bg: 'rgba(241, 91, 181, 0.15)', icon: '🇯🇵' }
                        ].filter(d => d.value > 0).sort((a, b) => b.value - a.value).map(asset => (
                          <div key={asset.name} style={{
                            display: 'flex', alignItems: 'center', gap: '14px',
                            background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                            padding: '12px 16px', borderRadius: '16px',
                            border: '1px solid rgba(255,255,255,0.04)',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
                          }}>
                            <div style={{
                              width: '42px', height: '42px', borderRadius: '12px', background: asset.bg,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '1.2rem', boxShadow: `0 0 15px ${asset.bg}`
                            }}>
                              {asset.icon}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#eee', letterSpacing: '0.5px' }}>
                                  {asset.name}
                                  <span style={{ display: 'block', fontSize: '0.6rem', color: '#aaa', fontWeight: 600, marginTop: '2px' }}>
                                    R$ {asset.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </span>
                                <span style={{ fontSize: '0.8rem', fontWeight: 900, color: asset.color }}>{((asset.value / totalPatrimony) * 100).toFixed(1)}%</span>
                              </div>
                              {/* Progress Bar Container */}
                              <div style={{ width: '100%', height: '6px', background: 'rgba(0,0,0,0.4)', borderRadius: '10px', overflow: 'hidden' }}>
                                {/* Animated Fill */}
                                <div style={{
                                  width: `${(asset.value / totalPatrimony) * 100}%`,
                                  height: '100%',
                                  background: `linear-gradient(90deg, ${asset.color}, #fff)`,
                                  borderRadius: '10px',
                                  boxShadow: `0 0 10px ${asset.color}`
                                }}></div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              }






              {/* Global Action Success Popup */}
              {/* DEBTS MODAL */}
              {
                showDebtsModal && (
                  <div className="modal-overlay" onClick={() => setShowDebtsModal(false)}>
                    <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', maxHeight: '85vh', overflow: 'auto', overflowX: 'hidden' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h2 style={{ color: '#FF4D4D', margin: 0 }}>📉 DÍVIDAS & DÉBITOS</h2>
                        <button className="action-btn" onClick={() => setShowDebtsModal(false)} style={{ padding: '4px 8px' }}>X</button>
                      </div>

                      <button
                        className="action-btn"
                        onClick={() => { setShowDebtVsInvestModal(true); setShowDebtsModal(false); }}
                        style={{
                          background: 'rgba(255, 215, 0, 0.1)',
                          color: '#FFD700',
                          border: '1px solid rgba(255, 215, 0, 0.3)',
                          width: '100%',
                          marginBottom: '1.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          padding: '12px',
                          borderRadius: '16px'
                        }}
                      >
                        ⚔️ DÍVIDA vs INVESTIMENTO (SIMULADOR)
                      </button>

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
                              aria-label="Tipo de Rendimento da Dívida"
                              value={newDebt.yield_type}
                              onChange={e => setNewDebt({ ...newDebt, yield_type: e.target.value as any })}
                              style={{ background: '#000', border: '1px solid #333', padding: '8px', color: '#fff', borderRadius: '6px', fontSize: '0.7rem' }}
                            >
                              <option value="PRE">PRÉ</option>
                              <option value="POS">PÓS (CDI)</option>
                            </select>
                            <select
                              value={newDebt.categoria}
                              onChange={e => setNewDebt({ ...newDebt, categoria: e.target.value })}
                              style={{ background: '#000', border: '1px solid #333', padding: '8px', color: '#fff', borderRadius: '6px', fontSize: '0.7rem' }}
                            >
                              <option value="cartao">💳 CARTÃO</option>
                              <option value="emprestimo">🏦 EMPRÉSTIMO</option>
                              <option value="custom">✨ PERSONALIZADA</option>
                            </select>
                          </div>

                          {newDebt.categoria === 'custom' && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input
                                placeholder="📦 ÍCONE"
                                value={newDebt.customIcon}
                                onChange={e => setNewDebt({ ...newDebt, customIcon: e.target.value })}
                                style={{ width: '60px', background: '#000', border: '1px solid #333', padding: '8px', color: '#fff', borderRadius: '6px', fontSize: '0.7rem', textAlign: 'center' }}
                              />
                              <input
                                placeholder="NOME DA CATEGORIA (Ex: GASTOS)"
                                value={newDebt.customLabel}
                                onChange={e => setNewDebt({ ...newDebt, customLabel: e.target.value })}
                                style={{ flex: 1, background: '#000', border: '1px solid #333', padding: '8px', color: '#fff', borderRadius: '6px', fontSize: '0.7rem' }}
                              />
                            </div>
                          )}
                          <button className="action-btn" onClick={createDebt} style={{ background: '#FF4D4D', color: '#fff', border: 'none', padding: '10px', fontWeight: 900 }}>ADICIONAR DÍVIDA</button>
                        </div>
                      </div>

                      {/* DEBT LIST */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#aaa', padding: '0 5px' }}>
                          <span>DÍVIDAS ATIVAS</span>
                          <span>TOTAL: R$ {debts.reduce((s, d) => s + d.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>

                        {/* CALCULO DE SAÚDE FINANCEIRA */}
                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', marginBottom: '10px', fontSize: '0.7rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ color: '#aaa' }}>PATRIMÔNIO BRUTO:</span>
                            <span style={{ color: '#fff' }}>R$ {formatBRLWithPrecision(totalPatrimony)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ color: '#aaa' }}>+ SALÁRIO ESTIMADO:</span>
                            <span style={{ color: '#00E676' }}>R$ {(salary || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '4px', paddingTop: '4px', display: 'flex', justifyContent: 'space-between', fontWeight: 900 }}>
                            <span style={{ color: '#aaa' }}>DISPONÍVEL REAL:</span>
                            <span style={{ color: (totalPatrimony + (salary || 0) - debts.reduce((s, d) => s + d.valor, 0)) >= 0 ? '#00E676' : '#FF4D4D' }}>
                              R$ {(totalPatrimony + (salary || 0) - debts.reduce((s, d) => s + d.valor, 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        {debts.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '20px', opacity: 0.5, border: '1px dashed #333', borderRadius: '12px' }}>
                            NENHUMA DÍVIDA PENDENTE. BOM TRABALHO!
                          </div>
                        ) : (
                          debts.map(d => (
                            <div key={d.id} style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontSize: '0.55rem', opacity: 0.6, textTransform: 'uppercase' }}>
                                  {(() => {
                                    if (d.categoria === 'cartao') return '💳 CARTÃO';
                                    if (d.categoria === 'emprestimo') return '🏦 EMPRÉSTIMO';
                                    if (d.categoria?.startsWith('CUSTOM:')) {
                                      const parts = d.categoria.split(':');
                                      return `${parts[1] || '✨'} ${parts[2] || 'OUTRO'}`;
                                    }
                                    return `❓ ${d.categoria || 'DÍVIDA'}`;
                                  })()}
                                </div>
                                <div style={{ fontWeight: 900, fontSize: '0.85rem', color: '#fff' }}>{d.nome}</div>
                                <div style={{ fontWeight: 800, fontSize: '0.8rem', color: '#FF4D4D' }}>R$ {d.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                <button
                                  onClick={() => setConfirmPayDebt(d)}
                                  className="action-btn"
                                  style={{ padding: '6px 12px', fontSize: '0.65rem', background: 'rgba(0, 230, 118, 0.1)', border: '1px solid #00E676', color: '#00E676' }}
                                >
                                  PAGAR
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteDebt(d.id)}
                                  className="action-btn"
                                  style={{ padding: '6px 10px', fontSize: '0.65rem', background: confirmDeleteDebt === d.id ? '#FF4D4D' : 'rgba(255, 77, 77, 0.1)', border: '1px solid #FF4D4D', color: confirmDeleteDebt === d.id ? '#fff' : '#FF4D4D', marginLeft: '8px' }}
                                >
                                  {confirmDeleteDebt === d.id ? '?' : '🗑️'}
                                </button>
                                {confirmDeleteDebt === d.id && (
                                  <button onClick={() => deleteDebt(d.id)} className="action-btn" style={{ marginLeft: '4px', background: '#FF4D4D', color: '#fff', fontSize: '0.65rem', padding: '6px' }}>CONFIRMAR</button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div >
                )
              }

              {
                showDebtVsInvestModal && (
                  <div className="modal-overlay" onClick={() => setShowDebtVsInvestModal(false)} style={{ zIndex: 10000 }}>
                    <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h2 style={{ color: '#FFD700', margin: 0, fontSize: '1.1rem' }}>⚔️ DECISÃO ESTRATÉGICA</h2>
                        <button className="action-btn" onClick={() => setShowDebtVsInvestModal(false)} style={{ padding: '4px 8px' }}>X</button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div className="input-group">
                          <label style={{ fontSize: '0.55rem', color: '#aaa', fontWeight: 900, marginBottom: '5px', display: 'block' }}>VALOR DA PARCELA OU TOTAL (R$)</label>
                          <input type="number" value={calcAmount} onChange={e => setCalcAmount(e.target.value)} style={{ width: '100%', background: '#000', border: '1px solid #333', padding: '10px', color: '#fff', borderRadius: '8px' }} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div className="input-group">
                            <label style={{ fontSize: '0.55rem', color: '#FF4D4D', fontWeight: 900, marginBottom: '5px', display: 'block' }}>JUROS DÍVIDA (% MÊS)</label>
                            <input type="number" value={calcDebtRate} onChange={e => setCalcDebtRate(e.target.value)} style={{ width: '100%', background: '#000', border: '1px solid #333', padding: '10px', color: '#fff', borderRadius: '8px' }} />
                          </div>
                          <div className="input-group">
                            <label style={{ fontSize: '0.55rem', color: '#00E676', fontWeight: 900, marginBottom: '5px', display: 'block' }}>JUROS INVEST. (% MÊS)</label>
                            <input type="number" value={calcInvestRate} onChange={e => setCalcInvestRate(e.target.value)} style={{ width: '100%', background: '#000', border: '1px solid #333', padding: '10px', color: '#fff', borderRadius: '8px' }} />
                          </div>
                        </div>

                        <div className="input-group">
                          <label style={{ fontSize: '0.55rem', color: '#aaa', fontWeight: 900, marginBottom: '5px', display: 'block' }}>PERÍODO DE COMPARAÇÃO (MESES)</label>
                          <input type="number" value={calcMonths} onChange={e => setCalcMonths(e.target.value)} style={{ width: '100%', background: '#000', border: '1px solid #333', padding: '10px', color: '#fff', borderRadius: '8px' }} />
                        </div>
                      </div>

                      {(() => {
                        const amt = parseFloat(calcAmount) || 0;
                        const dRate = (parseFloat(calcDebtRate) || 0) / 100;
                        const iRate = (parseFloat(calcInvestRate) || 0) / 100;
                        const months = parseInt(calcMonths) || 0;

                        const totalDebtCost = amt * Math.pow(1 + dRate, months);
                        const totalInvestGain = amt * Math.pow(1 + iRate, months);
                        const debtInterestPaid = totalDebtCost - amt;
                        const investProfitEarned = totalInvestGain - amt;

                        const betterOption = debtInterestPaid > investProfitEarned ? 'PAY_DEBT' : 'KEEP_INVEST';
                        const diff = Math.abs(debtInterestPaid - investProfitEarned);

                        return (
                          <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                              <div style={{ fontSize: '0.6rem', color: '#aaa', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>VEREDITO DO SIMULADOR</div>
                              <div style={{ fontSize: '0.9rem', color: betterOption === 'PAY_DEBT' ? '#FF4D4D' : '#00E676', fontWeight: 900, marginTop: '5px' }}>
                                {betterOption === 'PAY_DEBT' ? '🚨 QUITAR DÍVIDA IMEDIATAMENTE' : '✅ MANTER INVESTIMENTO ATIVO'}
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.65rem' }}>
                              <div style={{ background: 'rgba(255, 77, 77, 0.05)', padding: '10px', borderRadius: '12px' }}>
                                <span style={{ opacity: 0.6 }}>Custo em Juros:</span><br />
                                <strong style={{ color: '#FF4D4D' }}>R$ {debtInterestPaid.toFixed(2)}</strong>
                              </div>
                              <div style={{ background: 'rgba(0, 230, 118, 0.05)', padding: '10px', borderRadius: '12px' }}>
                                <span style={{ opacity: 0.6 }}>Ganho em Juros:</span><br />
                                <strong style={{ color: '#00E676' }}>R$ {investProfitEarned.toFixed(2)}</strong>
                              </div>
                            </div>

                            <div style={{ marginTop: '15px', textAlign: 'center', fontSize: '0.6rem', opacity: 0.8, color: '#FFD700', fontWeight: 800 }}>
                              {betterOption === 'PAY_DEBT'
                                ? `Economia líquida de R$ ${diff.toFixed(2)} ao quitar agora.`
                                : `Ganho líquido de R$ ${diff.toFixed(2)} ao manter investido.`
                              }
                            </div>
                          </div>
                        );
                      })()}

                      <button className="primary-btn" style={{ marginTop: '20px' }} onClick={() => setShowDebtVsInvestModal(false)}>FECHAR SIMULADOR</button>
                    </div>
                  </div>
                )
              }

              {/* CONFIRM PAY DEBT MODAL */}
              {
                confirmPayDebt && (
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
                )
              }

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

              {/* STOCK MARKET MODAL */}
              {
                showStockMarketModal && (
                  <div className="modal-overlay" onClick={() => setShowStockMarketModal(false)} style={{ zIndex: 10000 }}>
                    <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', maxHeight: '85vh', overflow: 'auto' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(155, 93, 229, 0.2)', paddingBottom: '1rem' }}>
                        <div>
                          <h2 style={{ color: '#9B5DE5', margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            📈 CRIAR ATIVO DA BOLSA
                          </h2>
                          <p style={{ fontSize: '0.65rem', color: '#aaa', margin: '4px 0 0 0' }}>Cadastre Ações, FIIs e outros ativos manualmente</p>
                        </div>
                        <button className="action-btn" onClick={() => setShowStockMarketModal(false)} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.05)' }}>✖</button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' }}>
                        <div className="input-group">
                          <label htmlFor="stock-ticker" style={{ fontSize: '0.65rem', color: '#9B5DE5', fontWeight: 900, marginBottom: '5px', display: 'block' }}>TICKER / CÓDIGO (EX: PETR4, HGLG11)</label>
                          <input
                            id="stock-ticker"
                            title="Ticker do Ativo"
                            type="text"
                            placeholder="PETR4"
                            value={newStockTicker}
                            onChange={e => setNewStockTicker(e.target.value.toUpperCase())}
                            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid #333', padding: '12px', color: '#fff', borderRadius: '12px', boxSizing: 'border-box' }}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%' }}>
                          <div className="input-group">
                            <label htmlFor="stock-price" style={{ fontSize: '0.65rem', color: '#aaa', fontWeight: 900, marginBottom: '5px', display: 'block' }}>PREÇO ATUAL (R$)</label>
                            <input
                              id="stock-price"
                              title="Preço Atual"
                              type="number"
                              placeholder="0.00"
                              value={newStockPrice}
                              onChange={e => setNewStockPrice(e.target.value)}
                              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid #333', padding: '10px', color: '#fff', borderRadius: '8px', boxSizing: 'border-box' }}
                            />
                          </div>
                          <div className="input-group">
                            <label htmlFor="stock-qty" style={{ fontSize: '0.65rem', color: '#aaa', fontWeight: 900, marginBottom: '5px', display: 'block' }}>QUANTIDADE (COTA)</label>
                            <input
                              id="stock-qty"
                              title="Quantidade de Cotas"
                              type="number"
                              placeholder="1"
                              value={newStockQuantity}
                              onChange={e => setNewStockQuantity(e.target.value)}
                              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid #333', padding: '10px', color: '#fff', borderRadius: '8px', boxSizing: 'border-box' }}
                            />
                          </div>
                        </div>

                        <div className="input-group">
                          <label htmlFor="stock-dy" style={{ fontSize: '0.65rem', color: '#aaa', fontWeight: 900, marginBottom: '5px', display: 'block' }}>DIVIDEND YIELD (DY % ANUAL)</label>
                          <input
                            id="stock-dy"
                            title="Dividend Yield"
                            type="number"
                            placeholder="12.5"
                            value={newStockDY}
                            onChange={e => setNewStockDY(e.target.value)}
                            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid #333', padding: '10px', color: '#fff', borderRadius: '8px', boxSizing: 'border-box' }}
                          />
                        </div>

                        <div className="input-group">
                          <label htmlFor="stock-freq" style={{ fontSize: '0.65rem', color: '#aaa', fontWeight: 900, marginBottom: '5px', display: 'block' }}>FREQUÊNCIA DE PAGAMENTO</label>
                          <select
                            id="stock-freq"
                            title="Frequência de Pagamento"
                            value={newStockFrequency}
                            onChange={e => setNewStockFrequency(e.target.value as any)}
                            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid #333', padding: '10px', color: '#fff', borderRadius: '8px', boxSizing: 'border-box' }}
                          >
                            <option value="daily">DIÁRIO (TESTE/SIMULAÇÃO)</option>
                            <option value="monthly">MENSAL (FIIs / ALGUMAS AÇÕES)</option>
                            <option value="quarterly">TRIMESTRAL</option>
                            <option value="semiannual">SEMESTRAL</option>
                            <option value="annual">ANUAL</option>
                          </select>
                        </div>

                        <div className="input-group">
                          <label style={{ fontSize: '0.65rem', color: '#00E676', fontWeight: 900, marginBottom: '5px', display: 'block' }}>VALOR TOTAL DO INVESTIMENTO</label>
                          <div style={{ padding: '12px', background: 'rgba(0, 230, 118, 0.1)', border: '1px solid #00E676', borderRadius: '12px', color: '#00E676', fontSize: '1.2rem', fontWeight: 900, textAlign: 'center' }}>
                            R$ {(parseFloat(newStockPrice || '0') * parseFloat(newStockQuantity || '0')).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                        </div>

                        <button
                          className="primary-btn"
                          onClick={() => {
                            createStockMachine();
                          }}
                          style={{ background: 'linear-gradient(135deg, #9B5DE5 0%, #E0AAFF 100%)', color: '#000', fontWeight: 900, marginTop: '10px' }}
                        >
                          INVESTIR NO ATIVO
                        </button>

                        <div style={{ height: '1px', background: 'rgba(155, 93, 229, 0.2)', margin: '15px 0' }}></div>

                        <div style={{ textAlign: 'center', width: '100%' }}>
                          <p style={{ fontSize: '0.6rem', color: '#9B5DE5', fontWeight: 800, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            Sincronização com o Mercado Real
                          </p>
                          <button
                            className="action-btn"
                            onClick={updateStockPortfolioWithAI}
                            disabled={isUpdatingStocks}
                            style={{
                              width: '100%',
                              padding: '14px',
                              background: isUpdatingStocks ? 'rgba(255,255,255,0.05)' : 'rgba(155, 93, 229, 0.1)',
                              border: '1px solid rgba(155, 93, 229, 0.3)',
                              borderRadius: '12px',
                              color: '#9B5DE5',
                              fontWeight: 900,
                              fontSize: '0.75rem',
                              transition: 'all 0.3s',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '10px'
                            }}
                          >
                            {isUpdatingStocks ? (
                              <>
                                <span style={{ fontSize: '1rem', animation: 'spin 2s linear infinite' }}>⌛</span>
                                IAS PESQUISANDO...
                              </>
                            ) : (
                              <>
                                <span style={{ fontSize: '1rem' }}>🤖</span>
                                ATUALIZAR CARTEIRA VIA IA
                              </>
                            )}
                          </button>
                          <p style={{ fontSize: '0.55rem', color: '#666', marginTop: '8px' }}>
                            A IA pesquisará os preços atuais de todos os seus ativos da bolsa e ajustará seu saldo instantaneamente.
                          </p>
                        </div>
                      </div>

                      <div style={{ marginTop: '1.5rem', padding: '12px', background: 'rgba(155, 93, 229, 0.05)', borderRadius: '12px', border: '1px solid rgba(155, 93, 229, 0.2)' }}>
                        <p style={{ fontSize: '0.65rem', color: '#aaa', margin: 0, lineHeight: '1.4' }}>
                          📈 <strong>Custom Assets:</strong> Você agora tem controle total sobre seus ativos da bolsa. Defina o DY histórico e a frequência para simular sua carteira real.
                        </p>
                      </div>
                    </div>
                  </div>
                )
              }

              {/* MODAL DE TRANSFERÊNCIA/GASTOS */}
              <AnimatePresence>
                {showTransferModal && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="modal-overlay"
                    onClick={() => setShowTransferModal(false)}
                    style={{ zIndex: 10000 }}
                  >
                    <motion.div
                      initial={{ scale: 0.9, y: 20, opacity: 0 }}
                      animate={{ scale: 1, y: 0, opacity: 1 }}
                      exit={{ scale: 0.9, y: 20, opacity: 0 }}
                      className="glass-panel modal-content"
                      onClick={e => e.stopPropagation()}
                      style={{ maxWidth: '450px' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h2 style={{ color: '#FF4D4D', margin: 0, fontSize: '1.1rem' }}>💸 REGISTRAR GASTO</h2>
                        <button className="icon-btn-small" onClick={() => setShowTransferModal(false)} style={{ padding: '4px' }}><X size={18} /></button>
                      </div>

                      <div style={{ marginBottom: '1.5rem', padding: '12px', background: 'rgba(255, 77, 77, 0.05)', borderRadius: '12px', border: '1px solid rgba(255, 77, 77, 0.2)' }}>
                        <p style={{ fontSize: '0.65rem', color: '#aaa', margin: 0, lineHeight: '1.4' }}>
                          💡 <strong>Dica:</strong> Registre seus gastos para manter controle total do seu capital líquido. Exemplos: compras, PIX, transferências, etc.
                        </p>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div className="input-group">
                          <label style={{ fontSize: '0.65rem', color: '#FF4D4D', fontWeight: 900, marginBottom: '5px', display: 'block' }}>VALOR DO GASTO (R$)</label>
                          <input
                            type="number"
                            placeholder="0.00"
                            value={transferValue}
                            onChange={e => setTransferValue(e.target.value)}
                            style={{
                              width: '100%',
                              background: 'rgba(0,0,0,0.5)',
                              border: '1px solid rgba(255, 77, 77, 0.3)',
                              padding: '12px',
                              color: '#fff',
                              borderRadius: '12px',
                              fontSize: '1rem',
                              fontWeight: 700
                            }}
                          />
                        </div>

                        <div className="input-group">
                          <label style={{ fontSize: '0.65rem', color: '#FF8C00', fontWeight: 900, marginBottom: '5px', display: 'block' }}>DESCRIÇÃO DO GASTO</label>
                          <input
                            type="text"
                            placeholder="Ex: Comprei um biscoito, PIX para João, etc."
                            value={transferDescription}
                            onChange={e => setTransferDescription(e.target.value)}
                            style={{
                              width: '100%',
                              background: 'rgba(0,0,0,0.5)',
                              border: '1px solid rgba(255, 140, 0, 0.3)',
                              padding: '12px',
                              color: '#fff',
                              borderRadius: '12px',
                              fontSize: '0.85rem'
                            }}
                          />
                        </div>

                        <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.6rem', color: '#aaa', fontWeight: 800 }}>SALDO ATUAL:</span>
                            <span style={{ fontSize: '0.8rem', color: '#00E676', fontWeight: 900 }}>
                              R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.6rem', color: '#aaa', fontWeight: 800 }}>SALDO APÓS GASTO:</span>
                            <span style={{ fontSize: '0.8rem', color: '#FF4D4D', fontWeight: 900 }}>
                              R$ {(balance - (parseFloat(transferValue) || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        className="primary-btn"
                        onClick={handleTransfer}
                        style={{
                          marginTop: '20px',
                          background: 'linear-gradient(135deg, #FF4D4D 0%, #FF8C00 100%)',
                          color: '#fff',
                          fontWeight: 900
                        }}
                      >
                        CONFIRMAR TRANSFERÊNCIA
                      </button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* CENTRAL DE AJUDA & GUIA COMPLETO (REFATORADO E DETALHADO) */}
              <AnimatePresence>
                {showHelpModal && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="modal-overlay"
                    onClick={() => setShowHelpModal(false)}
                    style={{ zIndex: 10000 }}
                  >
                    <motion.div
                      initial={{ scale: 0.9, y: 20, opacity: 0 }}
                      animate={{ scale: 1, y: 0, opacity: 1 }}
                      exit={{ scale: 0.9, y: 20, opacity: 0 }}
                      className="glass-panel modal-content"
                      onClick={e => e.stopPropagation()}
                      style={{ maxWidth: '650px', maxHeight: '85vh', overflowY: 'auto' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(0, 163, 255, 0.2)', paddingBottom: '1rem' }}>
                        <div>
                          <h2 style={{ color: '#00A3FF', margin: 0, fontSize: '1.3rem', fontWeight: 900 }}>❓ CENTRAL DE AJUDA & GUIA</h2>
                          <p style={{ margin: 0, fontSize: '0.65rem', opacity: 0.5, letterSpacing: '1px', fontWeight: 800 }}>SISTEMA VERSÃO 0.46.0 | MODO ESPECIALISTA</p>
                        </div>
                        <button title="Fechar Central de Ajuda" className="icon-btn-small" onClick={() => setShowHelpModal(false)} style={{ padding: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }}><X size={18} /></button>
                      </div>

                      <div className="custom-scrollbar" style={{ paddingRight: '12px' }}>

                        {/* APOIO AO DESENVOLVEDOR */}
                        <div style={{ marginBottom: '25px', background: 'linear-gradient(135deg, rgba(155, 93, 229, 0.1) 0%, rgba(0, 163, 255, 0.1) 100%)', padding: '18px', borderRadius: '14px', border: '1px solid rgba(155, 93, 229, 0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
                          <div style={{ flex: 1 }}>
                            <h3 style={{ fontSize: '1rem', color: '#E0AAFF', margin: 0, fontWeight: 900 }}>Apoie o Projeto! ☕</h3>
                            <p style={{ fontSize: '0.75rem', color: '#ccc', margin: '6px 0 0 0', lineHeight: '1.4' }}>Sua contribuição mantém os servidores ativos e financia novas mecânicas reais para o simulador.</p>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText('1945ea61-c012-4de6-aedf-ad99bb39f457');
                              setNotification('✅ Chave PIX copiada!');
                              setPixCopied(true);
                              setTimeout(() => setPixCopied(false), 3000);
                            }}
                            style={{
                              background: pixCopied ? '#00E676' : 'linear-gradient(135deg, #9B5DE5 0%, #00A3FF 100%)',
                              border: 'none',
                              padding: '10px 20px',
                              borderRadius: '10px',
                              color: '#fff',
                              fontWeight: 900,
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              boxShadow: pixCopied ? '0 0 20px rgba(0, 230, 118, 0.4)' : '0 4px 15px rgba(0,0,0,0.3)',
                              transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                              marginLeft: '15px',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {pixCopied ? '✅ COPIADO!' : 'COPIAR PIX'}
                          </button>
                        </div>

                        {/* NOVIDADES DA VERSÃO */}
                        <section style={{ marginBottom: '35px' }}>
                          <h3 style={{ color: '#00E676', fontSize: '0.9rem', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ background: 'rgba(0, 230, 118, 0.1)', padding: '4px 8px', borderRadius: '6px' }}>🚀</span>
                            O QUE HÁ DE NOVO NA 0.46.0 (UNIVERSO EXPANDIDO)
                          </h3>
                          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '12px' }}>
                            {[
                              { t: 'Supernovas Estelares', d: 'Flashes de energia azul distantes que iluminam o vácuo do Modo Zen de forma sutil.', c: '#00A3FF' },
                              { t: 'Novos Planetas 3D', d: 'O universo agora conta com planetas flutuantes com atmosferas e iluminação dinâmica.', c: '#9B5DE5' },
                              { t: 'Timer de Alta Precisão', d: 'Contagem de yield reconstruída com precisão de microssegundos e barra de progresso fluida.', c: '#FFD700' },
                              { t: 'Correções Estéticas', d: 'LEDs das máquinas FII restaurados e anéis 3D estabilizados para uma experiência sem engasgos.', c: '#00E676' }
                            ].map((item, i) => (
                              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px', borderLeft: `4px solid ${item.c}` }}>
                                <strong style={{ color: item.c, fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>{item.t}</strong>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#aaa', lineHeight: '1.4' }}>{item.d}</p>
                              </div>
                            ))}
                          </div>
                        </section>

                        {/* MECÂNICA DE PATRIMÔNIO */}
                        <section style={{ marginBottom: '35px' }}>
                          <h2 style={{ fontSize: '1rem', color: '#fff', borderLeft: '4px solid #00A3FF', paddingLeft: '12px', marginBottom: '15px', fontWeight: 900 }}>💰 O CONCEITO DE PATRIMÔNIO</h2>
                          <div style={{ color: '#ccc', fontSize: '0.85rem', lineHeight: '1.6' }}>
                            <p>No <strong>CDI Tycoon</strong>, seu sucesso é medido pelo seu <strong>Patrimônio Bruto Total</strong>. Ele é a soma de:</p>
                            <ul style={{ paddingLeft: '20px', marginTop: '10px', color: '#eee' }}>
                              <li><strong>Capital Líquido:</strong> Dinheiro "na mão" para novos aportes ou gastos.</li>
                              <li><strong>Ativos em Real (BRL):</strong> CDBs, LCIs, IPCA+ e sua Carteira de Ações.</li>
                              <li><strong>Moedas Estrangeiras:</strong> USD (Dólar) e JPY (Iene) convertidos pela cotação atual.</li>
                            </ul>
                            <p style={{ marginTop: '10px', fontSize: '0.75rem', background: 'rgba(255, 215, 0, 0.05)', padding: '10px', borderRadius: '8px', border: '1px dashed rgba(255, 215, 0, 0.2)' }}>
                              ⚠️ <strong>IMPORTANTE:</strong> Seu <strong>XP</strong> é uma representação direta do seu patrimônio. Se você gastar dinheiro (Transferir), seu nível pode cair!
                            </p>
                          </div>
                        </section>

                        {/* RENDA FIXA */}
                        <section style={{ marginBottom: '35px' }}>
                          <h2 style={{ fontSize: '1rem', color: '#fff', borderLeft: '4px solid #00E676', paddingLeft: '12px', marginBottom: '15px', fontWeight: 900 }}>📊 MECÂNICAS DE RENDA FIXA</h2>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <p style={{ fontSize: '0.85rem', color: '#ccc', lineHeight: '1.6' }}>
                              Simulamos a <strong>Regra dos 252 dias úteis</strong>. O rendimento ocorre a cada <strong>10 segundos</strong> de forma contínua enquanto o mercado estiver aberto.
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                              <div style={{ background: 'rgba(0, 230, 118, 0.05)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(0, 230, 118, 0.1)' }}>
                                <strong style={{ color: '#00E676', fontSize: '0.85rem' }}>CDB & IPCA+</strong>
                                <p style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '5px' }}>Rendimentos mais altos, porém sofrem incidência de <strong>Imposto de Renda Regressivo</strong>.</p>
                              </div>
                              <div style={{ background: 'rgba(0, 163, 255, 0.05)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(0, 163, 255, 0.1)' }}>
                                <strong style={{ color: '#00A3FF', fontSize: '0.85rem' }}>LCI & LCA</strong>
                                <p style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '5px' }}>Taxas ligeiramente menores, mas são <strong>Totalmente Isentas de IR</strong>. Excelente para curto prazo.</p>
                              </div>
                            </div>
                          </div>
                        </section>

                        {/* MERCADO DE CAPITAIS (DETALHADO) */}
                        <section style={{ marginBottom: '35px' }}>
                          <h2 style={{ fontSize: '1rem', color: '#fff', borderLeft: '4px solid #9B5DE5', paddingLeft: '12px', marginBottom: '15px', fontWeight: 900 }}>📈 MERCADO DE CAPITAIS (BOLSA)</h2>
                          <div style={{ background: 'rgba(155, 93, 229, 0.05)', padding: '20px', borderRadius: '15px', border: '1px solid rgba(155, 93, 229, 0.2)' }}>
                            <p style={{ fontSize: '0.85rem', color: '#ccc', lineHeight: '1.6', marginBottom: '15px' }}>
                              A Bolsa de Valores é desbloqueada no <strong>Nível 3</strong>. Aqui, as informações são <strong>REAIS E NÃO ALEATÓRIAS</strong>:
                            </p>
                            <ul style={{ fontSize: '0.8rem', color: '#eee', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <li><strong>🤖 Cotações via IA:</strong> Utilizamos dados reais de mercado (Yahoo Finance/B3). Ao clicar em atualizar, a IA processa o valor exato no momento para garantir realismo absoluto.</li>
                              <li><strong>💰 Dividend Yield (DY):</strong> Diferente do CDB, aqui você ganha pela valorização do papel e pelos dividendos pagos (aluguéis virtuais no caso de FIIs).</li>
                              <li><strong>📉 Risco de Mercado:</strong> Diferente da renda fixa, você pode ter um patrimônio negativo se o preço da ação cair drasticamente.</li>
                              <li><strong>🔄 Venda Inteligente:</strong> O lucro só é realizado (vai para o saldo líquido) quando você vende a cota.</li>
                            </ul>
                          </div>
                        </section>

                        {/* TRIBUTAÇÃO */}
                        <section style={{ marginBottom: '35px' }}>
                          <h2 style={{ fontSize: '1rem', color: '#fff', borderLeft: '4px solid #FF4D4D', paddingLeft: '12px', marginBottom: '15px', fontWeight: 900 }}>⚖️ TRIBUTAÇÃO & RESGATES</h2>
                          <div style={{ background: 'rgba(255, 77, 77, 0.05)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(255, 77, 77, 0.1)' }}>
                            <table style={{ width: '100%', fontSize: '0.8rem', color: '#ccc', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                  <th style={{ textAlign: 'left', padding: '8px' }}>Tempo</th>
                                  <th style={{ textAlign: 'right', padding: '8px' }}>Alíquota IR</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr><td style={{ padding: '8px' }}>Até 180 dias</td><td style={{ textAlign: 'right', padding: '8px', color: '#fff' }}>22,5%</td></tr>
                                <tr><td style={{ padding: '8px' }}>181 a 360 dias</td><td style={{ textAlign: 'right', padding: '8px', color: '#fff' }}>20,0%</td></tr>
                                <tr><td style={{ padding: '8px' }}>361 a 720 dias</td><td style={{ textAlign: 'right', padding: '8px', color: '#fff' }}>17,5%</td></tr>
                                <tr><td style={{ padding: '8px' }}>Acima de 720 dias</td><td style={{ textAlign: 'right', padding: '8px', color: '#fff' }}>15,0%</td></tr>
                              </tbody>
                            </table>
                            <div style={{ marginTop: '15px', fontSize: '0.75rem' }}>
                              <p>🔴 <strong>IOF:</strong> Cobrado nos primeiros 30 dias de resgate. Se resgatar hoje o que aplicou ontem, perde Quase Todo o lucro (96%). Espere 30 dias para ficar isento.</p>
                            </div>
                          </div>
                        </section>

                        {/* FERRAMENTAS */}
                        <section style={{ marginBottom: '35px' }}>
                          <h2 style={{ fontSize: '1rem', color: '#fff', borderLeft: '4px solid #FFD700', paddingLeft: '12px', marginBottom: '15px', fontWeight: 900 }}>🛠️ FERRAMENTAS DE MESTRE</h2>
                          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '10px' }}>
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px' }}>
                              <strong style={{ fontSize: '0.8rem', color: '#fff' }}>🧠 Skills Shop:</strong> Invista no seu conhecimento para desbloquear monitores de IF, gráficos de projeção e bônus de rendimento.
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px' }}>
                              <strong style={{ fontSize: '0.8rem', color: '#fff' }}>🧘 Modo Zen:</strong> Esconda a complexidades e foque apenas no crescimento visual de seus ativos.
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px' }}>
                              <strong style={{ fontSize: '0.8rem', color: '#fff' }}>💾 Backup Seguro:</strong> Gere um código TXT no menu para nunca perder seu progresso. O jogo salva no Supabase (Cloud) e LocalStorage.
                            </div>
                          </div>
                        </section>

                        {/* FOOTER */}
                        <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '15px' }}>
                            <button onClick={() => setShowTermsModal(true)} style={{ background: 'none', border: 'none', color: '#00A3FF', fontSize: '0.65rem', fontWeight: 900, cursor: 'pointer', textDecoration: 'underline' }}>TERMOS DE USO</button>
                            <button onClick={() => setShowPrivacyModal(true)} style={{ background: 'none', border: 'none', color: '#00A3FF', fontSize: '0.65rem', fontWeight: 900, cursor: 'pointer', textDecoration: 'underline' }}>PRIVACIDADE</button>
                          </div>
                          <p style={{ fontSize: '0.6rem', color: '#555', margin: 0 }}>
                            CDI Tycoon © 2026 - Desenvolvido para fins educacionais.<br />
                            Nenhum dado financeiro aqui representa valores reais em espécie.
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
        {notification && <div className="notification-toast"><div className="toast-content">{notification}</div></div>}
        <div className={equippedItems.background ? `container-bg-override ${equippedItems.background}` : ''} style={{ display: 'none' }}></div>
      </>
    );
  };

  return renderContent();
}

export default App;
