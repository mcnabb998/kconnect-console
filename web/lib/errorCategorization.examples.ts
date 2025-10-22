/**
 * Example usage of network error categorization
 * 
 * This demonstrates how the error categorization system provides
 * detailed troubleshooting information for different network errors.
 */

import {
  categorizeNetworkError,
  formatErrorMessage,
  getErrorSummary,
  NetworkErrorType,
  isCategorizedError,
} from '@/lib/fetchWithTimeout';

// Example 1: Connection refused error (Kafka Connect not running)
async function exampleConnectionRefused() {
  try {
    const response = await fetch('http://localhost:8080/api/default/connectors');
  } catch (error) {
    if (isCategorizedError(error)) {
      console.log('Error Type:', error.type); // NetworkErrorType.CONNECTION_REFUSED
      console.log('Summary:', getErrorSummary(error.categorized)); // "Service not reachable"
      console.log('Message:', error.message);
      console.log('Troubleshooting:');
      error.troubleshooting.forEach((tip: string, idx: number) => {
        console.log(`  ${idx + 1}. ${tip}`);
      });
      // Output:
      //   1. Verify that Kafka Connect is running
      //   2. Check if the proxy URL is correct in your configuration
      //   3. Ensure the service is listening on the expected port
      //   4. Check firewall rules that might be blocking the connection
      //   5. Verify network connectivity between services
    }
  }
}

// Example 2: Timeout error
async function exampleTimeout() {
  try {
    const response = await fetch('http://slow-server.com/api', {
      signal: AbortSignal.timeout(5000), // Timeout after 5 seconds
    });
  } catch (error) {
    if (isCategorizedError(error)) {
      console.log('Error Type:', error.type); // NetworkErrorType.TIMEOUT
      console.log('Summary:', getErrorSummary(error.categorized)); // "Request timed out"
      console.log('Troubleshooting:');
      error.troubleshooting.forEach((tip: string, idx: number) => {
        console.log(`  ${idx + 1}. ${tip}`);
      });
      // Output:
      //   1. Check if the server is under heavy load
      //   2. Verify network latency between client and server
      //   3. Increase the timeout duration if operations normally take longer
      //   4. Check for network issues or packet loss
      //   5. Verify firewall rules are not delaying connections
    }
  }
}

// Example 3: DNS failure
async function exampleDNSFailure() {
  try {
    const response = await fetch('http://invalid-hostname.local/api');
  } catch (error) {
    if (isCategorizedError(error)) {
      console.log('Error Type:', error.type); // NetworkErrorType.DNS_FAILURE
      console.log('Summary:', getErrorSummary(error.categorized)); // "Hostname not found"
      console.log('Troubleshooting:');
      error.troubleshooting.forEach((tip: string, idx: number) => {
        console.log(`  ${idx + 1}. ${tip}`);
      });
      // Output:
      //   1. Verify the hostname is correct
      //   2. Check DNS server configuration
      //   3. Ensure the host exists and is reachable
      //   4. Try using an IP address instead of hostname
      //   5. Check /etc/hosts or DNS cache
    }
  }
}

// Example 4: SSL/TLS error
async function exampleSSLError() {
  try {
    const response = await fetch('https://self-signed.badssl.com/');
  } catch (error) {
    if (isCategorizedError(error)) {
      console.log('Error Type:', error.type); // NetworkErrorType.SSL_TLS_ERROR
      console.log('Summary:', getErrorSummary(error.categorized)); // "Certificate error"
      console.log('Troubleshooting:');
      error.troubleshooting.forEach((tip: string, idx: number) => {
        console.log(`  ${idx + 1}. ${tip}`);
      });
      // Output:
      //   1. Verify SSL/TLS certificates are valid and not expired
      //   2. Check if the certificate chain is complete
      //   3. For self-signed certificates, add them to trusted store
      //   4. Ensure certificate hostname matches the server hostname
      //   5. Check if SSL/TLS version is supported
    }
  }
}

// Example 5: Formatting error messages for display
function exampleFormatting() {
  const error = new Error('ECONNREFUSED');
  const categorized = categorizeNetworkError(error, 'http://localhost:8080');
  
  // With emoji icons (for terminal/UI)
  const formattedWithIcon = formatErrorMessage(categorized, true);
  console.log(formattedWithIcon);
  // Output:
  // 🔌 Connection refused: Unable to connect to http://localhost:8080
  //
  // Troubleshooting suggestions:
  // 1. Verify that Kafka Connect is running
  // 2. Check if the proxy URL is correct in your configuration
  // 3. Ensure the service is listening on the expected port
  // 4. Check firewall rules that might be blocking the connection
  // 5. Verify network connectivity between services
  
  // Without icons (for logs)
  const formattedWithoutIcon = formatErrorMessage(categorized, false);
  console.log(formattedWithoutIcon);
  // Output:
  // Connection refused: Unable to connect to http://localhost:8080
  //
  // Troubleshooting suggestions:
  // 1. Verify that Kafka Connect is running
  // 2. Check if the proxy URL is correct in your configuration
  // 3. Ensure the service is listening on the expected port
  // 4. Check firewall rules that might be blocking the connection
  // 5. Verify network connectivity between services
}

// Example 6: Using with API client
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';

async function exampleAPICall() {
  try {
    const response = await fetchWithTimeout('http://localhost:8080/api/default/connectors', {
      timeout: 10000, // 10 second timeout
    });
    const data = await response.json();
    return data;
  } catch (error) {
    if (isCategorizedError(error)) {
      // Error is already categorized with troubleshooting info
      console.error('API call failed:', error.message);
      console.error('Error type:', error.type);
      console.error('Troubleshooting:');
      error.troubleshooting.forEach((tip: string) => console.error(`  - ${tip}`));
      
      // You can also show a user-friendly summary
      const summary = getErrorSummary(error.categorized);
      throw new Error(`Failed to fetch connectors: ${summary}`);
    }
    throw error;
  }
}

export {
  exampleConnectionRefused,
  exampleTimeout,
  exampleDNSFailure,
  exampleSSLError,
  exampleFormatting,
  exampleAPICall,
};
