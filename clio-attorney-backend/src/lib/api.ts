import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

export interface AttorneyMetrics {
  id: string | number
  name: string
  working: number
  originating: number
  referral: number
  totalPayout: number
}

export interface MatterSplit {
  matterId: string | number
  matterName: string
  totalCollected: number
  shares: AttorneyShare[]
  selfOrigSelfBilled?: number
  selfOrigOthersBilled?: number
  nonOrigSelfBilled?: number
  originatorComputedAmount?: number
}

export interface AttorneyShare {
  id: string | number
  name: string
  role: 'originator' | 'working'
  amount: number
}

export interface DashboardData {
  generatedAt: string
  firmId: string
  totals: {
    attorneys: number
    working: number
    originating: number
    referral: number
    totalPayout: number
  }
  byAttorney: AttorneyMetrics[]
  matters: MatterSplit[]
}

export interface ClioUser {
  id: string | number
  name: string
  first_name: string
  last_name: string
  email: string
}

// API Functions
export const apiClient = {
  // Authentication & Environment
  async checkEnvironment(firmId: string) {
    const response = await api.get(`/env?firmId=${firmId}`)
    return response.data
  },

  async startOAuth(firmId: string) {
    const response = await api.get(`/oauth/start?firmId=${firmId}`)
    return response.data
  },

  // Data Fetching
  async getDashboardData(firmId: string): Promise<DashboardData> {
    const response = await api.get(`/sync?firmId=${firmId}`)
    return response.data.metrics
  },

  async getUsers(firmId: string): Promise<ClioUser[]> {
    const response = await api.get(`/users?firmId=${firmId}`)
    return response.data.users
  },

  async getAttorneyDetail(firmId: string, attorneyId: string): Promise<AttorneyMetrics> {
    const response = await api.get(`/export/attorney?firmId=${firmId}&attorneyId=${attorneyId}`)
    return response.data
  },

  // Export Functions
  async exportAllData(firmId: string): Promise<Blob> {
    const response = await api.get(`/export?firmId=${firmId}`, {
      responseType: 'blob'
    })
    return response.data
  },

  async exportAttorneyData(firmId: string, attorneyId: string): Promise<Blob> {
    const response = await api.get(`/export/attorney?firmId=${firmId}&attorneyId=${attorneyId}`, {
      responseType: 'blob'
    })
    return response.data
  },

  // Sync & Updates
  async triggerSync(firmId: string) {
    const response = await api.post(`/sync?firmId=${firmId}`)
    return response.data
  },

  async getMetrics(firmId: string) {
    const response = await api.get(`/metrics?firmId=${firmId}`)
    return response.data
  },

  // Analytics & Algorithm Management
  async getAlgorithms(firmId: string) {
    const response = await api.get(`/algorithms?firmId=${firmId}`)
    return response.data.algorithms || []
  },

  async saveAlgorithm(firmId: string, algorithm: any) {
    const response = await api.post(`/algorithms?firmId=${firmId}`, algorithm)
    return response.data
  },

  async deleteAlgorithm(firmId: string, algorithmId: string) {
    const response = await api.delete(`/algorithms/${algorithmId}?firmId=${firmId}`)
    return response.data
  },

  async getDataViews(firmId: string) {
    const response = await api.get(`/data-views?firmId=${firmId}`)
    return response.data.views || []
  },

  async getBills(firmId: string) {
    const response = await api.get(`/bills?firmId=${firmId}`)
    return response.data.bills || []
  },

  async getTimeEntries(firmId: string) {
    const response = await api.get(`/time-entries?firmId=${firmId}`)
    return response.data.time_entries || []
  },

  async getPayments(firmId: string) {
    const response = await api.get(`/payments?firmId=${firmId}`)
    return response.data.payments || []
  },

  async getFormulas(firmId: string) {
    const response = await api.get(`/formulas?firmId=${firmId}`)
    return response.data.formulas || []
  },

  async saveFormula(firmId: string, formula: any) {
    const response = await api.post(`/formulas?firmId=${firmId}`, formula)
    return response.data
  },

  async getReports(firmId: string) {
    const response = await api.get(`/reports?firmId=${firmId}`)
    return response.data.reports || []
  },

  async saveReport(firmId: string, report: any) {
    const response = await api.post(`/reports?firmId=${firmId}`, report)
    return response.data
  }
}

export default api