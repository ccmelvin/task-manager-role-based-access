/**
 * Secure API Client
 * Handles CSRF protection, secure authentication, and request security
 */

interface ApiClientConfig {
    baseUrl: string;
    timeout?: number;
    retryAttempts?: number;
    csrfTokenEndpoint?: string;
}

interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: Record<string, string>;
    body?: any;
    requiresAuth?: boolean;
    requiresCsrf?: boolean;
    timeout?: number;
}

interface ApiResponse<T = any> {
    data: T;
    status: number;
    headers: Headers;
    ok: boolean;
}

interface ApiError {
    message: string;
    status: number;
    code?: string;
    details?: any;
}

class SecureApiClient {
    private config: Required<ApiClientConfig>;
    private csrfToken: string | null = null;
    private authToken: string | null = null;
    private tokenRefreshPromise: Promise<string> | null = null;

    constructor(config: ApiClientConfig) {
        this.config = {
            timeout: 30000,
            retryAttempts: 3,
            csrfTokenEndpoint: '/api/csrf-token',
            ...config
        };

        // Initialize auth token from secure storage
        this.initializeAuthToken();
    }

    /**
     * Initialize authentication token from secure storage
     */
    private initializeAuthToken(): void {
        try {
            // Try to get token from sessionStorage first (more secure for SPA)
            this.authToken = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
        } catch (error) {
            console.warn('Failed to retrieve auth token from storage:', error);
        }
    }

    /**
     * Set authentication token and store securely
     */
    public setAuthToken(token: string): void {
        this.authToken = token;

        try {
            // Store in sessionStorage for better security
            sessionStorage.setItem('auth_token', token);
            // Remove from localStorage if it exists
            localStorage.removeItem('auth_token');
        } catch (error) {
            console.warn('Failed to store auth token:', error);
        }
    }

    /**
     * Clear authentication token
     */
    public clearAuthToken(): void {
        this.authToken = null;

        try {
            sessionStorage.removeItem('auth_token');
            localStorage.removeItem('auth_token');
        } catch (error) {
            console.warn('Failed to clear auth token:', error);
        }
    }

