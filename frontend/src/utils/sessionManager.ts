/**
 * Session Management Utility
 * Handles secure session management with automatic logout and activity tracking
 */

interface SessionConfig {
    timeout: number;
    warningTime: number;
    checkInterval: number;
    storageKey: string;
}

interface SessionData {
    lastActivity: number;
    sessionStart: number;
    userId?: string;
    expiresAt?: number;
}

type SessionEventType = 'warning' | 'expired' | 'extended' | 'destroyed';

interface SessionEvent {
    type: SessionEventType;
    remainingTime?: number;
    additionalTime?: number;
    data?: any;
}

type SessionEventHandler = (event: SessionEvent) => void;

class SessionManager {
    private config: SessionConfig;
    private sessionData: SessionData | null = null;
    private checkInterval: NodeJS.Timeout | null = null;
    private eventHandlers: Map<SessionEventType, SessionEventHandler[]> = new Map();
    private isActive = false;
    private warningShown = false;

    constructor(config: Partial<SessionConfig> = {}) {
        this.config = {
            timeout: 30 * 60 * 1000, // 30 minutes
            warningTime: 5 * 60 * 1000, // 5 minutes before timeout
            checkInterval: 60 * 1000, // Check every minute
            storageKey: 'session_data',
            ...config
        };

        this.initializeEventListeners();
    }

    /**
     * Start session management
     */
    public startSession(userId?: string, expiresAt?: number): void {
        const now = Date.now();

        this.sessionData = {
            lastActivity: now,
            sessionStart: now,
            userId,
            expiresAt
        };

        this.saveSessionData();
        this.isActive = true;
        this.warningShown = false;

        this.startMonitoring();
        console.log('Session started for user:', userId);
    }

    /**
     * End session and cleanup
     */
    public endSession(): void {
        this.isActive = false;
        this.sessionData = null;
        this.warningShown = false;

        this.clearSessionData();
        this.stopMonitoring();

        this.emit('destroyed', {});
        console.log('Session ended');
    }

    /**
     * Update last activity timestamp
     */
    public updateActivity(): void {
        if (!this.isActive || !this.sessionData) return;

        this.sessionData.lastActivity = Date.now();
        this.saveSessionData();

        // Reset warning if it was shown
        if (this.warningShown) {
            this.warningShown = false;
            console.log('Session activity detected, warning reset');
        }
    }

    /**
     * Extend session expiry
     */
    public extendSession(additionalTime: number): void {
        if (!this.isActive || !this.sessionData) return;

        const now = Date.now();
        this.sessionData.lastActivity = now;

        if (this.sessionData.expiresAt) {
            this.sessionData.expiresAt = Math.max(this.sessionData.expiresAt, now) + additionalTime;
        }

        this.saveSessionData();
        this.warningShown = false;

        this.emit('extended', { additionalTime });
        console.log('Session extended by', additionalTime / 1000, 'seconds');
    }

    /**
     * Get remaining session time
     */
    public getRemainingTime(): number {
        if (!this.isActive || !this.sessionData) return 0;

        const now = Date.now();
        const activityTimeout = this.sessionData.lastActivity + this.config.timeout;
        const expiryTimeout = this.sessionData.expiresAt || Infinity;

        const remainingTime = Math.min(activityTimeout, expiryTimeout) - now;
        return Math.max(0, remainingTime);
    }

    /**
     * Check if session is valid
     */
    public isSessionValid(): boolean {
        return this.isActive && this.getRemainingTime() > 0;
    }

    /**
     * Get session information
     */
    public getSessionInfo(): SessionData | null {
        return this.sessionData ? { ...this.sessionData } : null;
    }

    /**
     * Add event listener
     */
    public addEventListener(type: SessionEventType, handler: SessionEventHandler): void {
        if (!this.eventHandlers.has(type)) {
            this.eventHandlers.set(type, []);
        }
        this.eventHandlers.get(type)!.push(handler);
    }

