import React, { useMemo, useState } from 'react'
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Award,
  Clock,
  Zap,
  HelpCircle,
  Brain,
  ChevronDown,
  ChevronUp,
  Target,
  BarChart2,
  Users,
  Flame,
  ArrowRight,
  Info,
} from 'lucide-react'
import { type Assessment } from '../lib/assessmentService'
import { type StoredAttemptRecord } from '../lib/attemptService'
import {
  computeAssessmentStatistics,
  type AssessmentSubmissionStats,
} from '../lib/assessmentStatistics'

interface AssessmentSubmissionStatisticsProps {
  assessment: Assessment
  attempts?: StoredAttemptRecord[]
  className?: string
  defaultExpanded?: boolean
  showDetailedBreakdownToggle?: boolean
}

export const AssessmentSubmissionStatistics: React.FC<AssessmentSubmissionStatisticsProps> = ({
  assessment,
  attempts,
  className = '',
  defaultExpanded = true,
  showDetailedBreakdownToggle = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [showAllDomains, setShowAllDomains] = useState(false)

  const stats: AssessmentSubmissionStats = useMemo(() => {
    return computeAssessmentStatistics(assessment, attempts)
  }, [assessment, attempts])

  const {
    averageScore,
    medianScore,
    highestScore,
    lowestScore,
    passingPercentage,
    passingRate,
    totalSubmissions,
    topWeakDomains,
    topStrongDomains,
    errorPatterns,
    allDomains,
    commonTraps,
    keyTakeaway,
  } = stats

  return (
    <div
      className={`bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all duration-200 ${className}`}
    >
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-blue-500/20 text-blue-200 border border-blue-400/30">
                <BarChart2 className="h-3 w-3 text-blue-400" />
                Cohort Submission Intelligence
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-300 bg-white/10 px-2.5 py-0.5 rounded-full">
                <Users className="h-3 w-3 text-emerald-400" />
                {totalSubmissions} {totalSubmissions === 1 ? 'Submission' : 'Submissions'} Analyzed
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white mt-1.5">
              Submission Performance &amp; Diagnostic Statistics
            </h2>
            <p className="text-xs text-slate-300 mt-0.5 max-w-2xl leading-relaxed">
              Real-time statistical synthesis across all recorded student attempts: cohort mean, domain extremes, and behavioral mistake patterns.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition border border-white/10 cursor-pointer"
            >
              <span>{isExpanded ? 'Collapse Overview' : 'Expand Statistics'}</span>
              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Highlight strip with the 4 core answers */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/10 text-xs">
          {/* Stat 1: Average Score */}
          <div className="bg-white/5 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              1. Average Score
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-white">{averageScore}%</span>
              <span className="text-[10px] text-emerald-400 font-semibold">
                (Pass: ≥{passingPercentage}%)
              </span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 truncate">
              Pass rate: <span className="text-white font-medium">{passingRate}%</span> • Median: {medianScore}%
            </div>
          </div>

          {/* Stat 2: Common Top 2 Weak Domains */}
          <div className="bg-white/5 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <div className="text-[10px] uppercase font-bold tracking-wider text-rose-300 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-rose-400" />
              <span>2. Top Weak Domains</span>
            </div>
            <div className="mt-1 space-y-1">
              {topWeakDomains.length > 0 ? (
                topWeakDomains.slice(0, 2).map((d, idx) => (
                  <div key={d.name} className="flex items-center justify-between gap-1 text-[11px]">
                    <span className="truncate text-slate-200 max-w-[120px]">
                      {idx + 1}. {d.name}
                    </span>
                    <span className="font-bold text-rose-400 shrink-0">{d.accuracy}%</span>
                  </div>
                ))
              ) : (
                <div className="text-[11px] text-slate-400">No weak domains detected</div>
              )}
            </div>
          </div>

          {/* Stat 3: Common Top 2 Strong Domains */}
          <div className="bg-white/5 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-300 flex items-center gap-1">
              <Award className="h-3 w-3 text-emerald-400" />
              <span>3. Top Strong Domains</span>
            </div>
            <div className="mt-1 space-y-1">
              {topStrongDomains.length > 0 ? (
                topStrongDomains.slice(0, 2).map((d, idx) => (
                  <div key={d.name} className="flex items-center justify-between gap-1 text-[11px]">
                    <span className="truncate text-slate-200 max-w-[120px]">
                      {idx + 1}. {d.name}
                    </span>
                    <span className="font-bold text-emerald-400 shrink-0">{d.accuracy}%</span>
                  </div>
                ))
              ) : (
                <div className="text-[11px] text-slate-400">Evaluating proficiency...</div>
              )}
            </div>
          </div>

          {/* Stat 4: Common Error Patterns in percentages */}
          <div className="bg-white/5 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <div className="text-[10px] uppercase font-bold tracking-wider text-amber-300 flex items-center gap-1">
              <Zap className="h-3 w-3 text-amber-400" />
              <span>4. Common Error Patterns</span>
            </div>
            <div className="mt-1 space-y-0.5 text-[10px]">
              <div className="flex items-center justify-between text-slate-300">
                <span>Conceptual:</span>
                <span className="font-bold text-rose-300">{errorPatterns.conceptual.percentage}%</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Rushed (&lt;25s):</span>
                <span className="font-bold text-amber-300">{errorPatterns.rushed.percentage}%</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Timesink (&gt;90s):</span>
                <span className="font-bold text-sky-300">{errorPatterns.timesink.percentage}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Detailed Sections */}
      {isExpanded && (
        <div className="p-5 sm:p-6 space-y-6 bg-slate-50/50">
          {/* Key Educator Takeaway Alert */}
          {keyTakeaway && (
            <div className="bg-blue-50/90 border border-blue-200/80 rounded-2xl p-4 flex items-start gap-3 text-xs text-blue-900 shadow-2xs">
              <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                <Brain className="h-4 w-4" />
              </div>
              <div>
                <span className="font-bold uppercase tracking-wider text-[10px] text-blue-700 block mb-0.5">
                  Instructor Diagnostic Takeaway
                </span>
                <p className="leading-relaxed text-blue-950 font-medium">{keyTakeaway}</p>
              </div>
            </div>
          )}

          {/* Section 1 & 2: The 4 requested parts in deep cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Card 1: Average Score & Distribution */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center">
                      <Target className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Part 1: Average Score
                      </h3>
                      <div className="text-sm font-bold text-slate-900">Student Mastery Overview</div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    N = {totalSubmissions}
                  </span>
                </div>

                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold tracking-tight text-slate-900">
                    {averageScore}%
                  </span>
                  <span className="text-xs text-slate-500 font-medium">mean cohort score</span>
                </div>

                {/* Score Progress Gauge */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                    <span>Benchmark: {passingPercentage}%</span>
                    <span className="font-semibold text-slate-700">{passingRate}% meeting standard</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                    <div
                      className={`h-full transition-all duration-500 ${
                        averageScore >= 75
                          ? 'bg-emerald-500'
                          : averageScore >= 60
                          ? 'bg-blue-500'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, averageScore))}%` }}
                    />
                  </div>
                </div>

                {/* Range stats */}
                <div className="mt-4 grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-center">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[10px] text-slate-400 font-medium uppercase">Lowest</div>
                    <div className="text-xs font-bold text-slate-700">{lowestScore}%</div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[10px] text-slate-400 font-medium uppercase">Median</div>
                    <div className="text-xs font-bold text-slate-900">{medianScore}%</div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[10px] text-slate-400 font-medium uppercase">Highest</div>
                    <div className="text-xs font-bold text-emerald-700">{highestScore}%</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Passing Threshold:</span>
                <span className="font-semibold text-slate-800">≥ {passingPercentage}%</span>
              </div>
            </div>

            {/* Card 2: Common Top 2 Weak Domains */}
            <div className="bg-white p-5 rounded-2xl border border-rose-200/80 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
                      <TrendingDown className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-rose-600">
                        Part 2: Top 2 Weak Domains
                      </h3>
                      <div className="text-sm font-bold text-slate-900">Priority Remediation Areas</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                    Needs Attention
                  </span>
                </div>

                <div className="mt-4 space-y-3.5">
                  {topWeakDomains.length > 0 ? (
                    topWeakDomains.map((dom, idx) => (
                      <div
                        key={dom.name}
                        className="p-3.5 rounded-xl bg-rose-50/40 border border-rose-100 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">
                              Rank #{idx + 1} Weakest
                            </span>
                            <h4 className="text-xs font-bold text-slate-900 leading-snug">{dom.name}</h4>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-base font-extrabold text-rose-600">{dom.accuracy}%</span>
                            <div className="text-[10px] text-slate-400">accuracy</div>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 bg-rose-200/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-rose-500 rounded-full"
                            style={{ width: `${Math.min(100, Math.max(5, dom.accuracy))}%` }}
                          />
                        </div>

                        <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
                          {dom.insight}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 py-4 text-center">
                      No weak domains identified. All areas exceed benchmark proficiency.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-rose-700 font-medium flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>Recommended: review core definitions before advanced tests.</span>
              </div>
            </div>

            {/* Card 3: Common Top 2 Strong Domains */}
            <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                        Part 3: Top 2 Strong Domains
                      </h3>
                      <div className="text-sm font-bold text-slate-900">Cohort Core Strengths</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Mastered
                  </span>
                </div>

                <div className="mt-4 space-y-3.5">
                  {topStrongDomains.length > 0 ? (
                    topStrongDomains.map((dom, idx) => (
                      <div
                        key={dom.name}
                        className="p-3.5 rounded-xl bg-emerald-50/40 border border-emerald-100 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                              Rank #{idx + 1} Strongest
                            </span>
                            <h4 className="text-xs font-bold text-slate-900 leading-snug">{dom.name}</h4>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-base font-extrabold text-emerald-600">
                              {dom.accuracy}%
                            </span>
                            <div className="text-[10px] text-slate-400">accuracy</div>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 bg-emerald-200/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${Math.min(100, Math.max(5, dom.accuracy))}%` }}
                          />
                        </div>

                        <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
                          {dom.insight}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 py-4 text-center">
                      Evaluating student submissions to rank strengths...
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                <Award className="h-3.5 w-3.5 shrink-0" />
                <span>Cohort shows consistent mastery in these foundations.</span>
              </div>
            </div>
          </div>

          {/* Section 4: Common Error Patterns Between Students (In Percentages) */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
                    Part 4: Common Error Patterns
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    Distribution in Percentages
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  Why Students Lose Points: Behavioral &amp; Conceptual Breakdown
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Distinguishing genuine conceptual difficulty from hurried execution and overthinking traps across all {stats.errorPatterns.totalErrors} recorded errors.
                </p>
              </div>

              <div className="text-right self-start sm:self-auto">
                <span className="text-xs text-slate-400 font-medium block">Total Errors Analyzed</span>
                <span className="text-lg font-bold text-slate-800">{errorPatterns.totalErrors} mistakes</span>
              </div>
            </div>

            {/* Visual Multi-Segment Error Distribution Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Mistake Breakdown (100%)</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  Conceptual vs Rushed vs Timesink vs Omitted
                </span>
              </div>
              <div className="w-full h-4 bg-slate-100 rounded-xl overflow-hidden flex shadow-inner">
                {errorPatterns.conceptual.percentage > 0 && (
                  <div
                    title={`Conceptual Knowledge Gaps: ${errorPatterns.conceptual.percentage}%`}
                    style={{ width: `${errorPatterns.conceptual.percentage}%` }}
                    className="bg-rose-500 transition-all duration-500 hover:opacity-90 relative group"
                  />
                )}
                {errorPatterns.rushed.percentage > 0 && (
                  <div
                    title={`Rushed Mistakes (<25s): ${errorPatterns.rushed.percentage}%`}
                    style={{ width: `${errorPatterns.rushed.percentage}%` }}
                    className="bg-amber-500 transition-all duration-500 hover:opacity-90"
                  />
                )}
                {errorPatterns.timesink.percentage > 0 && (
                  <div
                    title={`Timesink Traps (>90s): ${errorPatterns.timesink.percentage}%`}
                    style={{ width: `${errorPatterns.timesink.percentage}%` }}
                    className="bg-sky-500 transition-all duration-500 hover:opacity-90"
                  />
                )}
                {errorPatterns.unanswered.percentage > 0 && (
                  <div
                    title={`Pacing / Blanks: ${errorPatterns.unanswered.percentage}%`}
                    style={{ width: `${errorPatterns.unanswered.percentage}%` }}
                    className="bg-slate-400 transition-all duration-500 hover:opacity-90"
                  />
                )}
              </div>
            </div>

            {/* 4 Error Pattern Cards with Percentages */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Pattern A: Conceptual Gaps */}
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/30 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
                      Conceptual Gaps
                    </span>
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-rose-700">
                      {errorPatterns.conceptual.percentage}%
                    </span>
                    <span className="text-[11px] text-rose-600 font-semibold">of errors</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {errorPatterns.conceptual.count} occurrences
                  </div>
                  <p className="mt-2 text-[11px] text-slate-600 leading-relaxed">
                    {errorPatterns.conceptual.description}
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-rose-100 text-[10px] font-semibold text-rose-800">
                  Target: Targeted concept re-teaching &amp; foundational drills.
                </div>
              </div>

              {/* Pattern B: Rushed Mistakes */}
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                      Rushed Mistakes (&lt;25s)
                    </span>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-amber-700">
                      {errorPatterns.rushed.percentage}%
                    </span>
                    <span className="text-[11px] text-amber-600 font-semibold">of errors</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {errorPatterns.rushed.count} occurrences
                  </div>
                  <p className="mt-2 text-[11px] text-slate-600 leading-relaxed">
                    {errorPatterns.rushed.description}
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-amber-100 text-[10px] font-semibold text-amber-800">
                  Target: Implement 15-second verification check before confirming.
                </div>
              </div>

              {/* Pattern C: Timesink Traps */}
              <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/30 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
                      Timesink Traps (&gt;90s)
                    </span>
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-sky-700">
                      {errorPatterns.timesink.percentage}%
                    </span>
                    <span className="text-[11px] text-sky-600 font-semibold">of errors</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {errorPatterns.timesink.count} occurrences
                  </div>
                  <p className="mt-2 text-[11px] text-slate-600 leading-relaxed">
                    {errorPatterns.timesink.description}
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-sky-100 text-[10px] font-semibold text-sky-800">
                  Target: Train bail-out protocols when calculation stalls &gt;75s.
                </div>
              </div>

              {/* Pattern D: Pacing Omissions */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-100/60 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                      Pacing Omissions
                    </span>
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-slate-800">
                      {errorPatterns.unanswered.percentage}%
                    </span>
                    <span className="text-[11px] text-slate-600 font-semibold">of errors</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {errorPatterns.unanswered.count} occurrences
                  </div>
                  <p className="mt-2 text-[11px] text-slate-600 leading-relaxed">
                    {errorPatterns.unanswered.description}
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-200 text-[10px] font-semibold text-slate-700">
                  Target: Benchmark section checkpoint timer management.
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Distractor Trap Analysis (Common Mistake Questions) */}
          {commonTraps.length > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-amber-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    High-Frequency Distractor Traps Across Submissions
                  </h4>
                </div>
                <span className="text-[10px] text-slate-400">Questions where students shared identical wrong answers</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                {commonTraps.map((trap, idx) => (
                  <div
                    key={trap.questionId}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-slate-500 uppercase">{trap.domain}</span>
                      <span className="font-bold text-rose-600">{trap.incorrectPercentage}% Miss Rate</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 line-clamp-2">
                      {trap.questionTitle}
                    </p>
                    <div className="pt-1 text-[11px] text-amber-700 flex items-center gap-1 font-medium">
                      <span className="font-bold">Common Trap:</span>
                      <span className="truncate">{trap.commonIncorrectChoice}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">{trap.trapExplanation}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Optional: All Domains Full Breakdown Table Toggle */}
          {showDetailedBreakdownToggle && allDomains.length > 2 && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAllDomains(!showAllDomains)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50/60 hover:bg-blue-50 px-3.5 py-2 rounded-xl border border-blue-200/60 transition cursor-pointer"
              >
                <span>{showAllDomains ? 'Hide All Domain Rankings' : `View All ${allDomains.length} Evaluated Domains Ranked`}</span>
                {showAllDomains ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>

              {showAllDomains && (
                <div className="mt-3 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs animate-in fade-in duration-200">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                        <tr>
                          <th className="py-2.5 px-4">Rank</th>
                          <th className="py-2.5 px-4">Domain Category</th>
                          <th className="py-2.5 px-4 text-center">Accuracy %</th>
                          <th className="py-2.5 px-4 text-center">Classification</th>
                          <th className="py-2.5 px-4 text-center">Avg Time</th>
                          <th className="py-2.5 px-4">Diagnostic Insight</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {allDomains
                          .slice()
                          .sort((a, b) => b.accuracy - a.accuracy)
                          .map((dom, rIdx) => {
                            const isStrong = dom.status === 'strong'
                            const isWeak = dom.status === 'weak'
                            return (
                              <tr key={dom.name} className="hover:bg-slate-50/80 transition">
                                <td className="py-2.5 px-4 font-bold text-slate-400">#{rIdx + 1}</td>
                                <td className="py-2.5 px-4 font-bold text-slate-900">{dom.name}</td>
                                <td className="py-2.5 px-4 text-center">
                                  <span
                                    className={`font-black ${
                                      isStrong
                                        ? 'text-emerald-600'
                                        : isWeak
                                        ? 'text-rose-600'
                                        : 'text-slate-700'
                                    }`}
                                  >
                                    {dom.accuracy}%
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 text-center">
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                                      isStrong
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : isWeak
                                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                    }`}
                                  >
                                    {dom.status}
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 text-center text-slate-600 font-mono">
                                  {dom.avgTimeSeconds}s
                                </td>
                                <td className="py-2.5 px-4 text-slate-600 text-[11px] max-w-xs">
                                  {dom.insight}
                                </td>
                              </tr>
                            )
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AssessmentSubmissionStatistics
