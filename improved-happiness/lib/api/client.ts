// Prefer env var in production; fall back to localhost in dev
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:8005';

// Types
export interface Agent {
  id: string;
  name: string;
  welcomeMessage: string;
  systemPrompt: string;
  headerColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  profileImage?: string;
  temperature?: number;
  model?: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

interface ChatRequest {
  sessionId: string;
  message: string;
  history?: Message[];
  agentId: string;
}

interface ChatResponse {
  reply: string;
  sessionId: string;
  agent?: Partial<Agent>;
}

interface SessionResponse {
  sessionId: string;
  agent?: Partial<Agent>;
}

// Widget session request type is not currently used
// interface WidgetSessionRequest {
//   agentId: string;
// }

interface WidgetChatRequest extends ChatRequest {
  sessionId: string;
  agentId: string;
  message: string;
  history?: Message[];
}

// Error handling
class ApiError extends Error {
  status: number;
  details?: Record<string, unknown>;

  constructor(message: string, status = 500, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

// API Client
export const apiClient = {
  /**
   * Health check endpoint
   * @returns {Promise<boolean>} True if the API is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      return response.ok;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  },

  /**
   * Create a new chat session
   * @param {string} agentId - The ID of the agent to create a session for
   * @returns {Promise<SessionResponse>} The session details
   */
  async createSession(agentId: string): Promise<SessionResponse> {
    const response = await fetch(`${API_BASE_URL}/api/chat/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ agentId }),
    });

    if (!response.ok) {
      const error = await this.parseError(response);
      throw error;
    }

    return response.json();
  },

  /**
   * Send a chat message
   * @param {string} sessionId - The session ID
   * @param {string} agentId - The agent ID
   * @param {string} message - The message to send
   * @param {Message[]} history - Optional message history
   * @returns {Promise<ChatResponse>} The chat response
   */
  async sendMessage(
    sessionId: string,
    agentId: string,
    message: string,
    history: Message[] = []
  ): Promise<ChatResponse> {
    const payload: ChatRequest = {
      sessionId,
      agentId,
      message,
      history,
    };

    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await this.parseError(response);
      throw error;
    }

    return response.json();
  },

  /**
   * Create a new widget session
   * @param {string} agentId - The ID of the agent
   * @returns {Promise<SessionResponse>} The session details including agent theming
   */
  async createWidgetSession(agentId: string): Promise<SessionResponse> {
    const response = await fetch(`${API_BASE_URL}/api/chat/widget/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ agentId }),
    });

    if (!response.ok) {
      const error = await this.parseError(response);
      throw error;
    }

    return response.json();
  },

  /**
   * Send a message through the widget chat
   * @param {string} sessionId - The session ID
   * @param {string} agentId - The agent ID
   * @param {string} message - The message to send
   * @param {Message[]} history - The message history
   * @returns {Promise<ChatResponse>} The chat response
   */
  async sendWidgetMessage(
    sessionId: string,
    agentId: string,
    message: string,
    history: Message[] = []
  ): Promise<ChatResponse> {
    const payload: WidgetChatRequest = {
      sessionId,
      agentId,
      message,
      history,
    };

    const response = await fetch(`${API_BASE_URL}/api/chat/widget/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await this.parseError(response);
      throw error;
    }

    return response.json();
  },

  /**
   * Parse error response from the API
/**
   * Parse error response from the API
   */
  async parseError(response: Response): Promise<ApiError> {
    try {
      const errorData = await response.json();
      return new ApiError(
        errorData.error || 'API request failed',
        response.status,
        errorData.details
      );
    } catch (_error) {
      return new ApiError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status
      );
    }
  },
};