    /**
     * Remove event listener
     */
    public removeEventListener(type: SessionEventType, handler: SessionEventHandler): void {
        const handlers = this.eventHandlers.get(type);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    /**
     * Emit session event
     */
    private emit(type: SessionEventType, data: Partial<SessionEvent>): void {
        const handlers = this.eventHandlers.get(type);
        if (handlers) {
            const event: SessionEvent = { type, ...data };
            handlers.forEach(handler => {
                try {
                    handler(event);
                } catch (error) {
                    console.error('Session event handler error:', error);
                }
            });
        }
    }

    /**
     * Start session monitoring
     */
    private startMonitoring(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }

        this.checkInterval = setInterval(() => {
            this.checkSession();
        }, this.config.checkInterval);
    }

    /**
     * Stop session monitoring
     */
    private stopMonitoring(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    /**
     * Check session status
     */
    private checkSession(): void {
        if (!this.isActive || !this.sessionData) return;

        const remainingTime = this.getRemainingTime();

        if (remainingTime <= 0) {
            // Session expired
            console.log('Session expired');
            this.emit('expired', { remainingTime: 0 });
            this.endSession();
            return;
        }

        if (remainingTime <= this.config.warningTime && !this.warningShown) {
            // Show warning
            this.warningShown = true;
            console.log('Session warning:', remainingTime / 1000, 'seconds remaining');
            this.emit('warning', { remainingTime });
        }
    }

    /**
     * Initialize activity event listeners
     */
    private initializeEventListeners(): void {
        const activityEvents = [
            'mousedown',
            'mousemove',
            'keypress',
            'scroll',
            'touchstart',
            'click',
            'focus'
        ];

        // Throttle activity updates
        let activityTimeout: NodeJS.Timeout | null = null;

        const handleActivity = () => {
            if (activityTimeout) return;

            activityTimeout = setTimeout(() => {
                this.updateActivity();
                activityTimeout = null;
            }, 30000); // Update at most every 30 seconds
        };

        activityEvents.forEach(event => {
            document.addEventListener(event, handleActivity, true);
        });

        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.updateActivity();
            }
        });

        // Handle beforeunload to save session state
        window.addEventListener('beforeunload', () => {
            this.saveSessionData();
        });
    }

    /**
     * Save session data to storage
     */
    private saveSessionData(): void {
        if (!this.sessionData) return;

        try {
            const dataToStore = {
                ...this.sessionData,
                timestamp: Date.now()
            };

            sessionStorage.setItem(this.config.storageKey, JSON.stringify(dataToStore));
        } catch (error) {
            console.warn('Failed to save session data:', error);
        }
    }

    /**
     * Load session data from storage
     */
    private loadSessionData(): SessionData | null {
        try {
            const stored = sessionStorage.getItem(this.config.storageKey);
            if (!stored) return null;

            const data = JSON.parse(stored);

            // Validate stored data
            if (typeof data.lastActivity !== 'number' || typeof data.sessionStart !== 'number') {
                return null;
            }

            return data;
        } catch (error) {
            console.warn('Failed to load session data:', error);
            return null;
        }
    }

    /**
     * Clear session data from storage
     */
    private clearSessionData(): void {
        try {
            sessionStorage.removeItem(this.config.storageKey);
            localStorage.removeItem(this.config.storageKey); // Clean up legacy storage
        } catch (error) {
            console.warn('Failed to clear session data:', error);
        }
    }

    /**
     * Restore session from storage
     */
    public restoreSession(): boolean {
        const storedData = this.loadSessionData();
        if (!storedData) return false;

        // Check if stored session is still valid
        const now = Date.now();
        const timeSinceActivity = now - storedData.lastActivity;
        const timeUntilExpiry = storedData.expiresAt ? storedData.expiresAt - now : Infinity;

        if (timeSinceActivity > this.config.timeout || timeUntilExpiry <= 0) {
            this.clearSessionData();
            return false;
        }

        // Restore session
        this.sessionData = storedData;
        this.isActive = true;
        this.warningShown = false;

        this.startMonitoring();
        console.log('Session restored for user:', storedData.userId);

        return true;
    }
}

// Create default session manager instance
const sessionManager = new SessionManager();

export { SessionManager, sessionManager };
export type { SessionConfig, SessionData, SessionEvent, SessionEventHandler, SessionEventType };

