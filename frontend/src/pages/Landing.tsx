import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Cpu, Search, FileText, Star, ArrowRight,
  Layers, Zap, Shield, ChevronDown,
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

const features = [
  {
    icon: Layers,
    title: 'Multi-Agent Pipeline',
    desc: 'Planner, Retriever, Ranker, Writer, and Critic agents work together to produce high-quality research reports.',
    color: 'text-violet-500',
    bg: 'bg-violet-50',
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    desc: 'Real-time streaming output lets you watch the report being generated live with immediate feedback.',
    color: 'text-amber-500',
    bg: 'bg-amber-50',
  },
  {
    icon: Shield,
    title: 'Local & Private',
    desc: 'Powered by Ollama — all inference happens on your machine. Your data never leaves your device.',
    color: 'text-emerald-500',
    bg: 'bg-emerald-50',
  },
  {
    icon: Search,
    title: 'Smart Retrieval',
    desc: 'DuckDuckGo search combined with relevance ranking surfaces the most useful sources for any topic.',
    color: 'text-sky-500',
    bg: 'bg-sky-50',
  },
  {
    icon: FileText,
    title: 'Rich Reports',
    desc: 'Export polished Markdown or PDF reports with citations, summaries, and quality scores.',
    color: 'text-rose-500',
    bg: 'bg-rose-50',
  },
  {
    icon: Star,
    title: 'Critic Review',
    desc: 'An autonomous Critic agent evaluates every report for quality, coverage, and citation accuracy.',
    color: 'text-orange-500',
    bg: 'bg-orange-50',
  },
]

const steps = [
  { step: '01', title: 'Enter your query', desc: 'Type any research topic and choose depth — quick, standard, or deep.' },
  { step: '02', title: 'Agents get to work', desc: 'The pipeline plans sub-questions, retrieves sources, ranks them, and drafts the report.' },
  { step: '03', title: 'Review & export', desc: 'Read the live-generated report, check the critic score, and export to Markdown or PDF.' },
]

export default function Landing() {
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '20%'])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">
      {/* ── Navbar ───────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
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
              className="text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative min-h-screen flex flex-col items-center justify-center pt-14 overflow-hidden">
        {/* Background gradient blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-primary-100 rounded-full opacity-40 blur-3xl" />
          <div className="absolute -bottom-20 -right-40 w-[500px] h-[500px] bg-violet-100 rounded-full opacity-30 blur-3xl" />
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
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary-50 border border-primary-100 rounded-full text-primary-700 text-xs font-semibold mb-6"
          >
            <Cpu className="w-3.5 h-3.5" />
            Local-first · Powered by Ollama
          </motion.div>

          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
            className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-tight mb-6"
          >
            AI Research,{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-violet-600">
              Fully Automated
            </span>
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
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-6 py-3 rounded-xl shadow-md shadow-primary-200 transition-all hover:scale-105"
            >
              Start Researching <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/signin"
              className="inline-flex items-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-700 font-semibold px-6 py-3 rounded-xl transition-all hover:bg-gray-50"
            >
              Sign In
            </Link>
          </motion.div>
        </motion.div>

        {/* Scroll cue */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 0.6, repeat: Infinity, repeatType: 'reverse' }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 text-gray-300"
        >
          <ChevronDown className="w-7 h-7" />
        </motion.div>
      </section>

      {/* ── Features Grid ────────────────────────────────────── */}
      <section className="py-28 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            className="text-center mb-16"
          >
            <p className="text-sm font-semibold text-primary-600 uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-4xl font-extrabold text-gray-900">Everything you need to research faster</h2>
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
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
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
      <section className="py-28 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            className="text-center mb-16"
          >
            <p className="text-sm font-semibold text-primary-600 uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-4xl font-extrabold text-gray-900">Three steps to a complete report</h2>
          </motion.div>

          <div className="space-y-10">
            {steps.map(({ step, title, desc }, i) => (
              <motion.div
                key={step}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                custom={i}
                className="flex gap-6 items-start"
              >
                <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-primary-600 text-white flex items-center justify-center font-extrabold text-lg shadow-md shadow-primary-200">
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
      <section className="py-28 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-sm font-semibold text-primary-400 uppercase tracking-widest mb-3">Under the hood</p>
            <h2 className="text-4xl font-extrabold">The research pipeline</h2>
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
                <div className="bg-white/10 border border-white/20 rounded-xl px-5 py-3 text-sm font-semibold backdrop-blur-sm hover:bg-white/15 transition-colors">
                  {agent}
                </div>
                {i < 4 && <ArrowRight className="w-4 h-4 text-gray-500 flex-shrink-0" />}
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
          className="max-w-2xl mx-auto px-6 text-center"
        >
          <h2 className="text-4xl font-extrabold text-gray-900 mb-5">
            Ready to automate your research?
          </h2>
          <p className="text-gray-500 text-lg mb-10">
            Create a free account and start generating AI-powered reports in minutes.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-8 py-4 rounded-xl shadow-lg shadow-primary-200 transition-all hover:scale-105 text-lg"
          >
            Create Free Account <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo.ico" alt="Dvelve" className="w-7 h-7 rounded-lg object-contain" />
            <span className="text-sm font-bold text-gray-700">Dvelve</span>
          </div>
          <p className="text-xs text-gray-400">© 2026 Dvelve. Local-first, privacy-first.</p>
        </div>
      </footer>
    </div>
  )
}
