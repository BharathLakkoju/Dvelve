import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Cpu, Search, FileText, Star, ArrowRight,
  Layers, Zap, Shield, ChevronDown, CheckCircle2,
  Bot, Sparkles, Globe,
} from 'lucide-react'

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
}

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
}

const stats = [
  { value: '5', label: 'Specialized agents per report' },
  { value: '100%', label: 'Functional fully offline' },
  { value: '0', label: 'Bytes leave your device in offline mode' },
]

const features = [
  {
    icon: Layers,
    title: 'Multi-Agent Pipeline',
    desc: 'Planner, Retriever, Ranker, Writer, and Critic agents work together to produce high-quality research reports.',
    color: 'text-accent-600',
    bg: 'bg-accent-50',
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    desc: 'Real-time streaming output lets you watch the report being generated live with immediate feedback.',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  {
    icon: Shield,
    title: 'Local & Private',
    desc: 'Powered by Ollama — all inference happens on your machine. Your data never leaves your device.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    icon: Search,
    title: 'Smart Retrieval',
    desc: 'DuckDuckGo search combined with relevance ranking surfaces the most useful sources for any topic.',
    color: 'text-sky-600',
    bg: 'bg-sky-50',
  },
  {
    icon: FileText,
    title: 'Rich Reports',
    desc: 'Export polished Markdown or PDF reports with citations, summaries, and quality scores.',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
  },
  {
    icon: Star,
    title: 'Critic Review',
    desc: 'An autonomous Critic agent evaluates every report for quality, coverage, and citation accuracy.',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
  },
]

const steps = [
  { step: '01', title: 'Enter your query', desc: 'Type any research topic and choose depth — quick, standard, or deep.' },
  { step: '02', title: 'Agents get to work', desc: 'The pipeline plans sub-questions, retrieves sources, ranks them, and drafts the report.' },
  { step: '03', title: 'Review & export', desc: 'Read the live-generated report, check the critic score, and export to Markdown or PDF.' },
]

const pipelineAgents = [
  { key: 'Planner', icon: Layers },
  { key: 'Retriever', icon: Search },
  { key: 'Ranker', icon: Star },
  { key: 'Writer', icon: FileText },
  { key: 'Critic', icon: CheckCircle2 },
]

export default function Landing() {
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '20%'])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">
      {/* ── Navbar ───────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/70 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.ico" alt="Dvelve" className="w-8 h-8 rounded-lg object-contain" />
            <span className="font-bold text-gray-900 text-sm tracking-tight">Dvelve</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/signin"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-4 py-2"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="text-sm font-semibold text-white px-4 py-2 rounded-xl bg-gradient-to-b from-primary-500 to-primary-600 shadow-elevated hover:shadow-glow hover:-translate-y-px transition-all duration-200"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative min-h-[92vh] flex flex-col items-center justify-center pt-16 overflow-hidden">
        {/* Background: soft grid + glow blobs */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.35]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(79,70,229,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(79,70,229,0.08) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(ellipse 60% 50% at 50% 20%, black 40%, transparent 90%)',
          }}
        />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-primary-100 rounded-full opacity-50 blur-3xl animate-float" />
          <div className="absolute -bottom-20 -right-40 w-[500px] h-[500px] bg-accent-100 rounded-full opacity-40 blur-3xl animate-float" style={{ animationDelay: '1.5s' }} />
        </div>

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative z-10 max-w-4xl mx-auto px-6 text-center"
        >
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-primary-100 rounded-full text-primary-700 text-xs font-semibold mb-6 shadow-soft"
          >
            <Cpu className="w-3.5 h-3.5" />
            Local-first · Powered by Ollama
          </motion.div>

          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
            className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6"
          >
            AI Research,{' '}
            <span className="text-gradient">Fully Automated</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={2}
            className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            A multi-agent pipeline that plans, retrieves, ranks, writes, and critiques
            research reports — all running locally on your machine.
          </motion.p>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={3}
            className="flex flex-wrap items-center justify-center gap-4 mb-16"
          >
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 text-white font-semibold px-6 py-3 rounded-xl bg-gradient-to-b from-primary-500 to-primary-600 shadow-floating hover:shadow-glow hover:-translate-y-0.5 transition-all duration-200"
            >
              Start Researching <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/signin"
              className="inline-flex items-center gap-2 border border-gray-200 hover:border-gray-300 bg-white text-gray-700 font-semibold px-6 py-3 rounded-xl transition-all hover:bg-gray-50 shadow-soft"
            >
              Sign In
            </Link>
          </motion.div>

          {/* Product visual — live pipeline mockup */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={4}
            className="relative mx-auto max-w-2xl rounded-3xl border border-gray-100 bg-white shadow-floating overflow-hidden text-left"
          >
            <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50/60">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
              </div>
              <span className="text-xs font-medium text-gray-400 ml-2">Live Reasoning Stream</span>
            </div>
            <div className="p-5 grid grid-cols-5 gap-2">
              {pipelineAgents.map(({ key, icon: Icon }, i) => (
                <div key={key} className="flex flex-col items-center gap-1.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${i < 3 ? 'bg-emerald-50 text-emerald-500' : i === 3 ? 'bg-primary-50 text-primary-500' : 'bg-gray-50 text-gray-300'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-semibold text-gray-500">{key}</span>
                </div>
              ))}
            </div>
            <div className="px-5 pb-5 space-y-2">
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-primary-500 to-accent-500" />
              </div>
              <p className="text-xs text-gray-400 italic">"Drafting section 3 of 5 — comparing renewable adoption rates across regions…"</p>
            </div>
          </motion.div>
        </motion.div>

        {/* Scroll cue */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 0.6, repeat: Infinity, repeatType: 'reverse' }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-gray-300"
        >
          <ChevronDown className="w-7 h-7" />
        </motion.div>
      </section>

      {/* ── Stats strip ──────────────────────────────────────── */}
      <section className="border-y border-gray-100 bg-gray-50/60">
        <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={i}
              className="text-center"
            >
              <p className="text-4xl font-extrabold text-gradient mb-1">{s.value}</p>
              <p className="text-sm text-gray-500">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Features Grid ────────────────────────────────────── */}
      <section className="py-28 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            className="text-center mb-16"
          >
            <p className="text-sm font-semibold text-primary-600 uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">Everything you need to research faster</h2>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map(({ icon: Icon, title, desc, color, bg }, i) => (
              <motion.div
                key={title}
                variants={fadeUp}
                custom={i}
                className="card card-hover p-6"
              >
                <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center mb-4`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────── */}
      <section className="py-28 bg-gray-50/60">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            className="text-center mb-16"
          >
            <p className="text-sm font-semibold text-primary-600 uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">Three steps to a complete report</h2>
          </motion.div>

          <div className="relative space-y-10">
            <div className="absolute left-7 top-4 bottom-4 w-px bg-gray-200 hidden sm:block" />
            {steps.map(({ step, title, desc }, i) => (
              <motion.div
                key={step}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                custom={i}
                className="relative flex gap-6 items-start"
              >
                <div className="relative z-10 flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-b from-primary-500 to-primary-600 text-white flex items-center justify-center font-extrabold text-lg shadow-elevated">
                  {step}
                </div>
                <div className="pt-2">
                  <h3 className="font-bold text-xl text-gray-900 mb-1">{title}</h3>
                  <p className="text-gray-500 leading-relaxed">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Agent Pipeline Visual ─────────────────────────────── */}
      <section className="py-28 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-noise pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 relative">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-sm font-semibold text-primary-400 uppercase tracking-widest mb-3">Under the hood</p>
            <h2 className="text-4xl font-extrabold tracking-tight">The research pipeline</h2>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="flex flex-wrap justify-center gap-3"
          >
            {['Planner', 'Retriever', 'Ranker', 'Writer', 'Critic'].map((agent, i) => (
              <motion.div
                key={agent}
                variants={fadeUp}
                custom={i}
                className="flex items-center gap-2"
              >
                <div className="bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-sm font-semibold backdrop-blur-sm hover:bg-white/10 hover:border-white/20 transition-colors flex items-center gap-2">
                  <Bot className="w-4 h-4 text-primary-400" />
                  {agent}
                </div>
                {i < 4 && <ArrowRight className="w-4 h-4 text-gray-600 flex-shrink-0" />}
              </motion.div>
            ))}
          </motion.div>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={6}
            className="text-center text-gray-400 text-sm mt-8 max-w-2xl mx-auto"
          >
            Each agent specializes in one task. Together they deliver research reports
            that are thorough, well-sourced, and critically evaluated.
          </motion.p>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────── */}
      <section className="py-28 bg-white">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="max-w-3xl mx-auto px-6"
        >
          <div className="relative rounded-3xl bg-gradient-to-br from-primary-600 to-accent-600 px-8 py-16 text-center overflow-hidden shadow-floating">
            <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none" />
            <Sparkles className="w-8 h-8 text-white/70 mx-auto mb-5 relative" />
            <h2 className="text-4xl font-extrabold text-white mb-4 relative tracking-tight">
              Ready to automate your research?
            </h2>
            <p className="text-white/80 text-lg mb-10 relative">
              Create a free account and start generating AI-powered reports in minutes.
            </p>
            <Link
              to="/signup"
              className="relative inline-flex items-center gap-2 bg-white text-primary-700 font-semibold px-8 py-4 rounded-xl shadow-xl transition-all hover:scale-105 text-lg"
            >
              Create Free Account <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo.ico" alt="Dvelve" className="w-7 h-7 rounded-lg object-contain" />
            <span className="text-sm font-bold text-gray-700">Dvelve</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Globe className="w-3.5 h-3.5" />
            <span>© 2026 Dvelve. Local-first, privacy-first.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
