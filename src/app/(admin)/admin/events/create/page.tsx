'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Plus, ArrowLeft, Save, Sparkles, MapPin, 
  Video, Calendar, Clock, Users, Award 
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/modules/module3/components/AuthContext'
import { getAuthToken } from '@/lib/auth-helpers'

export default function CreateEventPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'workshop',
    date: '',
    time: '',
    duration: 120,
    venue: '',
    isOnline: false,
    meetingLink: '',
    speaker: '',
    speakerBio: '',
    capacity: 100,
    price: 0,
    premiumOnly: false,
  })

  const update = (key: keyof typeof form, val: any) => {
    setForm(p => ({ ...p, [key]: val }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.title.trim()) {
      toast.error('Please enter an event title.')
      return
    }
    if (!form.description.trim()) {
      toast.error('Please enter an event description.')
      return
    }
    if (!form.date) {
      toast.error('Please select an event date.')
      return
    }

    setLoading(true)
    try {
      let token = await getAuthToken(user)
      if (!token && typeof window !== 'undefined') {
        token = localStorage.getItem('anx_token') || localStorage.getItem('session') || 'mock_admin_token'
      }

      const response = await fetch('/api/v1/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || 'mock_admin_token'}`
        },
        body: JSON.stringify(form)
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.success === false) {
        throw new Error(data.message || data.error || 'Failed to create event')
      }

      toast.success('New Ecosystem Event created and published successfully! 🚀')
      router.push('/admin/events')
    } catch (err: any) {
      console.error('Event creation submit error:', err)
      toast.error(err.message || 'Error creating event. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8 select-none max-w-4xl">
      {/* Back button */}
      <div>
        <button 
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Catalog
        </button>
      </div>

      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Schedule New Event</h1>
        <p className="text-xs text-muted-foreground mt-1">Publish workshops, webinars, hackathons, and networking sessions to student dashboards.</p>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-card border border-border/50 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
        {/* Core details */}
        <div className="space-y-4">
          <h3 className="font-display text-base font-bold text-foreground border-b border-border/40 pb-2">1. Session Core Details</h3>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Event Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Next.js 16 Production Architectures Masterclass"
              value={form.title}
              onChange={e => update('title', e.target.value)}
              className="w-full px-3.5 py-2.5 bg-muted border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-card transition-all"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Category Category</label>
              <select
                value={form.category}
                onChange={e => update('category', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-muted border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-card transition-all"
              >
                <option value="workshop">Workshop</option>
                <option value="webinar">Webinar</option>
                <option value="hackathon">Hackathon</option>
                <option value="networking">Networking</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Speaker Name</label>
              <input
                type="text"
                placeholder="e.g. Priya Nair"
                value={form.speaker}
                onChange={e => update('speaker', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-muted border border-border rounded-xl text-xs text-foreground focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Speaker Biography</label>
            <textarea
              rows={2}
              placeholder="e.g. Senior Frontend Architect at Vercel..."
              value={form.speakerBio}
              onChange={e => update('speakerBio', e.target.value)}
              className="w-full px-3.5 py-2.5 bg-muted border border-border rounded-xl text-xs text-foreground focus:outline-none leading-relaxed"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Event Long Description</label>
            <textarea
              required
              rows={4}
              placeholder="Provide a comprehensive summary of what student attendees will learn, session targets, and software prerequisites..."
              value={form.description}
              onChange={e => update('description', e.target.value)}
              className="w-full px-3.5 py-2.5 bg-muted border border-border rounded-xl text-xs text-foreground focus:outline-none leading-relaxed"
            />
          </div>
        </div>

        {/* Schedule & capacity */}
        <div className="space-y-4 pt-4 border-t border-border/40">
          <h3 className="font-display text-base font-bold text-foreground border-b border-border/40 pb-2">2. Scheduling & Logistics</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Select Date
              </label>
              <input
                type="date"
                required
                value={form.date}
                onChange={e => update('date', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-muted border border-border rounded-xl text-xs text-foreground focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Start Time
              </label>
              <input
                type="text"
                required
                placeholder="10:00 AM"
                value={form.time}
                onChange={e => update('time', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-muted border border-border rounded-xl text-xs text-foreground focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Duration (Minutes)</label>
              <input
                type="number"
                required
                value={form.duration}
                onChange={e => update('duration', parseInt(e.target.value) || 120)}
                className="w-full px-3.5 py-2.5 bg-muted border border-border rounded-xl text-xs text-foreground focus:outline-none"
              />
            </div>
          </div>

          {/* Location details */}
          <div className="space-y-3 bg-muted/20 p-4.5 rounded-2xl border border-border/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Is this a Virtual Live Webinar?</span>
              <button
                type="button"
                onClick={() => update('isOnline', !form.isOnline)}
                className={`w-12 h-6.5 rounded-full p-1 flex items-center transition-all ${
                  form.isOnline ? 'bg-amber-500' : 'bg-zinc-600'
                }`}
              >
                <div 
                  className="w-4.5 h-4.5 rounded-full bg-white transition-transform" 
                  style={{ transform: form.isOnline ? 'translateX(22px)' : 'translateX(0px)' }}
                />
              </button>
            </div>

            {form.isOnline ? (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Video className="w-3.5 h-3.5 text-primary" /> Live Webinar Room Link
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://meet.google.com/abc-defg-hij"
                  value={form.meetingLink}
                  onChange={e => update('meetingLink', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-muted border border-border rounded-xl text-xs text-foreground focus:outline-none"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-primary" /> Physical Venue & Room No.
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Seminar Hall A, CS Dept, IIT Madras"
                  value={form.venue}
                  onChange={e => update('venue', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-muted border border-border rounded-xl text-xs text-foreground focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* Capacity & pricing */}
        <div className="space-y-4 pt-4 border-t border-border/40">
          <h3 className="font-display text-base font-bold text-foreground border-b border-border/40 pb-2">3. Gates & Pricing</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Capacity Spots
              </label>
              <input
                type="number"
                required
                value={form.capacity}
                onChange={e => update('capacity', parseInt(e.target.value) || 100)}
                className="w-full px-3.5 py-2.5 bg-muted border border-border rounded-xl text-xs text-foreground focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Price (₹ - 0 for Free)</label>
              <input
                type="number"
                required
                value={form.price}
                onChange={e => update('price', parseInt(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 bg-muted border border-border rounded-xl text-xs text-foreground focus:outline-none"
              />
            </div>

            <div className="space-y-1.5 flex flex-col justify-end pb-1">
              <div className="flex items-center justify-between bg-muted/20 border border-border/40 p-2.5 rounded-xl">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-amber-500" /> Premium Only?
                </span>
                <button
                  type="button"
                  onClick={() => update('premiumOnly', !form.premiumOnly)}
                  className={`w-10 h-5 rounded-full p-0.5 flex items-center transition-all ${
                    form.premiumOnly ? 'bg-amber-500' : 'bg-zinc-600'
                  }`}
                >
                  <div 
                    className="w-4 h-4 rounded-full bg-white transition-transform" 
                    style={{ transform: form.premiumOnly ? 'translateX(18px)' : 'translateX(0px)' }}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-6 border-t border-border/40 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-3 text-xs font-semibold border border-border rounded-xl hover:bg-muted text-foreground transition-colors"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-3 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold rounded-xl text-xs transition-all shadow shadow-amber-500/10 flex items-center gap-1.5"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" /> Publish Ecosystem Event
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
