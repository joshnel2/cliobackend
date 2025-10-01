import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
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
  }
}

export default api