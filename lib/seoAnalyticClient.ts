/**
 * SEO Analytic API Client Helper
 * Connects nhadat.city to https://internal.example:4000 (Trần Minh Master Node)
 */

const SEO_ANALYTIC_BASE_URL = process.env.SEO_ANALYTIC_API_URL || 'https://internal.example:4000';

export interface SEOKeywordRanking {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SERPAnalysisResult {
  query: string;
  organicResults: Array<{
    position: number;
    title: string;
    link: string;
    snippet: string;
  }>;
  relatedSearches?: string[];
  analyzedAt: string;
}

export interface AISEOAnalysisResponse {
  success: boolean;
  data?: {
    recommendations?: string[];
    insights?: string;
    opportunities?: Array<{ keyword: string; impact: string; suggestion: string }>;
  };
  error?: string;
}

export interface TrendingCluster {
  id: string;
  topic: string;
  keywords: string[];
  volumeScore: number;
  category?: string;
}

export class SEOAnalyticClient {
  private static async fetchAPI<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
    try {
      const url = `${SEO_ANALYTIC_BASE_URL}${endpoint}`;
      const res = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        // Cache revalidation for 5 minutes
        next: { revalidate: 300 },
      });

      if (!res.ok) {
        console.error(`[SEOAnalyticClient] HTTP Error ${res.status} on ${endpoint}`);
        return null;
      }

      return await res.json();
    } catch (err) {
      console.error(`[SEOAnalyticClient] Error fetching ${endpoint}:`, err);
      return null;
    }
  }

  /**
   * Get domain rank and GSC keywords
   */
  static async getKeywords(domain: string = 'nhadat.city', period: string = 'week') {
    return this.fetchAPI<{ success: boolean; data: SEOKeywordRanking[]; count: number }>(
      `/api/keywords?domain=${encodeURIComponent(domain)}&period=${period}`
    );
  }

  /**
   * Get Realtime SERP Analysis for a target real estate keyword
   */
  static async analyzeSERP(keyword: string) {
    return this.fetchAPI<{ success: boolean; data: SERPAnalysisResult }>(
      `/api/serp/analyze?q=${encodeURIComponent(keyword)}`
    );
  }

  /**
   * Get AI SEO analysis & optimization recommendations
   */
  static async getAIAnalysis() {
    return this.fetchAPI<AISEOAnalysisResponse>(`/api/ai/analyze`);
  }

  /**
   * Get current Trending Clusters for real estate topics
   */
  static async getTrendingClusters() {
    return this.fetchAPI<{ success: boolean; data: TrendingCluster[] }>(`/api/trending/clusters`);
  }

  /**
   * Request dynamic AI Prompt suggestion for SEO Content / Metadata
   */
  static async getDynamicPrompt(promptText: string, context?: Record<string, any>) {
    return this.fetchAPI<{ success: boolean; prompt: string; suggestions: string[] }>(`/api/ai/prompt`, {
      method: 'POST',
      body: JSON.stringify({ prompt: promptText, context }),
    });
  }

  /**
   * Fetch live bot crawl stats to verify indexation speed
   */
  static async getCrawlStats() {
    return this.fetchAPI<{ success: boolean; data: any }>(`/api/crawls/stats`);
  }
}
