/**
 * Lead Scoring con IA
 * Sistema de puntuación automática basado en comportamiento y datos
 */

export interface LeadScoreFactors {
  // Datos demográficos (0-25 puntos)
  demographic: {
    hasEmail: boolean
    hasPhone: boolean
    hasCompany: boolean
    hasPosition: boolean
    industryMatch: boolean
    locationMatch: boolean
  }
  
  // Engagement (0-35 puntos)
  engagement: {
    emailsOpened: number
    emailsClicked: number
    websiteVisits: number
    pagesViewed: number
    formsSubmitted: number
    documentsDownloaded: number
    meetingsScheduled: number
  }
  
  // Comportamiento (0-25 puntos)
  behavior: {
    responseTime: 'fast' | 'medium' | 'slow' | 'none' // Tiempo de respuesta a emails
    interactionFrequency: 'high' | 'medium' | 'low'
    lastInteractionDays: number
    requestedQuote: boolean
    requestedDemo: boolean
  }
  
  // Fit (0-15 puntos)
  fit: {
    budgetRange: 'high' | 'medium' | 'low' | 'unknown'
    decisionMaker: boolean
    timeline: 'immediate' | 'short' | 'medium' | 'long' | 'unknown'
    companySize: 'enterprise' | 'midmarket' | 'small' | 'unknown'
  }
}

export interface LeadScoreResult {
  totalScore: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  breakdown: {
    demographic: number
    engagement: number
    behavior: number
    fit: number
  }
  recommendations: string[]
  predictedConversion: number // 0-100%
  nextBestAction: string
}

/**
 * Calcula el score de un lead
 */
export function calculateLeadScore(factors: LeadScoreFactors): LeadScoreResult {
  const breakdown = {
    demographic: calculateDemographicScore(factors.demographic),
    engagement: calculateEngagementScore(factors.engagement),
    behavior: calculateBehaviorScore(factors.behavior),
    fit: calculateFitScore(factors.fit),
  }

  const totalScore = breakdown.demographic + breakdown.engagement + breakdown.behavior + breakdown.fit
  const grade = getGrade(totalScore)
  const recommendations = generateRecommendations(factors, breakdown)
  const predictedConversion = predictConversion(totalScore, factors)
  const nextBestAction = determineNextAction(factors, breakdown)

  return {
    totalScore,
    grade,
    breakdown,
    recommendations,
    predictedConversion,
    nextBestAction,
  }
}

function calculateDemographicScore(demo: LeadScoreFactors['demographic']): number {
  let score = 0
  if (demo.hasEmail) score += 5
  if (demo.hasPhone) score += 5
  if (demo.hasCompany) score += 5
  if (demo.hasPosition) score += 3
  if (demo.industryMatch) score += 4
  if (demo.locationMatch) score += 3
  return Math.min(score, 25)
}

function calculateEngagementScore(eng: LeadScoreFactors['engagement']): number {
  let score = 0
  
  // Emails (max 10)
  score += Math.min(eng.emailsOpened * 1, 5)
  score += Math.min(eng.emailsClicked * 2, 5)
  
  // Website (max 10)
  score += Math.min(eng.websiteVisits * 0.5, 3)
  score += Math.min(eng.pagesViewed * 0.3, 3)
  score += Math.min(eng.formsSubmitted * 2, 4)
  
  // High-value actions (max 15)
  score += Math.min(eng.documentsDownloaded * 3, 6)
  score += Math.min(eng.meetingsScheduled * 5, 9)
  
  return Math.min(Math.round(score), 35)
}

function calculateBehaviorScore(beh: LeadScoreFactors['behavior']): number {
  let score = 0
  
  // Response time
  const responseScores = { fast: 8, medium: 5, slow: 2, none: 0 }
  score += responseScores[beh.responseTime]
  
  // Interaction frequency
  const freqScores = { high: 7, medium: 4, low: 1 }
  score += freqScores[beh.interactionFrequency]
  
  // Recency (penalizar inactividad)
  if (beh.lastInteractionDays <= 7) score += 5
  else if (beh.lastInteractionDays <= 14) score += 3
  else if (beh.lastInteractionDays <= 30) score += 1
  
  // High-intent actions
  if (beh.requestedQuote) score += 3
  if (beh.requestedDemo) score += 2
  
  return Math.min(score, 25)
}

