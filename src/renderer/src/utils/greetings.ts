import type { ActiveSession, Stats, User } from '../../../preload/index.d'

interface GreetingContext {
  user: User | null
  session: ActiveSession | null
  stats: Stats | null
  streak: { currentDays: number; longestDays: number } | null
  dailyLimitMinutes: number
}

export interface Greeting {
  title: string
  subtitle: string
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const h = new Date().getHours()
  if (h < 6) return 'night'
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}

export function buildGreeting(ctx: GreetingContext): Greeting {
  const username = ctx.user?.username ?? 'there'
  const todaySeconds = Number(ctx.stats?.today_seconds ?? 0)
  const todayMinutes = Math.floor(todaySeconds / 60)
  const dailyLimit = ctx.dailyLimitMinutes
  const totalSessions = Number(ctx.stats?.total_sessions ?? 0)

  // Active session — highest priority
  if (ctx.session) {
    return {
      title: `Currently playing ${ctx.session.name}`,
      subtitle: pick([
        'Focus mode 🎯',
        'Have fun out there',
        'PlayGuard is keeping watch',
        `Detected via ${ctx.session.source}`
      ])
    }
  }

  // Brand-new user (no sessions yet)
  if (totalSessions === 0) {
    return {
      title: `Hi ${username}!`,
      subtitle: "Let's build healthier gaming habits together. Launch a game whenever you're ready."
    }
  }

  // Over daily limit
  if (todayMinutes > dailyLimit) {
    return {
      title: `${todayMinutes - dailyLimit} min over your limit`,
      subtitle: pick([
        'Tomorrow is a fresh start.',
        'Time to wind down — your eyes will thank you.',
        'Maybe a walk? Coming back stronger never hurt.'
      ])
    }
  }

  // Streak praise
  if (ctx.streak && ctx.streak.currentDays >= 3) {
    return {
      title: `Day ${ctx.streak.currentDays} of healthy streak`,
      subtitle: ctx.streak.currentDays === ctx.streak.longestDays
        ? "You're on your longest streak ever 🔥"
        : pick([
          'Keep it going.',
          "You're crushing it.",
          'Healthy habits in motion.'
        ])
    }
  }

  // Time-of-day greeting + stats teaser
  const tod = getTimeOfDay()
  const todTitles = {
    morning: [`Good morning, ${username}`, `Morning, ${username}`, 'Rise and grind'],
    afternoon: [`Welcome back, ${username}`, `Hey ${username}`],
    evening: [`Evening, ${username}`, `Welcome back, ${username}`],
    night: [`Late night, ${username}?`, `Up late, ${username}`]
  }
  const title = pick(todTitles[tod])

  // Subtitle varies based on today's progress
  let subtitle: string
  if (todayMinutes === 0) {
    subtitle = pick([
      "Here's your gaming summary",
      'Ready when you are',
      'No sessions yet today'
    ])
  } else if (todayMinutes < dailyLimit / 2) {
    subtitle = pick([
      `${todayMinutes} min in — pacing yourself well`,
      `${todayMinutes} min today — looking good`,
      "Here's your gaming summary"
    ])
  } else if (todayMinutes < dailyLimit) {
    const remaining = dailyLimit - todayMinutes
    subtitle = pick([
      `${remaining} min remaining today`,
      `${todayMinutes}/${dailyLimit} min today`,
      'Pace yourself — last stretch'
    ])
  } else {
    subtitle = "You've reached today's limit"
  }

  return { title, subtitle }
}