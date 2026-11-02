'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  Users, Calendar, Award, IndianRupee, ArrowUpRight, 
  ArrowDownRight, ShieldCheck, Sparkles, Plus, Clock, 
  ExternalLink, ArrowRight, Activity 
} from 'lucide-react'
import { MOCK_EVENTS, MOCK_USER } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'

const recentActivities = [
  { id: 'act-1', type: 'signup', user: 'Arjun Sharma', text: 'signed up for Premium Annual Tier', time: '2 mins ago' },
  { id: 'act-2', type: 'register', user: 'Priya Nambiar', text: 'registered for React 19 deep dive', time: '12 mins ago' },
  { id: 'act-3', type: 'register', user: 'Rohan Mehta', text: 'registered for AI/ML Hackathon 2026', time: '25 mins ago' },
  { id: 'act-4', type: 'payment', user: 'Amit Sen', text: 'completed ₹999 premium billing order', time: '1 hour ago' },
  { id: 'act-5', type: 'booking', user: 'Sneha Roy', text: 'booked a mentoring hour with Priya Nair', time: '2 hours ago' },
]

export default function AdminPage() {
  const [activities, setActivities] = useState(recentActivities)
  const [analytics, setAnalytics] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { getToken } = await import('@/lib/api')
        const token = getToken()
        const res = await fetch('/api/v1/admin/analytics', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
        if (res.ok) {
          const data = await res.json()
          setAnalytics(data)
        }
      } catch (err) {
        console.error('Failed to load admin analytics:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const totalUsersCount = analytics ? analytics.totalUsers : 2482
  const premiumUsersCount = analytics ? analytics.premiumUsers : 1164
  const totalEventsCount = analytics ? analytics.totalEvents : 18
  const totalResourcesCount = analytics ? analytics.totalResources : 12
  const totalRevenue = premiumUsersCount * 999

  return (
    <div className="space-y-8 select-none">
      {/* Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 p-8 text-white shadow-xl shadow-amber-500/5">
        <div className="absolute inset-0 bg-grid-white/[0.04] bg-[size:30px_30px]" />
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-xs font-semibold tracking-wide">
              <Sparkles className="w-3.5 h-3.5" />
              ANX Control Hub
            </div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight">
              Ecosystem Control Center
            </h1>
            <p className="text-zinc-400 max-w-xl text-xs md:text-sm leading-relaxed font-medium">
              Manage member cohorts, edit events, monitor global transaction analytics, and configure system gates.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 shrink-0">
            <Link
              href="/admin/submissions"
              className="px-4 py-2.5 bg-muted/80 hover:bg-muted text-foreground font-semibold rounded-xl text-xs transition-colors flex items-center gap-1.5 border border-border"
            >
              <Activity className="w-4 h-4 text-amber-500" /> Review Submissions & Bookings
            </Link>
            <Link
              href="/admin/events/create"
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow shadow-amber-500/15"
            >
              <Plus className="w-4 h-4" /> Create New Event
            </Link>
          </div>
        </div>
      </section>

      {/* KPI Cards Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* KPI 1 */}
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Students</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Users className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="font-display text-2xl font-bold text-foreground">{totalUsersCount}</h3>
            <p className="text-[10px] text-emerald-500 font-semibold flex items-center gap-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" /> Active members
            </p>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Premium Elites</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Award className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="font-display text-2xl font-bold text-foreground">{premiumUsersCount}</h3>
            <p className="text-[10px] text-emerald-500 font-semibold flex items-center gap-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" /> Subscribed cohort
            </p>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Published Events</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <Calendar className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="font-display text-2xl font-bold text-foreground">{totalEventsCount}</h3>
            <p className="text-[10px] text-muted-foreground font-medium">Platform schedule</p>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Estimated Yield</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <IndianRupee className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="font-display text-2xl font-bold text-foreground">{formatCurrency(totalRevenue)}</h3>
            <p className="text-[10px] text-emerald-500 font-semibold flex items-center gap-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" /> Verified subscriptions
            </p>
          </div>
        </div>
      </section>

      {/* Grid: Charts + Activities */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Analytics Growth Chart (Left 2 Columns) */}
        <div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="font-display text-base font-bold text-foreground">User Growth Metrics</h3>
              <p className="text-[10px] text-muted-foreground">Month-on-month cohort subscription trends</p>
            </div>
            <Link href="/admin/analytics" className="text-xs font-bold text-amber-500 hover:underline flex items-center gap-1">
              Deep Analytics <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Premium custom animated line chart */}
          <div className="h-64 relative flex items-end justify-between border-b border-border/40 pb-2">
            {/* Chart Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              <div className="border-t border-border/20 w-full" />
              <div className="border-t border-border/20 w-full" />
              <div className="border-t border-border/20 w-full" />
              <div className="border-t border-border/20 w-full" />
            </div>

            {/* Custom SVG Line Chart */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {/* Fill Gradient Area */}
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              
              {/* Path area */}
              <path
                d="M 0 90 Q 20 60 40 70 T 80 30 T 100 20 L 100 100 L 0 100 Z"
                fill="url(#chartGradient)"
              />
              {/* Main Line */}
              <motion.path
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
                d="M 0 90 Q 20 60 40 70 T 80 30 T 100 20"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>

            {/* Labels */}
            <div className="text-[10px] font-bold text-muted-foreground w-full flex justify-between pt-4 select-none relative z-10 -bottom-8">
              <span>Jan</span>
              <span>Feb</span>
              <span>Mar</span>
              <span>Apr</span>
              <span>May</span>
              <span>Jun</span>
            </div>
          </div>
        </div>

        {/* Activity Feed (Right 1 Column) */}
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-500 animate-pulse" />
              <h3 className="font-display text-base font-bold text-foreground">Ecosystem Ticker</h3>
            </div>
          </div>

          <div className="space-y-4 max-h-72 overflow-y-auto scrollbar-thin">
            {activities.map((act) => (
              <div key={act.id} className="flex gap-2.5 border-b border-border/30 pb-3 last:border-0 last:pb-0">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-2" />
                <div className="text-[11px] leading-relaxed">
                  <span className="font-bold text-foreground block">{act.user}</span>
                  <span className="text-muted-foreground">{act.text}</span>
                  <span className="text-[9px] text-muted-foreground block mt-0.5">{act.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cohort Stats Distribution */}
      <section className="bg-muted/10 border border-border/40 rounded-2xl p-6 space-y-4">
        <h3 className="font-display text-base font-bold text-foreground">Cohort Segment Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-medium">
          {/* Item 1 */}
          <div className="bg-card border border-border/40 p-4.5 rounded-xl space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>IIT Madras Core</span>
              <span>48%</span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: '48%' }} />
            </div>
          </div>

          {/* Item 2 */}
          <div className="bg-card border border-border/40 p-4.5 rounded-xl space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Active Mentor Bookings</span>
              <span>76%</span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 rounded-full" style={{ width: '76%' }} />
            </div>
          </div>

          {/* Item 3 */}
          <div className="bg-card border border-border/40 p-4.5 rounded-xl space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Course Completions</span>
              <span>32%</span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: '32%' }} />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