function calculateFitScore(fit: LeadScoreFactors['fit']): number {
  let score = 0
  
  // Budget
  const budgetScores = { high: 5, medium: 3, low: 1, unknown: 0 }
  score += budgetScores[fit.budgetRange]
  
  // Decision maker
  if (fit.decisionMaker) score += 4
  
  // Timeline
  const timelineScores = { immediate: 4, short: 3, medium: 2, long: 1, unknown: 0 }
  score += timelineScores[fit.timeline]
  
  // Company size
  const sizeScores = { enterprise: 2, midmarket: 2, small: 1, unknown: 0 }
  score += sizeScores[fit.companySize]
  
  return Math.min(score, 15)
}

function getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 80) return 'A'
  if (score >= 60) return 'B'
  if (score >= 40) return 'C'
  if (score >= 20) return 'D'
  return 'F'
}

function generateRecommendations(factors: LeadScoreFactors, breakdown: LeadScoreResult['breakdown']): string[] {
  const recommendations: string[] = []

  // Demographic recommendations
  if (!factors.demographic.hasPhone) {
    recommendations.push('Obtener número de teléfono del contacto')
  }
  if (!factors.demographic.hasCompany) {
    recommendations.push('Identificar la empresa del lead')
  }

  // Engagement recommendations
  if (factors.engagement.emailsOpened === 0) {
    recommendations.push('Mejorar asuntos de email para aumentar apertura')
  }
  if (factors.engagement.meetingsScheduled === 0 && breakdown.engagement > 10) {
    recommendations.push('Proponer una llamada o reunión')
  }

  // Behavior recommendations
  if (factors.behavior.lastInteractionDays > 14) {
    recommendations.push('Reactivar contacto - sin interacción reciente')
  }
  if (factors.behavior.responseTime === 'none') {
    recommendations.push('Intentar contacto por otro canal (WhatsApp/teléfono)')
  }

  // Fit recommendations
  if (factors.fit.budgetRange === 'unknown') {
    recommendations.push('Calificar presupuesto disponible')
  }
  if (!factors.fit.decisionMaker) {
    recommendations.push('Identificar al tomador de decisiones')
  }

  return recommendations.slice(0, 5) // Max 5 recommendations
}

function predictConversion(score: number, factors: LeadScoreFactors): number {
  // Modelo simplificado de predicción
  let baseConversion = score * 0.8 // Base: score * 0.8

  // Ajustes por factores de alto impacto
  if (factors.behavior.requestedQuote) baseConversion += 10
  if (factors.behavior.requestedDemo) baseConversion += 8
  if (factors.fit.decisionMaker) baseConversion += 5
  if (factors.fit.timeline === 'immediate') baseConversion += 10
  if (factors.behavior.lastInteractionDays > 30) baseConversion -= 15

  return Math.min(Math.max(Math.round(baseConversion), 0), 100)
}

function determineNextAction(factors: LeadScoreFactors, breakdown: LeadScoreResult['breakdown']): string {
  // Priorizar acciones según el estado del lead
  
  if (factors.behavior.requestedQuote || factors.behavior.requestedDemo) {
    return 'Llamar inmediatamente - lead caliente'
  }
  
  if (breakdown.engagement > 20 && factors.behavior.lastInteractionDays <= 7) {
    return 'Enviar propuesta comercial'
  }
  
  if (breakdown.demographic < 15) {
    return 'Completar información del contacto'
  }
  
  if (factors.behavior.lastInteractionDays > 14) {
    return 'Enviar email de seguimiento'
  }
  
  if (!factors.fit.decisionMaker && breakdown.fit < 10) {
    return 'Calificar: identificar decisor y presupuesto'
  }
  
  if (breakdown.engagement < 10) {
    return 'Nutrir con contenido relevante'
  }
  
  return 'Programar llamada de seguimiento'
}

/**
 * Actualiza el score de un lead basado en una acción
 */
export function updateScoreForAction(
  currentScore: number,
  action: 'email_opened' | 'email_clicked' | 'form_submitted' | 'meeting_scheduled' | 'quote_requested' | 'demo_requested' | 'website_visit'
): number {
  const actionPoints: Record<string, number> = {
    email_opened: 1,
    email_clicked: 3,
    form_submitted: 5,
    meeting_scheduled: 10,
    quote_requested: 15,
    demo_requested: 12,
    website_visit: 1,
  }

  const newScore = currentScore + (actionPoints[action] || 0)
  return Math.min(newScore, 100)
}

/**
 * Determina el status del lead basado en el score
 */
export function getLeadStatus(score: number): 'cold' | 'warm' | 'hot' {
  if (score >= 70) return 'hot'
  if (score >= 40) return 'warm'
  return 'cold'
}