    /**
     * Get CSRF token from server
     */
    private async getCsrfToken(): Promise<string> {
        if (this.csrfToken) {
            return this.csrfToken;
        }

        try {
            const response = await fetch(`${this.config.baseUrl}${this.config.csrfTokenEndpoint}`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to get CSRF token: ${response.status}`);
            }

            const data = await response.json();
            this.csrfToken = data.csrfToken || data.token;

            if (!this.csrfToken) {
                throw new Error('CSRF token not found in response');
            }

            return this.csrfToken;
        } catch (error) {
            console.error('Failed to get CSRF token:', error);
            throw new ApiError({
                message: 'Failed to get CSRF token',
                status: 0,
                code: 'CSRF_TOKEN_ERROR'
            });
        }
    }

    /**
     * Refresh authentication token
     */
    private async refreshAuthToken(): Promise<string> {
        if (this.tokenRefreshPromise) {
            return this.tokenRefreshPromise;
        }

        this.tokenRefreshPromise = this.performTokenRefresh();

        try {
            const newToken = await this.tokenRefreshPromise;
            this.setAuthToken(newToken);
            return newToken;
        } finally {
            this.tokenRefreshPromise = null;
        }
    }

    /**
     * Perform actual token refresh
     */
    private async performTokenRefresh(): Promise<string> {
        try {
            const response = await fetch(`${this.config.baseUrl}/api/auth/refresh`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
                }
            });

            if (!response.ok) {
                throw new Error(`Token refresh failed: ${response.status}`);
            }

            const data = await response.json();
            return data.token || data.accessToken;
        } catch (error) {
            console.error('Token refresh failed:', error);
            this.clearAuthToken();
            throw new ApiError({
                message: 'Authentication expired. Please log in again.',
                status: 401,
                code: 'TOKEN_REFRESH_FAILED'
            });
        }
    }

    /**
     * Build request headers with security headers
     */
    private async buildHeaders(options: RequestOptions): Promise<Record<string, string>> {
        const headers: Record<string, string> = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest', // CSRF protection
            ...options.headers
        };

        // Add authentication header
        if (options.requiresAuth && this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        // Add CSRF token for state-changing operations
        if (options.requiresCsrf && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method || 'GET')) {
            try {
                const csrfToken = await this.getCsrfToken();
                headers['X-CSRF-Token'] = csrfToken;
            } catch (error) {
                console.warn('Failed to get CSRF token:', error);
            }
        }

        return headers;
    }

    /**
     * Make secure HTTP request
     */
    public async request<T = any>(url: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
        const {
            method = 'GET',
            body,
            requiresAuth = true,
            requiresCsrf = true,
            timeout = this.config.timeout
        } = options;

        const fullUrl = url.startsWith('http') ? url : `${this.config.baseUrl}${url}`;

        let attempt = 0;
        let lastError: Error;

        while (attempt < this.config.retryAttempts) {
            try {
                const headers = await this.buildHeaders(options);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                const requestInit: RequestInit = {
                    method,
                    headers,
                    credentials: 'include', // Include cookies for session management
                    signal: controller.signal,
                    ...(body && { body: JSON.stringify(body) })
                };

                const response = await fetch(fullUrl, requestInit);
                clearTimeout(timeoutId);

                // Handle authentication errors
                if (response.status === 401 && requiresAuth && attempt === 0) {
                    try {
                        await this.refreshAuthToken();
                        attempt++;
                        continue; // Retry with new token
                    } catch (refreshError) {
                        throw refreshError;
                    }
                }

                // Handle CSRF token errors
                if (response.status === 403 && requiresCsrf) {
                    this.csrfToken = null; // Clear cached token
                    if (attempt === 0) {
                        attempt++;
                        continue; // Retry with new CSRF token
                    }
                }

                if (!response.ok) {
                    const errorData = await this.parseErrorResponse(response);
                    throw new ApiError({
                        message: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
                        status: response.status,
                        code: errorData.code,
                        details: errorData.details
                    });
                }

                const data = await this.parseSuccessResponse<T>(response);

                return {
                    data,
                    status: response.status,
                    headers: response.headers,
                    ok: response.ok
                };

            } catch (error) {
                lastError = error as Error;

                // Don't retry on certain errors
                if (error instanceof ApiError && [400, 401, 403, 404, 422].includes(error.status)) {
                    throw error;
                }

                attempt++;

                if (attempt < this.config.retryAttempts) {
                    // Exponential backoff
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                }
            }
        }

        throw lastError!;
    }

    /**
     * Parse successful response
     */
    private async parseSuccessResponse<T>(response: Response): Promise<T> {
        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }

        return await response.text() as unknown as T;
    }

    /**
     * Parse error response
     */
    private async parseErrorResponse(response: Response): Promise<any> {
        try {
            const contentType = response.headers.get('content-type');

            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }

            return { message: await response.text() };
        } catch {
            return { message: `HTTP ${response.status}: ${response.statusText}` };
        }
    }

    /**
     * Convenience methods
     */
    public async get<T = any>(url: string, options: Omit<RequestOptions, 'method'> = {}): Promise<ApiResponse<T>> {
        return this.request<T>(url, { ...options, method: 'GET' });
    }

    public async post<T = any>(url: string, body?: any, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
        return this.request<T>(url, { ...options, method: 'POST', body });
    }

    public async put<T = any>(url: string, body?: any, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
        return this.request<T>(url, { ...options, method: 'PUT', body });
    }

    public async delete<T = any>(url: string, options: Omit<RequestOptions, 'method'> = {}): Promise<ApiResponse<T>> {
        return this.request<T>(url, { ...options, method: 'DELETE' });
    }

    public async patch<T = any>(url: string, body?: any, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
        return this.request<T>(url, { ...options, method: 'PATCH', body });
    }
}

// Custom error class
class ApiError extends Error {
    public status: number;
    public code?: string;
    public details?: any;

    constructor({ message, status, code, details }: { message: string; status: number; code?: string; details?: any }) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

// Create and export default instance
const apiClient = new SecureApiClient({
    baseUrl: process.env.REACT_APP_API_BASE_URL || 'https://api.example.com'
});

export { ApiError, SecureApiClient, apiClient };
export type { ApiResponse, RequestOptions };
