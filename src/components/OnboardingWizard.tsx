import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Bell, BookOpen, Check, Sparkles } from 'lucide-react';
import type { Category, GoalAndReminderSettings } from '../types/zentra';
import {
  getNotificationPermission,
  requestLocalNotificationPermission,
} from '../services/notificationService';

interface OnboardingWizardProps {
  categories: Category[];
  initialGoal: GoalAndReminderSettings;
  initialInterests: string[];
  initialName: string;
  onComplete: (payload: {
    userName: string;
    reminders: GoalAndReminderSettings;
    interests: string[];
  }) => void;
}

const GOAL_PRESETS = [10, 15, 20, 30, 45];
const WEEKDAYS = [
  { idx: 1, short: 'Mon' },
  { idx: 2, short: 'Tue' },
  { idx: 3, short: 'Wed' },
  { idx: 4, short: 'Thu' },
  { idx: 5, short: 'Fri' },
  { idx: 6, short: 'Sat' },
  { idx: 0, short: 'Sun' },
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  categories,
  initialGoal,
  initialInterests,
  initialName,
  onComplete,
}) => {
  const [step, setStep] = useState(0);
  const [userName, setUserName] = useState(initialName === 'Reader' ? '' : initialName);
  const [dailyMinutes, setDailyMinutes] = useState(initialGoal.dailyGoalMinutes);
  const [customMinutes, setCustomMinutes] = useState('');
  const [preferredDays, setPreferredDays] = useState<number[]>(initialGoal.preferredDays);
  const [primaryTime, setPrimaryTime] = useState(initialGoal.primaryReminderTime);
  const [secondaryTime, setSecondaryTime] = useState(initialGoal.secondaryReminderTime ?? '');
  const [notifPermission, setNotifPermission] = useState(getNotificationPermission());
  const [interests, setInterests] = useState<string[]>(initialInterests);

  const totalSteps = 5;

  const toggleDay = (dayIdx: number) => {
    setPreferredDays((prev) =>
      prev.includes(dayIdx)
        ? prev.length > 1
          ? prev.filter((d) => d !== dayIdx)
          : prev
        : [...prev, dayIdx]
    );
  };

  const toggleInterest = (catName: string) => {
    setInterests((prev) =>
      prev.includes(catName) ? prev.filter((c) => c !== catName) : [...prev, catName]
    );
  };

  const handleRequestNotifications = async () => {
    const res = await requestLocalNotificationPermission();
    setNotifPermission(res);
  };

  const finishOnboarding = () => {
    const parsedCustom = Number(customMinutes);
    const finalMinutes =
      customMinutes.trim() && !isNaN(parsedCustom) && parsedCustom >= 5
        ? Math.min(240, Math.round(parsedCustom))
        : dailyMinutes;

    onComplete({
      userName: userName.trim() || 'Reader',
      reminders: {
        ...initialGoal,
        dailyGoalMinutes: finalMinutes,
        preferredDays,
        primaryReminderTime: primaryTime || '20:00',
        secondaryReminderTime: secondaryTime || undefined,
      },
      interests: interests.length > 0 ? interests : categories.slice(0, 3).map((c) => c.name),
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0D1117] flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full bg-blue-700 dark:bg-blue-500 transition-all duration-300"
            style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
          />
        </div>

        <div className="p-6 sm:p-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#152238] text-white flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
              <span className="font-display font-semibold text-lg text-slate-900 dark:text-white">
                Zentra
              </span>
            </div>
            <button
              type="button"
              onClick={finishOnboarding}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 px-3 py-2 min-h-[44px] whitespace-nowrap shrink-0"
            >
              Skip setup
            </button>
          </div>

          {step === 0 && (
            <div className="space-y-5">
              <p className="text-xs font-medium tracking-wider uppercase text-blue-700 dark:text-blue-400">
                Step 1 of 5 · Welcome
              </p>
              <h1 className="font-display text-3xl sm:text-4xl font-semibold text-slate-900 dark:text-white text-balance">
                Your Personal Knowledge Universe.
              </h1>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                Discover curated books and authors, read distraction-free online or offline, capture
                highlights and notes in your Knowledge Hub, and build a steady daily reading habit—with
                zero accounts or ads.
              </p>

              <div className="pt-2">
                <label
                  htmlFor="zentra-user-name"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                >
                  What should Zentra call you? (Optional)
                </label>
                <input
                  id="zentra-user-name"
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Enter your first name"
                  className="w-full max-w-sm px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <p className="text-xs font-medium tracking-wider uppercase text-blue-700 dark:text-blue-400">
                Step 2 of 5 · Daily Goal
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">
                Set a realistic daily reading target
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Small daily commitments build lasting momentum. You can adjust this anytime in Settings.
              </p>

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 pt-2">
                {GOAL_PRESETS.map((mins) => {
                  const active = !customMinutes && dailyMinutes === mins;
                  return (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => {
                        setDailyMinutes(mins);
                        setCustomMinutes('');
                      }}
                      className={`py-3.5 px-3 rounded-xl border text-center transition-colors min-h-[48px] ${
                        active
                          ? 'bg-blue-700 border-blue-700 text-white font-semibold'
                          : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-blue-400'
                      }`}
                    >
                      <span className="font-mono-tabular text-base block">{mins}</span>
                      <span className="text-[11px] opacity-80">min/day</span>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2">
                <label
                  htmlFor="custom-goal-input"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
                >
                  Or enter custom minutes per day
                </label>
                <input
                  id="custom-goal-input"
                  type="number"
                  min={5}
                  max={240}
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  placeholder="e.g. 25"
                  className="w-36 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-mono-tabular focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <p className="text-xs font-medium tracking-wider uppercase text-blue-700 dark:text-blue-400">
                Step 3 of 5 · Reading Schedule
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">
                Which days do you prefer to read?
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Zentra only sends reading reminders on your chosen days and never disturbs you after
                you hit your daily goal.
              </p>

              <div className="flex flex-wrap gap-2 pt-2">
                {WEEKDAYS.map((day) => {
                  const selected = preferredDays.includes(day.idx);
                  return (
                    <button
                      key={day.idx}
                      type="button"
                      onClick={() => toggleDay(day.idx)}
                      aria-pressed={selected}
                      className={`px-4 py-3 rounded-xl border text-sm font-medium min-h-[44px] transition-colors ${
                        selected
                          ? 'bg-blue-700 border-blue-700 text-white'
                          : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {day.short}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <p className="text-xs font-medium tracking-wider uppercase text-blue-700 dark:text-blue-400">
                Step 4 of 5 · Local Reminders
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">
                Choose a gentle reminder window
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Reminders are scheduled locally on your device—no cloud tracking or servers involved.
              </p>

              <div className="grid sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label
                    htmlFor="primary-reminder-time"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Primary reminder time
                  </label>
                  <input
                    id="primary-reminder-time"
                    type="time"
                    value={primaryTime}
                    onChange={(e) => setPrimaryTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-mono-tabular"
                  />
                </div>

                <div>
                  <label
                    htmlFor="secondary-reminder-time"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Optional second reminder
                  </label>
                  <input
                    id="secondary-reminder-time"
                    type="time"
                    value={secondaryTime}
                    onChange={(e) => setSecondaryTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-mono-tabular"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Bell className="w-5 h-5 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      Device notifications
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {notifPermission === 'granted'
                        ? 'Notifications are enabled for your reading schedule.'
                        : 'Allow Zentra to nudge you only on reading days before quiet hours.'}
                    </p>
                  </div>
                </div>
                {notifPermission !== 'granted' && notifPermission !== 'unsupported' && (
                  <button
                    type="button"
                    onClick={handleRequestNotifications}
                    className="px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-medium whitespace-nowrap shrink-0 min-h-[40px]"
                  >
                    Allow
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <p className="text-xs font-medium tracking-wider uppercase text-blue-700 dark:text-blue-400">
                Step 5 of 5 · Personalize Discovery
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">
                What topics draw your curiosity?
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Select categories to shape your local recommendations. No account required.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {categories.map((cat) => {
                  const selected = interests.includes(cat.name);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleInterest(cat.name)}
                      aria-pressed={selected}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-colors min-h-[48px] ${
                        selected
                          ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-600 text-blue-900 dark:text-blue-200'
                          : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className="text-sm font-medium truncate">{cat.name}</span>
                      {selected && <Check className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer controls */}
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 min-h-[44px]"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            {step < totalSteps - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium min-h-[44px] whitespace-nowrap shrink-0"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={finishOnboarding}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium min-h-[44px] whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-4 h-4" />
                Explore Zentra Library
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
