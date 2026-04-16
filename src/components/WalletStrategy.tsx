// Copyright (C) 2026 TEENet
// SPDX-License-Identifier: GPL-3.0-or-later

import { Fingerprint, ShieldCheck, FileCode2, Plus, MoreVertical, BadgeCheck } from 'lucide-react';
import { useState } from 'react';

export default function WalletStrategy() {
  const [threshold, setThreshold] = useState(2500);

  return (
    <div className="animate-in fade-in duration-500 space-y-12">
      {/* Hero Strategy Section */}
      <section className="space-y-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            <span className="text-secondary text-xs font-bold tracking-[0.2em] uppercase font-label">Active Policy Mode</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-headline font-bold tracking-tight text-on-surface">Wallet Strategy</h1>
          <p className="text-slate-400 max-w-2xl text-lg">
            Define the autonomous boundaries for your agent. All actions exceeding these thresholds require Passkey authorization.
          </p>
        </div>

        {/* Passkey Threshold Bento Card Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* USD Threshold */}
          <div className="lg:col-span-2 bg-surface-container-low rounded-3xl p-8 ghost-border relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] -mr-32 -mt-32"></div>
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h3 className="text-xl font-headline font-bold text-on-surface mb-2">USD Execution Threshold</h3>
                  <p className="text-sm text-slate-400 max-w-md">Transactions above this amount trigger Passkey biometric verification.</p>
                </div>
                <Fingerprint className="w-8 h-8 text-primary" />
              </div>
              
              <div className="space-y-8">
                <div className="flex justify-between items-end">
                  <span className="text-5xl md:text-6xl font-headline font-black text-primary tracking-tighter">
                    ${threshold.toLocaleString()}
                  </span>
                  <span className="text-slate-500 font-label text-sm tracking-widest uppercase">Per Transaction</span>
                </div>
                
                <div className="relative w-full h-2 bg-surface-container rounded-full">
                  <div 
                    className="absolute left-0 top-0 h-full primary-gradient rounded-full"
                    style={{ width: `${(threshold / 10000) * 100}%` }}
                  ></div>
                  <input 
                    className="absolute -top-2 left-0 w-full h-6 bg-transparent appearance-none cursor-pointer" 
                    max="10000" 
                    min="0" 
                    step="100"
                    type="range" 
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Passkey Security */}
          <div className="bg-surface-container rounded-3xl p-8 ghost-border flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center mb-6">
                <ShieldCheck className="w-6 h-6 text-secondary" />
              </div>
              <h3 className="text-xl font-headline font-bold text-on-surface mb-2">Passkey Security</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Your hardware-backed biometric key is currently the sole master executor for all policy overrides.
              </p>
            </div>
            <button type="button" className="w-full mt-8 py-4 rounded-xl bg-surface-container-high text-secondary font-bold text-sm tracking-wide ghost-border hover:bg-surface-variant transition-all">
              Update Keys
            </button>
          </div>
        </div>
      </section>

      {/* Main Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Whitelist Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-headline font-bold flex items-center gap-3">
              <FileCode2 className="w-6 h-6 text-primary" />
              Whitelisted Contracts
            </h2>
            <button type="button" className="text-secondary text-sm font-bold flex items-center gap-1 hover:opacity-80 transition-opacity">
              <Plus className="w-4 h-4" /> Add Custom
            </button>
          </div>
          
          <div className="space-y-3">
            {/* Contract Card 1 */}
            <div className="bg-surface-container-low rounded-2xl p-5 flex items-center justify-between ghost-border hover:bg-surface-container transition-all">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
                  <img alt="Uniswap" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA2EHmsUf3b78Sm9mFh-_j69SEGoyUrrzPl5mnaMyJ4ISb5CV2yjt0LvWj9vUh1vndeOJ-U4GJVnAYyGKiqxi1v4LwbAE7DnYX0uBa1KAiGGRDX6jjioZnCUJhDVrXxs9bgrrwYZtABlFKu-J3DRJ2tdCAb9fudRt-YF6aJtXaEsfQc_Abjx_vnvASaIC0-IetqzYy1PRwuezTBwcYiM3Pk55pVwPF7zEsmVJdfzAYEjhL7nuZKccgo-0W6-XaSBIfB-urRzwEfNZOP" referrerPolicy="no-referrer" />
                </div>
                <div>
                  <p className="font-bold text-on-surface text-lg">Uniswap V3 Router</p>
                  <p className="text-xs text-slate-500 font-mono">0xef1c...13b4</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-[10px] font-black uppercase tracking-tighter">Pre-Selected</span>
                <button type="button" className="text-slate-600 hover:text-slate-400 transition-colors">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Contract Card 2 */}
            <div className="bg-surface-container-low rounded-2xl p-5 flex items-center justify-between ghost-border hover:bg-surface-container transition-all">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
                  <img alt="Aave" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDKE15c0ERolAoStHzNgm5BlfYCq0U0o5O_pFHYK0m9UlnE7ne_T3iWnYsR8ovYvBmjjaiuDA0u0xIl3N8oA76IO0G9GJ4ASlAI0oM7zSFHPzxMG-kIRhxQC3m0JZWFAzUrBLlQs7Scuz2yCA6ppHREptvTg2EYPHrU4uC9ToqEldM3paN81MRQi8m-BuVmy-M8Plh15AiJI5mZYqILUq_kuf7xaPd_xjz-iztFa884UMJz-qADuhVQMNhOcP3-nz5ntZOdOdhixjto" referrerPolicy="no-referrer" />
                </div>
                <div>
                  <p className="font-bold text-on-surface text-lg">Aave V3 Pool</p>
                  <p className="text-xs text-slate-500 font-mono">0x8787...714d</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" className="text-slate-600 hover:text-slate-400 transition-colors">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Contract Card 3 */}
            <div className="bg-surface-container-low rounded-2xl p-5 flex items-center justify-between ghost-border hover:bg-surface-container transition-all">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
                  <img alt="Lido" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDVcFhToTFXDZIk1XLHPE2E4TLx2M4mKdHUp8PAty4aCYbgUgLvZdeJyIGCss3mgEAxWJu9hPQQRqTiyhpavfosAMqD-zy_ZpVj34QfmZ6h6FEZFPHB2X3oDGt50ECZhs6AY8Fq4Zk7KablstryNh7uNDZ6eyDPtvZHbEre9977Qr-XzWQ6eXQa79yUaGBs742nt1LJkGkiT-TU4zS_HBhtqMqO69e_Obfz0CBNaLTiHTijZp8VWNmGMVCFMz1TZJCwgOfDH_eecvOP" referrerPolicy="no-referrer" />
                </div>
                <div>
                  <p className="font-bold text-on-surface text-lg">Lido Staking</p>
                  <p className="text-xs text-slate-500 font-mono">0xae7a...1476</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" className="text-slate-600 hover:text-slate-400 transition-colors">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Token Approvals Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-headline font-bold flex items-center gap-3">
              <BadgeCheck className="w-6 h-6 text-primary" />
              Token Approvals
            </h2>
          </div>
          
          <div className="bg-surface-container-low rounded-3xl p-6 ghost-border space-y-6">
            {/* Approval Item 1 */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#131b2e] flex items-center justify-center border border-white/5 flex-shrink-0 overflow-hidden">
                  <img alt="USDC" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBp5uC7qRoT6kR54XlW-4u_aPcVt-KmyRO2t0CpRqKIEXcvKa_CQMhYnNONUhXs-u0rOXeVM155-1Xoc7P2BTNthlG3xeqrNqtttNPHe9aWUoi8wvZQU-PSX4bNuKCXRB8pLkMTLxa2HnKY0Yxguvw1xEgoH5zTus_nZ-CDrK7mr_5ohQRrdzY6ed_yjTiwDHz0H9Gg9YnRWPwacE2736h2FTjU_CglsixmPHaFCIp4pvLWsfB8B63LI9RanHiAgSK4NeDM7x94kEUT" referrerPolicy="no-referrer" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-on-surface text-lg">USDC</p>
                    <span className="px-2 py-0.5 rounded-full bg-secondary/10 text-secondary text-[10px] font-mono font-bold">Infinite</span>
                  </div>
                  <p className="text-xs text-slate-500">Approved for Uniswap V3</p>
                </div>
              </div>
              <button type="button" className="px-5 py-2 rounded-xl bg-error/10 text-error text-xs font-bold border border-error/20 hover:bg-error/20 transition-all">
                Revoke
              </button>
            </div>
            
            <div className="h-px bg-white/5"></div>
            
            {/* Approval Item 2 */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#131b2e] flex items-center justify-center border border-white/5 flex-shrink-0 overflow-hidden">
                  <img alt="WETH" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAHHe_L-ymq5TmrZ8JxYWOArrno-l2vEgAiUFQ41xHsvPm-i5fBPPKmHnS5ktlVWLEoSh-aHdH-x_zNHfy3STDVWFir2MbLbWP260X0AC9o4PsT8J_2weRlaW5xVLq_9qsSVWmTlThZdU5KeuXfzSqsoQuV9-3sJ4uuWtCLEYid6s4ifP1_3v0faGSjo5EHc5um0Oh-RwZ13jbx7_PjHym8CQ5LTH5BkAJ-RTevaj6qSiks_aC0QTube-jj2H-jGE3dksxJyS8noj74" referrerPolicy="no-referrer" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-on-surface text-lg">WETH</p>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-mono font-bold">5.00</span>
                  </div>
                  <p className="text-xs text-slate-500">Approved for Aave V3</p>
                </div>
              </div>
              <button type="button" className="px-5 py-2 rounded-xl bg-error/10 text-error text-xs font-bold border border-error/20 hover:bg-error/20 transition-all">
                Revoke
              </button>
            </div>
            
            <div className="h-px bg-white/5"></div>
            
            {/* Approval Item 3 */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#131b2e] flex items-center justify-center border border-white/5 flex-shrink-0 overflow-hidden">
                  <img alt="LINK" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDKeXepM487_tTrKxgRmOe7OwrFchPzlLHIv0Ry85-_w28uGwLmDCkyZVxNrNaxwuvplGV5vkW3NQ9Z1A7dRPnrvRfc9Oe5bOiT58GqcA2XX1VEWEdc-St6jr3CzldS240r-k1ivv5FZxCpuFmjmCmfhKuqQoiyixwhefKC1wdWr96YJuZep52KmOSXY63QvtekNMoBh1zThDmIis-INeszp3QBx_G5fv4tR7xZp0-N9Pm7YLozF2hRGW_IcMrq-aXxKlldlEjGsbLl" referrerPolicy="no-referrer" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-on-surface text-lg">LINK</p>
                    <span className="px-2 py-0.5 rounded-full bg-secondary/10 text-secondary text-[10px] font-mono font-bold">Infinite</span>
                  </div>
                  <p className="text-xs text-slate-500">Approved for Lido</p>
                </div>
              </div>
              <button type="button" className="px-5 py-2 rounded-xl bg-error/10 text-error text-xs font-bold border border-error/20 hover:bg-error/20 transition-all">
                Revoke
              </button>
            </div>
            
            <button type="button" className="w-full py-5 rounded-2xl bg-surface-container-high text-on-surface font-bold text-sm border-dashed border-2 border-white/10 hover:border-primary/50 hover:bg-surface-variant transition-all">
              + New Approval Strategy
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
