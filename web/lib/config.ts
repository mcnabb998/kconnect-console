/**
 * Centralized configuration for kconnect-console
 *
 * Environment Variables:
 * - NEXT_PUBLIC_PROXY_URL: URL for browser to reach the proxy (e.g., http://localhost:8080 or https://api.yourcompany.com)
 * - INTERNAL_PROXY_URL: URL for Next.js SSR to reach the proxy internally (e.g., http://kconnect-proxy:8080 in K8s)
 * - NEXT_PUBLIC_CLUSTER_ID: Default Kafka Connect cluster ID
 */

export const API_CONFIG = {
  /**
   * Proxy URL for client-side (browser) requests
   * - Local dev: http://localhost:8080
   * - Docker Compose: http://localhost:8080 (host machine)
   * - EKS/Production: https://api.yourcompany.com (ingress/ALB)
   */
  proxyUrl: process.env.NEXT_PUBLIC_PROXY_URL || 'http://localhost:8080',

  /**
   * Proxy URL for server-side requests (Next.js SSR)
   * - Local dev: http://localhost:8080
   * - Docker Compose: http://kconnect-proxy:8080 (container network)
   * - EKS/Production: http://kconnect-proxy.default.svc.cluster.local:8080 (k8s service)
   */
  internalProxyUrl: process.env.INTERNAL_PROXY_URL || process.env.NEXT_PUBLIC_PROXY_URL || 'http://localhost:8080',

  /**
   * Default Kafka Connect cluster ID
   */
  clusterId: process.env.NEXT_PUBLIC_CLUSTER_ID || 'default',
};

/**
 * Get the appropriate proxy URL based on execution context
 * @param forceClient - Force client URL even in SSR context
 */
export function getProxyUrl(forceClient = false): string {
  // In browser context, always use public URL
  if (typeof window !== 'undefined' || forceClient) {
    return API_CONFIG.proxyUrl;
  }

  // In SSR context, use internal URL
  return API_CONFIG.internalProxyUrl;
}

/**
 * Build API endpoint URL
 * @param endpoint - API endpoint path (e.g., '/connectors')
 * @param cluster - Cluster ID (defaults to configured cluster)
 */
export function buildApiUrl(endpoint: string, cluster?: string): string {
  const baseUrl = getProxyUrl(true); // Always use client URL for browser fetches
  const clusterPath = cluster || API_CONFIG.clusterId;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  return `${baseUrl}/api/${clusterPath}${cleanEndpoint}`;
}
