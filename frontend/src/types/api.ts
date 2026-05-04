// DTO-типы для всех эндпоинтов бэкенда (FastAPI, см. main.py).

// ── Auth ──────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'trainer' | 'client';

export interface AuthUser {
  id: number;
  login: string;
  role: UserRole;
  full_name: string;
  trainer_id: number | null;
  client_id: number | null;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

// ── Clients ───────────────────────────────────────────────────────────────

export interface Client {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  birth_date: string | null;
  gender: string | null;
  registration_date: string | null;
  subscription_type: string;
  subscription_start_date: string | null;
  fitness_goal: string | null;
  fitness_level: string;
  health_notes: string | null;
  contraindications: string | null;
  is_active: number;
  height: number | null;
  trainer_id: number | null;
}

export interface ClientCreate {
  name: string;
  email: string;
  phone?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  subscription_type?: string;
  subscription_start_date?: string | null;
  fitness_goal?: string | null;
  fitness_level?: string;
  health_notes?: string | null;
  contraindications?: string | null;
  height?: number | null;
  trainer_id?: number | null;
}

export interface ClientUpdate {
  name?: string;
  phone?: string | null;
  subscription_type?: string;
  fitness_goal?: string | null;
  fitness_level?: string;
  health_notes?: string | null;
  contraindications?: string | null;
  is_active?: number;
}

export interface ClientsListResponse {
  clients: Client[];
  total: number;
}

// ── Trainers ──────────────────────────────────────────────────────────────

export interface Trainer {
  id: number;
  name: string;
  specialization: string | null;
  experience_years: number | null;
  rating: number;
  is_active: number;
}

export interface TrainerCreate {
  name: string;
  specialization?: string | null;
  experience_years?: number | null;
}

// ── Exercises ─────────────────────────────────────────────────────────────

export interface Exercise {
  id: number;
  name: string;
  muscle_group: string | null;
  secondary_muscle_groups: string | null;
  equipment: string | null;
  difficulty: string | null;
  load_type: string | null;
  calories_per_minute: number | null;
  description: string | null;
}

export interface ExerciseCreate {
  name: string;
  muscle_group?: string | null;
  secondary_muscle_groups?: string | null;
  equipment?: string | null;
  difficulty?: string | null;
  load_type?: string | null;
  calories_per_minute?: number | null;
  description?: string | null;
}

// ── Programs ──────────────────────────────────────────────────────────────

export interface Program {
  id: number;
  client_id: number;
  trainer_id: number | null;
  name: string;
  description: string | null;
  goal: string | null;
  duration_weeks: number;
  sessions_per_week: number;
  difficulty_level: string;
  start_date: string | null;
  created_at: string;
  is_active: number;
  client_name?: string;
  trainer_name?: string | null;
}

export interface ProgramCreate {
  client_id: number;
  trainer_id?: number | null;
  name: string;
  description?: string | null;
  goal?: string | null;
  duration_weeks?: number;
  sessions_per_week?: number;
  difficulty_level?: string;
  start_date?: string | null;
}

export interface ProgramExercise {
  id: number;
  program_id: number;
  exercise_id: number;
  sets: number;
  reps: number;
  weight: number | null;
  rest_seconds: number;
  day_of_week: number | null;
  order_number: number | null;
  methodical_note: string | null;
  exercise_name?: string;
  muscle_group?: string | null;
}

export interface ProgramExerciseCreate {
  program_id: number;
  exercise_id: number;
  sets?: number;
  reps?: number;
  weight?: number | null;
  rest_seconds?: number;
  day_of_week?: number | null;
  order_number?: number | null;
  methodical_note?: string | null;
}

// ── Sessions ──────────────────────────────────────────────────────────────

export interface Session {
  id: number;
  client_id: number;
  program_id: number | null;
  trainer_id: number | null;
  session_date: string;
  start_time: string | null;
  duration_minutes: number | null;
  calories_burned: number | null;
  fatigue_level: number | null;
  satisfaction_rating: number | null;
  comment: string | null;
  client_name?: string;
  program_name?: string | null;
  trainer_name?: string | null;
}

export interface SessionCreate {
  client_id: number;
  program_id?: number | null;
  trainer_id?: number | null;
  session_date: string;
  start_time?: string | null;
  duration_minutes?: number | null;
  calories_burned?: number | null;
  fatigue_level?: number | null;
  satisfaction_rating?: number | null;
  comment?: string | null;
}

export interface SessionExercise {
  id: number;
  session_id: number;
  exercise_id: number;
  program_exercise_id: number | null;
  actual_sets: number | null;
  actual_reps: number | null;
  actual_weight: number | null;
  actual_duration_seconds: number | null;
  rpe: number | null;
  calories_burned: number | null;
  exercise_name?: string;
}

export interface SessionExerciseCreate {
  session_id: number;
  exercise_id: number;
  program_exercise_id?: number | null;
  actual_sets?: number | null;
  actual_reps?: number | null;
  actual_weight?: number | null;
  actual_duration_seconds?: number | null;
  rpe?: number | null;
  calories_burned?: number | null;
}

// ── Metrics ───────────────────────────────────────────────────────────────

export interface ClientMetrics {
  id: number;
  client_id: number;
  measurement_date: string;
  weight: number | null;
  body_fat_percentage: number | null;
  muscle_mass: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  biceps_cm: number | null;
  thighs_cm: number | null;
  resting_heart_rate: number | null;
  max_pushups: number | null;
  max_pullups: number | null;
  plank_seconds: number | null;
  run_5km_minutes: number | null;
}

export interface ClientMetricsCreate {
  client_id: number;
  measurement_date: string;
  weight?: number | null;
  body_fat_percentage?: number | null;
  muscle_mass?: number | null;
  chest_cm?: number | null;
  waist_cm?: number | null;
  hips_cm?: number | null;
  biceps_cm?: number | null;
  thighs_cm?: number | null;
  resting_heart_rate?: number | null;
  max_pushups?: number | null;
  max_pullups?: number | null;
  plank_seconds?: number | null;
  run_5km_minutes?: number | null;
}

// ── Goals ─────────────────────────────────────────────────────────────────

export interface ClientGoal {
  id: number;
  client_id: number;
  metric: string;
  target_value: number | null;
  target_date: string | null;
  achieved_at: string | null;
  created_at: string;
  current_value?: number | null;
  progress_percent?: number | null;
}

export interface ClientGoalCreate {
  client_id: number;
  metric: string;
  target_value?: number | null;
  target_date?: string | null;
}

// ── Recommendations ───────────────────────────────────────────────────────

export interface Recommendation {
  id: number;
  recommendation_type: string;
  title: string;
  description: string;
  priority: number;
  is_applied: number;
  created_at: string;
}

// ── Dashboard analytics ───────────────────────────────────────────────────

export interface DashboardSummary {
  active_clients: number;
  active_trainers: number;
  active_programs: number;
  sessions_30d: number;
  avg_satisfaction: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  visits_by_weekday: Array<{ day: string; visits: number }>;
  goal_distribution: Array<{ goal: string; count: number }>;
  top_trainers: Array<{ name: string; sessions: number; rating: number }>;
  weekly_visits: Array<{ week: string; visits: number }>;
}

// ── Client analytics ──────────────────────────────────────────────────────

export interface SessionStats {
  total_sessions: number;
  avg_duration: number;
  avg_satisfaction: number;
  last_session: string | null;
  sessions_30d: number;
}

export interface ChurnRiskComponents {
  frequency: number;
  satisfaction: number;
  engagement: number;
}

export type ChurnRiskLevel = 'low' | 'medium' | 'high';

export interface ChurnRisk {
  score: number;
  level: ChurnRiskLevel;
  factors: string[];
  components: ChurnRiskComponents;
}

export interface ProgressInsight {
  type: 'positive' | 'warning' | 'neutral';
  message: string;
}

export interface ProgressAnalysis {
  status: 'excellent' | 'good' | 'needs_attention' | 'stable' | 'insufficient_data';
  changes: Record<string, { start: number; current: number; change: number }>;
  insights: ProgressInsight[];
}

export interface ProgramExerciseProgress {
  exercise_name: string;
  early_avg_weight: number | null;
  late_avg_weight: number | null;
  early_avg_reps: number | null;
  late_avg_reps: number | null;
  early_avg_rpe: number | null;
  late_avg_rpe: number | null;
}

export interface ProgramAnalytics {
  program_id: number;
  program_name: string;
  goal: string | null;
  trainer_name: string | null;
  start_date: string | null;
  is_active: number;
  sessions_count: number;
  avg_satisfaction: number | null;
  avg_duration: number | null;
  total_calories: number;
  planned_sessions: number;
  completion_rate: number;
  metrics_before: Record<string, number> | null;
  metrics_after: Record<string, number> | null;
  metrics_change: Record<string, number>;
  exercise_progress: ProgramExerciseProgress[];
  recommendations: string[];
}

export interface ClientAnalytics {
  client: Client;
  session_stats: SessionStats;
  monthly_visits: Array<{ month: string; visits: number }>;
  metrics_history: ClientMetrics[];
  progress_analysis: ProgressAnalysis;
  goals: ClientGoal[];
  current_program: Program | null;
  churn_risk: ChurnRisk;
  program_analytics: ProgramAnalytics[];
}

// ── Churn analytics ───────────────────────────────────────────────────────

export interface ChurnClient {
  client_id: number;
  client_name: string;
  subscription_type: string | null;
  last_session: string | null;
  total_sessions: number;
  risk: ChurnRisk;
}

export interface KaplanMeierCurve {
  group: string;
  n: number;
  events: number;
  median_survival_days: number | null;
  timeline: number[];
  survival: number[];
}

export type SurvivalAnalysis =
  | { available: false; reason: string }
  | {
      available: true;
      curves: KaplanMeierCurve[];
      logrank: { statistic: number; p_value: number } | null;
    };

export interface CoxCoefficient {
  covariate: string;
  hazard_ratio: number;
  ci_lower: number;
  ci_upper: number;
  p_value: number;
}

export type CoxRegression =
  | { available: false; reason: string }
  | {
      available: true;
      n: number;
      events: number;
      concordance_index: number;
      coefficients: CoxCoefficient[];
    };

export interface ChurnAnalyticsData {
  clients: ChurnClient[];
  risk_distribution: { high: number; medium: number; low: number };
  survival_analysis: SurvivalAnalysis;
  cox_regression: CoxRegression;
}

// ── Segments (k-means + PCA) ──────────────────────────────────────────────

export interface SegmentPoint {
  client_id: number;
  name: string;
  goal: string | null;
  cluster: number;
  x: number;
  y: number;
}

export interface ClusterSummary {
  cluster: number;
  size: number;
  centroid: Record<string, number>;
}

export type SegmentsData =
  | { available: false; reason: string }
  | {
      available: true;
      k: number;
      silhouette: number | null;
      explained_variance: number[];
      points: SegmentPoint[];
      clusters: ClusterSummary[];
    };

// ── Programs analytics ────────────────────────────────────────────────────

export type ProgramsMetric = 'weight_change' | 'bodyfat_change' | 'pushups_change';

export interface NormalityResult {
  statistic: number;
  p_value: number;
}

export interface DescriptiveStat {
  program: string;
  n: number;
  mean: number;
  std: number;
  median: number;
}

export interface OverallTest {
  test: string;
  statistic: number;
  p_value: number;
}

export interface PairwiseComparison {
  program_a: string;
  program_b: string;
  method: string;
  statistic: number;
  p_value: number;
  p_value_holm: number;
  cohens_d: number;
  mean_diff: number;
  ci95: [number, number];
}

export type ProgramsAnalyticsData =
  | { available: false; reason: string }
  | {
      available: true;
      metric: ProgramsMetric;
      all_normal: boolean;
      normality: Record<string, NormalityResult>;
      descriptive: DescriptiveStat[];
      overall_test: OverallTest;
      pairwise: PairwiseComparison[];
    };

// ── Gym Load ──────────────────────────────────────────────────────────────

export interface GymLoadData {
  total_sessions_30d: number;
  avg_per_day: number;
  by_hour: Array<{ hour: number; visits: number }>;
  by_weekday_hour: Array<{ day: string; hours: number[] }>;
  peak_hours: Array<{ hour: number; visits: number }>;
}

// ── Common ────────────────────────────────────────────────────────────────

export interface CreateResponse {
  id: number;
  message?: string;
}

// ── Users ─────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  login: string;
  role: UserRole;
  full_name: string;
  trainer_id: number | null;
  client_id: number | null;
  is_active: number;
  created_at: string;
  trainer_name?: string | null;
  client_name?: string | null;
}

export interface UserCreate {
  login: string;
  password: string;
  role: UserRole;
  full_name: string;
  trainer_id?: number | null;
  client_id?: number | null;
}

export interface UserUpdate {
  role?: UserRole;
  full_name?: string;
  trainer_id?: number | null;
  client_id?: number | null;
  is_active?: number;
}

// ── Calendar ──────────────────────────────────────────────────────────────

export interface CalendarItem {
  id: number;
  program_id: number;
  planned_date: string;
  day_of_week: number | null;
  status: string;
}